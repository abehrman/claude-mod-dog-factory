import type { Usage, UsageCategory } from '../types'

/** One colour per used category: the bar's segment and the table's key square. */
export const SEGMENTS = [
  { hex: '#4a90d9', key: '🟦' },
  { hex: '#5aa469', key: '🟩' },
  { hex: '#e0b84a', key: '🟨' },
  { hex: '#e08a3c', key: '🟧' },
  { hex: '#c94f3d', key: '🟥' },
  { hex: '#8e6bbf', key: '🟪' },
  { hex: '#8d6748', key: '🟫' },
] as const
const BUFFER = { hex: '#6b6b6b', key: '⬛' } as const
const FREE = { hex: '#d8d8d8', key: '⬜' } as const

export type ContextRow = {
  key: string
  hex: string
  name: string
  tokens: number
  /** Share of the window, 0 to 1. */
  share: number
  kind: 'used' | 'free' | 'buffer'
}

export function thousands(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

export function percentOf(usage: Usage): number | undefined {
  return usage.percent ?? (usage.tokens !== undefined ? Math.round((usage.tokens / usage.window) * 100) : undefined)
}

function kindOf(c: UsageCategory): UsageCategory['kind'] {
  return c.kind ?? 'used'
}

function windowOf(usage: Usage): number {
  return usage.compactWindow ?? usage.window
}

function shareText(share: number, tokens: number): string {
  const pct = Math.round(share * 100)
  return pct === 0 && tokens > 0 ? '<1%' : `${pct}%`
}

export function headline(usage: Usage | null): string {
  if (usage === null) return 'Context: not measured yet'
  const pct = percentOf(usage)
  const parts = [`Context ${pct === undefined ? '--' : `${pct}%`}`]
  if (usage.tokens !== undefined) parts.push(`${thousands(usage.tokens)} of ${thousands(usage.window)}`)
  if (usage.autoCompactAt !== undefined) parts.push(`compacts at ${thousands(usage.autoCompactAt)}`)
  return parts.join(' · ')
}

export function limitsLine(usage: Usage | null): string | undefined {
  if (usage === null) return undefined
  const parts: string[] = []
  if (usage.fiveHour !== undefined) parts.push(`5h window ${usage.fiveHour}%`)
  if (usage.sevenDay !== undefined) parts.push(`7d window ${usage.sevenDay}%`)
  if (usage.usd !== undefined) parts.push(`$${usage.usd.toFixed(2)} this session`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** What occupies the window: used rows largest first, then the buffer, then free space. */
export function contextRows(usage: Usage | null): ContextRow[] {
  if (usage === null || !usage.categories) return []
  const window = windowOf(usage)
  const rows: ContextRow[] = []
  const used = usage.categories.filter(c => kindOf(c) === 'used' && c.tokens > 0).sort((a, b) => b.tokens - a.tokens)
  used.forEach((c, i) => {
    const seg = SEGMENTS[i % SEGMENTS.length]!
    rows.push({ key: seg.key, hex: seg.hex, name: c.name, tokens: c.tokens, share: c.tokens / window, kind: 'used' })
  })
  for (const c of usage.categories) {
    if (kindOf(c) === 'buffer' && c.tokens > 0) {
      rows.push({ ...BUFFER, name: c.name, tokens: c.tokens, share: c.tokens / window, kind: 'buffer' })
    }
  }
  for (const c of usage.categories) {
    if (kindOf(c) === 'free' && c.tokens > 0) {
      rows.push({ ...FREE, name: c.name, tokens: c.tokens, share: c.tokens / window, kind: 'free' })
    }
  }
  return rows
}

/** Tool schemas loaded on demand: outside the window, listed apart. */
export function onDemand(usage: Usage | null): { name: string; tokens: number }[] {
  if (usage === null || !usage.categories) return []
  return usage.categories
    .filter(c => kindOf(c) === 'deferred' && c.tokens > 0)
    .map(c => ({ name: c.name.replace(/\s*\(deferred\)\s*$/i, ''), tokens: c.tokens }))
}

/** The breakdown as a markdown table, with a line for what loads on demand. */
export function contextTable(usage: Usage | null): string | undefined {
  const rows = contextRows(usage)
  if (rows.length === 0) return undefined
  const lines = ['| | In the window | Tokens | Share |', '|:--|:--|--:|--:|']
  for (const r of rows) lines.push(`| ${r.key} | ${r.name} | ${thousands(r.tokens)} | ${shareText(r.share, r.tokens)} |`)
  const later = onDemand(usage)
  const notes: string[] = []
  if (later.length > 0) {
    notes.push(`Loaded only on demand, outside the window: ${later.map(l => `${l.name} ${thousands(l.tokens)}`).join(' · ')}`)
  }
  const counts: string[] = []
  if (usage?.memoryFiles !== undefined && usage.memoryFiles > 0) counts.push(`${usage.memoryFiles} memory file${usage.memoryFiles === 1 ? '' : 's'}`)
  if (usage?.mcpTools !== undefined && usage.mcpTools > 0) counts.push(`${usage.mcpTools} MCP tool${usage.mcpTools === 1 ? '' : 's'}`)
  if (counts.length > 0) notes.push(counts.join(' · '))
  return notes.length > 0 ? `${lines.join('\n')}\n\n${notes.join('\n\n')}` : lines.join('\n')
}

/**
 * The window as one stacked bar: a segment per used category from the left,
 * the compaction buffer at the right end, free space the bare track between,
 * and a tick where auto-compaction runs. No text, so it reads on any theme.
 */
export function contextBarSvg(usage: Usage | null): string | undefined {
  const rows = contextRows(usage)
  if (usage === null || rows.length === 0) return undefined
  const window = windowOf(usage)
  const W = 400
  let x = 0
  let segments = ''
  for (const r of rows) {
    if (r.kind !== 'used') continue
    const w = Math.max(0.8, r.share * W)
    segments += `<rect x="${x.toFixed(1)}" y="5" width="${w.toFixed(1)}" height="14" fill="${r.hex}"><title>${r.name}: ${thousands(r.tokens)}</title></rect>`
    x += w
  }
  const buffer = rows.find(r => r.kind === 'buffer')
  if (buffer) {
    const w = Math.max(0.8, buffer.share * W)
    segments += `<rect x="${(W - w).toFixed(1)}" y="5" width="${w.toFixed(1)}" height="14" fill="${BUFFER.hex}"><title>${buffer.name}: ${thousands(buffer.tokens)}</title></rect>`
  }
  let tick = ''
  if (usage.autoCompactAt !== undefined && usage.autoCompactAt < window) {
    const tx = (usage.autoCompactAt / window) * W
    tick = `<path d="M${tx.toFixed(1)} 2 v20" stroke="#c94f3d" stroke-width="1.5"/><path d="M${(tx - 3).toFixed(1)} 0 h6 l-3 4 z" fill="#c94f3d"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 24" width="400" height="24" role="img"><defs><clipPath id="track"><rect x="0" y="5" width="400" height="14" rx="7"/></clipPath></defs><rect x="0" y="5" width="400" height="14" rx="7" fill="#8a8a8a" opacity="0.28"/><g clip-path="url(#track)">${segments}</g>${tick}</svg>`
}
