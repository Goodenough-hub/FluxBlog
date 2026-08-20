import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Table,
  Tag,
  Tooltip,
  Popconfirm,
  Select,
  App as AntdApp,
  type TableColumnsType as ColumnsType,
  type TableProps,
} from "antd";
import type { TableRowSelection } from "antd/es/table/interface";
import {
  FiFileText,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiExternalLink,
  FiEye,
  FiEyeOff,
  FiRotateCcw,
  FiUploadCloud,
  FiArrowDownCircle,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";
import {
  draftsApi,
  projectsApi,
  type Draft,
  type Project,
} from "../api/client";
import { formatDraftDate } from "../lib/draft-date";

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "default" },
  publishing: { label: "发布中", color: "processing" },
  published: { label: "已发布", color: "green" },
  unpublishing: { label: "撤回中", color: "warning" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: "default" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export default function ListPage() {
  const { ready, loggedIn, isAdmin, doLogout } = useAuth();
  const navigate = useNavigate();
  const { message, modal, notification } = AntdApp.useApp();

  useEffect(() => {
    if (ready && !loggedIn) {
      window.location.hash = "#/login";
    }
  }, [ready, loggedIn]);

  // 非 admin 用户不让进 Studio：显示提示并退出
  useEffect(() => {
    if (ready && loggedIn && !isAdmin) {
      modal.warning({
        title: "无权访问",
        content: "Studio 仅管理员可访问，你当前的账号无权限。",
        okText: "退出登录",
        onOk: () => {
          void doLogout();
        },
      });
    }
  }, [ready, loggedIn, isAdmin, doLogout, modal]);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  const [publishLoadingId, setPublishLoadingId] = useState<number | null>(null);
  const [visibilityLoadingId, setVisibilityLoadingId] = useState<number | null>(
    null
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 筛选
  const [searchTitle, setSearchTitle] = useState("");
  const [filterProject, setFilterProject] = useState<number | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterVisibility, setFilterVisibility] = useState<
    "all" | "public" | "private"
  >("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, pros] = await Promise.all([
        draftsApi.list(),
        projectsApi.list(),
      ]);
      setDrafts(list);
      setProjects(pros);
    } catch (e: any) {
      notification.error({ message: "加载失败", description: e.message });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    if (loggedIn) void load();
  }, [loggedIn, load]);

  // 收集所有 tag 用于筛选下拉
  const allTags = useMemo(() => {
    const set = new Set<string>();
    drafts.forEach((d) => d.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [drafts]);

  const filtered = useMemo(() => {
    return drafts.filter((d) => {
      if (searchTitle) {
        const q = searchTitle.toLowerCase();
        if (
          !(d.title || "").toLowerCase().includes(q) &&
          !(d.slug || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filterProject != null && d.projectId !== filterProject) return false;
      if (filterTag && !(d.tags || []).includes(filterTag)) return false;
      if (filterVisibility !== "all" && d.visibility !== filterVisibility)
        return false;
      return true;
    });
  }, [drafts, searchTitle, filterProject, filterTag, filterVisibility]);

  const projectMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const resetFilters = () => {
    setSearchTitle("");
    setFilterProject(null);
    setFilterTag(null);
    setFilterVisibility("all");
  };

  const delDraft = useCallback(
    async (id: number, title: string) => {
      try {
        await draftsApi.delete(id);
        message.success(`已删除「${title}」`);
        await load();
      } catch (e: any) {
        message.error(e.message);
      }
    },
    [load, message]
  );

  const delSelected = async () => {
    if (!selectedRowKeys.length) {
      message.warning("请先勾选要删除的草稿");
      return;
    }
    setBatchDeleteLoading(true);
    let ok = 0;
    let fail = 0;
    for (const key of selectedRowKeys) {
      try {
        await draftsApi.delete(Number(key));
        ok++;
      } catch {
        fail++;
      }
    }
    setSelectedRowKeys([]);
    setBatchDeleteLoading(false);
    if (ok) message.success(`已删除 ${ok} 篇${fail ? `，失败 ${fail} 篇` : ""}`);
    await load();
  };

  const togglePublish = async (draft: Draft) => {
    setPublishLoadingId(draft.id);
    try {
      const isPublished = draft.status === "published";
      let targetVisibility = draft.visibility;
      if (!isPublished && draft.visibility === "private") {
        const choice = await new Promise<"public" | "private" | "cancel">(
          (resolve) => {
            modal.confirm({
              title: "设为公开并发布？",
              content:
                "当前草稿是「仅自己可见」。设为公开后任何人可访问；保持私有则只在你的私有列表可见。",
              okText: "公开并发布",
              cancelText: "保持私有发布",
              onOk: () => resolve("public"),
              onCancel: () => resolve("private"),
            });
          }
        );
        if (choice === "cancel") {
          setPublishLoadingId(null);
          return;
        }
        targetVisibility = choice;
      }
      if (isPublished) {
        await draftsApi.unpublish(draft.id);
        notification.success({ message: "已撤回" });
      } else {
        await draftsApi.publish(draft.id, { visibility: targetVisibility });
        notification.success({
          message:
            targetVisibility === "public"
              ? `已公开发布：/blog/posts/${draft.slug}`
              : "已私有发布（仅自己可见）",
          duration: 4,
        });
      }
      await load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setPublishLoadingId(null);
    }
  };

  const toggleVisibility = async (draft: Draft) => {
    setVisibilityLoadingId(draft.id);
    try {
      const next = draft.visibility === "public" ? "private" : "public";
      const isPublished = draft.status === "published";
      await draftsApi.setVisibility(draft.id, next, draft.version, isPublished);
      notification.success({
        message: `已切换为${next === "public" ? "公开" : "仅自己可见"}`,
      });
      await load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setVisibilityLoadingId(null);
    }
  };

  const columns: ColumnsType<Draft> = useMemo(
    () => [
      {
        title: "标题",
        dataIndex: "title",
        key: "title",
        width: 280,
        render: (text: string, r) => {
          const display = text || r.slug;
          return (
            <Tooltip title={display} placement="topLeft">
              <a
                href={`#/editor/${r.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/editor/${r.id}`);
                }}
                className="group inline-flex max-w-[280px] items-center gap-2 truncate"
              >
                <span className="truncate font-medium text-slate-700 transition-colors group-hover:text-indigo-600 dark:text-slate-200">
                  {display}
                </span>
                <FiExternalLink
                  size={12}
                  className="shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500"
                />
              </a>
            </Tooltip>
          );
        },
      },
      {
        title: "摘要",
        dataIndex: "description",
        key: "description",
        width: 280,
        render: (text: string) =>
          text ? (
            <Tooltip title={text}>
              <p className="line-clamp-2 max-w-[280px] text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {text}
              </p>
            </Tooltip>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
          ),
      },
      {
        title: "项目",
        dataIndex: "projectId",
        key: "project",
        width: 120,
        render: (projectId: number | null | undefined) => {
          if (projectId == null) {
            return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
          }
          const name = projectMap.get(projectId);
          return name ? (
            <Tag color="blue" className="m-0">
              {name}
            </Tag>
          ) : (
            <Tooltip title={`项目 ID ${projectId} 已删除`}>
              <span className="text-xs text-amber-500">已删除</span>
            </Tooltip>
          );
        },
      },
      {
        title: "标签",
        dataIndex: "tags",
        key: "tags",
        width: 160,
        render: (tags: string[]) =>
          tags?.length ? (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((t) => (
                <Tag key={t} className="m-0">
                  {t}
                </Tag>
              ))}
              {tags.length > 3 && (
                <Tooltip title={tags.slice(3).join("，")}>
                  <Tag className="m-0">+{tags.length - 3}</Tag>
                </Tooltip>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
          ),
      },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (s: string, r) => (
          <span className="inline-flex items-center gap-1">
            <StatusBadge status={s} />
            {r.hasUnpublishedChanges && (
              <Tooltip title="有未发布修改">
                <span className="text-amber-500">●</span>
              </Tooltip>
            )}
          </span>
        ),
      },
      {
        title: "可见性",
        dataIndex: "visibility",
        key: "visibility",
        width: 110,
        render: (vis: string, r) => {
          const isPublic = vis === "public";
          const loading = visibilityLoadingId === r.id;
          return (
            <Tooltip
              title={
                isPublic
                  ? "公开 — 点击切为仅自己可见"
                  : "仅自己可见 — 点击切为公开"
              }
            >
              <button
                type="button"
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleVisibility(r);
                }}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  isPublic
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-strokedark dark:bg-boxdark-2 dark:text-slate-400"
                }`}
              >
                {isPublic ? <FiEye size={12} /> : <FiEyeOff size={12} />}
                {isPublic ? "公开" : "私有"}
              </button>
            </Tooltip>
          );
        },
      },
      {
        title: "版本",
        key: "version",
        width: 120,
        render: (_, r) => (
          <span className="inline-flex items-center gap-1 tabular-nums text-slate-600 dark:text-slate-300">
            <span className="text-sm font-medium">v{r.version}</span>
            {r.publishedVersion != null && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                /已发v{r.publishedVersion}
              </span>
            )}
          </span>
        ),
      },
      {
        title: "发布时间",
        dataIndex: "publishedAt",
        key: "publishedAt",
        width: 140,
        render: (value: string | null | undefined) => <DraftDate value={value} />,
      },
      {
        title: "更新时间",
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 140,
        render: (value: string | null | undefined) => <DraftDate value={value} />,
      },
      {
        title: "操作",
        key: "action",
        fixed: "right",
        width: 180,
        align: "center",
        render: (_, r) => (
          <div className="flex items-center justify-center gap-0.5">
            <Tooltip title={r.status === "published" ? "撤回" : "发布"}>
              <button
                type="button"
                disabled={publishLoadingId === r.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void togglePublish(r);
                }}
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-indigo-400 cursor-pointer"
                aria-label={r.status === "published" ? "撤回" : "发布"}
              >
                {r.status === "published" ? (
                  <FiArrowDownCircle size={16} />
                ) : (
                  <FiUploadCloud size={16} />
                )}
              </button>
            </Tooltip>
            <Tooltip title={r.status === "published" ? "预览发布文章" : "预览草稿"}>
              <a
                href={
                  r.status === "published"
                    ? `/blog/posts/${r.slug}`
                    : `/blog/preview-draft/${r.id}`
                }
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-white/5 dark:hover:text-indigo-400"
                aria-label={`预览 ${r.title}`}
              >
                <FiEye size={16} />
              </a>
            </Tooltip>
            <Tooltip title="编辑">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/editor/${r.id}`);
                }}
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-white/5 dark:hover:text-indigo-400 cursor-pointer"
                aria-label={`编辑 ${r.title}`}
              >
                <FiEdit2 size={16} />
              </button>
            </Tooltip>
            <Popconfirm
              title="删除草稿"
              description="将永久删除该草稿及其所有版本，不可恢复。"
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => void delDraft(r.id, r.title || r.slug)}
            >
              <Tooltip title="删除">
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  aria-label={`删除 ${r.title}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <FiTrash2 size={16} />
                </button>
              </Tooltip>
            </Popconfirm>
          </div>
        ),
      },
    ],
    [navigate, publishLoadingId, visibilityLoadingId, togglePublish, toggleVisibility, delDraft, projectMap]
  );

  const rowSelection: TableRowSelection<Draft> = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    fixed: "left",
  };

  if (!loggedIn) return null;
  if (ready && loggedIn && !isAdmin) return null;

  const selectedCount = selectedRowKeys.length;
  const hasFilter =
    searchTitle || filterProject != null || filterTag || filterVisibility !== "all";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-600 dark:bg-boxdark dark:text-slate-300">
      {/* 标题卡 */}
      <div className="m-4 mb-2 rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 dark:border-strokedark dark:bg-boxdark">
        <div className="flex items-center justify-between gap-4 overflow-auto">
          <h2 className="min-w-24 text-xl font-bold text-slate-900 dark:text-white">
            草稿
          </h2>
          <div className="flex items-center gap-2">
            <Button onClick={doLogout}>退出</Button>
            <Button
              type="primary"
              icon={<FiPlus />}
              onClick={() => navigate("/editor/new")}
            >
              写文章
            </Button>
          </div>
        </div>
      </div>

      {/* 列表区 */}
      <section className="mx-4 mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-strokedark dark:bg-boxdark">
        {/* 筛选 header */}
        <header className="shrink-0 border-b border-slate-100 px-4 py-3 dark:border-strokedark">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Input
                allowClear
                placeholder="搜索标题 / slug"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                prefix={<FiSearch className="text-slate-400" size={15} />}
                className="w-full sm:w-56"
              />
              <Select
                allowClear
                placeholder="项目"
                value={filterProject ?? undefined}
                onChange={(v) => setFilterProject(v ?? null)}
                options={projects.map((p) => ({ label: p.name, value: p.id }))}
                className="w-full sm:w-40"
              />
              <Select
                allowClear
                showSearch
                placeholder="标签"
                value={filterTag ?? undefined}
                onChange={(v) => setFilterTag(v ?? null)}
                options={allTags.map((t) => ({ label: t, value: t }))}
                className="w-full sm:w-32"
              />
              <Select
                value={filterVisibility}
                onChange={(v) => setFilterVisibility(v as "all" | "public" | "private")}
                options={[
                  { value: "public", label: "公开" },
                  { value: "private", label: "私有" },
                  { value: "all", label: "全部" },
                ]}
                className="w-full sm:w-28"
              />
              <Tooltip title="重置筛选">
                <Button
                  type="text"
                  icon={<FiRotateCcw size={15} />}
                  onClick={resetFilters}
                  disabled={!hasFilter}
                  className={
                    hasFilter
                      ? "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      : "text-slate-300 dark:text-slate-600"
                  }
                />
              </Tooltip>
            </div>

            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 xl:w-auto">
              <div className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-1 dark:border-strokedark dark:bg-boxdark-2/50">
                <Popconfirm
                  title="批量删除"
                  description={
                    selectedCount > 0
                      ? `确定删除已选的 ${selectedCount} 篇草稿？不可恢复。`
                      : undefined
                  }
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  disabled={selectedCount === 0}
                  onConfirm={() => void delSelected()}
                >
                  <Button
                    type="text"
                    size="small"
                    danger={selectedCount > 0}
                    icon={<FiTrash2 size={15} />}
                    loading={batchDeleteLoading}
                    disabled={selectedCount === 0}
                    className={selectedCount === 0 ? "text-slate-400" : ""}
                  >
                    删除{selectedCount > 0 ? ` · ${selectedCount}` : ""}
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        </header>

        {/* 表格 */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table<Draft>
            rowKey="id"
            rowSelection={rowSelection}
            dataSource={filtered}
            columns={columns}
            loading={loading}
            scroll={{ x: 1320 }}
            pagination={{
              position: ["bottomRight"],
              pageSize: 10,
              showTotal: (total) => (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  共 {total} 篇
                </span>
              ),
              className: "px-5! py-3!",
            }}
            onRow={(r) => ({
              onClick: () => navigate(`/editor/${r.id}`),
              style: { cursor: "pointer" },
            })}
            className="min-h-0 flex-1 [&_.ant-table-thead>tr>th]:bg-slate-50! [&_.ant-table-thead>tr>th]:font-medium! [&_.ant-table-thead>tr>th]:text-slate-500! dark:[&_.ant-table-thead>tr>th]:bg-boxdark-2! dark:[&_.ant-table-thead>tr>th]:text-slate-400!"
            locale={{
              emptyText: (
                <div className="py-14 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-boxdark-2 dark:text-slate-500">
                    <FiFileText size={22} />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    暂无草稿，点击右上角「写文章」开始创作
                  </p>
                </div>
              ),
            }}
          />
        </div>
      </section>
    </div>
  );
}

function DraftDate({ value }: { value?: string | null }) {
  const formatted = formatDraftDate(value);
  if (!formatted) return <span className="text-slate-400">—</span>;

  return (
    <div className="flex flex-col leading-tight">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {formatted.dateTime}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-500">
        {formatted.year}
      </span>
    </div>
  );
}
