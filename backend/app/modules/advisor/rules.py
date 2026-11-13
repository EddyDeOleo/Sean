"""Advisor rules (Spec 4 section 6.3).

One pure function per capability. A rule reads the profile and returns one Recommendation. Thresholds are named constants.
A rule never recommends a capability without observations that exist in the profile, and it says "not recommended" or
"insufficient evidence" when the repository gives no reason.
"""

from __future__ import annotations

from collections.abc import Callable

from app.modules.advisor import catalog as cat
from app.modules.advisor.contract import (
    Recommendation,
    classification_for,
    confidence_for,
    priority_for,
)
from app.modules.repository_profile.models import (
    KIRO_AGENTS,
    KIRO_AGENTS_MD,
    KIRO_HOOKS,
    KIRO_IGNORE,
    KIRO_MCP,
    KIRO_SKILLS,
    KIRO_SPECS,
    INCOMPLETE_CODES,
    KIRO_STEERING,
    Observation,
    RepositoryProfile,
)

# Thresholds. Changing one changes recommendations, so each has a test at its boundary.
SPECS_ADOPT_MIN_SOURCE_FILES = 40
SPECS_ADOPT_MIN_AREAS = 3
SPECS_CONSIDER_MIN_SOURCE_FILES = 15
SPECS_CONSIDER_MIN_AREAS = 2
SPECS_MIN_FILES_FOR_ASSESSMENT = 5
BUGFIX_ADOPT_MIN_FIXES = 10
BUGFIX_ADOPT_MIN_SHARE = 0.25
BUGFIX_CONSIDER_MIN_FIXES = 3
AREA_MIN_SOURCE_FILES = 10
AREA_MIN_SHARE = 0.10
SKILLS_MIN_SCRIPTS = 3
SKILLS_MIN_DOCS = 5
STEERING_ADOPT_MIN_SOURCES = 2

COMMITTED_ONLY = "Based on the committed tree and history at HEAD. Uncommitted files are not seen."


def _kiro(profile: RepositoryProfile, value: str) -> Observation | None:
    found = profile.find("KIRO_CONFIG", value=value)
    return found[0] if found else None


def _qualifying_areas(profile: RepositoryProfile):
    total = max(profile.summary.source_files, 1)
    return [
        area
        for area in profile.summary.areas
        if area.source_files >= AREA_MIN_SOURCE_FILES and area.source_files / total >= AREA_MIN_SHARE
    ]


def _area_observations(profile: RepositoryProfile, names: list[str]) -> list[Observation]:
    return [o for o in profile.find("AREA") if o.value in names]


def _build(
    profile: RepositoryProfile,
    capability: str,
    status: str,
    *,
    summary: str,
    signal: str,
    reasoning: str,
    benefit: str,
    effort: str = "LOW",
    refs: list[Observation] | None = None,
    prerequisites: list[str] | None = None,
    needs_external_setup: bool = False,
    risks: list[str] | None = None,
    verification: str,
    strategy: str = "NONE",
    artifact_kind: str | None = None,
    uses_history: bool = False,
    extra_limitations: list[str] | None = None,
) -> Recommendation:
    entry = cat.CATALOG[capability]
    refs = refs or []
    any_inferred = any(item.classification == "INFERRED" for item in refs)
    insufficient = status == "INSUFFICIENT_EVIDENCE"
    # Confidence describes the assessment. An assessment that could not be made has low confidence by definition.
    confidence = (
        "LOW" if insufficient else confidence_for(profile, any_inferred=any_inferred, uses_history=uses_history)
    )
    limitations = [COMMITTED_ONLY, *(extra_limitations or [])]
    if profile.truncated:
        limitations.append("The tree was truncated, so absent signals may exist outside the analyzed part.")
    if profile.shallow:
        limitations.append("The repository is a shallow clone, so history signals are incomplete.")
    covered = {"TREE_TRUNCATED", "SHALLOW_CLONE"}
    for item in profile.limitations:
        if item.code in INCOMPLETE_CODES and item.code not in covered:
            limitations.append(f"{item.message} A negative finding here is not reliable.")
    if uses_history and profile.history_limited:
        limitations.append("History counts describe the latest commits only.")
    return Recommendation(
        capability=capability,
        title=entry.title,
        summary=summary,
        repository_signal=signal,
        evidence_references=[item.observation_id for item in refs],
        evidence_classification=classification_for(
            profile, any_inferred=any_inferred, uses_history=uses_history, insufficient=insufficient
        ),
        reasoning=reasoning,
        expected_benefit=benefit,
        priority=priority_for(status, confidence, effort),
        recommendation_status=status,
        implementation_effort=effort,
        prerequisites=prerequisites or [],
        needs_external_setup=needs_external_setup,
        risks=risks or [],
        adoption_scope=entry.scope,
        configuration_strategy=strategy,
        artifact_kind=artifact_kind,
        verification_method=verification,
        confidence=confidence,
        limitations=limitations,
    )


