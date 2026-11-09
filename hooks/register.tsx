import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board, Item, ItemKind, RunningAgent, Usage, UsageCategory } from '../types'
import {
  addItem,
  ageOf,
  asBoard,
  boardText,
  completeItems,
  dogName,
  doneByYou,
  dropItems,
  firstLine,
  isStarted,
  openAsks,
  openSteps,
  prune,
  shipped,
  startItems,
  stepForPrompt,
  storeKey,
  summary,
} from './board'
import { factoryRows } from './scene-ascii'
import { factorySvg, sceneAlt } from './scene-svg'
import type { SceneView } from './scene-svg'

const PANE = 'factory'
const TOOL = 'mcp__dog-factory__track'
const EMPTY: Board = { items: [] }

// Bump the tag when Item's fields change: an older stored value then reads as absent.
const boardAtom = atom({ plugin: 'dog-factory', key: 'board' } as const, EMPTY, { shape: 'board-1' })
const runningAtom = atom({ plugin: 'dog-factory', key: 'running' } as const, [] as RunningAgent[])
const foremanAtom = atom({ plugin: 'dog-factory', key: 'isForemanBusy' } as const, false)
const frameAtom = atom({ plugin: 'dog-factory', key: 'frame' } as const, 0)
const usageAtom = atom({ plugin: 'dog-factory', key: 'usage' } as const, null as Usage | null)

type Measured = {
  context: {
    window: number
    tokens?: number
    percent?: number
    breakdown?: {
      categories: { name: string; tokens: number; isDeferred: boolean }[]
      rawMaxTokens: number
      autoCompactThreshold?: number
      memoryFiles: unknown[]
      mcpTools: unknown[]
    }
  }
  rateLimits: { kind: string; percentUsed: number }[]
  cost?: { usd: number }
}

function usageOf(m: Measured, previous: Usage | null): Usage {
  const usage: Usage = { window: m.context.window }
  if (m.context.tokens !== undefined) usage.tokens = m.context.tokens
  if (m.context.percent !== undefined) usage.percent = m.context.percent
  const five = m.rateLimits.find(r => r.kind === 'five_hour')
  const seven = m.rateLimits.find(r => r.kind === 'seven_day')
  if (five) usage.fiveHour = five.percentUsed
  if (seven) usage.sevenDay = seven.percentUsed
  if (m.cost) usage.usd = m.cost.usd
  const b = m.context.breakdown
  if (b) {
    usage.categories = b.categories.map(c => ({ name: c.name, tokens: c.tokens, isDeferred: c.isDeferred }))
    usage.compactWindow = b.rawMaxTokens
    if (b.autoCompactThreshold !== undefined) usage.autoCompactAt = b.autoCompactThreshold
    usage.memoryFiles = b.memoryFiles.length
    usage.mcpTools = b.mcpTools.length
  } else if (previous?.categories) {
    // A measurement without a breakdown keeps the last one.
    usage.categories = previous.categories
    if (previous.compactWindow !== undefined) usage.compactWindow = previous.compactWindow
    if (previous.autoCompactAt !== undefined) usage.autoCompactAt = previous.autoCompactAt
    if (previous.memoryFiles !== undefined) usage.memoryFiles = previous.memoryFiles
    if (previous.mcpTools !== undefined) usage.mcpTools = previous.mcpTools
  }
  return usage
}

function thousands(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

function percentOf(usage: Usage): number | undefined {
  return usage.percent ?? (usage.tokens !== undefined ? Math.round((usage.tokens / usage.window) * 100) : undefined)
}

function bar(fraction: number, cells: number): string {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * cells)
  return '▰'.repeat(filled) + '▱'.repeat(cells - filled)
}

function usageLine(usage: Usage | null): string {
  if (usage === null) return 'Context: not measured yet'
  const pct = percentOf(usage)
  const parts = [`Context ${pct === undefined ? '--' : `${pct}%`} ${bar((pct ?? 0) / 100, 10)}`]
  if (usage.tokens !== undefined) parts.push(`${thousands(usage.tokens)} of ${thousands(usage.window)}`)
  if (usage.autoCompactAt !== undefined) parts.push(`compacts at ${thousands(usage.autoCompactAt)}`)
  return parts.join(' · ')
}

