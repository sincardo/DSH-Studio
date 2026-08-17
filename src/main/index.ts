import { app, BrowserWindow, dialog, Menu, nativeTheme, Notification, screen, shell } from 'electron'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { DshService } from './dsh-service'
import { TrayController, openInShell } from './tray'
import { DesktopConfig } from './desktop-config'
import {
  PluginService,
  RECOMMENDED_PLUGINS,
  BUNDLED_PLUGINS,
  ensureProfilePatchRow,
  removeProfilePatchRow,
  ensureProfileBundle,
  removeStaleProfileDep,
  ensureProfileModuleLink,
  removeProfileModuleCopy,
  readProfileDeps
} from './plugin-service'
import { findSystemNodeDir } from './spawn-env'
import { registerAppearanceIpc, startWallpaperServer } from './appearance'
import { SessionEventWatcher } from './session-events'
import { setupAutoUpdater } from './updater'

// 界面语言：Chromium 报告 zh-CN，官方 UI 的 locale 设置未显式选择时即跟随浏览器语言
app.commandLine.appendSwitch('lang', 'zh-CN')
// 应用显示名（通知标题等）；不设置自定义 AUMID —— 保持默认 AUMID 让任务栏沿用窗口鲸鱼图标
app.setName('DSH Studio')

const here = path.dirname(fileURLToPath(import.meta.url))
/** preload 脚本（CJS 输出） */
const preloadPath = path.join(here, '..', 'preload', 'index.cjs')

/** 运行时图标解析：打包版 resources/assets（extraResources）→ resources 根 → 开发版项目 assets */
function resolveIcon(kind: 'ico' | 'png'): string | null {
  const names = kind === 'ico' ? ['icon.ico'] : ['icon-256.png']
  const candidates: string[] = []
  for (const name of names) {
    candidates.push(
      path.join(process.resourcesPath ?? '', 'assets', name),
      path.join(process.resourcesPath ?? '', name),
      path.join(here, '..', '..', 'assets', name)
    )
  }
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return null
}

