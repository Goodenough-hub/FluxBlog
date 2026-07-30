/**
 * FluxBlog Studio 客户端应用。
 *
 * 桌面固定双栏：左侧 Milkdown Crepe 编辑、右侧实时预览（Mermaid/KaTeX/Shiki/
 * 受保护图片 Blob）。移动端在窄屏自动堆叠。切换草稿或退出时销毁编辑器、
 * 预览与 SaveController。鉴权走 auth（令牌刷新 + 401 重放）；图片走 image-utils
 * （WebP/EXIF）。自动保存为 SaveController 严格 single-flight + 乐观锁。
 */
import { api } from "./api-client";
import { isLoggedIn, login, clearSession } from "./auth";
import { SaveController, type SaveInput } from "./save-controller";
import { PreviewRenderer } from "./preview";
import { MilkdownEditor } from "./milkdown-editor";
import { publishLabel } from "./publish-button";
import {
  initDB,
  saveSnapshot,
  loadSnapshot,
  clearSnapshot,
} from "./studio-idb";

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
  publishedVersion?: number | null;
  hasUnpublishedChanges?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const app = document.getElementById("studio-app")!;

let state: { drafts: Draft[]; current?: Draft } = { drafts: [] };
let saveCtl: SaveController | null = null;
let preview: PreviewRenderer | null = null;
let editor: MilkdownEditor | null = null;
let beforeunloadBound = false;

function render() {
  if (!isLoggedIn()) return renderLogin();
  if (!state.current) return renderList();
  void renderEditor();
}

// ==================== 登录 ====================

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
  app.querySelector("#login-form")!.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const ok = await login(
      String(fd.get("username")),
      String(fd.get("password"))
    );
    if (!ok) {
      alert("用户名或密码错误");
      return;
    }
    await reloadDrafts();
    render();
  });
}

// ==================== 列表 ====================

async function reloadDrafts() {
  try {
    state.drafts = await api<Draft[]>(`/drafts`);
  } catch {
    state.drafts = [];
  }
}

