import { useState } from "react";
import { Modal, Button, App as AntdApp } from "antd";
import type { Draft } from "../api/client";
import type { SaveInput } from "../hooks/useSaveController";

export interface ConflictInfo {
  serverVersion: Draft;
  localInput: SaveInput;
}

interface ConflictModalProps {
  conflict: ConflictInfo | null;
  onUseServer: (server: Draft) => Promise<void>;
  onKeepLocal: (local: SaveInput, baseVersion: number) => Promise<void>;
  onCancel: () => void;
}

// 版本冲突弹窗：双栏比较服务端 vs 本地，三选一。
// - 用服务端版本：丢弃本地编辑，加载服务端 draft
// - 保留本地：基于服务端最新 baseVersion 重存本地编辑
// - 取消：保持 blocked 态，由用户继续编辑后再解决
export default function ConflictModal({
  conflict,
  onUseServer,
  onKeepLocal,
  onCancel,
}: ConflictModalProps) {
  const [loading, setLoading] = useState(false);
  const { message } = AntdApp.useApp();

  if (!conflict) return null;
  const { serverVersion: server, localInput } = conflict;

  const wrap = (fn: () => Promise<void>) => async () => {
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="版本冲突"
      open
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          取消
        </Button>,
        <Button
          key="server"
          onClick={wrap(() => onUseServer(server))}
          loading={loading}
        >
          用服务端版本
        </Button>,
        <Button
          key="local"
          type="primary"
          onClick={wrap(() => onKeepLocal(localInput, server.version))}
          loading={loading}
        >
          保留本地（基于 v{server.version} 重存）
        </Button>,
      ]}
      width={820}
      destroyOnClose
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        服务端版本 v{server.version} 与本地编辑不一致。请选择处理方式：
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            服务端 v{server.version}
          </div>
          <textarea
            readOnly
            value={server.markdown}
            className="h-72 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs dark:border-strokedark dark:bg-boxdark-2"
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            本地编辑
          </div>
          <textarea
            readOnly
            value={localInput.markdown}
            className="h-72 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs dark:border-strokedark dark:bg-boxdark-2"
          />
        </div>
      </div>
    </Modal>
  );
}
