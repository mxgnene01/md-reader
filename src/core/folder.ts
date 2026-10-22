import className from '@/config/class-name'
import { FOLDER_SORT_ORDERS, type FolderSortOrder } from '@/core/data'
import { createHiddenItemMatcher } from '@/core/hidden-items'
import { isURLWithinRoot } from '@/core/folder-roots'
export {
  findMatchingFolderRootURL,
  isURLWithinRoot,
  normalizeFolderRootURL,
  normalizeFolderRootURLs,
} from '@/core/folder-roots'

const FOLDER_SORT_OPTIONS: Array<{
  value: FolderSortOrder
  label: string
}> = [
  { value: 'name-asc', label: '文件名 (A-Z)' },
  { value: 'name-desc', label: '文件名 (Z-A)' },
  { value: 'modified-desc', label: '编辑时间 (从新到旧)' },
  { value: 'modified-asc', label: '编辑时间 (从旧到新)' },
]

export interface FolderEntry {
  name: string
  url: string
  isDirectory: boolean
  modifiedTime?: number
}

interface FetchUrlResponse {
  ok: boolean
  text?: string
  error?: string
}

interface VaultFileEntry {
  name: string
  url: string
  relativePath: string
}

interface ListVaultFilesResponse {
  ok: boolean
  files?: VaultFileEntry[]
  error?: string
}

interface SearchResult {
  file: VaultFileEntry
  score: number
}

const MAX_SEARCH_RESULTS = 50

export interface FolderBrowserOptions {
  container: HTMLElement
  rootURL: string
  rootURLs?: string[]
  currentURL?: string
  initialHTML?: string
  showParentLink?: boolean
  sortOrder?: FolderSortOrder
  hiddenItems?: string
  refreshIndex?: boolean
  onSortOrderChange?: (sortOrder: FolderSortOrder) => void
  onRootURLChange?: (rootURL: string) => void
  onQuickOpen?: () => void
}

export function isLocalDirectoryPage(
  url: string = window.location.href,
  contentType: string = document.contentType,
): boolean {
  const parsed = new URL(url)
  return (
    parsed.protocol === 'file:' &&
    parsed.pathname.endsWith('/') &&
    contentType === 'text/html'
  )
}

export function getParentDirectoryURL(url: string): string {
  return new URL('./', url).href
}

export function isSameLocalURL(left: string, right: string): boolean {
  try {
    return normalizeURL(left) === normalizeURL(right)
  } catch {
    return false
  }
}

export function getDirectoryName(url: string): string {
  const pathname = new URL(url).pathname.replace(/\/$/, '')
  const encodedName = pathname.split('/').pop()
  if (!encodedName) return '/'
  try {
    return decodeURIComponent(encodedName)
  } catch {
    return encodedName
  }
}

export function parseDirectoryEntries(
  html: string,
  directoryURL: string,
  sortOrder: FolderSortOrder = 'name-desc',
  hiddenItems?: string,
): FolderEntry[] {
  const base = new URL(directoryURL)
  const basePath = base.pathname.endsWith('/')
    ? base.pathname
    : `${base.pathname}/`
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const seen = new Map<string, FolderEntry>()
  const entries: FolderEntry[] = []
  const isHiddenItem = createHiddenItemMatcher(hiddenItems)

  const addEntry = (
    href: string,
    directoryHint?: boolean,
    nameHint?: string,
    modifiedTimeHint?: number,
  ) => {
    let target: URL
    try {
      target = new URL(href, base)
    } catch {
      return
    }

    target.hash = ''
    target.search = ''
    if (directoryHint && !target.pathname.endsWith('/')) {
      target.pathname += '/'
    }
    if (target.protocol !== 'file:' || !target.pathname.startsWith(basePath)) {
      return
    }

    const relativePath = target.pathname.slice(basePath.length)
    const isDirectory = target.pathname.endsWith('/')
    const comparablePath = isDirectory
      ? relativePath.slice(0, -1)
      : relativePath
    if (!comparablePath || comparablePath.includes('/')) return
    const knownEntry = seen.get(target.href)
    if (knownEntry) {
      if (
        knownEntry.modifiedTime === undefined &&
        Number.isFinite(modifiedTimeHint)
      ) {
        knownEntry.modifiedTime = modifiedTimeHint
      }
      return
    }

    const name = nameHint ? decodeName(nameHint) : decodeName(comparablePath)
    if (isDirectory && (name.startsWith('.') || name === 'node_modules')) {
      return
    }
    if (isHiddenItem(name)) return

    const entry = {
      name,
      url: target.href,
      isDirectory,
      modifiedTime: Number.isFinite(modifiedTimeHint)
        ? modifiedTimeHint
        : undefined,
    }
    seen.set(target.href, entry)
    entries.push(entry)
  }

  parsed.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
    const cells = anchor
      .closest('tr')
      ?.querySelectorAll<HTMLTableCellElement>('td')
    const modifiedTime = Number(cells?.[2]?.dataset.value)
    addEntry(
      anchor.getAttribute('href'),
      undefined,
      undefined,
      Number.isFinite(modifiedTime) ? modifiedTime : undefined,
    )
  })

  // Chrome returns directory listings fetched in a service worker as source
  // containing addRow(...) calls. DOMParser does not execute those scripts, so
  // parse their JSON string arguments explicitly instead of evaluating script.
  const addRowPattern =
    /addRow\(("(?:\\.|[^"\\])*"),\s*("(?:\\.|[^"\\])*"),\s*([01]),\s*(?:-?\d+(?:\.\d+)?|null),\s*(?:"(?:\\.|[^"\\])*")\s*,\s*(-?\d+(?:\.\d+)?|null),\s*(?:"(?:\\.|[^"\\])*")\s*\);?/g
  for (const match of html.matchAll(addRowPattern)) {
    try {
      const modifiedTime = match[4] === 'null' ? undefined : Number(match[4])
      addEntry(
        JSON.parse(match[2]),
        match[3] === '1',
        JSON.parse(match[1]),
        Number.isFinite(modifiedTime) ? modifiedTime : undefined,
      )
    } catch {
      // Ignore malformed browser-generated rows.
    }
  }

  return entries.sort((left, right) =>
    compareFolderEntries(left, right, sortOrder),
  )
}

