import { describe, expect, it } from "vitest";
import {
  normalizeAnchors,
  pointAtSourceLine,
  readSourcePosition,
  scrollTopForSourcePosition,
  sourceLineAtPoint,
} from "./scroll-position";

const anchors = [
  { sourceLine: 1, top: 100 },
  { sourceLine: 11, top: 500 },
  { sourceLine: 21, top: 1300 },
];

describe("源码行滚动映射", () => {
  it("在相邻锚点之间双向插值", () => {
    expect(sourceLineAtPoint(anchors, 300)).toBe(6);
    expect(pointAtSourceLine(anchors, 16)).toBe(900);
  });

  it("两侧高度不同仍映射到同一源码行", () => {
    const editorAnchors = [
      { sourceLine: 1, top: 0 },
      { sourceLine: 101, top: 2000 },
    ];
    const previewAnchors = [
      { sourceLine: 1, top: 300 },
      { sourceLine: 101, top: 5300 },
    ];
    const position = readSourcePosition(
      editorAnchors,
      800,
      400,
      2400
    );

    expect(position.sourceLine).toBe(47);
    expect(
      scrollTopForSourcePosition(previewAnchors, position, 400, 5700)
    ).toBe(2480);
  });

  it("顶部和底部在重载后保持边界位置", () => {
    expect(readSourcePosition(anchors, 0, 400, 1700).edge).toBe("start");
    const end = readSourcePosition(anchors, 1300, 400, 1700);
    expect(end.edge).toBe("end");
    expect(scrollTopForSourcePosition(anchors, end, 600, 2600)).toBe(2000);
  });

  it("过滤逆序锚点，缺少锚点时安全降级", () => {
    expect(
      normalizeAnchors([
        { sourceLine: 10, top: 100 },
        { sourceLine: 5, top: 200 },
        { sourceLine: 20, top: 300 },
      ])
    ).toEqual([
      { sourceLine: 10, top: 100 },
      { sourceLine: 20, top: 300 },
    ]);
    expect(sourceLineAtPoint([], 500)).toBe(1);
    expect(pointAtSourceLine([], 20)).toBe(0);
  });
});
