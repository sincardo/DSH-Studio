// DSH Studio 个性化外观 —— 客户端插件（v0.1.5）
// 换肤机制对齐社区成熟实现（dsh-dream-skin）：
// 壁纸 = body 内 z-index:-1 固定层；透明 = theme.overrideTokens 只洗主画布/侧栏令牌；
// 强调色/边框 = 同一覆盖层。主题切换后重放（带重入保护）。
import { useEffect, useState, type CSSProperties, type ChangeEvent } from 'react'
import { createElement as h } from 'react'

const zh = {
  'appearance.title': '个性化外观',
  'appearance.background': '背景',
  'appearance.background.theme': '跟随主题',
  'appearance.background.solid': '纯色',
  'appearance.background.gradient': '渐变',
  'appearance.background.wallpaper': '壁纸',
  'appearance.upload': '上传图片',
  'appearance.clearWallpaper': '清除壁纸',
  'appearance.wallpaperOpacity': '背景可见度',
  'appearance.wallpaperBlur': '壁纸模糊',
  'appearance.buttonRadius': '按键圆角',
  'appearance.radius.none': '直角',
  'appearance.radius.default': '默认',
  'appearance.radius.large': '大圆角',
  'appearance.radius.round': '全圆',
  'appearance.accent': '强调色',
  'appearance.accent.default': '默认',
  'appearance.border': '边框样式',
  'appearance.border.none': '无边框',
  'appearance.border.hairline': '细线',
  'appearance.border.accent': '强调描边',
  'appearance.windowEffect': '窗口边框样式',
  'appearance.windowEffect.none': '系统默认',
  'appearance.windowEffect.acrylic': '毛玻璃',
  'appearance.windowEffect.mica': '云母',
  'appearance.effectHint': '窗口效果需 Windows 11 或 macOS 支持，不支持时自动保持默认。',
  'appearance.loading': '加载中…'
}

const en = {
  'appearance.title': 'Appearance',
  'appearance.background': 'Background',
  'appearance.background.theme': 'Follow theme',
  'appearance.background.solid': 'Solid',
  'appearance.background.gradient': 'Gradient',
  'appearance.background.wallpaper': 'Wallpaper',
  'appearance.upload': 'Upload image',
  'appearance.clearWallpaper': 'Clear wallpaper',
  'appearance.wallpaperOpacity': 'Background visibility',
  'appearance.wallpaperBlur': 'Wallpaper blur',
  'appearance.buttonRadius': 'Button radius',
  'appearance.radius.none': 'Square',
  'appearance.radius.default': 'Default',
  'appearance.radius.large': 'Large',
  'appearance.radius.round': 'Pill',
  'appearance.accent': 'Accent color',
  'appearance.accent.default': 'Default',
  'appearance.border': 'Border style',
  'appearance.border.none': 'None',
  'appearance.border.hairline': 'Hairline',
  'appearance.border.accent': 'Accent',
  'appearance.windowEffect': 'Window style',
  'appearance.windowEffect.none': 'System default',
  'appearance.windowEffect.acrylic': 'Acrylic glass',
  'appearance.windowEffect.mica': 'Mica',
  'appearance.effectHint': 'Window effects need Windows 11 or macOS.',
  'appearance.loading': 'Loading…'
}

interface AppearanceConfig {
  background: 'theme' | 'solid' | 'gradient' | 'wallpaper'
  backgroundColor: string
  backgroundGradient: string
  wallpaperFile: string | null
  /** 运行时注入（主进程计算），不持久化 */
  wallpaperUrl?: string | null
  wallpaperOpacity: number
  wallpaperBlur: number
  buttonRadius: 'none' | 'default' | 'large' | 'round'
  accent: string | null
  borderStyle: 'none' | 'hairline' | 'accent'
  windowEffect: 'none' | 'acrylic' | 'mica'
}

const DEFAULTS: AppearanceConfig = {
  background: 'theme',
  backgroundColor: '#1a1e26',
  backgroundGradient: 'dusk',
  wallpaperFile: null,
  wallpaperUrl: null,
  wallpaperOpacity: 30,
  wallpaperBlur: 0,
  buttonRadius: 'default',
  accent: null,
  borderStyle: 'hairline',
  windowEffect: 'none'
}

