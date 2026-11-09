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
  /** Who shipped each box on the shelf, oldest first. */
  shippedNames?: string[]
}

/** How many of each the tall scene draws before a +N tag. */
export const CRATE_CAP = 6
export const WORKER_CAP = 6
export const SHELF_CAP = 10

const COATS = ['#c98a5a', '#8d6748', '#e3c08d', '#f2e9dc', '#6b4f3a', '#b9b9b9', '#d9a066'] as const
const FONT = 'font-family="system-ui, sans-serif"'

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
  <g id="spark"><circle r="1.3" fill="#ffb347"/></g>
  <clipPath id="belt-clip"><rect x="40" y="206" width="320" height="12" rx="6"/></clipPath>
</defs>`

// Three floors, each drawn in the same coordinates so a strip is one window
// onto the whole: the office (y 0-124), the factory floor (124-236), the
// shipping dock (236-320).
const OFFICE = { y: 0, height: 124 } as const
const FLOOR = { y: 124, height: 112 } as const
const DOCK = { y: 236, height: 84 } as const

const WALL_OFFICE = `
<rect width="400" height="124" fill="#f6efe6"/>
<rect y="118" width="400" height="6" fill="#cbbfae"/>
<g fill="#cfe6f5" stroke="#9db7c7">
  <rect x="150" y="34" width="46" height="26" rx="3"/>
  <rect x="210" y="34" width="46" height="26" rx="3"/>
</g>
<g stroke="#9db7c7" stroke-width="1">
  <path d="M173 34 v26 M150 47 h46 M233 34 v26 M210 47 h46"/>
</g>
<rect x="148" y="6" width="104" height="17" rx="4" fill="#c94f3d"/>
<text x="200" y="18.5" text-anchor="middle" ${FONT} font-size="10" font-weight="700" fill="#fff" letter-spacing="1">DOG FACTORY</text>`

const WALL_FLOOR = `
<rect y="124" width="400" height="104" fill="#f1e8dc"/>
<rect y="228" width="400" height="8" fill="#b9a995"/>
<text x="8" y="134" ${FONT} font-size="6" fill="#9c8a74" letter-spacing="1.5">FLOOR</text>`

const WALL_DOCK = `
<rect y="236" width="400" height="84" fill="#e9dfd1"/>
<rect y="312" width="400" height="8" fill="#b9a995"/>`

function foreman(isBusy: boolean): string {
  const coat = '#8d6748'
  const desk = `
<rect x="94" y="98" width="86" height="7" rx="2" fill="#a0703f"/>
<rect x="100" y="105" width="6" height="13" fill="#8c5a2b"/>
<rect x="168" y="105" width="6" height="13" fill="#8c5a2b"/>
<text x="137" y="115" text-anchor="middle" ${FONT} font-size="6" fill="#6b5c4d" letter-spacing="1">FOREMAN</text>`
  if (isBusy) {
    return `
<g color="${coat}" transform="translate(124 76)">
  <title>The foreman is working this turn</title>
  <use href="#dog"/>
  <circle cx="26" cy="20" r="3" fill="currentColor"><animate attributeName="cy" values="20;16;20" dur="0.28s" repeatCount="indefinite"/></circle>
  <circle cx="33" cy="20" r="3" fill="currentColor"><animate attributeName="cy" values="16;20;16" dur="0.28s" repeatCount="indefinite"/></circle>
</g>
<g transform="translate(152 84)">
  <rect width="22" height="14" rx="1.5" fill="#444"/>
  <rect x="2" y="2" width="18" height="9" fill="#9fd3ff"><animate attributeName="fill" values="#9fd3ff;#c8e8ff;#9fd3ff" dur="0.9s" repeatCount="indefinite"/></rect>
</g>
<g transform="translate(100 90)">
  <rect width="10" height="8" fill="#fff" stroke="#bbb" stroke-width="0.6">
    <animateTransform attributeName="transform" type="rotate" values="-6 5 8;6 5 8;-6 5 8" dur="0.6s" repeatCount="indefinite"/>
  </rect>
</g>${desk}`
  }
  return `
<g color="${coat}" transform="translate(126 80)">
  <title>The foreman is idle</title>
  <use href="#dog"/>
  <use href="#sleepy"/>
</g>
<g ${FONT} font-weight="700" fill="#6b5c4d">
  <text x="154" y="72" font-size="7">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -10" dur="2.4s" repeatCount="indefinite"/></text>
  <text x="160" y="66" font-size="9">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="0.8s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -10" dur="2.4s" begin="0.8s" repeatCount="indefinite"/></text>
  <text x="167" y="60" font-size="11">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.6s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -10" dur="2.4s" begin="1.6s" repeatCount="indefinite"/></text>
