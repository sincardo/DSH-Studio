import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { app } from 'electron'
import { buildSpawnEnv } from './spawn-env'
import { ensureRuntimeBridge } from './runtime-bridge'

const require = createRequire(import.meta.url)

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_READY_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 250
const FETCH_TIMEOUT_MS = 1_500

export interface DshServiceOptions {
  host?: string
  /** 0 = 由操作系统分配空闲端口（默认，规避端口冲突） */
  port?: number
  /** 透传 DSH_HOME；缺省时 dsh 使用默认 ~/.dsh */
  dshHome?: string
  readyTimeoutMs?: number
}

export interface DshStartResult {
  url: string
  port: number
}

function resolveDshBin(): string {
  // 打包版用解包目录：dsh 安装锚点必须落在真实目录（官方回退链接才能指向真实路径）
  const pkgDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@deepseek-ai', 'dsh')
    : path.dirname(require.resolve('@deepseek-ai/dsh/package.json'))
  return path.join(pkgDir, 'lib', 'bin.js')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 从 dsh 启动输出中解析它公布的 `http://host:port`（URL line）。 */
function extractPort(output: string, host: string): number | null {
  const re = new RegExp(`https?://${escapeRegExp(host)}:(\\d{1,5})`)
  const m = output.match(re)
  return m ? Number(m[1]) : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isHealthy(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 托管 `dsh web` 子进程：spawn → 端口解析/健康检查 → 就绪回调；
 * 提供崩溃监听与主动停止。以 `ELECTRON_RUN_AS_NODE` 复用 Electron 内置
 * Node，做到自包含（不依赖系统 node）。
 */
export class DshService extends EventEmitter {
  private child: ChildProcess | null = null
  private _url = ''
  private _port = 0

  constructor(private readonly options: DshServiceOptions = {}) {
    super()
  }

  get url(): string {
    return this._url
  }

  get port(): number {
    return this._port
  }

  get running(): boolean {
    return this.child !== null
  }

  async start(portOverride?: number): Promise<DshStartResult> {
    if (this.child) return { url: this._url, port: this._port }

    const host = this.options.host ?? DEFAULT_HOST
    const requestedPort = portOverride ?? this.options.port ?? 0
    const timeoutMs = this.options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS
    const bin = resolveDshBin()

    // 前置内置 .bin（pnpm/dsh shim）与系统 Node 目录：dsh 内运行的插件（如插件市场）需要 pnpm + node
    // 打包版改用内置运行时桥（node.cmd/pnpm.cmd → Electron 内置 Node，无需预装）
    const binDir = path.join(
      path.dirname(require.resolve('@deepseek-ai/dsh/package.json')),
      '..',
      '..',
      '.bin'
    )
    const env = buildSpawnEnv(app.isPackaged ? ensureRuntimeBridge() : binDir)
    if (this.options.dshHome) env.DSH_HOME = this.options.dshHome

    const child = spawn(
      process.execPath,
      // --expose-internals：dsh 的 HMR 服务（cordis-plugin-hmr）要求 Node 内部
      // 模块可见；在 Electron 内置 Node 下原生插件回退（node-addon-require-builtin）
      // 不可用，必须显式传入该标志。
      ['--expose-internals', bin, 'web', '--host', host, '--port', String(requestedPort)],
      { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    )
    this.child = child

    let stdoutBuf = ''
    let stderrBuf = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdoutBuf += text
      // 实时转发到主进程控制台，便于定位启动问题
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) console.log('[dsh-out]', line.trim())
      }
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderrBuf += text
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) console.log('[dsh-err]', line.trim())
      }
    })
    child.once('exit', (code, signal) => {
      this.child = null
      this.emit('exit', { code, signal })
    })

    const deadline = Date.now() + timeoutMs
    let port = requestedPort
    let url = ''

    for (;;) {
      if (port <= 0) {
        const discovered = extractPort(stdoutBuf, host)
        if (discovered !== null) port = discovered
      }
      if (port > 0) {
        url = `http://${host}:${port}`
        if (await isHealthy(url)) break
      }
      if (this.child === null) {
        throw new Error(`dsh web 进程启动后退出${stderrBuf ? `：\n${stderrBuf.slice(-2000)}` : ''}`)
      }
      if (Date.now() > deadline) {
        throw new Error(
          `dsh web 未在 ${timeoutMs}ms 内就绪（host=${host}, port=${port || 'auto'}）${stderrBuf ? `\n${stderrBuf.slice(-2000)}` : ''}`
        )
      }
      await sleep(POLL_INTERVAL_MS)
    }

    this._url = url
    this._port = port
    this.emit('ready', url)
    return { url, port }
  }

  async stop(): Promise<void> {
    const child = this.child
    if (!child) return
    this.child = null
    child.removeAllListeners('exit')
    child.kill()
    const deadline = Date.now() + 3_000
    while (child.exitCode === null && Date.now() < deadline) await sleep(100)
    if (child.exitCode === null) child.kill('SIGKILL')
    this._url = ''
    this._port = 0
    this.emit('stopped')
  }
}
