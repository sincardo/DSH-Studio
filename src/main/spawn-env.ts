import { existsSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { ensureRuntimeBridge } from './runtime-bridge'

/**
 * 在 PATH 与常见安装位置中定位系统 Node.js 目录（仅开发模式需要；
 * 打包版经内置运行时桥使用 Electron 内置 Node）。
 * pnpm 的 .cmd shim 内部需要调用 `node`，而子进程 PATH 可能不含 Node 目录，
 * 因此显式定位并前置，保证 `dsh plugin`（底层 pnpm）可用。
 */
export function findSystemNodeDir(): string | null {
  const candidates = new Set<string>()
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const trimmed = dir.trim()
    if (trimmed) candidates.add(trimmed)
  }
  const programFiles = process.env.ProgramFiles
  const programFilesX86 = process.env['ProgramFiles(x86)']
  const localAppData = process.env.LOCALAPPDATA
  if (programFiles) candidates.add(path.join(programFiles, 'nodejs'))
  if (programFilesX86) candidates.add(path.join(programFilesX86, 'nodejs'))
  if (localAppData) candidates.add(path.join(localAppData, 'Programs', 'nodejs'))
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'node.exe'))) return dir
  }
  return null
}

/**
 * 构造 dsh/插件子进程环境：
 * - 开发：前置内置 .bin（pnpm/dsh shim）与系统 Node 目录；
 * - 打包：前置内置运行时桥（node.cmd/pnpm.cmd → Electron 内置 Node，无需预装）。
 */
export function buildSpawnEnv(extraBinDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  const parts: string[] = [extraBinDir]
  if (app.isPackaged) {
    parts.push(ensureRuntimeBridge())
  } else {
    const nodeDir = findSystemNodeDir()
    if (nodeDir) parts.push(nodeDir)
  }
  if (env.PATH) parts.push(env.PATH)
  env.PATH = parts.join(path.delimiter)
  return env
}