</g>${desk}`
}

// A pressure gauge on the office wall: the context window's fill.
function gauge(percent: number | undefined): string {
  const cx = 50
  const cy = 58
  const r = 22
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
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${color}" stroke-width="4" fill="none"/>`
  }
  let ticks = ''
  for (let t = 0; t <= 10; t++) {
    const a = ((-135 + t * 27 - 90) * Math.PI) / 180
    const inner = r - 5
    const outer = r - 2.5
    ticks += `<path d="M${(cx + inner * Math.cos(a)).toFixed(1)} ${(cy + inner * Math.sin(a)).toFixed(1)} L${(cx + outer * Math.cos(a)).toFixed(1)} ${(cy + outer * Math.sin(a)).toFixed(1)}" stroke="#7a6a58" stroke-width="${t % 5 === 0 ? 1.2 : 0.6}"/>`
  }
  return `
<g>
  <title>Context window ${label} full</title>
  <circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="#fff" stroke="#9c8a74" stroke-width="1.5"/>
  ${arc(-135, 27, '#5a9e6f')}${arc(27, 94.5, '#e0a040')}${arc(94.5, 135, '#c94f3d')}
  ${ticks}
  <g transform="rotate(${angle.toFixed(1)} ${cx} ${cy})">
    <path d="M${cx} ${cy + 4} L${cx - 2} ${cy} L${cx} ${cy - r + 3} L${cx + 2} ${cy} Z" fill="#2b2b2b">
      <animateTransform attributeName="transform" type="rotate" values="-2 ${cx} ${cy};2 ${cx} ${cy};-2 ${cx} ${cy}" dur="1.6s" repeatCount="indefinite"/>
    </path>
  </g>
  <circle cx="${cx}" cy="${cy}" r="2.5" fill="#2b2b2b"/>
  <text x="${cx}" y="${cy + 15}" text-anchor="middle" ${FONT} font-size="8.5" font-weight="700" fill="${tone}">${label}</text>
  <text x="${cx}" y="${cy + r + 16}" text-anchor="middle" ${FONT} font-size="6" fill="#6b5c4d" letter-spacing="1.5">CONTEXT</text>
</g>`
}

function door(asks: number): string {
  let out = `
<rect x="332" y="48" width="50" height="70" rx="3" fill="#7b5236"/>
<rect x="337" y="54" width="40" height="20" rx="1" fill="#cfe6f5"/>
<circle cx="373" cy="88" r="2.4" fill="#e0b84a"/>
<text x="357" y="44" text-anchor="middle" ${FONT} font-size="7" fill="#6b5c4d" letter-spacing="1">BOSS</text>`
  if (asks <= 0) return out
  const shown = Math.min(asks, VISUAL_CAP)
  for (let i = shown - 1; i >= 0; i--) {
    const x = 258 + i * 15
    out += `
<g color="${COATS[(i + 2) % COATS.length]}" transform="translate(${x} 102) scale(0.75)">
  <title>Waiting on the boss</title>
  <use href="#dog"/>
  <g>
    <rect x="21" y="-12" width="1.5" height="12" fill="#7a5230"/>
    <rect x="15" y="-25" width="14" height="13" rx="1.5" fill="#fff" stroke="#444" stroke-width="0.8"/>
    <text x="22" y="-15" text-anchor="middle" ${FONT} font-size="11" font-weight="700" fill="#c94f3d">?</text>
    <animateTransform attributeName="transform" type="rotate" values="-6 22 0;6 22 0;-6 22 0" dur="1s" begin="${(i * 0.2).toFixed(1)}s" repeatCount="indefinite"/>
  </g>
</g>`
  }
  if (asks > VISUAL_CAP) {
    out += `<text x="256" y="80" ${FONT} font-size="8" font-weight="700" fill="#4a3b2d">+${asks - VISUAL_CAP} more</text>`
  }
  return out
}

function belt(): string {
  let stripes = ''
  for (let x = 24; x < 376; x += 16) stripes += `<rect x="${x}" y="206" width="6" height="12" fill="#8a8a8a"/>`
  return `
<rect x="40" y="206" width="320" height="12" rx="6" fill="#555"/>
<g clip-path="url(#belt-clip)">
  <g>${stripes}<animateTransform attributeName="transform" type="translate" values="0 0;16 0" dur="0.8s" repeatCount="indefinite"/></g>
</g>
<rect x="50" y="218" width="5" height="10" fill="#777"/>
<rect x="345" y="218" width="5" height="10" fill="#777"/>`
}