def rule_steering(p: RepositoryProfile) -> Recommendation:
    existing = [o for o in (_kiro(p, KIRO_STEERING), _kiro(p, KIRO_AGENTS_MD)) if o]
    sources = p.find("CONVENTION")
    if existing:
        return _build(
            p, cat.STEERING, "NOT_RECOMMENDED", refs=existing,
            summary="Steering is already present.",
            signal="Committed steering or AGENTS.md files exist.",
            reasoning="Existing steering is in place. This analysis cannot show a gap in it, so adding more would be speculation.",
            benefit="None beyond what the existing files provide.", verification="Not applicable.",
        )
    if len(sources) >= STEERING_ADOPT_MIN_SOURCES:
        return _build(
            p, cat.STEERING, "ADOPT_NOW", refs=sources[:5], effort="LOW", strategy="GENERATE_FILE", artifact_kind="STEERING",
            summary="Capture the repository's existing conventions as persistent Kiro steering.",
            signal=f"{len(sources)} separate convention sources are committed (lint, format or contribution files) and no steering exists.",
            reasoning="The conventions already exist in tool configuration and documents, but a Kiro agent does not read them as standing instructions. Steering makes them part of every relevant session.",
            benefit="Generated code follows the repository's own standards without repeating them in each prompt.",
            prerequisites=["Review the generated file so it states the conventions your team actually follows."],
            risks=["Stale steering misleads the agent. Keep it in step with the configuration files it summarizes."],
            verification="Open a Kiro session and confirm the steering file is listed as context.",
        )
    if len(sources) == 1:
        return _build(
            p, cat.STEERING, "CONSIDER", refs=sources, effort="LOW", strategy="GENERATE_FILE", artifact_kind="STEERING",
            summary="A single convention source exists. Steering could make it persistent context.",
            signal="One committed convention source and no steering.",
            reasoning="One source is a thin basis. Steering is cheap, but the benefit depends on how many conventions the team has beyond what is committed.",
            benefit="More consistent agent output for the one convention that is written down.",
            prerequisites=["Decide which conventions are worth stating."], verification="Confirm the steering file is listed as context.",
        )
    return _build(
        p, cat.STEERING, "INSUFFICIENT_EVIDENCE",
        summary="No committed convention sources were found.",
        signal="No lint, format, editor or contribution files in the committed tree.",
        reasoning="Without written conventions Sean cannot tell which standards the team follows, so it cannot propose steering content.",
        benefit="Not assessable.", verification="Not applicable.",
    )


