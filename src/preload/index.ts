import { contextBridge, ipcRenderer } from 'electron'

/**
 * DSH Studio 桌面桥接：官方 UI（远程页面）与本进程内的一等公民 API。
 * 仅在 dsh web 页面中暴露；sandbox + contextIsolation 保持开启。
 */
const bridge = {
  appearance: {
    get: () => ipcRenderer.invoke('appearance:get'),
    set: (partial: unknown) => ipcRenderer.invoke('appearance:set', partial)
  },
  pickWallpaper: () => ipcRenderer.invoke('appearance:pickWallpaper'),
  setWindowEffect: (effect: string) => ipcRenderer.invoke('appearance:setWindowEffect', effect)
}

contextBridge.exposeInMainWorld('dshStudio', bridge)
