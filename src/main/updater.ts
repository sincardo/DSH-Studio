import { app, dialog } from 'electron'
import { createRequire } from 'node:module'

// electron-updater 为 CommonJS 包；ESM 主进程下用 createRequire 稳健加载
const require = createRequire(import.meta.url)
const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

/**
 * 自动更新（electron-updater）。仅打包版启用；开发模式跳过。
 * 启动检查 → 静默下载 → 下载完成后询问安装。
 * Phase 5 打包时需在 electron-builder 配置 publish（GitHub Releases）。
 */
export function setupAutoUpdater(getWindow: () => Electron.BrowserWindow | null): void {
  if (!app.isPackaged) {
    console.log('[updater] 开发模式，跳过自动更新检查')
    return
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] 发现新版本', info.version, '— 后台静默下载中…')
  })
  autoUpdater.on('update-not-available', () => {
    console.log('[updater] 已是最新版本')
  })
  autoUpdater.on('error', (err) => {
    console.error('[updater] 更新出错：', err.message)
  })
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] 新版本下载完成', info.version)
    const win = getWindow()
    const options = {
      type: 'info' as const,
      buttons: ['立即重启安装', '稍后'],
      defaultId: 0,
      cancelId: 1,
      title: '发现新版本',
      message: `DSH Studio ${info.version} 已下载完成`,
      detail: '重启应用即可完成更新。'
    }
    void (win
      ? dialog.showMessageBox(win, options)
      : dialog.showMessageBox(options)
    ).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true)
    })
  })

  try {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] 检查更新失败：', err instanceof Error ? err.message : String(err))
    })
  } catch {
    /* 无发布配置时静默 */
  }
}