def rule_specs(p: RepositoryProfile) -> Recommendation:
    existing = _kiro(p, KIRO_SPECS)
    areas = [a for a in p.summary.areas if a.source_files > 0]
    src = p.summary.source_files
    refs = p.find("AREA")[:6] + p.find("LANGUAGE")[:3]
    if existing:
        return _build(
            p, cat.SPECS, "NOT_RECOMMENDED", refs=[existing],
            summary="Specs are already in use.", signal=f"{existing.count} committed Kiro spec folder(s).",
            reasoning="The repository already uses specs for feature work.", benefit="None beyond current use.", verification="Not applicable.",
        )
    if src >= SPECS_ADOPT_MIN_SOURCE_FILES and len(areas) >= SPECS_ADOPT_MIN_AREAS:
        return _build(
            p, cat.SPECS, "ADOPT_NOW", refs=refs, effort="MEDIUM", strategy="GENERATE_FILE", artifact_kind="SPEC_SCAFFOLD",
            summary="Use specs for multi-area features.",
            signal=f"{src} source files across {len(areas)} areas and no specs.",
            reasoning="Features that cross several areas need agreed requirements and a task order. Specs record both and keep the work traceable.",
            benefit="Requirements, design and tasks stay linked, which reduces rework on cross-area changes.",
            prerequisites=["Pick one upcoming feature to write as the first spec."],
            risks=["Specs take time. For a one-file change, direct chat is faster."],
            verification="Open the generated spec folder in Kiro and run its first task.",
        )
    if src >= SPECS_CONSIDER_MIN_SOURCE_FILES and len(areas) >= SPECS_CONSIDER_MIN_AREAS:
        return _build(
            p, cat.SPECS, "CONSIDER", refs=refs, effort="MEDIUM", strategy="GENERATE_FILE", artifact_kind="SPEC_SCAFFOLD",
            summary="Specs may help for features that span areas.",
            signal=f"{src} source files across {len(areas)} areas and no specs.",
            reasoning="The repository is moderate in size. Specs pay off when a change touches several areas.",
            benefit="Clearer scope for larger changes.", prerequisites=["A feature large enough to need a plan."],
            verification="Open the generated spec folder in Kiro.",
        )
    if src < SPECS_MIN_FILES_FOR_ASSESSMENT:
        return _build(
            p, cat.SPECS, "INSUFFICIENT_EVIDENCE",
            summary="Too little code to assess.", signal=f"{src} source file(s) in the committed tree.",
            reasoning="The repository is too small to show whether structured feature planning would help.",
            benefit="Not assessable.", verification="Not applicable.",
        )
    return _build(
        p, cat.SPECS, "NOT_RECOMMENDED", refs=refs,
        summary="Specs would add process without a demonstrated need.",
        signal=f"{src} source file(s) in {len(areas)} area(s).",
        reasoning="A small, single-area codebase is well served by direct chat. A spec per change would cost more than it returns.",
        benefit="Low at this size.", verification="Not applicable.",
    )


