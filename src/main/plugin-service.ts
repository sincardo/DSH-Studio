import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import { buildSpawnEnv } from './spawn-env'
import { resolveDshHome } from './desktop-config'
import { ensureRuntimeBridge } from './runtime-bridge'

const require = createRequire(import.meta.url)

const here = path.dirname(fileURLToPath(import.meta.url))
/** 应用根目录（构建产物 out/main → 项目根） */
const appRoot = path.join(here, '..', '..')
const appNodeModules = path.join(appRoot, 'node_modules')

export interface RecommendedPlugin {
  name: string
  version: string
}

/** 推荐插件（已经过源码审查 + 锁精确版本）：经插件市场机制（dsh plugin → pnpm）安装 */
export const RECOMMENDED_PLUGINS: readonly RecommendedPlugin[] = [
  { name: 'dshmarket', version: '1.11.3' },
  { name: 'dsh-plugin-manager', version: '0.1.0' }
]

export interface BundledPlugin {
  name: string
  /** 自带 bundle patch：需确保在 profile bundles 中，且 profile patch 不得有该行 */
  ownPatchRowId?: string
  /** 不携带 bundle patch：需在 profile patch 中写入 insert 行 */
  patchRow?: { id: string; name: string }
}

/**
 * 内置插件：随应用发布（应用自身 npm 依赖，位于应用 node_modules）。
 * 官方加载器按「安装目录优先」解析 bundle/行，因此无需 pnpm 安装——
 * 引导时只需把包名写入 profile 的 bundles / patch 行。
 */
export const BUNDLED_PLUGINS: readonly BundledPlugin[] = [
  {
    name: 'dsh-studio-appearance',
    ownPatchRowId: 'studio-appearance'
  },
  {
    name: 'dsh-file-explorer',
    patchRow: { id: 'file-explorer', name: 'dsh-file-explorer' }
  }
]

/**
 * 幂等地把包名加入 profile 的 dsh.profile.bundles（自带 bundle patch 的内置插件用）。
 */
export function ensureProfileBundle(profile: string, name: string): boolean {
  const manifestPath = path.join(resolveDshHome(), 'profiles', profile, 'package.json')
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      dsh?: { profile?: { bundles?: string[] } }
    }
    const bundles = (manifest.dsh ??= {}).profile ??= { bundles: [] }
    bundles.bundles ??= []
    if (bundles.bundles.includes(name)) return false
    bundles.bundles.push(name)
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * 清理 profile 依赖中已内置插件的旧条目（历史 file:/registry 安装残留）。
 * 内置插件由应用 node_modules 解析，profile 依赖条目只会干扰 pnpm 操作。
 */
export function removeStaleProfileDep(profile: string, name: string): boolean {
  const manifestPath = path.join(resolveDshHome(), 'profiles', profile, 'package.json')
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>
    }
    if (!manifest.dependencies?.[name]) return false
    delete manifest.dependencies[name]
    if (Object.keys(manifest.dependencies).length === 0) delete manifest.dependencies
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
    return true
  } catch {
    return false
  }
}

/** 内置插件在应用中的真实目录（打包版 = asar.unpacked 目录，junction 无法指向 asar 内路径） */
function bundledPluginDir(name: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', name)
  }
  return path.join(appNodeModules, name)
}

/**
 * 确保 $DSH_HOME/profiles/node_modules/<name> 是指向应用内置副本的链接。
 * 官方扁平模块回退目录（dsh 每轮启动自行维护）；客户端 bundle 与 loader 行
 * 都经 profile 目录 require.resolve，链接在此即可让内置插件被解析到应用副本。
 */
export function ensureProfileModuleLink(name: string): boolean {
  const linkDir = path.join(resolveDshHome(), 'profiles', 'node_modules')
  const linkPath = path.join(linkDir, name)
  let target: string
  try {
    target = realpathSync(bundledPluginDir(name))
  } catch {
    return false
  }
  try {
    if (lstatSync(linkPath).isSymbolicLink() && readlinkSync(linkPath) === target) return false
    rmSync(linkPath, { recursive: true, force: true })
  } catch {
    /* 不存在或损坏 */
  }
  mkdirSync(linkDir, { recursive: true })
  symlinkSync(target, linkPath, 'junction')
  return true
}

/** 移除 profile 自身 node_modules 中的内置插件残留副本（解析改走官方回退目录） */
export function removeProfileModuleCopy(profile: string, name: string): boolean {
  const dir = path.join(resolveDshHome(), 'profiles', profile, 'node_modules', name)
  if (!existsSync(dir)) return false
  rmSync(dir, { recursive: true, force: true })
  return true
}

/**
 * 幂等地把插件 insert 行写入 profile 的 cordis.patch.yml。
 * 该文件被 dsh 实时监听，写入后热生效；host 侧改动仍需重启 dsh web（本应用安装后会自动重启）。
 * 兼容官方模板「空列表（[]）+ 注释」形态，并修复此前版本可能写出的非法 YAML。
 */
