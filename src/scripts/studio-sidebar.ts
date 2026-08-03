/**
 * Studio 左侧栏：project 树 + 拖拽管理。
 * 由 studio.ts 在 main() 启动时调用 initSidebar()。
 */

import { api } from "./api-client";

export interface SidebarProject {
  id: number;
  name: string;
  intro: string;
  postCount: number;
}

export interface SidebarDraft {
  id: number;
  title: string;
  slug: string;
  projectId: number | null;
  updatedAt: string;
}

const EXPANDED_KEY = "fluxblog_proj_expanded";

let sidebar: HTMLElement | null = null;
let projects: SidebarProject[] = [];
let drafts: SidebarDraft[] = [];
let selectedDraftId: number | null = null;
let onSelectDraft: ((id: number) => void) | null = null;
let onDraftsChanged: (() => void) | null = null;

export function initSidebar(opts: {
  onSelectDraft: (id: number) => void;
  onDraftsChanged: () => void;
}) {
  sidebar = document.getElementById("studio-sidebar");
  if (!sidebar) return;
  onSelectDraft = opts.onSelectDraft;
  onDraftsChanged = opts.onDraftsChanged;
  void reload();
}

async function reload() {
  try {
    projects = await api<SidebarProject[]>("/projects");
  } catch {
    projects = [];
  }
  render();
}

export function setDrafts(d: SidebarDraft[]) {
  drafts = d;
  render();
}

export function setSelectedDraftId(id: number | null) {
  selectedDraftId = id;
  render();
}

export async function refreshAfterSave() {
  await reload();
  onDraftsChanged?.();
}

function render() {
  if (!sidebar) return;
  const expanded = loadExpanded();

  const projectItems = projects
    .map(p => {
      const isOpen = expanded.has(p.id);
      const projectDrafts = drafts.filter(d => d.projectId === p.id);
      const sorted = [...projectDrafts].sort(
        (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
      );
      const chev = isOpen ? "▾" : "▸";
      return `<div class="sidebar-project" data-project-id="${p.id}" draggable="true">
        <span class="sidebar-project__chev">${chev}</span>
        <span class="sidebar-project__name">${esc(p.name)}</span>
        <span class="sidebar-project__count">${sorted.length}</span>
        <span class="sidebar-project__actions">
          <button data-action="rename" title="重命名">✎</button>
          <button data-action="delete" title="删除">✕</button>
        </span>
      </div>
      ${isOpen ? sorted.map(d => draftRow(d)).join("") : ""}`;
    })
    .join("");

  const uncategorized = drafts.filter(d => !d.projectId);
  const uncategorizedSorted = [...uncategorized].sort(
    (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
  );
  const isUncatOpen = expanded.has(-1);

  sidebar.innerHTML = `
    <div class="sidebar-bar">
      <button id="sb-new-project" class="sidebar-btn sidebar-btn--primary">+ 新建项目</button>
    </div>
    <div id="sb-projects">${projectItems || '<p class="studio-hint" style="padding:8px">暂无项目</p>'}</div>
    <div class="sidebar-uncategorized" data-project-id="-1">
      <span class="sidebar-project__chev">${isUncatOpen ? "▾" : "▸"}</span>
      <span class="sidebar-project__name">未分类</span>
      <span class="sidebar-project__count">${uncategorized.length}</span>
    </div>
    ${isUncatOpen ? uncategorizedSorted.map(d => draftRow(d)).join("") : ""}
  `;

  bindEvents();
}

function draftRow(d: SidebarDraft) {
  const active = d.id === selectedDraftId ? " sidebar-draft--active" : "";
  return `<div class="sidebar-draft${active}" data-draft-id="${d.id}" draggable="true">${esc(d.title || d.slug)}</div>`;
}

function esc(s: string) {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function loadExpanded(): Set<number> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {}
  return new Set();
}

function saveExpanded(set: Set<number>) {
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...set]));
}

function toggleExpanded(id: number) {
  const set = loadExpanded();
  if (set.has(id)) set.delete(id);
  else set.add(id);
  saveExpanded(set);
}

