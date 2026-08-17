import { Menu, nativeImage, shell, Tray } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export interface TrayActions {
  /** 显示主界面（含恢复/聚焦） */
  onShow: () => void
  /** 打开工作区目录 */
  onOpenWorkspace: () => void
  /** 打开官方 UI 的设置页 */
  onOpenSettings: () => void
  /** 恢复侧边栏（点击官方折叠开关，找不到时刷新兜底） */
  onShowSidebar: () => void
  /** 新建任务（MVP：显示主界面并聚焦，后续接入 UI 深链） */
  onNewTask: () => void
  /** 退出应用 */
  onQuit: () => void
}

/**
 * 系统托盘：关闭窗口时最小化到托盘；右键菜单 + 双击恢复。
 */
export class TrayController {
  private tray: Tray | null = null

  create(actions: TrayActions): void {
    if (this.tray) return
    const icon = this.loadIcon()
    if (!icon) {
      console.warn('[tray] 未找到托盘图标，跳过托盘创建')
      return
    }
    const tray = new Tray(icon)
    tray.setToolTip('DSH Studio')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '显示主界面', click: () => actions.onShow() },
        { label: '新建任务', click: () => actions.onNewTask() },
        { label: '打开设置', click: () => actions.onOpenSettings() },
        { label: '显示侧边栏', click: () => actions.onShowSidebar() },
        { type: 'separator' },
        { label: '打开工作区', click: () => actions.onOpenWorkspace() },
        { type: 'separator' },
        { label: '退出', click: () => actions.onQuit() }
      ])
    )
    tray.on('double-click', () => actions.onShow())
    this.tray = tray
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }

  private loadIcon(): Electron.NativeImage | null {
    // 打包后：resources/assets（extraResources）或 resources 根；开发/构建：项目 assets/
    const candidates = [
      path.join(process.resourcesPath ?? '', 'assets', 'icon-16.png'),
      path.join(process.resourcesPath ?? '', 'icon-16.png'),
      path.join(here, '..', '..', 'assets', 'icon-16.png')
    ]
    for (const file of candidates) {
      const img = nativeImage.createFromPath(file)
      if (!img.isEmpty()) return img
    }
    return null
  }
}

export async function openInShell(dir: string): Promise<void> {
  const err = await shell.openPath(dir)
  if (err) console.error(`[workspace] 打开目录失败：${err}`)
}
