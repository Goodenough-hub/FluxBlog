import { describe, it, expect, vi } from "vitest";
import { SaveController, type SaveInput } from "./save-controller";

const input = (md: string): SaveInput => ({
  title: "T", slug: "s", tags: ["a"], description: "D", cover: "", markdown: md,
});

describe("SaveController single-flight", () => {
  it("schedule 后未到防抖时间不调用 save", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const c = new SaveController(save, 1500);
    expect(c.dirty).toBe(false);
    c.schedule(input("m"), 1);
    expect(c.dirty).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("慢请求期间继续输入时不并发发送，flush 保存最新内容", async () => {
    let resolveFirst: () => void = () => {};
    let calls = 0;
    const save = vi.fn(() => {
      calls++;
      if (calls === 1) return new Promise<void>(r => { resolveFirst = r; });
      return Promise.resolve();
    });
    const c = new SaveController(save, 1500);
    c.schedule(input("v1"), 1);          // 触发 pump（计时器）
    const p = c.flush();                 // 进入在途：保存 v1（慢）
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ markdown: "v1" }), 1);
    c.schedule(input("v2"), 1);          // 在途期间又来新输入
    resolveFirst();                       // v1 完成 → flush 循环保存 v2（快）
    await p;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ markdown: "v2" }), 1);
    expect(c.dirty).toBe(false);
  });

  it("连续 schedule 只保留最后一次", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const c = new SaveController(save, 1500);
    c.schedule(input("v1"), 1);
    c.schedule(input("v2"), 1);
    c.schedule(input("v3"), 1);
    await c.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ markdown: "v3" }), 1);
  });

  it("无 pending 时 flush 直接 resolve（不调用 save）", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const c = new SaveController(save, 1500);
    await c.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("冲突进入 blocked，禁止后续 schedule，flush 抛出", async () => {
    const onBlocked = vi.fn();
    const save = vi.fn().mockRejectedValue(new Error("409"));
    const c = new SaveController(save, 1500, onBlocked);
    c.schedule(input("m"), 1);
    await expect(c.flush()).rejects.toThrow();
    expect(c.isBlocked).toBe(true);
    expect(onBlocked).toHaveBeenCalled();
    // blocked 后 schedule 被忽略
    c.schedule(input("m2"), 1);
    await c.flush().catch(() => {});
    expect(save).toHaveBeenCalledTimes(1); // 没有第二次
    // 解决冲突后恢复
    c.resolveConflict();
    expect(c.isBlocked).toBe(false);
    expect(c.dirty).toBe(false);
  });
});
