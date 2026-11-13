"""Kiro capability catalog (Spec 4 section 6.1).

Verified against kiro.dev documentation on 2026-11-12 (steering, specs, bugfix specs, hooks, MCP configuration, custom
agents, skills, powers, sub-agents, permissions, kiroignore, ACP, checkpoints, compaction). The catalog is the only place
that states where a capability lives and whether it can be a repository file. A capability whose scope is not REPOSITORY
can never produce a repository artifact.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Scope = Literal["REPOSITORY", "USER", "RUNTIME"]

CATALOG_VERIFIED_ON = "2026-11-12"

STEERING = "STEERING"
SPECS = "SPECS"
BUGFIX_SPECS = "BUGFIX_SPECS"
HOOKS = "HOOKS"
MCP = "MCP"
CUSTOM_AGENTS = "CUSTOM_AGENTS"
SKILLS = "SKILLS"
SUB_AGENTS = "SUB_AGENTS"
KIROIGNORE = "KIROIGNORE"
PERMISSIONS = "PERMISSIONS"
POWERS = "POWERS"
ACP = "ACP"
CHECKPOINTS = "CHECKPOINTS"
COMPACTION = "COMPACTION"
CHAT_IDE_CLI = "CHAT_IDE_CLI"


@dataclass(frozen=True)
class CapabilityEntry:
    capability: str
    title: str
    scope: Scope
    project_paths: tuple[str, ...]
    surfaces: str
    docs_url: str


CATALOG: dict[str, CapabilityEntry] = {
    entry.capability: entry
    for entry in (
        CapabilityEntry(STEERING, "Steering", "REPOSITORY", (".kiro/steering/*.md", "AGENTS.md"), "IDE, CLI, Web", "https://kiro.dev/docs/steering.md"),
        CapabilityEntry(SPECS, "Specs", "REPOSITORY", (".kiro/specs/<name>/requirements.md", ".kiro/specs/<name>/design.md", ".kiro/specs/<name>/tasks.md"), "IDE, CLI, Web", "https://kiro.dev/docs/specs.md"),
        CapabilityEntry(BUGFIX_SPECS, "Bugfix specs", "REPOSITORY", (".kiro/specs/<name>/bugfix.md", ".kiro/specs/<name>/design.md", ".kiro/specs/<name>/tasks.md"), "IDE, CLI, Web", "https://kiro.dev/docs/specs/bugfix-specs.md"),
        CapabilityEntry(HOOKS, "Hooks", "REPOSITORY", (".kiro/hooks/*.json",), "IDE, CLI", "https://kiro.dev/docs/hooks.md"),
        CapabilityEntry(MCP, "MCP servers", "REPOSITORY", (".kiro/settings/mcp.json",), "IDE, CLI", "https://kiro.dev/docs/mcp/configuration.md"),
        CapabilityEntry(CUSTOM_AGENTS, "Custom agents", "REPOSITORY", (".kiro/agents/<name>.md", ".kiro/agents/<name>.json"), "IDE, CLI", "https://kiro.dev/docs/custom-agents.md"),
        CapabilityEntry(SKILLS, "Skills", "REPOSITORY", (".kiro/skills/<name>/SKILL.md",), "IDE, CLI, Web", "https://kiro.dev/docs/skills.md"),
        CapabilityEntry(SUB_AGENTS, "Sub-agents", "REPOSITORY", (".kiro/agents/<name>.md",), "IDE, CLI", "https://kiro.dev/docs/custom-agents/subagents.md"),
        CapabilityEntry(KIROIGNORE, "Kiroignore", "REPOSITORY", (".kiroignore",), "IDE (setting required), CLI V3", "https://kiro.dev/docs/kiroignore.md"),
        CapabilityEntry(PERMISSIONS, "Permissions", "USER", ("~/.kiro/settings/permissions.yaml (user level, not committable)",), "IDE, CLI", "https://kiro.dev/docs/permissions.md"),
        CapabilityEntry(POWERS, "Powers", "USER", ("~/.kiro/powers/ (user level)",), "IDE, CLI V3", "https://kiro.dev/docs/powers.md"),
        CapabilityEntry(ACP, "ACP integrations", "RUNTIME", (), "Client dependent", "https://kiro.dev/docs/acp.md"),
        CapabilityEntry(CHECKPOINTS, "Checkpoints and rewind", "RUNTIME", (), "IDE checkpoints, CLI rewind", "https://kiro.dev/docs/checkpoints.md"),
        CapabilityEntry(COMPACTION, "Context compaction", "RUNTIME", (), "Automatic; manual in CLI", "https://kiro.dev/docs/compaction.md"),
        CapabilityEntry(CHAT_IDE_CLI, "Chat, IDE and CLI", "RUNTIME", (), "IDE, CLI", "https://kiro.dev/docs"),
    )
}
