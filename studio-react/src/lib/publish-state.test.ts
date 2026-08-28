import { describe, expect, it } from "vitest";
import { editorPublishState } from "./publish-state";

describe("editorPublishState", () => {
  it("草稿显示发布按钮", () => {
    expect(
      editorPublishState({ status: "draft", dirty: false })
    ).toBe("publish");
  });

  it("已发布且无修改时只显示撤回", () => {
    expect(
      editorPublishState({
        status: "published",
        hasUnpublishedChanges: false,
        dirty: false,
      })
    ).toBe("published-clean");
    // hasUnpublishedChanges 缺省（字段可选）视为无未发布修改
    expect(editorPublishState({ status: "published", dirty: false })).toBe(
      "published-clean"
    );
  });

  it("已发布且服务端标记有未发布修改时显示更新发布", () => {
    expect(
      editorPublishState({
        status: "published",
        hasUnpublishedChanges: true,
        dirty: false,
      })
    ).toBe("republish");
  });

  it("已发布且本地有未保存修改时立即显示更新发布（不等服务端往返）", () => {
    expect(
      editorPublishState({
        status: "published",
        hasUnpublishedChanges: false,
        dirty: true,
      })
    ).toBe("republish");
    expect(editorPublishState({ status: "published", dirty: true })).toBe(
      "republish"
    );
  });

  it("草稿即使有本地修改也不显示更新发布", () => {
    expect(editorPublishState({ status: "draft", dirty: true })).toBe(
      "publish"
    );
  });
});