def rule_bugfix_specs(p: RepositoryProfile) -> Recommendation:
    h = p.summary.history
    stats = {o.value: o for o in p.find("COMMIT_STATS")}
    fix_obs = stats.get("fix commits")
    scanned_obs = stats.get("commits scanned")
    if h.commits_scanned < 10 or fix_obs is None or scanned_obs is None:
        return _build(
            p, cat.BUGFIX_SPECS, "INSUFFICIENT_EVIDENCE", refs=[o for o in (scanned_obs,) if o], uses_history=True,
            summary="Too little history to assess recurring defects.",
            signal=f"{h.commits_scanned} commit(s) were readable.",
            reasoning="Fewer than 10 commits cannot show whether defects recur.", benefit="Not assessable.", verification="Not applicable.",
        )
    share = h.fix_commits / h.commits_scanned
    recurrence = p.find("FIX_RECURRENCE")
    refs = [fix_obs, scanned_obs, *recurrence[:3]]
    if h.fix_commits >= BUGFIX_ADOPT_MIN_FIXES and share >= BUGFIX_ADOPT_MIN_SHARE and recurrence:
        return _build(
            p, cat.BUGFIX_SPECS, "ADOPT_NOW", refs=refs, effort="LOW", uses_history=True, strategy="GENERATE_FILE",
            artifact_kind="BUGFIX_SPEC_SCAFFOLD",
            summary="Use bugfix specs for the recurring defect areas.",
            signal=f"{h.fix_commits} of {h.commits_scanned} commits are fix-labelled, and {len(recurrence)} file(s) recur in fixes.",
            reasoning="Repeated fixes in the same files point to defect classes that were patched without a recorded root cause. A bugfix spec states the defect, the expected behavior, and what must not change. This is an inference from commit labels, not proof of cause.",
            benefit="Root-cause analysis and regression prevention for the files that keep needing fixes.",
            prerequisites=["Choose the most recent recurring defect as the first case."],
            risks=["Commit subjects label changes. They do not prove that each one fixed a defect."],
            verification="Run the bugfix spec's first task and confirm a regression test is added.",
        )
    if h.fix_commits >= BUGFIX_CONSIDER_MIN_FIXES:
        return _build(
            p, cat.BUGFIX_SPECS, "CONSIDER", refs=refs[:2], effort="LOW", uses_history=True, strategy="GENERATE_FILE",
            artifact_kind="BUGFIX_SPEC_SCAFFOLD",
            summary="Bugfix specs may help if the same defects return.",
            signal=f"{h.fix_commits} of {h.commits_scanned} commits are fix-labelled.",
            reasoning="Fixes exist, but no file recurs enough to show a defect class.",
            benefit="Structured root-cause analysis on the next significant defect.", verification="Use it on the next defect.",
        )
    return _build(
        p, cat.BUGFIX_SPECS, "NOT_RECOMMENDED", refs=refs[:2], uses_history=True,
        summary="Few fix-labelled commits.", signal=f"{h.fix_commits} of {h.commits_scanned} commits are fix-labelled.",
        reasoning="The history shows too few fixes to justify a dedicated defect workflow.", benefit="Low.", verification="Not applicable.",
    )


def _verification_tools(p: RepositoryProfile) -> list[Observation]:
    return [o for o in p.find("TOOLING") if o.role in {"TEST_TOOL", "LINT_TOOL"} or (o.role == "SCRIPT" and o.value in {"npm script: test", "npm script: lint"})]


def rule_hooks(p: RepositoryProfile) -> Recommendation:
    existing = _kiro(p, KIRO_HOOKS)
    tools = _verification_tools(p)
    if existing:
        return _build(
            p, cat.HOOKS, "NOT_RECOMMENDED", refs=[existing],
            summary="Hooks are already configured.", signal=f"{existing.count} committed hook file(s).",
            reasoning="Hooks exist. Sean cannot judge whether more would help.", benefit="None shown.", verification="Not applicable.",
        )
    if tools:
        return _build(
            p, cat.HOOKS, "CONSIDER", refs=tools[:4], effort="LOW", strategy="GENERATE_FILE", artifact_kind="HOOK",
            summary="Run the repository's own checks automatically after agent changes.",
            signal=f"{len(tools)} declared test or lint tool(s).",
            reasoning="The repository declares verification tooling. A hook can run it after the agent changes files, so errors surface at once. Hooks are never adopted automatically because a poorly scoped hook is slow or noisy.",
            benefit="Faster feedback on agent-made changes.",
            prerequisites=["Confirm the check is quick enough to run on every save."],
            risks=["A slow hook interrupts every edit.", "Hook commands run on your machine. Review the command first."],
            verification="Save a file through the agent and confirm the hook runs and reports.",
        )
    return _build(
        p, cat.HOOKS, "NOT_RECOMMENDED",
        summary="No declared check to automate.", signal="No test or lint tool or script was found in the parsed manifests.",
        reasoning="A hook needs a command worth running. None was observed, and Sean will not invent one.",
        benefit="None until verification tooling exists.", verification="Not applicable.",
    )