function renderList() {
  const rows = state.drafts
    .map(
      d => `<tr data-id="${d.id}">
        <td>${escapeHtml(d.title || d.slug)}</td>
        <td><span class="status status-${d.status}">${d.status}</span>${d.hasUnpublishedChanges ? '<span class="badge-dot" title="有未发布修改">●</span>' : ""}</td>
        <td>v${d.version}${d.publishedVersion != null ? `/已发v${d.publishedVersion}` : ""}</td>
        <td>${escapeHtml(d.updatedAt || "")}</td>
      </tr>`
    )
    .join("");
  app.innerHTML = `
    <section class="studio-list">
      <div class="studio-toolbar">
        <h1 style="margin:0">草稿</h1>
        <button id="logout" class="btn-ghost">退出登录</button>
      </div>
      <form id="new-form" class="studio-row">
        <input name="slug" placeholder="slug（中文/小写字母/数字/连字符）" required pattern="[a-z0-9一-龥]+(-[a-z0-9一-龥]+)*" />
        <input name="title" placeholder="标题" required />
        <button type="submit" class="btn-primary">新建</button>
      </form>
      <table><thead><tr><th>标题</th><th>状态</th><th>版本</th><th>更新</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty">暂无草稿</td></tr>'}</tbody></table>
    </section>`;
  app.querySelector("#logout")!.addEventListener("click", () => {
    clearSession();
    state.drafts = [];
    state.current = undefined;
    render();
  });
  app.querySelector("#new-form")!.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const d = await api<Draft>(`/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: fd.get("slug"),
          title: fd.get("title"),
          markdown: "",
        }),
      });
      state.current = d;
      render();
    } catch (err: any) {
      alert(err.message);
    }
  });
  app.querySelectorAll("tr[data-id]").forEach(tr => {
    tr.addEventListener("click", async () => {
      const id = Number((tr as HTMLElement).dataset.id);
      const d = state.drafts.find(x => x.id === id);
      if (d) {
        state.current = d;
        await recoverOrRender();
      }
    });
  });
}

// ==================== 编辑器 ====================

async function recoverOrRender() {
  const d = state.current!;
  const snap = await loadSnapshot(d.id, d.version);
  if (snap && snap.markdown !== d.markdown) {
    if (confirm("检测到未同步的本地草稿副本，是否恢复？")) {
      d.markdown = snap.markdown;
      d.title = snap.title ?? d.title;
      d.slug = snap.slug || d.slug;
      d.description = snap.description ?? d.description;
      d.tags = snap.tags
        ? snap.tags
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
        : d.tags;
      d.cover = snap.cover || d.cover;
    }
  }
  await renderEditor();
}

async function renderEditor() {
  const d = state.current!;
  const publishLabel2 = publishLabel(d);
  app.innerHTML = `
    <section class="studio-editor">
      <div class="studio-toolbar">
        <button id="back" class="btn-ghost">← 列表</button>
        <span class="status status-${d.status}">${d.status} · v${d.version}</span>
        <span id="save-state" class="studio-hint"></span>
        <span class="spacer"></span>
        <button id="history" class="btn-ghost">历史</button>
        <button id="publish" class="btn-primary">${publishLabel2}</button>
        <button id="logout" class="btn-ghost">退出</button>
      </div>
      <div class="studio-meta">
        <input id="title" value="${escapeAttr(d.title)}" placeholder="标题" />
        <input id="slug" value="${escapeAttr(d.slug)}" placeholder="slug" />
        <input id="tags" value="${escapeAttr((d.tags || []).join(","))}" placeholder="标签，逗号分隔" />
        <input id="description" value="${escapeAttr(d.description || "")}" placeholder="摘要" />
        <input id="cover" value="${escapeAttr(d.cover || "")}" placeholder="封面 URL（可选）" />
      </div>
      <div class="studio-dual">
        <div class="studio-pane"><div class="pane-label">编辑</div><div id="editor" class="editor-root"></div></div>
        <div class="studio-pane"><div class="pane-label">预览</div><div id="preview" class="preview-root prose-app"></div></div>
      </div>
      <p class="studio-hint">自动保存（1.5s 防抖，single-flight）。版本冲突会双栏比较后由你决定。线上站点需单独手动部署。</p>
    </section>`;
  const setSave = (s: string) =>
    (app.querySelector("#save-state")!.textContent = s);

  preview = new PreviewRenderer(app.querySelector("#preview") as HTMLElement);
  preview.schedule(d.markdown);

  editor = new MilkdownEditor({
    root: app.querySelector("#editor") as HTMLElement,
    defaultValue: d.markdown,
    draftId: d.id,
    onChange: md => {
      preview?.schedule(md);
      gatherAndSchedule(md);
    },
  });
  await editor.create();

  const val = (sel: string) =>
    (app.querySelector(sel) as HTMLInputElement).value;
  const gather = (markdown: string): SaveInput => ({
    title: val("#title"),
    slug: val("#slug"),
    tags: val("#tags")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),
    description: val("#description"),
    cover: val("#cover"),
    markdown,
  });
  const gatherAndSchedule = (md: string) => {
    const g = gather(md);
    setSave("编辑中…");
    saveSnapshot(d.id, d.version, {
      slug: g.slug,
      title: g.title,
      description: g.description,
      tags: g.tags.join(","),
      cover: g.cover,
      markdown: g.markdown,
    });
    saveCtl?.schedule(g, d.version);
  };

  saveCtl = new SaveController(
    async (input: SaveInput, baseVersion: number) => {
      if (!state.current) return;
      setSave("保存中…");
      try {
        const updated = await api<Draft>(`/drafts/${state.current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, baseVersion }),
        });
        state.current = updated;
        await clearSnapshot(updated.id, baseVersion);
        setSave("已保存 ✓");
      } catch (err: any) {
        if (err.status === 409) {
          setSave("版本冲突 ⚠");
          const server = await api<Draft>(`/drafts/${state.current.id}`);
          await showConflict(server, input);
        } else {
          setSave("保存失败：" + err.message);
        }
        throw err;
      }
    },
    1500
  );

  ["#title", "#slug", "#tags", "#description", "#cover"].forEach(sel =>
    app
      .querySelector(sel)!
      .addEventListener("input", () =>
        gatherAndSchedule(editor?.getMarkdown() ?? "")
      )
  );

  app.querySelector("#back")!.addEventListener("click", async () => {
    await teardown();
    await reloadDrafts();
    state.current = undefined;
    render();
  });
  app.querySelector("#publish")!.addEventListener("click", onPublish);
  app.querySelector("#history")!.addEventListener("click", onHistory);
  app.querySelector("#logout")!.addEventListener("click", async () => {
    await teardown();
    clearSession();
    state.current = undefined;
    render();
  });
  if (!beforeunloadBound) {
    beforeunloadBound = true;
    window.addEventListener("beforeunload", e => {
      if (saveCtl?.dirty) e.preventDefault();
    });
  }
}

async function teardown() {
  if (saveCtl) {
    try {
      await saveCtl.flush();
    } catch {
      /* 冲突已在 UI 处理 */
    }
    saveCtl.destroy();
    saveCtl = null;
  }
  if (editor) {
    await editor.destroy();
    editor = null;
  }
  if (preview) {
    preview.destroy();
    preview = null;
  }
}

// ==================== 历史 ====================

async function onHistory() {
  if (!state.current) return;
  try {
    const vs = await api<
      {
        id: number;
        version: number;
        title: string;
        markdown: string;
        createdAt: string;
      }[]
    >(`/drafts/${state.current.id}/versions`);
    showHistoryDrawer(vs);
  } catch (err: any) {
    alert("加载历史失败：" + err.message);
  }
}

