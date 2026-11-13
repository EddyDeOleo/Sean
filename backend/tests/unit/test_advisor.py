"""Kiro Repository Advisor tests (Spec 4 section 6; Requirement 2)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from advisor_helpers import history, obs, synthetic_profile
from app.modules.advisor import catalog
from app.modules.advisor import rules as r
from app.modules.advisor.contract import AdvisorResult, ContractViolation, Recommendation, check_against_profile
from app.modules.advisor.roadmap import advise
from app.modules.repository_profile import scanner
from app.modules.repository_profile.scanner import scan_repository


def _statuses(result: AdvisorResult) -> dict[str, str]:
    return {item.capability: item.recommendation_status for item in result.recommendations}


def _one(result: AdvisorResult, capability: str) -> Recommendation:
    return next(item for item in result.recommendations if item.capability == capability)


# ---------------------------------------------------------------- contract


def _valid(**changes) -> dict:
    base = dict(
        capability="STEERING", title="Steering", summary="s", repository_signal="sig", evidence_references=["obs-1"],
        evidence_classification="DOCUMENTED", reasoning="why", expected_benefit="b", priority="P1",
        recommendation_status="ADOPT_NOW", implementation_effort="LOW", adoption_scope="REPOSITORY",
        configuration_strategy="GENERATE_FILE", artifact_kind="STEERING", verification_method="v", confidence="HIGH",
    )
    base.update(changes)
    return base


def test_contract_accepts_a_valid_recommendation():
    assert Recommendation(**_valid()).capability == "STEERING"


@pytest.mark.parametrize(
    "changes",
    [
        {"evidence_references": []},  # actionable without evidence
        {"recommendation_status": "CONSIDER", "evidence_references": []},
        {"recommendation_status": "INSUFFICIENT_EVIDENCE", "evidence_classification": "DOCUMENTED", "configuration_strategy": "NONE", "artifact_kind": None},
        {"adoption_scope": "USER"},  # a user-level capability cannot generate a repository file
        {"adoption_scope": "RUNTIME"},
        {"configuration_strategy": "NONE"},  # artifact kind without GENERATE_FILE
        {"recommendation_status": "NOT_RECOMMENDED"},  # generates a file while not recommended
        {"unknown_field": 1},
    ],
)
def test_contract_rejects_invalid_recommendations(changes):
    with pytest.raises(ValidationError):
        Recommendation(**_valid(**changes))


def test_check_against_profile_rejects_unknown_reference():
    profile = synthetic_profile(areas={"a": (50, 5)})
    result = advise(profile)
    broken = result.model_copy(update={"recommendations": [result.recommendations[0].model_copy(update={"evidence_references": ["obs-missing"]})]})
    with pytest.raises(ContractViolation):
        check_against_profile(broken, profile)


def test_check_against_profile_rejects_documented_claim_over_inferred_evidence():
    inferred = obs("FIX_RECURRENCE", path="src/a.py", value="recurring fixes", count=4, classification="INFERRED", source="GIT_LOG")
    profile = synthetic_profile(observations=[inferred], areas={"a": (5, 1)})
    result = advise(profile)
    forged = _one(result, "STEERING").model_copy(
        update={"evidence_references": [inferred.observation_id], "evidence_classification": "DOCUMENTED"}
    )
    with pytest.raises(ContractViolation):
        check_against_profile(result.model_copy(update={"recommendations": [forged]}), profile)


def test_check_against_profile_rejects_a_result_from_another_profile():
    profile = synthetic_profile()
    other = synthetic_profile().model_copy(update={"head": "b" * 40})
    with pytest.raises(ContractViolation):
        check_against_profile(advise(profile), other)


# ---------------------------------------------------------------- catalog


def test_catalog_scopes_match_documented_installation_scope():
    assert catalog.CATALOG[catalog.PERMISSIONS].scope == "USER"
    assert catalog.CATALOG[catalog.POWERS].scope == "USER"
    for runtime in (catalog.ACP, catalog.CHECKPOINTS, catalog.COMPACTION, catalog.CHAT_IDE_CLI):
        assert catalog.CATALOG[runtime].scope == "RUNTIME" and catalog.CATALOG[runtime].project_paths == ()
    for repository in (catalog.STEERING, catalog.SPECS, catalog.HOOKS, catalog.MCP, catalog.SKILLS, catalog.KIROIGNORE):
        assert catalog.CATALOG[repository].scope == "REPOSITORY"
    assert all(entry.docs_url.startswith("https://kiro.dev") for entry in catalog.CATALOG.values())


def test_every_catalog_capability_is_assessed_exactly_once():
    result = advise(synthetic_profile())
    assessed = [item.capability for item in result.recommendations]
    assert sorted(assessed) == sorted(catalog.CATALOG)
    assert len(set(assessed)) == len(assessed)


# ---------------------------------------------------------------- thresholds


def _specs(source_files: int, areas: int, **kw):
    base, extra = divmod(source_files, areas)
    layout = {f"area{i}": (base + (1 if i < extra else 0), 0) for i in range(areas)}
    assert sum(s for s, _ in layout.values()) == source_files
    return r.rule_specs(synthetic_profile(areas=layout, **kw))


def test_specs_boundaries():
    assert _specs(40, 3).recommendation_status == "ADOPT_NOW"
    assert _specs(39, 3).recommendation_status == "CONSIDER"
    assert _specs(60, 2).recommendation_status == "CONSIDER"
    assert _specs(15, 2).recommendation_status == "CONSIDER"
    assert _specs(14, 2).recommendation_status == "NOT_RECOMMENDED"
    assert _specs(4, 1).recommendation_status == "INSUFFICIENT_EVIDENCE"


def test_specs_not_recommended_when_specs_exist():
    existing = obs("KIRO_CONFIG", path=".kiro/specs/x", value="SPECS", count=1)
    rec = r.rule_specs(synthetic_profile(areas={"a": (50, 0), "b": (50, 0), "c": (50, 0)}, observations=[existing]))
    assert rec.recommendation_status == "NOT_RECOMMENDED"


def _bugfix(scanned: int, fixes: int, recurring: bool = True, **kw):
    extra = [obs("FIX_RECURRENCE", path="src/a.py", value="recurring fixes", count=4, classification="INFERRED", source="GIT_LOG")] if recurring else []
    return r.rule_bugfix_specs(synthetic_profile(observations=extra, hist=history(scanned, fixes), **kw))


def test_bugfix_specs_boundaries():
    assert _bugfix(40, 10).recommendation_status == "ADOPT_NOW"  # 25%
    assert _bugfix(41, 10).recommendation_status == "CONSIDER"  # just under 25%
    assert _bugfix(40, 10, recurring=False).recommendation_status == "CONSIDER"  # no recurring file
    assert _bugfix(100, 3).recommendation_status == "CONSIDER"
    assert _bugfix(100, 2).recommendation_status == "NOT_RECOMMENDED"
    assert _bugfix(9, 5).recommendation_status == "INSUFFICIENT_EVIDENCE"


def test_bugfix_adopt_now_is_an_inference_with_medium_confidence():
    rec = _bugfix(40, 10)
    assert rec.evidence_classification == "INFERRED"
    assert rec.confidence == "MEDIUM"
    assert any("not prove" in text or "do not prove" in text for text in rec.risks)


def test_steering_boundaries():
    one = [obs("CONVENTION", path=".editorconfig", value=".editorconfig")]
    two = one + [obs("CONVENTION", path="CONTRIBUTING.md", value="contribution guide")]
    assert r.rule_steering(synthetic_profile(observations=[])).recommendation_status == "INSUFFICIENT_EVIDENCE"
    assert r.rule_steering(synthetic_profile(observations=one)).recommendation_status == "CONSIDER"
    assert r.rule_steering(synthetic_profile(observations=two)).recommendation_status == "ADOPT_NOW"
    with_steering = two + [obs("KIRO_CONFIG", path=".kiro/steering/a.md", value="STEERING", count=1)]
    assert r.rule_steering(synthetic_profile(observations=with_steering)).recommendation_status == "NOT_RECOMMENDED"


def test_custom_agents_and_sub_agents_need_two_sizable_areas():
    single = synthetic_profile(areas={"backend": (60, 10)})
    assert r.rule_custom_agents(single).recommendation_status == "NOT_RECOMMENDED"
    assert r.rule_sub_agents(single).recommendation_status == "NOT_RECOMMENDED"
    two = synthetic_profile(areas={"backend": (30, 5), "frontend": (30, 5)})
    assert r.rule_custom_agents(two).recommendation_status == "CONSIDER"
    assert r.rule_sub_agents(two).recommendation_status == "CONSIDER"
    untested = synthetic_profile(areas={"backend": (30, 0), "frontend": (30, 0)})
    assert r.rule_sub_agents(untested).recommendation_status == "NOT_RECOMMENDED"
    small_second = synthetic_profile(areas={"backend": (60, 5), "tools": (9, 0)})
    assert r.rule_custom_agents(small_second).recommendation_status == "NOT_RECOMMENDED"


def test_hooks_never_adopt_now_and_need_a_declared_check():
    nothing = synthetic_profile()
    assert r.rule_hooks(nothing).recommendation_status == "NOT_RECOMMENDED"
    tool = obs("TOOLING", path="package.json", value="Vitest", role="TEST_TOOL", source="GIT_BLOB")
    rec = r.rule_hooks(synthetic_profile(observations=[tool]))
    assert rec.recommendation_status == "CONSIDER" and rec.artifact_kind == "HOOK"
    build_only = obs("TOOLING", path="package.json", value="Vite", role="BUILD_TOOL", source="GIT_BLOB")
    assert r.rule_hooks(synthetic_profile(observations=[build_only])).recommendation_status == "NOT_RECOMMENDED"


def test_mcp_needs_an_integration_signal_and_is_never_a_generated_file():
    assert r.rule_mcp(synthetic_profile()).recommendation_status == "NOT_RECOMMENDED"
    integration = obs("INTEGRATION", path="requirements.txt", value="httpx (HTTP client)", source="GIT_BLOB")
    rec = r.rule_mcp(synthetic_profile(observations=[integration]))
    assert rec.recommendation_status == "CONSIDER"
    assert rec.configuration_strategy == "INSTRUCTIONS_ONLY" and rec.needs_external_setup is True


def test_skills_signals():
    assert r.rule_skills(synthetic_profile()).recommendation_status == "NOT_RECOMMENDED"
    scripts = obs("SCRIPT_SET", path="scripts", value="scripts folder", count=3)
    assert r.rule_skills(synthetic_profile(observations=[scripts])).recommendation_status == "CONSIDER"
    few = obs("SCRIPT_SET", path="scripts", value="scripts folder", count=2)
    assert r.rule_skills(synthetic_profile(observations=[few])).recommendation_status == "NOT_RECOMMENDED"
    docs = obs("DOCUMENTATION", path="docs", value="docs folder", count=5)
    weak = r.rule_skills(synthetic_profile(observations=[docs]))
    assert weak.recommendation_status == "CONSIDER" and any("not read" in text for text in weak.limitations)


def test_sensitive_paths_drive_kiroignore_and_user_level_permissions():
    sensitive = obs("SENSITIVE_PATH", path=".env", value="tracked")
    profile = synthetic_profile(observations=[sensitive])
    ignore = r.rule_kiroignore(profile)
    permissions = r.rule_permissions(profile)
    assert ignore.recommendation_status == "ADOPT_NOW" and ignore.configuration_strategy == "GENERATE_FILE"
    assert any("not a security boundary" in text for text in ignore.risks)
    assert permissions.recommendation_status == "CONSIDER"
    assert permissions.adoption_scope == "USER" and permissions.configuration_strategy == "INSTRUCTIONS_ONLY"
    existing = obs("KIRO_CONFIG", path=".kiroignore", value="KIROIGNORE", count=1)
    assert r.rule_kiroignore(synthetic_profile(observations=[sensitive, existing])).recommendation_status == "NOT_RECOMMENDED"


def test_runtime_capabilities_are_never_recommended():
    result = advise(synthetic_profile(areas={"a": (60, 6), "b": (60, 6), "c": (60, 6)}))
    for capability in (catalog.POWERS, catalog.ACP, catalog.CHECKPOINTS, catalog.COMPACTION, catalog.CHAT_IDE_CLI):
        item = _one(result, capability)
        assert item.recommendation_status == "INSUFFICIENT_EVIDENCE"
        assert item.confidence == "LOW" and item.configuration_strategy == "NONE"


# ---------------------------------------------------------------- confidence and classification


def test_truncated_scan_is_partial_evidence_with_low_confidence():
    two = [obs("CONVENTION", path=".editorconfig", value=".editorconfig"), obs("CONVENTION", path="CONTRIBUTING.md", value="contribution guide")]
    rec = r.rule_steering(synthetic_profile(observations=two, truncated=True))
    assert rec.recommendation_status == "ADOPT_NOW"
    assert rec.evidence_classification == "PARTIAL_EVIDENCE" and rec.confidence == "LOW"
    assert any("truncated" in text for text in rec.limitations)


def test_shallow_clone_lowers_history_based_confidence():
    rec = _bugfix(40, 10, shallow=True)
    assert rec.confidence == "LOW" and rec.evidence_classification == "PARTIAL_EVIDENCE"


def test_history_window_downgrades_history_confidence_to_medium():
    assert r.rule_bugfix_specs(
        synthetic_profile(hist=history(500, 200), history_limited=True, observations=[obs("FIX_RECURRENCE", path="a.py", value="recurring fixes", count=5, classification="INFERRED", source="GIT_LOG")])
    ).confidence == "MEDIUM"


def test_complete_scan_with_documented_evidence_has_high_confidence():
    existing = obs("KIRO_CONFIG", path=".kiro/steering/a.md", value="STEERING", count=1)
    rec = r.rule_steering(synthetic_profile(observations=[existing]))
    assert rec.confidence == "HIGH" and rec.evidence_classification == "DOCUMENTED"


# ---------------------------------------------------------------- roadmap


def test_roadmap_bands_and_external_setup():
    integration = obs("INTEGRATION", path="requirements.txt", value="httpx (HTTP client)", source="GIT_BLOB")
    tool = obs("TOOLING", path="package.json", value="Vitest", role="TEST_TOOL", source="GIT_BLOB")
    conv = [obs("CONVENTION", path=".editorconfig", value=".editorconfig"), obs("CONVENTION", path="CONTRIBUTING.md", value="contribution guide")]
    result = advise(synthetic_profile(areas={"backend": (30, 5), "frontend": (30, 5)}, observations=[integration, tool, *conv]))
    road = result.roadmap
    assert "STEERING" in road.immediate
    assert "MCP" in road.longer_term and "MCP" not in road.near_term
    assert {"HOOKS", "CUSTOM_AGENTS", "SUB_AGENTS"} <= set(road.near_term)
    bands = road.immediate + road.near_term + road.longer_term + road.not_recommended + road.insufficient_evidence
    assert sorted(bands) == sorted(catalog.CATALOG)


def test_advice_is_deterministic():
    profile = synthetic_profile(areas={"backend": (30, 5), "frontend": (30, 5)})
    assert advise(profile) == advise(profile)


# ---------------------------------------------------------------- real repositories of different shape


def _shape_small(repo):
    repo.write("main.py", "print('hi')\n")
    repo.write("README.md", "# small\n")
    repo.commit("init")


def _shape_large(repo):
    for area in ("api", "web", "worker"):
        for index in range(14):
            repo.write(f"{area}/m{index}.py", "x = 1\n")
        repo.write(f"{area}/tests/test_a.py", "def test_a(): pass\n")
    repo.write(".editorconfig", "root = true\n")
    repo.write("CONTRIBUTING.md", "# c\n")
    repo.write("requirements.txt", "fastapi\nhttpx\npytest\n")
    repo.commit("feat: initial layout")


def _shape_defects(repo):
    repo.write("src/core.py", "v = 0\n")
    repo.write("src/util.py", "v = 0\n")
    repo.commit("feat: start")
    for index in range(12):
        repo.write("src/core.py", f"v = {index + 1}\n")
        repo.commit(f"fix: patch core {index}")
    for index in range(2):
        repo.write("src/util.py", f"v = {index + 1}\n")
        repo.commit(f"feat: extend util {index}")


def _shape_secrets(repo):
    repo.write("src/app.py", "a = 1\n")
    repo.write(".env", "KEY=abc\n")
    repo.commit("init")


def _shape_configured(repo):
    _shape_large(repo)
    for path, text in (
        (".kiro/steering/a.md", "# a\n"), (".kiro/specs/f/requirements.md", "# r\n"), (".kiro/hooks/h.json", "{}"),
        (".kiro/settings/mcp.json", "{}"), (".kiroignore", ".env\n"), (".kiro/agents/a.md", "# a\n"), (".kiro/skills/s/SKILL.md", "# s\n"),
    ):
        repo.write(path, text)
    repo.commit("add kiro config")


def _advise(make_repo, shape):
    repo = make_repo()
    shape(repo)
    profile = scan_repository(repo.path, "fixture")
    return profile, advise(profile)


def test_recommendations_change_with_the_repository(make_repo):
    shapes = {
        "small": _shape_small, "large": _shape_large, "defects": _shape_defects,
        "secrets": _shape_secrets, "configured": _shape_configured,
    }
    results = {name: _advise(make_repo, shape) for name, shape in shapes.items()}
    status = {name: _statuses(result) for name, (_, result) in results.items()}

    assert status["small"]["SPECS"] == "INSUFFICIENT_EVIDENCE" or status["small"]["SPECS"] == "NOT_RECOMMENDED"
    assert status["small"]["STEERING"] == "INSUFFICIENT_EVIDENCE"
    assert status["small"]["CUSTOM_AGENTS"] == "NOT_RECOMMENDED"

    assert status["large"]["STEERING"] == "ADOPT_NOW"
    assert status["large"]["SPECS"] == "ADOPT_NOW"
    assert status["large"]["CUSTOM_AGENTS"] == "CONSIDER" and status["large"]["SUB_AGENTS"] == "CONSIDER"
    assert status["large"]["MCP"] == "CONSIDER"  # httpx

    assert status["defects"]["BUGFIX_SPECS"] == "ADOPT_NOW"
    assert status["large"]["BUGFIX_SPECS"] != "ADOPT_NOW"

    assert status["secrets"]["KIROIGNORE"] == "ADOPT_NOW" and status["secrets"]["PERMISSIONS"] == "CONSIDER"
    assert status["large"]["KIROIGNORE"] == "NOT_RECOMMENDED"

    for capability in ("STEERING", "SPECS", "HOOKS", "MCP", "KIROIGNORE", "CUSTOM_AGENTS", "SKILLS"):
        assert status["configured"][capability] == "NOT_RECOMMENDED", capability
    assert "ADOPT_NOW" not in status["configured"].values()

    vectors = {name: tuple(sorted(s.items())) for name, s in status.items()}
    assert len(set(vectors.values())) == len(vectors)


def test_real_repository_output_satisfies_the_contract(make_repo):
    for shape in (_shape_small, _shape_large, _shape_defects, _shape_secrets, _shape_configured):
        profile, result = _advise(make_repo, shape)
        known = profile.by_id()
        for item in result.recommendations:
            assert all(ref in known for ref in item.evidence_references)
            if item.recommendation_status in {"ADOPT_NOW", "CONSIDER"}:
                assert item.evidence_references
            if item.adoption_scope != "REPOSITORY":
                assert item.configuration_strategy != "GENERATE_FILE" and item.artifact_kind is None
        assert result.profile_head == profile.head


def test_short_list_not_a_feature_dump(make_repo):
    _, result = _advise(make_repo, _shape_small)
    actionable = [i for i in result.recommendations if i.recommendation_status in {"ADOPT_NOW", "CONSIDER"}]
    assert len(actionable) <= 2


def test_truncated_real_scan_is_never_documented_with_high_confidence(make_repo, monkeypatch):
    repo = make_repo()
    _shape_large(repo)
    monkeypatch.setattr(scanner, "MAX_TREE_ENTRIES", 20)
    profile = scan_repository(repo.path, "fixture")
    assert profile.truncated
    for item in advise(profile).recommendations:
        assert item.evidence_classification != "DOCUMENTED"
        assert item.confidence == "LOW"


# ---------------------------------------------------------------- incomplete scans (security review M3)


@pytest.mark.parametrize(
    "code",
    ["MANIFEST_NOT_READ", "UNREADABLE_PATHS_SKIPPED", "HISTORY_UNREADABLE", "OBSERVATIONS_CAPPED"],
)
def test_an_incomplete_scan_cannot_support_a_confident_negative(code):
    from app.modules.repository_profile.models import ProfileLimitation

    base = synthetic_profile()
    profile = base.model_copy(update={"limitations": [ProfileLimitation(code=code, message="could not read everything")]})
    hooks = r.rule_hooks(profile)
    assert hooks.recommendation_status == "NOT_RECOMMENDED"
    assert hooks.evidence_classification == "PARTIAL_EVIDENCE" and hooks.confidence == "LOW"
    assert any("not reliable" in text or "truncated" in text or "shallow" in text for text in hooks.limitations)
    for item in advise(profile).recommendations:
        assert item.evidence_classification != "DOCUMENTED"
    check_against_profile(advise(profile), profile)


def test_a_padded_manifest_cannot_hide_test_tooling_behind_a_confident_negative(make_repo):
    import json as _json

    repo = make_repo()
    repo.write("package.json", _json.dumps({"devDependencies": {"vitest": "1"}, "pad": "x" * (scanner.MANIFEST_BYTES + 5)}))
    repo.write("src/a.js", "a = 1\n")
    repo.commit("padded manifest")
    profile = scan_repository(repo.path, "fixture")
    hooks = _one(advise(profile), "HOOKS")
    assert hooks.recommendation_status == "NOT_RECOMMENDED"
    assert hooks.evidence_classification == "PARTIAL_EVIDENCE" and hooks.confidence == "LOW"


def test_existing_kiroignore_still_surfaces_sensitive_paths():
    sensitive = obs("SENSITIVE_PATH", path=".env", value="tracked")
    existing = obs("KIRO_CONFIG", path=".kiroignore", value="KIROIGNORE", count=1)
    rec = r.rule_kiroignore(synthetic_profile(observations=[sensitive, existing]))
    assert rec.recommendation_status == "NOT_RECOMMENDED"
    assert sensitive.observation_id in rec.evidence_references
    assert "sensitive-looking" in rec.summary and "not reviewed" in " ".join(rec.limitations)


# ---------------------------------------------------------------- contract enforcement of confidence (security review L6)


def test_contract_refuses_high_confidence_from_an_incomplete_scan():
    existing = obs("KIRO_CONFIG", path=".kiro/steering/a.md", value="STEERING", count=1)
    profile = synthetic_profile(observations=[existing], truncated=True)
    result = advise(synthetic_profile(observations=[existing]))
    forged = _one(result, "STEERING").model_copy(update={"confidence": "HIGH"})
    with pytest.raises(ContractViolation):
        check_against_profile(result.model_copy(update={"recommendations": [forged]}), profile)


def test_contract_refuses_high_confidence_on_short_history():
    fix = obs("FIX_RECURRENCE", path="src/a.py", value="recurring fixes", count=4, classification="INFERRED", source="GIT_LOG")
    profile = synthetic_profile(observations=[fix], hist=history(scanned=5, fixes=4))
    result = advise(profile)
    forged = _one(result, "BUGFIX_SPECS").model_copy(update={"confidence": "HIGH"})
    with pytest.raises(ContractViolation):
        check_against_profile(result.model_copy(update={"recommendations": [forged]}), profile)
