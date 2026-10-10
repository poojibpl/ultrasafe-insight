/**
 * Persists the latest successfully parsed upload in this browser (IndexedDB).
 * Only one record is kept ("latest"), so an older upload can never come back.
 */
export interface StoredUpload { name: string; data: ArrayBuffer; sheet?: string; savedAt: number }

const DB = "ultrasound-dashboard", STORE = "uploads", KEY = "latest";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("IndexedDB unavailable"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(req.result); };
    t.onerror = () => { db.close(); rej(t.error); };
  });
}
export const saveLatest = (u: StoredUpload) => tx("readwrite", (s) => s.put(u, KEY)).then(() => true).catch(() => false);
export const loadLatest = () => tx<StoredUpload | undefined>("readonly", (s) => s.get(KEY)).catch(() => undefined);
export const clearLatest = () => tx("readwrite", (s) => s.delete(KEY)).then(() => true).catch(() => false);
