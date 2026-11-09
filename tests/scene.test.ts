import { expect, test } from 'claude-code/testing'

import { factoryRows } from '../hooks/scene-ascii'
import { factoryStrips, factorySvg, sceneAlt, stripAlts } from '../hooks/scene-svg'
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
  const svg = factorySvg({ ...BUSY, asks: 7, steps: 9, shipped: 12, workers: Array.from({ length: 8 }, (_, i) => ({ dog: `D${i}` })) })
  expect(svg).toContain('>+2 more<') // asks past 5
  expect(svg).toContain('>+3<') // crates past 6
  expect(svg).toContain('>+2<') // shelf past 10, workers past 6
  expect(svg.length).toBeLessThan(131072)
  const roomy = factorySvg({ ...BUSY, steps: 6, shipped: 10, workers: Array.from({ length: 6 }, (_, i) => ({ dog: `D${i}` })) })
  expect(roomy).not.toMatch(/>\+\d/)
})

test('the wall gauge shows the context fill', () => {
  const svg = factorySvg({ ...BUSY, contextPercent: 72 })
  expect(svg).toContain('CONTEXT')
  expect(svg).toContain('>72%<')
  expect(svg).toContain('Context window 72% full')
  expect(factorySvg(BUSY)).toContain('>--<')
  expect(svg).toContain('viewBox="0 0 400 320"')
  expect(svg).toContain('width="1200" height="960"')
})

test('the scene splits into three full-width floor strips', () => {
  const strips = factoryStrips({ ...BUSY, contextPercent: 40, activeSteps: [0], shippedNames: ['Mochi'] })
  expect(strips.office).toContain('viewBox="0 0 400 124"')
  expect(strips.floor).toContain('viewBox="0 124 400 112"')
  expect(strips.dock).toContain('viewBox="0 236 400 84"')
  for (const s of [strips.office, strips.floor, strips.dock]) {
    expect(s).toStartWith('<svg')
    expect(s.length).toBeLessThan(131072)
  }
  expect(strips.office).toContain('CONTEXT')
  expect(strips.floor).toContain('Biscuit')
  expect(strips.floor).toContain('crate-active')
  expect(strips.dock).toContain('Mochi')
  expect(strips.dock).toContain('1 SHIPPED')
  const alts = stripAlts(BUSY)
  expect(alts.office).toContain('typing')
  expect(alts.floor).toContain('2 worker dogs')
  expect(alts.dock).toContain('1 box shipped')
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
