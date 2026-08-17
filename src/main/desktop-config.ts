import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

/** 与官方一致的 DSH_HOME 解析：$DSH_HOME 环境变量 → 默认 ~/.dsh */
export function resolveDshHome(): string {
  const env = process.env.DSH_HOME?.trim()
  return env ? path.resolve(env) : path.join(homedir(), '.dsh')
}

export interface DesktopWindowState {
  x?: number
  y?: number
  width?: number
  height?: number
  maximized?: boolean
}

export interface DesktopConfigData {
  /** 用户明确拒绝「推荐插件」自动提示（只有拒绝才置位；安装失败下次仍会提示） */
  recommendedPluginsDeclined?: boolean
  /** 推荐插件是否已成功安装 */
  recommendedPluginsInstalled?: boolean
  /** 窗口状态（Block 3.2 使用） */
  window?: DesktopWindowState
  [key: string]: unknown
}

/**
 * 桌面壳配置，持久化到 $DSH_HOME/config.json（与官方文件共存、互不冲突）。
 */
export class DesktopConfig {
  private readonly file: string
  private data: DesktopConfigData

  constructor(file?: string) {
    this.file = file ?? path.join(resolveDshHome(), 'config.json')
    this.data = this.load()
  }

  load(): DesktopConfigData {
    try {
      const raw = readFileSync(this.file, 'utf8')
      const parsed = JSON.parse(raw) as DesktopConfigData
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  }

  get<T>(key: string): T | undefined {
    return this.data[key] as T | undefined
  }

  set(key: string, value: unknown): void {
    this.data[key] = value
    this.save()
  }

  save(): void {
    mkdirSync(path.dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8')
  }

  exists(): boolean {
    return existsSync(this.file)
  }

  get filePath(): string {
    return this.file
  }
}
