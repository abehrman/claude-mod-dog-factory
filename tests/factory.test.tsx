import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { dogName } from '../hooks/board'

const PANE = {
  plugin: 'dog-factory',
  component: 'Pane',
  requestId: 'factory',
  props: {
    title: 'Dog Factory',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
const CWD = 'C:/proj'
const NOW = 1_700_000_000_000

function engine(on: On, store: Record<string, unknown> = {}) {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on, store)
  const filled: string[] = []
  on('tool.register', (_, e) => ({ value: { tool: `mcp__dog-factory__${e.name}` } }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', (_, e) => ({
    value: {
      startedAt: NOW,
      context: {
        window: 200_000,
        ...(e.breakdown
          ? {
              breakdown: {
                categories: [
                  { name: 'System prompt', tokens: 12_000, color: 'x', isDeferred: false, kind: 'system' },
                  { name: 'MCP tools', tokens: 61_000, color: 'x', isDeferred: false, kind: 'mcp' },
                  { name: 'Deferred tools', tokens: 9_000, color: 'x', isDeferred: true, kind: 'deferred' },
                  { name: 'Messages', tokens: 0, color: 'x', isDeferred: false, kind: 'messages' },
                  { name: 'Free space', tokens: 127_000, color: 'x', isDeferred: false, kind: 'free' },
                ],
                totalTokens: 73_000,
                maxTokens: 200_000,
                rawMaxTokens: 200_000,
                autocompactSource: 'model',
                percentage: 36,
                gridRows: [],
                model: 'm',
                memoryFiles: [{ path: 'a', tokens: 1 }, { path: 'b', tokens: 2 }],
                mcpTools: [{ name: 't', server: 's', tokens: 3 }],
                agents: [],
                autoCompactThreshold: 160_000,
                isAutoCompactEnabled: true,
                apiUsage: null,
              },
            }
          : {}),
      },
      rateLimits: [],
    },
    // The stub fills only what the mod reads of the breakdown.
  }) as never)
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude.', scope: 'shared' }] }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  return { clock, filled }
}

async function start($: Engine, surface: 'terminal' | 'desktop' = 'desktop') {
  await $.session.start({ cwd: CWD, surface, isInteractive: true })
}

function idsIn(text: string): string[] {
  return [...text.matchAll(/\[([a-z0-9]{4})\]/g)].map(m => m[1]!)
}

test('track adds an ask and every surface shows it', async ($, on) => {
  engine(on)
  await start($)
  const r = await $.tool.call({ tool: 'mcp__dog-factory__track', add: [{ kind: 'ask', text: 'Which database?' }] })
  expect(r.deny).toBeUndefined()
  expect(String(r.result)).toContain('ask: Which database?')
  expect(idsIn(String(r.result))).toHaveLength(1)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'Which database?' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'No one at the door.' })).toBeUndefined()
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /DOG FACTORY/ })).toBeDefined()
    } else {
      const svg = await ui.find({ type: 'Svg' })
      expect(svg).toBeDefined()
      expect(String(svg?.props.source)).toContain('<svg')
    }
    await ui.unmount()
  }
})

test('track reports unknown ids and rejects a bad shape without changing anything', async ($, on) => {
  engine(on)
  await start($)
  const added = await $.tool.call({ tool: 'mcp__dog-factory__track', add: [{ kind: 'step', text: 'Run tests' }] })
  const [id] = idsIn(String(added.result))

  const bad = await $.tool.call({ tool: 'mcp__dog-factory__track', add: [{ kind: 'cat', text: 'meow' }] })
  expect(String(bad.result)).toContain('Nothing changed')

  const done = await $.tool.call({ tool: 'mcp__dog-factory__track', done: [id!, 'zzzz'] })
  expect(String(done.result)).toContain('unknown ids ignored: zzzz')
  expect(String(done.result)).toContain('(nothing open)')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'The belt is empty.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Run tests' })).toBeDefined() // the done-by-you tail
  await ui.unmount()
})

