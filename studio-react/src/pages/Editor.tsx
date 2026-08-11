import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Tooltip,
  Tag,
  Modal,
  Input,
  Form,
  App as AntdApp,
} from "antd";
import {
  FiArrowLeft,
  FiSave,
  FiSend,
  FiClock,
  FiSettings,
  FiUploadCloud,
  FiArrowDownCircle,
  FiRefreshCw,
} from "react-icons/fi";
import dayjs from "dayjs";
import { useAuth } from "../hooks/useAuth";
import {
  draftsApi,
  projectsApi,
  tagsApi,
  type Draft,
  type Project,
} from "../api/client";
import {
  useSaveController,
  type SaveInput,
} from "../hooks/useSaveController";
import VditorEditor, {
  type VditorEditorHandle,
} from "../components/VditorEditor";
import PreviewFrame, {
  type PreviewFrameHandle,
} from "../components/PreviewFrame";
import MetaDrawer, { type MetaFormValue } from "../components/MetaDrawer";
import HistoryDrawer from "../components/HistoryDrawer";
import ConflictModal, { type ConflictInfo } from "../components/ConflictModal";
import PublishModal, { type PublishFormValue } from "../components/PublishModal";
import { useScrollSync } from "../hooks/useScrollSync";

const STATUS_COLOR: Record<string, string> = {
  draft: "default",
  publishing: "processing",
  published: "green",
  unpublishing: "warning",
};