export async function renderFolderBrowser(
  options: FolderBrowserOptions,
): Promise<void> {
  const {
    container,
    rootURL,
    rootURLs = [rootURL],
    currentURL,
    initialHTML,
    showParentLink = true,
    sortOrder = 'name-desc',
    hiddenItems,
    refreshIndex = false,
    onSortOrderChange,
    onRootURLChange,
    onQuickOpen,
  } = options
  container.replaceChildren()
  let activeSortOrder = normalizeFolderSortOrder(sortOrder)

  const header = document.createElement('div')
  header.className = className.FOLDER_HEADER

  const rootLink = document.createElement('a')
  rootLink.href = rootURL
  rootLink.className = className.FOLDER_ROOT
  rootLink.title = rootURL
  rootLink.textContent =
    rootURLs.length > 1 ? '📁' : `📁 ${getDirectoryName(rootURL)}`
  if (rootURLs.length > 1) rootLink.style.flex = 'none'

  const rootSelect = document.createElement('select')
  rootSelect.className = className.FOLDER_ROOT_SELECT
  rootSelect.setAttribute('aria-label', '切换本地根目录')
  rootSelect.title = rootURL
  for (const availableRootURL of rootURLs) {
    const option = document.createElement('option')
    option.value = availableRootURL
    option.textContent = getDirectoryName(availableRootURL)
    option.title = availableRootURL
    rootSelect.append(option)
  }
  rootSelect.value = rootURL
  rootSelect.addEventListener('change', () => {
    onRootURLChange?.(rootSelect.value)
  })

  const parentLink = document.createElement('a')
  parentLink.href = new URL('../', rootURL).href
  parentLink.className = className.FOLDER_PARENT
  parentLink.title = '打开上级文件夹'
  parentLink.textContent = '上级'

  const sortControl = document.createElement('label')
  sortControl.className = className.FOLDER_SORT
  const sortIcon = document.createElement('span')
  sortIcon.textContent = '⇅'
  sortIcon.setAttribute('aria-hidden', 'true')
  const sortSelect = document.createElement('select')
  sortSelect.setAttribute('aria-label', '目录排序')
  for (const option of FOLDER_SORT_OPTIONS) {
    const optionElement = document.createElement('option')
    optionElement.value = option.value
    optionElement.textContent = option.label
    sortSelect.append(optionElement)
  }
  sortSelect.value = activeSortOrder
  updateSortControlTitle(sortControl, activeSortOrder)
  sortControl.append(sortIcon, sortSelect)

  const refreshButton = document.createElement('button')
  refreshButton.type = 'button'
  refreshButton.className = className.FOLDER_REFRESH
  refreshButton.title = '刷新目录'
  refreshButton.setAttribute('aria-label', '刷新目录')
  refreshButton.textContent = '↻'
  refreshButton.addEventListener('click', () => {
    void renderFolderBrowser({
      ...options,
      initialHTML: undefined,
      refreshIndex: true,
      sortOrder: activeSortOrder,
    })
  })

  header.append(rootLink)
  if (rootURLs.length > 1) header.append(rootSelect)
  header.append(sortControl)
  header.append(refreshButton)
  if (showParentLink) header.append(parentLink)

  const search = document.createElement('div')
  search.className = className.FOLDER_SEARCH
  const searchInput = document.createElement('input')
  searchInput.className = className.FOLDER_SEARCH_INPUT
  searchInput.type = 'search'
  searchInput.placeholder = '搜索文件… (⌘K)'
  searchInput.autocomplete = 'off'
  searchInput.spellcheck = false
  searchInput.setAttribute('aria-label', '搜索根目录中的文件')
  searchInput.setAttribute('aria-autocomplete', 'list')
  searchInput.setAttribute('aria-expanded', 'false')
  search.append(searchInput)

  const tree = document.createElement('ul')
  tree.className = className.FOLDER_TREE
  const searchStatus = document.createElement('div')
  searchStatus.className = className.FOLDER_SEARCH_STATUS
  searchStatus.hidden = true
  const searchResults = document.createElement('ul')
  searchResults.className = className.FOLDER_SEARCH_RESULTS
  searchResults.id = `md-reader-folder-search-${Date.now()}`
  searchResults.setAttribute('role', 'listbox')
  searchResults.hidden = true
  searchInput.setAttribute('aria-controls', searchResults.id)
  const status = document.createElement('div')
  status.className = className.FOLDER_STATUS
  status.textContent = '正在读取文件夹…'
  container.append(header, search, searchStatus, status, tree, searchResults)

  const filesPromise = requestVaultFiles(rootURL, hiddenItems, refreshIndex)
  let activeSearchIndex = 0
  let searchVersion = 0

  const hideSearchResults = () => {
    searchVersion += 1
    activeSearchIndex = 0
    tree.hidden = false
    searchStatus.hidden = true
    searchResults.hidden = true
    searchResults.replaceChildren()
    searchInput.setAttribute('aria-expanded', 'false')
    searchInput.removeAttribute('aria-activedescendant')
  }

  const selectSearchResult = (index: number) => {
    const results = Array.from(
      searchResults.querySelectorAll<HTMLAnchorElement>(
        `.${className.FOLDER_SEARCH_RESULT}`,
      ),
    )
    if (!results.length) return
    activeSearchIndex = (index + results.length) % results.length
    results.forEach((result, resultIndex) => {
      const active = resultIndex === activeSearchIndex
      result.classList.toggle(className.FOLDER_SEARCH_RESULT_ACTIVE, active)
      result.setAttribute('aria-selected', String(active))
      if (active) {
        searchInput.setAttribute('aria-activedescendant', result.id)
        result.scrollIntoView({ block: 'nearest' })
      }
    })
  }

  const renderSearchResults = async () => {
    const query = searchInput.value.trim()
    if (!query) {
      hideSearchResults()
      return
    }

    const version = ++searchVersion
    tree.hidden = true
    searchResults.hidden = true
    searchStatus.hidden = false
    searchStatus.textContent = '正在建立文件索引…'
    searchInput.setAttribute('aria-expanded', 'true')

    try {
      const files = await filesPromise
      if (version !== searchVersion) return
      const matches = searchVaultFiles(files, query)
      searchResults.replaceChildren()
      activeSearchIndex = 0

      matches.slice(0, MAX_SEARCH_RESULTS).forEach((match, index) => {
        const item = document.createElement('li')
        const link = document.createElement('a')
        const name = document.createElement('span')
        const path = document.createElement('span')
        link.id = `${searchResults.id}-${index}`
        link.className = className.FOLDER_SEARCH_RESULT
        link.href = match.file.url
        link.title = match.file.relativePath
        link.setAttribute('role', 'option')
        name.className = className.FOLDER_SEARCH_RESULT_NAME
        name.textContent = stripMarkdownExtension(match.file.name)
        path.className = className.FOLDER_SEARCH_RESULT_PATH
        path.textContent = getParentPath(match.file.relativePath)
        link.append(name, path)
        link.addEventListener('mousemove', () => selectSearchResult(index))
        item.append(link)
        searchResults.append(item)
      })

      const shown = Math.min(matches.length, MAX_SEARCH_RESULTS)
      searchStatus.textContent = matches.length
        ? `${matches.length} 个结果${
            matches.length > shown ? `，显示前 ${shown} 个` : ''
          }`
        : '没有匹配的文件'
      searchResults.hidden = !matches.length
      if (matches.length) selectSearchResult(0)
    } catch (error) {
      if (version !== searchVersion) return
      searchResults.hidden = true
      searchStatus.textContent = `搜索失败：${error.message || error}`
      searchStatus.classList.add(className.FOLDER_STATUS_ERROR)
    }
  }

  searchInput.addEventListener('input', () => {
    searchStatus.classList.remove(className.FOLDER_STATUS_ERROR)
    void renderSearchResults()
  })
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectSearchResult(activeSearchIndex + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectSearchResult(activeSearchIndex - 1)
    } else if (event.key === 'Enter') {
      const active = searchResults.querySelector<HTMLAnchorElement>(
        `.${className.FOLDER_SEARCH_RESULT_ACTIVE}`,
      )
      if (active) {
        event.preventDefault()
        window.location.href = active.href
      }
    } else if (event.key === 'Escape') {
      searchInput.value = ''
      hideSearchResults()
    }
  })
  document.addEventListener(
    'keydown',
    event => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLocaleLowerCase() === 'k'
      ) {
        event.preventDefault()
        event.stopPropagation()
        onQuickOpen?.()
        searchInput.focus()
        searchInput.select()
      }
    },
    true,
  )

  try {
    const html = initialHTML ?? (await fetchLocalText(rootURL))
    let renderVersion = 0
    const renderTree = async () => {
      const version = ++renderVersion
      const entries = parseDirectoryEntries(
        html,
        rootURL,
        activeSortOrder,
        hiddenItems,
      )
      const nextTree = document.createElement('ul')
      await renderEntries(
        nextTree,
        entries,
        currentURL,
        activeSortOrder,
        hiddenItems,
      )
      if (version !== renderVersion) return

      tree.replaceChildren(...Array.from(nextTree.childNodes))
      status.remove()
      requestAnimationFrame(() => {
        tree
          .querySelector(`.${className.FOLDER_FILE_ACTIVE}`)
          ?.scrollIntoView({ block: 'nearest' })
      })
      if (!entries.length) {
        status.textContent = '文件夹为空'
        container.insertBefore(status, tree)
      }
    }

    sortSelect.addEventListener('change', () => {
      activeSortOrder = normalizeFolderSortOrder(sortSelect.value)
      updateSortControlTitle(sortControl, activeSortOrder)
      onSortOrderChange?.(activeSortOrder)
      void renderTree()
    })
    await renderTree()
  } catch (error) {
    status.classList.add(className.FOLDER_STATUS_ERROR)
    status.textContent = `目录读取失败：${error.message || error}`
  }
}

