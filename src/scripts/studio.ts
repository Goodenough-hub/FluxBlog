/**
 * FluxBlog Studio 客户端应用（v1：纯 textarea 编辑器 + 完整发布管线）。
 *
 * 覆盖：登录、草稿列表/创建/编辑、1.5s 防抖自动保存、baseVersion 乐观锁
 * （冲突 409 展示服务端版本）、IndexedDB 未同步恢复副本、图片粘贴/上传、
 * 发布/撤回 + job 轮询。Milkdown Crepe 富文本渲染为下一迭代（见页面注释）。
 *
 * 后端：${PUBLIC_BLOG_API}（默认同源 /api/v1/blog）。
 */
import { initDB, saveSnapshot, loadSnapshot, clearSnapshot } from "./studio-idb";

const API = import.meta.env.PUBLIC_BLOG_API || "/api/v1/blog";
const TOKEN_KEY = "fluxblog_token";

type Draft = {
  id: number;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  cover: string | null;
  markdown: string;
  status: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

// ---------- 简易 API ----------
async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (res.status === 401) {
    throw new ApiError(401, "未登录或令牌失效");
  }
  if (!res.ok) {
    let detail: any = null;
    try { detail = await res.json(); } catch {}
    throw new ApiError(res.status, detail?.error || `HTTP ${res.status}`, detail);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

class ApiError extends Error {
  constructor(public status: number, msg: string, public detail?: any) {
    super(msg);
  }
}

// ---------- 防抖 ----------
function debounce<T extends (...a: any[]) => any>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  const wrapped = (...args: Parameters<T>) => {
    lastArgs = args;
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; if (lastArgs) fn(...lastArgs); }, ms);
  };
  wrapped.flush = () => { if (t) { clearTimeout(t); t = null; if (lastArgs) fn(...lastArgs); } };
  return wrapped as T & { flush: () => void };
}

// ---------- 应用 ----------
const app = document.getElementById("studio-app")!;

let state: { token?: string; drafts: Draft[]; current?: Draft; dirty: boolean } = {
  drafts: [],
  dirty: false,
};

function render() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return renderLogin();
  if (!state.current) return renderList();
  renderEditor();
}

function renderLogin() {
  app.innerHTML = `
    <section class="studio-card">
      <h1>FluxBlog Studio</h1>
      <form id="login-form">
        <input name="username" placeholder="用户名" required />
        <input name="password" type="password" placeholder="密码" required />
        <button type="submit">登录</button>
      </form>
      <p class="studio-hint">独立博客账号，与 FinFlow/AppPilot 账号隔离。</p>
    </section>`;
  app.querySelector("#login-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    const fd = new FormData(f);
    try {
      const r = await api<{ token: string }>(`/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
      });
      localStorage.setItem(TOKEN_KEY, r.token);
      await reloadDrafts();
      render();
    } catch (err: any) {
      alert(err.message);
    }
  });
}

async function reloadDrafts() {
  try {
    state.drafts = await api<Draft[]>(`/drafts`);
  } catch (err: any) {
    if (err.status === 401) localStorage.removeItem(TOKEN_KEY);
    state.drafts = [];
  }
}

function renderList() {
  const rows = state.drafts.map(d => `
    <tr data-id="${d.id}">
      <td>${escapeHtml(d.title || d.slug)}</td>
      <td><span class="status status-${d.status}">${d.status}</span></td>
      <td>v${d.version}</td>
      <td>${escapeHtml(d.updatedAt || "")}</td>
    </tr>`).join("");
  app.innerHTML = `
    <section class="studio-list">
      <h1>草稿</h1>
      <form id="new-form" class="studio-row">
        <input name="slug" placeholder="slug（小写字母数字连字符）" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        <input name="title" placeholder="标题" required />
        <button type="submit">新建</button>
      </form>
      <table><thead><tr><th>标题</th><th>状态</th><th>版本</th><th>更新</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty">暂无草稿</td></tr>'}</tbody></table>
      <p class="studio-hint">编辑器 v1：纯文本。Milkdown Crepe 富文本渲染为下一迭代。</p>
    </section>`;
  app.querySelector("#new-form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const d = await api<Draft>(`/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: fd.get("slug"), title: fd.get("title"), markdown: "" }),
      });
      state.current = d; render();
    } catch (err: any) { alert(err.message); }
  });
  app.querySelectorAll("tr[data-id]").forEach(tr => {
    tr.addEventListener("click", async () => {
      const id = Number((tr as HTMLElement).dataset.id);
      const d = state.drafts.find(x => x.id === id);
      if (d) { state.current = d; await recoverOrRender(); }
    });
  });
}

async function recoverOrRender() {
  const d = state.current!;
  // IndexedDB 恢复：若有未同步副本且版本相同，提示恢复。
  const snap = await loadSnapshot(d.id, d.version);
  if (snap && snap.markdown !== d.markdown) {
    if (confirm("检测到未同步的本地草稿副本，是否恢复？")) {
      d.markdown = snap.markdown;
      d.title = snap.title ?? d.title;
    }
  }
  renderEditor();
}