const GRADIENTS: Record<string, string> = {
  dusk: 'linear-gradient(135deg, #2b2f5e 0%, #3a2f5e 45%, #1f2430 100%)',
  ocean: 'linear-gradient(135deg, #0f3d4c 0%, #14506b 50%, #0b1f2b 100%)',
  sunset: 'linear-gradient(135deg, #5e2f3d 0%, #7a4a2f 55%, #24202e 100%)',
  forest: 'linear-gradient(135deg, #1e3d2f 0%, #2c4a3a 50%, #141f1a 100%)'
}

const ACCENTS = ['#4d6bfe', '#7c5cff', '#18a058', '#f59e0b', '#e14b5a', '#0ea5e9']

// 官方鲸鱼 logo 路径（favicon.svg）
const WHALE_PATH =
  'M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z'

// dshmarket 原版 MarketLogo（3×3 网格）
const MARKET_GRID_PATH =
  'M2.35 1.75H4.95A0.6 0.6 0 0 1 5.55 2.35V4.95A0.6 0.6 0 0 1 4.95 5.55H2.35A0.6 0.6 0 0 1 1.75 4.95V2.35A0.6 0.6 0 0 1 2.35 1.75ZM6.7 1.75H9.3A0.6 0.6 0 0 1 9.9 2.35V4.95A0.6 0.6 0 0 1 9.3 5.55H6.7A0.6 0.6 0 0 1 6.1 4.95V2.35A0.6 0.6 0 0 1 6.7 1.75ZM2.35 6.1H4.95A0.6 0.6 0 0 1 5.55 6.7V9.3A0.6 0.6 0 0 1 4.95 9.9H2.35A0.6 0.6 0 0 1 1.75 9.3V6.7A0.6 0.6 0 0 1 2.35 6.1ZM6.7 6.1H9.3A0.6 0.6 0 0 1 9.9 6.7V9.3A0.6 0.6 0 0 1 9.3 9.9H6.7A0.6 0.6 0 0 1 6.1 9.3V6.7A0.6 0.6 0 0 1 6.7 6.1ZM11.05 6.1H13.65A0.6 0.6 0 0 1 14.25 6.7V9.3A0.6 0.6 0 0 1 13.65 9.9H11.05A0.6 0.6 0 0 1 10.45 9.3V6.7A0.6 0.6 0 0 1 11.05 6.1ZM2.35 10.45H4.95A0.6 0.6 0 0 1 5.55 11.05V13.65A0.6 0.6 0 0 1 4.95 14.25H2.35A0.6 0.6 0 0 1 1.75 13.65V11.05A0.6 0.6 0 0 1 2.35 10.45ZM6.7 10.45H9.3A0.6 0.6 0 0 1 9.9 11.05V13.65A0.6 0.6 0 0 1 9.3 14.25H6.7A0.6 0.6 0 0 1 6.1 13.65V11.05A0.6 0.6 0 0 1 6.7 10.45ZM11.05 10.45H13.65A0.6 0.6 0 0 1 14.25 11.05V13.65A0.6 0.6 0 0 1 13.65 14.25H11.05A0.6 0.6 0 0 1 10.45 13.65V11.05A0.6 0.6 0 0 1 11.05 10.45Z'
const MARKET_SQUARE_PATH =
  'M11.05 1.75H13.65A0.6 0.6 0 0 1 14.25 2.35V4.95A0.6 0.6 0 0 1 13.65 5.55H11.05A0.6 0.6 0 0 1 10.45 4.95V2.35A0.6 0.6 0 0 1 11.05 1.75Z'

declare global {
  interface Window {
    dshStudio?: {
      appearance: {
        get: () => Promise<AppearanceConfig>
        set: (partial: Partial<AppearanceConfig>) => Promise<void>
      }
      pickWallpaper: () => Promise<{ url: string; file: string } | null>
      setWindowEffect: (effect: string) => Promise<{ ok: boolean; message: string }>
    }
  }
}

