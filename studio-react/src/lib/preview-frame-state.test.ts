import { describe, expect, it } from "vitest";
import {
  createPreviewFrameState,
  previewFrameReducer,
} from "./preview-frame-state";

describe("预览 iframe 双缓冲", () => {
  it("新文档加载期间继续显示旧文档", () => {
    const initial = createPreviewFrameState("/preview?v=1");
    const loading = previewFrameReducer(initial, {
      type: "queue",
      url: "/preview?v=2",
    });

    expect(loading.activeSlot).toBe(0);
    expect(loading.pendingSlot).toBe(1);
    expect(loading.urls).toEqual(["/preview?v=1", "/preview?v=2"]);
  });

  it("仅在隐藏文档完成定位后切换并清理旧文档", () => {
    const loading = previewFrameReducer(
      createPreviewFrameState("/preview?v=1"),
      { type: "queue", url: "/preview?v=2" }
    );
    const unchanged = previewFrameReducer(loading, {
      type: "activate",
      slot: 0,
    });
    const active = previewFrameReducer(loading, {
      type: "activate",
      slot: 1,
    });

    expect(unchanged).toBe(loading);
    expect(active.activeSlot).toBe(1);
    expect(active.pendingSlot).toBeNull();
    expect(active.urls).toEqual([null, "/preview?v=2"]);
  });
});
