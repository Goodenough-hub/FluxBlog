// 已废弃：AppPilot 不再产出 frontmatter（发布改为 DB 同步翻转，不再提交 Git Markdown），
// posts content collection 也已移除。此契约测试失去意义。
// 占位以避免 vitest "no test suite" 报错；可安全 git rm 此文件。
import { describe, it } from "vitest";

describe.skip("frontmatter 契约（已废弃）", () => {
  it("placeholder", () => {});
});