test('a spawned agent works the belt and ships when its turn completes', async ($, on) => {
  engine(on)
  await start($)
  const spawned = await $.agent.spawn({
    tool_use_id: 't1',
    prompt: 'Review the diff for bugs.',
    description: 'Review the diff',
    subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'opus',
    background: false,
    fork: false,
  })
  expect(spawned.deny).toBeUndefined()

  const name = dogName('a1')
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(String((await desk.find({ type: 'Svg' }))?.props.source)).toContain(name)
  expect(String((await desk.find({ type: 'Svg' }))?.props.source)).toContain('Review the diff')
  await desk.unmount()
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: name.slice(0, 8) })).toBeDefined()
  await term.unmount()

  await $.turn.complete({
    answer: 'Found two bugs.\nDetails follow.',
    durationMs: 4200,
    isAborted: false,
    turnId: 'turn-1',
    agentId: 'a1',
    reason: 'answer',
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: name })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Found two bugs.' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '4s' })).toBeDefined()
    await ui.unmount()
  }
})

test('an agent the mod never saw spawn still ships', async ($, on) => {
  engine(on)
  await start($)
  await $.turn.complete({ answer: 'Done.', durationMs: 900, isAborted: false, turnId: 't', agentId: 'ghost-7', reason: 'answer' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: dogName('ghost-7') })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'agent task' })).toBeDefined()
  await ui.unmount()
})

test('the foreman is busy between the main turn start and end', async ($, on) => {
  engine(on)
  await start($)
  await $.turn.start({ text: 'hello', turnId: 'main-1' })
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toContain('typing')
  await ui.unmount()
  await $.turn.complete({ answer: 'hi', durationMs: 10, isAborted: false, turnId: 'main-1', reason: 'answer' })
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toContain('asleep')
  await ui.unmount()
})

test('a stored board comes back; garbage reads as empty', async ($, on) => {
  const item = { id: 'ab12', kind: 'step', text: 'Ship v2', createdAt: NOW - 1000, source: 'claude' }
  engine(on, { [`board:${CWD}`]: { items: [item] } })
  await start($)
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Ship v2' })).toBeDefined()
  await ui.unmount()
})

test('garbage in the store reads as an empty board', async ($, on) => {
  engine(on, { [`board:${CWD}`]: { items: 'nope' } })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'The belt is empty.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'No one at the door.' })).toBeDefined()
  await ui.unmount()
})

test('the system prompt carries the board section', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'mcp__dog-factory__track', add: [{ kind: 'step', text: 'Write docs' }] })
  const composed = await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: ['desktop'], tools: [], outputStyle: null, traits: [] })
  const ids = composed.sections.map(s => s.id)
  expect(ids).toEqual(['intro', 'dog-factory:board'])
  const section = composed.sections[1]!
  expect(section.scope).toBe('session')
  expect(section.text).toContain('mcp__dog-factory__track')
  expect(section.text).toContain('step: Write docs')
})

