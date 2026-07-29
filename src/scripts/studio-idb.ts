/**
 * Studio IndexedDB 恢复副本：防抖保存期间把未同步的编辑写入本地，
 * 页面刷新/崩溃后回到编辑器时若版本仍一致则可恢复。
 * key = (draftId, version)；保存成功后清除。
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
  title: string;
  markdown: string;
  savedAt: number;
}

export async function saveSnapshot(draftId: number, version: number, data: { title: string; markdown: string }): Promise<void> {
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ draftId, version, title: data.title, markdown: data.markdown, savedAt: Date.now() } as Snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSnapshot(draftId: number, version: number): Promise<Snapshot | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get([draftId, version]);
    req.onsuccess = () => resolve((req.result as Snapshot) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearSnapshot(draftId: number, version: number): Promise<void> {
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete([draftId, version]);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