type TokenOverrides = Record<string, { light: string; dark: string }>

interface ThemeServiceLike {
  overrideTokens: (source: string, tokens: TokenOverrides) => () => void
}

const STYLE_ID = 'dsh-studio-appearance-style'

function ensureStyleElement(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  return el
}

/** 读取当前令牌计算值（主题 presenter 把令牌写为 body 内联样式） */
function readToken(token: string): string {
  return getComputedStyle(document.body).getPropertyValue(token).trim()
}

/** 十六进制/rgb 色带透明度 */
function toRgba(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const n = parseInt(hex[1], 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i.exec(color.trim())
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`
  return color.trim()
}

function mixBlack(hex: string, ratio: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * (1 - ratio))
  const g = Math.round(((n >> 8) & 255) * (1 - ratio))
  const b = Math.round((n & 255) * (1 - ratio))
  return `rgb(${r}, ${g}, ${b})`
}

// 最近一次外观配置与主题服务，供主题切换后重放
let latestCfg: AppearanceConfig | null = null
let latestTheme: ThemeServiceLike | null = null
let disposeOverrideLayer: (() => void) | null = null
let wallpaperEl: HTMLDivElement | null = null
let applying = false

/** 背景层（z-index:-1 固定层，与 dsh-dream-skin 同机制） */
function updateBackdrop(cfg: AppearanceConfig): void {
  if (cfg.background === 'theme') {
    wallpaperEl?.remove()
    wallpaperEl = null
    return
  }
  if (wallpaperEl === null || !document.body.contains(wallpaperEl)) {
    wallpaperEl = document.createElement('div')
    wallpaperEl.style.cssText =
      'position:fixed;inset:0;z-index:-1;pointer-events:none;background-size:cover;background-position:center;background-repeat:no-repeat;'
    document.body.prepend(wallpaperEl)
  }
  if (cfg.background === 'solid') {
    wallpaperEl.style.backgroundImage = 'none'
    wallpaperEl.style.backgroundColor = cfg.backgroundColor
  } else if (cfg.background === 'gradient') {
    wallpaperEl.style.backgroundImage = GRADIENTS[cfg.backgroundGradient] ?? GRADIENTS.dusk
    wallpaperEl.style.backgroundColor = 'transparent'
  } else {
    wallpaperEl.style.backgroundImage = cfg.wallpaperUrl ? `url("${cfg.wallpaperUrl}")` : 'none'
    wallpaperEl.style.backgroundColor = 'transparent'
  }
  wallpaperEl.style.filter =
    cfg.background === 'wallpaper' && cfg.wallpaperBlur > 0 ? `blur(${cfg.wallpaperBlur}px)` : 'none'
}

/** 令牌层：透明化（主画布/侧栏）+ 强调色 + 边框（官方 overrideTokens） */
function updateTokens(theme: ThemeServiceLike, cfg: AppearanceConfig): void {
  if (applying) return
  applying = true
  try {
    disposeOverrideLayer?.()
    disposeOverrideLayer = null
    const tokens: TokenOverrides = {}
    const put = (name: string, light: string, dark: string) => {
      tokens[name] = { light, dark }
    }

    if (cfg.accent) {
      put('--dsw-alias-brand-primary', cfg.accent, cfg.accent)
      put('--dsw-alias-brand-text', '#ffffff', '#ffffff')
      put('--dsw-alias-brand-primary-invert', '#ffffff', '#ffffff')
      put('--dsw-alias-button-primary-fill', cfg.accent, cfg.accent)
      put('--dsw-alias-button-primary-hover', mixBlack(cfg.accent, 0.15), mixBlack(cfg.accent, 0.15))
    }

    if (cfg.borderStyle === 'none') {
      for (const t of ['--dsw-alias-border-l1', '--dsw-alias-border-l2', '--dsw-alias-border-l3', '--dsw-alias-border-l4']) {
        put(t, 'transparent', 'transparent')
      }
    } else if (cfg.borderStyle === 'accent') {
      const accent = cfg.accent ?? readToken('--dsw-alias-brand-primary')
      if (accent) {
        put('--dsw-alias-border-l1', accent, accent)
        put('--dsw-alias-border-l2', accent, accent)
      }
    }

    if (cfg.background !== 'theme') {
      const canvasAlpha = Math.max(0, Math.min(1, (100 - cfg.wallpaperOpacity) / 100))
      const sidebarAlpha = Math.max(0, Math.min(1, (100 - cfg.wallpaperOpacity * 0.6) / 100))
      const base = readToken('--dsw-alias-bg-base') || '#151517'
      const side = readToken('--dsw-specific-sidebar-fill') || base
      put('--dsw-alias-bg-base', toRgba(base, canvasAlpha), toRgba(base, canvasAlpha))
      put('--dsw-specific-sidebar-fill', toRgba(side, sidebarAlpha), toRgba(side, sidebarAlpha))
    }

    if (Object.keys(tokens).length > 0) {
      disposeOverrideLayer = theme.overrideTokens('dsh-studio-appearance', tokens)
    }
  } finally {
    applying = false
  }
}

function applyAppearance(theme: ThemeServiceLike, cfg: AppearanceConfig): void {
  latestCfg = cfg
  latestTheme = theme
  updateBackdrop(cfg)
  updateTokens(theme, cfg)
  // 圆角为全局 CSS 规则（非令牌）
  const rules: string[] = []
  if (cfg.buttonRadius !== 'default') {
    const radius = { none: '2px', large: '12px', round: '999px' }[cfg.buttonRadius]
    rules.push(`button, [role="button"] { border-radius: ${radius} !important; }`)
  }
  ensureStyleElement().textContent = rules.join('\n')
}

// ---------- 设置导航图标注入 ----------

function svgEl(size: number, viewBox: string): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', viewBox)
  svg.setAttribute('fill', 'none')
  svg.setAttribute('aria-hidden', 'true')
  return svg
}

function whaleSvg(): SVGElement {
  const svg = svgEl(16, '0 0 50 50')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('fill', 'currentColor')
  path.setAttribute('d', WHALE_PATH)
  svg.appendChild(path)
  return svg
}

function marketSvg(): SVGElement {
  const svg = svgEl(16, '0 0 16 16')
  const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p1.setAttribute('fill', 'currentColor')
  p1.setAttribute('d', MARKET_GRID_PATH)
  const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p2.setAttribute('fill', 'currentColor')
  p2.setAttribute('d', MARKET_SQUARE_PATH)
  p2.setAttribute('transform', 'rotate(9 12.35 3.65)')
  svg.appendChild(p1)
  svg.appendChild(p2)
  return svg
}

let patchTimer: ReturnType<typeof setTimeout> | null = null

function patchNavIcons(): void {
  for (const btn of Array.from(document.querySelectorAll('button'))) {
    const span = btn.querySelector(':scope > span')
    if (!span) continue
    const text = (span.textContent ?? '').trim()
    if (!text) continue
    const old = btn.querySelector(':scope > svg')
    if (!old) continue
    let replacement: SVGElement | null = null
    if (text === '个性化外观' || text === 'Appearance') replacement = whaleSvg()
    else if (text === '插件市场' || text === 'Plugin market' || text === 'Market') replacement = marketSvg()
    if (replacement && old.getAttribute('data-dsh-patched') !== '1') {
      replacement.setAttribute('data-dsh-patched', '1')
      old.replaceWith(replacement)
    }
  }
}

function startNavIconPatcher(): void {
  const schedule = () => {
    if (patchTimer) clearTimeout(patchTimer)
    patchTimer = setTimeout(patchNavIcons, 150)
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
  schedule()
}

// ---------- UI ----------

const seg = (active: boolean): CSSProperties => ({
  padding: '5px 12px',
  borderRadius: 999,
  border: '1px solid var(--dsw-alias-border-l2)',
  background: active ? 'var(--dsw-alias-brand-primary)' : 'transparent',
  color: active ? 'var(--dsw-alias-brand-primary-invert)' : 'var(--dsw-alias-label-secondary)',
  cursor: 'pointer',
  fontSize: 12
})

const labelStyle: CSSProperties = { fontSize: 13, color: 'var(--dsw-alias-label-primary)' }
const hintStyle: CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-dimmed)', marginTop: 2 }

function AppearanceSection({ t, theme }: { t: (key: string) => string; theme: ThemeServiceLike }) {
  const [cfg, setCfg] = useState<AppearanceConfig | null>(null)
  const [effectMsg, setEffectMsg] = useState('')

  useEffect(() => {
    window.dshStudio?.appearance.get().then((saved) => {
      const merged = { ...DEFAULTS, ...saved }
      setCfg(merged)
      applyAppearance(theme, merged)
    })
  }, [theme])

  if (!cfg) return h('div', { style: labelStyle }, t('appearance.loading'))

  const update = (partial: Partial<AppearanceConfig>) => {
    const next = { ...cfg, ...partial }
    setCfg(next)
    applyAppearance(theme, next)
    void window.dshStudio?.appearance.set(next)
  }

  const uploadWallpaper = async () => {
    const picked = await window.dshStudio?.pickWallpaper()
    if (picked) {
      update({ background: 'wallpaper', wallpaperFile: picked.file, wallpaperUrl: picked.url })
    }
  }

  const changeEffect = async (effect: AppearanceConfig['windowEffect']) => {
    update({ windowEffect: effect })
    const res = await window.dshStudio?.setWindowEffect(effect)
    setEffectMsg(res ? (res.ok ? '' : res.message) : '')
  }

  const segGroup = (
    options: Array<{ id: string; label: string }>,
    value: string,
    onPick: (id: string) => void
  ) =>
    h(
      'div',
      { style: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' } },
      options.map((o) =>
        h(
          'button',
          { key: o.id, type: 'button', style: seg(o.id === value), onClick: () => onPick(o.id) },
          o.label
        )
      )
    )

  const slider = (label: string, value: number, min: number, max: number, onChange: (v: number) => void) =>
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 10 } },
      h('span', { style: labelStyle }, label),
      h('input', {
        type: 'range',
        min,
        max,
        step: 1,
        value,
        style: { flex: 1, maxWidth: 260 },
        onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))
      }),
      h('span', { style: hintStyle }, `${value}`)
    )

  const group = (title: string, children: unknown) =>
    h(
      'div',
      null,
      h('div', { style: { ...labelStyle, marginBottom: 6 } }, title),
      children
    )

  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0 24px' } },
    group(
      t('appearance.background'),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        segGroup(
          [
            { id: 'theme', label: t('appearance.background.theme') },
            { id: 'solid', label: t('appearance.background.solid') },
            { id: 'gradient', label: t('appearance.background.gradient') },
            { id: 'wallpaper', label: t('appearance.background.wallpaper') }
          ],
          cfg.background,
          (id) => update({ background: id as AppearanceConfig['background'] })
        ),
        cfg.background === 'solid' &&
          h('input', {
            type: 'color',
            value: cfg.backgroundColor,
            style: { width: 44, height: 28, border: 'none', background: 'transparent', padding: 0 },
            onChange: (e: ChangeEvent<HTMLInputElement>) => update({ backgroundColor: e.target.value })
          }),
        cfg.background === 'gradient' &&
          h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
            Object.entries(GRADIENTS).map(([id, g]) =>
              h('button', {
                key: id,
                type: 'button',
                style: {
                  width: 48,
                  height: 30,
                  borderRadius: 8,
                  border:
                    cfg.backgroundGradient === id
                      ? '2px solid var(--dsw-alias-brand-primary)'
                      : '1px solid var(--dsw-alias-border-l2)',
                  background: g,
                  cursor: 'pointer'
                },
                onClick: () => update({ backgroundGradient: id })
              })
            )
          ),
        cfg.background === 'wallpaper' &&
          h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
            h(
              'button',
              { type: 'button', style: seg(false), onClick: () => void uploadWallpaper() },
              t('appearance.upload')
            ),
            cfg.wallpaperFile &&
              h(
                'button',
                {
                  type: 'button',
                  style: seg(false),
                  onClick: () => update({ background: 'theme', wallpaperFile: null, wallpaperUrl: null })
                },
                t('appearance.clearWallpaper')
              ),
            cfg.background === 'wallpaper' &&
              slider(t('appearance.wallpaperBlur'), cfg.wallpaperBlur, 0, 24, (v) =>
                update({ wallpaperBlur: v })
              )
          ),
        cfg.background !== 'theme' &&
          slider(t('appearance.wallpaperOpacity'), cfg.wallpaperOpacity, 0, 80, (v) =>
            update({ wallpaperOpacity: v })
          )
      )
    ),
    group(
      t('appearance.buttonRadius'),
      segGroup(
        [
          { id: 'none', label: t('appearance.radius.none') },
          { id: 'default', label: t('appearance.radius.default') },
          { id: 'large', label: t('appearance.radius.large') },
          { id: 'round', label: t('appearance.radius.round') }
        ],
        cfg.buttonRadius,
        (id) => update({ buttonRadius: id as AppearanceConfig['buttonRadius'] })
      )
    ),
    group(
      t('appearance.accent'),
      h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' } },
        h(
          'button',
          { type: 'button', style: seg(cfg.accent === null), onClick: () => update({ accent: null }) },
          t('appearance.accent.default')
        ),
        ACCENTS.map((c) =>
          h('button', {
            key: c,
            type: 'button',
            style: {
              width: 24,
              height: 24,
              borderRadius: 999,
              background: c,
              border:
                cfg.accent === c ? '2px solid var(--dsw-alias-label-primary)' : '1px solid var(--dsw-alias-border-l2)',
              cursor: 'pointer'
            },
            onClick: () => update({ accent: c })
          })
        )
      )
    ),
    group(
      t('appearance.border'),
      segGroup(
        [
          { id: 'none', label: t('appearance.border.none') },
          { id: 'hairline', label: t('appearance.border.hairline') },
          { id: 'accent', label: t('appearance.border.accent') }
        ],
        cfg.borderStyle,
        (id) => update({ borderStyle: id as AppearanceConfig['borderStyle'] })
      )
    ),
    group(
      t('appearance.windowEffect'),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        segGroup(
          [
            { id: 'none', label: t('appearance.windowEffect.none') },
            { id: 'acrylic', label: t('appearance.windowEffect.acrylic') },
            { id: 'mica', label: t('appearance.windowEffect.mica') }
          ],
          cfg.windowEffect,
          (id) => void changeEffect(id as AppearanceConfig['windowEffect'])
        ),
        h('div', { style: hintStyle }, effectMsg || t('appearance.effectHint'))
      )
    )
  )
}

// ---------- 客户端插件入口 ----------

export const inject = ['slots', 'locale', 'theme']

export async function apply(ctx: {
  locale: { register: (ns: string, dict: { zh: Record<string, string>; en: Record<string, string> }) => () => void }
  inject: (deps: string[], fn: (scope: any) => any) => { dispose: () => void }
  on: (event: string, fn: () => void) => () => void
}): Promise<() => void> {
  const disposeLocale = ctx.locale.register('settings.studioAppearance', { zh, en })
  let disposeThemeListener: (() => void) | null = null
  const feature = ctx.inject(['slots', 'locale', 'theme'], (scope: any) => {
    const t = scope.locale.bind('settings.studioAppearance')
    const theme = scope.theme as ThemeServiceLike
    startNavIconPatcher()
    // 主题（浅/深/系统）切换后：等新调色板落盘，再重放（透明度需重取当前计算值）
    disposeThemeListener = ctx.on('theme/change', () => {
      setTimeout(() => {
        if (latestCfg && latestTheme) applyAppearance(latestTheme, latestCfg)
      }, 0)
    })
    scope.slots.inject('settings.section', () =>
      scope.slots.register(
        {
          name: 'settings.section',
          id: 'studio-appearance',
          order: 40,
          label: () => t('appearance.title'),
          inject: () => ({ t, theme })
        },
        (props: { t: (key: string) => string }) => AppearanceSection({ t: props.t, theme })
      )
    )
  })
  return () => {
    feature.dispose()
    disposeLocale()
    disposeThemeListener?.()
  }
}
