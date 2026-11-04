import test from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'
import MermaidPlugin from '@md-reader/markdown-it-mermaid'

const loadGraphviz = () => import('../src/core/graphviz.ts')
const loadMermaidBlock = () => import('../src/plugins/mermaid-block.ts')
const loadMermaidNormalizer = () =>
  import('../src/plugins/mermaid-normalize.ts')

test('keeps Mermaid source for asynchronous browser rendering', async () => {
  const { default: MermaidBlockPlugin, MERMAID_CLASS } =
    await loadMermaidBlock()
  const md = new MarkdownIt()
  md.use(MermaidBlockPlugin, { theme: 'default' })

  const source = 'flowchart LR\n  A[Start] --> B[Done]'
  const html = md.render(`\`\`\`mermaid\n${source}\n\`\`\``)

  assert.match(html, new RegExp(MERMAID_CLASS))
  assert.match(html, /flowchart LR/)
  assert.doesNotMatch(html, /undefined/)
})

test('quotes non-ASCII Mermaid labels for the bundled Mermaid parser', async () => {
  const { normalizeMermaidCode } = await loadMermaidNormalizer()
  const source = [
    'flowchart LR',
    '  User[用户目标] --> AI[AI 理解、编排与验收]',
    '  AI -->|调度原子能力| Python[Python 执行与回读]',
    '  Env{识别环境} --> DB[(业务数据库：只读)]',
  ].join('\n')

  assert.equal(
    normalizeMermaidCode(source),
    [
      'flowchart LR',
      '  User["用户目标"] --> AI["AI 理解、编排与验收"]',
      '  AI -->|"调度原子能力"| Python["Python 执行与回读"]',
      '  Env{"识别环境"} --> DB[("业务数据库：只读")]',
    ].join('\n'),
  )
})

test('treats digraph blocks as graphviz diagrams', async () => {
  const { isGraphvizCodeBlock } = await loadGraphviz()

  assert.equal(isGraphvizCodeBlock('digraph', 'digraph G { a -> b }'), true)
  assert.equal(isGraphvizCodeBlock('dot', 'digraph G { a -> b }'), true)
  assert.equal(isGraphvizCodeBlock('graphviz', 'graph G { a -- b }'), true)
})

test('routes digraph content inside mermaid fences to graphviz', async () => {
  const { isGraphvizCodeBlock } = await loadGraphviz()

  assert.equal(isGraphvizCodeBlock('mermaid', 'digraph G { a -> b }'), true)
})

test('keeps regular mermaid flowcharts on the mermaid renderer', async () => {
  const { isGraphvizCodeBlock } = await loadGraphviz()

  assert.equal(
    isGraphvizCodeBlock('mermaid', 'graph TD\n  A[Start] --> B[Done]'),
    false,
  )
})

test('encodes graphviz placeholders safely', async () => {
  const { decodeGraphvizSource, renderGraphvizPlaceholder } =
    await loadGraphviz()
  const code = 'digraph G {\n  a -> b [label="a < b"];\n}'

  const html = renderGraphvizPlaceholder(code)
  const sourceMatch = html.match(/data-graphviz-source="([^"]+)"/)

  assert.ok(sourceMatch, 'expected graphviz source data attribute')
  assert.equal(decodeGraphvizSource(sourceMatch[1]), code)
  assert.match(html, /md-reader__graphviz/)
})

test('markdown-it integration can route graphviz fences without touching mermaid flowcharts', async () => {
  const { isGraphvizCodeBlock, renderGraphvizPlaceholder } =
    await loadGraphviz()
  const md = new MarkdownIt()
  const fallbackFence = md.renderer.rules.fence?.bind(md.renderer.rules)

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = token.info.trim()
    const code = token.content.trim()

    if (isGraphvizCodeBlock(info, code)) {
      return renderGraphvizPlaceholder(code)
    }

    return fallbackFence
      ? fallbackFence(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options)
  }

  const dotHtml = md.render('```digraph\ndigraph G { a -> b }\n```')
  const mermaidHtml = md.render('```mermaid\ngraph TD\n  A --> B\n```')

  assert.match(dotHtml, /md-reader__graphviz/)
  assert.doesNotMatch(mermaidHtml, /md-reader__graphviz/)
})

test('graphviz override still works after mermaid plugin is installed first', async () => {
  const { isGraphvizCodeBlock, renderGraphvizPlaceholder } =
    await loadGraphviz()
  const md = new MarkdownIt()
  md.use(MermaidPlugin)

  const fallbackFence = md.renderer.rules.fence?.bind(md.renderer.rules)
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = token.info.trim()
    const code = token.content.trim()

    if (isGraphvizCodeBlock(info, code)) {
      return renderGraphvizPlaceholder(code)
    }

    return fallbackFence
      ? fallbackFence(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options)
  }

  const html = md.render('```mermaid\ndigraph G { a -> b }\n```')

  assert.match(html, /md-reader__graphviz/)
})
