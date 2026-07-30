/**
 * Studio IndexedDB 恢复副本：防抖保存期间把未同步的编辑写入本地，
 * 页面刷新/崩溃后回到编辑器时若版本仍一致则可恢复。
 * key = (draftId, version)；保存成功后清除。
 * 备份全字段（slug/标题/描述/标签/封面/正文），避免恢复时丢字段。
 */

const DB_NAME = "fluxblog-studio";
const STORE = "snapshots";

let dbp: Promise<IDBDatabase> | null = null;

export function initDB(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: ["draftId", "version"] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

export interface Snapshot {
  draftId: number;
  version: number;
  slug: string;
  title: string;
  description: string;
  tags: string;
  cover: string;
  markdown: string;
  savedAt: number;
}

export interface SnapshotInput {
  slug: string;
  title: string;
  description: string;
  tags: string;
  cover: string;
  markdown: string;
}

export async function saveSnapshot(
  draftId: number,
  version: number,
  data: SnapshotInput
): Promise<void> {
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      draftId,
      version,
      ...data,
      savedAt: Date.now(),
    } as Snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSnapshot(
  draftId: number,
  version: number
): Promise<Snapshot | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get([draftId, version]);
    req.onsuccess = () => resolve((req.result as Snapshot) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearSnapshot(
  draftId: number,
  version: number
): Promise<void> {
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete([draftId, version]);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
