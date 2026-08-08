import { useEffect, useState } from "react";
import {
  Drawer,
  Button,
  List,
  Tag,
  Tooltip,
  Spin,
  App as AntdApp,
} from "antd";
import { FiClock, FiRotateCcw } from "react-icons/fi";
import dayjs from "dayjs";
import { draftsApi } from "../api/client";

interface Version {
  id: number;
  version: number;
  title: string;
  markdown: string;
  createdAt: string;
}

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  draftId: number;
  currentVersion: number;
  onRestore: (version: number) => Promise<void>;
}

// 历史版本抽屉：列出 /versions，恢复到任意历史版本（as new version）。
export default function HistoryDrawer({
  open,
  onClose,
  draftId,
  currentVersion,
  onRestore,
}: HistoryDrawerProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const { message } = AntdApp.useApp();

  useEffect(() => {
    if (!open || !draftId) return;
    setLoading(true);
    draftsApi
      .versions(draftId)
      .then((vs) => setVersions([...vs].reverse())) // 最新在前
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [open, draftId, message]);

  return (
    <Drawer
      title="历史版本"
      placement="right"
      width={460}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <List<Version>
          dataSource={versions}
          renderItem={(v) => {
            const isCurrent = v.version === currentVersion;
            return (
              <List.Item
                actions={[
                  <Tooltip
                    key="restore"
                    title={
                      isCurrent
                        ? "当前版本，无需恢复"
                        : "恢复后作为新版本，不覆盖历史"
                    }
                  >
                    <Button
                      type="link"
                      size="small"
                      icon={<FiRotateCcw size={14} />}
                      disabled={isCurrent || restoring !== null}
                      loading={restoring === v.version}
                      onClick={async () => {
                        setRestoring(v.version);
                        try {
                          await onRestore(v.version);
                          onClose();
                        } catch (e: any) {
                          message.error(e.message);
                        } finally {
                          setRestoring(null);
                        }
                      }}
                    >
                      恢复
                    </Button>
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span className="inline-flex items-center gap-2">
                      <Tag color={isCurrent ? "green" : "default"}>
                        v{v.version}
                      </Tag>
                      {isCurrent && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          当前
                        </span>
                      )}
                      <span className="text-sm">{v.title || "未命名"}</span>
                    </span>
                  }
                  description={
                    <div>
                      <p className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <FiClock size={11} />
                        {dayjs(v.createdAt).format("YYYY-MM-DD HH:mm:ss")}
                      </p>
                      <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {v.markdown.slice(0, 200)}
                      </p>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
          locale={{
            emptyText: "暂无历史版本",
          }}
        />
      </Spin>
    </Drawer>
  );
}
