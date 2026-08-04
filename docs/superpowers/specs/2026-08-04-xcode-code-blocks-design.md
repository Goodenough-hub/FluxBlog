# FluxBlog Xcode 风格代码块 — 设计文档

日期：2026-08-04
状态：已批准，待实现计划

## 背景与目标

FluxBlog 当前用 Shiki 双主题（`min-light` / `night-owl`）做代码高亮，块级代码外观平淡、
且三处渲染管线各自为政（Studio 预览甚至没接 transformer，与公开文章不一致）。

目标：把**块级代码**做成 **Xcode 默认配色**（浅色 + 深色），容器采用 **macOS 窗口风**
（红黄绿三彩点 + 文件名标题栏），并在窗口内提供**行号**、**复制按钮**、**语言标签**；
同时让 **Studio 编辑器预览**与公开文章输出一致。

**范围内**：块级代码配色 → Xcode；代码块容器（macOS 窗口）与块内细节；Studio 预览同步。
**范围外**：行内 `` `code` `` 样式保持现状不动。

## 现状（三处 Shiki 使用点，均为 `min-light` / `night-owl`）

1. `astro.config.ts` — 构建期 `.md`（About 等静态页），`shikiConfig` 内联定义主题与 transformers。
2. `src/utils/markdownPlugins.ts` + `src/utils/renderMarkdown.ts` — SSR，DB 下发文章正文，
   `rehypeShiki`，含 `transformerFileName` + 三个 notation transformer。
3. `src/scripts/preview.ts` — Studio 客户端 `codeToHtml`，**无 transformer**（当前已与公开输出分叉：
   无文件名标签、无 diff 标记），未知语言 try/catch 回退 `ts`。

文件名当前通过 fence meta `file="main.swift"` 指定，`transformerFileName` 渲染带绿点的徽章。

## 架构：单一配置源，消除分叉

```
src/utils/themes/xcode-light.ts ─┐
src/utils/themes/xcode-dark.ts  ─┤
src/utils/transformers/codeWindow.ts ─┐
                                       ├─→ markdownPlugins.ts  (shikiThemes + shikiTransformers)
                                       │        ├─ astro.config.ts      (构建期 .md)
                                       │        ├─ renderMarkdown.ts    (SSR DB 文章)
                                       │        └─ preview.ts           (Studio 客户端)
src/scripts/code-copy.ts ──────────────┘  (Layout.astro + studio 均 import)
src/styles/typography.css  (.xcode-window 样式，全局，不挂在 prose 之下)
```

`astro.config.ts` 改为从 `markdownPlugins.ts` 导入主题与 transformers（不再内联），三处共用同一份。

## Fork 1（配色）：仓库内手写 Xcode TextMate 主题

新增两个 Shiki 主题对象（`ThemeRegistrationRaw`），键名保持 `light` / `dark`，
以复用既有 `--shiki-light*` / `--shiki-dark*` CSS 变量切换机制（`defaultColor: false` 不变）。
基于 Xcode *Default Light* / *Default Dark*：

| Token | Light | Dark |
|---|---|---|
| 背景 / 正文 | `#FFFFFF` / `#1F1F24` | `#292A30` / `#DFDFE0` |
| 注释 comment | `#5D6C79` | `#7F8C98` |
| 关键字 keyword/storage | `#AD3DA4` | `#FF7AB2` |
| 字符串 string | `#D12F1B` | `#FF8170` |
| 数字/字面量 number/literal | `#272AD8` | `#D9C97C` |
| 类型/类 type/class | `#3900A0` | `#DABAFF` |
| 函数/方法 function/method | `#804FB8` / `#326D74` | `#67B7A4` |
| 属性/预处理 attribute/preprocessor | `#78492A` | `#FFA14F` |

（十六进制值实现时可微调；以上为通行的 Xcode 移植取值。）

