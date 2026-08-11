import { useEffect, useRef } from "react";

// 双向比例滚动同步：A 滚 → B 按 (scrollTop/scrollMax) 比例滚，反之亦然。
// syncingRef 防止"程序滚动触发的 scroll 事件"再反向同步形成回环。
// 比例而非按行/像素：markdown 源码与渲染后 HTML 高度差异大，比例最稳。
export function useScrollSync(a: HTMLElement | null, b: HTMLElement | null) {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!a || !b) return;

    const sync = (src: HTMLElement, dst: HTMLElement) => {
      if (syncingRef.current) return;
      const srcMax = src.scrollHeight - src.clientHeight;
      const dstMax = dst.scrollHeight - dst.clientHeight;
      if (dstMax <= 0) return;
      const ratio = srcMax > 0 ? src.scrollTop / srcMax : 0;
      syncingRef.current = true;
      dst.scrollTop = ratio * dstMax;
      // 下一帧清标记：浏览器异步派发 scroll 事件，rAF 足以覆盖程序滚动派发的事件
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };

    const onScrollA = () => sync(a, b);
    const onScrollB = () => sync(b, a);

    a.addEventListener("scroll", onScrollA, { passive: true });
    b.addEventListener("scroll", onScrollB, { passive: true });
    return () => {
      a.removeEventListener("scroll", onScrollA);
      b.removeEventListener("scroll", onScrollB);
    };
  }, [a, b]);
}