function crates(count: number, active: number[] = []): string {
  if (count <= 0) return ''
  const shown = Math.min(count, CRATE_CAP)
  let out = ''
  for (let i = 0; i < shown; i++) {
    const x = 52 + i * 48
    const isActive = active.includes(i)
    const glow = isActive
      ? `<rect x="-2" y="-2" width="20" height="20" rx="3" fill="none" stroke="#e0b84a" stroke-width="2"><animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/></rect>
    <circle cx="14" cy="2" r="3.2" fill="#e0b84a"><animate attributeName="r" values="3.2;4;3.2" dur="1s" repeatCount="indefinite"/></circle>`
      : ''
    out += `
<g transform="translate(${x} 187.5) scale(1.15)" class="${isActive ? 'crate-active' : 'crate'}">
  <title>Step ${i + 1}${isActive ? ' (in progress)' : ''}</title>
  <g>
    ${glow}
    <use href="#crate"/>
    <text x="8" y="12" text-anchor="middle" ${FONT} font-size="8.5" font-weight="700" fill="#5a3a1a">${i + 1}</text>
    <animateTransform attributeName="transform" type="translate" values="0 0;0 -1.5;0 0" dur="${isActive ? '0.5s' : '1.1s'}" begin="${(i * 0.17).toFixed(2)}s" repeatCount="indefinite"/>
  </g>
</g>`
  }
  if (count > CRATE_CAP) {
    out += `<text x="358" y="200" text-anchor="end" ${FONT} font-size="8" font-weight="700" fill="#5a3a1a">+${count - CRATE_CAP}</text>`
  }
  return out
}

function workers(list: SceneView['workers']): string {
  if (list.length === 0) return ''
  const shown = list.slice(0, WORKER_CAP)
  let out = ''
  shown.forEach((w, i) => {
    const x = 70 + i * 52
    const badge = Math.max(26, w.dog.length * 4.6 + 6)
    const title = w.description ? `<title>${esc(w.dog)}: ${esc(w.description)}</title>` : `<title>${esc(w.dog)}</title>`
    out += `
<g color="${dogColor(w.dog)}" transform="translate(${x} 180) scale(1.25)">
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
  <rect x="-10" y="-30" width="${badge}" height="10" rx="5" fill="#fff" stroke="#c9b9a6" stroke-width="0.6"/>
  <text x="${-10 + badge / 2}" y="-22.5" text-anchor="middle" ${FONT} font-size="6.5" font-weight="600" fill="#4a3b2d">${esc(w.dog)}</text>
</g>`
  })
  if (list.length > WORKER_CAP) {
    out += `<text x="392" y="150" text-anchor="end" ${FONT} font-size="8" font-weight="700" fill="#4a3b2d">+${list.length - WORKER_CAP}</text>`
  }
  return out
}

function dock(shipped: number, names: string[] = []): string {
  let out = `
<text x="8" y="248" ${FONT} font-size="6" fill="#9c8a74" letter-spacing="1.5">SHIPPING${shipped > 0 ? ` · ${shipped} SHIPPED` : ''}</text>
<rect x="40" y="298" width="320" height="4" fill="#8c5a2b"/>
<rect x="46" y="302" width="4" height="10" fill="#8c5a2b"/>
<rect x="350" y="302" width="4" height="10" fill="#8c5a2b"/>
<g transform="translate(374 292)">
  <rect x="-1" y="-30" width="2" height="30" fill="#555" transform="rotate(-12)"/>
  <rect x="-8" y="-2" width="14" height="2" fill="#555"/>
  <circle cx="-5" cy="4" r="3.5" fill="#333"/>
  <circle cx="5" cy="4" r="3.5" fill="#333"/>
</g>`
  const shown = Math.min(shipped, SHELF_CAP)
  // The newest boxes are the ones shown; each carries the name of the dog that shipped it.
  const recent = names.slice(-shown)
  for (let i = 0; i < shown; i++) {
    const x = 46 + i * 30
    const name = recent[i]
    out += `<use href="#shipped" x="${x}" y="282"/>`
    if (name) {
      out += `<text x="${x + 8}" y="277" text-anchor="middle" ${FONT} font-size="5.5" font-weight="600" fill="#4a3b2d">${esc(name)}</text>`
    }
  }
  if (shipped > SHELF_CAP) {
    out += `<text x="354" y="294" text-anchor="end" ${FONT} font-size="8" font-weight="700" fill="#4a3b2d">+${shipped - SHELF_CAP}</text>`
  }
  if (shipped === 0) {
    out += `<text x="200" y="290" text-anchor="middle" ${FONT} font-size="7" fill="#9c8a74">nothing shipped yet</text>`
  }
  return out
}

