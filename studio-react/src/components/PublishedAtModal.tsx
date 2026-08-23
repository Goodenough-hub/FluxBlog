import { useEffect } from "react";
import { App as AntdApp, Checkbox, DatePicker, Form, Modal } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import {
  isValidHistoricalPublishedAt,
  serializeHistoricalPublishedAt,
} from "../lib/published-at";

interface PublishedAtModalProps {
  open: boolean;
  value?: string | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (publishedAt: string, syncCreatedAt: boolean) => Promise<void>;
}

export default function PublishedAtModal({
  open,
  value,
  loading,
  onClose,
  onConfirm,
}: PublishedAtModalProps) {
  const [form] = Form.useForm<{
    publishedAt: Dayjs | null;
    syncCreatedAt: boolean;
  }>();
  const { message } = AntdApp.useApp();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        publishedAt: value ? dayjs(value) : null,
        syncCreatedAt: false,
      });
    }
  }, [form, open, value]);

  const submit = async () => {
    try {
      const { publishedAt, syncCreatedAt } = await form.validateFields();
      const serialized = serializeHistoricalPublishedAt(publishedAt);
      if (!serialized) {
        message.error("首次发布时间只能选择现在或过去");
        return;
      }
      await onConfirm(serialized, Boolean(syncCreatedAt));
    } catch {
      // Form validation displays field errors.
    }
  };

  return (
    <Modal
      title="修改首次发布时间"
      open={open}
      onCancel={() => {
        if (!loading) onClose();
      }}
      onOk={() => void submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={loading}
      closable={!loading}
      keyboard={!loading}
      maskClosable={!loading}
      destroyOnClose
    >
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        修改后会影响文章列表排序、归档日期与 RSS 中的发布时间。
      </p>
      <Form form={form} layout="vertical">
        <Form.Item
          label="首次发布时间"
          name="publishedAt"
          rules={[
            { required: true, message: "请选择首次发布时间" },
            {
              validator: (_, selected: Dayjs | null) =>
                isValidHistoricalPublishedAt(selected)
                  ? Promise.resolve()
                  : Promise.reject(new Error("只能选择现在或过去")),
            },
          ]}
        >
          <DatePicker
            showTime
            format="YYYY-MM-DD HH:mm"
            style={{ width: "100%" }}
            disabledDate={(date) => date.isAfter(dayjs(), "day")}
            placeholder="选择首次发布时间"
          />
        </Form.Item>
        <Form.Item name="syncCreatedAt" valuePropName="checked">
          <Checkbox>同时将草稿创建时间设为该发布时间</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