test('/factory answers usage, adds by hand and clears finished rows', async ($, on) => {
  engine(on)
  await start($)
  const run = (args: string) =>
    $.command.run({ command: 'factory', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })

  expect((await run('add')).text).toContain('Usage')
  expect((await run('add ask')).text).toContain('Usage')
  expect((await run('bogus')).text).toContain('Usage')
  expect((await run('add step  Call the vendor ')).text).toBe('Added step: Call the vendor')
  expect((await run('')).text).toBe('Dog Factory opened.')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const [id] = idsIn(String((await $.tool.call({ tool: 'mcp__dog-factory__track' })).result))
  await ui.press({ key: `done:${id}` })
  expect(await ui.find({ key: `done:${id}` })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Call the vendor' })).toBeDefined()
  expect((await run('clear')).text).toBe('Cleared 1 finished row.')
  expect(await ui.find({ type: 'Text', text: 'Call the vendor' })).toBeUndefined()
  await ui.unmount()
})

test('buttons complete, drop and send a step to the prompt', async ($, on) => {
  const { filled } = engine(on)
  await start($)
  const r = await $.tool.call({
    tool: 'mcp__dog-factory__track',
    add: [
      { kind: 'ask', text: 'Keep the old API?' },
      { kind: 'step', text: 'Run the migration' },
      { kind: 'step', text: 'Tell the team' },
    ],
  })
  const [askId, stepId, otherId] = idsIn(String(r.result))

  const first = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await first.press({ key: `go:${stepId}` })
  expect(filled.at(-1)).toBe('Do: Run the migration')
  // The step is now in progress: its row says so, its To prompt button is gone, its crate is marked.
  expect(await first.find({ type: 'Text', text: /in progress/ })).toBeDefined()
  expect(await first.find({ key: `go:${stepId}` })).toBeUndefined()
  expect(await first.find({ key: `done:${stepId}` })).toBeDefined()
  expect(await first.find({ type: 'Text', text: /\{1\}/ })).toBeDefined()
  await first.unmount()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('crate-active')
  const board = String((await $.tool.call({ tool: 'mcp__dog-factory__track' })).result)
  expect(board).toContain(`[${stepId}] step (in progress): Run the migration`)

  // Typing the prompt by hand marks the other step too.
  await $.prompt.submit({ text: 'Do: Tell the team', wait: false, origin: { kind: 'composer' } })
  expect(await ui.findAll({ type: 'Text', text: /in progress/ })).toHaveLength(2)

  await ui.press({ key: `done:${askId}` })
  expect(await ui.find({ type: 'Text', text: 'No one at the door.' })).toBeDefined()
  await ui.press({ key: `drop:${otherId}` })
  expect(await ui.find({ type: 'Text', text: 'Tell the team' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Run the migration' })).toBeDefined()
  await ui.unmount()
})

test('a narrow pane with long text still draws', async ($, on) => {
  engine(on)
  await start($)
  const long = 'Investigate why the nightly build on the ARM runners fails only when the cache is warm and the lockfile changed'.repeat(1)
  await $.tool.call({ tool: 'mcp__dog-factory__track', add: [{ kind: 'step', text: long }] })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface, props: { ...PANE.props, bodyColumns: 30 } })
    expect(await ui.find({ type: 'Text', text: /ARM runners/ })).toBeDefined()
    await ui.unmount()
  }
})

test('context usage shows under the scene and follows each measurement', async ($, on) => {
  engine(on)
  await start($)
  const fresh = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await fresh.find({ type: 'Text', text: /^Context/ }))?.text).toBe('Context -- ▱▱▱▱▱▱▱▱▱▱ · compacts at 160k')
  // The breakdown rows, zero rows left out, deferred rows marked.
  expect(await fresh.find({ type: 'Text', text: /System prompt/ })).toBeDefined()
  expect(await fresh.find({ type: 'Text', text: /MCP tools\s*$/ })).toBeDefined()
  expect(await fresh.find({ type: 'Text', text: /^Messages/ })).toBeUndefined()
  expect(await fresh.find({ type: 'Text', text: 'on demand' })).toBeDefined()
  expect(await fresh.find({ type: 'Text', text: '2 memory files · 1 MCP tool' })).toBeDefined()
  expect((await fresh.findAll({ type: 'Text', text: '61k' })).length).toBeGreaterThan(0)
  await fresh.unmount()

  await $.session.measure({
    context: { window: 200_000, tokens: 68_000, percent: 34 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 12 },
      { kind: 'seven_day', percentUsed: 40.5 },
    ],
    cost: { usd: 1.234 },
    changed: ['context', 'rateLimits', 'cost'],
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^Context/ }))?.text).toBe('Context 34% ▰▰▰▱▱▱▱▱▱▱ · 68k of 200k · compacts at 160k')
    expect(await ui.find({ type: 'Text', text: '5h window 12% · 7d window 40.5% · $1.23 this session' })).toBeDefined()
    if (surface === 'desktop') {
      const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
      expect(svg).toContain('CONTEXT')
      expect(svg).toContain('>34%<')
    } else {
      expect(await ui.find({ type: 'Text', text: /ctx 34%/ })).toBeDefined()
    }
    await ui.unmount()
  }
})

test('the terminal ticker advances frames only while something moves', async ($, on) => {
  const { clock } = engine(on)
  await start($, 'terminal')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const before = (await ui.drawn()) as unknown
  await clock.advance(1000)
  expect(await ui.drawn()).toEqual(before)

  await $.tool.call({ tool: 'mcp__dog-factory__track', add: [{ kind: 'step', text: 'Move' }] })
  const belt = (await ui.findAll({ type: 'Text' })).map(t => t.text)
  await clock.advance(500)
  const later = (await ui.findAll({ type: 'Text' })).map(t => t.text)
  expect(later).not.toEqual(belt)
  await ui.unmount()
})
