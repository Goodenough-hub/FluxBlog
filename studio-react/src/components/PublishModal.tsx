import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Form,
  Select,
  Radio,
  Switch,
  DatePicker,
  Input,
  Button,
  Divider,
  App as AntdApp,
} from "antd";
import { FiPlus, FiTag, FiLayers, FiShield, FiClock, FiLink } from "react-icons/fi";
import dayjs, { type Dayjs } from "dayjs";
import { type Draft, type Project, projectsApi } from "../api/client";

export interface PublishFormValue {
  projectId: number | null;
  tags: string[];
  visibility: "public" | "private";
  scheduledPublishAt: string | null; // ISO 8601 or null = immediate
}

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (values: PublishFormValue) => Promise<void>;
  draft: Draft;
  projects: Project[];
  allTags: string[];
  isRepublish: boolean;
  loading: boolean;
  onProjectCreated?: (p: Project) => void;
}

export default function PublishModal({
  open,
  onClose,
  onConfirm,
  draft,
  projects,
  allTags,
  isRepublish,
  loading,
  onProjectCreated,
}: PublishModalProps) {
  const [form] = Form.useForm<PublishFormValue>();
  const { message } = AntdApp.useApp();
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        projectId: draft.projectId ?? null,
        tags: draft.tags ?? [],
        visibility: draft.visibility,
        scheduledPublishAt: null,
      });
      setScheduleEnabled(false);
      setNewProjectName("");
      setTagSearch("");
    }
  }, [open, draft, form]);

  const scheduledTime = Form.useWatch("scheduledPublishAt", form) as unknown as
    | Dayjs
    | undefined;

  const submit = async () => {
    try {
      const v = await form.validateFields();
      if (
        scheduleEnabled &&
        (!scheduledTime || !scheduledTime.isAfter(dayjs().add(1, "minute")))
      ) {
        message.error("定时发布时间需至少在 1 分钟之后");
        return;
      }
      await onConfirm({
        projectId: v.projectId ?? null,
        tags: v.tags ?? [],
        visibility: v.visibility,
        scheduledPublishAt:
          scheduleEnabled && scheduledTime
            ? scheduledTime.toISOString()
            : null,
      });
    } catch {
      // validateFields 已展示错误
    }
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) {
      message.error("项目名称不能为空");
      return;
    }
    setCreatingProject(true);
    try {
      const p = await projectsApi.create({ name });
      onProjectCreated?.(p);
      form.setFieldValue("projectId", p.id);
      setNewProjectName("");
      message.success(`已创建项目：${name}`);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCreatingProject(false);
    }
  };

  const tagOptions = useMemo(
    () => Array.from(new Set([...allTags, ...(draft.tags ?? [])])).map((t) => ({ value: t, label: t })),
    [allTags, draft.tags]
  );

  const [tagSearch, setTagSearch] = useState("");
  const trimmedTagSearch = tagSearch.trim();
  const canCreateTag =
    trimmedTagSearch.length > 0 &&
    !tagOptions.some((o) => o.value === trimmedTagSearch);

  const handleCreateTag = () => {
    if (!canCreateTag) return;
    const current = (form.getFieldValue("tags") as string[] | undefined) ?? [];
    if (!current.includes(trimmedTagSearch)) {
      form.setFieldValue("tags", [...current, trimmedTagSearch]);
    }
    setTagSearch("");
  };

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));

  return (
    <Modal
      title={isRepublish ? "更新发布" : "发布文章"}
      open={open}
      onCancel={onClose}
      width={520}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>
          取消
        </Button>,
        <Button key="ok" type="primary" loading={loading} onClick={submit}>
          {scheduleEnabled ? "定时发布" : isRepublish ? "更新发布" : "发布"}
        </Button>,
      ]}
      destroyOnClose
    >
      <Form<PublishFormValue> form={form} layout="vertical">
        <Form.Item label={<Label icon={<FiLink size={13} />} text="访问地址" />}>
          <Input
            value={`/blog/posts/${draft.slug || "（未生成）"}`}
            readOnly
            className="font-mono text-sm"
          />
        </Form.Item>

        <Form.Item
          label={<Label icon={<FiLayers size={13} />} text="项目归属（可选）" />}
          name="projectId"
        >
          <Select
            allowClear
            placeholder="无归属"
            options={projectOptions}
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: "8px 0" }} />
                <div className="flex items-center gap-2 px-1 pb-1">
                  <Input
                    placeholder="新建项目名称"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onPressEnter={(e) => {
                      e.preventDefault();
                      handleCreateProject();
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="text"
                    icon={<FiPlus size={14} />}
                    onClick={handleCreateProject}
                    loading={creatingProject}
                  >
                    新建
                  </Button>
                </div>
              </>
            )}
          />
        </Form.Item>

        <Form.Item
          label={<Label icon={<FiTag size={13} />} text="标签（可选，多选）" />}
          name="tags"
        >
          <Select
            mode="tags"
            placeholder="选择已有或输入新标签，回车新建"
            tokenSeparators={[",", "，"]}
            options={tagOptions}
            searchValue={tagSearch}
            onSearch={setTagSearch}
            className="w-full"
            dropdownRender={(menu) => (
              <>
                {menu}
                {canCreateTag && (
                  <>
                    <Divider style={{ margin: "8px 0" }} />
                    <div className="px-1 pb-1">
                      <Button
                        type="text"
                        icon={<FiPlus size={14} />}
                        onClick={handleCreateTag}
                        block
                      >
                        新建标签：{trimmedTagSearch}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          />
        </Form.Item>

        <Form.Item
          label={<Label icon={<FiShield size={13} />} text="可见性" />}
          name="visibility"
          rules={[{ required: true }]}
        >
          <Radio.Group
            options={[
              { value: "public", label: "公开 — 任何人可读" },
              { value: "private", label: "仅自己可见" },
            ]}
          />
        </Form.Item>

        <Divider style={{ margin: "12px 0" }} />

        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <FiClock size={13} />
            <span>定时发布</span>
          </span>
          <Switch
            checked={scheduleEnabled}
            onChange={setScheduleEnabled}
            checkedChildren="开"
            unCheckedChildren="关"
          />
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          默认立即发布；开启后可在指定时间自动发布。
        </div>
        {scheduleEnabled && (
          <Form.Item
            className="mt-2"
            label="发布时间"
            name="scheduledPublishAt"
            rules={[
              {
                required: scheduleEnabled,
                message: "请选择发布时间",
              },
            ]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: "100%" }}
              disabledDate={(d) => d && d.isBefore(dayjs().startOf("day"))}
              placeholder="选择发布时间"
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
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