async function renderEntries(
  list: HTMLUListElement,
  entries: FolderEntry[],
  currentURL?: string,
  sortOrder: FolderSortOrder = 'name-desc',
  hiddenItems?: string,
): Promise<void> {
  for (const entry of entries) {
    const item = document.createElement('li')

    if (entry.isDirectory) {
      const details = document.createElement('details')
      const summary = document.createElement('summary')
      summary.textContent = entry.name
      summary.title = entry.url
      const children = document.createElement('ul')
      details.append(summary, children)
      let loadPromise: Promise<void> | undefined
      const loadChildren = () => {
        if (loadPromise) return loadPromise
        loadPromise = (async () => {
          summary.classList.add(className.FOLDER_LOADING)
          try {
            const html = await fetchLocalText(entry.url)
            const childEntries = parseDirectoryEntries(
              html,
              entry.url,
              sortOrder,
              hiddenItems,
            )
            await renderEntries(
              children,
              childEntries,
              currentURL,
              sortOrder,
              hiddenItems,
            )
            if (!childEntries.length) {
              const empty = document.createElement('li')
              empty.className = className.FOLDER_EMPTY
              empty.textContent = '文件夹为空'
              children.append(empty)
            }
          } catch (error) {
            const failed = document.createElement('li')
            failed.className = className.FOLDER_STATUS_ERROR
            failed.textContent = '读取失败'
            children.append(failed)
          } finally {
            summary.classList.remove(className.FOLDER_LOADING)
          }
        })()
        return loadPromise
      }
      details.addEventListener('toggle', () => {
        if (details.open) void loadChildren()
      })
      item.append(details)
      list.append(item)

      if (currentURL && isURLWithinRoot(currentURL, entry.url)) {
        details.open = true
        await loadChildren()
      }
    } else {
      const link = document.createElement('a')
      link.href = entry.url
      link.title = entry.name
      link.textContent = entry.name
      if (sameFileURL(entry.url, currentURL)) {
        link.classList.add(className.FOLDER_FILE_ACTIVE)
      }
      item.append(link)
      list.append(item)
    }
  }
}

