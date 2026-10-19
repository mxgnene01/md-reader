import test from 'node:test'
import assert from 'node:assert/strict'

const loadHiddenItems = () => import('../src/core/hidden-items.ts')

test('splits the setting on the pipe and trims each entry', async () => {
  const { parseHiddenItemPatterns } = await loadHiddenItems()

  assert.deepEqual(parseHiddenItemPatterns(' .DS_Store | *.pyc |.gitkeep| '), [
    '.DS_Store',
    '*.pyc',
    '.gitkeep',
  ])
})

test('drops duplicates without regard to case', async () => {
  const { parseHiddenItemPatterns } = await loadHiddenItems()

  assert.deepEqual(parseHiddenItemPatterns('*.pyc|*.PYC|*.pyc'), ['*.pyc'])
})

test('falls back to the built-in defaults when nothing is configured', async () => {
  const { createHiddenItemMatcher, DEFAULT_HIDDEN_ITEMS } =
    await loadHiddenItems()
  const isHidden = createHiddenItemMatcher(undefined)

  assert.equal(DEFAULT_HIDDEN_ITEMS.includes('.DS_Store'), true)
  assert.equal(isHidden('.DS_Store'), true)
  assert.equal(isHidden('.gitkeep'), true)
  assert.equal(isHidden('cached.pyc'), true)
  assert.equal(isHidden('__pycache__'), true)
  assert.equal(isHidden('note.md'), false)
})

test('an explicitly empty setting hides nothing', async () => {
  const { createHiddenItemMatcher } = await loadHiddenItems()
  const isHidden = createHiddenItemMatcher('   ')

  assert.equal(isHidden('.DS_Store'), false)
  assert.equal(isHidden('cached.pyc'), false)
})

test('matches names case-insensitively', async () => {
  const { createHiddenItemMatcher } = await loadHiddenItems()
  const isHidden = createHiddenItemMatcher('.ds_store')

  assert.equal(isHidden('.DS_Store'), true)
})

test('supports * and ? wildcards without treating other characters as patterns', async () => {
  const { createHiddenItemMatcher } = await loadHiddenItems()
  const isHidden = createHiddenItemMatcher('*.pyc|draft-?.md|a+b.txt')

  assert.equal(isHidden('cached.pyc'), true)
  assert.equal(isHidden('cached.PYC'), true)
  assert.equal(isHidden('draft-1.md'), true)
  assert.equal(isHidden('draft-12.md'), false)
  assert.equal(isHidden('a+b.txt'), true)
  assert.equal(isHidden('aab.txt'), false)
})

test('only matches whole names, not partial paths or substrings', async () => {
  const { createHiddenItemMatcher } = await loadHiddenItems()
  const isHidden = createHiddenItemMatcher('*.pyc')

  assert.equal(isHidden('cached.pyc'), true)
  assert.equal(isHidden('cached.pyc.bak'), false)
  assert.equal(isHidden('notes.md'), false)
})

test('keeps normal vault folders visible by default', async () => {
  const { createHiddenItemMatcher } = await loadHiddenItems()
  const isHidden = createHiddenItemMatcher(undefined)

  assert.equal(isHidden('30_entities'), false)
  assert.equal(isHidden('2026-10-19.md'), false)
})
