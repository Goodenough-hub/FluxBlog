import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  createPreviewFrameState,
  previewFrameReducer,
  type FrameSlot,
} from "../lib/preview-frame-state";

export interface PreviewFrameHandle {
  // 取 iframe 内部滚动根（document.scrollingElement），供 useScrollSync 用
  getScrollEl: () => HTMLElement | null;
}

interface PreviewFrameProps {
  draftId: number;
  // savedVersion 变化（自动保存成功后）→ iframe src query 变化 → 浏览器平滑重新加载
  // 不用 React key 重挂载，避免 unmount→mount 引起的白屏闪烁。
  reloadKey: number | string;
  // iframe 每次加载完成后触发——外部据此重抓 scrollingElement（旧引用已随重载失效）
  onReady?: (scrollElement: HTMLElement | null) => void;
  // 同一草稿刷新前捕获编辑器位置，供新文档加载后恢复。
  onBeforeReload?: () => void;
}

// 双栏左预览：iframe 直接加载 SSR 路由 /blog/preview-draft/<id>，
// 复用 PostLayout + global.css(含 typography.css 的 .astro-code/.xcode-window)
// + katex.min.css + Mermaid 客户端脚本，所见即发布。
const PreviewFrame = forwardRef<PreviewFrameHandle, PreviewFrameProps>(
  function PreviewFrame(
    { draftId, reloadKey, onReady, onBeforeReload },
    ref
  ) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const iframeRefs = useRef<
      [HTMLIFrameElement | null, HTMLIFrameElement | null]
    >([null, null]);
    const initialUrl = `/blog/preview-draft/${draftId}?v=${reloadKey}`;
    const [frames, dispatch] = useReducer(
      previewFrameReducer,
      initialUrl,
      createPreviewFrameState
    );
    const previousRequestRef = useRef({ draftId, reloadKey });
    // 待激活 iframe 的 RAF：定位后延一帧再切显示，避免过期请求或卸载时误激活。
    const activateFrameRef = useRef<number | null>(null);

    useEffect(
      () => () => {
        if (activateFrameRef.current !== null) {
          cancelAnimationFrame(activateFrameRef.current);
        }
      },
      []
    );

    const getScrollElement = (slot: FrameSlot) => {
      const doc = iframeRefs.current[slot]?.contentDocument;
      const el = doc?.scrollingElement;
      const FrameHTMLElement = doc?.defaultView?.HTMLElement;
      return el && FrameHTMLElement && el instanceof FrameHTMLElement
        ? (el as HTMLElement)
        : null;
    };

    useImperativeHandle(ref, () => ({
      getScrollEl: () => getScrollElement(frames.activeSlot),
    }));

    // 草稿切换时显示 loading；reloadKey 变化时也短暂提示
    useEffect(() => {
      const previous = previousRequestRef.current;
      if (previous.draftId === draftId && previous.reloadKey !== reloadKey) {
        onBeforeReload?.();
      }
      previousRequestRef.current = { draftId, reloadKey };
      setLoading(true);
      setError(null);
      dispatch({
        type: "queue",
        url: `/blog/preview-draft/${draftId}?v=${reloadKey}`,
      });
    }, [draftId, reloadKey, onBeforeReload]);

    return (
      <div className="relative h-full w-full">
        {loading && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white">
            渲染中…
          </div>
        )}
        {error && (
          <div className="absolute inset-3 z-10 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
        {frames.urls.map((src, index) => {
          if (!src) return null;
          const slot = index as FrameSlot;
          const active = slot === frames.activeSlot;
          return (
            <iframe
              key={slot}
              ref={element => {
                iframeRefs.current[slot] = element;
              }}
              title={active ? "预览" : "正在更新预览"}
              src={src}
              aria-hidden={!active}
              tabIndex={active ? 0 : -1}
              className={`absolute inset-0 h-full w-full border-0 ${
                active ? "visible" : "invisible pointer-events-none"
              }`}
              onLoad={() => {
                const scrollElement = getScrollElement(slot);
                if (slot === frames.pendingSlot) {
                  // 隐藏文档先定位到目标位置，再延一帧提交显示——保证切换瞬间
                  // 新 iframe 已停在当前位置，而不是先露出文章顶部再滚过去。
                  onReady?.(scrollElement);
                  if (activateFrameRef.current !== null) {
                    cancelAnimationFrame(activateFrameRef.current);
                  }
                  activateFrameRef.current = requestAnimationFrame(() => {
                    activateFrameRef.current = null;
                    dispatch({ type: "activate", slot });
                  });
                } else if (active) {
                  onReady?.(scrollElement);
                }
                setLoading(false);
                setError(null);
              }}
            />
          );
        })}
      </div>
    );
  }
);

export default PreviewFrame;
