# FluxBlog Xcode 风格代码块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 FluxBlog 块级代码做成 Xcode 默认配色 + macOS 窗口容器（三彩点/文件名/语言标签/行号/复制按钮），并让构建期、SSR、Studio 预览三处渲染共用同一份配置。

**Architecture:** 新增两个手写 Xcode Shiki 主题对象与一个 `transformerCodeWindow`，集中到 `markdownPlugins.ts` 单一配置源；`astro.config.ts`、`renderMarkdown.ts`、`preview.ts` 全部从此导入。窗口外观由全局 CSS（`.xcode-window`）绘制，复制按钮由文档级事件委托脚本驱动（HTTP 非安全上下文回退 `execCommand`）。

**Tech Stack:** Astro（Node SSR）、Shiki v4（`shiki` / `@shikijs/rehype` / `@shikijs/transformers`）、Tailwind v4、vitest（node 环境）、Playwright。

## Global Constraints

- Git 身份必须为 `Goodenough`（当前已是，勿改）；提交信息中文，前缀 `feat(blog):` / `fix(blog):`。
- Shiki 保持 `defaultColor: false`，主题键名保持 `light` / `dark`，以复用既有 `--shiki-light*` / `--shiki-dark*` CSS 变量切换。
- 提交前硬门槛：`npm run typecheck`（`astro check`）+ `npm test`（vitest）+ `npm run build`（`astro build && pagefind`）全过。
- 单测文件命名 `src/**/*.test.ts`（vitest include 规则），node 环境。
- 行内 `` `code` `` 样式**不改动**（范围外）。
- 新 transformer 与既有 `transformerNotationDiff/Highlight/WordHighlight` 并存，不得破坏 diff/高亮渲染。

---

### Task 1: Xcode 主题对象（light + dark）

**Files:**
- Create: `src/utils/themes/xcode-light.ts`
- Create: `src/utils/themes/xcode-dark.ts`
- Test: `src/utils/themes/xcode-themes.test.ts`

**Interfaces:**
- Consumes: `ThemeRegistrationRaw`（来自 `shiki` 类型）。
- Produces: `export const xcodeLight: ThemeRegistrationRaw`（`name: "xcode-light"`）、`export const xcodeDark: ThemeRegistrationRaw`（`name: "xcode-dark"`）。供 Task 3 的 `markdownPlugins.ts` 导入。

- [ ] **Step 1: 写失败测试**

`src/utils/themes/xcode-themes.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { codeToHtml } from "shiki";
import { xcodeLight } from "./xcode-light";
import { xcodeDark } from "./xcode-dark";

describe("xcode themes", () => {
  it("主题元信息正确", () => {
    expect(xcodeLight.name).toBe("xcode-light");
    expect(xcodeLight.type).toBe("light");
    expect(xcodeLight.colors?.["editor.background"]).toBe("#FFFFFF");
    expect(xcodeDark.name).toBe("xcode-dark");
    expect(xcodeDark.type).toBe("dark");
    expect(xcodeDark.colors?.["editor.background"]).toBe("#292A30");
  });

  it("关键字/字符串/注释着 Xcode 色（defaultColor:false 时以 CSS 变量内联）", async () => {
    const html = await codeToHtml('const x = "hi"; // note', {
      lang: "ts",
      themes: { light: xcodeLight, dark: xcodeDark },
      defaultColor: false,
    });
    // 关键字 const（light #AD3DA4 / dark #FF7AB2）
    expect(html).toContain("#AD3DA4");
    expect(html).toContain("#FF7AB2");
    // 字符串 "hi"（light #D12F1B）
    expect(html).toContain("#D12F1B");
    // 注释（light #5D6C79）
    expect(html).toContain("#5D6C79");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/utils/themes/xcode-themes.test.ts`
Expected: FAIL —— 找不到模块 `./xcode-light`。

- [ ] **Step 3: 写 `src/utils/themes/xcode-light.ts`**

