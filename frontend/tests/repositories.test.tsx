/**
 * The Repositories page: add, edit, remove and select, with the backend functions injected. The injected functions behave like
 * the real backend (an in-memory registry that rejects bad input with the same codes), so the page and the application are
 * tested together. The real backend's rules are tested in backend/tests/unit/test_repository_management.py, and the whole
 * thing runs end to end in e2e/repositories.spec.ts.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, type AppProps } from "../src/app/App";
import { cleanPath, suggestIdentifier, validateDraft } from "../src/components/shell/RepositoriesView";
import { createIndexedDbStorage } from "../src/features/report/reportStore";
import type { CallOutcome } from "../src/services/advisorClient";
import type { RepositoryListItem } from "../src/types/advisor";
import type { BackendError } from "../src/types/contract";
import { act, byRole, click, render, type } from "./renderHelpers";
import { capabilitiesFixture, clone } from "./fixtures";

const tid = (id: string, scope: ParentNode = document): HTMLElement | null => scope.querySelector(`[data-testid="${id}"]`);
const must = (id: string, scope: ParentNode = document): HTMLElement => {
  const found = tid(id, scope);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
}
const ok = <T,>(value: T): CallOutcome<T> => ({ kind: "ok", value: clone(value) });
const rejected = (status: number, code: string, message: string, field: string | null = null): CallOutcome<never> => ({
  kind: "rejected", status, error: { code, message, retryable: false, field, candidates: [] } as BackendError,
});

/** An in-memory registry with the same rules and codes as the backend. */
function fakeBackend(initial: RepositoryListItem[]) {
  let items = [...initial];
  const calls: string[] = [];
  const existsOnDisk = new Set(["C:\\work\\alpha", "C:\\work\\beta", "C:\\work\\gamma"]);
  const gitRepos = new Set(["C:\\work\\alpha", "C:\\work\\beta"]);
  const norm = (p: string) => p.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
  const check = (id: string | null, path: string): CallOutcome<never> | null => {
    const key = [...existsOnDisk].find((p) => norm(p) === norm(path));
    if (!key) return rejected(400, "PATH_NOT_FOUND", "That folder does not exist.", "path");
    if (!gitRepos.has(key)) return rejected(400, "NOT_A_GIT_REPOSITORY", "That folder is not a Git repository.", "path");
    if (items.some((i) => i.repository_id !== id && norm(i.path) === norm(path))) return rejected(409, "DUPLICATE_PATH", "That folder is already registered.", "path");
    return null;
  };
  return {
    calls,
    get items() { return items; },
    list: vi.fn(async () => ok(items)),
    create: vi.fn(async (body: { repository_id: string; display_name: string; path: string }) => {
      calls.push(`create ${body.repository_id}`);
      if (items.some((i) => i.repository_id === body.repository_id)) return rejected(409, "DUPLICATE_ID", "That identifier is already used.", "repository_id");
      const problem = check(null, body.path);
      if (problem) return problem;
      const item: RepositoryListItem = { repository_id: body.repository_id, display_name: body.display_name, path: body.path, available: true, github: null };
      items = [...items, item];
      return ok(item);
    }),
    update: vi.fn(async (id: string, body: { display_name: string; path: string }) => {
      calls.push(`update ${id}`);
      const problem = check(id, body.path);
      if (problem) return problem;
      items = items.map((i) => (i.repository_id === id ? { ...i, ...body } : i));
      return ok(items.find((i) => i.repository_id === id)!);
    }),
    remove: vi.fn(async (id: string) => {
      calls.push(`remove ${id}`);
      items = items.filter((i) => i.repository_id !== id);
      return ok({ removed: id });
    }),
  };
}

const ALPHA: RepositoryListItem = { repository_id: "alpha", display_name: "Alpha service", path: "C:\\work\\alpha", available: true, github: null };

function props(backend: ReturnType<typeof fakeBackend>, over: Partial<AppProps> = {}): AppProps {
  return {
    storage: createIndexedDbStorage(new IDBFactory()),
    systemPrefersReducedMotion: false,
    listRepositories: backend.list as never,
    createRepository: backend.create as never,
    updateRepository: backend.update as never,
    deleteRepository: backend.remove as never,
    getCapabilities: async () => ok(capabilitiesFixture().body),
    ...over,
  };
}

async function openPage(backend: ReturnType<typeof fakeBackend>) {
  window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false }));
  const view = await render(<App {...props(backend)} />);
  await settle();
  await click(byRole("button", "Repositories") as HTMLElement);
  await settle();
  return view;
}
async function fill(testId: string, value: string): Promise<void> {
  await type(must(testId) as HTMLInputElement, value);
}
const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-testid="repository-row"]')];

beforeEach(() => {
  window.localStorage.clear();
});

