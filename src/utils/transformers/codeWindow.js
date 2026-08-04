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