function bindEvents() {
  if (!sidebar) return;

  // 新建 project
  sidebar.querySelector("#sb-new-project")?.addEventListener("click", async () => {
    const name = prompt("项目名称：");
    if (!name?.trim()) return;
    try {
      await api("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), intro: "" }),
      });
      await reload();
      onDraftsChanged?.();
    } catch (err: any) {
      alert("新建失败：" + (err.message || ""));
    }
  });

  // 展开/折叠 project
  sidebar.querySelectorAll<HTMLElement>(".sidebar-project").forEach(el => {
    const pid = Number(el.dataset.projectId);
    el.addEventListener("click", e => {
      const target = e.target as HTMLElement;
      // 忽略 action 按钮的点击
      if (target.closest("[data-action]")) return;
      toggleExpanded(pid);
      render();
    });
  });

  sidebar.querySelector(".sidebar-uncategorized")?.addEventListener("click", () => {
    toggleExpanded(-1);
    render();
  });

  // 重命名/删除
  sidebar.querySelectorAll<HTMLElement>("[data-action]").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      const el = btn.closest<HTMLElement>(".sidebar-project")!;
      const pid = Number(el.dataset.projectId);
      const action = btn.dataset.action;
      if (action === "rename") {
        const p = projects.find(x => x.id === pid);
        const name = prompt("新名称：", p?.name ?? "");
        if (!name?.trim()) return;
        try {
          await api(`/projects/${pid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          });
          await reload();
          onDraftsChanged?.();
        } catch (err: any) {
          alert("重命名失败：" + (err.message || ""));
        }
      } else if (action === "delete") {
        const p = projects.find(x => x.id === pid);
        if (!confirm(`删除项目"${p?.name}"？其下文章将变为未分类。`)) return;
        try {
          await api(`/projects/${pid}`, { method: "DELETE" });
          await reload();
          onDraftsChanged?.();
        } catch (err: any) {
          alert("删除失败：" + (err.message || ""));
        }
      }
    });
  });

  // 点击 draft 行
  sidebar.querySelectorAll<HTMLElement>(".sidebar-draft").forEach(el => {
    el.addEventListener("click", () => {
      const id = Number(el.dataset.draftId);
      if (id) onSelectDraft?.(id);
    });
  });

  // 拖拽：draft 行
  sidebar.querySelectorAll<HTMLElement>(".sidebar-draft[draggable]").forEach(el => {
    el.addEventListener("dragstart", (e: DragEvent) => {
      e.dataTransfer!.setData("text/plain", el.dataset.draftId ?? "");
      e.dataTransfer!.effectAllowed = "move";
    });
  });

  // 拖拽：project 排序
  sidebar.querySelectorAll<HTMLElement>(".sidebar-project[draggable]").forEach(el => {
    el.addEventListener("dragstart", (e: DragEvent) => {
      e.dataTransfer!.setData("application/x-project-id", el.dataset.projectId ?? "");
      e.dataTransfer!.effectAllowed = "move";
    });
    el.addEventListener("dragover", e => {
      if (!e.dataTransfer!.types.includes("application/x-project-id")) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
      el.classList.add("is-drop-target");
    });
    el.addEventListener("dragleave", () => el.classList.remove("is-drop-target"));
    el.addEventListener("drop", async (e: Event) => {
      const de = e as DragEvent;
      e.preventDefault();
      el.classList.remove("is-drop-target");
      const draggedId = Number(de.dataTransfer!.getData("application/x-project-id"));
      const targetId = Number(el.dataset.projectId);
      if (!draggedId || draggedId === targetId) return;
      // 重新排序
      const reordered = [...projects];
      const fromIdx = reordered.findIndex(p => p.id === draggedId);
      const toIdx = reordered.findIndex(p => p.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const items = reordered.map((p, i) => ({ id: p.id, sortOrder: (i + 1) * 1000 }));
      try {
        await api("/projects/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        projects = reordered.map((p, i) => ({ ...p, sortOrder: (i + 1) * 1000 }));
      } catch {
        // 回滚
      }
      render();
    });
  });

  // 拖拽 drop target：project 头（接收 draft）
  sidebar.querySelectorAll<HTMLElement>(".sidebar-project").forEach(el => {
    el.addEventListener("dragover", (e: DragEvent) => {
      if (!e.dataTransfer!.types.includes("text/plain")) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
      el.classList.add("is-drop-target");
    });
    el.addEventListener("dragleave", () => el.classList.remove("is-drop-target"));
    el.addEventListener("drop", async (e: Event) => {
      const de = e as DragEvent;
      e.preventDefault();
      el.classList.remove("is-drop-target");
      const draftId = Number(de.dataTransfer!.getData("text/plain"));
      const pid = Number(el.dataset.projectId);
      if (!draftId || !pid) return;
      await moveDraft(draftId, pid);
    });
  });

  // 拖拽 drop target：未分类
  const uncat = sidebar.querySelector(".sidebar-uncategorized");
  if (uncat) {
    (uncat as HTMLElement).addEventListener("dragover", (e: DragEvent) => {
      if (!e.dataTransfer!.types.includes("text/plain")) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
      uncat.classList.add("is-drop-target");
    });
    uncat.addEventListener("dragleave", () => uncat.classList.remove("is-drop-target"));
    uncat.addEventListener("drop", async (e: Event) => {
      const de = e as DragEvent;
      e.preventDefault();
      uncat.classList.remove("is-drop-target");
      const draftId = Number(de.dataTransfer!.getData("text/plain"));
      if (!draftId) return;
      await moveDraft(draftId, null);
    });
  }
}

async function moveDraft(draftId: number, projectId: number | null) {
  // 乐观更新
  const idx = drafts.findIndex(d => d.id === draftId);
  if (idx >= 0) drafts[idx].projectId = projectId;
  render();
  try {
    await api(`/drafts/${draftId}/project`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    onDraftsChanged?.();
  } catch (err: any) {
    alert("移动失败：" + (err.message || ""));
    // 回滚：重新加载
    onDraftsChanged?.();
  }
}

export { reload as reloadSidebar };