import test from 'node:test'
import assert from 'node:assert/strict'

const loadFolderRoots = () => import('../src/core/folder-roots.ts')

test('migrates the legacy single root into the root list', async () => {
  const { getConfiguredFolderRootPaths } = await loadFolderRoots()

  assert.deepEqual(
    getConfiguredFolderRootPaths({ folderRootPath: ' /Users/me/Obsidian ' }),
    ['/Users/me/Obsidian'],
  )
})

test('keeps an explicitly empty root list instead of reviving the legacy root', async () => {
  const { getConfiguredFolderRootPaths } = await loadFolderRoots()

  assert.deepEqual(
    getConfiguredFolderRootPaths({
      folderRootPaths: [],
      folderRootPath: '/Users/me/old-root',
    }),
    [],
  )
})

test('trims and deduplicates the configured root list', async () => {
  const { getConfiguredFolderRootPaths } = await loadFolderRoots()

  assert.deepEqual(
    getConfiguredFolderRootPaths({
      folderRootPaths: [' /Users/me/Obsidian ', '/Users/me/Obsidian', ''],
    }),
    ['/Users/me/Obsidian'],
  )
})

test('normalizes and deduplicates local root URLs', async () => {
  const { normalizeFolderRootURLs } = await loadFolderRoots()

  assert.deepEqual(
    normalizeFolderRootURLs([
      '/Users/me/Obsidian',
      'file:///Users/me/Obsidian/',
      '/Users/me/llm-wiki-knowledge',
      'https://example.com/not-local',
    ]),
    ['file:///Users/me/Obsidian/', 'file:///Users/me/llm-wiki-knowledge/'],
  )
})

test('selects the most specific configured root for nested roots', async () => {
  const { findMatchingFolderRootURL } = await loadFolderRoots()
  const roots = [
    'file:///Users/me/work/',
    'file:///Users/me/work/llm-wiki-knowledge/',
  ]

  assert.equal(
    findMatchingFolderRootURL(
      'file:///Users/me/work/llm-wiki-knowledge/README.md',
      roots,
    ),
    roots[1],
  )
})

test('does not match sibling directories with the same path prefix', async () => {
  const { findMatchingFolderRootURL } = await loadFolderRoots()

  assert.equal(
    findMatchingFolderRootURL('file:///Users/me/Obsidian-backup/a.md', [
      'file:///Users/me/Obsidian/',
    ]),
    undefined,
  )
})
