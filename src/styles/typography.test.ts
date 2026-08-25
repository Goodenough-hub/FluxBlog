import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 样式契约测试：直接读 typography.css 源码，防斜体样式回归。
// （CSS 无法 DOM 断言，插件默认 blockquote/h3 斜体曾被覆盖，需守住回归点。）
const css = readFileSync(
  fileURLToPath(new URL("./typography.css", import.meta.url)),
  "utf8"
);

/** 提取 `.app-prose` 内某个规则块的内容（简单按 selector { … } 匹配）。 */
function ruleBody(selector: string): string | null {
  const m = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
}

describe("typography.css 斜体样式契约", () => {
  it("blockquote 覆盖插件默认斜体（回归点：> 引用不再是斜体）", () => {
    const body = ruleBody("blockquote");
    expect(body).not.toBeNull();
    expect(body).toContain("not-italic");
  });

  it("h3 不再显式启用斜体（回归点：三级标题正体）", () => {
    const body = ruleBody("h3");
    expect(body ?? "").not.toContain("italic");
  });
});