function compareFolderEntries(
  left: FolderEntry,
  right: FolderEntry,
  sortOrder: FolderSortOrder,
): number {
  if (left.isDirectory !== right.isDirectory) {
    return left.isDirectory ? -1 : 1
  }

  const nameDiff = left.name.localeCompare(right.name, 'zh-CN', {
    numeric: true,
  })
  if (sortOrder === 'name-asc') return nameDiff
  if (sortOrder === 'name-desc') return -nameDiff

  const leftTime = left.modifiedTime
  const rightTime = right.modifiedTime
  if (leftTime === undefined && rightTime !== undefined) return 1
  if (leftTime !== undefined && rightTime === undefined) return -1
  const modifiedDiff =
    sortOrder === 'modified-desc' ? rightTime - leftTime : leftTime - rightTime
  if (modifiedDiff) return modifiedDiff
  return sortOrder === 'modified-desc' ? -nameDiff : nameDiff
}

function normalizeFolderSortOrder(value: string): FolderSortOrder {
  return FOLDER_SORT_ORDERS.includes(value as FolderSortOrder)
    ? (value as FolderSortOrder)
    : 'name-desc'
}

function updateSortControlTitle(
  control: HTMLElement,
  sortOrder: FolderSortOrder,
) {
  const label = FOLDER_SORT_OPTIONS.find(
    option => option.value === sortOrder,
  )?.label
  control.title = `排序：${label}`
}

