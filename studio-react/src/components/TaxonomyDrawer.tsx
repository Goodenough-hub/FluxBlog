import { useEffect, useState } from "react";
import { App as AntdApp, Button, Drawer, Empty, Input, Tabs, Tag } from "antd";
import { FiCheck, FiEdit2, FiLayers, FiTag, FiX } from "react-icons/fi";
import {
  projectsApi,
  tagsApi,
  type Draft,
  type Project,
} from "../api/client";
import { validateRename } from "../lib/taxonomy";

interface TaxonomyDrawerProps {
  open: boolean;
  onClose: () => void;
  drafts: Draft[];
  projects: Project[];
  tags: string[];
  onProjectRenamed: (project: Project) => void;
  onTagRenamed: (oldName: string, newName: string) => void;
}

interface EditingItem {
  kind: "project" | "tag";
  key: string;
  currentName: string;
}

export default function TaxonomyDrawer({
  open,
  onClose,
  drafts,
  projects,
  tags,
  onProjectRenamed,
  onTagRenamed,
}: TaxonomyDrawerProps) {
  const { message } = AntdApp.useApp();
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setName("");
    }
  }, [open]);

  const startEditing = (item: EditingItem) => {
    setEditing(item);
    setName(item.currentName);
  };

  const save = async () => {
    if (!editing) return;
    const existingNames =
      editing.kind === "project" ? projects.map((project) => project.name) : tags;
    const validation = validateRename(editing.currentName, name, existingNames);
    if (validation.error) {
      message.warning(validation.error);
      return;
    }

    setSaving(true);
    try {
      if (editing.kind === "project") {
        const updated = await projectsApi.rename(Number(editing.key), validation.name);
        onProjectRenamed(updated);
        message.success(`项目已改名为「${validation.name}」`);
      } else {
        await tagsApi.rename(editing.currentName, validation.name);
        onTagRenamed(editing.currentName, validation.name);
        message.success(`标签已改名为「${validation.name}」`);
      }
      setEditing(null);
      setName("");
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (
    kind: "project" | "tag",
    key: string,
    itemName: string,
    count: number
  ) => {
    const isEditing = editing?.kind === kind && editing.key === key;
    return (
      <div
        key={`${kind}-${key}`}
        className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-strokedark"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-boxdark-2 dark:text-slate-400">
          {kind === "project" ? <FiLayers size={16} /> : <FiTag size={16} />}
        </div>
        {isEditing ? (
          <Input
            autoFocus
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            onPressEnter={() => void save()}
            disabled={saving}
            className="min-w-0 flex-1"
          />
        ) : (
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-slate-700 dark:text-slate-200">
              {itemName}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">{count} 篇文章使用</div>
          </div>
        )}
        {isEditing ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="text"
              size="small"
              icon={<FiCheck />}
              loading={saving}
              aria-label={`保存 ${itemName}`}
              onClick={() => void save()}
            />
            <Button
              type="text"
              size="small"
              icon={<FiX />}
              disabled={saving}
              aria-label={`取消修改 ${itemName}`}
              onClick={() => setEditing(null)}
            />
          </div>
        ) : (
          <Button
            type="text"
            size="small"
            icon={<FiEdit2 />}
            aria-label={`修改 ${itemName}`}
            onClick={() => startEditing({ kind, key, currentName: itemName })}
          >
            改名
          </Button>
        )}
      </div>
    );
  };

  const projectContent = projects.length ? (
    <div>
      {projects.map((project) =>
        renderRow(
          "project",
          String(project.id),
          project.name,
          drafts.filter((draft) => draft.projectId === project.id).length
        )
      )}
    </div>
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无项目" />
  );

  const tagContent = tags.length ? (
    <div>
      {tags.map((tag) =>
        renderRow(
          "tag",
          tag,
          tag,
          drafts.filter((draft) => draft.tags?.includes(tag)).length
        )
      )}
    </div>
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无标签" />
  );

  return (
    <Drawer
      title="分类管理"
      placement="right"
      width={440}
      open={open}
      onClose={onClose}
      destroyOnClose={false}
      extra={<Tag color="blue">改名立即同步文章</Tag>}
    >
      <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
        项目与标签改名后，FluxBlog 前台及已发布文章会同步更新，无需重新发布。
      </p>
      <Tabs
        items={[
          { key: "projects", label: `项目 ${projects.length}`, children: projectContent },
          { key: "tags", label: `标签 ${tags.length}`, children: tagContent },
        ]}
      />
    </Drawer>
  );
}
