import type { Board, Item, ItemKind, ItemSource } from '../types'

export const DAY_MS = 86_400_000
export const MAX_ITEMS = 200
export const VISUAL_CAP = 5

export const DOG_NAMES = [
  'Biscuit',
  'Pepper',
  'Waffles',
  'Mochi',
  'Noodle',
  'Pickles',
  'Olive',
  'Scout',
  'Peanut',
  'Maple',
  'Clover',
  'Ziggy',
] as const

const KINDS: readonly ItemKind[] = ['ask', 'step', 'agent']
const SOURCES: readonly ItemSource[] = ['claude', 'agent', 'you']

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

export function dogName(agentId: string): string {
  return DOG_NAMES[hash(agentId) % DOG_NAMES.length]!
}

export function newId(): string {
  let id = ''
  for (let i = 0; i < 4; i++) id += Math.floor(Math.random() * 36).toString(36)
  return id
}

export type NewItem = {
  kind: ItemKind
  text: string
  source: ItemSource
  detail?: string
  durationMs?: number
  dog?: string
  doneAt?: number
}

export function addItem(board: Board, input: NewItem, now: number): Board {
  const taken = new Set(board.items.map(i => i.id))
  let id = newId()
  while (taken.has(id)) id = newId()
  const item: Item = { id, kind: input.kind, text: input.text, source: input.source, createdAt: now }
  if (input.detail !== undefined) item.detail = input.detail
  if (input.durationMs !== undefined) item.durationMs = input.durationMs
  if (input.dog !== undefined) item.dog = input.dog
  if (input.doneAt !== undefined) item.doneAt = input.doneAt
  return { items: [...board.items, item] }
}

export function completeItems(board: Board, ids: string[], now: number): { board: Board; unknown: string[] } {
  const known = new Set(board.items.map(i => i.id))
  const unknown = ids.filter(id => !known.has(id))
  const wanted = new Set(ids)
  const items = board.items.map(i => (wanted.has(i.id) && i.doneAt === undefined ? { ...i, doneAt: now } : i))
  return { board: { items }, unknown }
}

export function startItems(board: Board, ids: string[], now: number): Board {
  const wanted = new Set(ids)
  const items = board.items.map(i =>
    wanted.has(i.id) && i.kind === 'step' && i.doneAt === undefined && i.startedAt === undefined ? { ...i, startedAt: now } : i,
  )
  return { items }
}

/** The open step whose text a "Do: <text>" prompt names, if any. */
export function stepForPrompt(board: Board, prompt: string): Item | undefined {
  const m = /^\s*Do:\s*([\s\S]+?)\s*$/.exec(prompt)
  if (!m) return undefined
  const wanted = m[1]!.trim().toLowerCase()
  return openSteps(board).find(i => i.text.trim().toLowerCase() === wanted)
}

export const isStarted = (item: Item): boolean => item.startedAt !== undefined && item.doneAt === undefined

export function dropItems(board: Board, ids: string[]): { board: Board; unknown: string[] } {
  const known = new Set(board.items.map(i => i.id))
  const unknown = ids.filter(id => !known.has(id))
  const wanted = new Set(ids)
  return { board: { items: board.items.filter(i => !wanted.has(i.id)) }, unknown }
}

export function prune(board: Board, now: number): Board {
  const kept = board.items.filter(i => i.doneAt === undefined || now - i.doneAt <= DAY_MS)
  return { items: kept.slice(-MAX_ITEMS) }
}

export const openAsks = (board: Board): Item[] => board.items.filter(i => i.kind === 'ask' && i.doneAt === undefined)
export const openSteps = (board: Board): Item[] => board.items.filter(i => i.kind === 'step' && i.doneAt === undefined)
export const shipped = (board: Board): Item[] => board.items.filter(i => i.kind === 'agent')
export const doneByYou = (board: Board): Item[] =>
  board.items.filter(i => i.kind !== 'agent' && i.doneAt !== undefined)

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export function summary(board: Board): string | undefined {
  const asks = openAsks(board).length
  const steps = openSteps(board).length
  if (asks === 0 && steps === 0) return undefined
  const parts: string[] = []
  if (asks > 0) parts.push(count(asks, 'ask', 'asks'))
  if (steps > 0) parts.push(count(steps, 'step', 'steps'))
  return parts.join(' · ')
}

export function boardText(board: Board): string {
  const open = [...openAsks(board), ...openSteps(board)]
  if (open.length === 0) return '(nothing open)'
  return open.map(i => `[${i.id}] ${i.kind}${isStarted(i) ? ' (in progress)' : ''}: ${i.text}`).join('\n')
}

export function ageOf(sinceMs: number, now: number): string {
  const s = Math.max(0, now - sinceMs) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86_400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86_400)}d`
}

export function firstLine(text: string, max = 160): string {
  const line = text
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0)
  if (line === undefined) return ''
  return line.length > max ? line.slice(0, max - 1) + '…' : line
}

export function storeKey(cwd: string): string {
  return `board:${cwd}`
}

function isItem(value: unknown): value is Item {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    KINDS.includes(v.kind as ItemKind) &&
    typeof v.text === 'string' &&
    typeof v.createdAt === 'number' &&
    SOURCES.includes(v.source as ItemSource) &&
    (v.doneAt === undefined || typeof v.doneAt === 'number') &&
    (v.startedAt === undefined || typeof v.startedAt === 'number') &&
    (v.detail === undefined || typeof v.detail === 'string') &&
    (v.durationMs === undefined || typeof v.durationMs === 'number') &&
    (v.dog === undefined || typeof v.dog === 'string')
  )
}

export function asBoard(value: unknown): Board | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const items = (value as Record<string, unknown>).items
  if (!Array.isArray(items) || !items.every(isItem)) return undefined
  return { items }
}
