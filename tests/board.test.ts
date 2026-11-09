import { expect, test } from 'claude-code/testing'

import {
  DAY_MS,
  DOG_NAMES,
  MAX_ITEMS,
  addItem,
  ageOf,
  asBoard,
  boardText,
  completeItems,
  dogName,
  dropItems,
  firstLine,
  isStarted,
  newId,
  openAsks,
  openSteps,
  prune,
  shipped,
  startItems,
  stepForPrompt,
  storeKey,
  summary,
} from '../hooks/board'
import type { Board } from '../types'

const EMPTY: Board = { items: [] }
const NOW = 1_700_000_000_000

test('dogName is stable and drawn from the list', () => {
  expect(dogName('agent-1')).toBe(dogName('agent-1'))
  expect(DOG_NAMES).toContain(dogName('agent-1'))
  expect(DOG_NAMES).toContain(dogName('another id entirely'))
})

test('newId is four lowercase base36 characters', () => {
  for (let i = 0; i < 20; i++) expect(newId()).toMatch(/^[a-z0-9]{4}$/)
})

test('addItem assigns an id and a creation time', () => {
  const board = addItem(EMPTY, { kind: 'ask', text: 'Which DB?', source: 'claude' }, NOW)
  expect(board.items).toHaveLength(1)
  expect(board.items[0]).toMatchObject({ kind: 'ask', text: 'Which DB?', source: 'claude', createdAt: NOW })
  expect(board.items[0]?.id).toMatch(/^[a-z0-9]{4}$/)
  expect(openAsks(board)).toHaveLength(1)
  expect(openSteps(board)).toHaveLength(0)
})

test('completeItems marks done and names unknown ids', () => {
  const board = addItem(EMPTY, { kind: 'step', text: 'Run tests', source: 'claude' }, NOW)
  const id = board.items[0]!.id
  const done = completeItems(board, [id, 'zzzz'], NOW + 5)
  expect(done.unknown).toEqual(['zzzz'])
  expect(done.board.items[0]?.doneAt).toBe(NOW + 5)
  expect(openSteps(done.board)).toHaveLength(0)
})

test('dropItems removes the row and names unknown ids', () => {
  const board = addItem(EMPTY, { kind: 'step', text: 'Run tests', source: 'claude' }, NOW)
  const id = board.items[0]!.id
  const dropped = dropItems(board, [id, 'nope'])
  expect(dropped.board.items).toHaveLength(0)
  expect(dropped.unknown).toEqual(['nope'])
})

test('prune drops done rows older than a day and caps the list', () => {
  let board = addItem(EMPTY, { kind: 'agent', text: 'old', source: 'agent', doneAt: NOW - DAY_MS - 1 }, NOW - DAY_MS - 1)
  board = addItem(board, { kind: 'agent', text: 'fresh', source: 'agent', doneAt: NOW - 60_000 }, NOW - 60_000)
  board = addItem(board, { kind: 'ask', text: 'open and old', source: 'claude' }, NOW - 3 * DAY_MS)
  const pruned = prune(board, NOW)
  expect(pruned.items.map(i => i.text)).toEqual(['fresh', 'open and old'])

  let big = EMPTY
  for (let i = 0; i < MAX_ITEMS + 10; i++) {
    big = addItem(big, { kind: 'step', text: `s${i}`, source: 'claude' }, NOW + i)
  }
  expect(prune(big, NOW + 1000).items).toHaveLength(MAX_ITEMS)
  expect(prune(big, NOW + 1000).items[0]?.text).toBe('s10')
})

test('summary counts open asks and steps', () => {
  expect(summary(EMPTY)).toBeUndefined()
  let board = addItem(EMPTY, { kind: 'ask', text: 'a', source: 'claude' }, NOW)
  expect(summary(board)).toBe('1 ask')
  board = addItem(board, { kind: 'ask', text: 'b', source: 'claude' }, NOW)
  board = addItem(board, { kind: 'step', text: 'c', source: 'claude' }, NOW)
  expect(summary(board)).toBe('2 asks · 1 step')
  board = addItem(board, { kind: 'agent', text: 'd', source: 'agent', doneAt: NOW }, NOW)
  expect(summary(board)).toBe('2 asks · 1 step')
  expect(shipped(board)).toHaveLength(1)
})

test('boardText lists open items with ids', () => {
  expect(boardText(EMPTY)).toBe('(nothing open)')
  const board = addItem(EMPTY, { kind: 'step', text: 'Ship it', source: 'claude' }, NOW)
  expect(boardText(board)).toBe(`[${board.items[0]!.id}] step: Ship it`)
})

test('ageOf rounds to the coarsest unit', () => {
  expect(ageOf(NOW, NOW + 20_000)).toBe('just now')
  expect(ageOf(NOW, NOW + 3 * 60_000)).toBe('3m')
  expect(ageOf(NOW, NOW + 2 * 3_600_000)).toBe('2h')
  expect(ageOf(NOW, NOW + 30 * 3_600_000)).toBe('1d')
})

test('firstLine trims to one short line', () => {
  expect(firstLine('  Fixed the bug.\nMore detail here.')).toBe('Fixed the bug.')
  expect(firstLine('x'.repeat(200), 20)).toBe('x'.repeat(19) + '…')
  expect(firstLine('\n\n')).toBe('')
})

test('startItems marks open steps in progress and stepForPrompt finds them by text', () => {
  let board = addItem(EMPTY, { kind: 'step', text: 'Run the migration', source: 'claude' }, NOW)
  board = addItem(board, { kind: 'ask', text: 'Which DB?', source: 'claude' }, NOW)
  const step = board.items[0]!
  const ask = board.items[1]!
  expect(stepForPrompt(board, 'Do: run the migration ')).toEqual(step)
  expect(stepForPrompt(board, 'Run the migration')).toBeUndefined()
  expect(stepForPrompt(board, 'Do: Which DB?')).toBeUndefined()
  const started = startItems(board, [step.id, ask.id], NOW + 1)
  expect(started.items[0]?.startedAt).toBe(NOW + 1)
  expect(started.items[1]?.startedAt).toBeUndefined()
  expect(isStarted(started.items[0]!)).toBe(true)
  expect(boardText(started)).toContain(`[${step.id}] step (in progress): Run the migration`)
  expect(startItems(started, [step.id], NOW + 9).items[0]?.startedAt).toBe(NOW + 1)
})

test('storeKey is keyed by cwd', () => {
  expect(storeKey('C:\\repo')).toBe('board:C:\\repo')
})

test('asBoard accepts a board and rejects garbage', () => {
  const board = addItem(EMPTY, { kind: 'ask', text: 'a', source: 'claude' }, NOW)
  expect(asBoard(board)).toEqual(board)
  expect(asBoard(undefined)).toBeUndefined()
  expect(asBoard({ items: 'nope' })).toBeUndefined()
  expect(asBoard({ items: [{ id: 1 }] })).toBeUndefined()
  expect(asBoard({ items: [{ ...board.items[0], kind: 'cat' }] })).toBeUndefined()
})
