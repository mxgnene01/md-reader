import test from 'node:test'
import assert from 'node:assert/strict'

const loadSideWidth = () => import('../src/core/side-width.ts')

test('falls back to the default width for missing or unusable values', async () => {
  const { DEFAULT_SIDE_WIDTH, resolveSideWidth } = await loadSideWidth()

  assert.equal(resolveSideWidth(undefined), DEFAULT_SIDE_WIDTH)
  assert.equal(resolveSideWidth(Number.NaN), DEFAULT_SIDE_WIDTH)
  assert.equal(resolveSideWidth(Number.POSITIVE_INFINITY), DEFAULT_SIDE_WIDTH)
})

test('keeps a stored width inside the supported bounds', async () => {
  const { MAX_SIDE_WIDTH, MIN_SIDE_WIDTH, resolveSideWidth } =
    await loadSideWidth()

  assert.equal(resolveSideWidth(320), 320)
  assert.equal(resolveSideWidth(MIN_SIDE_WIDTH - 50), MIN_SIDE_WIDTH)
  assert.equal(resolveSideWidth(MAX_SIDE_WIDTH + 500), MAX_SIDE_WIDTH)
})

test('rounds fractional widths', async () => {
  const { resolveSideWidth } = await loadSideWidth()

  assert.equal(resolveSideWidth(317.6), 318)
})

test('leaves room for the article in a narrow window', async () => {
  const { MIN_SIDE_WIDTH, clampSideWidthForViewport } = await loadSideWidth()

  assert.equal(clampSideWidthForViewport(600, 1600), 600)
  assert.equal(clampSideWidthForViewport(600, 800), 440)
  // Never squeeze below the minimum even when the window is tiny.
  assert.equal(clampSideWidthForViewport(600, 400), MIN_SIDE_WIDTH)
})

test('does not widen the sidebar when the window grows again', async () => {
  const { clampSideWidthForViewport } = await loadSideWidth()

  assert.equal(clampSideWidthForViewport(320, 2000), 320)
})
