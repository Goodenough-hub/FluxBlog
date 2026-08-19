const blockTags = new Set([
  "blockquote",
  "div",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ol",
  "p",
  "pre",
  "table",
  "ul",
]);

/** Add Markdown source lines to rendered blocks for Studio scroll syncing. */
export default function rehypeSourcePosition() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (
        node?.type === "element" &&
        blockTags.has(node.tagName) &&
        node.position?.start?.line &&
        node.position?.end?.line
      ) {
        node.properties ??= {};
        node.properties["data-source-start"] ??= node.position.start.line;
        node.properties["data-source-end"] ??= node.position.end.line;
      }

      if (Array.isArray(node?.children)) {
        for (const child of node.children) walk(child);
      }
    };

    walk(tree);
  };
}