function showHistoryDrawer(
  vs: {
    id: number;
    version: number;
    title: string;
    markdown: string;
    createdAt: string;
  }[]
) {
  const list = vs
    .map(
      v => `<div class="history-item" data-version="${v.version}">
        <div class="history-meta">v${v.version} · ${escapeHtml(v.title)} <span class="muted">${escapeHtml(v.createdAt)}</span></div>
        <div class="history-summary">${escapeHtml(v.markdown.slice(0, 120))}</div>
        <div class="history-actions"><button class="btn-ghost" data-restore="${v.version}">恢复</button></div>
      </div>`
    )
    .join("");
  const overlay = document.createElement("div");
  overlay.className = "modal-backdrop";
  overlay.innerHTML = `<div class="glass-panel modal-card history-card">
    <h3 style="margin-top:0">历史版本</h3>
    <div class="history-list">${list || '<p class="muted">暂无检查点</p>'}</div>
    <button class="btn-ghost" id="hist-close" style="width:100%">关闭</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay
    .querySelector("#hist-close")!
    .addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelectorAll("[data-restore]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const version = Number((btn as HTMLElement).dataset.restore);
      overlay.remove();
      await restoreVersion(version);
    });
  });
}

async function restoreVersion(version: number) {
  if (!state.current) return;
  if (
    !confirm(
      `恢复到 v${version}？当前未保存内容会先 flush，恢复结果作为新版本（不覆盖历史）。`
    )
  )
    return;
  try {
    await teardown();
    const d = await api<Draft>(
      `/drafts/${state.current.id}/versions/${version}/restore`,
      { method: "POST" }
    );
    state.current = d;
    await renderEditor();
  } catch (err: any) {
    alert("恢复失败：" + err.message);
    await renderEditor();
  }
}

// ==================== 发布 ====================

async function onPublish() {
  const d = state.current!;
  const action = d.status === "published" ? "unpublish" : "publish";
  // 发布/撤回前先 flush 自动保存。
  if (saveCtl) {
    try {
      await saveCtl.flush();
    } catch {
      alert("有未保存的冲突，已取消发布。请先解决版本冲突。");
      return;
    }
  }
  try {
    const r = await api<{
      jobId: number | null;
      status: string;
      noop?: boolean;
    }>(`/drafts/${d.id}/${action}`, {
      method: "POST",
    });
    if (r.noop || r.status === "succeeded") {
      state.current = await api<Draft>(`/drafts/${state.current!.id}`);
      await renderEditor();
      alert(
        `${action === "publish" ? "发布" : "撤回"}成功。内容已提交 Git 仓库；线上站点需单独手动部署。`
      );
      return;
    }
    alert(
      `已提交${action === "publish" ? "发布" : "撤回"}任务（${r.status}）。`
    );
    pollJob(r.jobId as number);
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
        if (state.current)
          state.current = await api<Draft>(`/drafts/${state.current.id}`);
        await renderEditor();
        alert(`任务 #${jobId} ${job.status}`);
        return;
      }
    } catch {
      /* retry */
    }
  }
}

// ==================== 冲突 ====================

async function showConflict(server: Draft, localInput: SaveInput) {
  const overlay = document.createElement("div");
  overlay.className = "modal-backdrop";
  overlay.innerHTML = `
    <div class="glass-panel modal-card conflict-card">
      <h3 style="margin-top:0">版本冲突</h3>
      <p class="studio-hint">服务端版本 v${server.version} 与本地编辑不一致。选择如何处理：</p>
      <div class="conflict-cols">
        <div><div class="studio-hint">服务端</div><textarea readonly>${escapeHtml(server.markdown)}</textarea></div>
        <div><div class="studio-hint">本地</div><textarea readonly>${escapeHtml(localInput.markdown)}</textarea></div>
      </div>
      <div class="admin-form-row">
        <button id="cf-use-server" class="btn-ghost">用服务端版本</button>
        <button id="cf-keep-local" class="btn-primary">保留本地（基于服务端版本重存）</button>
        <button id="cf-cancel" class="btn-ghost">取消</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  await new Promise<void>(resolve => {
    overlay
      .querySelector("#cf-use-server")!
      .addEventListener("click", async () => {
        await teardown();
        state.current = server;
        await renderEditor();
        overlay.remove();
        resolve();
      });
    overlay
      .querySelector("#cf-keep-local")!
      .addEventListener("click", async () => {
        try {
          const updated = await api<Draft>(`/drafts/${server.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...localInput,
              baseVersion: server.version,
            }),
          });
          await teardown();
          state.current = updated;
          await renderEditor();
        } catch (err: any) {
          alert("重存失败：" + err.message);
        }
        overlay.remove();
        resolve();
      });
    overlay.querySelector("#cf-cancel")!.addEventListener("click", () => {
      overlay.remove();
      resolve();
    });
  });
}

// ==================== 工具 ====================

function escapeHtml(s: string) {
  return s.replace(
    /[&<>]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!
  );
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

// ==================== 启动 ====================

(async function main() {
  await initDB();
  if (isLoggedIn()) await reloadDrafts();
  render();
})();
