import { useCallback, useEffect, useRef, useState } from "react";
import { draftsApi, type Draft, ApiError } from "../api/client";
import { saveSnapshot, clearSnapshot, loadSnapshot } from "../lib/studio-idb";

export interface SaveInput {
  title: string;
  slug: string;
  tags: string[];
  description: string;
  cover: string;
  markdown: string;
  visibility: "public" | "private";
  projectId?: number | null;
}

type SaveState = "idle" | "saving" | "blocked" | "error";

interface ConflictInfo {
  serverVersion: Draft;
  localInput: SaveInput;
}

interface UseSaveControllerOptions {
  draftId: number;
  baseVersion: number;
  debounceMs?: number;
  onConflict?: (info: ConflictInfo) => void;
  /** 加载草稿后传入与服务端一致的 input，用作 lastSavedInputRef 初值，
   *  避免用户重新进入编辑器但未做任何修改时仍触发 8s 自动保存。 */
  seededInput?: SaveInput | null;
}

// 自动保存 hook：8s 防抖 + 严格 single-flight + 乐观锁 + IndexedDB 快照。
// 冲突（HTTP 409）→ 进入 blocked 态，pending 保留供解决后重试；调
// resolveConflict() 恢复 idle。其他错误进入 error 态，可重试。
export function useSaveController({
  draftId,
  baseVersion,
  debounceMs = 3000,
  onConflict,
  seededInput,
}: UseSaveControllerOptions) {
  const [state, setState] = useState<SaveState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number>(baseVersion);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<SaveInput | null>(null);
  const lastSavedInputRef = useRef<SaveInput | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const stateRef = useRef<SaveState>("idle");
  const onConflictRef = useRef(onConflict);
  onConflictRef.current = onConflict;
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;
  // baseVersion 通过 ref 每次渲染同步；pump/flush/dosave 都从 ref 取，
  // 避免"在途保存返回新版后、下一次 pump 仍用旧 baseVersion 触发 409"的竞态
  const baseVersionRef = useRef(baseVersion);
  baseVersionRef.current = baseVersion;
  // seededInput 通过 ref 同步，draftId 切换时用它初始化 lastSavedInputRef
  const seededInputRef = useRef<SaveInput | null>(seededInput ?? null);
  seededInputRef.current = seededInput ?? null;

  const inputKey = (i: SaveInput): string =>
    `${i.title}${i.slug}${i.tags.join(",")}${i.description}${i.cover}${i.markdown}${i.visibility}${i.projectId ?? ""}`;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 切换 draft 时清掉 lastSavedInput，避免新 draft 第一笔保存被误判为"无变化"。
  // 但若调用方提供了与当前 draft 一致的 seededInput（如刚从服务端加载），
  // 则用它初始化 lastSavedInputRef，让 schedule() 检测到无变化时跳过自动保存。
  const draftIdRefForReset = useRef(draftId);
  if (draftIdRefForReset.current !== draftId) {
    draftIdRefForReset.current = draftId;
    lastSavedInputRef.current = seededInputRef.current;
    pendingRef.current = null;
    // 同步 savedVersion，让 PreviewFrame 的 reloadKey 跳到新草稿版本
    setSavedVersion(baseVersion);
  }

  const setStateSafe = (s: SaveState) => {
    stateRef.current = s;
    setState(s);
  };

  const doSave = useCallback(
    async (input: SaveInput, version: number): Promise<void> => {
      setStateSafe("saving");
      setLastError(null);
      try {
        const updated = await draftsApi.update(draftIdRef.current, input, version);
        await clearSnapshot(draftIdRef.current, version);
        // 立即同步 baseVersionRef，避免 .finally 里 pump 再次触发时仍用旧 version
        baseVersionRef.current = updated.version;
        lastSavedInputRef.current = input;
        setSavedVersion(updated.version);
        setStateSafe("idle");
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 409) {
          // 冲突：进入 blocked，保留 pending 供解决后重试
          pendingRef.current = input;
          setStateSafe("blocked");
          // 拉取服务端最新版本，触发冲突 UI
          try {
            const server = await draftsApi.get(draftIdRef.current);
            onConflictRef.current?.({ serverVersion: server, localInput: input });
          } catch (e: any) {
            setLastError(e.message);
          }
        } else {
          setStateSafe("error");
          setLastError(err.message);
        }
        throw err;
      }
    },
    []
  );

  const pump = useCallback(() => {
    timerRef.current = null;
    if (inFlightRef.current || stateRef.current === "blocked" || !pendingRef.current)
      return;
    const input = pendingRef.current;
    pendingRef.current = null;
    inFlightRef.current = doSave(input, baseVersionRef.current)
      .catch(() => {
        // 错误已在 doSave 处理；这里吞掉让 pump 不抛
      })
      .finally(() => {
        inFlightRef.current = null;
        // 在途期间又来新输入：立即再保存一次
        if (stateRef.current === "idle" && pendingRef.current) pump();
      });
  }, [doSave]);

  const schedule = useCallback(
    (input: SaveInput) => {
      if (stateRef.current === "blocked") return; // 冲突未解决，禁止保存
      // 输入与上次成功保存一致 → 无需再保存（避免保存→版本+1→useEffect 触发→再保存 死循环）
      if (
        lastSavedInputRef.current &&
        inputKey(lastSavedInputRef.current) === inputKey(input)
      ) {
        return;
      }
      pendingRef.current = input;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => pump(), debounceMs);
    },
    [pump, debounceMs]
  );

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (inFlightRef.current) await inFlightRef.current.catch(() => {});
    while (pendingRef.current && stateRef.current !== "blocked") {
      const input = pendingRef.current;
      pendingRef.current = null;
      try {
        await doSave(input, baseVersionRef.current);
      } catch {
        throw new Error("save blocked");
      }
    }
    if (stateRef.current === "blocked") throw new Error("save blocked by conflict");
  }, [doSave]);

  const resolveConflict = useCallback(() => {
    pendingRef.current = null;
    setStateSafe("idle");
    setLastError(null);
  }, []);

  // 卸载时清理
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 暴露 IndexedDB 恢复助手给调用方
  const persistSnapshot = useCallback(
    (input: SaveInput, version: number) => {
      return saveSnapshot(draftIdRef.current, version, {
        slug: input.slug,
        title: input.title,
        description: input.description,
        tags: input.tags.join(","),
        cover: input.cover,
        markdown: input.markdown,
      });
    },
    []
  );

  const dirty = pendingRef.current !== null || stateRef.current !== "idle";

  return {
    state,
    lastError,
    savedVersion,
    dirty,
    schedule,
    flush,
    resolveConflict,
    persistSnapshot,
    loadSnapshot,
  };
}