```ts
import type { ThemeRegistrationRaw } from "shiki";

// Xcode Default (Light) 配色移植。scope 覆盖注释/关键字/字符串/数字/类型/函数/属性。
export const xcodeLight: ThemeRegistrationRaw = {
  name: "xcode-light",
  type: "light",
  colors: {
    "editor.background": "#FFFFFF",
    "editor.foreground": "#1F1F24",
  },
  tokenColors: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#5D6C79" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new"],
      settings: { foreground: "#AD3DA4" },
    },
    { scope: ["string", "string.quoted", "constant.other.symbol"], settings: { foreground: "#D12F1B" } },
    { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: "#272AD8" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: "#326D74" } },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type", "support.class", "entity.other.inherited-class"],
      settings: { foreground: "#3900A0" },
    },
    { scope: ["variable", "variable.parameter", "variable.other"], settings: { foreground: "#1F1F24" } },
    { scope: ["entity.name.tag"], settings: { foreground: "#AD3DA4" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#78492A" } },
    { scope: ["meta.preprocessor", "keyword.control.directive"], settings: { foreground: "#78492A" } },
  ],
};
```

- [ ] **Step 4: 写 `src/utils/themes/xcode-dark.ts`**

```ts
import type { ThemeRegistrationRaw } from "shiki";

// Xcode Default (Dark) 配色移植。scope 与 light 对齐，仅换颜色值。
export const xcodeDark: ThemeRegistrationRaw = {
  name: "xcode-dark",
  type: "dark",
  colors: {
    "editor.background": "#292A30",
    "editor.foreground": "#DFDFE0",
  },
  tokenColors: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#7F8C98" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new"],
      settings: { foreground: "#FF7AB2" },
    },
    { scope: ["string", "string.quoted", "constant.other.symbol"], settings: { foreground: "#FF8170" } },
    { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: "#D9C97C" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: "#67B7A4" } },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type", "support.class", "entity.other.inherited-class"],
      settings: { foreground: "#DABAFF" },
    },
    { scope: ["variable", "variable.parameter", "variable.other"], settings: { foreground: "#DFDFE0" } },
    { scope: ["entity.name.tag"], settings: { foreground: "#FF7AB2" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#FFA14F" } },
    { scope: ["meta.preprocessor", "keyword.control.directive"], settings: { foreground: "#FFA14F" } },
  ],
};
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/utils/themes/xcode-themes.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 6: 提交**

```bash
git add src/utils/themes/xcode-light.ts src/utils/themes/xcode-dark.ts src/utils/themes/xcode-themes.test.ts
git commit -m "feat(blog): 新增 Xcode 浅色/深色 Shiki 主题"
```

---

### Task 2: `transformerCodeWindow`（macOS 窗口容器）

**Files:**
- Create: `src/utils/transformers/codeWindow.js`
- Test: `src/utils/transformers/codeWindow.test.ts`

**Interfaces:**
- Consumes: Shiki transformer 上下文（`this.options.lang`、`this.options.meta.__raw`、`this.addClassToHast`）。
- Produces: `export function transformerCodeWindow(): ShikiTransformer`。输出把 `<pre>` 包进 `<figure class="xcode-window">`，标题栏含 `.xcode-dots` / `.xcode-filename`（有 `file="…"` meta 时）/ `.xcode-lang`（非 `text`/`plaintext` 时）/ `.xcode-copy`（始终，带 `data-copy`）；`<pre>` 加 `astro-code line-numbers` class。供 Task 3 导入。

> 说明：与既有 `src/utils/transformers/fileName.js` 一致用无类型 `.js`（避免 hast 类型摩擦）；`transformerCodeWindow` 取代 `transformerFileName`（文件名折叠进标题栏）。

- [ ] **Step 1: 写失败测试**

`src/utils/transformers/codeWindow.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { codeToHtml } from "shiki";
import { transformerCodeWindow } from "./codeWindow.js";
import { xcodeLight } from "../themes/xcode-light";
import { xcodeDark } from "../themes/xcode-dark";

function render(code: string, opts: { lang?: string; meta?: string } = {}) {
  return codeToHtml(code, {
    lang: opts.lang ?? "ts",
    themes: { light: xcodeLight, dark: xcodeDark },
    defaultColor: false,
    transformers: [transformerCodeWindow()],
    meta: opts.meta ? { __raw: opts.meta } : undefined,
  });
}

