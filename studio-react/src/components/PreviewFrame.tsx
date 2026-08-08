import { useEffect, useRef, useState } from "react";

interface PreviewFrameProps {
  draftId: number;
  // savedVersion 变化（自动保存成功后）→ iframe src query 变化 → 浏览器平滑重新加载
  // 不用 React key 重挂载，避免 unmount→mount 引起的白屏闪烁。
  reloadKey: number | string;
}

// 双栏左预览：iframe 直接加载 SSR 路由 /blog/preview-draft/<id>，
// 复用 PostLayout + global.css(含 typography.css 的 .astro-code/.xcode-window)
// + katex.min.css + Mermaid 客户端脚本，所见即发布。
export default function PreviewFrame({ draftId, reloadKey }: PreviewFrameProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
          // iframe 内部 SSR 返回 401 时浏览器无明显信号，靠内容判断。简化：只要 load 完成就清 loading
          setError(null);
        }}
      />
    </div>
  );
}
