import { describe, expect, it } from "vitest";
import { validateCapabilities, validateInterpreted, validateProfileResponse, validateRepositories } from "../src/features/analysis/validateAdvisor";
import { capabilitiesFixture, clone, interpretAdvise, interpretInvestigate, interpretNeedsTarget, interpretUnresolved, profileRich, profileSample, profileShallow, repositoriesFixture } from "./fixtures";

const rich = () => clone(profileRich().body);

describe("captured backend responses validate", () => {
  it.each([["rich", profileRich], ["sample", profileSample], ["shallow", profileShallow]])("profile %s", (_n, load) => {
    const checked = validateProfileResponse(load().body);
    expect(checked.ok, checked.ok ? "" : checked.reason).toBe(true);
  });
  it("repositories and interpretations", () => {
    expect(validateRepositories(repositoriesFixture().body).ok).toBe(true);
    for (const load of [interpretInvestigate, interpretAdvise, interpretNeedsTarget, interpretUnresolved]) {
      const checked = validateInterpreted(load().body);
      expect(checked.ok, checked.ok ? "" : checked.reason).toBe(true);
    }
  });
  it("the real rich repository produces adoptable recommendations and the sample does not", () => {
    const rec = (body: ReturnType<typeof rich>) => body.advisor.recommendations.filter((r) => r.recommendation_status === "ADOPT_NOW").map((r) => r.capability);
    expect(rec(rich())).toEqual(expect.arrayContaining(["STEERING", "SPECS", "BUGFIX_SPECS", "KIROIGNORE"]));
    expect(rec(clone(profileSample().body))).toEqual([]);
  });
});

describe("profile validation rejects contract violations", () => {
  function expectRejected(mutate: (body: ReturnType<typeof rich>) => void, fragment: string) {
    const body = rich();
    mutate(body);
    const checked = validateProfileResponse(body);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.reason).toContain(fragment);
  }
  const first = (body: ReturnType<typeof rich>, status: string) => body.advisor.recommendations.find((r) => r.recommendation_status === status)!;

  it("unknown top-level or nested fields", () => {
    expectRejected((b) => ((b as unknown as Record<string, unknown>).extra = 1), "extra");
    expectRejected((b) => ((b.profile as unknown as Record<string, unknown>).extra = 1), "profile.extra");
    expectRejected((b) => ((b.advisor.recommendations[0] as unknown as Record<string, unknown>).extra = 1), "extra");
  });
  it("bad enum values", () => {
    expectRejected((b) => ((b.advisor.recommendations[0] as unknown as Record<string, string>).recommendation_status = "MAYBE"), "recommendation_status");
    expectRejected((b) => ((b.profile.observations[0] as unknown as Record<string, string>).classification = "CERTAIN"), "classification");
    expectRejected((b) => ((b.profile as unknown as Record<string, string>).basis = "WORKING_TREE"), "basis");
  });
  it("an actionable recommendation without evidence", () => {
    expectRejected((b) => (first(b, "ADOPT_NOW").evidence_references = []), "evidence");
  });
  it("an evidence reference that is not in the profile", () => {
    expectRejected((b) => (first(b, "ADOPT_NOW").evidence_references = ["obs-forged"]), "exist in the profile");
  });
  it("a DOCUMENTED claim over inferred evidence", () => {
    const body = rich();
    const bugfix = body.advisor.recommendations.find((r) => r.capability === "BUGFIX_SPECS")!;
    expect(body.profile.observations.filter((o) => bugfix.evidence_references.includes(o.observation_id)).some((o) => o.classification === "INFERRED")).toBe(true);
    bugfix.evidence_classification = "DOCUMENTED";
    expect(validateProfileResponse(body).ok).toBe(false);
  });
  it("a DOCUMENTED claim from an incomplete scan", () => {
    expectRejected((b) => {
      b.profile.truncated = true;
      for (const r of b.advisor.recommendations) if (r.evidence_classification !== "INSUFFICIENT_EVIDENCE") r.evidence_classification = "DOCUMENTED";
      for (const o of b.profile.observations) o.classification = "DOCUMENTED";
    }, "incomplete");
  });
  it("a repository file for a capability that cannot be one", () => {
    expectRejected((b) => {
      const p = b.advisor.recommendations.find((r) => r.capability === "PERMISSIONS" || r.adoption_scope !== "REPOSITORY")!;
      p.configuration_strategy = "GENERATE_FILE";
    }, "repository file");
  });
  it("a file for a not-recommended capability", () => {
    const body = clone(profileSample().body);
    const item = body.advisor.recommendations.find((r) => r.recommendation_status === "NOT_RECOMMENDED")!;
    item.configuration_strategy = "GENERATE_FILE";
    const checked = validateProfileResponse(body);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.reason).toContain("not recommended");
  });
  it("an artifact kind without the GENERATE_FILE strategy", () => {
    expectRejected((b) => {
      const item = first(b, "CONSIDER");
      item.configuration_strategy = "INSTRUCTIONS_ONLY";
      item.artifact_kind = "HOOK";
    }, "artifact");
  });
  it("insufficient evidence must be stated as such", () => {
    expectRejected((b) => (first(b, "INSUFFICIENT_EVIDENCE").evidence_classification = "DOCUMENTED"), "insufficient");
  });
  it("roadmap entries must be assessed capabilities", () => {
    expectRejected((b) => b.advisor.roadmap.immediate.push("TELEPORTATION"), "roadmap");
  });
  it("advisor built from another profile", () => {
    expectRejected((b) => (b.advisor.profile_head = "f".repeat(40)), "built from this profile");
  });
  it("duplicate observation IDs and oversized collections", () => {
    expectRejected((b) => b.profile.observations.push(b.profile.observations[0]!), "unique");
    expectRejected((b) => {
      b.profile.observations = Array.from({ length: 1001 }, (_, i) => ({ ...b.profile.observations[0]!, observation_id: `obs-${i}` }));
    }, "at most 1000");
    expectRejected((b) => (b.advisor.recommendations[0]!.summary = "x".repeat(4001)), "4000");
  });
  it("non-integer counts and non-objects", () => {
    expectRejected((b) => (b.profile.summary.source_files = 1.5), "integer");
    expect(validateProfileResponse(null).ok).toBe(false);
    expect(validateProfileResponse([]).ok).toBe(false);
    expect(validateProfileResponse("x").ok).toBe(false);
  });
});