function basket(): string {
  return `
<g id="basket" transform="translate(200 222)">
  <ellipse cx="0" cy="0" rx="40" ry="10" fill="#c9a170"/>
  <g color="#e3c08d" transform="translate(-6 -17)">
    <use href="#dog"/>
    <use href="#sleepy"/>
  </g>
  <path d="M-40 0 q0 12 40 12 q40 0 40 -12" fill="#b58a55"/>
  <g transform="translate(30 -5)">
    <rect x="-7" y="-1.5" width="14" height="3" rx="1.5" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    <circle cx="-7" cy="-1.5" r="2" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    <circle cx="-7" cy="1.5" r="2" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    <circle cx="7" cy="-1.5" r="2" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    <circle cx="7" cy="1.5" r="2" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
  </g>
  <g ${FONT} font-weight="700" fill="#6b5c4d">
    <text x="8" y="-34" font-size="7">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -8" dur="2.4s" repeatCount="indefinite"/></text>
    <text x="14" y="-40" font-size="9">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.2s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -8" dur="2.4s" begin="1.2s" repeatCount="indefinite"/></text>
  </g>
</g>
<text x="200" y="160" text-anchor="middle" ${FONT} font-size="7.5" fill="#6b5c4d">All quiet on the floor.</text>`
}

function isIdle(view: SceneView): boolean {
  return view.asks === 0 && view.steps === 0 && view.workers.length === 0
}

function parts(view: SceneView): { office: string; floor: string; dock: string } {
  return {
    office: `${WALL_OFFICE}${gauge(view.contextPercent)}${door(view.asks)}${foreman(view.isForemanBusy)}`,
    floor: isIdle(view)
      ? `${WALL_FLOOR}${belt()}${basket()}`
      : `${WALL_FLOOR}${workers(view.workers)}${belt()}${crates(view.steps, view.activeSteps)}`,
    dock: `${WALL_DOCK}${dock(view.shipped, view.shippedNames)}`,
  }
}

// The markup asks for three times the viewBox, wider than any pane: the surface
// draws it at the slot's width and keeps the aspect, so each strip spans the pane.
const SCALE = 3

function doc(y: number, height: number, body: string, isDim: boolean): string {
  const dim = isDim ? `<rect y="${y}" width="400" height="${height}" fill="#1b2230" opacity="0.28"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${y} 400 ${height}" width="${400 * SCALE}" height="${height * SCALE}" role="img">${DEFS}${body}${dim}</svg>`
}

/** The whole factory as one drawing, 400 by 320. */
export function factorySvg(view: SceneView): string {
  const p = parts(view)
  return doc(0, 320, `${p.office}${p.floor}${p.dock}`, isIdle(view))
}

/**
 * The factory as three stacked strips, one per floor. Each is short and wide,
 * so a pane draws it at full width whatever height it allows one drawing.
 */
export function factoryStrips(view: SceneView): { office: string; floor: string; dock: string } {
  const p = parts(view)
  const dim = isIdle(view)
  return {
    office: doc(OFFICE.y, OFFICE.height, p.office, dim),
    floor: doc(FLOOR.y, FLOOR.height, p.floor, dim),
    dock: doc(DOCK.y, DOCK.height, p.dock, dim),
  }
}

export function stripAlts(view: SceneView): { office: string; floor: string; dock: string } {
  const pct = view.contextPercent !== undefined ? `, context window ${Math.round(view.contextPercent)}% full` : ''
  return {
    office: `Office: ${view.isForemanBusy ? 'foreman dog typing' : 'foreman dog asleep'}, ${view.asks} dog${view.asks === 1 ? '' : 's'} waiting at the boss's door${pct}.`,
    floor: `Factory floor: ${view.workers.length} worker dog${view.workers.length === 1 ? '' : 's'} at the belt, ${view.steps} crate${view.steps === 1 ? '' : 's'} on the belt.`,
    dock: `Shipping dock: ${view.shipped} box${view.shipped === 1 ? '' : 'es'} shipped.`,
  }
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
