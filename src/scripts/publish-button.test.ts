import { describe, it, expect } from "vitest";
import { publishLabel } from "./publish-button";

describe("publishLabel", () => {
  it("draft → 发布", () => {
    expect(publishLabel({ status: "draft" })).toBe("发布");
  });
  it("published 且有未发布修改 → 更新发布", () => {
    expect(
      publishLabel({ status: "published", hasUnpublishedChanges: true })
    ).toBe("更新发布");
  });
  it("published 且无未发布修改 → 已发布", () => {
    expect(
      publishLabel({ status: "published", hasUnpublishedChanges: false })
    ).toBe("已发布");
    expect(publishLabel({ status: "published" })).toBe("已发布");
  });
});
