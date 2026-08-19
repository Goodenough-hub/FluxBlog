export interface ScrollAnchor {
  sourceLine: number;
  top: number;
}

export interface SourcePosition {
  sourceLine: number;
  edge?: "start" | "end";
}

export function countSourceLines(markdown: string): number {
  return Math.max(1, markdown.split("\n").length);
}

export function sourceLineAtOffset(markdown: string, offset: number): number {
  return markdown.slice(0, Math.max(0, offset)).split("\n").length;
}

export function normalizeAnchors(anchors: ScrollAnchor[]): ScrollAnchor[] {
  const sorted = [...anchors]
    .filter(
      anchor =>
        Number.isFinite(anchor.sourceLine) && Number.isFinite(anchor.top)
    )
    .sort((a, b) => a.top - b.top || a.sourceLine - b.sourceLine);

  const result: ScrollAnchor[] = [];
  for (const anchor of sorted) {
    const previous = result[result.length - 1];
    if (previous && anchor.sourceLine < previous.sourceLine) continue;
    if (
      previous &&
      anchor.top === previous.top &&
      anchor.sourceLine === previous.sourceLine
    ) {
      continue;
    }
    result.push(anchor);
  }
  return result;
}

function interpolate(
  value: number,
  fromA: number,
  fromB: number,
  toA: number,
  toB: number
): number {
  if (fromA === fromB) return toA;
  const ratio = (value - fromA) / (fromB - fromA);
  return toA + ratio * (toB - toA);
}

export function sourceLineAtPoint(
  anchors: ScrollAnchor[],
  point: number
): number {
  if (!anchors.length) return 1;
  if (point <= anchors[0].top) return anchors[0].sourceLine;

  for (let i = 1; i < anchors.length; i++) {
    const current = anchors[i];
    if (point <= current.top) {
      const previous = anchors[i - 1];
      return interpolate(
        point,
        previous.top,
        current.top,
        previous.sourceLine,
        current.sourceLine
      );
    }
  }
  return anchors[anchors.length - 1].sourceLine;
}

export function pointAtSourceLine(
  anchors: ScrollAnchor[],
  sourceLine: number
): number {
  if (!anchors.length) return 0;
  if (sourceLine <= anchors[0].sourceLine) return anchors[0].top;

  for (let i = 1; i < anchors.length; i++) {
    const current = anchors[i];
    if (sourceLine <= current.sourceLine) {
      const previous = anchors[i - 1];
      return interpolate(
        sourceLine,
        previous.sourceLine,
        current.sourceLine,
        previous.top,
        current.top
      );
    }
  }
  return anchors[anchors.length - 1].top;
}

export function readSourcePosition(
  anchors: ScrollAnchor[],
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  guideRatio = 0.3
): SourcePosition {
  const max = Math.max(0, scrollHeight - clientHeight);
  if (scrollTop <= 1) return { sourceLine: 1, edge: "start" };
  if (max > 0 && scrollTop >= max - 1) {
    return {
      sourceLine: anchors.at(-1)?.sourceLine ?? 1,
      edge: "end",
    };
  }
  return {
    sourceLine: sourceLineAtPoint(
      anchors,
      scrollTop + clientHeight * guideRatio
    ),
  };
}

export function scrollTopForSourcePosition(
  anchors: ScrollAnchor[],
  position: SourcePosition,
  clientHeight: number,
  scrollHeight: number,
  guideRatio = 0.3
): number {
  const max = Math.max(0, scrollHeight - clientHeight);
  if (position.edge === "start") return 0;
  if (position.edge === "end") return max;
  const point = pointAtSourceLine(anchors, position.sourceLine);
  return Math.min(max, Math.max(0, point - clientHeight * guideRatio));
}