TextMate scope 映射（每个主题的 `tokenColors`）：
- `comment`, `punctuation.definition.comment` → 注释
- `keyword`, `storage`, `keyword.control`, `keyword.operator`（关键字色或正文色，二选一保持克制）
- `string`, `string.quoted` → 字符串
- `constant.numeric`, `constant.language` → 数字/字面量
- `entity.name.function`, `support.function`, `meta.function-call` → 函数/方法
- `entity.name.type`, `entity.name.class`, `support.type`, `support.class` → 类型/类
- `variable`, `variable.parameter` → 正文/参数色
- `entity.name.tag`（HTML）→ 关键字色；`entity.other.attribute-name` → 属性色
- `meta.preprocessor` → 预处理色
- `editor.background` / `editor.foreground` → 背景/正文

拒绝的备选：用现成 bundled 主题近似（非 Xcode，明显偏色）；引 npm 包（为两个静态 JSON 增加依赖与供应链面）。

## Fork 2（容器）：共享 `transformerCodeWindow` + CSS + 复制脚本

新 transformer `src/utils/transformers/codeWindow.ts` 取代 `transformerFileName`，每个代码块输出：

```html
<figure class="xcode-window">
  <div class="xcode-titlebar">
    <span class="xcode-dots"></span>                 <!-- 三彩点，纯 CSS -->
    <span class="xcode-filename">main.swift</span>   <!-- 来自 file="…" meta，无则省略 -->
    <span class="xcode-lang">swift</span>            <!-- Shiki 解析出的 lang，text/plain 时隐藏 -->
    <button class="xcode-copy" data-copy type="button">复制</button>
  </div>
  <pre class="astro-code line-numbers">…<span class="line">…</span>…</pre>
</figure>
```

实现要点：
- **行号**：`.line-numbers .line::before { counter-increment: …; content: counter(…) }`，纯 CSS gutter，不增加 DOM。
- **标题栏始终显示**（点 + lang + 复制），即使无文件名（用户选择）。
- 既有 diff / highlight / word-highlight transformer 保留，仍在 `<pre>` 内渲染。
- `.xcode-window` **全局**样式（不挂 `.app-prose`），使公开文章（`app-prose`）与 Studio 预览（`prose-app`）表现一致。
- transformer 通过 `this.options.lang` 拿语言、复用现有 meta 解析拿文件名。
- Shiki transformer 用 `root`/`pre` 钩子包裹 `<pre>` 为 `<figure>` 并插入标题栏。

拒绝的备选：纯 CSS（无法干净注入语言标签/标题栏，复制仍需 JS）；三处各自装饰（继续制造分叉）。

## 复制按钮 — HTTP 安全

仓库存在纯 HTTP 部署场景（见 git log `crypto.randomUUID` 修复），此时 `navigator.clipboard` 为 `undefined`。
`src/scripts/code-copy.ts` 用**文档级事件委托**监听（可在 Studio innerHTML 重渲染后继续生效），回退链：

1. `navigator.clipboard.writeText`（安全上下文）
2. 隐藏 `<textarea>` + `document.execCommand('copy')`
3. 均失败 → 显示 `复制失败`

成功显示 `已复制` 1.5s 后复原。该脚本由 `Layout.astro`（公开）与 studio 页面共同 import；
事件委托保证对预览动态插入的按钮同样有效。

## 错误处理与边界

- **未知语言**：Studio 预加载固定 lang 列表并 try/catch 回退 `ts`，保持不变；标签显示解析出的 lang。
- **Mermaid / KaTeX**：不受影响 —— Mermaid 在 Shiki 前已转为 `<div data-mermaid>`，无窗口装饰，正确；KaTeX 无关。
- **单行代码块**：仍显示行号 `1`，符合 Xcode 行为。
- **无文件名**：标题栏仍显示，仅省略文件名 span。

## 测试

- **单测（vitest）**：`transformerCodeWindow` 快照 —— 三彩点/文件名/语言/`line-numbers` class 存在；无 meta 时省略文件名；`text` 语言时隐藏语言标签。
- **主题健全性**：两个主题均定义所需 token scope 与 `editor.background`/`editor.foreground`。
- **e2e（Playwright）**：已发布文章页出现 `.xcode-window` + 标题栏 + 带行号的行；复制按钮点击写入剪贴板（安全上下文用例）。
- **门槛**：`npm run typecheck` + `npm test` + `npm run build` 全过。

## 提交约定

FluxBlog 仓库；git 身份 `Goodenough`；提交信息中文，前缀 `feat(blog):` / `fix(blog):`。
