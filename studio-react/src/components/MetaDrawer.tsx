import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer, Form, Input, Select, Button, Divider } from "antd";
import { FiType, FiAlignLeft, FiTag, FiLink, FiImage, FiShield, FiLayers, FiPlus } from "react-icons/fi";
import type { Draft, Project } from "../api/client";
import { appendTag, buildTagOptions, canCreateTag } from "../lib/taxonomy";

const { TextArea } = Input;

export interface MetaFormValue {
  title: string;
  slug: string;
  tags: string[];
  description: string;
  cover: string;
  visibility: "public" | "private";
  projectId: number | null;
}

interface MetaDrawerProps {
  open: boolean;
  onClose: () => void;
  draft: Draft;
  projects: Project[];
  allTags: string[];
  value: MetaFormValue;
  onChange: (v: MetaFormValue) => void;
}

// 右侧元数据抽屉：标题/slug/标签/摘要/封面/可见性/项目归属。
// FluxBlog 不支持分类树，标签是自由文本数组，项目是扁平 Select。
// 表单以 value（当前编辑值）为准，而非 draft（上次保存的服务端值）——
// 否则未保存的编辑会在重新打开抽屉时被旧值覆盖。
export default function MetaDrawer({
  open,
  onClose,
  draft,
  projects,
  allTags,
  value,
  onChange,
}: MetaDrawerProps) {
  const [form] = Form.useForm<MetaFormValue>();

  // value 每次输入都会变，用 ref 读取最新值，避免把它放进依赖导致
  // 每次编辑都 setFieldsValue（会打断输入）。仅在抽屉 open 时用当前值回填。
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (open) {
      const v = valueRef.current;
      form.setFieldsValue({
        title: v.title || "",
        tags: v.tags || [],
        description: v.description || "",
        cover: v.cover || "",
        visibility: v.visibility,
        projectId: v.projectId ?? null,
      });
    }
  }, [open, form]);

  const tagOptions = useMemo(
    () => buildTagOptions(allTags, value.tags ?? []),
    [allTags, value.tags]
  );

  const [newTagName, setNewTagName] = useState("");

  // 手动新建标签：追加进表单已选列表。form.setFieldValue 不触发 onValuesChange，
  // 需手动回传 onChange，保证 Editor 的 meta 同步更新。
  const handleCreateTag = () => {
    if (!canCreateTag(newTagName, tagOptions)) return;
    const current = (form.getFieldValue("tags") as string[] | undefined) ?? [];
    const next = appendTag(current, newTagName);
    form.setFieldValue("tags", next);
    onChange(form.getFieldsValue());
    setNewTagName("");
  };

  return (
    <Drawer
      title="文章信息"
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      destroyOnClose={false}
      mask={false}
    >
      <Form<MetaFormValue>
        form={form}
        layout="vertical"
        onValuesChange={(_, all) => onChange(all)}
      >
        <Form.Item
          label={<Label icon={<FiType size={13} />} text="标题" />}
          name="title"
          rules={[{ required: true, message: "标题必填" }]}
        >
          <Input placeholder="文章标题" />
        </Form.Item>

        <Form.Item label={<Label icon={<FiLink size={13} />} text="访问地址" />}>
          <Input
            value={`/blog/posts/${draft.slug || "（未生成）"}`}
            readOnly
            className="font-mono text-sm"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            由标题自动生成，创建后不可修改
          </div>
        </Form.Item>

        <Form.Item
          label={<Label icon={<FiAlignLeft size={13} />} text="摘要" />}
          name="description"
        >
          <TextArea rows={3} placeholder="一句话摘要" />
        </Form.Item>

        <Form.Item
          label={<Label icon={<FiTag size={13} />} text="标签" />}
          name="tags"
        >
          <Select
            mode="tags"
            placeholder="选择已有或输入新标签"
            tokenSeparators={[",", "，"]}
            options={tagOptions}
            className="w-full"
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: "8px 0" }} />
                <div className="flex items-center gap-2 px-1 pb-1">
                  <Input
                    placeholder="新建标签名称"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onPressEnter={(e) => {
                      e.preventDefault();
                      handleCreateTag();
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="text"
                    icon={<FiPlus size={14} />}
                    onClick={handleCreateTag}
                    disabled={!canCreateTag(newTagName, tagOptions)}
                  >
                    新建
                  </Button>
                </div>
              </>
            )}
          />
        </Form.Item>

        <Form.Item
          label={<Label icon={<FiImage size={13} />} text="封面 URL" />}
          name="cover"
        >
          <Input placeholder="https://…（可选）" />
        </Form.Item>

        <Form.Item
          label={<Label icon={<FiShield size={13} />} text="可见性" />}
          name="visibility"
        >
          <Select
            options={[
              { value: "public", label: "公开 — 任何人可读" },
              { value: "private", label: "仅自己可见" },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={<Label icon={<FiLayers size={13} />} text="项目归属" />}
          name="projectId"
        >
          <Select
            allowClear
            placeholder="无归属"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function Label({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
      {icon}
      {text}
    </span>
  );
}