describe("helpers", () => {
  it("suggests an identifier from a name", () => {
    expect(suggestIdentifier("Billing API")).toBe("billing-api");
    expect(suggestIdentifier("  My_Repo (v2)!  ")).toBe("my_repo-v2");
    expect(suggestIdentifier("---x")).toBe("x");
    expect(suggestIdentifier("")).toBe("");
    expect(suggestIdentifier("é".repeat(5))).toBe("");
    expect(suggestIdentifier("a".repeat(100)).length).toBe(64);
  });
  it("removes the quotes Explorer adds when it copies a path", () => {
    expect(cleanPath('"C:\\work\\alpha"')).toBe("C:\\work\\alpha");
    expect(cleanPath("  C:\\work\\alpha  ")).toBe("C:\\work\\alpha");
  });
  it("validates a draft", () => {
    const good = { display_name: "Alpha", repository_id: "alpha", path: "C:\\work\\alpha" };
    expect(validateDraft(good, false)).toEqual({});
    expect(validateDraft({ ...good, display_name: " " }, false).display_name).toBeDefined();
    expect(validateDraft({ ...good, display_name: "x".repeat(81) }, false).display_name).toBeDefined();
    expect(validateDraft({ ...good, display_name: "a\u0007b" }, false).display_name).toBeDefined();
    expect(validateDraft({ ...good, repository_id: "Bad Id" }, false).repository_id).toBeDefined();
    expect(validateDraft({ ...good, repository_id: "" }, false).repository_id).toBeDefined();
    expect(validateDraft({ ...good, repository_id: "Bad Id" }, true).repository_id).toBeUndefined();
    for (const path of ["", "work\\alpha", "\\\\server\\share", "/home/me/project", "alpha"]) expect(validateDraft({ ...good, path }, false).path).toBeDefined();
    expect(validateDraft({ ...good, path: '"C:\\work\\alpha"' }, false)).toEqual({});
  });
});

