import { useEffect, useState } from "react";

interface PreviewFrameProps {
  draftId: number;
  // baseVersion 或 savedVersion 变化时刷新 iframe：用作 React key
  reloadKey: number | string;
}

// 双栏左预览：iframe 直接加载 SSR 路由 /blog/preview-draft/<id>，
// 复用 PostLayout + global.css(含 typography.css 的 .astro-code/.xcode-window)
// + katex.min.css + Mermaid 客户端脚本，所见即发布。
// reloadKey 变化（自动保存成功后 savedVersion 累加）→ 整个 iframe 重挂载。
export default function PreviewFrame({ draftId, reloadKey }: PreviewFrameProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    fetch(`/blog/preview-draft/${draftId}`, {
      credentials: "include",
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          setError(`HTTP ${r.status}`);
        }
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError(e?.message || "预览加载失败");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [draftId, reloadKey]);

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute right-3 top-3 z-10 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white">
          渲染中…
        </div>
      )}
      {error && (
        <div className="absolute inset-3 z-10 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      <iframe
        key={`${draftId}-${reloadKey}`}
        title="预览"
        src={`/blog/preview-draft/${draftId}`}
        className="h-full w-full border-0"
      />
    </div>
  );
}
