function isCsdnImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "csdnimg.cn" || url.hostname.endsWith(".csdnimg.cn"))
    );
  } catch {
    return false;
  }
}

/** Prevent CSDN image hotlink protection from rejecting cross-site requests. */
export default function rehypeCsdnImages() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (node?.type === "element" && node.tagName === "img") {
        const src = node.properties?.src;
        if (isCsdnImageUrl(src)) {
          const url = new URL(src);
          if (url.hash === "#pic_center") url.hash = "";

          node.properties.src = url.href;
          node.properties.referrerPolicy = "no-referrer";
        }
      }

      if (Array.isArray(node?.children)) {
        for (const child of node.children) walk(child);
      }
    };

    walk(tree);
  };
}