const SPLASH_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>DSH Studio</title>
<style>
  body { margin:0; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
         background:#0f1115; color:#e6e8ec; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .logo { width:72px; height:72px; color:#4d6bfe; animation: float 2.4s ease-in-out infinite; }
  .name { margin-top:18px; font-size:24px; font-weight:700; letter-spacing:.5px; }
  .sub { margin-top:10px; color:#8b93a1; font-size:13px; }
  .spinner { margin-top:30px; width:26px; height:26px; border:3px solid #2a2f3a; border-top-color:#4f7cff;
             border-radius:50%; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @media (prefers-color-scheme: light) {
    body { background:#f7f8fa; color:#1a1e26; }
    .sub { color:#6b7280; }
    .spinner { border-color:#d9dde3; border-top-color:#4d6bfe; }
  }
</style></head>
<body>
  <svg class="logo" viewBox="0 0 50 50" fill="none" aria-hidden="true">
    <path fill="currentColor" d="M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z"/>
  </svg>
  <div class="name">DSH Studio</div>
  <div class="sub">正在启动 DeepSeek Harness…</div>
  <div class="spinner"></div>
</body></html>`

function dataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function splashUrl(): string {
  return dataUrl(SPLASH_HTML)
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!)
}

function errorUrl(message: string): string {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>DSH Studio</title><style>
body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1115;color:#e6e8ec;font-family:system-ui,sans-serif;padding:24px}
pre{white-space:pre-wrap;max-width:720px;color:#ff8b8b;background:#1a1e26;padding:16px;border-radius:8px;font-size:13px}
</style></head><body><pre>${escapeHtml(message)}</pre></body></html>`
  return dataUrl(html)
}

function isLocalWebUrl(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/.test(url)
}

/** 崩溃自动重启：最大次数与指数退避（1s / 2s / 4s） */
const MAX_RESTART_ATTEMPTS = 3
const RESTART_BASE_DELAY_MS = 1_000

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null
  let dsh: DshService | null = null
  let tray: TrayController | null = null
  let quitting = false
  let starting = false
  let recommendedChecked = false
  /** 应用启动时的工作目录，作为「打开工作区」的默认目标 */
  const launchDir = process.cwd()
  const desktopConfig = new DesktopConfig()
  const pluginService = new PluginService()
  const sessionWatcher = new SessionEventWatcher()

  /** 系统通知（带鲸鱼图标） */
  function notify(body: string): void {
    const icon = resolveIcon('ico') ?? resolveIcon('png')
    new Notification({
      title: 'DSH Studio',
      body,
      ...(icon ? { icon } : {})
    }).show()
  }

  /**
   * 开发模式：自动创建带鲸鱼图标的桌面快捷方式（一次）。
   * 任务栏图标在开发模式跟随 exe（electron.exe），
   * 用该快捷方式启动或固定到任务栏后任务栏即显示鲸鱼。
   */
  function ensureDevShortcut(): void {
    if (app.isPackaged) return
    if (desktopConfig.get<boolean>('devShortcutCreated')) return
    const script = path.join(here, '..', '..', 'scripts', 'create-shortcut.ps1')
    if (!existsSync(script)) return
    const child = spawn(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', script],
      { stdio: 'ignore', windowsHide: true }
    )
    child.on('exit', () => {
      desktopConfig.set('devShortcutCreated', true)
      console.log('[shortcut] 已创建桌面快捷方式「DSH Studio」——用它启动或固定到任务栏，任务栏即显示鲸鱼图标')
    })
    child.on('error', () => {
      /* 失败时下次启动重试 */
    })
  }

  /** 检查并（可选）安装推荐插件：插件市场 + 插件管理器（文件树/外观已内置） */
  async function installRecommendedPlugins(
    interactive: boolean,
    verbose = false
  ): Promise<{ ok: boolean; installedAny: boolean }> {
    const installed = readProfileDeps('web')

    const missing = RECOMMENDED_PLUGINS.filter((p) => !installed.includes(p.name))
    if (missing.length === 0) {
      const patched = prebootRepair()
      desktopConfig.set('recommendedPluginsInstalled', true)
      if (verbose) {
        await dialog.showMessageBox({
          type: 'info',
          title: '推荐插件',
          message: '推荐插件已全部安装 ✅',
          detail: patched
            ? '检测到插件登记异常，已自动修复；将重启服务生效。'
            : '可在 设置 → 插件 中使用插件市场与插件管理器。'
        })
      }
      return { ok: true, installedAny: patched }
    }

    if (interactive) {
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['安装', '暂不安装'],
        defaultId: 0,
        cancelId: 1,
        title: '推荐插件',
        message: '是否安装推荐插件？',
        detail: `插件市场（浏览/搜索/一键安装社区插件）与插件管理器（启用/停用）。\n安装完成后将自动重启服务生效。\n\n文件资源管理器与个性化外观已随应用内置，无需安装。`
      })
      if (response !== 0) {
        // 只有用户明确拒绝才永久跳过自动提示
        desktopConfig.set('recommendedPluginsDeclined', true)
        return { ok: false, installedAny: false }
      }
    }

    let installedAny = false
    const startedAt = Date.now()
    mainWindow?.setTitle('正在安装插件…（视网络速度可能需要几分钟）')
    try {
      for (const plugin of missing) {
        const spec = `${plugin.name}@${plugin.version}`
        console.log(`[plugins] 开始安装 ${spec} …（进度实时输出在下方）`)
        const res = await pluginService.install('web', spec, { echo: true })
        if (res.code !== 0) {
          const nodeDir = findSystemNodeDir()
          const hint = nodeDir
            ? `\n\n诊断：系统 Node 位于 ${nodeDir}，已注入子进程 PATH。若仍失败，请检查网络或代理设置。`
            : '\n\n诊断：未找到 Node.js。请先安装 Node.js 并加入 PATH（https://nodejs.org/zh-cn）。'
          dialog.showErrorBox(
            '插件安装失败',
            `安装 ${spec} 失败：\n${res.stderr.slice(-1200) || res.stdout.slice(-1200)}${hint}`
          )
          notify('插件安装失败，详见弹窗。')
          // 注意：失败时不置位 —— 下次启动会自动重试提示
          return { ok: false, installedAny }
        }
        console.log(
          `[plugins] ${spec} 安装完成（耗时 ${Math.round((Date.now() - startedAt) / 1000)}s）`
        )
        installedAny = true
        installed.push(plugin.name)
      }
      desktopConfig.set('recommendedPluginsInstalled', true)
      notify('推荐插件安装完成，正在重启服务生效…')
      return { ok: true, installedAny }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      dialog.showErrorBox('插件安装失败', message)
      notify('插件安装失败，详见弹窗。')
      return { ok: false, installedAny }
    } finally {
      mainWindow?.setTitle('DSH Studio')
    }
  }

  /** 首次就绪后检查一次推荐插件（仅用户明确拒绝后跳过） */
  async function checkRecommendedPlugins(): Promise<void> {
    if (desktopConfig.get<boolean>('recommendedPluginsDeclined')) return
    const r = await installRecommendedPlugins(true)
    if (r.installedAny) await restartDsh()
  }

  /** 重启 dsh web（插件安装后生效） */
  async function restartDsh(): Promise<void> {
    if (!dsh || quitting) return
    console.log('[plugins] 重启 dsh web 使插件生效…')
    await dsh.stop()
    await startDshWithRetry()
    console.log('[plugins] 重启完成')
  }

  /** 窗口 bounds 是否落在某块显示器工作区内（防止多屏切换后恢复到屏幕外） */
  function boundsVisible(x: number, y: number, width: number, height: number): boolean {
    return screen.getAllDisplays().some((display) => {
      const a = display.workArea
      return (
        x < a.x + a.width - 40 &&
        x + width > a.x + 40 &&
        y < a.y + a.height - 40 &&
        y + height > a.y + 40
      )
    })
  }

  function createWindow(): BrowserWindow {
    // 窗口状态记忆：位置/大小/最大化（持久化到 $DSH_HOME/config.json 的 window 节）
    const saved = desktopConfig.get<{ x?: number; y?: number; width?: number; height?: number; maximized?: boolean }>(
      'window'
    )
    const restoreBounds =
      saved && saved.width && saved.height && saved.x !== undefined && saved.y !== undefined && boundsVisible(saved.x, saved.y, saved.width, saved.height)
        ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
        : {}

    const win = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 940,
      minHeight: 600,
      title: 'DSH Studio',
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#f7f8fa',
      show: false,
      ...restoreBounds,
      ...(() => {
        const icon = resolveIcon('ico') ?? resolveIcon('png')
        return icon ? { icon } : {}
      })(),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        ...(existsSync(preloadPath) ? { preload: preloadPath } : {})
      }
    })

    if (saved?.maximized) win.maximize()

    win.once('ready-to-show', () => win.show())

    // 窗口状态持久化（防抖）
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    const saveWindowState = () => {
      if (win.isDestroyed()) return
      const maximized = win.isMaximized()
      const bounds = win.getNormalBounds()
      desktopConfig.set('window', {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        maximized
      })
    }
    const scheduleSave = () => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(saveWindowState, 800)
    }
    win.on('resize', scheduleSave)
    win.on('move', scheduleSave)
    win.on('maximize', scheduleSave)
    win.on('unmaximize', scheduleSave)

    // 恢复上次的外观窗口效果（毛玻璃/云母）
    const savedEffect = desktopConfig.get<{ windowEffect?: string }>('appearance')?.windowEffect ?? 'none'
    let activeMaterial = 'none'
    const applyWindowMaterial = (winToApply: BrowserWindow, material: string) => {
      if (activeMaterial === material) return
      try {
        winToApply.setBackgroundMaterial(material as 'none' | 'mica' | 'acrylic' | 'auto')
        activeMaterial = material
      } catch {
        /* 系统不支持时忽略 */
      }
    }
    applyWindowMaterial(win, savedEffect === 'none' ? 'none' : savedEffect)

    // Windows 11 下 acrylic/mica 窗口拖动滞后（材质重绘慢）：
    // 拖动开始临时取消材质，拖动停止后按当前配置恢复
    let dragRestoreTimer: ReturnType<typeof setTimeout> | null = null
    win.on('will-move', () => {
      if (activeMaterial !== 'none') {
        try {
          win.setBackgroundMaterial('none')
          activeMaterial = 'none'
        } catch {
          /* 忽略 */
        }
      }
    })
    win.on('move', () => {
      if (dragRestoreTimer) clearTimeout(dragRestoreTimer)
      dragRestoreTimer = setTimeout(() => {
        if (win.isDestroyed()) return
        const effect = desktopConfig.get<{ windowEffect?: string }>('appearance')?.windowEffect ?? 'none'
        applyWindowMaterial(win, effect === 'none' ? 'none' : effect)
      }, 500)
    })

    // 关闭窗口 → 最小化到托盘（应用真正退出时除外）；关闭前保存窗口状态
    win.on('close', (event) => {
      if (saveTimer) clearTimeout(saveTimer)
      saveWindowState()
      if (!quitting) {
        event.preventDefault()
        win.hide()
      }
    })

    win.webContents.on('console-message', (event) => {
      console.log(`[web-${event.level}]`, event.message)
    })

    win.webContents.on('did-fail-load', (_event, code, desc, url) => {
      console.log('[web-load-fail]', code, desc, url)
    })

    win.webContents.on('render-process-gone', (_event, details) => {
      console.log('[web-renderer-gone]', details.reason, details.exitCode)
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url) && !isLocalWebUrl(url)) {
        void shell.openExternal(url)
        return { action: 'deny' }
      }
      return { action: 'allow' }
    })

    win.webContents.on('will-navigate', (event, url) => {
      if (/^https?:/.test(url) && !isLocalWebUrl(url)) {
        event.preventDefault()
        void shell.openExternal(url)
      }
    })

    win.on('closed', () => {
      mainWindow = null
    })

    return win
  }

  function showMainWindow(): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    } else {
      void start()
    }
  }

  /** 在官方 UI 中查找并点击设置入口（侧边栏底部槽位），找不到时静默降级 */
  const SETTINGS_CLICKER = `(() => {
    const labels = ['settings', '设置']
    const norm = (s) => (s ?? '').trim().toLowerCase()
    const candidates = [...document.querySelectorAll('button, [role="button"], a, [aria-label], [title]')]
    const byAttr = candidates.find((el) => {
      const v = norm(el.getAttribute('aria-label')) || norm(el.getAttribute('title'))
      return v !== '' && labels.some((l) => v.includes(l))
    })
    const byText = [...document.querySelectorAll('button, [role="button"]')].find((el) => {
      const t = norm(el.textContent)
      return t !== '' && t.length < 40 && labels.some((l) => t.includes(l))
    })
    const target = byAttr ?? byText
    if (target) {
      target.click()
      return '已打开设置：' + (target.getAttribute('aria-label') || target.textContent?.trim() || target.tagName)
    }
    return '未找到设置入口'
  })()`

  async function openSettings(): Promise<void> {
    showMainWindow()
    const win = mainWindow
    if (!win || win.isDestroyed()) return
    try {
      const result = (await win.webContents.executeJavaScript(SETTINGS_CLICKER, true)) as string
      console.log('[settings]', result)
    } catch {
      /* 页面未就绪（启动页）时忽略 */
    }
  }

  /** 侧边栏恢复：点击官方折叠开关（aria-label「打开侧边栏」），找不到时刷新兜底 */
  const SIDEBAR_CLICKER = `(() => {
    const btn = document.querySelector('button[aria-label="打开侧边栏"], button[aria-label="Open sidebar"]')
    if (btn) { btn.click(); return '已恢复侧边栏' }
    return '未找到侧边栏开关'
  })()`

  async function showSidebar(): Promise<void> {
    showMainWindow()
    const win = mainWindow
    if (!win || win.isDestroyed()) return
    try {
      const result = (await win.webContents.executeJavaScript(SIDEBAR_CLICKER, true)) as string
      console.log('[sidebar]', result)
      if (result === '未找到侧边栏开关') {
        win.webContents.reload()
        console.log('[sidebar] 已刷新页面兜底')
      }
    } catch {
      /* 页面未就绪时忽略 */
    }
  }

  function buildAppMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '文件',
        submenu: [
          { label: '新建任务', click: () => showMainWindow() },
          { label: '打开工作区', click: () => void openInShell(launchDir) },
          { type: 'separator' },
          {
            label: '退出',
            click: () => {
              quitting = true
              app.quit()
            }
          }
        ]
      },
      {
        label: '视图',
        submenu: [
          { label: '显示侧边栏', click: () => void showSidebar() },
          { label: '重新加载', role: 'reload' },
          { label: '开发者工具', role: 'toggleDevTools' }
        ]
      },
      {
        label: '设置',
        submenu: [
          { label: '打开设置…', click: () => void openSettings() },
          {
            label: '安装推荐插件…',
            click: () =>
              void installRecommendedPlugins(true, true).then((r) => {
                if (r.installedAny) void restartDsh()
              })
          }
        ]
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '关于 DSH Studio',
            click: () => {
              void dialog.showMessageBox({
                type: 'info',
                title: '关于 DSH Studio',
                message: 'DSH Studio',
                detail: `版本 ${app.getVersion()}\nDeepSeek Harness 桌面客户端（MIT 协议）`
              })
            }
          }
        ]
      }
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }

  /** 引导前修复：内置插件（回退链接 + bundles/patch 行）+ 清理历史残留；损坏会导致 dsh 启动失败 */
  function prebootRepair(): boolean {
    let changed = false
    for (const p of BUNDLED_PLUGINS) {
      // 1) 官方扁平回退目录：链接到应用内置副本（先建链，后清 profile 副本，保证不落空）
      if (ensureProfileModuleLink(p.name)) changed = true
      if (removeProfileModuleCopy('web', p.name)) changed = true
      // 2) 登记：自带 bundle patch → 进 bundles 且 profile patch 不得有该行；否则写 profile patch 行
      if (p.ownPatchRowId) {
        if (ensureProfileBundle('web', p.name)) changed = true
        if (removeProfilePatchRow('web', p.ownPatchRowId, p.name)) changed = true
      }
      if (p.patchRow && ensureProfilePatchRow('web', p.patchRow)) changed = true
      // 3) 清理历史安装残留的 profile 依赖条目
      if (removeStaleProfileDep('web', p.name)) changed = true
    }
    return changed
  }

  /** 启动（或重启）dsh web，失败按指数退避自动重试 */
  async function startDshWithRetry(attempt = 0): Promise<void> {
    try {
      await dsh!.start()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (quitting || attempt >= MAX_RESTART_ATTEMPTS) {
        dialog.showErrorBox('DSH 启动失败', message)
        if (mainWindow && !mainWindow.isDestroyed()) await mainWindow.loadURL(errorUrl(message))
        return
      }
      await new Promise((resolve) => setTimeout(resolve, RESTART_BASE_DELAY_MS * 2 ** attempt))
      await startDshWithRetry(attempt + 1)
    }
  }

  async function start(): Promise<void> {
    if (starting) return
    starting = true
    try {
      if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = createWindow()
        await mainWindow.loadURL(splashUrl())
      }

      // 引导前先修复损坏的 patch 文件与内置插件登记（否则 dsh 无法启动，后续修复逻辑也无从执行）
      if (prebootRepair()) {
        console.log('[plugins] 引导前修复了 profile 插件登记')
      }

      if (!dsh) {
        dsh = new DshService()
        dsh.on('ready', (url: string) => {
          if (mainWindow && !mainWindow.isDestroyed()) void mainWindow.loadURL(url)
          // 任务完成系统通知：订阅 dsh 宿主事件流（仅窗口未聚焦时提醒）
          sessionWatcher.start(url, () => {
            if (mainWindow && !mainWindow.isFocused()) {
              notify('任务已完成')
            }
          })
          if (!recommendedChecked) {
            recommendedChecked = true
            void checkRecommendedPlugins()
          }
        })
        // 意外退出 → 回到启动页并自动重启（应用退出时 stop() 已摘除该监听，不会误触发）
        dsh.on('exit', () => {
          sessionWatcher.stop()
          if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
            void mainWindow.loadURL(splashUrl())
            void startDshWithRetry()
          }
        })
      }
      await startDshWithRetry()
    } finally {
      starting = false
    }
  }

  app.whenReady().then(() => {
    console.log('[env] 系统 Node 目录:', findSystemNodeDir() ?? '未找到')
    startWallpaperServer()
    registerAppearanceIpc(desktopConfig, () => mainWindow)
    setupAutoUpdater(() => mainWindow)
    ensureDevShortcut()
    buildAppMenu()
    tray = new TrayController()
    tray.create({
      onShow: () => showMainWindow(),
      onNewTask: () => showMainWindow(),
      onOpenSettings: () => void openSettings(),
      onShowSidebar: () => void showSidebar(),
      onOpenWorkspace: () => void openInShell(launchDir),
      onQuit: () => {
        quitting = true
        app.quit()
      }
    })
    void start()
  })

  app.on('second-instance', () => {
    showMainWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    showMainWindow()
  })

  app.on('before-quit', () => {
    quitting = true
    sessionWatcher.stop()
    tray?.destroy()
    tray = null
    void dsh?.stop()
  })
}