describe("transformerCodeWindow", () => {
  it("包裹为 xcode 窗口，含三彩点/复制按钮/行号 class/语言标签", async () => {
    const html = await render("const a = 1;");
    expect(html).toContain('class="xcode-window"');
    expect(html).toContain("xcode-titlebar");
    expect(html).toContain("xcode-dots");
    expect(html).toContain('class="xcode-copy" data-copy');
    expect(html).toContain("line-numbers");
    expect(html).toContain('class="xcode-lang">ts<');
  });

  it("有 file meta 时显示文件名", async () => {
    const html = await render("x", { meta: 'file="main.swift"' });
    expect(html).toContain('class="xcode-filename">main.swift<');
  });

  it("无 file meta 时不渲染文件名", async () => {
    const html = await render("x");
    expect(html).not.toContain("xcode-filename");
  });

  it("plaintext 语言隐藏语言标签", async () => {
    const html = await render("x", { lang: "text" });
    expect(html).not.toContain("xcode-lang");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/utils/transformers/codeWindow.test.ts`
Expected: FAIL —— 找不到 `./codeWindow.js`。

- [ ] **Step 3: 写 `src/utils/transformers/codeWindow.js`**

```js
/**
 * Shiki transformer：把代码块包成 macOS 窗口风容器。
 *
 * pre 钩子：给 <pre> 加 `astro-code line-numbers`（行号由 CSS counter 绘制）。
 * root 钩子：把 <pre> 包进 <figure class="xcode-window">，前置标题栏：
 *   三彩点 + 文件名（来自 fence meta file="…"，无则省略）+ 语言标签
 *   （this.options.lang，text/plaintext 时省略）+ 复制按钮（始终，data-copy）。
 * 取代旧的 transformerFileName（文件名折叠进标题栏）。
 */
export const transformerCodeWindow = () => ({
  name: "code-window",
  pre(node) {
    this.addClassToHast(node, "astro-code line-numbers");
  },
  root(node) {
    const pre = node.children.find(
      c => c.type === "element" && c.tagName === "pre"
    );
    if (!pre) return;

    // 语言标签：text/plaintext/无 → 不显示
    const rawLang = this.options.lang || "";
    const lang =
      rawLang && rawLang !== "text" && rawLang !== "plaintext" ? rawLang : "";

    // 文件名：解析 fence meta `file="main.swift"`
    let file = "";
    const raw = this.options.meta?.__raw;
    if (raw) {
      for (const item of raw.split(" ")) {
        const [k, v] = item.split("=");
        if (k === "file" && v) file = v.replace(/["'`]/g, "");
      }
    }

    const titlebar = [
      { type: "element", tagName: "span", properties: { class: "xcode-dots" }, children: [] },
    ];
    if (file) {
      titlebar.push({
        type: "element",
        tagName: "span",
        properties: { class: "xcode-filename" },
        children: [{ type: "text", value: file }],
      });
    }
    if (lang) {
      titlebar.push({
        type: "element",
        tagName: "span",
        properties: { class: "xcode-lang" },
        children: [{ type: "text", value: lang }],
      });
    }
    titlebar.push({
      type: "element",
      tagName: "button",
      properties: { class: "xcode-copy", "data-copy": "", type: "button" },
      children: [{ type: "text", value: "复制" }],
    });

    const figure = {
      type: "element",
      tagName: "figure",
      properties: { class: "xcode-window" },
      children: [
        { type: "element", tagName: "div", properties: { class: "xcode-titlebar" }, children: titlebar },
        pre,
      ],
    };
    node.children = [figure];
  },
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/utils/transformers/codeWindow.test.ts`
Expected: PASS（4 passed）。

> 若 `class="xcode-copy" data-copy` 断言因属性顺序失败，改断言 `expect(html).toMatch(/xcode-copy[^>]*data-copy/)` 并重跑。

- [ ] **Step 5: 提交**

```bash
git add src/utils/transformers/codeWindow.js src/utils/transformers/codeWindow.test.ts
git commit -m "feat(blog): 新增代码块 macOS 窗口 transformer"
```

---

### Task 3: 集中配置源，接入三处渲染

**Files:**
- Modify: `src/utils/markdownPlugins.ts`（换主题 + 换 transformer）
- Modify: `astro.config.ts:24-52`（改为从 markdownPlugins 导入，移除内联主题/transformer）
- Modify: `src/scripts/preview.ts:80-100, 182-186`（highlighter 主题与 codeToHtml 参数换共享配置）
- Test: `src/utils/markdownPlugins.test.ts`
- 无需改 `src/utils/renderMarkdown.ts`（已从 markdownPlugins 导入，自动继承新值）

**Interfaces:**
- Consumes: `xcodeLight`/`xcodeDark`（Task 1）、`transformerCodeWindow`（Task 2）。
- Produces: `markdownPlugins.ts` 导出 `shikiThemes = { light: xcodeLight, dark: xcodeDark }` 与 `shikiTransformers`（含 `transformerCodeWindow()` + 三个 notation transformer，**移除** `transformerFileName`）。

- [ ] **Step 1: 写失败测试**

`src/utils/markdownPlugins.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { shikiThemes, shikiTransformers } from "./markdownPlugins";

describe("markdownPlugins 共享 Shiki 配置", () => {
  it("主题为 Xcode 双主题，键名保持 light/dark", () => {
    expect(shikiThemes.light.name).toBe("xcode-light");
    expect(shikiThemes.dark.name).toBe("xcode-dark");
  });

  it("transformers 含 code-window，且保留 notation transformers", () => {
    const names = shikiTransformers.map(t => t.name);
    expect(names).toContain("code-window");
    // notation 系列仍在（diff/highlight/word-highlight）
    expect(names.some(n => n && n.includes("notation"))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/utils/markdownPlugins.test.ts`
Expected: FAIL —— `shikiThemes.light.name` 现为字符串 `"min-light"`（无 `.name`，报 undefined ≠ "xcode-light"）。

- [ ] **Step 3: 改写 `src/utils/markdownPlugins.ts`**

整文件替换为：

```ts
/**
 * 共享 markdown 插件配置：astro.config.ts（构建期）、renderMarkdown.ts（SSR）、
 * preview.ts（Studio 客户端）都引用，避免多套渲染分叉。
 *
 * Shiki 双主题：Xcode 浅色 / 深色，defaultColor:false（由 CSS 变量
 * --shiki-light-bg / --shiki-dark-bg 按 data-theme 切换）。代码块外观由
 * transformerCodeWindow 包成 macOS 窗口，文件名折叠进标题栏。
 */
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerCodeWindow } from "./transformers/codeWindow.js";
import { xcodeLight } from "./themes/xcode-light";
import { xcodeDark } from "./themes/xcode-dark";

export const shikiThemes = {
  light: xcodeLight,
  dark: xcodeDark,
} as const;

export const shikiTransformers = [
  transformerCodeWindow(),
  transformerNotationHighlight(),
  transformerNotationWordHighlight(),
  transformerNotationDiff({ matchAlgorithm: "v3" }),
];
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/utils/markdownPlugins.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 5: 改 `astro.config.ts` —— 从 markdownPlugins 导入**

删除这些内联 import（第 12-17 行的 transformers 与第 18 行 transformerFileName）：

```ts
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
```

替换为：

```ts
import { shikiThemes, shikiTransformers } from "./src/utils/markdownPlugins";
```

并把 `markdown.shikiConfig` 块（原第 44-55 行）改为：

```ts
    shikiConfig: {
      themes: shikiThemes,
      defaultColor: false,
      wrap: false,
      transformers: shikiTransformers,
    },
```

- [ ] **Step 6: 改 `src/scripts/preview.ts` —— highlighter 与 codeToHtml 用共享配置**

在文件顶部 import 区加：

```ts
import { shikiThemes, shikiTransformers } from "../utils/markdownPlugins";
import { xcodeLight } from "../utils/themes/xcode-light";
import { xcodeDark } from "../utils/themes/xcode-dark";
```

把 `getHighlighter()` 里 `themes: ["min-light", "night-owl"],` 改为：

```ts
        themes: [xcodeLight, xcodeDark],
```

把 `enhance()` 里的 `codeToHtml` 调用（原 `pre.outerHTML = out` 上方）改为：

```ts
            const out = hl.codeToHtml(code.textContent || "", {
              lang,
              themes: shikiThemes,
              defaultColor: false,
              transformers: shikiTransformers,
              meta: { __raw: "" },
            });
```

> `meta.__raw:""` 让 transformer 的文件名解析安全跳过（Studio 预览不解析 fence meta，无文件名——符合预期）。

- [ ] **Step 7: 类型检查 + 全量单测**

Run: `npm run typecheck && npm test`
Expected: typecheck 无错；vitest 全绿（含 Task 1/2/3 新测）。

- [ ] **Step 8: 提交**

```bash
git add src/utils/markdownPlugins.ts src/utils/markdownPlugins.test.ts astro.config.ts src/scripts/preview.ts
git commit -m "feat(blog): 三处渲染统一接入 Xcode 主题与窗口 transformer"
```

---

### Task 4: 窗口容器与行号样式（CSS）

**Files:**
- Modify: `src/styles/typography.css:98-123`（`.astro-code` 区块，扩展 `.xcode-window` 全局样式）

**Interfaces:**
- Consumes: Task 2 输出的 DOM 结构（`.xcode-window` / `.xcode-titlebar` / `.xcode-dots` / `.xcode-filename` / `.xcode-lang` / `.xcode-copy` / `pre.astro-code.line-numbers > code > span.line`）。
- Produces: 全局（不挂 `.app-prose`）的窗口与行号视觉，公开文章与 Studio 预览一致。

- [ ] **Step 1: 替换 `typography.css` 的「Code Blocks」区块**

把原第 98-123 行（`/* ===== Code Blocks & Syntax Highlighting ===== */` 到该 `@layer base` 内 `.astro-code { .line.diff… }` 结束）整段替换为：

```css
  /* ===== Code Blocks & Syntax Highlighting ===== */
  /* macOS 窗口容器：全局样式，公开文章与 Studio 预览共用（不挂 prose）。 */
  .xcode-window {
    @apply border-border my-4 overflow-hidden rounded-xl border shadow-sm;
  }

  .xcode-titlebar {
    @apply border-border bg-muted/60 flex items-center gap-2 border-b px-3 py-2 text-xs;
  }

  /* 三彩点：单元素 + box-shadow 画 3 个圆。 */
  .xcode-dots {
    @apply relative inline-block;
    width: 52px;
    height: 12px;
  }
  .xcode-dots::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 12px;
    height: 12px;
    border-radius: 9999px;
    background: #ff5f57;
    box-shadow:
      20px 0 0 #febc2e,
      40px 0 0 #28c840;
  }

  .xcode-filename {
    @apply text-foreground font-medium;
  }
  /* 语言标签靠右；无文件名时它仍靠右。 */
  .xcode-lang {
    @apply text-muted-foreground ml-auto tracking-wide uppercase;
  }
  /* 复制按钮：有语言标签时紧随其后；无语言标签时自身靠右。 */
  .xcode-copy {
    @apply text-muted-foreground hover:text-foreground ml-auto cursor-pointer rounded px-2 py-0.5;
  }
  .xcode-lang + .xcode-copy {
    @apply ml-0;
  }

  .astro-code {
    @apply bg-(--shiki-light-bg) text-(--shiki-light) [&_span]:text-(--shiki-light);
  }
  html[data-theme="dark"] .astro-code {
    @apply bg-(--shiki-dark-bg) text-(--shiki-dark) [&_span]:text-(--shiki-dark);
  }

  /* 行号：CSS counter 画左侧 gutter，不增加 DOM。 */
  .astro-code.line-numbers {
    counter-reset: xcode-line;
  }
  .astro-code.line-numbers .line {
    counter-increment: xcode-line;
  }
  .astro-code.line-numbers .line::before {
    content: counter(xcode-line);
    @apply text-muted-foreground/50 mr-4 inline-block w-8 pr-2 text-right select-none;
  }

  /* Shiki transformers 标记（diff/高亮），保持原样式。 */
  .astro-code {
    .line.diff.add {
      @apply relative inline-block w-full bg-green-400/20 before:absolute before:-left-3 before:text-green-500 before:content-['+'];
    }
    .line.diff.remove {
      @apply relative inline-block w-full bg-red-500/20 before:absolute before:-left-3 before:text-red-500 before:content-['-'];
    }
    .line.highlighted {
      @apply inline-block w-full bg-slate-400/20;
    }
    .highlighted-word {
      @apply border-border rounded-sm border px-0.5 py-px;
    }
  }
```

> 注意：原 `.astro-code` 的 `outline-border flex border` 已移除（边框改由 `.xcode-window` 承担）；`pre` 的 focus-visible 样式（第 93-95 行 `.app-prose pre {…}`）保留不动。

- [ ] **Step 2: 构建验证（CSS 无编译错误、产物生成）**

Run: `npm run build`
Expected: `astro build` 成功，`dist/` 生成，无 Tailwind/CSS 报错。

- [ ] **Step 3: 人工目视（浅色 + 深色）**

Run: `npm run dev` 后浏览器打开一篇含代码块的文章（或 About 页 `/blog/about`），确认：标题栏三彩点、行号 gutter、语言标签靠右、深浅色切换配色随 `data-theme` 变化。
Expected: 窗口容器 + 行号 + Xcode 配色正确显示。

- [ ] **Step 4: 提交**

```bash
git add src/styles/typography.css
git commit -m "feat(blog): 代码块 macOS 窗口与行号样式"
```

---

### Task 5: 复制按钮脚本（HTTP 安全）+ 挂载

**Files:**
- Create: `src/scripts/code-copy.ts`
- Modify: `src/layouts/Layout.astro:125-133`（在既有 `<script>` 旁加载 code-copy）

**Interfaces:**
- Consumes: DOM 中 `button.xcode-copy[data-copy]` 与其所在 `.xcode-window > pre`（Task 2/4）。
- Produces: 文档级委托点击处理，`Layout.astro` 加载。Studio 页面复用 `Layout`，自动覆盖预览动态插入的按钮。

- [ ] **Step 1: 写 `src/scripts/code-copy.ts`**

```ts
/**
 * 代码块复制按钮：文档级事件委托（可覆盖 Studio 预览 innerHTML 重渲染后
 * 新插入的按钮）。HTTP 非安全上下文下 navigator.clipboard 不可用，回退
 * 隐藏 textarea + execCommand。行号由 CSS ::before 生成，不进 textContent，
 * 故复制得到干净代码。
 */
function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise<void>((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy") ? resolve() : reject(new Error("execCommand failed"));
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

document.addEventListener("click", async e => {
  const target = e.target as HTMLElement;
  const btn = target.closest<HTMLButtonElement>("[data-copy]");
  if (!btn) return;
  const pre = btn.closest(".xcode-window")?.querySelector("pre");
  const text = pre?.textContent ?? "";
  const prev = btn.textContent;
  try {
    await copyText(text);
    btn.textContent = "已复制";
  } catch {
    btn.textContent = "复制失败";
  }
  window.setTimeout(() => {
    btn.textContent = prev;
  }, 1500);
});
```

- [ ] **Step 2: 在 `Layout.astro` 挂载**

在 `Layout.astro` 既有的 `<script> import "@/scripts/theme"; </script>` 之后新增：

```astro
    <script>
      import "@/scripts/code-copy";
    </script>
```

- [ ] **Step 3: 类型检查**

Run: `npm run typecheck`
Expected: 无类型错误。

- [ ] **Step 4: 人工验证复制**

Run: `npm run dev`，打开含代码块文章，点击「复制」→ 变「已复制」→1.5s 复原；粘贴得到无行号的原始代码。Studio（`/blog/studio/`）预览区代码块同样可复制。
Expected: 两处复制均生效。

- [ ] **Step 5: 提交**

```bash
git add src/scripts/code-copy.ts src/layouts/Layout.astro
git commit -m "feat(blog): 代码块复制按钮（HTTP 回退 execCommand）"
```

---

### Task 6: e2e 断言 + 最终门槛

**Files:**
- Modify: `e2e/smoke.spec.ts`（在内容组追加代码块窗口断言）

**Interfaces:**
- Consumes: 已发布文章页的 `.xcode-window` 结构（需后端，`FLUXBLOG_E2E_BASE_URL` 指向已部署站点时运行；无后端时 `test.skip`，与既有内容组一致）。
- Produces: 回归保护。

- [ ] **Step 1: 在 `e2e/smoke.spec.ts` 内容组追加**

在文件末尾（`test.skip(!hasBackend, …)` 之后的内容组区域）追加：

```ts
test("文章代码块为 Xcode 窗口风（含行号/复制，需后端）", async ({ page }) => {
  test.skip(!hasBackend, "需要 FLUXBLOG_E2E_BASE_URL 指向含代码块文章的站点");
  // 通过内容组约定：首页第一篇文章通常含代码；按站点实际调整 slug。
  await page.goto("./");
  const firstPost = page.locator("a[href*='/blog/posts/']").first();
  await firstPost.click();
  const win = page.locator(".xcode-window").first();
  await expect(win).toBeVisible();
  await expect(win.locator(".xcode-dots")).toBeVisible();
  await expect(win.locator(".xcode-copy")).toBeVisible();
  // 行号 gutter：第一行 ::before 计数存在（检查 line 元素存在即可）
  await expect(win.locator("pre.line-numbers .line").first()).toBeVisible();
});
```

- [ ] **Step 2: CI 安全性验证（无后端应 skip，不 fail）**

Run: `npm run build && npx playwright test e2e/smoke.spec.ts --project=desktop`
Expected: 预渲染用例通过；新内容组用例 **skipped**（无 `FLUXBLOG_E2E_BASE_URL`），不报错。

- [ ] **Step 3: 最终硬门槛全过**

Run: `npm run typecheck && npm test && npm run build`
Expected: 三者全绿。

- [ ] **Step 4: 提交**

```bash
git add e2e/smoke.spec.ts
git commit -m "test(blog): 代码块窗口 e2e 断言（内容组）"
```

---

## Self-Review

**Spec coverage：**
- 块级配色→Xcode → Task 1（主题）+ Task 3（接入）。✅
- macOS 窗口容器（三彩点/文件名标题栏）→ Task 2（transformer）+ Task 4（CSS）。✅
- 行号 → Task 2（`line-numbers` class）+ Task 4（CSS counter）。✅
- 复制按钮（HTTP 安全）→ Task 2（按钮 DOM）+ Task 5（脚本 + 挂载）。✅
- 语言标签 → Task 2（`.xcode-lang`）+ Task 4（CSS）。✅
- 标题栏无文件名也显示 → Task 2（dots/lang/copy 恒在，仅文件名条件渲染）+ 测试覆盖。✅
- Studio 预览一致 → Task 3 Step 6（preview.ts 接共享主题+transformers）。✅
- 消除三处分叉 → Task 3（单一配置源）。✅
- 行内 code 不动 → 全程未触碰 `typography.css` 第 73-79 行 `.app-prose code`。✅
- HTTP clipboard 回退 → Task 5 `copyText`。✅
- 未知语言回退 → preview.ts 既有 try/catch + `lang` 兜底保留（Task 3 未改该逻辑）。✅

**Placeholder scan：** 无 TBD/TODO；每个改动步骤含完整代码或精确 diff。✅

**Type consistency：** `shikiThemes`/`shikiTransformers`（Task 3）↔ `xcodeLight`/`xcodeDark`（Task 1）↔ `transformerCodeWindow`（Task 2，`name: "code-window"`）↔ CSS 类名（Task 4）↔ `[data-copy]`/`.xcode-window`/`pre`（Task 5）全对齐。✅