def rule_mcp(p: RepositoryProfile) -> Recommendation:
    existing = _kiro(p, KIRO_MCP)
    integrations = p.find("INTEGRATION")
    if existing:
        return _build(
            p, cat.MCP, "NOT_RECOMMENDED", refs=[existing],
            summary="MCP is already configured.", signal="A committed project MCP configuration exists.",
            reasoning="Sean cannot judge whether more servers would help.", benefit="None shown.", verification="Not applicable.",
        )
    if integrations:
        return _build(
            p, cat.MCP, "CONSIDER", refs=integrations[:5], effort="MEDIUM", strategy="INSTRUCTIONS_ONLY",
            summary="Connect the external systems the code already depends on.",
            signal=f"{len(integrations)} integration signal(s), such as client libraries or API description files.",
            reasoning="The code talks to external systems. An MCP server for one of them could let the agent read from it directly. Sean does not choose a server or invent an endpoint.",
            benefit="Less manual copying of information between those systems and the agent.",
            prerequisites=["An MCP server for the specific system.", "Credentials supplied through environment variables, never committed."],
            needs_external_setup=True,
            risks=["Each server widens what the agent can reach.", "Servers need review before use."],
            verification="List the server's tools in Kiro and run one read-only call.",
        )
    return _build(
        p, cat.MCP, "NOT_RECOMMENDED",
        summary="MCP would add complexity without a demonstrated need.", signal="No integration signals were found.",
        reasoning="No external client libraries, API descriptions or service files were observed.",
        benefit="None shown.", verification="Not applicable.",
    )


def rule_custom_agents(p: RepositoryProfile) -> Recommendation:
    existing = _kiro(p, KIRO_AGENTS)
    areas = _qualifying_areas(p)
    if existing:
        return _build(
            p, cat.CUSTOM_AGENTS, "NOT_RECOMMENDED", refs=[existing],
            summary="Custom agents already exist.", signal=f"{existing.count} committed agent file(s).",
            reasoning="Sean cannot judge whether more would help.", benefit="None shown.", verification="Not applicable.",
        )
    if len(areas) >= 2:
        names = [a.name for a in areas]
        return _build(
            p, cat.CUSTOM_AGENTS, "CONSIDER", refs=_area_observations(p, names)[:4], effort="MEDIUM",
            strategy="GENERATE_FILE", artifact_kind="AGENT",
            summary="Give each major area an agent with a focused role.",
            signal=f"{len(areas)} areas each hold at least {int(AREA_MIN_SHARE * 100)}% of the source files: {', '.join(names[:4])}.",
            reasoning="Distinct areas call for different expertise and tool access. A focused agent can carry that, with less context and tighter permissions.",
            benefit="More consistent work inside each area.", prerequisites=["Decide each agent's tools and its allowed paths."],
            risks=["Too many agents are harder to maintain than one good one."],
            verification="Start a session with the agent and check that its tools and context match its role.",
        )
    return _build(
        p, cat.CUSTOM_AGENTS, "NOT_RECOMMENDED", refs=p.find("AREA")[:3],
        summary="One dominant area. Additional agents would add overhead.",
        signal=f"{len(areas)} area(s) are large enough to justify a dedicated agent.",
        reasoning="Specialization pays off when areas differ. This repository does not show that.", benefit="Low.", verification="Not applicable.",
    )


def rule_sub_agents(p: RepositoryProfile) -> Recommendation:
    areas = _qualifying_areas(p)
    if len(areas) >= 2 and p.summary.test_files > 0:
        names = [a.name for a in areas]
        return _build(
            p, cat.SUB_AGENTS, "CONSIDER", refs=_area_observations(p, names)[:3] + p.find("TEST_LAYOUT")[:1], effort="MEDIUM",
            strategy="INSTRUCTIONS_ONLY",
            summary="Delegate independent work in separate areas to sub-agents.",
            signal=f"{len(areas)} sizable areas and {p.summary.test_files} test file(s) to verify each independently.",
            reasoning="Work in separate areas can run in parallel when it touches different files and each part has its own tests.",
            benefit="Shorter wall-clock time on changes that split cleanly.",
            prerequisites=["Define which files each task may touch, to avoid conflicts."],
            risks=["Coordination costs time. Parallel edits to shared files cause conflicts."],
            verification="Run two independent tasks in parallel and confirm no shared-file conflict.",
        )
    return _build(
        p, cat.SUB_AGENTS, "NOT_RECOMMENDED",
        summary="Little independent work to delegate.", signal=f"{len(areas)} sizable area(s) and {p.summary.test_files} test file(s).",
        reasoning="Delegation needs separable areas and tests to check each part.", benefit="Low.", verification="Not applicable.",
    )


