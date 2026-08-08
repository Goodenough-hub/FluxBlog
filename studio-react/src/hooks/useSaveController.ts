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
}

// 自动保存 hook：1.5s 防抖 + 严格 single-flight + 乐观锁 + IndexedDB 快照。
// 冲突（HTTP 409）→ 进入 blocked 态，pending 保留供解决后重试；调
// resolveConflict() 恢复 idle。其他错误进入 error 态，可重试。
export function useSaveController({
  draftId,
  baseVersion,
  debounceMs = 1500,
  onConflict,
}: UseSaveControllerOptions) {
  const [state, setState] = useState<SaveState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number>(baseVersion);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ input: SaveInput; baseVersion: number } | null>(
    null
  );
  const inFlightRef = useRef<Promise<void> | null>(null);
  const stateRef = useRef<SaveState>("idle");
  const onConflictRef = useRef(onConflict);
  onConflictRef.current = onConflict;
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
        setSavedVersion(updated.version);
        setStateSafe("idle");
        // 把 updated 写回 draftIdRef？这里只暴露版本；调用方读 savedVersion 拿新 baseVersion
        // 注意：调用方需要 useEffect(savedVersion) 把它同步到 baseVersion prop
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 409) {
          // 冲突：进入 blocked，保留 pending 供解决后重试
          pendingRef.current = { input, baseVersion: version };
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
    const { input, baseVersion } = pendingRef.current;
    pendingRef.current = null;
    inFlightRef.current = doSave(input, baseVersion)
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
      pendingRef.current = { input, baseVersion };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => pump(), debounceMs);
    },
    [pump, baseVersion, debounceMs]
  );

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (inFlightRef.current) await inFlightRef.current.catch(() => {});
    while (pendingRef.current && stateRef.current !== "blocked") {
      const { input, baseVersion } = pendingRef.current;
      pendingRef.current = null;
      try {
        await doSave(input, baseVersion);
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
