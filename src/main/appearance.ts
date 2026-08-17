import { BrowserWindow, dialog, ipcMain } from 'electron'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { copyFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import path from 'node:path'
import { DesktopConfig, resolveDshHome } from './desktop-config'

const WALLPAPER_PORT = 39001
const WALLPAPER_MAX_BYTES = 15 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

/** 允许持久化的外观配置键（白名单，防止渲染层写入无关字段） */
const CONFIG_KEYS = [
  'background',
  'backgroundColor',
  'backgroundGradient',
  'wallpaperFile',
  'wallpaperOpacity',
  'wallpaperBlur',
  'buttonRadius',
  'accent',
  'borderStyle',
  'windowEffect'
] as const

const DEFAULT_APPEARANCE: Record<string, unknown> = {
  background: 'theme',
  backgroundColor: '#1a1e26',
  backgroundGradient: 'dusk',
  wallpaperFile: null,
  wallpaperOpacity: 30,
  wallpaperBlur: 0,
  buttonRadius: 'default',
  accent: null,
  borderStyle: 'hairline',
  windowEffect: 'none'
}

export function wallpaperDir(): string {
  return path.join(resolveDshHome(), 'desktop', 'wallpaper')
}

let wallpaperServer: Server | null = null

/** 本地壁纸 HTTP 服务（127.0.0.1:39001）：页面为 http 源，file:// 不可用，故自建静态服务 */
export function startWallpaperServer(): void {
  if (wallpaperServer) return
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${WALLPAPER_PORT}`)
    const name = url.pathname.replace(/^\/+/, '')
    if (!name || name.includes('..') || name.includes('\\') || name.includes('/')) {
      res.writeHead(404)
      res.end()
      return
    }
    const file = path.join(wallpaperDir(), name)
    try {
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404)
        res.end()
        return
      }
      const mime = MIME_BY_EXT[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
      res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' })
      createReadStream(file).pipe(res)
    } catch {
      res.writeHead(500)
      res.end()
    }
  })
  server.listen(WALLPAPER_PORT, '127.0.0.1')
  wallpaperServer = server
}

export function wallpaperUrl(): string | null {
  const file = readWallpaperFileName()
  if (!file) return null
  return `http://127.0.0.1:${WALLPAPER_PORT}/${file}`
}

function readWallpaperFileName(): string | null {
  try {
    for (const entry of readdirSync(wallpaperDir())) {
      if (entry.startsWith('wallpaper.')) return entry
    }
  } catch {
    /* 目录不存在 */
  }
  return null
}

/** 注册外观相关 IPC：配置读写、壁纸选择（落盘 + 返回 URL）、窗口材质切换 */
export function registerAppearanceIpc(
  desktopConfig: DesktopConfig,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('appearance:get', () => {
    const saved = desktopConfig.get<Record<string, unknown>>('appearance') ?? {}
    const merged: Record<string, unknown> = { ...DEFAULT_APPEARANCE }
    for (const key of CONFIG_KEYS) {
      if (saved[key] !== undefined) merged[key] = saved[key]
    }
    return { ...merged, wallpaperUrl: wallpaperUrl() }
  })

  ipcMain.handle('appearance:set', (_event, partial: unknown) => {
    if (typeof partial !== 'object' || partial === null) return
    const current = desktopConfig.get<Record<string, unknown>>('appearance') ?? {}
    const next: Record<string, unknown> = { ...current }
    for (const key of CONFIG_KEYS) {
      const value = (partial as Record<string, unknown>)[key]
      if (value !== undefined) next[key] = value
    }
    desktopConfig.set('appearance', next)
  })

  ipcMain.handle('appearance:pickWallpaper', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择壁纸图片',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const source = result.filePaths[0]
    try {
      const buf = readFileSync(source)
      if (buf.length === 0) throw new Error('文件为空')
      if (buf.length > WALLPAPER_MAX_BYTES) throw new Error('图片超过 15MB 上限')
      mkdirSync(wallpaperDir(), { recursive: true })
      // 清除旧壁纸，写入新文件（保持扩展名）
      for (const entry of readdirSync(wallpaperDir())) {
        if (entry.startsWith('wallpaper.')) rmSync(path.join(wallpaperDir(), entry), { force: true })
      }
      const ext = path.extname(source).toLowerCase()
      const fileName = `wallpaper${ext}`
      copyFileSync(source, path.join(wallpaperDir(), fileName))
      const url = `http://127.0.0.1:${WALLPAPER_PORT}/${fileName}`
      return { url, file: fileName }
    } catch (err) {
      dialog.showErrorBox('壁纸读取失败', err instanceof Error ? err.message : String(err))
      return null
    }
  })

  ipcMain.handle('appearance:setWindowEffect', (_event, effect: unknown) => {
    const win = getWindow()
    if (!win) return { ok: false, message: '窗口不可用' }
    const material = typeof effect === 'string' ? effect : 'none'
    try {
      win.setBackgroundMaterial(material as 'none' | 'mica' | 'acrylic' | 'auto')
      return { ok: true, message: `已应用：${material}` }
    } catch {
      return { ok: false, message: '当前系统不支持该窗口效果（需 Windows 11 / macOS）' }
    }
  })
}
