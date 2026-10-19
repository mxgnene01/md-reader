/**
 * Folder browser display filter.
 *
 * The setting is a single `|`-separated string, e.g. `.DS_Store|*.pyc`. Each
 * entry is matched against a file or folder name with `*` and `?` wildcards and
 * is case-insensitive, so `.ds_store` and `.DS_Store` are treated the same.
 */
export const DEFAULT_HIDDEN_ITEMS =
  '.DS_Store|Thumbs.db|.gitkeep|*.pyc|__pycache__'

/** An explicitly empty setting hides nothing; an absent setting uses defaults. */
export function resolveHiddenItems(value?: string): string {
  return typeof value === 'string' ? value.trim() : DEFAULT_HIDDEN_ITEMS
}

export function parseHiddenItemPatterns(value?: string): string[] {
  const seen = new Set<string>()

  return resolveHiddenItems(value)
    .split('|')
    .reduce<string[]>((patterns, item) => {
      const pattern = item.trim()
      if (!pattern) return patterns
      const key = pattern.toLocaleLowerCase()
      if (seen.has(key)) return patterns
      seen.add(key)
      patterns.push(pattern)
      return patterns
    }, [])
}

export function createHiddenItemMatcher(
  value?: string,
): (name: string) => boolean {
  const patterns = parseHiddenItemPatterns(value).map(toRegExp)
  if (!patterns.length) return () => false

  return (name: string) => patterns.some(pattern => pattern.test(name))
}

function toRegExp(pattern: string): RegExp {
  let source = ''
  for (const character of pattern) {
    if (character === '*') {
      source += '.*'
    } else if (character === '?') {
      source += '.'
    } else {
      source += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${source}$`, 'i')
}
