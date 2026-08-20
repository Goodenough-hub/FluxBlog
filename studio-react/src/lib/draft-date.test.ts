import { describe, expect, it } from "vitest";
import { formatDraftDate } from "./draft-date";

describe("formatDraftDate", () => {
  it("将文章时间格式化为表格展示内容", () => {
    expect(formatDraftDate("2026-08-20T14:30:00")).toEqual({
      dateTime: "08-20 14:30",
      year: "2026",
    });
  });

  it("未发布文章不展示发布时间", () => {
    expect(formatDraftDate(null)).toBeNull();
    expect(formatDraftDate()).toBeNull();
  });
});
