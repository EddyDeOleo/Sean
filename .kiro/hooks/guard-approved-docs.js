/*
 * Sean hook script: guard-approved-docs
 * Registered by .kiro/hooks/guard-approved-docs.json (read that file first).
 *
 * Event:      PreToolUse (IDE and CLI V3).
 * Trigger:    The matcher in the JSON file limits this to file-changing tools:
 *             fs_write, fs_append, str_replace, delete_file, smart_relocate, semantic_rename.
 * Action:     Command. Kiro runs `node .kiro/hooks/guard-approved-docs.js` in the project root
 *             and sends the event as JSON on stdin ({ tool_name, tool_input, ... }).
 * Affects:    Reads stdin only. It writes nothing, runs nothing else, and uses no network.
 *             It looks only at tool_input values whose key name contains "path" or "file", so
 *             document text that merely mentions a protected path does not trigger it.
 * Protected:  docs/specs/**, docs/architecture/**, and the approved Playbook and Operating Guide
 *             (docs/development/kiro-engineering-playbook.md, kiro-operating-guide.md).
 * Result:     If a target is protected: exit 0 and print a PreToolUse "ask" decision, so Kiro
 *             prompts the user before the edit. Otherwise: exit 0 with no output.
 * Failure:    Fails open with a one-line notice on stdout (added to the agent's context):
 *             unreadable or unexpected input never blocks editing. If Node.js is missing, the
 *             command itself fails. Kiro's docs say a non-zero exit blocks the tool call, so
 *             disable the hook ("enabled": false) if you need to edit without Node.
 * Approval:   Required for every protected edit (this is the point). It cannot see edits made
 *             through shell commands, so it is a safeguard, not a security boundary.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PROTECTED = [
  /(^|\/)docs\/specs\//,
  /(^|\/)docs\/architecture\//,
  /(^|\/)docs\/development\/kiro-(engineering-playbook|operating-guide)\.md$/,
];
const PATH_KEY = /path|file/i;
const MAX_VALUE_LENGTH = 1024;
const MAX_DEPTH = 4;

function notice(message) {
  process.stdout.write('Sean guard-approved-docs skipped: ' + message + '\n');
}

function normalize(value) {
  return path.posix.normalize(String(value).replace(/\\/g, '/')).toLowerCase();
}

function collectPaths(value, key, out, depth) {
  if (depth > MAX_DEPTH) return;
  if (typeof value === 'string') {
    if (PATH_KEY.test(key) && value.length <= MAX_VALUE_LENGTH) out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, key, out, depth + 1);
  } else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) collectPaths(child, childKey, out, depth + 1);
  }
}

function main() {
  let event;
  try {
    event = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch (error) {
    notice('could not read the hook input as JSON.');
    return;
  }

  const input = event && event.tool_input;
  if (!input || typeof input !== 'object') {
    notice('the event has no tool_input object.');
    return;
  }

  const candidates = [];
  collectPaths(input, '', candidates, 0);

  const hits = [];
  for (const original of candidates) {
    if (PROTECTED.some((pattern) => pattern.test(normalize(original))) && !hits.includes(original)) {
      hits.push(original);
    }
  }
  if (hits.length === 0) return;

  const reason =
    'Approved Sean document targeted: ' + hits.join(', ') + '. ' +
    'Editing approved specifications, the architecture, the playbook, or the operating guide ' +
    'needs explicit owner approval. Approve only if the owner authorized this change.';
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { permissionDecision: 'ask', permissionDecisionReason: reason } })
  );
}

main();
