import { describe, it, expect, vi } from "vitest";
import { SaveController, type SaveInput } from "./save-controller";

const input: SaveInput = { title: "T", slug: "s", tags: ["a"], markdown: "m" };

describe("SaveController", () => {
  it("flush 前不调用 save", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const c = new SaveController(save, 1500);
    expect(c.dirty).toBe(false);
    c.schedule(input, 1);
    expect(c.dirty).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("flush 触发挂起保存并返回其 Promise", async () => {
    let resolveSave: () => void = () => {};
    const save = vi.fn(
      () => new Promise<void>(r => { resolveSave = r; }),
    );
    const c = new SaveController(save, 1500);
    c.schedule({ ...input, markdown: "edited" }, 1);
    const p = c.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ markdown: "edited" }), 1);
    resolveSave();
    await p;
    expect(c.dirty).toBe(false);
  });

  it("flush 在无 pending 时直接 resolve（不调用 save）", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const c = new SaveController(save, 1500);
    await c.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("冲突（save reject）时 flush 向上抛出，使发布可中止", async () => {
    const save = vi.fn().mockRejectedValue(new Error("409"));
    const c = new SaveController(save, 1500);
    c.schedule(input, 1);
    await expect(c.flush()).rejects.toThrow("409");
  });

  it("连续 schedule 只保留最后一次输入，flush 保存最新内容", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const c = new SaveController(save, 1500);
    c.schedule({ ...input, markdown: "v1" }, 1);
    c.schedule({ ...input, markdown: "v2" }, 1);
    c.schedule({ ...input, markdown: "v3" }, 1);
    await c.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ markdown: "v3" }), 1);
  });
});