def rule_skills(p: RepositoryProfile) -> Recommendation:
    existing = _kiro(p, KIRO_SKILLS)
    scripts = p.find("SCRIPT_SET")
    docs = [o for o in p.find("DOCUMENTATION") if o.value == "docs folder"]
    if existing:
        return _build(
            p, cat.SKILLS, "NOT_RECOMMENDED", refs=[existing],
            summary="Skills already exist.", signal=f"{existing.count} committed skill(s).",
            reasoning="Sean cannot judge whether more would help.", benefit="None shown.", verification="Not applicable.",
        )
    if scripts and (scripts[0].count or 0) >= SKILLS_MIN_SCRIPTS:
        return _build(
            p, cat.SKILLS, "CONSIDER", refs=scripts, effort="LOW", strategy="GENERATE_FILE", artifact_kind="SKILL",
            summary="Package the repository's repeatable procedures as a skill.",
            signal=f"{scripts[0].count} committed scripts directly under scripts/.",
            reasoning="A scripts folder usually holds procedures people repeat. A skill tells the agent when and how to use them.",
            benefit="Repeatable tasks run the same way each time.",
            prerequisites=["Pick the one or two procedures people actually repeat."],
            risks=["A skill that references a script that changes becomes wrong."],
            verification="Ask the agent to perform the procedure and confirm it follows the skill.",
        )
    if docs and (docs[0].count or 0) >= SKILLS_MIN_DOCS:
        return _build(
            p, cat.SKILLS, "CONSIDER", refs=docs, effort="LOW", strategy="GENERATE_FILE", artifact_kind="SKILL",
            summary="Turn established how-to documentation into a skill.",
            signal=f"{docs[0].count} committed documents under docs/. Whether any describe repeatable procedures was not checked.",
            reasoning="A documentation set can hold procedures worth packaging. The count alone does not show that they are, so this is a weaker signal.",
            benefit="The agent follows documented procedures.", prerequisites=["Identify which documents describe procedures."],
            verification="Ask the agent to run a documented procedure.",
            extra_limitations=["Document contents were not read."],
        )
    return _build(
        p, cat.SKILLS, "NOT_RECOMMENDED",
        summary="No repeatable procedures observed.", signal="Fewer than 3 scripts and fewer than 5 documents.",
        reasoning="Skills package procedures. None were observed.", benefit="Low.", verification="Not applicable.",
    )