describe("interpretation validation", () => {
  const base = () => clone(interpretInvestigate().body) as unknown as Record<string, unknown>;
  it("rejects an investigation without a path", () => {
    const b = base();
    b.target_path = null;
    expect(validateInterpreted(b).ok).toBe(false);
  });
  it("rejects unknown fields, bad modes, and oversized candidates", () => {
    expect(validateInterpreted({ ...base(), extra: 1 }).ok).toBe(false);
    expect(validateInterpreted({ ...base(), mode: "EXECUTE" }).ok).toBe(false);
    expect(validateInterpreted({ ...base(), candidates: Array(11).fill("a.py") }).ok).toBe(false);
  });
  it("an unresolved plan may have no repository", () => {
    expect(validateInterpreted(interpretUnresolved().body).ok).toBe(true);
  });
});

describe("repository list validation", () => {
  it("rejects an invalid identifier and unknown fields", () => {
    expect(validateRepositories({ repositories: [{ repository_id: "BAD ID", available: true, github: null }] }).ok).toBe(false);
    expect(validateRepositories({ repositories: [{ repository_id: "ok", available: true, github: null, path: "C:\\x" }] }).ok).toBe(false);
    expect(validateRepositories({ repositories: [{ repository_id: "ok", available: "yes", github: null }] }).ok).toBe(false);
  });
});

describe("capabilities validation", () => {
  it("accepts the captured response and rejects extra fields, a missing field and a wrong type", () => {
    expect(validateCapabilities(capabilitiesFixture().body).ok).toBe(true);
    const base = clone(capabilitiesFixture().body) as unknown as { ai_interpreter: Record<string, unknown> };
    expect(validateCapabilities({ ...base, extra: 1 }).ok).toBe(false);
    expect(validateCapabilities({ ai_interpreter: { ...base.ai_interpreter, api_key: "x" } }).ok).toBe(false);
    expect(validateCapabilities({ ai_interpreter: { ...base.ai_interpreter, available: "yes" } }).ok).toBe(false);
    expect(validateCapabilities({}).ok).toBe(false);
  });
});
describe("AI status in the interpretation", () => {
  it("accepts every known status and rejects an unknown one or a missing one", () => {
    const base = clone(interpretInvestigate().body) as unknown as Record<string, unknown>;
    for (const status of ["NOT_REQUESTED", "NOT_NEEDED", "AI_USED", "AI_TIMEOUT", "AI_HTTP_ERROR", "AI_CONNECTION_FAILED", "AI_INVALID_REPLY", "AI_UNEXPECTED"]) {
      expect(validateInterpreted({ ...base, ai_status: status }).ok, status).toBe(true);
    }
    expect(validateInterpreted({ ...base, ai_status: "GUESSED" }).ok).toBe(false);
    const { ai_status: _removed, ...withoutStatus } = base;
    expect(validateInterpreted(withoutStatus).ok).toBe(false);
  });
  it("the captured responses carry a status", () => {
    expect(interpretInvestigate().body.ai_status).toBeDefined();
    expect(interpretAdvise().body.ai_status).toBeDefined();
  });
});
