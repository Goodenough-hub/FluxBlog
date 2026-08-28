import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../i18n/lang/en";
import zhCN from "../i18n/lang/zh-CN";

const previewSource = readFileSync(
  fileURLToPath(new URL("../pages/preview/index.astro", import.meta.url)),
  "utf8"
);
const homeSource = readFileSync(
  fileURLToPath(new URL("../pages/index.astro", import.meta.url)),
  "utf8"
);

describe("博客预览贡献图", () => {
  it("预览页使用包含私有文章的 admin-preview 数据源", () => {
    expect(previewSource).toContain("listAllPostsForAdmin");
    expect(previewSource).toContain("posts={all}");
    expect(previewSource).toContain("labels={t.preview.contribution}");
    expect(previewSource).toContain("showPrivateCounts={true}");
  });

  it("公开首页继续使用公开发布口径，不显示私有数量", () => {
    expect(homeSource).toContain("listPublicPosts");
    expect(homeSource).toContain("labels={t.home.contribution}");
    expect(homeSource).not.toContain("showPrivateCounts");
  });

  it("中英文预览文案都明确包含私有文章统计", () => {
    expect(zhCN.preview.contribution.title).toContain("含私有");
    expect(zhCN.preview.contribution.summary).toContain("{{privateCount}}");
    expect(zhCN.preview.contribution.dayWithPrivate).toContain(
      "{{privateCount}}"
    );
    expect(en.preview.contribution.summary).toContain("{{privateCount}}");
    expect(en.preview.contribution.dayWithPrivate).toContain(
      "{{privateCount}}"
    );
  });
});