def rule_kiroignore(p: RepositoryProfile) -> Recommendation:
    existing = _kiro(p, KIRO_IGNORE)
    sensitive = p.find("SENSITIVE_PATH")
    generated = p.find("GENERATED_TRACKED")
    if existing:
        flagged = f" {len(sensitive)} sensitive-looking path(s) are also committed. Check that the existing patterns cover them." if sensitive else ""
        return _build(
            p, cat.KIROIGNORE, "NOT_RECOMMENDED", refs=[existing, *sensitive[:4]],
            summary=".kiroignore already exists." + flagged, signal="A committed .kiroignore is present." + flagged,
            reasoning="Sean did not evaluate the existing patterns against the committed paths." + flagged,
            benefit="None shown.", verification="Ask the agent to read one of the sensitive-looking files and confirm it is blocked." if sensitive else "Not applicable.",
            extra_limitations=["The existing patterns were not reviewed."],
        )
    if sensitive:
        return _build(
            p, cat.KIROIGNORE, "ADOPT_NOW", refs=sensitive[:5], effort="LOW", strategy="GENERATE_FILE", artifact_kind="KIROIGNORE",
            summary="Keep secret-bearing files out of agent context.",
            signal=f"{len(sensitive)} committed path(s) with names that usually hold secrets, and no .kiroignore.",
            reasoning="Files such as environment files and private keys should not enter an agent's context. Only the path names were read, never the contents.",
            benefit="Lower risk of secrets entering an agent session.",
            prerequisites=["Check whether the flagged files are real secrets. If they are, rotate them and remove them from history."],
            risks=[".kiroignore limits agent context. It is not a security boundary. Enforce with permission deny rules too."],
            verification="Ask the agent to read a listed file and confirm it is blocked.",
        )
    if generated:
        return _build(
            p, cat.KIROIGNORE, "CONSIDER", refs=generated[:4], effort="LOW", strategy="GENERATE_FILE", artifact_kind="KIROIGNORE",
            summary="Exclude generated and installed files from agent context.",
            signal=f"{len(generated)} generated or dependency director(ies) are committed.",
            reasoning="Large generated trees waste context and bury relevant code.",
            benefit="Cleaner, cheaper agent context.", verification="Confirm that the excluded directories are no longer read.",
        )
    return _build(
        p, cat.KIROIGNORE, "NOT_RECOMMENDED",
        summary="No sensitive-looking or generated paths are committed.", signal="None observed.",
        reasoning="Nothing in the committed tree needs excluding.", benefit="None shown.", verification="Not applicable.",
    )


def rule_permissions(p: RepositoryProfile) -> Recommendation:
    sensitive = p.find("SENSITIVE_PATH")
    if sensitive:
        return _build(
            p, cat.PERMISSIONS, "CONSIDER", refs=sensitive[:5], effort="LOW", strategy="INSTRUCTIONS_ONLY",
            summary="Add user-level deny rules for the sensitive-looking files.",
            signal=f"{len(sensitive)} committed path(s) with names that usually hold secrets.",
            reasoning="Permissions are the enforced control. They live in your own Kiro settings and cannot be committed to the repository, so Sean gives instructions and writes no file.",
            benefit="Agent file reads of those paths are denied, not just hidden.",
            prerequisites=["Edit your own Kiro permissions file."], risks=["A rule that is too broad blocks legitimate reads."],
            verification="Ask the agent to read a listed file and confirm the read is denied.",
        )
    return _build(
        p, cat.PERMISSIONS, "NOT_RECOMMENDED",
        summary="No sensitive-looking paths were found.", signal="None observed.",
        reasoning="No repository signal calls for extra permission rules.", benefit="None shown.", verification="Not applicable.",
    )


def _runtime(capability: str, why: str) -> Callable[[RepositoryProfile], Recommendation]:
    def rule(p: RepositoryProfile) -> Recommendation:
        return _build(
            p, capability, "INSUFFICIENT_EVIDENCE",
            summary=f"{cat.CATALOG[capability].title} depends on your tools, not on repository content.",
            signal="No repository signal applies.", reasoning=why, benefit="Not assessable from the repository.",
            verification="Not applicable.",
        )
    return rule


RULES: tuple[Callable[[RepositoryProfile], Recommendation], ...] = (
    rule_steering,
    rule_specs,
    rule_bugfix_specs,
    rule_hooks,
    rule_mcp,
    rule_custom_agents,
    rule_skills,
    rule_sub_agents,
    rule_kiroignore,
    rule_permissions,
    _runtime(cat.POWERS, "Powers are installed per user and chosen by the tools you use. The repository does not decide that."),
    _runtime(cat.ACP, "ACP is an integration protocol used by editor clients. The repository does not decide which client you use."),
    _runtime(cat.CHECKPOINTS, "Checkpoints and rewind are session features. They depend on how you work, not on repository content."),
    _runtime(cat.COMPACTION, "Compaction is automatic and depends on session length, which the repository does not show."),
    _runtime(cat.CHAT_IDE_CLI, "Whether direct chat is enough depends on task size, which the repository does not show."),
)
