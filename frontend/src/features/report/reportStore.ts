/**
 * Local report history (Spec 4 section 9.3).
 *
 * Snapshots live in the browser's IndexedDB. There is no backend database for them. The storage is hidden behind a small
 * interface so the logic is tested without a browser, and the IndexedDB adapter is tested against the real implementation
 * of IndexedDB.
 *
 * A stored record is untrusted when it is read: it is revalidated, and a record that fails is deleted, never shown. If
 * IndexedDB is unavailable (private mode, blocked storage) every operation reports that, and the application keeps working
 * with the current in-memory report.
 */

import { MAX_ARTIFACT_RECORDS, parseSnapshot, summarize, type ArtifactRecord, type ReportSnapshot, type SnapshotSummary } from "./reportSnapshot";

export const DATABASE_NAME = "sean-reports";
export const STORE_NAME = "snapshots";
export const DATABASE_VERSION = 1;
export const MAX_SNAPSHOTS = 50;

export interface StoredRecord {
  id: string;
  createdAt: string;
  summary: SnapshotSummary;
  snapshot: unknown;
}

export interface SnapshotStorage {
  put(record: StoredRecord): Promise<void>;
  get(id: string): Promise<StoredRecord | null>;
  /** Records ordered newest first, without validation. */
  all(): Promise<StoredRecord[]>;
  remove(id: string): Promise<void>;
}

export class StorageUnavailable extends Error {}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new StorageUnavailable("request failed"));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new StorageUnavailable("transaction failed"));
    tx.onabort = () => reject(tx.error ?? new StorageUnavailable("transaction aborted"));
  });
}

export function createIndexedDbStorage(factory?: IDBFactory): SnapshotStorage {
  const idb = factory ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);
  let opened: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (!idb) return Promise.reject(new StorageUnavailable("IndexedDB is not available"));
    if (opened) return opened;
    opened = new Promise<IDBDatabase>((resolve, reject) => {
      let req: IDBOpenDBRequest;
      try {
        req = idb.open(DATABASE_NAME, DATABASE_VERSION);
      } catch {
        reject(new StorageUnavailable("IndexedDB could not be opened"));
        return;
      }
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new StorageUnavailable("IndexedDB could not be opened"));
      req.onblocked = () => reject(new StorageUnavailable("IndexedDB is blocked"));
    });
    opened.catch(() => {
      opened = null;
    });
    return opened;
  }

  return {
    async put(record) {
      const db = await open();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      await done(tx);
    },
    async get(id) {
      const db = await open();
      const tx = db.transaction(STORE_NAME, "readonly");
      const found = await request(tx.objectStore(STORE_NAME).get(id));
      return (found as StoredRecord | undefined) ?? null;
    },
    async all() {
      const db = await open();
      const tx = db.transaction(STORE_NAME, "readonly");
      const rows = (await request(tx.objectStore(STORE_NAME).getAll())) as StoredRecord[];
      return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    },
    async remove(id) {
      const db = await open();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      await done(tx);
    },
  };
}

function isSummary(value: unknown): value is SnapshotSummary {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" && typeof v.createdAt === "string" && typeof v.repository_id === "string" && typeof v.title === "string" &&
    (v.mode === "INVESTIGATE" || v.mode === "ADVISE") && typeof v.actionable === "number" &&
    (v.classification === null || typeof v.classification === "string") && (v.retrievalStatus === null || typeof v.retrievalStatus === "string")
  );
}

export type SaveResult = { ok: true } | { ok: false; reason: "UNAVAILABLE" | "FAILED" };

export class ReportStore {
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: SnapshotStorage) {}

  async save(snapshot: ReportSnapshot): Promise<SaveResult> {
    try {
      await this.storage.put({ id: snapshot.id, createdAt: snapshot.createdAt, summary: summarize(snapshot), snapshot });
      const rows = await this.storage.all();
      for (const stale of rows.slice(MAX_SNAPSHOTS)) await this.storage.remove(stale.id);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof StorageUnavailable ? "UNAVAILABLE" : "FAILED" };
    }
  }

  /** Summaries of readable records, newest first. A malformed record is removed and omitted. */
  async list(): Promise<{ ok: true; items: SnapshotSummary[] } | { ok: false }> {
    try {
      const items: SnapshotSummary[] = [];
      for (const row of await this.storage.all()) {
        if (typeof row?.id === "string" && isSummary(row.summary) && row.summary.id === row.id) items.push(row.summary);
        else if (typeof row?.id === "string") await this.storage.remove(row.id);
      }
      return { ok: true, items };
    } catch {
      return { ok: false };
    }
  }

  /** The validated snapshot, or null if it is missing or invalid. An invalid record is deleted. */
  async load(id: string): Promise<ReportSnapshot | null> {
    try {
      const row = await this.storage.get(id);
      if (row === null) return null;
      const parsed = parseSnapshot(row.snapshot);
      if (parsed === null || parsed.id !== id) {
        await this.storage.remove(id);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Record that a prepared file was generated or exported. Only the artifact list changes: the findings, the evidence and the
   * recommendations of the saved snapshot are kept exactly as they were captured. A later state replaces an earlier one for
   * the same file, and a state never goes backwards.
   */
  recordArtifact(id: string, record: ArtifactRecord): Promise<boolean> {
    // One write at a time: each is a read followed by a write, and two interleaved writes would lose one record.
    const run = this.writes.then(() => this.applyRecord(id, record));
    this.writes = run.catch(() => undefined);
    return run;
  }

  private async applyRecord(id: string, record: ArtifactRecord): Promise<boolean> {
    try {
      const row = await this.storage.get(id);
      const parsed = row === null ? null : parseSnapshot(row.snapshot);
      if (row === null || parsed === null || parsed.id !== id) return false;
      const others = parsed.artifacts.filter((a) => !(a.capability === record.capability && a.path === record.path));
      const previous = parsed.artifacts.find((a) => a.capability === record.capability && a.path === record.path);
      if (!previous && others.length >= MAX_ARTIFACT_RECORDS) return false;
      const keep = previous && previous.state === "ARTIFACT_EXPORTED" && record.state === "ARTIFACT_GENERATED" && previous.content_sha256 === record.content_sha256 ? previous : record;
      const next = { ...parsed, artifacts: [...others, keep] };
      await this.storage.put({ ...row, snapshot: next });
      return true;
    } catch {
      return false;
    }
  }

  /** Delete every saved report. Returns false if the storage refused. */
  async clear(): Promise<boolean> {
    try {
      for (const row of await this.storage.all()) await this.storage.remove(row.id);
      return true;
    } catch {
      return false;
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.storage.remove(id);
      return true;
    } catch {
      return false;
    }
  }
}
