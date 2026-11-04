import type MarkdownIt from 'markdown-it'
import { escapeHtml } from 'markdown-it/lib/common/utils.js'

export const MERMAID_CLASS = 'md-reader__mermaid'
export const MERMAID_CONTENT_CLASS = `${MERMAID_CLASS}-content`
export const MERMAID_THEME_ATTR = 'data-mermaid-theme'
export const MERMAID_STATUS_ATTR = 'data-mermaid-status'

interface MermaidBlockOptions {
  theme?: 'dark' | 'default'
}

export function renderMermaidPlaceholder(
  code: string,
  theme: MermaidBlockOptions['theme'] = 'default',
): string {
  return `<pre class="${MERMAID_CLASS} mermaid" ${MERMAID_THEME_ATTR}="${theme}" ${MERMAID_STATUS_ATTR}="pending"><code class="${MERMAID_CONTENT_CLASS}">${escapeHtml(
    code,
  )}</code></pre>`
}

export default function MermaidBlockPlugin(
  md: MarkdownIt,
  { theme = 'default' }: MermaidBlockOptions = {},
) {
  const fallbackFence = md.renderer.rules.fence?.bind(md.renderer.rules)

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]

    if (token.info.trim() === 'mermaid') {
      return renderMermaidPlaceholder(token.content.trim(), theme)
    }

    if (fallbackFence) {
      return fallbackFence(tokens, idx, options, env, self)
    }

    return self.renderToken(tokens, idx, options)
  }
}
