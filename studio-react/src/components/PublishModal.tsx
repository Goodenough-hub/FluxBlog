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
  Checkbox,
  Divider,
  App as AntdApp,
} from "antd";
import { FiPlus, FiTag, FiLayers, FiShield, FiClock, FiLink } from "react-icons/fi";
import dayjs, { type Dayjs } from "dayjs";
import { type Draft, type Project, projectsApi } from "../api/client";
import { appendTag, buildTagOptions, canCreateTag } from "../lib/taxonomy";
import {
  serializeHistoricalPublishedAt,
  togglePublishTiming,
} from "../lib/published-at";

export interface PublishFormValue {
  projectId: number | null;
  tags: string[];
  visibility: "public" | "private";
  scheduledPublishAt: string | null; // ISO 8601 or null = immediate
  publishedAt: string | null;
  syncCreatedAt: boolean;
}

interface PublishFormFields extends Omit<PublishFormValue, "scheduledPublishAt" | "publishedAt"> {
  scheduledPublishAt: Dayjs | null;
  publishedAt: Dayjs | null;
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
  const [form] = Form.useForm<PublishFormFields>();
  const { message } = AntdApp.useApp();
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [historicalEnabled, setHistoricalEnabled] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        projectId: draft.projectId ?? null,
        tags: draft.tags ?? [],
        visibility: draft.visibility,
        scheduledPublishAt: null,
        publishedAt: null,
        syncCreatedAt: false,
      });
      setScheduleEnabled(false);
      setHistoricalEnabled(false);
      setNewProjectName("");
      setNewTagName("");
    }
  }, [open, draft, form]);

  const scheduledTime = Form.useWatch("scheduledPublishAt", form) as unknown as
    | Dayjs
    | undefined;
  const historicalTime = Form.useWatch("publishedAt", form);

  const changeTimingMode = (mode: "scheduled" | "historical", enabled: boolean) => {
    const next = togglePublishTiming(mode, enabled);
    setScheduleEnabled(next.scheduleEnabled);
    setHistoricalEnabled(next.historicalEnabled);
    form.setFieldsValue({
      scheduledPublishAt: next.scheduledPublishAt,
      publishedAt: next.publishedAt,
      syncCreatedAt: next.syncCreatedAt,
    });
  };

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
      const publishedAt = historicalEnabled
        ? serializeHistoricalPublishedAt(historicalTime)
        : null;
      if (historicalEnabled && !publishedAt) {
        message.error("历史发布时间只能选择现在或过去");
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
        publishedAt,
        syncCreatedAt: historicalEnabled && Boolean(v.syncCreatedAt),
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
    () => buildTagOptions(allTags, draft.tags ?? []),
    [allTags, draft.tags]
  );

  const [newTagName, setNewTagName] = useState("");
  const canCreate = canCreateTag(newTagName, tagOptions);

  const handleCreateTag = () => {
    if (!canCreate) return;
    const current = (form.getFieldValue("tags") as string[] | undefined) ?? [];
    form.setFieldValue("tags", appendTag(current, newTagName));
    setNewTagName("");
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
      <Form<PublishFormFields> form={form} layout="vertical">
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
                    disabled={!canCreate}
                  >
                    新建
                  </Button>
                </div>
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
            onChange={(enabled) => changeTimingMode("scheduled", enabled)}
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

        {!draft.publishedAt && (
          <>
            <Divider style={{ margin: "12px 0" }} />
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <FiClock size={13} />
                <span>历史发布时间（用于迁移）</span>
              </span>
              <Switch
                checked={historicalEnabled}
                onChange={(enabled) => changeTimingMode("historical", enabled)}
                checkedChildren="开"
                unCheckedChildren="关"
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              仅用于迁移历史文章；开启后立即发布，并使用所选时间作为首次发布时间。
            </div>
            {historicalEnabled && (
              <>
                <Form.Item
                  className="mt-2"
                  label="历史发布时间"
                  name="publishedAt"
                  rules={[{ required: true, message: "请选择历史发布时间" }]}
                >
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: "100%" }}
                    disabledDate={(date) => date.isAfter(dayjs(), "day")}
                    placeholder="选择现在或过去的时间"
                  />
                </Form.Item>
                <Form.Item name="syncCreatedAt" valuePropName="checked">
                  <Checkbox>同时将草稿创建时间设为该历史时间</Checkbox>
                </Form.Item>
              </>
            )}
          </>
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
