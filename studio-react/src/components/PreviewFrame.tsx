import { useEffect, useRef, useState } from "react";

interface PreviewFrameProps {
  markdown: string;
  // 渲染端点：POST {markdown} → {html}
  endpoint?: string;
  // 防抖 ms
  debounceMs?: number;
}

// 双栏左预览：debounce 后 fetch /blog/api/preview-render，把 HTML 设为 iframe srcdoc。
// 服务端走 FluxBlog 同源 remark/rehype + Shiki + KaTeX + Mermaid，所见即发布。
// Mermaid 在 iframe 内由 Layout 客户端按需 import；KaTeX 服务端输出已含样式。
export default function PreviewFrame({
  markdown,
  endpoint = "/blog/api/preview-render",
  debounceMs = 300,
}: PreviewFrameProps) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      let cancelled = false;
      // 取消上一笔未完成的请求
      inflightRef.current?.abort();
      const ctrl = new AbortController();
      inflightRef.current = ctrl;
      setLoading(true);
      setError(null);
      fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
        signal: ctrl.signal,
      })
        .then(async (r) => {
          const data = await r.json();
          if (cancelled) return;
          if (!r.ok) {
            setError(data?.error || `HTTP ${r.status}`);
            return;
          }
          setHtml(data.html || "");
        })
        .catch((e) => {
          if (e?.name === "AbortError") return;
          if (!cancelled) setError(e?.message || "渲染失败");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [markdown, endpoint, debounceMs]);

  // iframe srcdoc：注入基础样式 + 渲染 HTML + 暗色跟随父文档
  const isDark =
    typeof document !== "undefined" &&
    (document.documentElement.dataset.theme === "dark" ||
      document.documentElement.classList.contains("dark"));

  const srcDoc = `<!doctype html>
<html lang="zh-CN" data-theme="${isDark ? "dark" : "light"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<base target="_blank" />
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; padding: 16px; background: ${
    isDark ? "#0f172a" : "#ffffff"
  }; color: ${isDark ? "#e2e8f0" : "#0f172a"}; }
  body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.7; }
  img { max-width: 100%; }
  pre { overflow-x: auto; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid ${
    isDark ? "#1e293b" : "#e2e8f0"
  }; padding: 6px 12px; }
  a { color: ${isDark ? "#818cf8" : "#6366f1"}; }
  blockquote { border-left: 3px solid ${
    isDark ? "#334155" : "#cbd5e1"
  }; margin: 0; padding: 4px 16px; color: ${
    isDark ? "#94a3b8" : "#64748b"
  }; }
  /* KaTeX 服务端已注入 CSS（<link>）；Mermaid 在客户端按需 import，这里不预加载 */
</style>
</head>
<body class="prose-app">
${html || '<p style="color:#94a3b8;font-style:italic">正在渲染…</p>'}
</body>
</html>`;

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
        title="预览"
        srcDoc={srcDoc}
        className="h-full w-full border-0"
        sandbox="allow-same-origin allow-popups"
      />
    </div>
  );
}
