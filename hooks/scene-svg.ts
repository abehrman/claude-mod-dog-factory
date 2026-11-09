import { VISUAL_CAP } from './board'

export type SceneView = {
  asks: number
  steps: number
  shipped: number
  workers: { dog: string; description?: string }[]
  isForemanBusy: boolean
  /** Context window fill, 0 to 100; absent before the first measurement. */
  contextPercent?: number
  /** Positions (0-based, among the open steps) of steps in progress. */
  activeSteps?: number[]
}

const COATS = ['#c98a5a', '#8d6748', '#e3c08d', '#f2e9dc', '#6b4f3a', '#b9b9b9', '#d9a066'] as const

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

export function dogColor(name: string): string {
  return COATS[hash(name) % COATS.length]!
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// A dog facing right, feet at y=21, drawn in `currentColor`.
const DEFS = `
<defs>
  <g id="dog">
    <path d="M-12 4 q-7 -5 -5 -13" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" values="-14 -12 4;14 -12 4;-14 -12 4" dur="0.7s" repeatCount="indefinite"/>
    </path>
    <ellipse cx="0" cy="8" rx="13" ry="9" fill="currentColor"/>
    <rect x="-10" y="12" width="5" height="9" rx="2" fill="currentColor"/>
    <rect x="4" y="12" width="5" height="9" rx="2" fill="currentColor"/>
    <ellipse cx="4" cy="-5" rx="3.5" ry="6.5" fill="currentColor" transform="rotate(-25 4 -5)"/>
    <circle cx="12" cy="-2" r="9" fill="currentColor"/>
    <ellipse cx="18" cy="-7" rx="3.2" ry="6" fill="currentColor" transform="rotate(25 18 -7)"/>
    <circle cx="15" cy="-3" r="1.7" fill="#2b2b2b"/>
    <circle cx="20.5" cy="0.5" r="2.1" fill="#2b2b2b"/>
    <path d="M16 3.5 q3 2.5 5.5 0" stroke="#2b2b2b" stroke-width="1" fill="none" stroke-linecap="round"/>
  </g>
  <g id="sleepy">
    <path d="M13.3 -3 h3.6" stroke="#2b2b2b" stroke-width="1.4" stroke-linecap="round"/>
  </g>
  <g id="crate">
    <rect width="16" height="16" rx="2" fill="#d9a066" stroke="#8c5a2b"/>
    <path d="M0 8 h16 M8 0 v16" stroke="#8c5a2b" stroke-width="0.8"/>
  </g>
  <g id="shipped">
    <rect width="16" height="16" rx="2" fill="#efe1c9" stroke="#8c5a2b"/>
    <circle cx="8" cy="10" r="2.3" fill="#c94f3d"/>
    <circle cx="4.8" cy="6.3" r="1.1" fill="#c94f3d"/>
    <circle cx="8" cy="5" r="1.1" fill="#c94f3d"/>
    <circle cx="11.2" cy="6.3" r="1.1" fill="#c94f3d"/>
  </g>
  <g id="spark">
    <circle r="1.3" fill="#ffb347"/>
  </g>
  <clipPath id="belt-clip"><rect x="105" y="130" width="190" height="10" rx="5"/></clipPath>
</defs>`

const WALL = `
<rect width="400" height="180" fill="#f6efe6"/>
<rect y="140" width="400" height="40" fill="#d9cdbf"/>
<rect y="138" width="400" height="3" fill="#b9a995"/>
<g fill="#cfe6f5" stroke="#9db7c7">
  <rect x="150" y="30" width="46" height="26" rx="3"/>
  <rect x="210" y="30" width="46" height="26" rx="3"/>
</g>
<g stroke="#9db7c7" stroke-width="1">
  <path d="M173 30 v26 M150 43 h46 M233 30 v26 M210 43 h46"/>
</g>
<rect x="148" y="6" width="104" height="17" rx="4" fill="#c94f3d"/>
<text x="200" y="18.5" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#fff" letter-spacing="1">DOG FACTORY</text>`

function foreman(isBusy: boolean): string {
  const coat = '#8d6748'
  const desk = `
<rect x="14" y="118" width="82" height="7" rx="2" fill="#a0703f"/>
<rect x="20" y="125" width="6" height="15" fill="#8c5a2b"/>
<rect x="84" y="125" width="6" height="15" fill="#8c5a2b"/>
<text x="55" y="152" text-anchor="middle" font-family="system-ui, sans-serif" font-size="7" fill="#6b5c4d" letter-spacing="1">FOREMAN</text>`
  if (isBusy) {
    return `
<g color="${coat}" transform="translate(42 96)">
  <use href="#dog"/>
  <circle cx="26" cy="20" r="3" fill="currentColor">
    <animate attributeName="cy" values="20;16;20" dur="0.28s" repeatCount="indefinite"/>
  </circle>
  <circle cx="33" cy="20" r="3" fill="currentColor">
    <animate attributeName="cy" values="16;20;16" dur="0.28s" repeatCount="indefinite"/>
  </circle>
</g>
<g transform="translate(70 104)">
  <rect width="22" height="14" rx="1.5" fill="#444"/>
  <rect x="2" y="2" width="18" height="9" fill="#9fd3ff">
    <animate attributeName="fill" values="#9fd3ff;#c8e8ff;#9fd3ff" dur="0.9s" repeatCount="indefinite"/>
  </rect>
</g>
<g transform="translate(20 110)">
  <rect width="10" height="8" fill="#fff" stroke="#bbb" stroke-width="0.6">
    <animateTransform attributeName="transform" type="rotate" values="-6 5 8;6 5 8;-6 5 8" dur="0.6s" repeatCount="indefinite"/>
  </rect>
</g>${desk}`
  }
  return `
<g color="${coat}" transform="translate(44 100)">
  <use href="#dog"/>
  <use href="#sleepy"/>
</g>
<g font-family="system-ui, sans-serif" font-weight="700" fill="#6b5c4d">
  <text x="72" y="92" font-size="7">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -10" dur="2.4s" repeatCount="indefinite"/></text>
  <text x="78" y="86" font-size="9">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="0.8s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -10" dur="2.4s" begin="0.8s" repeatCount="indefinite"/></text>
  <text x="85" y="80" font-size="11">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.6s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -10" dur="2.4s" begin="1.6s" repeatCount="indefinite"/></text>
</g>${desk}`
}

function belt(): string {
  let stripes = ''
  for (let x = 89; x < 310; x += 16) stripes += `<rect x="${x}" y="130" width="6" height="10" fill="#8a8a8a"/>`
  return `
<rect x="105" y="130" width="190" height="10" rx="5" fill="#555"/>
<g clip-path="url(#belt-clip)">
  <g>${stripes}<animateTransform attributeName="transform" type="translate" values="0 0;16 0" dur="0.8s" repeatCount="indefinite"/></g>
</g>
<rect x="112" y="140" width="4" height="8" fill="#777"/>
<rect x="284" y="140" width="4" height="8" fill="#777"/>`
}

function crates(count: number, active: number[] = []): string {
  if (count <= 0) return ''
  const shown = Math.min(count, VISUAL_CAP)
  let out = ''
  for (let i = 0; i < shown; i++) {
    const x = 118 + i * 34
    const isActive = active.includes(i)
    const glow = isActive
      ? `<rect x="-2" y="-2" width="20" height="20" rx="3" fill="none" stroke="#e0b84a" stroke-width="2"><animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/></rect>
    <circle cx="14" cy="2" r="3.2" fill="#e0b84a"><animate attributeName="r" values="3.2;4;3.2" dur="1s" repeatCount="indefinite"/></circle>`
      : ''
    out += `
<g transform="translate(${x} 114)" class="${isActive ? 'crate-active' : 'crate'}">
  <g>
    ${glow}
    <use href="#crate"/>
    <text x="8" y="12" text-anchor="middle" font-family="system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#5a3a1a">${i + 1}</text>
    <animateTransform attributeName="transform" type="translate" values="0 0;0 -1.5;0 0" dur="${isActive ? '0.5s' : '1.1s'}" begin="${(i * 0.17).toFixed(2)}s" repeatCount="indefinite"/>
  </g>
</g>`
  }
  if (count > VISUAL_CAP) {
    out += `<text x="294" y="126" text-anchor="end" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#5a3a1a">+${count - VISUAL_CAP}</text>`
  }
  return out
}

function workers(list: SceneView['workers']): string {
  if (list.length === 0) return ''
  const shown = list.slice(0, VISUAL_CAP)
  let out = ''
  shown.forEach((w, i) => {
    const x = 124 + i * 38
    const title = w.description ? `<title>${esc(w.dog)}: ${esc(w.description)}</title>` : `<title>${esc(w.dog)}</title>`
    out += `
<g color="${dogColor(w.dog)}" transform="translate(${x} 108)">
  ${title}
  <use href="#dog"/>
  <g transform="translate(22 6)">
    <g>
      <rect x="-1" y="-13" width="2" height="13" fill="#7a5230"/>
      <rect x="-5" y="-17" width="10" height="5" rx="1" fill="#8e8e8e"/>
      <animateTransform attributeName="transform" type="rotate" values="-40;30;-40" dur="0.5s" begin="${(i * 0.11).toFixed(2)}s" repeatCount="indefinite"/>
    </g>
  </g>
  <g transform="translate(30 4)">
    <use href="#spark" x="0" y="0"><animate attributeName="opacity" values="0;1;0" dur="0.5s" begin="${(i * 0.11 + 0.1).toFixed(2)}s" repeatCount="indefinite"/></use>
    <use href="#spark" x="4" y="-4"><animate attributeName="opacity" values="0;1;0" dur="0.5s" begin="${(i * 0.11 + 0.22).toFixed(2)}s" repeatCount="indefinite"/></use>
    <use href="#spark" x="-3" y="-5"><animate attributeName="opacity" values="0;1;0" dur="0.5s" begin="${(i * 0.11 + 0.34).toFixed(2)}s" repeatCount="indefinite"/></use>
  </g>
  <rect x="-10" y="-30" width="${Math.max(26, w.dog.length * 4.6 + 6)}" height="10" rx="5" fill="#fff" stroke="#c9b9a6" stroke-width="0.6"/>
  <text x="${-10 + Math.max(26, w.dog.length * 4.6 + 6) / 2}" y="-22.5" text-anchor="middle" font-family="system-ui, sans-serif" font-size="6.5" font-weight="600" fill="#4a3b2d">${esc(w.dog)}</text>
</g>`
  })
  if (list.length > VISUAL_CAP) {
    out += `<text x="300" y="100" text-anchor="start" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#4a3b2d">+${list.length - VISUAL_CAP}</text>`
  }
  return out
}

function door(asks: number): string {
  let out = `
<rect x="337" y="72" width="48" height="68" rx="3" fill="#7b5236"/>
<rect x="342" y="78" width="38" height="20" rx="1" fill="#cfe6f5"/>
<circle cx="377" cy="112" r="2.2" fill="#e0b84a"/>
<text x="361" y="68" text-anchor="middle" font-family="system-ui, sans-serif" font-size="7" fill="#6b5c4d" letter-spacing="1">BOSS</text>`
  if (asks <= 0) return out
  const shown = Math.min(asks, VISUAL_CAP)
  for (let i = shown - 1; i >= 0; i--) {
    const x = 318 + i * 15
    out += `
<g color="${COATS[(i + 2) % COATS.length]}" transform="translate(${x} 128) scale(0.6)">
  <use href="#dog"/>
  <g>
    <rect x="21" y="-12" width="1.5" height="12" fill="#7a5230"/>
    <rect x="15" y="-25" width="14" height="13" rx="1.5" fill="#fff" stroke="#444" stroke-width="0.8"/>
    <text x="22" y="-15" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#c94f3d">?</text>
    <animateTransform attributeName="transform" type="rotate" values="-6 22 0;6 22 0;-6 22 0" dur="1s" begin="${(i * 0.2).toFixed(1)}s" repeatCount="indefinite"/>
  </g>
</g>`
  }
  if (asks > VISUAL_CAP) {
    out += `<text x="396" y="152" text-anchor="end" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#4a3b2d">+${asks - VISUAL_CAP}</text>`
  }
  return out
}

function shelf(shipped: number): string {
  let out = `
<rect x="298" y="56" width="98" height="3" fill="#8c5a2b"/>
<text x="347" y="30" text-anchor="middle" font-family="system-ui, sans-serif" font-size="6.5" fill="#6b5c4d" letter-spacing="1">SHIPPED</text>`
  const shown = Math.min(shipped, VISUAL_CAP)
  for (let i = 0; i < shown; i++) {
    out += `<use href="#shipped" x="${300 + i * 18}" y="40"/>`
  }
  if (shipped > VISUAL_CAP) {
    out += `<text x="396" y="52" text-anchor="end" font-family="system-ui, sans-serif" font-size="8" font-weight="700" fill="#4a3b2d">+${shipped - VISUAL_CAP}</text>`
  }
  return out
}

// A pressure gauge on the wall: the context window's fill.
function gauge(percent: number | undefined): string {
  const cx = 118
  const cy = 48
  const r = 15
  const p = percent === undefined ? 0 : Math.max(0, Math.min(100, percent))
  const angle = -135 + (p / 100) * 270
  const tone = p >= 85 ? '#c94f3d' : p >= 60 ? '#e0a040' : '#5a9e6f'
  const label = percent === undefined ? '--' : `${Math.round(p)}%`
  const arc = (from: number, to: number, color: string) => {
    const a0 = ((from - 90) * Math.PI) / 180
    const a1 = ((to - 90) * Math.PI) / 180
    const x0 = cx + r * Math.cos(a0)
    const y0 = cy + r * Math.sin(a0)
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const large = to - from > 180 ? 1 : 0
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${color}" stroke-width="3" fill="none"/>`
  }
  return `
<g>
  <title>Context window ${label} full</title>
  <circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="#fff" stroke="#9c8a74" stroke-width="1.5"/>
  ${arc(-135, 27, '#5a9e6f')}${arc(27, 94.5, '#e0a040')}${arc(94.5, 135, '#c94f3d')}
  <g transform="rotate(${angle.toFixed(1)} ${cx} ${cy})">
    <path d="M${cx} ${cy + 3} L${cx - 1.6} ${cy} L${cx} ${cy - r + 2} L${cx + 1.6} ${cy} Z" fill="#2b2b2b">
      <animateTransform attributeName="transform" type="rotate" values="-2 ${cx} ${cy};2 ${cx} ${cy};-2 ${cx} ${cy}" dur="1.6s" repeatCount="indefinite"/>
    </path>
  </g>
  <circle cx="${cx}" cy="${cy}" r="2" fill="#2b2b2b"/>
  <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="6.5" font-weight="700" fill="${tone}">${label}</text>
  <text x="${cx}" y="${cy + r + 13}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="5.5" fill="#6b5c4d" letter-spacing="1">CONTEXT</text>
</g>`
}

function basket(): string {
  return `
<g id="basket" transform="translate(200 150)">
  <ellipse cx="0" cy="0" rx="34" ry="9" fill="#c9a170"/>
  <g color="#e3c08d" transform="translate(-4 -14) scale(0.85)">
    <use href="#dog"/>
    <use href="#sleepy"/>
  </g>
  <path d="M-34 0 q0 10 34 10 q34 0 34 -10" fill="#b58a55"/>
  <g transform="translate(26 -4)">
    <rect x="-7" y="-1.5" width="14" height="3" rx="1.5" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    <circle cx="-7" cy="-1.5" r="2" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    <circle cx="-7" cy="1.5" r="2" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    <circle cx="7" cy="-1.5" r="2" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    <circle cx="7" cy="1.5" r="2" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
  </g>
  <g font-family="system-ui, sans-serif" font-weight="700" fill="#6b5c4d">
    <text x="8" y="-30" font-size="7">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -8" dur="2.4s" repeatCount="indefinite"/></text>
    <text x="14" y="-36" font-size="9">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.2s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -8" dur="2.4s" begin="1.2s" repeatCount="indefinite"/></text>
  </g>
</g>
<text x="200" y="174" text-anchor="middle" font-family="system-ui, sans-serif" font-size="7" fill="#6b5c4d">All quiet on the floor.</text>`
}

export function factorySvg(view: SceneView): string {
  const isIdle = view.asks === 0 && view.steps === 0 && view.workers.length === 0
  const body = isIdle
    ? `${WALL}${gauge(view.contextPercent)}${belt()}${shelf(view.shipped)}${door(0)}${foreman(view.isForemanBusy)}${basket()}<rect width="400" height="180" fill="#1b2230" opacity="0.28"/>`
    : `${WALL}${gauge(view.contextPercent)}${belt()}${shelf(view.shipped)}${door(view.asks)}${workers(view.workers)}${crates(view.steps, view.activeSteps)}${foreman(view.isForemanBusy)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 180" width="400" height="180" role="img">${DEFS}${body}</svg>`
}

export function sceneAlt(view: SceneView): string {
  const parts = [
    view.isForemanBusy ? 'Foreman dog typing' : 'Foreman dog asleep',
    `${view.workers.length} worker dog${view.workers.length === 1 ? '' : 's'} at the belt`,
    `${view.steps} crate${view.steps === 1 ? '' : 's'} on the belt`,
    `${view.asks} dog${view.asks === 1 ? '' : 's'} waiting at the boss's door`,
    `${view.shipped} box${view.shipped === 1 ? '' : 'es'} shipped`,
  ]
  if (view.contextPercent !== undefined) parts.push(`context window ${Math.round(view.contextPercent)}% full`)
  return parts.join(', ') + '.'
}
