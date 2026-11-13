import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { App, type AppProps } from "../src/app/App";
import { validatePreviewResponse } from "../src/features/analysis/validateAdvisor";
import { createIndexedDbStorage } from "../src/features/report/reportStore";
import type { Exporter } from "../src/components/report/ArtifactPanel";
import type { CallOutcome } from "../src/services/advisorClient";
import type { PreviewResponse, ProfileResponse } from "../src/types/advisor";
import { act, byRole, click, render, type } from "./renderHelpers";
import { artifactsRich, capabilitiesFixture, clone, complete, interpretInvestigate, profileRich, repositoriesFixture } from "./fixtures";

const tid = (id: string, scope: ParentNode = document) => scope.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const ok = <T,>(value: T): CallOutcome<T> => ({ kind: "ok", value: clone(value) });
async function settle() {
  for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
}

describe("preview response validation", () => {
  it("accepts the captured response and refuses unsafe paths, bad hashes and extra fields", () => {
    expect(validatePreviewResponse(artifactsRich().body).ok).toBe(true);
    const mutate = (fn: (b: any) => void) => { const b = clone(artifactsRich().body) as any; fn(b); return validatePreviewResponse(b).ok; };
    expect(mutate((b) => (b.bundles[0].files[0].path = "../outside.md"))).toBe(false);
    expect(mutate((b) => (b.bundles[0].files[0].path = "src/app.py"))).toBe(false);
    expect(mutate((b) => (b.bundles[0].files[0].path = "/etc/passwd"))).toBe(false);
    expect(mutate((b) => (b.bundles[0].files[0].content_sha256 = "short"))).toBe(false);
    expect(mutate((b) => (b.bundles[0].files[0].alternative_path = "../x"))).toBe(false);
    expect(mutate((b) => (b.bundles[0].files[0].scope = "USER"))).toBe(false);
    expect(mutate((b) => (b.extra = 1))).toBe(false);
    expect(mutate((b) => (b.verification = [{ path: "x", status: "APPLIED" }]))).toBe(false);
  });

  it("the real response prepares repository files only for repository-scope capabilities", () => {
    const body = artifactsRich().body;
    expect(body.bundles.map((b) => b.capability).sort()).toEqual(["HOOKS", "KIROIGNORE", "STEERING"]);
    expect(body.instructions.map((i) => i.capability)).toEqual(["PERMISSIONS"]);
    expect(body.skipped.map((s) => s.capability)).toEqual(["POWERS"]);
    expect(body.bundles.flatMap((b) => b.files).every((f) => f.validation.ok && f.status === "NEW")).toBe(true);
  });
});

function harness(extra: Partial<AppProps> = {}) {
  const storage = createIndexedDbStorage(new IDBFactory());
  // Like the real backend, it answers only for the capabilities that were requested.
  const preview = vi.fn(async (body: { capabilities: string[] }) => {
    const full = artifactsRich().body;
    const wanted = new Set(body.capabilities);
    return ok<PreviewResponse>({
      ...full,
      bundles: full.bundles.filter((b) => wanted.has(b.capability)),
      instructions: full.instructions.filter((i) => wanted.has(i.capability)),
      skipped: full.skipped.filter((s) => wanted.has(s.capability)),
    });
  });
  const exporter = { download: vi.fn(), copy: vi.fn(async () => true) } satisfies Exporter;
  const props: AppProps = {
    storage,
    systemPrefersReducedMotion: false,
    listRepositories: async () => ok(repositoriesFixture().body.repositories),
    getCapabilities: async () => ok(capabilitiesFixture().body),
    previewArtifacts: preview as never,
    exporter,
    analysisDeps: {
      interpret: async () => ok(interpretInvestigate().body),
      investigate: async () => ({ kind: "result", result: clone(complete().body) }),
      profile: async (): Promise<CallOutcome<ProfileResponse>> => ok(profileRich().body),
      makeId: () => "snap-art",
      now: () => new Date("2026-11-12T10:00:00.000Z"),
    },
    ...extra,
  };
  return { props, storage, preview, exporter };
}