describe("the Repositories page", () => {
  it("lists each repository with its name, identifier, folder and status, in the existing page", async () => {
    const backend = fakeBackend([ALPHA, { ...ALPHA, repository_id: "beta", display_name: "Beta", path: "C:\\work\\beta", available: false }]);
    await openPage(backend);
    expect(rows()).toHaveLength(2);
    expect(rows()[0]!.textContent).toContain("Alpha service");
    expect(rows()[0]!.textContent).toContain("alpha");
    expect(must("repository-path", rows()[0]!).textContent).toBe("C:\\work\\alpha");
    expect(rows()[0]!.textContent).toContain("AVAILABLE");
    expect(rows()[1]!.textContent).toContain("UNAVAILABLE");
    expect((byRole("button", /^Use /, rows()[1]!) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelectorAll('[data-testid="repositories"]')).toHaveLength(1);
  });

  it("shows an empty state that points at Add repository", async () => {
    await openPage(fakeBackend([]));
    expect(must("no-repositories").textContent).toContain("Add repository");
  });

  it("adds a repository: the identifier follows the name, the path is cleaned, the list updates at once", async () => {
    const backend = fakeBackend([ALPHA]);
    await openPage(backend);
    await click(must("add-repository"));
    await fill("field-display-name", "Beta Service");
    expect((must("field-repository-id") as HTMLInputElement).value).toBe("beta-service");
    await fill("field-repository-id", "beta");
    await fill("field-display-name", "Beta Service 2");
    expect((must("field-repository-id") as HTMLInputElement).value).toBe("beta");
    await fill("field-path", '"C:\\work\\beta"');
    await click(must("repository-submit"));
    await settle();
    expect(backend.create).toHaveBeenCalledWith({ repository_id: "beta", display_name: "Beta Service 2", path: "C:\\work\\beta" });
    expect(tid("repository-form")).toBeNull();
    expect(rows().map((r) => r.dataset.repositoryId)).toEqual(["alpha", "beta"]);
    expect(must("repositories-status").textContent).toContain("Added Beta Service 2");
    // It can be used for an investigation straight away, without a restart.
    await click(byRole("button", /^Use Beta Service 2/, rows()[1]!) as HTMLElement);
    await settle();
    expect((document.querySelector("select") as HTMLSelectElement).value).toBe("beta");
  });

  it("checks the fields before sending anything and says what to fix", async () => {
    const backend = fakeBackend([ALPHA]);
    await openPage(backend);
    await click(must("add-repository"));
    await click(must("repository-submit"));
    expect(must("error-display_name")).not.toBeNull();
    expect(must("error-repository_id")).not.toBeNull();
    expect(must("error-path").textContent).toMatch(/folder/i);
    expect(backend.create).not.toHaveBeenCalled();
    await fill("field-display-name", "Gamma");
    await fill("field-path", "gamma");
    await click(must("repository-submit"));
    expect(must("error-path").textContent).toMatch(/drive letter/);
    expect(backend.create).not.toHaveBeenCalled();
  });

  it.each([
    ["a folder that does not exist", "C:\\work\\missing", "error-path", /does not exist/],
    ["a folder that is not a Git repository", "C:\\work\\gamma", "error-path", /not a Git repository/],
    ["a folder that is already registered, even spelled differently", "c:/WORK/alpha/", "error-path", /already registered/],
  ])("shows the backend's refusal of %s next to the field and keeps what was typed", async (_name, path, errorId, message) => {
    const backend = fakeBackend([ALPHA]);
    await openPage(backend);
    await click(must("add-repository"));
    await fill("field-display-name", "Other");
    await fill("field-path", path);
    await click(must("repository-submit"));
    await settle();
    expect(must(errorId).textContent).toMatch(message);
    expect((must("field-path") as HTMLInputElement).value).toBe(path);
    expect(rows()).toHaveLength(1);
    expect(backend.items).toHaveLength(1);
  });

  it("shows a duplicate identifier at the identifier field", async () => {
    const backend = fakeBackend([ALPHA]);
    await openPage(backend);
    await click(must("add-repository"));
    await fill("field-display-name", "Alpha");
    await fill("field-path", "C:\\work\\beta");
    await click(must("repository-submit"));
    await settle();
    expect(must("error-repository_id").textContent).toMatch(/already used/);
  });

  it("explains a network failure without pretending anything changed", async () => {
    const backend = fakeBackend([ALPHA]);
    window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false }));
    await render(<App {...props(backend, { createRepository: (async () => ({ kind: "network" })) as never })} />);
    await settle();
    await click(byRole("button", "Repositories") as HTMLElement);
    await click(must("add-repository"));
    await fill("field-display-name", "Beta");
    await fill("field-path", "C:\\work\\beta");
    await click(must("repository-submit"));
    await settle();
    expect(must("repository-form-error").textContent).toMatch(/could not be reached.*nothing was changed/i);
    expect(rows()).toHaveLength(1);
  });

  it("edits the name and folder; the identifier is read-only; the same folder may be kept", async () => {
    const backend = fakeBackend([ALPHA, { ...ALPHA, repository_id: "beta", display_name: "Beta", path: "C:\\work\\beta" }]);
    await openPage(backend);
    await click(byRole("button", "Edit Alpha service") as HTMLElement);
    expect((must("field-repository-id") as HTMLInputElement).readOnly).toBe(true);
    await fill("field-display-name", "Alpha renamed");
    await click(must("repository-submit"));
    await settle();
    expect(backend.update).toHaveBeenCalledWith("alpha", { display_name: "Alpha renamed", path: "C:\\work\\alpha" });
    expect(rows()[0]!.textContent).toContain("Alpha renamed");
    expect(must("repositories-status").textContent).toContain("Saved Alpha renamed");
    // Moving it onto another repository's folder is refused.
    await click(byRole("button", "Edit Alpha renamed") as HTMLElement);
    await fill("field-path", "C:\\work\\beta");
    await click(must("repository-submit"));
    await settle();
    expect(must("error-path").textContent).toMatch(/already registered/);
    await click(byRole("button", "Cancel") as HTMLElement);
    expect(tid("repository-edit-form")).toBeNull();
    expect(rows()[0]!.textContent).toContain("C:\\work\\alpha");
  });

  it("removes only after confirmation, says the folder is untouched, and can be cancelled", async () => {
    const backend = fakeBackend([ALPHA, { ...ALPHA, repository_id: "beta", display_name: "Beta", path: "C:\\work\\beta" }]);
    await openPage(backend);
    await click(byRole("button", "Remove Alpha service") as HTMLElement);
    expect(backend.remove).not.toHaveBeenCalled();
    expect(must("remove-confirm").textContent).toMatch(/folder.*not touched/i);
    await click(must("keep-repository"));
    expect(tid("remove-confirm")).toBeNull();
    expect(rows()).toHaveLength(2);
    await click(byRole("button", "Remove Alpha service") as HTMLElement);
    await click(must("confirm-remove"));
    await settle();
    expect(backend.remove).toHaveBeenCalledTimes(1);
    expect(backend.remove).toHaveBeenCalledWith("alpha");
    expect(rows().map((r) => r.dataset.repositoryId)).toEqual(["beta"]);
    expect(must("repositories-status").textContent).toMatch(/Removed Alpha service.*not touched/);
  });

  it("a removed repository is no longer selected for investigations", async () => {
    const backend = fakeBackend([ALPHA, { ...ALPHA, repository_id: "beta", display_name: "Beta", path: "C:\\work\\beta" }]);
    window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false, lastRepositoryId: "alpha" }));
    await render(<App {...props(backend)} />);
    await settle();
    expect((document.querySelector("select") as HTMLSelectElement).value).toBe("alpha");
    await click(byRole("button", "Repositories") as HTMLElement);
    await settle();
    expect(rows()[0]!.textContent).toContain("SELECTED");
    await click(byRole("button", "Remove Alpha service") as HTMLElement);
    await click(must("confirm-remove"));
    await settle();
    await click(byRole("button", "New Investigation") as HTMLElement);
    await settle();
    expect((document.querySelector("select") as HTMLSelectElement).value).not.toBe("alpha");
  });

  it("with the backend unreachable the page still opens and says why the list is missing", async () => {
    window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false }));
    await render(<App {...props(fakeBackend([]), { listRepositories: (async () => ({ kind: "network" })) as never })} />);
    await settle();
    await click(byRole("button", "Repositories") as HTMLElement);
    await settle();
    expect(document.body.textContent).toMatch(/backend could not be reached/);
    expect(tid("add-repository")).not.toBeNull();
  });
});