// 从标题生成 URL slug：小写 + 空格/下划线转连字符 + 保留中文 + 去其余特殊字符
function slugifyFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^一-鿺a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function EditorPage() {
  const { ready, loggedIn, isAdmin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, modal, notification } = AntdApp.useApp();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [markdown, setMarkdown] = useState("");
  const [meta, setMeta] = useState<MetaFormValue | null>(null);
  const [baseVersion, setBaseVersion] = useState(0);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [metaDrawerOpen, setMetaDrawerOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm] = Form.useForm<{ title: string }>();
  const watchedTitle = Form.useWatch("title", newForm) ?? "";
  const previewSlug = slugifyFromTitle(watchedTitle) || "your-post";

  const loadedRef = useRef(false);
  const editorRef = useRef<VditorEditorHandle>(null);
  const previewRef = useRef<PreviewFrameHandle>(null);
  // 滚动元素需要在 iframe 加载后、Vditor 渲染后才能拿到，所以用 state 触发重渲染
  const [editorScrollEl, setEditorScrollEl] = useState<HTMLElement | null>(null);
  const [previewScrollEl, setPreviewScrollEl] = useState<HTMLElement | null>(null);
  const [previewReady, setPreviewReady] = useState(0);
  useScrollSync(editorScrollEl, previewScrollEl);

  // 轮询拿滚动元素：Vditor/iframe 都是异步挂载，没有现成事件可监听。
  // 拿到后停止轮询；草稿切换或 iframe 重载（previewReady 变化）时清空重新探测。
  useEffect(() => {
    if (!draft) return;
    setEditorScrollEl(null);
    setPreviewScrollEl(null);
    let stopped = false;
    const id = window.setInterval(() => {
      if (stopped) return;
      const e = editorRef.current?.getScrollEl() ?? null;
      const p = previewRef.current?.getScrollEl() ?? null;
      if (e) setEditorScrollEl(e);
      if (p) setPreviewScrollEl(p);
      if (e && p) window.clearInterval(id);
    }, 200);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [draft, previewReady]);

  useEffect(() => {
    if (ready && !loggedIn) {
      window.location.hash = "#/login";
    }
  }, [ready, loggedIn]);

  // 非 admin 不让进 Studio 编辑器
  useEffect(() => {
    if (ready && loggedIn && !isAdmin) {
      modal.warning({
        title: "无权访问",
        content: "Studio 仅管理员可访问，你当前的账号无权限。",
        okText: "退出登录",
        onOk: () => {
          window.location.hash = "#/login";
        },
      });
    }
  }, [ready, loggedIn, isAdmin, modal]);

  useEffect(() => {
    if (!loggedIn) return;
    projectsApi.list().then(setProjects).catch(() => {});
    tagsApi.list().then(setAllTags).catch(() => {});
  }, [loggedIn]);

  const buildSaveInput = useCallback(
    (md: string, m: MetaFormValue): SaveInput => ({
      title: m.title,
      slug: m.slug,
      tags: m.tags || [],
      description: m.description,
      cover: m.cover,
      markdown: md,
      visibility: m.visibility,
      projectId: m.projectId ?? null,
    }),
    []
  );

  const onConflict = useCallback((info: ConflictInfo) => {
    setConflict(info);
  }, []);

  // seededInput：草稿加载后用与服务端一致的 input 初始化 lastSavedInputRef，
  // 让 useSaveController 在用户未做任何修改时不触发 8s 自动保存。
  const seededInput = useMemo<SaveInput | null>(() => {
    if (!draft || !meta) return null;
    return buildSaveInput(markdown, meta);
  }, [draft, meta, markdown, buildSaveInput]);

  const sc = useSaveController({
    draftId: draft?.id ?? 0,
    baseVersion,
    onConflict,
    seededInput,
  });

  // 切草稿时重置状态
  useEffect(() => {
    if (!id) return;
    if (id === "new") {
      setDraft(null);
      setMarkdown("");
      setMeta(null);
      setBaseVersion(0);
      newForm.resetFields();
      loadedRef.current = true;
      return;
    }
    loadedRef.current = false;
    (async () => {
      try {
        const d = await draftsApi.get(Number(id));
        setDraft(d);
        setMarkdown(d.markdown);
        setBaseVersion(d.version);
        const m: MetaFormValue = {
          title: d.title,
          slug: d.slug,
          tags: d.tags || [],
          description: d.description || "",
          cover: d.cover || "",
          visibility: d.visibility,
          projectId: d.projectId ?? null,
        };
        setMeta(m);
        // 检查 IndexedDB 是否有未同步快照
        const snap = await sc.loadSnapshot(d.id, d.version);
        if (snap && snap.markdown !== d.markdown) {
          modal.confirm({
            title: "检测到未同步的本地草稿副本",
            content: "是否恢复本地编辑？取消则使用服务端版本。",
            okText: "恢复本地",
            cancelText: "用服务端",
            onOk: () => {
              setMarkdown(snap.markdown);
              setMeta({
                title: snap.title || m.title,
                slug: snap.slug || m.slug,
                tags: snap.tags ? snap.tags.split(",").map((s) => s.trim()).filter(Boolean) : m.tags,
                description: snap.description || m.description,
                cover: snap.cover || m.cover,
                visibility: m.visibility,
                projectId: m.projectId,
              });
            },
          });
        }
        loadedRef.current = true;
      } catch (e: any) {
        message.error(e.message);
        navigate("/");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loggedIn]);

  // 保存成功后 baseVersion 跟随 savedVersion
  useEffect(() => {
    if (sc.savedVersion > baseVersion) {
      setBaseVersion(sc.savedVersion);
    }
  }, [sc.savedVersion, baseVersion]);

  // markdown 或 meta 变化时调 schedule（含 IndexedDB 快照）
  useEffect(() => {
    if (!draft || !meta || !loadedRef.current) return;
    const input = buildSaveInput(markdown, meta);
    sc.persistSnapshot(input, baseVersion);
    sc.schedule(input);
  }, [markdown, meta, draft, baseVersion, buildSaveInput, sc]);

  // beforeunload 提示
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (sc.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sc]);

  // 处理新建草稿提交
  const onCreate = async (v: { title: string }) => {
    setCreating(true);
    try {
      const baseSlug = slugifyFromTitle(v.title);
      if (!baseSlug) {
        message.error("无法从标题生成网址路径，请使用更明确的标题");
        return;
      }
      let slug = baseSlug;
      let d: Draft | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          d = await draftsApi.create({
            slug,
            title: v.title,
            markdown: "",
            visibility: "public",
          });
          break;
        } catch (e: any) {
          if (e.status !== 409 || attempt === 4) throw e;
          slug = `${baseSlug}-${attempt + 2}`; // my-post-2, -3, ...
        }
      }
      message.success({
        content: `已创建草稿：/blog/posts/${slug}`,
        duration: 4,
      });
      navigate(`/editor/${d!.id}`);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  // 冲突解决
  const onUseServer = useCallback(async (server: Draft) => {
    setDraft(server);
    setMarkdown(server.markdown);
    setMeta({
      title: server.title,
      slug: server.slug,
      tags: server.tags || [],
      description: server.description || "",
      cover: server.cover || "",
      visibility: server.visibility,
      projectId: server.projectId ?? null,
    });
    setBaseVersion(server.version);
    setConflict(null);
    sc.resolveConflict();
  }, [sc]);

  const onKeepLocal = useCallback(
    async (local: SaveInput, serverVersion: number) => {
      try {
        const updated = await draftsApi.update(draft!.id, local, serverVersion);
        setDraft(updated);
        setBaseVersion(updated.version);
        setConflict(null);
        sc.resolveConflict();
        notification.success({ message: "本地编辑已基于服务端版本重存" });
      } catch (e: any) {
        message.error(e.message);
      }
    },
    [draft, sc, message, notification]
  );

  // 发布确认（PublishModal onConfirm）：flush 自动保存后调 publish API。
  // 支持立即发布与定时发布；定时发布时 status 保持 draft，由后端 scheduler 到点提升。
  const onPublishConfirm = useCallback(
    async (values: PublishFormValue) => {
      if (!draft) return;
      setPublishLoading(true);
      try {
        try {
          await sc.flush();
        } catch {
          message.error("有未保存的冲突，请先解决版本冲突再发布");
          return;
        }
        const res = await draftsApi.publish(draft.id, {
          visibility: values.visibility,
          scheduledPublishAt: values.scheduledPublishAt,
          projectId: values.projectId,
          tags: values.tags,
        });
        // 同步本地 meta，避免下次保存又写回旧值
        setMeta((m) =>
          m
            ? {
                ...m,
                visibility: values.visibility,
                projectId: values.projectId ?? null,
                tags: values.tags,
              }
            : m
        );
        // 若新建了项目或改了项目，刷新 projects 列表（PublishModal 已通过 onProjectCreated 上报）
        if (values.scheduledPublishAt) {
          const when = dayjs(values.scheduledPublishAt).format("YYYY-MM-DD HH:mm");
          notification.success({
            message: `已设置定时发布：${when}`,
            duration: 4,
          });
        } else if (res.scheduled) {
          notification.success({ message: "已设置定时发布", duration: 4 });
        } else {
          notification.success({
            message:
              values.visibility === "public"
                ? `已公开发布：/blog/posts/${draft.slug}`
                : `已私有发布（仅自己可见）`,
            duration: 4,
          });
        }
        setPublishModalOpen(false);
        navigate("/");
      } catch (e: any) {
        message.error(e.message);
      } finally {
        setPublishLoading(false);
      }
    },
    [draft, sc, message, notification, navigate]
  );

  // 更新发布：已发布文章修改后，直接用原有项目/标签/可见性同步到博客。
  // 不弹窗，用户在 MetaDrawer 改的项目/标签会随下次自动保存写回草稿，
  // 这里 flush 后调 publish 把当前 version 提升为 publishedVersion。
  const onRepublish = useCallback(async () => {
    if (!draft) return;
    setPublishLoading(true);
    try {
      try {
        await sc.flush();
      } catch {
        message.error("有未保存的冲突，请先解决版本冲突再更新发布");
        return;
      }
      await draftsApi.publish(draft.id, {
        visibility: draft.visibility,
        projectId: draft.projectId ?? null,
        tags: draft.tags ?? [],
      });
      notification.success({
        message: `已更新发布：/blog/posts/${draft.slug}`,
        duration: 4,
      });
      navigate("/");
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setPublishLoading(false);
    }
  }, [draft, sc, message, notification, navigate]);

  // 撤回：弹二次确认 → flush → unpublish API
  const onUnpublish = useCallback(async () => {
    if (!draft) return;
    modal.confirm({
      title: "撤回文章",
      content: "撤回后博客将不再显示此文章，确定撤回？",
      okText: "确定撤回",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        setPublishLoading(true);
        try {
          try {
            await sc.flush();
          } catch {
            message.error("有未保存的冲突，请先解决版本冲突再撤回");
            return;
          }
          await draftsApi.unpublish(draft.id);
          notification.success({ message: "已撤回，回到草稿列表" });
          navigate("/");
        } catch (e: any) {
          message.error(e.message);
        } finally {
          setPublishLoading(false);
        }
      },
    });
  }, [draft, sc, message, modal, notification, navigate]);

  // 历史恢复
  const onRestore = useCallback(
    async (version: number) => {
      if (!draft) return;
      const updated = await draftsApi.restore(draft.id, version);
      setDraft(updated);
      setMarkdown(updated.markdown);
      setBaseVersion(updated.version);
      setMeta({
        title: updated.title,
        slug: updated.slug,
        tags: updated.tags || [],
        description: updated.description || "",
        cover: updated.cover || "",
        visibility: updated.visibility,
        projectId: updated.projectId ?? null,
      });
      sc.resolveConflict();
      message.success(`已恢复到 v${version}（作为 v${updated.version}）`);
    },
    [draft, sc, message]
  );

  if (!loggedIn) return null;
  if (ready && loggedIn && !isAdmin) return null;

  // 新建草稿态：弹出 slug+title 表单
  if (id === "new" && !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-boxdark">
        <Modal
          title="新建草稿"
          open
          closable={false}
          footer={null}
          width={420}
        >
          <Form
            form={newForm}
            layout="vertical"
            onFinish={onCreate}
            initialValues={{ title: "" }}
          >
            <Form.Item
              label="标题"
              name="title"
              rules={[{ required: true, message: "标题必填" }]}
            >
              <Input placeholder="文章标题" autoFocus />
            </Form.Item>
            <Form.Item label="访问地址（自动生成，不可修改）">
              <Input
                value={`/blog/posts/${previewSlug}`}
                readOnly
                className="font-mono text-sm"
              />
            </Form.Item>
            <div className="flex justify-between">
              <Button onClick={() => navigate("/")} disabled={creating}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={creating}>
                创建
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    );
  }

  if (!draft || !meta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400 dark:bg-boxdark">
        <span>加载草稿…</span>
      </div>
    );
  }

  const isPublished = draft.status === "published";
  const needsRepublish = isPublished && draft.hasUnpublishedChanges === true;

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-700 dark:bg-boxdark dark:text-slate-300">
      {/* 顶栏 */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-2.5 dark:border-strokedark dark:bg-boxdark">
        <Button
          type="text"
          icon={<FiArrowLeft size={16} />}
          onClick={async () => {
            try {
              await sc.flush();
            } catch {
              /* conflict handled in modal */
            }
            navigate("/");
          }}
        />
        <Tag color={STATUS_COLOR[draft.status] || "default"}>
          {draft.status} · v{baseVersion}
        </Tag>
        <span className="text-xs">
          {sc.state === "saving" && <span className="text-amber-500">保存中…</span>}
          {sc.state === "idle" && !sc.dirty && (
            <span className="text-emerald-500">已保存 ✓</span>
          )}
          {sc.state === "idle" && sc.dirty && (
            <span className="text-slate-400">编辑中…</span>
          )}
          {sc.state === "blocked" && (
            <span className="text-red-500">版本冲突 ⚠</span>
          )}
          {sc.state === "error" && (
            <Tooltip title={sc.lastError || "保存失败"}>
              <span className="text-red-500">保存失败</span>
            </Tooltip>
          )}
        </span>
        <span className="flex-1" />
        <Tooltip title="历史版本">
          <Button
            type="text"
            icon={<FiClock size={16} />}
            onClick={() => setHistoryDrawerOpen(true)}
          />
        </Tooltip>
        <Tooltip title="文章信息">
          <Button
            type="text"
            icon={<FiSettings size={16} />}
            onClick={() => setMetaDrawerOpen(true)}
          />
        </Tooltip>
        {needsRepublish ? (
          <>
            <Button
              type="primary"
              icon={<FiRefreshCw size={14} />}
              onClick={onRepublish}
              loading={publishLoading}
            >
              更新发布
            </Button>
            <Button
              type="default"
              icon={<FiArrowDownCircle size={14} />}
              onClick={onUnpublish}
              loading={publishLoading}
            >
              撤回
            </Button>
          </>
        ) : isPublished ? (
          <Button
            type="default"
            icon={<FiArrowDownCircle size={14} />}
            onClick={onUnpublish}
            loading={publishLoading}
          >
            撤回
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<FiUploadCloud size={14} />}
            onClick={() => setPublishModalOpen(true)}
            loading={publishLoading}
          >
            发布
          </Button>
        )}
      </header>

      {/* 主区：左预览 + 右编辑 */}
      <main className="flex min-h-0 flex-1">
        {/* 左：预览 */}
        <section className="flex min-w-0 flex-1 flex-col border-r border-slate-200/80 dark:border-strokedark">
          <PaneHeader label="预览" hint="实时渲染发布态（remark/rehype + Shiki + KaTeX + Mermaid）" />
          <div className="min-h-0 flex-1 overflow-hidden bg-white dark:bg-boxdark">
            <PreviewFrame
              ref={previewRef}
              draftId={draft.id}
              reloadKey={sc.savedVersion}
              onReady={() => setPreviewReady((n) => n + 1)}
            />
          </div>
        </section>
        {/* 右：编辑 */}
        <section className="flex min-w-0 flex-1 flex-col bg-white dark:bg-boxdark">
          <PaneHeader label="编辑" hint="Vditor · ir 模式 · 工具栏上传图片自动转 WebP" />
          <div className="min-h-0 flex-1 overflow-hidden">
            <VditorEditor
              ref={editorRef}
              key={draft.id}
              value={markdown}
              draftId={draft.id}
              onChange={setMarkdown}
            />
          </div>
        </section>
      </main>

      <MetaDrawer
        open={metaDrawerOpen}
        onClose={() => setMetaDrawerOpen(false)}
        draft={draft}
        projects={projects}
        onChange={(m) => setMeta(m)}
      />
      <HistoryDrawer
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        draftId={draft.id}
        currentVersion={baseVersion}
        onRestore={onRestore}
      />
      <ConflictModal
        conflict={conflict}
        onUseServer={onUseServer}
        onKeepLocal={onKeepLocal}
        onCancel={() => setConflict(null)}
      />
      <PublishModal
        open={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        onConfirm={onPublishConfirm}
        draft={draft}
        projects={projects}
        allTags={allTags}
        isRepublish={needsRepublish}
        loading={publishLoading}
        onProjectCreated={(p) => setProjects((prev) => [...prev, p])}
      />
    </div>
  );
}

function PaneHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-strokedark">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {hint && (
        <span className="text-xs text-slate-400 dark:text-slate-500">{hint}</span>
      )}
    </div>
  );
}