export function ensureProfilePatchRow(profile: string, row: { id: string; name: string }): boolean {
  const patchFile = path.join(resolveDshHome(), 'profiles', profile, 'cordis.patch.yml')
  const marker = `id: ${row.id}`
  const block = `- insert:\n    - id: ${row.id}\n      name: '${row.name}'\n`

  if (existsSync(patchFile)) {
    const content = readFileSync(patchFile, 'utf8')
    const emptyIdx = content.indexOf('[]')

    // 1) 结构损坏：空列表 [] 之后仍有内容（非法 YAML，会导致 dsh 启动失败）→ 截断重建
    if (emptyIdx !== -1 && content.slice(emptyIdx + 2).trim() !== '') {
      writeFileSync(patchFile, content.slice(0, emptyIdx) + block, 'utf8')
      return true
    }
    // 2) 纯空列表模板（带注释）→ 原位替换为块
    if (emptyIdx !== -1) {
      writeFileSync(patchFile, content.slice(0, emptyIdx) + block, 'utf8')
      return true
    }
    // 3) 已含该行且结构正常 → 无需处理
    if (content.includes(marker)) return false
    // 4) 正常非空列表 → 追加
    const separator = content.trim() === '' ? '' : content.endsWith('\n') ? '' : '\n'
    writeFileSync(patchFile, content + separator + block, 'utf8')
    return true
  }

  mkdirSync(path.dirname(patchFile), { recursive: true })
  writeFileSync(patchFile, block, 'utf8')
  return true
}

/** 读取 web profile 已安装的依赖名 */
export function readProfileDeps(profile: string): string[] {
  try {
    const pj = JSON.parse(
      readFileSync(path.join(resolveDshHome(), 'profiles', profile, 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> }
    return Object.keys(pj.dependencies ?? {})
  } catch {
    return []
  }
}

/**
 * 从 profile cordis.patch.yml 中移除我们写入的标准 insert 块（精确匹配）。
 * 用于自带 bundle patch 的插件：其行由 bundle 层插入，profile 层重复会导致
 * "duplicate loader entry id" 启动失败。
 */
export function removeProfilePatchRow(profile: string, id: string, name: string): boolean {
  const patchFile = path.join(resolveDshHome(), 'profiles', profile, 'cordis.patch.yml')
  if (!existsSync(patchFile)) return false
  const content = readFileSync(patchFile, 'utf8')
  const block = `- insert:\n    - id: ${id}\n      name: '${name}'\n`
  const idx = content.indexOf(block)
  if (idx === -1) return false
  writeFileSync(patchFile, content.slice(0, idx) + content.slice(idx + block.length), 'utf8')
  return true
}

export interface PluginRunResult {
  code: number
  stdout: string
  stderr: string
}

export interface PluginRunOptions {
  /** 超时（毫秒），到期强杀子进程；默认 10 分钟（慢网络下 pnpm 安装较大依赖可能需数分钟） */
  timeoutMs?: number
  /** 把子进程输出实时转发到主进程控制台（npm run dev 可见），便于诊断 */
  echo?: boolean
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1_000

/** dsh 包目录：打包版用解包目录（安装锚点必须是真实路径，官方回退链接才能指向真实目录） */
export function dshPackageDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@deepseek-ai', 'dsh')
  }
  return path.dirname(require.resolve('@deepseek-ai/dsh/package.json'))
}

function resolveDshPaths(): { bin: string; binDir: string } {
  const pkgDir = dshPackageDir()
  return {
    bin: path.join(pkgDir, 'lib', 'bin.js'),
    // 项目级 node_modules/.bin：内含 dsh shim 与 pnpm（dsh plugin 底层依赖 pnpm）
    binDir: path.join(pkgDir, '..', '..', '.bin')
  }
}

/**
 * 插件管理服务：封装 `dsh plugin --profile <name> <pnpm args>`。
 * 以 ELECTRON_RUN_AS_NODE 运行内置 Node，并把内置 .bin（pnpm）前置到 PATH。
 */
export class PluginService {
  async run(profile: string, args: string[], options: PluginRunOptions = {}): Promise<PluginRunResult> {
    const { bin, binDir } = resolveDshPaths()
    // 打包版：运行时桥目录（node.cmd/pnpm.cmd → Electron 内置 Node）优先于 asar .bin
    const env = buildSpawnEnv(app.isPackaged ? ensureRuntimeBridge() : binDir)
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [bin, 'plugin', '--profile', profile, ...args], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
      let stdout = ''
      let stderr = ''
      let settled = false

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill('SIGKILL')
        reject(new Error(`插件操作超时（${Math.round(timeoutMs / 60_000)} 分钟）：${args.join(' ')}`))
      }, timeoutMs)

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stdout += text
        if (options.echo && text.trim()) process.stdout.write(`[plugin] ${text}`)
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stderr += text
        if (options.echo && text.trim()) process.stderr.write(`[plugin] ${text}`)
      })
      child.on('error', (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
      })
      child.on('exit', (code) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({ code: code ?? 1, stdout, stderr })
      })
    })
  }

  /** 一键安装（pnpm add + 官方 bundles reconcile） */
  install(profile: string, pkg: string, options?: PluginRunOptions): Promise<PluginRunResult> {
    return this.run(profile, ['add', pkg], options)
  }

  /** 一键卸载 */
  remove(profile: string, pkg: string, options?: PluginRunOptions): Promise<PluginRunResult> {
    return this.run(profile, ['remove', pkg], options)
  }
}
