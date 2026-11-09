import { expect, test } from 'claude-code/testing'

import { factoryRows } from '../hooks/scene-ascii'
import { factorySvg, sceneAlt } from '../hooks/scene-svg'
import type { SceneView } from '../hooks/scene-svg'

const BUSY: SceneView = {
  asks: 2,
  steps: 3,
  shipped: 1,
  workers: [{ dog: 'Biscuit', description: 'Review the diff' }, { dog: 'Pepper' }],
  isForemanBusy: true,
}
const IDLE: SceneView = { asks: 0, steps: 0, shipped: 0, workers: [], isForemanBusy: false }

test('the SVG scene is a bounded animated document', () => {
  const svg = factorySvg(BUSY)
  expect(svg).toStartWith('<svg')
  expect(svg).toEndWith('</svg>')
  expect(svg.length).toBeLessThan(131072)
  expect(svg).toContain('animateTransform')
  expect(svg).toContain('Biscuit')
  expect(svg).toContain('Pepper')
  expect(svg).toContain('Review the diff')
  expect(svg).not.toContain('id="basket"')
})

test('the SVG caps crowds with a +N tag', () => {
  const svg = factorySvg({ ...BUSY, asks: 7, steps: 9, shipped: 12, workers: Array.from({ length: 6 }, (_, i) => ({ dog: `D${i}` })) })
  expect(svg).toContain('>+2<')
  expect(svg).toContain('>+4<')
  expect(svg).toContain('>+7<')
  expect(svg).toContain('>+1<')
  expect(svg.length).toBeLessThan(131072)
})

test('the wall gauge shows the context fill', () => {
  const svg = factorySvg({ ...BUSY, contextPercent: 72 })
  expect(svg).toContain('CONTEXT')
  expect(svg).toContain('>72%<')
  expect(svg).toContain('Context window 72% full')
  expect(factorySvg(BUSY)).toContain('>--<')
  expect(svg).toContain('width="400" height="180"')
})

test('steps in progress light up their crates', () => {
  const svg = factorySvg({ ...BUSY, activeSteps: [1] })
  expect(svg).toContain('crate-active')
  expect(factorySvg(BUSY)).not.toContain('crate-active')
  expect(factoryRows({ ...BUSY, activeSteps: [1] }, 0, 80)[3]).toContain('{2}')
})

test('an empty board shows the basket and dims the lights', () => {
  const svg = factorySvg(IDLE)
  expect(svg).toContain('id="basket"')
  expect(svg).toContain('opacity="0.28"')
  expect(sceneAlt(IDLE)).toContain('asleep')
  expect(sceneAlt(BUSY)).toContain('typing')
})

test('the terminal scene is six rows that fit the width', () => {
  for (const columns of [30, 44, 80]) {
    for (const frame of [0, 1, 2, 3]) {
      for (const view of [BUSY, IDLE]) {
        const rows = factoryRows(view, frame, columns)
        expect(rows).toHaveLength(6)
        for (const row of rows) expect(Array.from(row).length).toBeLessThanOrEqual(columns)
      }
    }
  }
  const wide = factoryRows(BUSY, 0, 80).join('\n')
  expect(wide).toContain('DOG FACTORY')
  expect(wide).toContain('Biscuit')
  expect(wide).toContain('[1]')
  expect(wide).toContain('BOSS')
  expect(factoryRows(IDLE, 0, 80).join('\n')).toContain('all quiet')
})

test('terminal frames differ so the belt moves', () => {
  expect(factoryRows(BUSY, 0, 80)[3]).not.toBe(factoryRows(BUSY, 1, 80)[3])
})
