const SESSION_KEY = 'fluxblog_analytics_sid'

// crypto.randomUUID() 仅在安全上下文（HTTPS/localhost）可用；线上纯 HTTP 下它是
// undefined，裸调会抛 TypeError。故不可用时回退到时间戳+随机串。
function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY)
  if (!sid) {
    sid = uid()
    sessionStorage.setItem(SESSION_KEY, sid)
  }
  return sid
}

// 埋点必须彻底 fire-and-forget：无论构造 payload（读 sessionStorage、生成 sid）还是
// 网络请求出错都不得抛出，否则会污染 astro:page-load 的事件派发并在控制台报错。
export function trackPageview(): void {
  try {
    fetch('/api/v1/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'fluxblog',
        eventType: 'pageview',
        path: window.location.pathname,
        title: document.title,
        sessionId: getSessionId(),
      }),
    }).catch(() => {
      // 网络失败静默忽略
    })
  } catch {
    // 同步构造失败（如 sessionStorage 被禁用）静默忽略
  }
}

// Track initial page load and client-side navigations (Astro ClientRouter).
// `astro:page-load` fires on both initial load and client-side navigations,
// so a single listener covers both cases.
if (typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', trackPageview)
}
