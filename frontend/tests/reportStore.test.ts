import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_SNAPSHOTS,
  ReportStore,
  StorageUnavailable,
  createIndexedDbStorage,
  type SnapshotStorage,
} from "../src/features/report/reportStore";
import { MAX_ARTIFACT_RECORDS, buildSnapshot, isInterludeEligible, parseSnapshot, summarize, type ReportSnapshot, type SnapshotInput } from "../src/features/report/reportSnapshot";
import { clone, complete, insufficient, profileRich } from "./fixtures";

const input = (over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  text: "sample - why?", repository_id: "sample", mode: "INVESTIGATE", interpreter: "deterministic", question: "why?",
  target_path: "src/billing.py", symbol: "charge", ...over,
});

function snapshot(over: Partial<Parameters<typeof buildSnapshot>[0]> = {}, id = "snap-1", at = "2026-11-12T10:00:00.000Z"): ReportSnapshot {
  return buildSnapshot({
    id, createdAt: at, input: input(), investigation: clone(complete().body), investigationNote: null,
    analysis: clone(profileRich().body), analysisNote: null, ...over,
  });
}

describe("snapshot", () => {
  it("is frozen and needs at least one result", () => {
    const s = snapshot();
    expect(Object.isFrozen(s)).toBe(true);
    expect(() => buildSnapshot({ id: "x", createdAt: "2026-11-12T10:00:00.000Z", input: input(), investigation: null, investigationNote: null, analysis: null, analysisNote: null })).toThrow();
  });

  it("round-trips through JSON unchanged", () => {
    const s = snapshot();
    expect(parseSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it("allows either part to be missing, with its reason", () => {
    const onlyAdvisor = snapshot({ investigation: null, investigationNote: "The backend could not be reached." }, "a");
    expect(parseSnapshot(JSON.parse(JSON.stringify(onlyAdvisor)))?.investigationNote).toBe("The backend could not be reached.");
    const onlyInvestigation = snapshot({ analysis: null, analysisNote: "not validated" }, "b");
    expect(parseSnapshot(JSON.parse(JSON.stringify(onlyInvestigation)))?.analysis).toBeNull();
  });

  it("rejects tampered content", () => {
    const base = JSON.parse(JSON.stringify(snapshot()));
    const mutate = (fn: (s: Record<string, any>) => void) => {
      const copy = JSON.parse(JSON.stringify(base));
      fn(copy);
      return parseSnapshot(copy);
    };
    expect(mutate((s) => (s.schema = 2))).toBeNull();
    expect(mutate((s) => (s.createdAt = "not a date"))).toBeNull();
    expect(mutate((s) => (s.input.mode = "NEEDS_TARGET"))).toBeNull();
    expect(mutate((s) => (s.investigation.retrieval_status = "DONE"))).toBeNull();
    expect(mutate((s) => (s.investigation.epistemic_classification = "CERTAIN"))).toBeNull();
    expect(mutate((s) => (s.analysis.advisor.recommendations[0].evidence_references = ["obs-forged"]))).toBeNull();
    expect(mutate((s) => (s.analysis.extra = 1))).toBeNull();
    expect(mutate((s) => { s.investigation = null; s.analysis = null; })).toBeNull();
    expect(mutate((s) => (s.artifacts = [{ capability: "STEERING", path: "x", state: "APPLIED", at: "t" }]))).toBeNull();
    expect(parseSnapshot("text")).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });

  it("does not let a stored snapshot upgrade a classification the validator would refuse", () => {
    // A FAILED retrieval may not carry a classification or a conclusion (Spec 2 section 8.5).
    const raw = JSON.parse(JSON.stringify(snapshot()));
    raw.investigation.retrieval_status = "FAILED";
    expect(parseSnapshot(raw)).toBeNull();
  });

  it("interlude eligibility follows the investigation, or the advisory mode", () => {
    expect(isInterludeEligible(snapshot())).toBe(true);
    expect(isInterludeEligible(snapshot({ investigation: clone(insufficient().body) }))).toBe(false);
    expect(isInterludeEligible(snapshot({ investigation: null, analysis: clone(profileRich().body), input: input({ mode: "ADVISE", target_path: null, symbol: null }) }))).toBe(true);
    // An investigation request whose investigation did not produce a result is not eligible, even if the profile worked.
    expect(isInterludeEligible(snapshot({ investigation: null, investigationNote: "failed" }))).toBe(false);
  });

  it("summary counts only adoptable recommendations", () => {
    const summary = summarize(snapshot());
    expect(summary.actionable).toBe(snapshot().analysis!.advisor.recommendations.filter((r) => ["ADOPT_NOW", "CONSIDER"].includes(r.recommendation_status)).length);
    expect(summary.classification).toBe("DOCUMENTED");
    expect(summarize(snapshot({ investigation: null }, "n")).classification).toBeNull();
  });
});

describe("IndexedDB report store", () => {
  let store: ReportStore;
  beforeEach(() => {
    store = new ReportStore(createIndexedDbStorage(new IDBFactory()));
  });

  it("saves, lists newest first, loads, and removes", async () => {
    expect(await store.save(snapshot({}, "old", "2026-11-01T00:00:00.000Z"))).toEqual({ ok: true });
    await store.save(snapshot({}, "new", "2026-11-12T00:00:00.000Z"));
    const listed = await store.list();
    expect(listed.ok && listed.items.map((i) => i.id)).toEqual(["new", "old"]);
    expect((await store.load("new"))?.input.repository_id).toBe("sample");
    expect(await store.remove("new")).toBe(true);
    expect(await store.load("new")).toBeNull();
  });

  it("a loaded snapshot equals the saved one", async () => {
    const s = snapshot();
    await store.save(s);
    expect(await store.load("snap-1")).toEqual(s);
  });

  it("a saved report survives a new store instance on the same database", async () => {
    const factory = new IDBFactory();
    await new ReportStore(createIndexedDbStorage(factory)).save(snapshot());
    expect((await new ReportStore(createIndexedDbStorage(factory)).load("snap-1"))?.id).toBe("snap-1");
  });

  it("deletes a record that no longer validates, and never returns it", async () => {
    const factory = new IDBFactory();
    const storage = createIndexedDbStorage(factory);
    const bad = JSON.parse(JSON.stringify(snapshot()));
    bad.analysis.advisor.recommendations[0].evidence_references = ["obs-forged"];
    bad.analysis.advisor.recommendations[0].recommendation_status = "ADOPT_NOW";
    await storage.put({ id: "snap-1", createdAt: bad.createdAt, summary: summarize(snapshot()), snapshot: bad });
    const s = new ReportStore(storage);
    expect(await s.load("snap-1")).toBeNull();
    expect(await storage.get("snap-1")).toBeNull();
  });

  it("refuses a record stored under a different id", async () => {
    const storage = createIndexedDbStorage(new IDBFactory());
    const other = snapshot({}, "other");
    await storage.put({ id: "snap-1", createdAt: other.createdAt, summary: summarize(other), snapshot: other });
    expect(await new ReportStore(storage).load("snap-1")).toBeNull();
  });

  it("omits and removes malformed list entries", async () => {
    const storage = createIndexedDbStorage(new IDBFactory());
    await storage.put({ id: "junk", createdAt: "2026-11-12T00:00:00.000Z", summary: { nope: true } as never, snapshot: {} });
    const s = new ReportStore(storage);
    const listed = await s.list();
    expect(listed.ok && listed.items).toEqual([]);
    expect(await storage.get("junk")).toBeNull();
  });

  it("keeps at most the newest MAX_SNAPSHOTS", async () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i += 1) {
      const at = new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString();
      await store.save(snapshot({}, `s${i}`, at));
    }
    const listed = await store.list();
    expect(listed.ok && listed.items.length).toBe(MAX_SNAPSHOTS);
    expect(await store.load("s0")).toBeNull();
    expect(await store.load(`s${MAX_SNAPSHOTS + 2}`)).not.toBeNull();
  });

  it("keeps history independent per snapshot (saving one does not change another)", async () => {
    const a = snapshot({}, "a", "2026-11-01T00:00:00.000Z");
    await store.save(a);
    await store.save(snapshot({ investigation: clone(insufficient().body) }, "b", "2026-11-02T00:00:00.000Z"));
    expect(await store.load("a")).toEqual(a);
    expect((await store.load("b"))?.investigation?.epistemic_classification).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("unavailable storage", () => {
  const broken: SnapshotStorage = {
    put: async () => Promise.reject(new StorageUnavailable("no")),
    get: async () => Promise.reject(new StorageUnavailable("no")),
    all: async () => Promise.reject(new StorageUnavailable("no")),
    remove: async () => Promise.reject(new StorageUnavailable("no")),
  };
  it("reports the failure and never throws", async () => {
    const store = new ReportStore(broken);
    expect(await store.save(snapshot())).toEqual({ ok: false, reason: "UNAVAILABLE" });
    expect(await store.list()).toEqual({ ok: false });
    expect(await store.load("x")).toBeNull();
    expect(await store.remove("x")).toBe(false);
  });
  it("a generic failure is reported as FAILED", async () => {
    const store = new ReportStore({ ...broken, put: async () => Promise.reject(new Error("quota")) });
    expect(await store.save(snapshot())).toEqual({ ok: false, reason: "FAILED" });
  });
  it("the IndexedDB adapter reports unavailable when the API is missing", async () => {
    const storage = createIndexedDbStorage({ open: () => { throw new Error("denied"); } } as unknown as IDBFactory);
    await expect(storage.all()).rejects.toBeInstanceOf(StorageUnavailable);
  });
});

describe("artifact records (review follow-up)", () => {
  const record = (n: number) => ({ capability: "STEERING", path: `.kiro/steering/file-${n}.md`, state: "ARTIFACT_GENERATED" as const, at: "2026-11-12T10:00:00.000Z", content_sha256: "a".repeat(64) });

  it("keeps every record when several are written at the same moment", async () => {
    const store = new ReportStore(createIndexedDbStorage(new IDBFactory()));
    await store.save(snapshot());
    const results = await Promise.all(Array.from({ length: 12 }, (_, n) => store.recordArtifact("snap-1", record(n))));
    expect(results.every(Boolean)).toBe(true);
    const loaded = await store.load("snap-1");
    expect(loaded?.artifacts).toHaveLength(12);
  });

  it("refuses to grow past the limit a stored snapshot is allowed to have", async () => {
    const store = new ReportStore(createIndexedDbStorage(new IDBFactory()));
    await store.save(snapshot());
    for (let n = 0; n < MAX_ARTIFACT_RECORDS; n += 1) expect(await store.recordArtifact("snap-1", record(n))).toBe(true);
    expect(await store.recordArtifact("snap-1", record(MAX_ARTIFACT_RECORDS))).toBe(false);
    expect((await store.load("snap-1"))?.artifacts).toHaveLength(MAX_ARTIFACT_RECORDS);
  });

  it("a stored record with a path outside the Kiro locations makes the snapshot invalid", () => {
    const good = JSON.parse(JSON.stringify(snapshot()));
    good.artifacts = [record(1)];
    expect(parseSnapshot(good)).not.toBeNull();
    for (const path of ["../x.md", "src/app.py", ".kiro/steering/a.md\n", "/etc/passwd"]) {
      const bad = JSON.parse(JSON.stringify(good));
      bad.artifacts[0].path = path;
      expect(parseSnapshot(bad)).toBeNull();
    }
  });
});
