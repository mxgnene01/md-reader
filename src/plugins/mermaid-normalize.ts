function hasNonAsciiText(value: string) {
  return /[^\x00-\x7f]/.test(value)
}

function quoteLabel(value: string) {
  const label = value.trim()
  if (!hasNonAsciiText(label) || /^".*"$/.test(label)) {
    return value
  }

  return `"${label.replace(/"/g, '\\"')}"`
}

/**
 * Mermaid 9 accepts non-ASCII text in quoted labels only. Keep its older
 * parser compatible with Markdown documents that use Chinese labels directly.
 */
export function normalizeMermaidCode(code: string) {
  return code
    .replace(/\|([^|\n]+)\|/g, (_, label) => `|${quoteLabel(label)}|`)
    .replace(
      /(\b[A-Za-z_][\w-]*)\[\(([^()\n]*)\)\]/g,
      (_, id, label) => `${id}[(${quoteLabel(label)})]`,
    )
    .replace(
      /(\b[A-Za-z_][\w-]*)\[(?!\()([^\]\n]*)\]/g,
      (_, id, label) => `${id}[${quoteLabel(label)}]`,
    )
    .replace(
      /(\b[A-Za-z_][\w-]*)\{([^}\n]*)\}/g,
      (_, id, label) => `${id}{${quoteLabel(label)}}`,
    )
    .replace(
      /(\b[A-Za-z_][\w-]*)\(([^()\n]*)\)/g,
      (_, id, label) => `${id}(${quoteLabel(label)})`,
    )
}
