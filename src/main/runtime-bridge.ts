import { app } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { resolveDshHome } from './desktop-config'

/**
 * 打包版内置运行时桥：$DSH_HOME/desktop/bin/ 下的 node.cmd / pnpm.cmd 包装器。
 * asar 内的 .cmd shim 无法被 cmd 执行；这两个包装器把调用重定向到
 * Electron 内置 Node（ELECTRON_RUN_AS_NODE，由子进程环境继承），
 * 从而打包版无需用户预装 Node/pnpm —— 「内置 Node 运行时」的收尾。
 */
export function ensureRuntimeBridge(): string {
  const dir = path.join(resolveDshHome(), 'desktop', 'bin')
  mkdirSync(dir, { recursive: true })
  if (app.isPackaged) {
    const electronExe = process.execPath
    const pnpmCjs = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'pnpm',
      'bin',
      'pnpm.cjs'
    )
    const entries: Array<{ file: string; content: string }> = [
      { file: 'node.cmd', content: `@"${electronExe}" %*\r\n` },
      { file: 'pnpm.cmd', content: `@"${electronExe}" "${pnpmCjs}" %*\r\n` }
    ]
    for (const entry of entries) {
      const target = path.join(dir, entry.file)
      if (!existsSync(target)) writeFileSync(target, entry.content, 'utf8')
    }
  }
  return dir
}
