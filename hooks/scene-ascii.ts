import { VISUAL_CAP } from './board'
import type { SceneView } from './scene-svg'

const HAMMER = ['/', '-', '\\', '-'] as const
const BELT = '░▒▓' as const
const ZZZ = ['z', 'zZ', 'zZz', ''] as const
const TAIL = ['~', '-', '~', '-'] as const

function fit(text: string, width: number): string {
  const chars = Array.from(text)
  if (chars.length >= width) return chars.slice(0, width).join('')
  return text + ' '.repeat(width - chars.length)
}

function right(text: string, width: number): string {
  const chars = Array.from(text)
  if (chars.length >= width) return chars.slice(0, width).join('')
  return ' '.repeat(width - chars.length) + text
}

function join(cells: string[], widths: number[]): string {
  return cells.map((c, i) => fit(c, widths[i] ?? 0)).join('')
}

/**
 * Six rows of a factory floor: foreman desk (left), belt with worker dogs and
 * crates (middle), the boss's door with waiting dogs (right).
 */
export function factoryRows(view: SceneView, frame: number, columns: number): string[] {
  const f = ((frame % 4) + 4) % 4
  const width = Math.max(20, columns)
  const isIdle = view.asks === 0 && view.steps === 0 && view.workers.length === 0

  const shippedTag = view.shipped > 0 ? `shipped: ${'▣'.repeat(Math.min(view.shipped, VISUAL_CAP))}${view.shipped > VISUAL_CAP ? ` +${view.shipped - VISUAL_CAP}` : ''}` : ''
  const header = fit(' DOG FACTORY', Math.max(0, width - Array.from(shippedTag).length - 1)) + shippedTag + ' '

  const foremanRows = view.isForemanBusy
    ? ['  ∩∩     ', ` (•ᴥ•)${TAIL[f]}⌨ `, ' ═══╧═══ ', ' FOREMAN ']
    : [`  ∩∩ ${fit(ZZZ[f]!, 3)}`, ' (-ᴥ-)   ', ' ═══╧═══ ', ' FOREMAN ']

  if (isIdle) {
    const quiet = [
      '',
      right('┌────┐', width - 9 - 1) + ' ',
      fit('       (-ᴥ-)' + ZZZ[f], width - 9 - 10) + right('│BOSS│', 10),
      fit('   ╲____╱  all quiet on the floor', width - 9 - 10) + right('│    │', 10),
      fit('', width - 9 - 10) + right('└────┘', 10),
    ]
    return [
      fit(header, width),
      join([foremanRows[0]!, quiet[1]!], [9, width - 9]),
      join([foremanRows[1]!, quiet[2]!], [9, width - 9]),
      join([foremanRows[2]!, quiet[3]!], [9, width - 9]),
      join([foremanRows[3]!, quiet[4]!], [9, width - 9]),
      fit(` ${view.contextPercent !== undefined ? `ctx ${Math.round(view.contextPercent)}% · ` : ''}${view.shipped} shipped · nothing waiting`, width),
    ]
  }

  const doorWidth = width >= 44 ? 12 : 0
  const midWidth = width - 9 - doorWidth

  // Workers above the belt.
  const shownWorkers = view.workers.slice(0, VISUAL_CAP)
  let heads = ''
  let bodies = ''
  let names = ''
  shownWorkers.forEach((w, i) => {
    const h = HAMMER[(f + i) % 4]!
    heads += fit(' ∩∩', 9)
    bodies += fit(`(•ᴥ•)${h}`, 9)
    names += fit(w.dog.slice(0, 8), 9)
  })
  if (view.workers.length > VISUAL_CAP) names += `+${view.workers.length - VISUAL_CAP}`

  // The belt with crates.
  const beltLen = Math.max(0, midWidth - 1)
  let belt = ''
  for (let i = 0; i < beltLen; i++) belt += BELT[(i + f) % 3]
  const shownCrates = Math.min(view.steps, VISUAL_CAP)
  const beltChars = Array.from(belt)
  for (let i = 0; i < shownCrates; i++) {
    const at = 1 + i * 4
    const label = view.activeSteps?.includes(i) ? `{${i + 1}}` : `[${i + 1}]`
    for (let k = 0; k < 3 && at + k < beltChars.length; k++) beltChars[at + k] = label[k]!
  }
  let beltRow = beltChars.join('')
  if (view.steps > VISUAL_CAP) {
    const tag = `+${view.steps - VISUAL_CAP}`
    beltRow = fit(beltRow, Math.max(0, beltLen - tag.length)) + tag
  }

  // The boss's door with waiting dogs.
  const waiting = Math.min(view.asks, VISUAL_CAP)
  const doorRows =
    doorWidth > 0
      ? [
          right('┌────┐', doorWidth),
          right(`${view.asks > 0 ? '?' : ' '} │BOSS│`, doorWidth),
          right(`${view.asks > 0 ? `(•ᴥ•)${TAIL[f]}` : '      '}│    │`, doorWidth),
          right(`${view.asks > 0 ? `wait ${view.asks}` : ''}└────┘`, doorWidth),
        ]
      : ['', '', '', '']
  void waiting

  const status = [
    view.contextPercent !== undefined ? `ctx ${Math.round(view.contextPercent)}%` : '',
    view.steps > 0 ? `${view.steps} on the belt` : '',
    view.asks > 0 ? `${view.asks} waiting on you` : '',
    view.workers.length > 0 ? `${view.workers.length} dog${view.workers.length === 1 ? '' : 's'} working` : '',
    view.shipped > 0 ? `${view.shipped} shipped` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return [
    fit(header, width),
    join([foremanRows[0]!, heads, doorRows[0]!], [9, midWidth, doorWidth]),
    join([foremanRows[1]!, bodies, doorRows[1]!], [9, midWidth, doorWidth]),
    join([foremanRows[2]!, beltRow, doorRows[2]!], [9, midWidth, doorWidth]),
    join([foremanRows[3]!, names, doorRows[3]!], [9, midWidth, doorWidth]),
    fit(` ${status}`, width),
  ]
}
