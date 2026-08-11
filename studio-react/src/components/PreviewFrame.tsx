import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

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
  onReady?: () => void;
}

// 双栏左预览：iframe 直接加载 SSR 路由 /blog/preview-draft/<id>，
// 复用 PostLayout + global.css(含 typography.css 的 .astro-code/.xcode-window)
// + katex.min.css + Mermaid 客户端脚本，所见即发布。
const PreviewFrame = forwardRef<PreviewFrameHandle, PreviewFrameProps>(
  function PreviewFrame({ draftId, reloadKey, onReady }, ref) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useImperativeHandle(ref, () => ({
      getScrollEl: () => {
        const doc = iframeRef.current?.contentDocument;
        const el = doc?.scrollingElement;
        return el && el instanceof HTMLElement ? el : null;
      },
    }));

    // 草稿切换时显示 loading；reloadKey 变化时也短暂提示
    useEffect(() => {
      setLoading(true);
      setError(null);
    }, [draftId, reloadKey]);

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
        <iframe
          ref={iframeRef}
          title="预览"
          src={`/blog/preview-draft/${draftId}?v=${reloadKey}`}
          className="h-full w-full border-0"
          onLoad={() => {
            setLoading(false);
            setError(null);
            onReady?.();
          }}
        />
      </div>
    );
  }
);

export default PreviewFrame;
