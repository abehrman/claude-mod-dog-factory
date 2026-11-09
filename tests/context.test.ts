import { expect, test } from 'claude-code/testing'

import { contextBarSvg, contextRows, contextTable, headline, limitsLine, onDemand } from '../hooks/context'
import type { Usage } from '../types'

// The figures from a real session: a 1M window, 47% full.
const REAL: Usage = {
  window: 1_000_000,
  tokens: 471_000,
  percent: 47,
  sevenDay: 45,
  usd: 32.43,
  compactWindow: 1_000_000,
  autoCompactAt: 967_000,
  memoryFiles: 0,
  mcpTools: 820,
  categories: [
    { name: 'System prompt', tokens: 12_000, kind: 'used' },
    { name: 'System tools', tokens: 37_000, kind: 'used' },
    { name: 'MCP tools', tokens: 21_000, kind: 'used' },
    { name: 'MCP server instructions', tokens: 8_000, kind: 'used' },
    { name: 'MCP tools (deferred)', tokens: 663_000, kind: 'deferred' },
    { name: 'System tools (deferred)', tokens: 40_000, kind: 'deferred' },
    { name: 'Custom agents', tokens: 5_000, kind: 'used' },
    { name: 'Skills', tokens: 10_000, kind: 'used' },
    { name: 'Messages', tokens: 378_000, kind: 'used' },
    { name: 'Autocompact buffer', tokens: 33_000, kind: 'buffer' },
    { name: 'Free space', tokens: 496_000, kind: 'free' },
  ],
}

test('rows list what is in the window, largest first, then buffer and free space', () => {
  const rows = contextRows(REAL)
  expect(rows.map(r => r.name)).toEqual([
    'Messages',
    'System tools',
    'MCP tools',
    'System prompt',
    'Skills',
    'MCP server instructions',
    'Custom agents',
    'Autocompact buffer',
    'Free space',
  ])
  expect(rows.some(r => r.name.includes('deferred'))).toBe(false)
  expect(onDemand(REAL)).toEqual([
    { name: 'MCP tools', tokens: 663_000 },
    { name: 'System tools', tokens: 40_000 },
  ])
})

test('the table is markdown with a colour key per row', () => {
  const table = contextTable(REAL)!
  const lines = table.split('\n')
  expect(lines[0]).toBe('| | In the window | Tokens | Share |')
  expect(lines[2]).toBe('| 🟦 | Messages | 378k | 38% |')
  expect(table).toContain('| 🟩 | System tools | 37k | 4% |')
  expect(table).toContain('| ⬜ | Free space | 496k | 50% |')
  expect(table).toContain('Loaded only on demand, outside the window: MCP tools 663k · System tools 40k')
  expect(table).toContain('820 MCP tools')
  expect(table).not.toContain('memory file')
})

test('a tiny category reads <1%, not 0%', () => {
  const table = contextTable({ ...REAL, categories: [{ name: 'Custom agents', tokens: 2_000, kind: 'used' }] })!
  expect(table).toContain('| Custom agents | 2k | <1% |')
})

test('headline and limits', () => {
  expect(headline(REAL)).toBe('Context 47% · 471k of 1000k · compacts at 967k')
  expect(headline(null)).toBe('Context: not measured yet')
  expect(limitsLine(REAL)).toBe('7d window 45% · $32.43 this session')
  expect(limitsLine({ window: 1 })).toBeUndefined()
})

test('the bar has a segment per used row, the buffer, and a compaction tick', () => {
  const svg = contextBarSvg(REAL)!
  expect(svg).toStartWith('<svg')
  expect((svg.match(/<rect x="[\d.]+" y="5"/g) ?? []).length).toBe(2 + 7 + 1) // clip and track + used + buffer
  expect(svg).toContain('Messages: 378k')
  expect(svg).toContain('stroke="#c94f3d"')
  expect(contextBarSvg(null)).toBeUndefined()
  expect(contextBarSvg({ window: 1 })).toBeUndefined()
})