function renderEditor() {
  const d = state.current!;
  app.innerHTML = `
    <section class="studio-editor">
      <div class="studio-toolbar">
        <button id="back">← 列表</button>
        <span class="status status-${d.status}">${d.status} · v${d.version}</span>
        <span id="save-state" class="studio-hint"></span>
        <button id="publish">${d.status === "published" ? "撤回" : "发布"}</button>
      </div>
      <input id="title" value="${escapeAttr(d.title)}" placeholder="标题" />
      <input id="slug" value="${escapeAttr(d.slug)}" placeholder="slug" />
      <input id="tags" value="${escapeAttr((d.tags || []).join(","))}" placeholder="标签，逗号分隔" />
      <textarea id="markdown" placeholder="Markdown 正文…">${escapeHtml(d.markdown)}</textarea>
      <p class="studio-hint">自动保存（1.5s 防抖）。版本冲突会提示比较后停止覆盖。</p>
    </section>`;
  const setSave = (s: string) => (app.querySelector("#save-state")!.textContent = s);
  const gather = (): Partial<Draft> => ({
    title: (app.querySelector("#title") as HTMLInputElement).value,
    slug: (app.querySelector("#slug") as HTMLInputElement).value,
    tags: (app.querySelector("#tags") as HTMLInputElement).value.split(",").map(s => s.trim()).filter(Boolean),
    markdown: (app.querySelector("#markdown") as HTMLTextAreaElement).value,
  });

  const save = debounce(async () => {
    if (!state.current) return;
    const baseVersion = state.current.version;
    setSave("保存中…");
    const body = { ...gather(), baseVersion };
    try {
      const updated = await api<Draft>(`/drafts/${state.current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      state.current = updated;
      state.dirty = false;
      // 已同步：清除该 baseVersion 的本地恢复副本。
      await clearSnapshot(updated.id, baseVersion);
      setSave("已保存 ✓");
    } catch (err: any) {
      if (err.status === 409) {
        setSave("版本冲突 ⚠");
        const server = err.detail?.serverVersion;
        // 停止覆盖，展示冲突比较
        alert(`版本冲突：服务端版本=${server}，本地 baseVersion=${baseVersion}。\n请刷新后基于最新版本再编辑。`);
        // 拉取服务端最新
        try {
          state.current = await api<Draft>(`/drafts/${state.current.id}`);
          renderEditor();
        } catch {}
      } else {
        setSave("保存失败：" + err.message);
      }
    }
  }, 1500);

  // 输入即暂存到 IndexedDB + 标脏 + 触发防抖
  const onInput = () => {
    state.dirty = true;
    setSave("编辑中…");
    const g = gather();
    saveSnapshot(d.id, d.version, { title: g.title || "", markdown: g.markdown || "" });
    save();
  };
  app.querySelector("#title")!.addEventListener("input", onInput);
  app.querySelector("#slug")!.addEventListener("input", onInput);
  app.querySelector("#tags")!.addEventListener("input", onInput);
  app.querySelector("#markdown")!.addEventListener("input", onInput);
  // 图片粘贴/上传：插入 /api/v1/blog/assets/:id 预览链接
  app.querySelector("#markdown")!.addEventListener("paste", onPaste);
  app.querySelector("#back")!.addEventListener("click", async () => {
    save.flush();
    await reloadDrafts();
    state.current = undefined;
    render();
  });
  app.querySelector("#publish")!.addEventListener("click", onPublish);
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) { e.preventDefault(); }
  });
}

async function onPaste(e: Event) {
  const ce = e as ClipboardEvent;
  const files = Array.from(ce.clipboardData?.files || []).filter(f => f.type.startsWith("image/"));
  if (!files.length) return;
  e.preventDefault();
  const ta = e.target as HTMLTextAreaElement;
  for (const f of files) {
    const url = await uploadImage(f, state.current!.id);
    if (!url) continue;
    const insert = `\n![${f.name}](${url})\n`;
    const start = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
    ta.dispatchEvent(new Event("input"));
  }
}

async function uploadImage(file: File, draftId: number): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("draftId", String(draftId));
  try {
    const r = await api<{ previewUrl: string }>(`/assets`, { method: "POST", body: fd });
    return r.previewUrl;
  } catch (err: any) {
    alert("图片上传失败：" + err.message);
    return null;
  }
}

async function onPublish() {
  const d = state.current!;
  const action = d.status === "published" ? "unpublish" : "publish";
  try {
    const r = await api<{ jobId: number; status: string }>(`/drafts/${d.id}/${action}`, { method: "POST" });
    alert(`已提交${action === "publish" ? "发布" : "撤回"}任务 #${r.jobId}（${r.status}）。等待 GitHub Actions 构建回调。`);
    // 轮询 job
    pollJob(r.jobId);
  } catch (err: any) {
    alert(err.message);
  }
}

async function pollJob(jobId: number) {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const job = await api<{ status: string }>(`/publish-jobs/${jobId}`);
      if (job.status === "succeeded" || job.status === "failed") {
        state.current = await api<Draft>(`/drafts/${state.current!.id}`);
        renderEditor();
        alert(`任务 #${jobId} ${job.status}`);
        return;
      }
    } catch { /* retry */ }
  }
}

// ---------- 工具 ----------
function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

// ---------- 启动 ----------
(async function main() {
  await initDB();
  if (localStorage.getItem(TOKEN_KEY)) await reloadDrafts();
  render();
})();
