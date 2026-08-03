const SESSION_KEY = 'fluxblog_analytics_sid'

function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY)
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, sid)
  }
  return sid
}

function trackPageview(): void {
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
    // fire-and-forget
  })
}

// Track initial page load
trackPageview()

// Track client-side navigations (Astro ClientRouter)
document.addEventListener('astro:page-load', trackPageview)
