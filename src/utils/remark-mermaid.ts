/**
 * remarkMermaid 把 ```mermaid 代码块转换为 <div class="mermaid" data-mermaid>。
 * 渲染在客户端按需进行：仅当页面存在 [data-mermaid] 元素时，基础布局才会
 * 动态 import mermaid 并 run()，避免无图表文章加载大体积客户端脚本。
 *
 * 纯实现，不引入 unist-util-visit/mdast 类型包，避免额外依赖。
 * transformer 参数用 any 以兼容 unified 的 Root 类型签名。
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function remarkMermaid() {
  return (tree: any) => {
    const walk = (node: any, parent: any, index: number) => {
      if (
        node?.type === "code" &&
        node.lang === "mermaid" &&
        parent &&
        Array.isArray(parent.children)
      ) {
        const sourcePosition = node.position;
        const sourceAttrs =
          sourcePosition?.start?.line && sourcePosition?.end?.line
            ? ` data-source-start="${sourcePosition.start.line}" data-source-end="${sourcePosition.end.line}"`
            : "";
        parent.children[index] = {
          type: "html",
          value: `<div class="mermaid" data-mermaid${sourceAttrs}>${escapeHtml(node.value ?? "")}</div>`,
          position: sourcePosition,
        };
        return;
      }
      const kids = node?.children;
      if (Array.isArray(kids)) {
        for (let i = 0; i < kids.length; i++) walk(kids[i], node, i);
      }
    };
    walk(tree, null, 0);
  };
}
