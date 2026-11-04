import mermaid from 'mermaid'
import { normalizeMermaidCode } from './mermaid-normalize'
import {
  MERMAID_CLASS,
  MERMAID_CONTENT_CLASS,
  MERMAID_STATUS_ATTR,
  MERMAID_THEME_ATTR,
} from './mermaid-block'

let nextDiagramId = 0

function createErrorElement(message: string) {
  const error = document.createElement('div')
  error.className = `${MERMAID_CLASS}-error`
  error.textContent = message
  return error
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const details = error as {
      message?: unknown
      str?: unknown
      hash?: { text?: unknown }
    }

    for (const value of [details.message, details.str, details.hash?.text]) {
      if (typeof value === 'string' && value) {
        return value
      }
    }

    try {
      return JSON.stringify(error)
    } catch {
      return 'Mermaid rendering failed'
    }
  }

  return String(error)
}

async function renderMermaidElement(element: HTMLElement) {
  const status = element.getAttribute(MERMAID_STATUS_ATTR)
  if (status === 'rendering' || status === 'ready') {
    return
  }

  const codeElement = element.querySelector<HTMLElement>(
    `.${MERMAID_CONTENT_CLASS}`,
  )
  const code = codeElement?.textContent
  if (!code) {
    return
  }

  element.setAttribute(MERMAID_STATUS_ATTR, 'rendering')
  element.querySelector(`.${MERMAID_CLASS}-error`)?.remove()

  try {
    const theme =
      element.getAttribute(MERMAID_THEME_ATTR) === 'dark' ? 'dark' : 'default'
    mermaid.initialize({ startOnLoad: false, theme })
    const normalizedCode = normalizeMermaidCode(code)
    let bindFunctions: ((element: Element) => void) | undefined
    const svg = mermaid.render(
      `${MERMAID_CLASS}-${nextDiagramId++}`,
      normalizedCode,
      (_svg, bindings) => {
        bindFunctions = bindings
      },
    )
    const template = document.createElement('template')
    template.innerHTML = svg
    const diagram = template.content.firstElementChild
    if (!diagram) {
      throw new Error('Mermaid did not return a diagram')
    }

    codeElement.replaceWith(diagram)
    bindFunctions?.(element)
    element.setAttribute(MERMAID_STATUS_ATTR, 'ready')
  } catch (error) {
    console.error('Failed to render Mermaid diagram', error)
    const message = getErrorMessage(error)
    element.appendChild(createErrorElement(message))
    element.setAttribute(MERMAID_STATUS_ATTR, 'error')
  }
}

export async function renderMermaid(container: ParentNode = document) {
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(`.${MERMAID_CLASS}`),
  )
  await Promise.all(elements.map(element => renderMermaidElement(element)))
}

export default function MermaidRendererPlugin({ event }) {
  event.on('contentRendered', (container: HTMLElement) => {
    void renderMermaid(container)
  })
}