function fetchLocalText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'fetchUrl', data: { url } },
      (response: FetchUrlResponse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!response?.ok) {
          reject(new Error(response?.error || '无法读取本地文件夹'))
          return
        }
        resolve(response.text || '')
      },
    )
  })
}

function requestVaultFiles(
  rootURL: string,
  hiddenItems?: string,
  refresh = false,
): Promise<VaultFileEntry[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'listVaultFiles', data: { rootURL, hiddenItems, refresh } },
      (response: ListVaultFilesResponse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (!response?.ok) {
          reject(new Error(response?.error || '无法建立文件索引'))
          return
        }
        resolve(response.files || [])
      },
    )
  })
}

function searchVaultFiles(
  files: VaultFileEntry[],
  query: string,
): SearchResult[] {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (!tokens.length) return []

  return files
    .map(file => {
      const name = normalizeSearchText(stripMarkdownExtension(file.name))
      const path = normalizeSearchText(file.relativePath)
      const tokenScores = tokens.map(token =>
        scoreSearchToken(name, path, token),
      )
      if (tokenScores.some(score => score === undefined)) return undefined
      return {
        file,
        score: tokenScores.reduce((total, score) => total + score, 0),
      }
    })
    .filter((result): result is SearchResult => Boolean(result))
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.file.relativePath.localeCompare(right.file.relativePath, 'zh-CN', {
          numeric: true,
        }),
    )
}

function scoreSearchToken(
  name: string,
  path: string,
  token: string,
): number | undefined {
  if (name === token) return 0
  if (name.startsWith(token)) return 10 + name.length - token.length
  const nameIndex = name.indexOf(token)
  if (nameIndex >= 0) return 30 + nameIndex
  const pathIndex = path.indexOf(token)
  if (pathIndex >= 0) return 60 + pathIndex

  const fuzzyScore = scoreSubsequence(name, token)
  return fuzzyScore === undefined ? undefined : 100 + fuzzyScore
}

function scoreSubsequence(value: string, query: string): number | undefined {
  let valueIndex = 0
  let score = 0
  for (const character of query) {
    const matchIndex = value.indexOf(character, valueIndex)
    if (matchIndex < 0) return undefined
    score += matchIndex - valueIndex
    valueIndex = matchIndex + character.length
  }
  return score + value.length - query.length
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN')
}

function stripMarkdownExtension(name: string): string {
  return name.replace(/\.(?:md|mdx|mdc|mkd|markdown|txt)$/i, '')
}

function getParentPath(relativePath: string): string {
  const separator = relativePath.lastIndexOf('/')
  return separator < 0 ? '/' : relativePath.slice(0, separator) || '/'
}

function decodeName(name: string): string {
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

function sameFileURL(left: string, right?: string): boolean {
  if (!right) return false
  return normalizeURL(left) === normalizeURL(right)
}

function normalizeURL(url: string): string {
  const parsed = new URL(url)
  return `${parsed.protocol}//${parsed.host}${decodeURLPath(parsed)}`
}

function decodeURLPath(url: URL): string {
  try {
    return decodeURIComponent(url.pathname)
  } catch {
    return url.pathname
  }
}