async function openReport(h: ReturnType<typeof harness>) {
  window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false }));
  const view = await render(<App {...h.props} />);
  await settle();
  await type(byRole("textbox", "Your request") as HTMLTextAreaElement, "sample - Why does src/billing.py exist?");
  await click(byRole("button", "Investigate") as HTMLElement);
  await settle();
  return view;
}
const card = (capability: string) => document.querySelector(`[data-testid="recommendation"][data-capability="${capability}"]`) as HTMLDetailsElement;
async function prepare(capability: string) {
  card(capability).open = true;
  await click(tid("prepare", card(capability))!);
  await settle();
}

describe("preparing, exporting and checking files", () => {
  it("shows a reviewable file, its format check, and says that Sean changes nothing", async () => {
    const h = harness();
    await openReport(h);
    expect(tid("artifact-panel", card("STEERING"))!.textContent).toContain("Sean never changes your repository");
    await prepare("STEERING");
    expect(h.preview).toHaveBeenCalledWith({ repository_id: "sample", capabilities: ["STEERING"] });
    const file = tid("artifact-file", card("STEERING"))!;
    expect(file.textContent).toContain(".kiro/steering/project-conventions.md");
    expect(file.textContent).toContain("FORMAT VALID");
    expect(file.textContent).toContain("NEW FILE");
    expect(file.querySelector("pre")!.textContent).toContain("inclusion: always");
  });

  it("the lifecycle moves from recommended to prepared to exported and never claims applied", async () => {
    const h = harness();
    await openReport(h);
    const badge = () => card("STEERING").querySelector("summary")!.textContent!;
    expect(badge()).not.toMatch(/PREPARED|EXPORTED/);
    await prepare("STEERING");
    expect(badge()).toContain("FILES PREPARED");
    await click(byRole("button", "Download", card("STEERING")) as HTMLElement);
    await settle();
    expect(badge()).toContain("EXPORTED");
    expect(h.exporter.download).toHaveBeenCalledWith("project-conventions.md", expect.stringContaining("inclusion: always"));
    expect(tid("artifact-note", card("STEERING"))!.textContent).toContain("then commit it");
    expect(document.body.textContent).not.toMatch(/\bAPPLIED\b|\bINSTALLED\b/);
  });

  it("copy exports too, and a blocked copy is reported instead of recorded", async () => {
    const h = harness();
    h.exporter.copy.mockResolvedValueOnce(false);
    await openReport(h);
    await prepare("KIROIGNORE");
    await click(byRole("button", "Copy", card("KIROIGNORE")) as HTMLElement);
    await settle();
    expect(tid("artifact-note", card("KIROIGNORE"))!.textContent).toContain("blocked");
    expect(card("KIROIGNORE").querySelector("summary")!.textContent).not.toContain("EXPORTED");
    await click(byRole("button", "Copy", card("KIROIGNORE")) as HTMLElement);
    await settle();
    expect(card("KIROIGNORE").querySelector("summary")!.textContent).toContain("EXPORTED");
  });

  it("checks the committed files only on request and reports each answer in words", async () => {
    const h = harness();
    await openReport(h);
    await prepare("STEERING");
    expect(tid("check-committed", card("STEERING"))).toBeNull();
    await click(byRole("button", "Download", card("STEERING")) as HTMLElement);
    await settle();
    for (const [status, words] of [["ABSENT", "Not found in the committed history yet"], ["DIFFERENT", "differs from the prepared one"], ["IDENTICAL", "VERIFIED"]] as const) {
      h.preview.mockResolvedValueOnce(ok({ ...artifactsRich().body, bundles: [], instructions: [], skipped: [], verification: [{ path: ".kiro/steering/project-conventions.md", status }] }));
      await click(tid("check-committed", card("STEERING"))!);
      await settle();
      expect(tid("artifact-note", card("STEERING"))!.textContent).toContain(words);
    }
    const lastCall = h.preview.mock.calls.at(-1)![0] as { verify: { path: string; content_sha256: string }[]; capabilities: string[] };
    expect(lastCall.capabilities).toEqual([]);
    expect(lastCall.verify[0]!.content_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("an invalid file cannot be exported", async () => {
    const h = harness();
    const broken = clone(artifactsRich().body);
    broken.bundles[0]!.files[0]!.validation = { ok: false, problems: ["The file contains text that looks like a secret."] };
    broken.bundles = broken.bundles.filter((b) => b.capability === broken.bundles[0]!.capability);
    h.preview.mockResolvedValue(ok(broken));
    await openReport(h);
    await prepare(broken.bundles[0]!.capability);
    const scope = card(broken.bundles[0]!.capability);
    expect(tid("validation-problems", scope)!.textContent).toContain("looks like a secret");
    expect((byRole("button", "Download", scope) as HTMLButtonElement).disabled).toBe(true);
    expect((byRole("button", "Copy", scope) as HTMLButtonElement).disabled).toBe(true);
    expect(h.exporter.download).not.toHaveBeenCalled();
  });

  it("an existing file is a conflict with a diff, never an overwrite", async () => {
    const h = harness();
    const conflicted = clone(artifactsRich().body);
    const bundle = conflicted.bundles.find((b) => b.capability === "STEERING")!;
    bundle.files[0] = { ...bundle.files[0]!, status: "CONFLICT", existing_content: "# ours\n", diff: "-# ours\n+# prepared", alternative_path: ".kiro/steering/project-conventions-prepared.md" };
    conflicted.bundles = [bundle];
    h.preview.mockResolvedValue(ok(conflicted));
    await openReport(h);
    await prepare("STEERING");
    const conflict = tid("conflict", card("STEERING"))!;
    expect(conflict.textContent).toContain("will not suggest overwriting");
    expect(conflict.textContent).toContain("-# ours");
    expect(conflict.textContent).toContain(".kiro/steering/project-conventions-prepared.md");
  });

  it("a user-level capability shows instructions, labelled as not a repository file", async () => {
    const h = harness();
    await openReport(h);
    await prepare("PERMISSIONS");
    const panel = tid("instructions", card("PERMISSIONS"))!;
    expect(panel.textContent).toContain("NOT A REPOSITORY FILE");
    expect(panel.querySelector("pre")!.textContent).toContain("effect: deny");
    expect(tid("artifact-file", card("PERMISSIONS"))).toBeNull();
  });

  it("a failed preview is an error with a retry, not an empty panel", async () => {
    const h = harness();
    h.preview.mockResolvedValue({ kind: "network" } as never);
    await openReport(h);
    await prepare("STEERING");
    expect(tid("prepare-error", card("STEERING"))!.textContent).toContain("could not be reached");
    expect(tid("prepare", card("STEERING"))).not.toBeNull();
  });

  it("offers no preparation for a capability that is not recommended", async () => {
    const h = harness();
    await openReport(h);
    for (const c of Array.from(document.querySelectorAll('[data-testid="recommendation"]'))) {
      const status = c.getAttribute("data-status");
      if (status === "NOT_RECOMMENDED" || status === "INSUFFICIENT_EVIDENCE") expect(tid("artifact-panel", c as HTMLElement)).toBeNull();
    }
  });

  it("export records persist with the saved report, and evidence is untouched", async () => {
    const h = harness();
    const view = await openReport(h);
    const before = (await h.storage.all())[0]!;
    await prepare("STEERING");
    await click(byRole("button", "Download", card("STEERING")) as HTMLElement);
    await settle();
    const after = (await h.storage.all())[0]!;
    const snap = after.snapshot as any;
    expect(snap.artifacts.map((a: any) => [a.capability, a.state])).toEqual([["STEERING", "ARTIFACT_EXPORTED"]]);
    expect({ ...snap, artifacts: [] }).toEqual({ ...(before.snapshot as object), artifacts: [] });
    await view.unmount();
    await render(<App {...h.props} />);
    await settle();
    await click(byRole("button", /Why does/, tid("recent")!) as HTMLElement);
    await settle();
    expect(card("STEERING").querySelector("summary")!.textContent).toContain("EXPORTED");
  });
});