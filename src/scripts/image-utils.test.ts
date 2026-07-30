import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAcceptedImage, fitToEdge, MAX_RAW } from "./image-utils";

describe("image policy", () => {
  it("接受 JPEG/PNG/WebP/GIF，拒绝 SVG 与其他", () => {
    expect(isAcceptedImage(new File([], "a.jpg", { type: "image/jpeg" }))).toBe(
      true
    );
    expect(isAcceptedImage(new File([], "a.png", { type: "image/png" }))).toBe(
      true
    );
    expect(
      isAcceptedImage(new File([], "a.webp", { type: "image/webp" }))
    ).toBe(true);
    expect(isAcceptedImage(new File([], "a.gif", { type: "image/gif" }))).toBe(
      true
    );
    expect(
      isAcceptedImage(new File([], "a.svg", { type: "image/svg+xml" }))
    ).toBe(false);
    expect(isAcceptedImage(new File([], "a.bmp", { type: "image/bmp" }))).toBe(
      false
    );
    expect(isAcceptedImage(new File([], "a.txt", { type: "text/plain" }))).toBe(
      false
    );
  });

  it("fitToEdge：最长边≤2560 不缩放", () => {
    expect(fitToEdge(800, 600)).toEqual({ w: 800, h: 600 });
    expect(fitToEdge(2560, 1440)).toEqual({ w: 2560, h: 1440 });
  });

  it("fitToEdge：最长边>2560 按比例缩到 2560", () => {
    const r = fitToEdge(4000, 2000);
    expect(r.w).toBe(2560);
    expect(r.h).toBe(1280);
    const r2 = fitToEdge(2000, 4000);
    expect(r2.h).toBe(2560);
    expect(r2.w).toBe(1280);
  });

  it("原文件上限 25MiB", () => {
    expect(MAX_RAW).toBe(25 * 1024 * 1024);
  });
});
