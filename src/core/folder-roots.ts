export interface FolderRootConfig {
  folderRootPaths?: string[]
  folderRootPath?: string
}

export function getConfiguredFolderRootPaths(
  config: FolderRootConfig = {},
): string[] {
  const values = Array.isArray(config.folderRootPaths)
    ? config.folderRootPaths
    : [config.folderRootPath]
  const seen = new Set<string>()

  return values.reduce<string[]>((paths, value) => {
    const path = typeof value === 'string' ? value.trim() : ''
    if (!path || seen.has(path)) return paths
    seen.add(path)
    paths.push(path)
    return paths
  }, [])
}

export function normalizeFolderRootURL(value?: string): string | undefined {
  const path = value?.trim()
  if (!path) return undefined

  try {
    let target = path
    if (/^[a-z]:[\\/]/i.test(target)) {
      target = `file:///${target.replace(/\\/g, '/')}`
    } else if (target.startsWith('/')) {
      target = `file://${target}`
    }

    const url = new URL(target)
    if (url.protocol !== 'file:') return undefined
    url.hash = ''
    url.search = ''
    if (!url.pathname.endsWith('/')) url.pathname += '/'
    return url.href
  } catch {
    return undefined
  }
}

export function normalizeFolderRootURLs(values: string[] = []): string[] {
  const seen = new Set<string>()

  return values.reduce<string[]>((urls, value) => {
    const url = normalizeFolderRootURL(value)
    if (!url || seen.has(url)) return urls
    seen.add(url)
    urls.push(url)
    return urls
  }, [])
}

export function isURLWithinRoot(url: string, rootURL: string): boolean {
  try {
    const target = new URL(url)
    const root = new URL(rootURL)
    return (
      target.protocol === root.protocol &&
      target.host === root.host &&
      decodeURLPath(target).startsWith(decodeURLPath(root))
    )
  } catch {
    return false
  }
}

export function findMatchingFolderRootURL(
  url: string,
  rootURLs: string[],
): string | undefined {
  return rootURLs
    .filter(rootURL => isURLWithinRoot(url, rootURL))
    .sort(
      (left, right) => decodedPathLength(right) - decodedPathLength(left),
    )[0]
}

function decodedPathLength(url: string): number {
  try {
    return decodeURLPath(new URL(url)).length
  } catch {
    return 0
  }
}

function decodeURLPath(url: URL): string {
  try {
    return decodeURIComponent(url.pathname)
  } catch {
    return url.pathname
  }
}