function limitsLine(usage: Usage | null): string | undefined {
  if (usage === null) return undefined
  const parts: string[] = []
  if (usage.fiveHour !== undefined) parts.push(`5h window ${usage.fiveHour}%`)
  if (usage.sevenDay !== undefined) parts.push(`7d window ${usage.sevenDay}%`)
  if (usage.usd !== undefined) parts.push(`$${usage.usd.toFixed(2)} this session`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** The breakdown rows: name, tokens, share of the window; zero rows left out. */
function categoryRows(usage: Usage | null): { name: string; tokens: string; share: string; bar: string; isDeferred: boolean }[] {
  if (usage === null || !usage.categories) return []
  const window = usage.compactWindow ?? usage.window
  return usage.categories
    .filter((c: UsageCategory) => c.tokens > 0)
    .map(c => ({
      name: c.name,
      tokens: thousands(c.tokens),
      share: `${Math.round((c.tokens / window) * 100)}%`,
      bar: bar(c.tokens / window, 12),
      isDeferred: c.isDeferred,
    }))
}

/**
 * Reads the session's usage with the per-category breakdown (a local estimate,
 * no request). Given `figures` (a measurement just pushed), those win and only
 * the breakdown is merged in.
 */
async function measure($: Dollar, figures?: Measured): Promise<void> {
  try {
    const previous = await read($, usageAtom)
    const detailed = await $.session.usage({ breakdown: 'summary' })
    const source: Measured =
      figures === undefined
        ? detailed
        : { ...figures, context: { ...figures.context, ...(detailed.context.breakdown ? { breakdown: detailed.context.breakdown } : {}) } }
    await update($, usageAtom, () => usageOf(source, previous))
  } catch (error) {
    $.ui.log(`dog-factory: could not read usage: ${String(error)}`, { to: 'debug' })
    if (figures !== undefined) {
      const previous = await read($, usageAtom)
      await update($, usageAtom, () => usageOf(figures, previous))
    }
  }
}

const INSTRUCTIONS = `# Dog Factory board
A pane beside the chat tracks this project's open asks, next steps and agent work for the user. Keep it current with the ${TOOL} tool:
- When you ask the user a question or need their decision, add { "kind": "ask", "text": <the question, one short line> }.
- When you name follow-up work you are not doing in this turn, add { "kind": "step", "text": <the work, one short line> }.
- When the user answers an ask, or a step gets finished, pass its id in "done". Pass ids in "drop" for items that no longer matter.
- Do not add items for work you are doing right now; subagent work is captured automatically.
- A step marked "(in progress)" was sent to you from the pane ("Do: <step>"): when you finish it, pass its id in "done".
Call it once near the end of a turn with everything that changed, not once per item.`

const USAGE = 'Usage: /factory  |  /factory add ask <text>  |  /factory add step <text>  |  /factory clear'

type Dollar = EngineInterface

let cwd = ''

async function setBoard($: Dollar, change: (board: Board, now: number) => Board): Promise<Board> {
  const now = await $.clock.now()
  const next = await update($, boardAtom, board => prune(change(board, now), now))
  try {
    await $.store.set(storeKey(cwd), next)
  } catch (error) {
    $.ui.log(`dog-factory: could not save the board: ${String(error)}`, { to: 'debug' })
  }
  $.ui.status(summary(next))
  return next
}

type AddInput = { kind: 'ask' | 'step'; text: string }

function parseAdds(value: unknown): AddInput[] | string {
  if (value === undefined) return []
  if (!Array.isArray(value)) return '"add" must be a list of { kind, text }'
  const out: AddInput[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return 'each "add" entry must be { kind, text }'
    const { kind, text } = entry as Record<string, unknown>
    if (kind !== 'ask' && kind !== 'step') return `"kind" must be "ask" or "step", got ${JSON.stringify(kind)}`
    if (typeof text !== 'string' || text.trim() === '') return '"text" must be a non-empty string'
    out.push({ kind, text: text.trim() })
  }
  return out
}

function parseIds(value: unknown, field: string): string[] | string {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) return `"${field}" must be a list of ids`
  return value as string[]
}

function sceneOf(board: Board, running: RunningAgent[], isForemanBusy: boolean, usage: Usage | null): SceneView {
  const view: SceneView = {
    asks: openAsks(board).length,
    steps: openSteps(board).length,
    shipped: shipped(board).length,
    workers: running.map(r => ({ dog: r.dog, description: r.description })),
    isForemanBusy,
  }
  const pct = usage?.percent ?? (usage?.tokens !== undefined ? (usage.tokens / usage.window) * 100 : undefined)
  if (pct !== undefined) view.contextPercent = pct
  const active = openSteps(board)
    .map((item, i) => (isStarted(item) ? i : -1))
    .filter(i => i >= 0)
  if (active.length > 0) view.activeSteps = active
  return view
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    const now = await $.clock.now()
    try {
      const stored = asBoard(await $.store.get(storeKey(cwd)))
      await update($, boardAtom, () => prune(stored ?? EMPTY, now))
    } catch (error) {
      $.ui.log(`dog-factory: could not load the board: ${String(error)}`, { to: 'debug' })
    }
    await update($, runningAtom, () => [])
    await update($, foremanAtom, () => false)
    await measure($)

    await $.tool.register({
      name: 'track',
      description:
        'Record the work board shown in the Dog Factory pane: add open asks (questions waiting on the user) and next steps, mark items done, or drop them. Returns the board with item ids.',
      inputSchema: {
        type: 'object',
        properties: {
          add: {
            type: 'array',
            description: 'Items to add.',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['ask', 'step'], description: 'ask: waiting on the user. step: follow-up work.' },
                text: { type: 'string', description: 'One short line.' },
              },
              required: ['kind', 'text'],
            },
          },
          done: { type: 'array', items: { type: 'string' }, description: 'Ids of items now finished or answered.' },
          drop: { type: 'array', items: { type: 'string' }, description: 'Ids of items that no longer matter.' },
        },
      },
      isDeferred: false,
    })
    await $.command.register({ name: 'factory', description: 'Open the Dog Factory pane; add ask|step <text>; clear' })

    if (e.isInteractive && e.surface !== null) {
      void $.ui.open({ id: PANE, title: 'Dog Factory' })
    }
    $.ui.status(summary(await read($, boardAtom)))

    if (e.surface === 'terminal') {
      $.clock.every(500, async () => {
        const board = await read($, boardAtom)
        const running = await read($, runningAtom)
        const isBusy = await read($, foremanAtom)
        const isMoving = isBusy || running.length > 0 || openAsks(board).length > 0 || openSteps(board).length > 0
        if (isMoving) await update($, frameAtom, f => (f + 1) % 4)
      })
    }

    return next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const adds = parseAdds(e.add)
    if (typeof adds === 'string') return { result: `track: ${adds}. Nothing changed.` }
    const done = parseIds(e.done, 'done')
    if (typeof done === 'string') return { result: `track: ${done}. Nothing changed.` }
    const drop = parseIds(e.drop, 'drop')
    if (typeof drop === 'string') return { result: `track: ${drop}. Nothing changed.` }

    let unknown: string[] = []
    const board = await setBoard($, (b, now) => {
      let out = b
      for (const add of adds) out = addItem(out, { kind: add.kind, text: add.text, source: 'claude' }, now)
      const completed = completeItems(out, done, now)
      const dropped = dropItems(completed.board, drop)
      unknown = [...completed.unknown, ...dropped.unknown]
      return dropped.board
    })
    const lines = [`Board now:`, boardText(board)]
    if (unknown.length > 0) lines.push(`unknown ids ignored: ${unknown.join(', ')}`)
    return { result: lines.join('\n') }
  }).catch(() => ({ result: 'track: the board could not be updated this time. Nothing changed; try again.' }))

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (spawned.deny === undefined && spawned.agentId !== undefined) {
      const agentId = spawned.agentId
      const now = await $.clock.now()
      const worker: RunningAgent = { agentId, dog: dogName(agentId), description: e.description, startedAt: now }
      await update($, runningAtom, list => [...list.filter(r => r.agentId !== agentId), worker])
    }
    return spawned
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    const step = stepForPrompt(await read($, boardAtom), e.text)
    if (step !== undefined && !isStarted(step)) await setBoard($, (b, now) => startItems(b, [step.id], now))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    // The event carries the figures; the breakdown is fetched and merged in.
    await measure($, e)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, foremanAtom, () => true)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, foremanAtom, () => false)
      return next(e)
    }
    const agentId = e.agentId
    const running = await read($, runningAtom)
    const worker = running.find(r => r.agentId === agentId)
    await update($, runningAtom, list => list.filter(r => r.agentId !== agentId))
    const dog = worker?.dog ?? dogName(agentId)
    const description = worker?.description || 'agent task'
    const detail = firstLine(e.answer) || (e.isAborted ? 'interrupted' : 'no report')
    await setBoard($, (b, now) =>
      addItem(b, { kind: 'agent', text: description, source: 'agent', detail, durationMs: e.durationMs, dog, doneAt: now }, now),
    )
    $.ui.toast(`${dog} shipped: ${description}`)
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const board = await read($, boardAtom)
    return {
      sections: [
        ...composed.sections,
        { id: 'dog-factory:board', text: `${INSTRUCTIONS}\n\nOpen items now:\n${boardText(board)}`, scope: 'session' },
      ],
    }
  })

  on('command.run', { command: 'factory' }, async ($, e) => {
    const args = e.args.trim()
    if (args === '') {
      const opened = await $.ui.open({ id: PANE, title: 'Dog Factory', focus: true })
      return { text: opened.isPlaced ? 'Dog Factory opened.' : `Dog Factory could not open: ${opened.reason}` }
    }
    if (args === 'clear') {
      let removed = 0
      await setBoard($, b => {
        const kept = b.items.filter(i => i.doneAt === undefined)
        removed = b.items.length - kept.length
        return { items: kept }
      })
      return { text: `Cleared ${removed} finished row${removed === 1 ? '' : 's'}.` }
    }
    const added = /^add\s+(ask|step)\s+(\S[\s\S]*)$/.exec(args)
    if (added) {
      const kind = added[1] as ItemKind
      const text = added[2]!.trim()
      await setBoard($, (b, now) => addItem(b, { kind, text, source: 'you' }, now))
      return { text: `Added ${kind}: ${text}` }
    }
    return { text: USAGE }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const board = await read($, boardAtom)
    const running = await read($, runningAtom)
    const isBusy = await read($, foremanAtom)
    const usage = await read($, usageAtom)
    const now = await $.clock.now()
    const view = sceneOf(board, running, isBusy, usage)
    const columns = e.props.bodyColumns

    let scene
    if (e.surface === 'terminal') {
      const frame = await read($, frameAtom)
      scene = (
        <Box flexDirection="column">
          {factoryRows(view, frame, columns).map(row => (
            <Text>{row}</Text>
          ))}
        </Box>
      )
    } else {
      const { Svg } = $.ui.resolve(e)
      scene = <Svg source={factorySvg(view)} alt={sceneAlt(view)} isInteractive />
    }

    const asks = openAsks(board)
    const steps = openSteps(board)
    const finished = doneByYou(board).slice(-3)
    const boxes = shipped(board).slice(-8).reverse()

    const complete = (item: Item) => () => {
      void setBoard($, (b, at) => completeItems(b, [item.id], at).board)
    }
    const drop = (item: Item) => () => {
      void setBoard($, b => dropItems(b, [item.id]).board)
    }
    const toPrompt = (item: Item) => () => {
      void (async () => {
        const filled = await $.prompt.fill({ text: `Do: ${item.text}`, mode: 'replace' })
        if (filled.isFilled) await setBoard($, (b, at) => startItems(b, [item.id], at))
        else $.ui.toast(`Could not fill the prompt${filled.refusal ? ` (${filled.refusal})` : ''}.`)
      })()
    }

    const pct = view.contextPercent
    const usageColor = pct === undefined ? undefined : pct >= 85 ? '#c94f3d' : pct >= 60 ? '#e0a040' : undefined
    const rows = categoryRows(usage)
    const limits = limitsLine(usage)
    const nameWidth = Math.max(8, ...rows.map(r => r.name.length))
    const tokenWidth = Math.max(4, ...rows.map(r => r.tokens.length))
    const isNarrow = columns < 56

    return (
      <Box flexDirection="column">
        {scene}
        <Text weight="semibold" color={usageColor}>
          {usageLine(usage)}
        </Text>
        {rows.map(r => (
          <Box key={`ctx:${r.name}`} gap={1}>
            <Text dimColor={r.isDeferred} mono>
              {r.name.padEnd(nameWidth)}
            </Text>
            <Text mono tabular>
              {r.tokens.padStart(tokenWidth)}
            </Text>
            <Text dimColor mono tabular>
              {r.share.padStart(4)}
            </Text>
            {!isNarrow && <Text dimColor>{r.bar}</Text>}
            {r.isDeferred && <Text dimColor>on demand</Text>}
          </Box>
        ))}
        {(usage?.memoryFiles !== undefined || usage?.mcpTools !== undefined) && (
          <Text dimColor size="footnote">
            {[
              usage.memoryFiles !== undefined ? `${usage.memoryFiles} memory file${usage.memoryFiles === 1 ? '' : 's'}` : '',
              usage.mcpTools !== undefined ? `${usage.mcpTools} MCP tool${usage.mcpTools === 1 ? '' : 's'}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
        {limits && (
          <Text dimColor size="footnote">
            {limits}
          </Text>
        )}

        <Box flexDirection="column" marginTop={1}>
          <Text weight="semibold">Waiting on the boss {asks.length > 0 ? `(${asks.length})` : ''}</Text>
          {asks.length === 0 && <Text dimColor>No one at the door.</Text>}
          {asks.map(item => (
            <Box key={`row:${item.id}`} gap={1} flexWrap="wrap">
              <Text color="#c94f3d">?</Text>
              <Text>{item.text}</Text>
              <Text dimColor>{ageOf(item.createdAt, now)}</Text>
              <Button key={`done:${item.id}`} label="Done" plain onPress={complete(item)} />
              <Button key={`drop:${item.id}`} label="Drop" plain dimColor onPress={drop(item)} />
            </Box>
          ))}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text weight="semibold">On the belt {steps.length > 0 ? `(${steps.length})` : ''}</Text>
          {steps.length === 0 && <Text dimColor>The belt is empty.</Text>}
          {steps.map((item, i) => (
            <Box key={`row:${item.id}`} gap={1} flexWrap="wrap">
              <Text color={isStarted(item) ? '#e0b84a' : '#8c5a2b'}>{isStarted(item) ? `{${i + 1}}` : `[${i + 1}]`}</Text>
              <Text>{item.text}</Text>
              {isStarted(item) ? (
                <Text color="#e0b84a">in progress {ageOf(item.startedAt ?? now, now)}</Text>
              ) : (
                <Text dimColor>{ageOf(item.createdAt, now)}</Text>
              )}
              {!isStarted(item) && <Button key={`go:${item.id}`} label="To prompt" plain onPress={toPrompt(item)} />}
              <Button key={`done:${item.id}`} label="Done" plain onPress={complete(item)} />
              <Button key={`drop:${item.id}`} label="Drop" plain dimColor onPress={drop(item)} />
            </Box>
          ))}
          {finished.map(item => (
            <Box key={`row:${item.id}`} gap={1}>
              <Text dimColor>✓</Text>
              <Text dimColor strikethrough>
                {item.text}
              </Text>
            </Box>
          ))}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text weight="semibold">Shipped {boxes.length > 0 ? `(${shipped(board).length})` : ''}</Text>
          {boxes.length === 0 && <Text dimColor>Nothing shipped yet.</Text>}
          {boxes.map(item => (
            <Box key={`row:${item.id}`} gap={1} flexWrap="wrap">
              <Text color="#c94f3d">▣</Text>
              <Text weight="semibold">{item.dog ?? 'Dog'}</Text>
              <Text>{item.text}</Text>
              <Text dimColor>
                {item.durationMs !== undefined ? `${Math.max(1, Math.round(item.durationMs / 1000))}s` : ''}
              </Text>
              {item.detail && <Text dimColor>{item.detail}</Text>}
            </Box>
          ))}
        </Box>
      </Box>
    )
  })
}
