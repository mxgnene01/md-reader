# Markdown Reader Local

这是基于 `md-reader/md-reader` MIT 开源项目构建的本地版本，增加了本地文件夹目录浏览能力。

## 安装

1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 如果商店版 Markdown Reader 仍在运行，先将它停用，避免两个内容脚本同时处理 Markdown 页面。
4. 点击“加载已解压的扩展程序”。
5. 选择 `/Users/bytedance/mxg/work/md-reader/extension`（软链）或 `/Users/bytedance/mxg/go/src/github.com/mxgnene01/md-reader/extension`（真实路径），**二选一，只加载一份**。
6. 打开 `Markdown Reader Local` 的“详情”，开启“允许访问文件网址”。
7. 点击扩展图标，在“本地目录根路径”中添加一个或多个绝对路径，例如 `/Users/用户名/Obsidian` 和 `/Users/用户名/work/llm-wiki-knowledge`。

> 扩展 ID 由加载路径决定，设置也存在各自 ID 下。软链路径和真实路径会被 Chrome 当成两个不同扩展：同时加载会出现两份内容脚本，且两边的设置互不相通，看起来就像“配置丢了”。重新加载扩展时也用同一个路径，不要在 `chrome://extensions/` 里换路径重加。

## 使用

- 直接在 Chrome 打开任意 `.md`、`.mdx`、`.mdc`、`.mkd`、`.markdown` 或 `.txt` 文件，会自动渲染。
- 左侧顶部显示当前文件夹中的全部文件和子文件夹，当前文件会高亮；Markdown 文件由扩展渲染，其他格式交给浏览器原生打开。
- 子文件夹始终优先；默认按文件名倒序，排序方式可切换并自动保存。
- 设置多个根路径后，会自动选择当前文件所属的根目录；存在嵌套根目录时选择路径最长、最精确的一个。
- 左侧目录标题支持切换已配置的根目录；切换后会打开目标根目录。侧边栏始终保留从当前根目录到文件的层级，并自动展开祖先目录。
- 点击目录标题右侧的排序按钮，可在文件名正序/倒序、编辑时间正序/倒序之间切换；文件夹始终优先。
- 「不展示的内容」用 `|` 分隔文件名或通配符（支持 `*` 和 `?`，不区分大小写），例如 `.DS_Store|*.pyc`；默认已填 `.DS_Store|Thumbs.db|.gitkeep|*.pyc|__pycache__`，清空即全部显示。过滤同时作用于左侧目录树和快速搜索，不影响 WikiLink 跳转；以 `.` 开头的目录和 `node_modules` 始终不展示。
- Obsidian WikiLink（如 `[[../../30_entities/people/孟祥国|孟祥国]]`）会显示为可点击别名链接，并跳转到对应的本地 Markdown 文件；裸链接（如 `[[2026-06-23]]`）会在当前文件所属的根目录中按文件名查找。
- 左侧目录树顶部支持按文件名或相对路径快速搜索；按 `Command+K`（Windows/Linux 为 `Ctrl+K`）可直接聚焦搜索框，使用上下方向键选择结果、回车或点击在当前标签页打开，`Esc` 清空搜索。
- 文件夹与正文目录之间的分隔线可上下拖动；比例会自动保存，双击分隔线恢复默认。
- 在地址栏打开 `file:///某个文件夹路径/`，会进入文件夹目录页。
- 点击文件夹后的“上级”，可以向上切换目录。

源码仓库：https://github.com/md-reader/md-reader
