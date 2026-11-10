# Sean — D02 MCP Integration Decision Record

**Gate:** D02 (SEAN-SPEC-01 §24: "Verify MCP transport and STDIO compatibility with installed Kiro")
**Related gate:** Architecture §12.2 (MCP Configuration Gate). Production Kiro MCP configuration must not be created until the entry point exists, tool contracts are implemented, input validation and security behavior are tested, read-only behavior is confirmed, and Windows host compatibility is verified. A temporary D02 test configuration (Section 12.2) requires separate owner authorization and does not satisfy or waive this gate.
**Related decision:** D01 left the MCP major version open (see `d01-dependency-decision-record.md`, Section 4).
**Investigation date:** 2026-11-10
**Revision:** Runtime-evidence and contract revision (adds Sections 14 to 19 and Appendix B: probe retirement check, functional Kiro tool-call evidence, environment inventory, proposed production MCP contract, production configuration design, SDK pin recommendation and D01 amendment proposal). Earlier revision: final decision-record corrections (status separation, 2026-07-28 source review, T3, T7b, T10, Section 8.1 entry-point explanation). Earlier still: CRLF investigation, protocol-revision correction, dependency pin correction, JSON validation, source traceability.
**Status summary**

| Item | Status |
|---|---|
| Documentary investigation | `ACCEPTED` |
| SDK candidate (`mcp==2.3.0`) | `RECOMMENDED FOR EXACT PIN, OWNER APPROVAL PENDING` (Section 18) |
| Kiro functional tool call (one probe invocation) | `OBSERVED` (Section 14) |
| Kiro protocol, framing, and line-ending behavior | `NOT VERIFIED` (no raw capture) |
| Server shutdown and process cleanup (T10) | `NOT VERIFIED` |
| Kiro runtime compatibility (Kiro 1.4.121), as defined by Section 12 closure criteria | `NOT VERIFIED` (partial functional evidence only) |
| D02 overall | `IN PROGRESS` |
| Production MCP contract (Section 16) | `PROPOSED, NOT APPROVED` |
| Production MCP configuration | `NOT CREATED, PROHIBITED UNTIL ARCHITECTURE §12.2` |
| MCP implementation | `NOT STARTED` |

Acceptance of the documentary investigation does not authorize package installation, virtual-environment creation, configuration changes, MCP implementation, or D03. D02 is not passed or closed while the required Kiro runtime compatibility tests (Section 12) remain outstanding.

On Windows, the SDK's wire output uses CR-LF terminators. This is source-verified observed behavior. CR is permitted insignificant JSON whitespace (RFC 8259), so the open question is whether Kiro accepts this framing under the MCP framing rule, not whether the JSON is valid. Kiro's acceptance is unknown.

Sections 1 to 13 and Appendix A record the documentary investigation. They are based on read-only research of public documentation, release metadata, issue and pull-request records, and upstream source code. When that investigation was written, no package had been installed, no environment created, no configuration written, no server started, and no runtime test run. Those statements describe that revision only and are preserved as history.

Sections 14 to 19 and Appendix B record what happened afterward: a Python 3.14.10 virtual environment with `mcp==2.3.0`, one functional tool call through Kiro IDE 1.4.121 to a disposable probe, and the retirement of the probe's workspace registration. Where Sections 1 to 13 say a runtime item is `NOT_VERIFIED`, it stays `NOT_VERIFIED` unless Section 14.3 states otherwise. One successful tool call does not establish general compatibility.

---

## 1. Objective and scope

Determine the safest, simplest, and officially supported way to connect a Sean MCP server to Kiro IDE 1.4.121 over STDIO, and evaluate the MCP Python SDK v1.30.0 (maintenance line) and v2.3.0 (stable line).

In scope:
- Kiro MCP client configuration contract.
- STDIO transport requirements and the Windows newline behavior of the SDK.
- SDK v1.30.0 and v2.3.0 comparison, including protocol revisions.
- Windows 11 Home process-launch considerations.
- Entry point and process model that reuse Sean's backend modules.

Out of scope:
- Implementation, configuration writes, runtime tests, and D03 through D08.

---

## 2. Sources consulted

Source identifiers (S-…) are used in the rest of this record. Each source is labeled with whether it is versioned to the release it describes.

### 2.1 Kiro documentation (not versioned to Kiro IDE 1.4.121)

These pages are current Kiro documentation. The fetched content shows no publication date and no IDE version. Fetched 2026-11-10.

| ID | URL | Used for |
|---|---|---|
| S-K1 | https://kiro.dev/docs/mcp/configuration.md | Locations, schema, environment variables, precedence, reconnection |
| S-K2 | https://kiro.dev/docs/mcp.md | Overview, transports, logs |
| S-K3 | https://kiro.dev/docs/mcp/usage.md | Tool approval, `autoApprove`, reconnect |
| S-K4 | https://kiro.dev/docs/mcp/security.md | Stdio process model, MCP sandboxing, approved environment variables |
| S-K5 | https://kiro.dev/docs/mcp/examples/ (search snippet only; not fetched in full) | Windows example with bare command name and `.exe` argument |
| S-K6 | https://kiro.dev/docs/permissions.md | MCP capability rules, deny/ask/allow order, untrusted-workspace prompts |
| S-K7 | https://kiro.dev/docs/sandbox.md | Local command sandbox; states it is "available in Kiro IDE 1.3 and later"; Windows setup requirements; `mcpSandboxing` |

### 2.2 MCP specification and SDK documentation

| ID | URL | Versioned to | Used for |
|---|---|---|---|
| S-M1 | https://modelcontextprotocol.io/specification/2025-11-25/basic/transports | Specification 2025-11-25 | STDIO transport rules |
| S-M2 | https://modelcontextprotocol.io/specification/2026-07-28/basic/transports | Specification 2026-07-28 | Transport binding overview: messages, request metadata, custom transports, backward compatibility. Fetched 2026-11-10. |
| S-M3 | https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio | Specification 2026-07-28 | stdio framing (newline-delimited, no embedded newlines), `_meta` placement, shutdown by closing stdin, Windows termination options, `server/discover` probe. Fetched 2026-11-10. |
| S-M4 | https://modelcontextprotocol.io/specification/2026-07-28/basic/index | Specification 2026-07-28 | `_meta` key format; reserved key `io.modelcontextprotocol/protocolVersion`; required per-request fields `protocolVersion` and `clientCapabilities`. Fetched 2026-11-10. |
| S-M5 | https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning | Specification 2026-07-28 | No handshake; `UnsupportedProtocolVersionError`; era definitions; compatibility matrix. Fetched 2026-11-10. |
| S-M6 | https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle | Specification 2025-11-25 | Legacy `initialize` request with `params.protocolVersion`, followed by an `initialized` notification. Fetched 2026-11-10. |
| S-D1 | https://py.sdk.modelcontextprotocol.io/whats-new/ | SDK v2 documentation (site not tied to a tag; describes v2.x) | v1 to v2 changes; protocol revisions 2025-11-25 and 2026-07-28; `run()` |
| S-D2 | https://py.sdk.modelcontextprotocol.io/migration/ | SDK v2 documentation | Breaking changes, v1 maintenance policy, dependency floors |
| S-D3 | https://py.sdk.modelcontextprotocol.io/v1/ | SDK v1 documentation | v1 maintenance statement |

### 2.3 Upstream issue and pull-request records

Issue and pull-request metadata were read from the GitHub REST API (https://api.github.com/repos/modelcontextprotocol/python-sdk/…). Comments were read from the same API. Issue and pull-request titles and comments are statements by the people who wrote them. They are attributed in this record and are not treated as MCP specification requirements.

| ID | Record | State at 2026-11-10 |
|---|---|---|
| S-I1 | Issue #2433, "Windows: TextIOWrapper in stdio_server() emits CRLF instead of LF, corrupting newline-delimited JSON messages," https://github.com/modelcontextprotocol/python-sdk/issues/2433 | Open. Created 2026-04-13. Ten comments; none from a maintainer account in the fetched list. |
| S-I2 | PR #2470, "fix: disable CRLF translation in stdio_server on Windows" | Closed, not merged (2026-04-19) |
| S-I3 | PR #2552, "fix: disable newline translation in stdio TextIOWrapper to prevent CRLF on Windows" | Closed, not merged (2026-10-05). Closing comment by maintainer `maxisbey`. |
| S-I4 | PR #2908, "fix: stdio_server emits LF only on Windows stdout (fixes #2433)" | Closed, not merged (2026-06-25). Closing comment by maintainer `Kludex`: duplicate of #2552. |
| S-I5 | PR #3090, "fix(stdio): serve bufferless std streams as text instead of crashing" | Closed, not merged. Not a newline fix. |
| S-I6 | Tags and releases list (https://api.github.com/repos/modelcontextprotocol/python-sdk/tags and /releases) | Latest tag `v2.3.0`, published 2026-10-02. No later tag or release at 2026-11-10. |

### 2.4 Upstream source files

Read through `raw.githubusercontent.com/modelcontextprotocol/python-sdk/<ref>/<path>`. Line numbers were taken from the fetched text. Where a line number was not recorded, the symbol or file is given.

| ID | Ref | File | Used for |
|---|---|---|---|
| S-U1 | `v2.3.0` and `main` (identical lines checked) | `src/mcp/server/stdio.py` | Stdout wrapper (line 179), message writer (line 204), `_UnownedTextWrapper` class (lines 52–62) |
| S-U2 | `v1.30.0` | `src/mcp/server/stdio.py` | Stdout wrapper (line 49), `stdout_writer` writes `json + "\n"` |
| S-U3 | `v2.3.0` | `src/mcp/server/stdio.py` | Descriptor claim `_claim_fd` (lines 106–158), stdout diversion `_open_stdout_diversion` (lines 87–91), `_dup_above_std` (lines 72–80), `stdio_server` (claim only when `stdout` is `None`) |
| S-U4 | `v2.3.0` | `tests/transports/stdio/test_windows.py` | Test `test_a_native_server_emitting_crlf_line_endings_round_trips_messages` (lines 148–172) |
| S-U5 | `v2.3.0` | `tests/server/test_stdio.py` | Test `test_stdio_server_takes_stdout_off_the_descriptor_table_while_serving` (lines 318–344) |
| S-U6 | `v2.3.0` | `src/mcp-types/mcp_types/version.py` | `KNOWN_PROTOCOL_VERSIONS` (lines 24–30), `HANDSHAKE_PROTOCOL_VERSIONS` (lines 33–38), `MODERN_PROTOCOL_VERSIONS` (line 41), `SUPPORTED_PROTOCOL_VERSIONS` (union, deprecated alias) |
| S-U7 | `v1.30.0` | `src/mcp/types.py`; `src/mcp/shared/version.py` | `LATEST_PROTOCOL_VERSION = "2025-11-25"`; `SUPPORTED_PROTOCOL_VERSIONS` = 2024-11-05, 2025-03-26, 2025-06-18, and the latest revision |
| S-U8 | `v2.3.0` | `src/mcp/server/mcpserver/server.py` | `run()` overload `def run(self, transport: Literal["stdio"] = ...)` and `run_stdio_async` |
| S-U9 | `v1.30.0` | `src/mcp/server/fastmcp/server.py` | `run(transport: Literal["stdio", "sse", "streamable-http"] = "stdio")` |
| S-U10 | `v2.3.0` | `src/mcp/server/stdio.py` | `stdio_server(stdin=None, stdout=None)` signature (line number not recorded) |
| S-U11 | `v2.3.0` and `v1.30.0` | `LICENSE` | MIT (see D01) |

### 2.5 Python and JSON grammar documentation

| ID | URL | Version | Used for |
|---|---|---|---|
| S-P1 | https://docs.python.org/3.14/library/io.html | 3.14 | `TextIOWrapper` newline behavior: on write with `newline=None`, `\n` is translated to `os.linesep`; on read with `newline=None`, `\r`, `\n`, and `\r\n` are translated to `\n` |
| S-P2 | https://docs.python.org/3.14/using/cmdline.html | 3.14 | `-m` and script execution add the current directory or script directory to `sys.path`; `-P` removes the working-directory entry without ignoring `PYTHONPATH`; `-I` ignores `PYTHON*` variables. Fetched 2026-11-10. |
| S-J1 | https://www.rfc-editor.org/rfc/rfc8259 | RFC 8259 (December 2017) | JSON grammar, section 2: `JSON-text = ws value ws`; `ws = *( %x20 / %x09 / %x0A / %x0D )`, so carriage return (`0x0D`) is insignificant whitespace around a JSON value. Fetched 2026-11-10. |

### 2.6 Package metadata

From D01, re-used: PyPI `mcp` 2.3.0 and 1.30.0; `mcp-types` 2.3.0.

### 2.7 Not reachable

https://py.sdk.modelcontextprotocol.io/running-server/ returned HTTP 404. Its content was not read.

---

## 3. Kiro IDE 1.4.121 MCP client contract

All facts in this section come from S-K1 through S-K7 unless stated otherwise. None is versioned to 1.4.121.

### 3.1 Documented facts

**Configuration locations**
- Workspace: `.kiro/settings/mcp.json` in the project root. Applies only to the current workspace (S-K1).
- User: `~/.kiro/settings/mcp.json`. Applies across all workspaces (S-K1).
- Both can be opened from the command palette: "Kiro: Open workspace MCP config (JSON)" or "Kiro: Open user MCP config (JSON)" (S-K1).
- MCP support must be enabled in Kiro settings (S-K1).

**Schema** (top-level key `mcpServers`, keyed by server name; S-K1)

Local (stdio) server:

| Field | Type | Required | Notes |
|---|---|---|---|
| `command` | string | **Yes** | Command that starts the server |
| `args` | array | No | Arguments |
| `env` | object | No | Environment variables for the child process |
| `disabled` | boolean | No | Default `false` |
| `autoApprove` | array | No | Tool names approved without prompting. `"*"` approves all tools. |
| `disabledTools` | array | No | Tools hidden from the agent |

Not documented: `cwd`, `timeout`, `type`, `transport`. These fields must not be used.

**Environment variables** (S-K1, S-K4)
- Documented syntax: `"${VAR_NAME}"`.
- Kiro IDE expands only variables on an approved list. Unapproved references trigger a security popup. Approval can be managed under "Mcp Approved Env Vars."
- Project `.env` files are not loaded automatically.
- Hard-coded values are allowed.
- Whether `$VAR` or `${env:VAR}` syntax works is not documented.

**Launch and error reporting** (S-K1, S-K2, S-K4)
- "Each stdio MCP server runs as a separate local process."
- Errors and logs appear in the Kiro panel's Output tab, under "Kiro - MCP Logs." The MCP servers view shows connection status.
- Saving `mcp.json` reconnects servers. A server can also be reconnected from its context menu (S-K1, S-K3).
- Automatic reconnection after a crash or dropped connection is not documented.

**Precedence** (S-K1)
- Configurations are merged, with workspace settings taking precedence. Different server names are combined.
- For the same server name, the documentation shows the higher-priority entry used as a complete override. Whether fields are deep-merged is not documented.

**Permissions and approval** (S-K3, S-K6)
- Each MCP tool call prompts for approval by default.
- `autoApprove` in `mcp.json` removes the prompt for named tools.
- Capability rules in `permissions.yaml` can match MCP tools by `server/tool`. Deny takes precedence over ask and allow.
- In untrusted workspaces, Kiro asks before every MCP tool call, even when a saved rule or `autoApprove` allows it. A matching deny still refuses.

**Process and sandbox** (S-K4, S-K7)
- By default, MCP servers run outside Kiro's local command sandbox. The documentation warns that a stdio server "runs code on your machine" and can access files, environment variables, credentials, and network resources available to the user account.
- The local command sandbox, which S-K7 says is available in Kiro IDE 1.3 and later, can wrap stdio MCP servers when `mcpSandboxing` is `true` in `sandbox.json`. It is off by default.
- Remote HTTP and SSE servers are not affected by the sandbox.

### 3.2 Not documented

- Which MCP protocol revisions Kiro's client negotiates or sends first.
- Whether Kiro's client supports Streamable HTTP for local servers. Documentation names "Remote (HTTP/SSE)" servers only.
- Startup timeout and any `cwd` or `timeout` handling.
- Automatic reconnect or backoff.
- Field-level merge when the same server name appears in both files.
- Whether Kiro's line parser accepts `\r\n` message terminators. Kiro's client is not open source and its parser was not available for reading.
- Whether `mcpSandboxing` wraps stdio servers on Windows. S-K7 lists Windows requirements for command sandboxing only.

### 3.3 Kiro version relevance

S-K7 states the local command sandbox is available in Kiro IDE 1.3 and later. Kiro IDE 1.4.121 therefore satisfies that minimum for the sandbox feature. No version statement for MCP behavior was found. MCP behavior at 1.4.121 is `NOT_VERIFIED`.

---

## 4. STDIO transport compatibility

### 4.1 Specification requirements (S-M1, 2025-11-25)

- The client launches the server as a subprocess.
- The server reads JSON-RPC from stdin and writes to stdout.
- Messages are delimited by newlines and must not contain embedded newlines.
- The server may write UTF-8 logs to stderr. The client may capture, forward, or ignore stderr and should not treat stderr output as an error indicator.
- The server must not write anything to stdout that is not a valid MCP message.
- Clients should support stdio when possible.

The 2026-07-28 stdio binding (S-M3) keeps these framing rules unchanged: one newline-delimited JSON-RPC message per line, no embedded newlines, UTF-8, and no stdout content that is not a valid MCP message. It adds shutdown rules (Section 12, T10) and a `server/discover` probe for backward compatibility (Section 5.1). Neither page specifies receiver handling of a carriage return before the newline.

The 2025-11-25 (S-M1) and 2026-07-28 (S-M3) stdio pages do not state how a receiver should handle a carriage return before the newline. Two questions must be kept apart.

- **JSON validity.** RFC 8259 defines `JSON-text = ws value ws`, where `ws` includes the carriage return (S-J1). A JSON value followed by CR and then LF still parses as JSON. The CR before the delimiter does not, by itself, make the JSON message invalid.
- **MCP framing.** The stdio bindings require one newline-delimited JSON-RPC message per line, with no embedded newlines (S-M1, S-M3). Neither page states how a receiver treats a carriage return before the delimiter. Whether a receiver accepts CR-LF-delimited frames is therefore a property of that receiver. For Kiro this is unknown and is decided empirically by T7b.

Passing the JSON grammar does not establish MCP transport conformance. Failing to establish MCP conformance for CR-LF framing does not establish that the JSON is invalid. This record treats the receiver question as a risk to be tested (Section 12, T7 and T7b).

### 4.2 SDK behavior (source-verified)

**v1.30.0** (S-U2):
- Wraps `sys.stdin.buffer` and `sys.stdout.buffer` in `TextIOWrapper` with UTF-8 (lines 47 and 49).
- The writer emits `json + "\n"` and flushes (`stdout_writer`).
- Does not redirect file descriptors. A stray `print()` writes to stdout. The stdio binding forbids stdout content that is not a valid MCP message (S-M1). The effect on a given client is implementation-dependent.

**v2.3.0** (S-U1, S-U3):
- Claims file descriptors 0 and 1 during serving, only when the caller passes no `stdin` or `stdout` (`_claim_fd`, `stdio_server`).
- Diverts the public stdout descriptor to stderr by duplicating fd 2 (`_open_stdout_diversion`). The wire is served from a private duplicate of fd 1 (`os.fdopen(private_fd, mode, closefd=False)`, line 158).
- Refuses a second concurrent stdio server in the same process (`RuntimeError`, lines 115–122).
- Falls back to serving the standard stream in place if descriptor duplication or diversion fails (lines 130–149).
- Wraps stdout as `_UnownedTextWrapper(stdout_buffer, encoding="utf-8")` (line 179) and writes `json + "\n"` (line 204).

**Newline translation (both versions, source-verified):**
- `_UnownedTextWrapper` overrides only `close`. It does not set `newline`, so the Python default applies (S-U1, lines 52–62).
- Under the Python default (`newline=None`), `\n` written to the stream is translated to `os.linesep` (S-P1). On Windows this is `\r\n`.
- Therefore the SDK writes CRLF-terminated messages on Windows, in both v1.30.0 and v2.3.0. The same applies on `main` at the investigation date (S-U1, lines 179 and 204, unchanged).
- The stdin wrapper also leaves `newline` at its default (line 176). On read, that default accepts `\r\n` and translates it to `\n` (S-P1). The SDK therefore accepts CRLF input from a client, but writes CRLF output on Windows.

### 4.3 Windows newline behavior: investigation result

This section answers the specific questions raised for this correction.

| Question | Answer | Basis |
|---|---|---|
| Does issue #2433 affect the exact v2.3.0 release? | **Yes, by source.** The v2.3.0 wrapper (line 179) and writer (line 204) have no `newline=""`. | S-U1 (source-verified) |
| Was it reproduced upstream? | **Yes, by community reporters, not by this audit.** A commenter reproduced it natively on Windows 11 with Python 3.13 on `main` (2026-07-19). A second commenter reported a byte-level reproduction on PyPI `mcp` 2.3.0, Windows 11, Python 3.11.4, in a fresh venv (2026-10-11). In that report, the stock `initialize` response was 242 bytes and ended `7d 7d 7d 0d 0a`. With `newline=""` it was 241 bytes and ended `7d 7d 7d 0a`. | S-I1 comments (reported); not independently reproduced here |
| Do the Windows-specific tests in v2.3.0 test outgoing wire bytes? | **No.** See the findings below. | S-U4, S-U5 |
| Was a fix merged, and in which release? | **No fix merged in any release.** Three fix pull requests (#2470, #2552, #2908) were closed without merging. #2552 was closed as part of a backlog cleanup; the maintainer's closing comment asks for an issue with a repro if the problem still matters on v2. #2908 was closed as a duplicate of #2552. The latest tag is v2.3.0. | S-I2 to S-I4, S-I6 |
| Does `main` still perform Windows newline translation? | **Yes.** At the investigation date, `main` has the same wrapper and writer lines as v2.3.0. | S-U1 (source-verified) |
| Does v1.30.0 have the same issue? | **Yes, by source.** Its stdout wrapper (line 49) has no `newline` argument, and its writer emits `json + "\n"`. The original report was against v1.x, and a commenter confirmed the issue on `main` and `v1.x` from source. | S-U2 (source-verified); S-I1 comments |
| Does CR-LF make the JSON message invalid? | **Not by itself.** RFC 8259 permits CR as insignificant whitespace in the `ws` production that surrounds a JSON value (S-J1). The observed bytes show CR-LF terminators on the wire. Whether Kiro accepts that framing under the MCP framing rule is an interoperability question, decided by T7b. | S-J1; S-U1 (observed bytes) |
| Does v2's fd diversion fix newline translation? | **No.** The two behaviors are separate. Fd diversion controls where stray output goes (stderr) and which descriptor carries the wire. Newline translation is applied by the `TextIOWrapper` layer to the wire writer, whichever descriptor it writes to. Changing the descriptor does not remove the translation. This is consistent with the Python documentation (S-P1) and with the byte-level community reproduction on v2.3.0. | S-U3 and S-P1 (source-verified reasoning) |

**Findings on the v2.3.0 Windows tests.**

- `test_a_native_server_emitting_crlf_line_endings_round_trips_messages` (S-U4, lines 148–172) runs a child Python process that writes its reply with `print()`, which emits CRLF on Windows. It asserts that the SDK **client** parses the reply. The test checks client-side tolerance of CRLF input. It does not check the SDK **server's** output bytes. It is marked `# pragma: no cover` and is skipped on non-Windows platforms.
- `test_stdio_server_takes_stdout_off_the_descriptor_table_while_serving` (S-U5, lines 318–344) sends a real response through the SDK's `stdio_server` and reads the raw bytes from the wire pipe. It then decodes and calls `.strip()` before validating JSON (lines 338–340). `.strip()` removes both `\r\n` and `\n`, so the assertion passes with either terminator. The test does not assert the terminator bytes.
- The same file expects the stray-print output on stderr to equal `b"stray print" + os.linesep.encode()` (lines 334–336). On Windows, that is CRLF. The test therefore encodes the translation behavior for stray output, not the absence of translation.

Conclusion: the v2.3.0 Windows tests do not verify LF-only outgoing wire bytes. Their CRLF coverage is client-side tolerance and stray-output routing.

**Kiro acceptance of CRLF**: `NOT_VERIFIED`. The Kiro client is not open source, and its documentation says nothing about line endings. Whether a client that splits on `\n` accepts a trailing `\r` depends on its parser. The fetched evidence does not decide this.

### 4.4 Mitigation options (not applied, not recommended yet)

Each option is evaluated against the observed CR-LF terminators and Kiro's unverified acceptance of them. None is evaluated on the premise that CR-LF invalidates the JSON.

| Option | Description | Status |
|---|---|---|
| M1 | Keep the SDK as released and test Kiro's behavior (T7). | Recommended first step, requires authorization. |
| M2 | Pass a custom `stdout` stream with `newline=""` to `stdio_server(stdin=..., stdout=...)` (signature verified, S-U10). | **Caution.** When the caller passes `stdout`, the SDK does not claim fd 1 (`if not stdout:` in `stdio_server`). The fd diversion that protects against stray output would no longer apply. Any use of M2 must also add a Sean-side stray-output guard, which is new code and needs its own security review and runtime test. |
| M3 | Wait for an upstream fix. | No fix is merged. Maintainers asked for an issue with a repro. Posting a new repro upstream is an external action and needs human authorization. |
| M4 | Switch to v1.30.0 to avoid the issue. | **Does not help.** v1.30.0 has the same translation (S-U2, line 49). |

### 4.5 Verified conclusions for STDIO

- STDIO is the transport that matches Sean's local-first, no-additional-service architecture (Architecture §2.4).
- Kiro documents launching stdio servers as local child processes, which matches S-M1.
- Both SDK lines write CR-LF terminators to stdout on Windows. This is source-verified observed behavior. CR is permitted JSON whitespace (RFC 8259), so the terminator is not by itself an invalid JSON message. Whether Kiro accepts CR-LF-delimited frames under the MCP framing rule is unknown and is decided by T7b. Neither SDK line has a merged fix.
- The two SDK lines differ in stray-output protection. v2.3.0 protects the wire during serving. v1.30.0 does not. The CRLF issue is independent of that difference.

---

## 5. SDK v1.30.0 versus v2.3.0

| Area | v1.30.0 (maintenance line) | v2.3.0 (stable line) |
|---|---|---|
| Status | Maintenance: critical bug fixes and security patches only (S-D2, S-D3). | Stable. `pip install mcp` installs 2.x (S-D1). |
| Latest protocol revision | 2025-11-25 (S-U7) | 2026-07-28 (S-U6, line 24–30) |
| Protocol revisions served | See Section 5.1 | See Section 5.1 |
| High-level server | `FastMCP` (`mcp.server.fastmcp`) | `MCPServer` (`mcp.server.mcpserver`) |
| Run API | `FastMCP.run(transport="stdio")`, default `stdio` (S-U9) | `MCPServer.run()` overloads per transport; stdio overload has no transport parameter (S-U8) |
| Stray stdout protection during serving | None | Yes (S-U3, S-U5) |
| Newline translation on Windows | Yes (S-U2, line 49) | Yes (S-U1, line 179) |
| Advisory floor (D01) | `>=1.30.0` | `>=2.2.0` |
| Direct dependencies | Earlier set | Adds `mcp-types` (exact pin by `mcp`), `opentelemetry-api`, `httpx2`. Removes `httpx`, `httpx-sse`, and the `ws` extra. |
| Windows dependency | `pywin32` on Windows | `pywin32>=311` on Windows (D01) |
| Breaking changes from the other line | Not applicable | Renames, snake_case fields, removed types, `McpError` renamed, transport parameters moved, WebSocket transport removed, Tasks API removed (S-D2) |
| Greenfield cost | Starts on a line that receives critical fixes only | No existing Sean MCP code, so no migration cost |

**Limitation:** These tables show which revisions each SDK's code lists. They do not show which revision Kiro's client sends first.

### 5.1 Protocol revisions (corrected)

The modern protocol is not the legacy handshake with a newer label. The two mechanisms are separate.

| Revision | Mechanism | v1.30.0 | v2.3.0 | Source |
|---|---|---|---|---|
| 2024-11-05, 2025-03-26, 2025-06-18, 2025-11-25 | **Legacy handshake.** The client sends `initialize`, the server answers with its capabilities, and the client sends `notifications/initialized`. | Served. The four revisions are in v1's supported list. 2025-11-25 is the latest. | Served. Listed in `HANDSHAKE_PROTOCOL_VERSIONS`. | S-U6 lines 33–38; S-U7 |
| 2026-07-28 | **Modern (stateless per-request envelope).** No `initialize` handshake and no session. Each request carries its protocol version and client capabilities in its `_meta` object, under the reserved keys `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities`, which are required on every request (S-M4). Discovery uses the `server/discover` request (S-M5). | **Not served.** Not in v1's supported list. | Served. Listed in `MODERN_PROTOCOL_VERSIONS`. | S-U6 line 41; S-D1 |

How v2 supports both mechanisms (documented in S-D1): one stdio server answers a 2025-era client's `initialize` and a 2026-era client's requests with no configuration change. The 2026-07-28 stdio binding defines the client-side probe (S-M3): the client sends `server/discover` first. A `DiscoverResult` identifies a modern server. A recognized modern error, such as `UnsupportedProtocolVersionError`, also identifies a modern server, and the client retries with a version from the advertised list instead of falling back. Any other error, or no reply within a timeout, identifies a legacy server, and the client falls back to `initialize`. The legacy `initialize` request carries the revision in `params.protocolVersion` (S-M6). The v2 server dispatch code for modern requests was not read in source. This is documented behavior, not source-verified behavior.

Consequences:
- Every legacy handshake revision that v1 serves is also served by v2.
- Only v2 serves 2026-07-28.
- `SUPPORTED_PROTOCOL_VERSIONS` in v2 is the union of both lists and is deprecated (S-U6).
- Which mechanism Kiro uses, and whether it sends `server/discover` or `initialize` first, is `NOT_VERIFIED` (L1, L14).

---

## 6. Windows compatibility

### 6.1 Documented or verified

- **Command form:** Kiro's Windows example (S-K5) uses a bare command name (`uv`) with an argument ending in `.exe`. This shows Kiro launches Windows commands by name. Kiro's troubleshooting guidance says to confirm the command is on PATH (S-K1).
- **Working directory:** `cwd` is not documented (S-K1). A server must not depend on its launch working directory.
- **Environment:** Kiro expands only approved environment variables (S-K1, S-K4). A hard-coded path or an absolute interpreter path does not depend on expansion.
- **Sandbox on Windows:** Command sandboxing requires a one-time administrator setup for `COMMON_DEPENDENCIES` and `DEFAULT_ALLOWED`. `DEFAULT_BLOCKED` works before setup (S-K7). Whether MCP wrapping works on Windows is not documented separately.
- **SDK Windows tests:** v2.3.0 includes Windows-only stdio tests (S-U4). Their coverage is described in Section 4.3. They are skipped on non-Windows platforms. Whether they pass on Windows CI was not verified in this record.
- **Windows Python:** Python 3.14.10 provides a Windows installer (python.org, 2026-10-25). Python 3.12.16 is a source-only security release with no Windows installer. The last full Python 3.12 Windows installer was 3.12.10 (python.org, 2026-10-25). This is consistent with D01, which is the source of truth for the approved runtime (Python 3.14.10). This record does not change that decision.
- **Windows dependency wheels:** pywin32 311 and 312 and pydantic-core 2.50.4 have Windows wheels for CPython 3.12 and 3.14 (D01).

### 6.2 Process-launch considerations

- Use an absolute path to the venv interpreter (`backend\.venv\Scripts\python.exe`). This avoids PATH resolution differences between Kiro and the shell.
- Avoid `py` in the configured command. The launcher selects the default Python version, which changes with installation state.
- Backslashes in JSON must be escaped (`\\`).
- The repository path (`C:\Users\User\source\repos\Sean`) has no spaces. Paths with spaces or non-ASCII characters have not been tested.
- A venv launched by absolute path works without activation.
- Whether the venv launcher starts a second child process (the base interpreter) is `NOT_VERIFIED`. Section 12 (T10) handles this by following the parent chain.

### 6.3 Not verified

- Stdout and stdin pipe behavior between Kiro 1.4.121 and a Python child on Windows.
- Process cleanup when Kiro exits or reconnects.
- Whether Windows Defender or other endpoint protection interferes with child processes.

---

## 7. Recommended SDK version and justification

### 7.1 Status of the SDK decision

| Stage | Decision | Status |
|---|---|---|
| Provisional SDK candidate | `mcp==2.3.0` (exact pin, consistent with D01's exact Python pins). Fallback candidate: `mcp==1.30.0`. | **Recommended, not approved.** |
| Human approval to conduct a runtime experiment | Authorization to create a venv, install `mcp==2.3.0` for runtime tests, and create the disposable probe and the temporary test configuration (Section 12.2). Each is a separate authorization. | **Not granted.** Requested in Section 13. |
| Final SDK selection | Decided only after the runtime tests in Section 12 pass or fail with documented results. | **Pending.** |

Dependency handling:
- Use the exact pin `mcp==2.3.0` in `backend/requirements.txt`. Full transitive pins are generated when the lock step is authorized (D01).
- Do not add `mcp-types` as an independent direct dependency. `mcp` 2.3.0 pins `mcp-types==2.3.0` exactly, and the SDK re-exposes it. D01's decision to resolve `mcp-types` through the SDK is preserved. A direct pin would be justified only by a verified technical requirement, and none was found.

### 7.2 Justification for v2.3.0 (provisional)

1. **Stable line.** v2 is the current stable line. The v1 line receives critical fixes only (S-D2, S-D3).
2. **Protocol coverage.** v2 serves every legacy handshake revision that v1 serves, and also serves 2026-07-28 (Section 5.1). v1 does not serve 2026-07-28.
3. **Stray-output protection.** v2 diverts stray stdout writes to stderr during serving (S-U3, S-U5). v1 has no such protection. This is a real difference, but it does not fix the CRLF issue (Section 4.3).
4. **No migration cost.** Sean has no MCP code yet.
5. **Security.** v2.3.0 is above the advisory floor for the MCP advisories checked in D01 (`>=2.2.0`).
6. **Windows.** v2.3.0 requires `pywin32>=311` on Windows, which has cp312 and cp314 wheels.

Caveat that applies to both lines: the SDK's observed Windows wire output uses CR-LF terminators in both lines, and no fix is merged in either (Section 4.3). Choosing v2 over v1 does not change this. Kiro's acceptance of the framing is the decisive open question (T7b).

### 7.3 Fallback

If runtime testing shows a v2-specific failure, `mcp==1.30.0` is the fallback. It is advisory-clean at its floor (D01) and serves the same legacy handshake revisions. It does not serve 2026-07-28 and does not have stray-output protection. It is a fallback only, not a first choice.

### 7.4 Other caveats

- v2 is new. The v2.0.0 release is dated 2026-07-28, and 2.3.0 is dated 2026-10-02 (S-I6).
- v2 adds `opentelemetry-api` as a required dependency. Its effect on Sean's startup has not been measured.

---

## 8. Recommended entry point and process model

### 8.1 Entry point

Use the architecture's `mcp` module (Architecture §7 and §12) as the MCP adapter. It must:
- Define MCP tools as thin adapters over existing backend services (repository, symbol resolution, git history, GitHub, evidence, investigation, explanation).
- Contain no retrieval, ranking, or classification logic.
- Be started with `python -m app.modules.mcp` from a backend directory that is on `sys.path`.

Use `-m` for the recommended invocation. The reason is consistent package execution and predictable import resolution. The module is run as a member of the `app` package, through the standard import system, so its absolute imports resolve the same way as the rest of the backend and as the tests will. This is a consistency argument, not a claim about a name collision.

Running a file path instead (for example `python app\modules\mcp\__main__.py`) makes Python add that file's directory to `sys.path` (https://docs.python.org/3.14/using/cmdline.html). This layout does not demonstrate a collision with the SDK's `mcp` package. The added directory is `app\modules\mcp`, not `app\modules`, so the local folder named `mcp` is not on `sys.path` as a top-level name. No name collision is claimed or demonstrated.

`-m` has its own residual import-resolution question. Python also adds the current working directory to `sys.path` for `-m` (same source). Kiro's launch working directory is not documented (S-K1). If that directory contained a local `app` or `mcp` package, it could take precedence. This is not demonstrated for Sean's layout. Test T12 must verify import resolution from Kiro's launch context. The `-P` option removes the working-directory entry from `sys.path` without ignoring `PYTHONPATH` (same source). Whether to add `-P` is a decision for after T12, not part of this record.

Logging: configure logging to write to stderr only. Nothing should be printed to stdout.

Tool design principles (for later, not decided here):
- Read-only tools only. Architecture §12 requires read-only MCP tools.
- Validate all inputs and constrain repository paths to approved roots (Spec 1 §13).
- Return structured results with explicit retrieval status.

### 8.2 Process model

- Kiro launches the Sean MCP server as a child process per configured server (S-K1).
- Architecture §2.4 allows an MCP STDIO entry point to be launched by its host when needed, provided it reuses the backend modules and is not a separately maintained service.
- While Kiro keeps the server connected, one additional Python process runs. The architecture's minimal-runtime principle counts the backend and the frontend dev server as persistent processes. Human review should confirm that the MCP child process is acceptable under §2.4 as an on-demand host-launched process (L15).
- No second persistent service is introduced. The MCP entry point does not open a network port.

### 8.3 Reuse of backend logic

- The HTTP API and the MCP adapter import the same application services. No retrieval or ranking logic is duplicated (Architecture §5.1 and §12).
- The MCP adapter should not import the FastAPI application object. It needs only the service modules.

---

## 9. Proposed Kiro configuration example (UNVERIFIED)

**Superseded by Section 17.** This sketch is kept as history. It omits the `-P` interpreter flag and the verification labels that Section 17 adds. Do not copy it.

**UNVERIFIED. Production-shaped sketch only.** This example shows the eventual production configuration shape, for the production entry point `app.modules.mcp`. It is not written to any file and has not been tested with Kiro 1.4.121. It must not be used for the D02 compatibility experiment. The experiment uses the separate temporary probe configuration in Section 12.2. Production configuration remains prohibited until every requirement of Architecture §12.2 is satisfied (Section 13, condition 6).

The JSON was validated in memory with a JSON parser on 2026-11-10 (PowerShell `ConvertFrom-Json`). The parse succeeded, and `command`, `PYTHONPATH`, and `args` read back as the intended values. This validates syntax only. It does not validate Kiro's behavior.

Proposed location: the user-level file `~/.kiro/settings/mcp.json`. Reason: absolute machine paths should not be committed in a workspace file (Architecture §14). Human approval required (L16).

```json
{
  "mcpServers": {
    "sean": {
      "command": "C:\\Users\\User\\source\\repos\\Sean\\backend\\.venv\\Scripts\\python.exe",
      "args": ["-m", "app.modules.mcp"],
      "env": {
        "PYTHONPATH": "C:\\Users\\User\\source\\repos\\Sean\\backend"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Field notes:
- `command` is an absolute path to the venv interpreter. It must match the venv created by Architecture §16.1 (`cd backend`, then `py -3.14 -m venv .venv`).
- `args` uses `-m` so the module resolves from `PYTHONPATH`.
- `env.PYTHONPATH` is a hard-coded value. Kiro allows hard-coded values in `env` (S-K1). It is machine-specific, so it belongs in the user-level file only.
- `autoApprove` is empty. Every tool call prompts for approval (S-K3).
- No `cwd`, `timeout`, or `type` field. These are not documented.
- No secrets. A GitHub token, if used later, must come from an approved `${VAR}` reference and not from this file.

Unverified points in this example: whether `PYTHONPATH` in `env` is passed to the child process as expected, whether Kiro accepts escaped Windows paths in this form, whether the server starts within Kiro's startup window, and whether the server accepts the CRLF framing that Kiro sends or receives (Section 4.3).

---

## 10. Security considerations

### 10.1 Process isolation and sandboxing

- A stdio server runs as an unsandboxed local process by default (S-K4).
- Recommendation for later (requires separate approval, not applied here): enable `mcpSandboxing` with `networkAccess` set to `DEFAULT_BLOCKED` in the user sandbox file (S-K7). Add a `sandbox_network` allow rule only for the GitHub API host if the optional GitHub integration is used.
- Whether `mcpSandboxing` works for this server on Windows is `NOT_VERIFIED` (L8).

### 10.2 Approval and permissions

- Keep `autoApprove` empty. Read-only tools still require per-call approval, which is the documented default (S-K3).
- In untrusted workspaces, Kiro prompts before every MCP call (S-K6). Keep this behavior.
- An `mcp` capability rule in `permissions.yaml` could allow a specific tool later. Adding one requires separate review.

### 10.3 Stdout integrity

- The stdio binding forbids writing anything to stdout that is not a valid MCP message (S-M1). The effect of a violation on a given client is implementation-dependent and is not assumed here.
- v2.3.0 diverts stray stdout writes to stderr during serving (S-U3, S-U5). Sean code should still never print to stdout.
- The entry point must not import modules that print at import time. This must be tested (T6).
- Windows newline translation is a separate issue (Section 4.3). Stray-output protection does not change it.

### 10.4 Logging and secrets

- Logs go to stderr. Kiro shows stderr in its MCP logs (S-K1).
- Logs must not contain tokens, credentials, full environment variables, or unnecessary private repository content (Architecture §20).

### 10.5 Input validation and path containment

- All repository paths must be normalized and checked against approved roots. Symlink-aware containment is required by Spec 1 §13. These requirements are inherited from the backend modules, not from MCP.
- Tool arguments from the model are untrusted. Validate them before use.

### 10.6 Environment variables

- Only approved `${VAR}` names are expanded by Kiro (S-K1, S-K4). Unapproved references produce a popup.
- The example config uses a hard-coded `PYTHONPATH` only.

### 10.7 Configuration file exposure

- Workspace config is committed to version control if placed in `.kiro/settings/`. It must not contain machine-specific paths or secrets. Use user-level config for the example above.

### 10.8 Known advisories

- MCP advisories affecting older lines are fixed in v2.2.0 and v1.30.0 (D01). v2.3.0 is above both floors.
- CVE-2026-39313 is not applicable to the Python SDK (D01).

---

## 11. Known limitations and unresolved questions

| # | Item | Status | Why it matters |
|---|---|---|---|
| L1 | MCP protocol revisions Kiro 1.4.121 negotiates or sends first | NOT_VERIFIED | Determines whether the legacy handshake or the 2026-07-28 modern path is exercised. Both SDK lines serve the legacy handshake, so the choice does not change this risk. Only v2 serves 2026-07-28. |
| L2 | Whether Kiro accepts CR-LF-delimited frames from the SDK on Windows under the MCP framing rule | NOT_VERIFIED | Observed wire behavior (source-verified): the SDK writes CR-LF terminators on Windows in both lines (Section 4.3). CR is permitted JSON whitespace (RFC 8259), so the question is framing acceptance by Kiro, not JSON validity. Upstream has no merged fix. If Kiro rejects this framing, every message fails at the transport level. Decided by T7b. |
| L3 | Whether Kiro uses Streamable HTTP for local servers | NOT_VERIFIED (not documented) | Not needed for the STDIO recommendation. |
| L4 | Startup timeout, reconnection, and crash recovery | NOT_VERIFIED | Affects user experience and error handling. |
| L5 | Whether `cwd` or `timeout` fields are accepted | NOT_VERIFIED (not documented) | This record does not use them. |
| L6 | Whether `${env:VAR}` or `$VAR` syntax works | NOT_VERIFIED | This record uses only the documented `${VAR}` form, and only if needed. |
| L7 | Field merge when the same server name appears in user and workspace files | NOT_VERIFIED | Affects where the configuration should live. |
| L8 | Whether `mcpSandboxing` wraps stdio servers on Windows | NOT_VERIFIED | Determines whether the recommended isolation is available. |
| L9 | Whether MCP tool results from Sean render correctly in Kiro | NOT_VERIFIED | Depends on tool design, not on this decision. |
| L10 | Process cleanup when Kiro exits | NOT_VERIFIED | Could leave orphan Python processes. Tested by T10. |
| L11 | Behavior on paths with spaces or non-ASCII characters | NOT_VERIFIED | The current repository path does not contain them. |
| L12 | Whether the SDK's Windows tests run and pass on Windows CI | NOT_VERIFIED | Source-read: the v2.3.0 Windows tests do not assert LF-only wire bytes (Section 4.3). Their pass or fail status was not checked. |
| L13 | Kiro MCP behavior specific to IDE 1.4.121 | NOT_VERIFIED | Docs are not versioned to 1.4.121. |
| L14 | Whether Kiro's MCP client sends `initialize` or `server/discover` first | NOT_VERIFIED | Determines which SDK code path is exercised first. |
| L15 | Architecture §2.4 interpretation of a host-launched child process | Human decision | Section 8.2. |
| L16 | Production configuration location (user versus workspace) | Deferred to the production configuration gate. Not a D02 closure condition. The temporary test configuration location is governed by owner authorization in Section 12.2. | Section 9. |
| L17 | Whether to use mitigation M2 (custom stdout with `newline=""`) | Human decision, only if T7 fails | Section 4.4. Changes stray-output protection and needs its own review. |
| L18 | Whether to post a new reproduction upstream on issue #2433 | Human decision | External action. Section 4.4 (M3). |

---

## 12. Required runtime tests and acceptance criteria

No test has been run. These tests require separate authorization, the disposable D02 compatibility probe (Section 12.1), a temporary test configuration that is authorized separately (Section 12.2), and the approved environment (Python 3.14.10 venv and SDK v2.3.0 installed in it).

Prerequisites (each needs separate approval):
1. Create the backend venv with `py -3.14 -m venv .venv` in `backend`.
2. Install `mcp==2.3.0` and its dependencies into that venv.
3. Create the disposable D02 compatibility probe defined in Section 12.1. It is one read-only test tool that returns a fixed value and does not touch the repository.
4. Create the temporary test configuration entry defined in Section 12.2, only after separate owner authorization. It is not the production configuration.
5. For T3, T7b, and T10, a passive test-only capture harness (a stdio tee) that forwards bytes unchanged and writes raw copies outside the repository, after human approval. The harness must not modify, normalize, or translate any byte.

### 12.1 Disposable D02 compatibility probe

The minimal test entry point is a disposable D02 compatibility probe. It is not Sean's production MCP implementation, and it is not a skeleton to be promoted in place. It must:
- Expose exactly one fixed-value, read-only test tool.
- Perform no repository access and no external command execution.
- Contain no retrieval, ranking, classification, or business logic, and not import Sean's backend application services.
- Be used only for the authorized compatibility experiment.
- Not be promoted to production implementation without a separate human decision and the applicable implementation gates (Architecture §12.2 and the implementation gates in Section 13).

Test-only EOF instrumentation (T10). The probe may record, to a file outside the repository, the time at which its own stdin reaches end-of-file. Feasibility is not established. The SDK's stdio server reads standard input in its own reader loop. Passing a replacement stdin stream to `stdio_server` (S-U10) bypasses the descriptor claim for fd 0 (S-U3), which changes how the process handles its stdin. That change is not made silently, and this record does not authorize it. Direct server-side EOF observation is therefore treated as not yet feasible. Unless the owner authorizes an instrumentation design that observes EOF without altering the stdin path, the shutdown route is classified `UNVERIFIED` under T10.

### 12.2 Temporary D02 test configuration (separate authorization)

This section defines a temporary, human-authorized MCP test configuration. It exists only to run the Section 12 tests against Kiro 1.4.121. It is not the production MCP configuration.

Preconditions:
- The owner explicitly authorizes the creation of the temporary test configuration before it is created, and names its file location.
- The owner authorizes the probe described in Section 12.1 for this experiment only.
- The owner records that this authorization does not satisfy, waive, or amend Architecture §12.2.

Constraints:
- It uses only the disposable compatibility probe from Section 12.1.
- It exposes exactly one fixed-value, read-only test tool.
- It contains no production tools, no secrets, and no repository access.
- It uses a probe server name, `sean-d02-probe`, so that it cannot be mistaken for the production server name `sean`.
- It does not authorize production MCP configuration, and it is not evidence that any Architecture §12.2 requirement has been met.

Removal:
- The temporary test configuration is removed after the compatibility experiment, unless the owner explicitly authorizes retaining it. Removal is recorded: after removal, Kiro no longer lists `sean-d02-probe`.
- The probe source is disposable. Whether it is retained is an owner decision recorded with the experiment result.

Tests and acceptance criteria:

| # | Test | Acceptance criterion |
|---|---|---|
| T1 | Configuration parsing | Kiro's MCP panel lists the probe server `sean-d02-probe` with no JSON error after saving the temporary test configuration (Section 12.2). |
| T2 | Startup | Server status shows connected within Kiro's startup window. The "Kiro - MCP Logs" output shows no launch error. |
| T3 | First inbound message and protocol revision (raw evidence) | Using the passive capture harness (prerequisite 5), preserve the complete first inbound JSON-RPC message that Kiro sends to the server, as raw bytes including its terminator, in a file outside the repository. Identify the revision from the message structure defined by the applicable specification: for a legacy `initialize` request, the `params.protocolVersion` field (S-M6); for a modern request, the `io.modelcontextprotocol/protocolVersion` key of its `_meta` object (S-M4). Record the method name from the same message. Kiro's actual revision remains `NOT_VERIFIED` until this capture exists. If no harness is authorized, T3 is recorded as a limitation and L1 stays `NOT_VERIFIED`. |
| T4 | Tool listing | The test tool appears in Kiro's tool list with its schema. |
| T5 | Tool call with approval | A tool call shows an approval prompt. Approving it returns the fixed value. |
| T6 | Stdout integrity | A deliberate `print()` in the tool body does not break the connection. Record the result. The expected result on v2.3.0 is that the print goes to stderr (S-U5). |
| T7a | Raw SDK output bytes (no Kiro involved) | Run the entry point under a binary-pipe harness. Send one framed request as bytes. Read the reply as raw bytes, not through a text reader. Count LF (`0A`) and CRLF (`0D 0A`) terminators and report the exact final bytes. The expected result on Windows is CRLF, from source (Section 4.2). **T7a records bytes. It is not by itself a Kiro pass or fail.** |
| T7b | Real Kiro tool call with raw-byte evidence in both directions | T7b passes only if all of the following are recorded. A local SDK or harness test alone never counts as T7b passing. (a) A real tool call issued from Kiro 1.4.121 returns the expected fixed value. (b) Passive raw-byte capture of Kiro-to-server bytes, with each message's exact terminator recorded as `0A` or `0D 0A`. (c) Passive raw-byte capture of server-to-Kiro bytes, with each message's exact terminator recorded in the same way. (d) The actual Kiro tool-call result, recorded verbatim. (e) Any protocol or transport error, recorded verbatim, with the matching Kiro MCP log excerpt. The capture harness must be passive. It forwards bytes unchanged. It does not decode, normalize, re-encode, add, or remove terminators. It writes copies to a file outside the repository. Any overhead the harness adds is recorded as a limitation. |
| T8 | Bad configuration | A wrong interpreter path produces a readable error in the MCP logs. No hang in the Kiro UI. |
| T9 | Reconnect | Saving an unchanged `mcp.json` or using "Reconnect" restores the connection. |
| T10 | Process cleanup, graceful versus forced | Outcome is PASS, FAIL, or PARTIAL, as defined in the procedure below. |
| T11 | Untrusted-workspace behavior | In an untrusted workspace, each call prompts even with `autoApprove` set. |
| T12 | Environment and import resolution | Run under the actual Kiro launch context, including the configured `PYTHONPATH`, not a shell. Resolve modules with `importlib.util.find_spec`, which does not execute the target module but imports its parent packages; this is the only backend interaction the probe performs, and it is recorded. Record the diagnostics the probe writes to stderr at startup (probe-only, not for production): (a) `app.modules.mcp` resolves to Sean's backend module, with its resolved file path (expected under `...\Sean\backend\app\modules\mcp\` when that module exists); (b) `mcp` resolves to the installed SDK package, with its resolved file path (expected under the venv `Lib\site-packages\mcp\`); (c) the ordered `sys.path` entries; (d) the `PYTHONPATH` value observed by the process. If the probe is not placed under `app.modules.mcp`, the check records the probe's own module instead. Production resolution of `app.modules.mcp` is verified when that module exists. A resolution to any other path is a T12 failure and blocks closure. Also verify that no secret appears in logs. |
| T13 | Sandbox (optional) | With `mcpSandboxing: true`, the server starts or Kiro reports that it is not covered. Record which. |

**T10 procedure (process-tree based, read-only observation, graceful versus forced cleanup):**
1. Before connecting the MCP server, record the Kiro process tree as a baseline. Find the Kiro main-window process at runtime (for example, `Get-Process` filtered on `MainWindowHandle`), and record its ProcessId (K), the exact filter used, and the process name observed. Do not hard-code the Kiro installation directory. Record every process in K's descendant tree with ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine, and CreationDate, using `Get-CimInstance Win32_Process` (read-only).
2. Connect the MCP server from Kiro. Record the tree again. Identify the process that actually launches the MCP server. It may not be K, because Kiro may place intermediary processes between K and the server. Record every new process with ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine, and CreationDate. Identify the server process by its command line (the production server contains `app.modules.mcp`; the probe contains its own identifier from Section 12.1). Also identify any base-interpreter child started by a venv launcher. Trace the ParentProcessId chain from each MCP-related process to the root and record every link.
3. Process identity is the pair (ProcessId, CreationDate), not the PID alone. A PID reused by a process with a different CreationDate is a different process. A chain that does not reach K is not a failure by itself. Record it as a process-tree limitation, together with the observed chain and the PIDs, CreationDates, and command lines needed to review it. Retain the raw output of steps 1 and 2.
4. EOF evidence. The passive harness (prerequisite 5) sits on the Kiro-to-server path. It records, with timestamps: (a) the end-of-stream event on its Kiro-facing input; (b) its closure of the server-facing input pipe; and (c) the server's exit time and exit code, where available. The harness forwards bytes unchanged and does not decode, normalize, re-encode, or otherwise alter them. Three levels of evidence must be kept distinct. (i) EOF observed by the harness on its Kiro-facing input (event a). (ii) Closure of the harness's server-facing pipe (event b). (iii) EOF actually observed by the server process on its stdin, which is the only evidence that the server received EOF. Events (a) and (b) do not, by themselves, prove (iii). Level (iii) requires the server-side instrumentation described in Section 12.1, or an equivalent direct observation that the owner authorizes. If level (iii) is not directly observed, the shutdown route is recorded as `UNVERIFIED`. The record must not state that EOF caused an exit unless level (iii) evidence supports that conclusion. A process that exits normally without level (iii) evidence is recorded with an `UNVERIFIED` shutdown route, which the outcome criteria in step 7 treat as PARTIAL, not PASS.
5. Disconnect the server from Kiro, or close Kiro, through a normal user action. Do not terminate any process with `Stop-Process`, `taskkill`, or similar commands during the observation. For every process in the tree recorded in steps 1 and 2, record how it ended, using these categories: exited on its own after EOF was observed by the server process on its stdin (level iii evidence); exited on its own by another normal route (state which, with evidence); still running after the timeout (forced termination required); or ended only by manual or tool-initiated termination. Record the elapsed time from the disconnect or close action until each process ended. Use a timeout of 10 seconds unless the owner sets another value.
6. Re-query each recorded (ProcessId, CreationDate) pair with `Get-CimInstance Win32_Process -Filter "ProcessId=<id>"`, and search for any process whose CommandLine identifies the MCP server.
7. Outcome:
   - **PASS:** every recorded MCP-related process terminates normally after disconnecting the server or closing Kiro, within the timeout, without forced termination, and its shutdown route is verified by level (iii) server-side EOF evidence from step 4.
   - **FAIL:** one or more recorded MCP-related processes remain alive and require forced termination.
   - **PARTIAL:** no orphaned MCP-related process remains, but a normal shutdown route could not be established or verified. This includes a normal exit without level (iii) server-side EOF evidence, and a process that ended with its parent without a recorded EOF exit.

Manual termination by the tester is not evidence of graceful cleanup. Any process ended that way is recorded as forced, and the outcome cannot be PASS. A global `Get-Process python` check may be recorded as supporting information. It is not the acceptance criterion.

Acceptance for D02 runtime closure: T1, T2, T4, T5, T7a, and T7b pass, and T10 is PASS. A T10 PARTIAL is recorded as a limitation that the owner must review. A T10 FAIL blocks closure. T7b must be a real Kiro tool call with the raw-byte evidence described above. T7a alone is never sufficient. T3 is recorded with its evidence or documented as a limitation. T6 is recorded. T8, T9, and T11 pass or are documented as limitations. T12 import checks pass, and a mismatch blocks closure. T13 outcome is recorded, or recorded as not run if the owner does not authorize it. D02 is not closed until these criteria are met and reviewed.

Failure handling:
- If T7b fails, do not change the SDK line. Record the failure and bring L2 and L17 to the human decision.
- If T2 or T5 fails with v2.3.0, re-run the same tests with `mcp==1.30.0` in a separate venv before deciding the fallback. Each run requires separate authorization. Note that v1.30.0 has the same CRLF output, so a T7b failure would repeat there.

---

## 13. Final gate recommendation

**Gate status**

| Item | Status |
|---|---|
| Documentary investigation | `ACCEPTED` |
| SDK candidate (`mcp==2.3.0`) | `RECOMMENDED, NOT APPROVED` |
| Kiro runtime compatibility (Kiro 1.4.121) | `NOT VERIFIED` |
| D02 overall | `IN PROGRESS` |
| MCP implementation | `NOT STARTED` |

Acceptance of the documentary investigation does not authorize package installation, virtual-environment creation, configuration changes, MCP implementation, or D03. D02 is not passed or closed while the Kiro runtime compatibility tests in Section 12 remain outstanding.

**Runtime compatibility with Kiro 1.4.121: NOT VERIFIED.**

Closure requirements. These mirror Section 12. All of them must be satisfied before D02 can be marked passed or closed:
- T1, T2, T4, T5, T7a, and T7b: PASS. T7b must be a real Kiro tool call with raw-byte evidence in both directions.
- T10: PASS. PARTIAL is a limitation that the owner reviews. FAIL blocks closure.
- T3: first inbound message captured and the revision identified, or the limitation documented.
- T6: result recorded.
- T8, T9, and T11: pass, or documented as limitations.
- T12: both import checks and the environment check pass. A mismatch blocks closure.
- T13: outcome recorded. If the owner does not authorize it, it is recorded as not run.

The temporary D02 test configuration (Section 12.2) and production MCP configuration (Architecture §12.2) have separate authorizations. Satisfying the closure requirements does not authorize production configuration.

What passes (documentation and recommendation only):
- The Kiro MCP configuration contract is documented: locations, schema, required fields, approval model, and error reporting (S-K1 to S-K6).
- STDIO is the specified and documented local transport, and it fits Sean's architecture (S-M1, Architecture §2.4).
- The SDK line recommendation is supported by upstream documentation and source code (Section 5 and Section 7).
- The configuration example is valid JSON (Section 9). It is not written anywhere.
- The Windows CRLF behavior is documented from source, with the upstream history (Section 4.3).

What is open:
- **The SDK's observed Windows wire output uses CR-LF terminators in both SDK lines, and no fix is merged in any release.** Three fix pull requests were closed without merging. The v2.3.0 Windows tests do not assert LF-only wire bytes. CR is permitted JSON whitespace (RFC 8259), so the open question is whether Kiro accepts CR-LF-delimited frames under the MCP framing rule, not whether the JSON is valid. Kiro's acceptance is unknown. This is the main open risk. It is decided by test T7b, not by the SDK line choice.
- Protocol revision used by Kiro (L1, L14).
- Process cleanup (L10).

Conditions. Conditions 1 to 4 gate D02 closure. Condition 6 gates production MCP configuration under Architecture §12.2. The temporary D02 test configuration (Section 12.2) is governed by its own separate owner authorization, not by condition 6:
1. **Human approval** of the provisional SDK candidate `mcp==2.3.0` for a runtime experiment. Fallback candidate `mcp==1.30.0`. Final selection after testing.
2. **Runtime verification** of tests T1, T2, T4, T5, T7a, T7b, and T10 with Kiro 1.4.121, using the disposable D02 compatibility probe (Section 12.1) under the temporary test configuration (Section 12.2), after separate owner authorization. The production entry point is not required for this step. This closes L2, L4, and L10, and informs L1 and L14.
3. **CRLF gate.** T7b must succeed, as a real Kiro tool call with raw-byte evidence. If it fails, the integration cannot proceed on either SDK line without a mitigation (M2, which needs its own review) or an upstream fix. That outcome would move D02 to BLOCKED.
4. **Human decision** on whether the host-launched child process meets Architecture §2.4 (L15). The production configuration-location decision (user or workspace, L16) is deferred to the production configuration gate and is not a D02 closure condition. The temporary test configuration location is governed by the explicit owner authorization in Section 12.2.
5. **Sandbox decision** on `mcpSandboxing` is deferred to the production security and configuration gate. It is not a D02 closure condition, because sandbox configuration is not needed to establish STDIO transport compatibility. T13 remains optional, and its outcome is recorded (see the closure requirements above).
6. **Production MCP configuration** must not be written until every requirement of Architecture §12.2 is satisfied: the production entry point exists, tool contracts are implemented, input validation is verified, security behavior is tested, read-only behavior is confirmed, and Windows host compatibility is verified. The temporary D02 test configuration does not satisfy or waive this condition, and does not authorize production configuration.

What is not decided by D02:
- Implementation of the MCP entry point or tools.
- Creation of the production Kiro MCP configuration (Architecture §12.2). The temporary D02 test configuration (Section 12.2) requires its own separate owner authorization and is not production configuration.
- Changes to Kiro permissions, steering, hooks, or sandbox settings.
- Any upstream action on issue #2433 (L18).
- D03 and later gates.

---

## 14. Runtime evidence from Kiro IDE 1.4.121

Evidence labels used in Sections 14 to 19:

| Label | Meaning |
|---|---|
| `OBS-KIRO` | Observed directly by the agent in a Kiro IDE session on 2026-11-10 (tool catalog entry, tool response). |
| `OBS-LOCAL` | Read-only observation of disk or process state, made while preparing this revision. |
| `OWNER` | Stated in the owner's task instruction. Not independently re-verified here. |
| `HARNESS` | Result of a local simulation with no Kiro involved. Never used as Kiro evidence. |

### 14.1 Probe retirement verification

| Check | Result | Label |
|---|---|---|
| Workspace file `.kiro/settings/mcp.json` | Does not exist (`Test-Path` returned `False`). No `sean-d02-probe` registration remains in any workspace file. This is stricter than the expected "empty `mcpServers`" and matches Architecture §12.2 and decision A24, which prohibit an empty placeholder configuration. | `OBS-LOCAL` |
| User-level `~/.kiro/settings/mcp.json` | Not inspected, by instruction. Whether a probe registration remains at user level is unknown. The file was open in the editor during this task. | not checked |
| Kiro MCP panel and tool catalog after retirement | Not re-checked. The Section 12.2 removal criterion ("Kiro no longer lists `sean-d02-probe`") is not verified. | not checked |
| Running probe or harness processes | A query for Python processes whose command line contains `sean_d02_probe_server` or `capture_harness` returned no rows. The tool output was partly garbled, so treat this as low confidence. | `OBS-LOCAL` |
| Probe files, reports, virtual environment | Retained, not deleted: probe at `%TEMP%\sean-d02-experiment\probe\sean_d02_probe_server.py` (2,331 bytes), experiment reports under `%TEMP%\sean-d02-experiment\`, and `backend\.venv`. | `OBS-LOCAL` |

Result: workspace retirement `VERIFIED`. Full retirement `NOT VERIFIED`, because the user-level file and the Kiro MCP views were not checked.

The owner states that the probe was registered through the workspace configuration. This session did not see that file or the MCP panel, so the registering level is `OWNER`-stated and not confirmed. An earlier attempt by the agent to create the workspace file was denied by a Kiro scope rule on `.kiro/settings/`. The agent did not create the file.

### 14.2 Functional evidence

| # | Observation | Label |
|---|---|---|
| 1 | Python 3.14.10 virtual environment at `backend\.venv`, created from `C:\Users\User\AppData\Local\Python\pythoncore-3.14-64\python.exe`. `pyvenv.cfg` has `include-system-site-packages = false`. Creation and its authorization are `OWNER`-stated. | `OBS-LOCAL`, `OWNER` |
| 2 | `mcp==2.3.0` is installed. `pip check` reported "No broken requirements found." with exit code 0 (run during this revision, with `PYTHONDONTWRITEBYTECODE=1`). | `OBS-LOCAL` |
| 3 | Kiro recognized the conventional workspace MCP configuration and registered `sean-d02-probe`. | `OWNER`, consistent with item 4 |
| 4 | Kiro exposed `sean-d02-probe::sean_d02_probe_status` in the agent's deferred tool catalog. Description: "Returns a fixed D02 probe marker. Read-only. Takes no arguments." Input schema: `{"type": "object", "properties": {}}`. | `OBS-KIRO` |
| 5 | The tool was invoked once with an empty argument object. Exact response: `SEAN-D02-PROBE-OK`. | `OBS-KIRO` |
| 6 | The tool result reported no error. No Kiro log was reviewed. | `OBS-KIRO` (absence of an error in the result only) |

The catalog identifier has the form `<server name>::<tool name>`. A production server named `sean` would therefore appear as `sean::search_history` and so on in this Kiro surface.

What the probe exercised (from the probe source, `OBS-LOCAL`): the SDK's `MCPServer` class and `ToolAnnotations` from `mcp_types`, STDIO transport through `server.run("stdio")`, one tool, a plain text result (`structured_output=False`), no arguments, launch by absolute interpreter path and absolute script path, and an `env` object containing only `PYTHONDONTWRITEBYTECODE=1`.

What it did not exercise: tool arguments, structured output, error results, large results, non-ASCII text, concurrent or long-running calls, cancellation, reconnect, import of Sean packages, and launch with `-m`.

### 14.3 Status against the Section 12 tests

Status words: `OBSERVED` (the full criterion was observed), `PARTIAL` (part of the criterion was observed), `NOT CAPTURED`, `NOT RUN`, `UNVERIFIED`. No row is `PASS`, because no Section 12 criterion was satisfied in full with its required evidence.

| Test | Status | Basis |
|---|---|---|
| T1 Configuration parsing | `PARTIAL` | The server was registered and its tool was exposed. The MCP panel and any JSON error state were not inspected. |
| T2 Startup | `PARTIAL` | A tool call succeeded, which implies a connected server. The panel status and the "Kiro - MCP Logs" output were not reviewed. |
| T3 First inbound message and revision | `NOT CAPTURED` | No capture harness was in the path. The protocol revision and the first method (`initialize` or `server/discover`) are unknown. L1 and L14 stay `NOT_VERIFIED`. |
| T4 Tool listing | `OBSERVED` for the agent-side catalog | Name, description, and schema were seen in the agent's catalog. Kiro's own tool-list UI was not viewed. |
| T5 Tool call with approval | `PARTIAL` | The fixed value was returned. Whether Kiro showed an approval prompt, and who answered it, was not observed. |
| T6 Stdout integrity | `NOT RUN` | The probe has no `print()` in its tool body. |
| T7a Raw SDK output bytes (no Kiro) | `NOT REVIEWED` here | Local harness material exists under `%TEMP%\sean-d02-experiment` (`verify_local.py`, `capture_harness.py`, reports, and a `local-crlf-client` capture directory). It is `HARNESS` evidence and was not re-read in this revision. T7a has no recorded result in this document. |
| T7b Real Kiro call with raw bytes in both directions | `PARTIAL`, not `PASS` | Criterion (a), a real Kiro tool call returning the expected value, is met. Criteria (b) and (c), passive raw-byte capture with exact terminators in both directions, are not met. Criterion (d), the result verbatim, is recorded in Section 14.2. Criterion (e) is not met in full: no error was seen in the result, but no matching Kiro MCP log excerpt exists. |
| T8 Bad configuration | `NOT RUN` | |
| T9 Reconnect | `NOT RUN` | |
| T10 Process cleanup | `UNVERIFIED` | The process-tree procedure was not run, and no level (iii) server-side EOF evidence exists. See Section 14.4. |
| T11 Untrusted-workspace behavior | `NOT RUN` | |
| T12 Environment and import resolution | `NOT RUN` | The probe was launched by script path, so `app.modules.mcp` resolution and `PYTHONPATH` delivery were not tested. |
| T13 Sandbox | `NOT RUN` | |

### 14.4 Shutdown indicator from the probe log

The probe writes `start` when it begins and `run_returned` when `server.run("stdio")` returns. Its source comment states that `run_returned` is an indirect signal and does not prove that the server saw EOF on stdin. The log at `%TEMP%\sean-d02-experiment\logs\probe.log` (last written 2026-11-10 04:31:51, read during this revision) contains 29 `start` lines and 27 `run_returned` lines. The two processes without a matching `run_returned` line are PIDs 33816 and 37200. The log mixes entries from local harness runs and any Kiro launches, and it carries no source label, so no entry can be attributed to the Kiro session. The probe's exception path writes an `exception type=` line, and none appears, so a missing `run_returned` is consistent with forced termination, with a process that was still running when the file was read, or with an exit that bypassed Python's normal return. This record does not choose between those explanations. It does not support a PASS or a FAIL for T10.

### 14.5 What the evidence supports and what it does not

Supported:
- Kiro 1.4.121 launched a STDIO Python server from the virtual environment by absolute path, listed one tool, and returned the tool's text result.
- The SDK's `MCPServer` and `ToolAnnotations` APIs exist in `mcp==2.3.0` and run under Python 3.14.10 on Windows.
- The installed dependency set has no declared-requirement conflicts (`pip check`).

Not supported, and not claimed:
- Which protocol revision or handshake Kiro used (T3, L1, L14).
- Whether Kiro accepted CR-LF-delimited frames from a Windows SDK server (L2). The SDK writes CR-LF on Windows by source reading (Section 4.3), and the call succeeded, which is consistent with Kiro tolerating that framing. Without raw bytes it is not proof that this run emitted CR-LF or that Kiro parsed it as such. L2 stays `NOT_VERIFIED`.
- Kiro's behavior with arguments, structured output, errors, large results, concurrency, cancellation, or reconnect.
- Server-side stdin EOF, orderly shutdown, or absence of orphan processes (L10).
- Behavior of any Sean module, import resolution, or the production launch form.
- Compatibility of other Kiro versions or other MCP clients.

---

## 15. Environment and dependency inventory

### 15.1 Observed state (`OBS-LOCAL`, 2026-11-10)

- Interpreter: Python 3.14.10 (`backend\.venv\Scripts\python.exe --version`).
- `pyvenv.cfg`: `include-system-site-packages = false`. It records the creation command `python.exe -m venv --without-pip`. `pip 26.2.2` is nevertheless installed, so pip was added after creation by a step this record does not document.
- `pip check`: "No broken requirements found." (exit code 0). This verifies that declared requirements of installed packages are mutually satisfied. It does not verify security, file integrity, or hashes.

Exact inventory from `python -m pip list --format=freeze`:

```text
annotated-types==0.8.0
anyio==4.16.0
attrs==26.1.0
cffi==2.1.1
click==8.5.1
cryptography==50.0.2
h11==0.16.0
httpcore2==2.16.0
httpx2==2.16.0
idna==3.20
jsonschema==4.26.0
jsonschema-specifications==2025.9.1
mcp==2.3.0
mcp-types==2.3.0
opentelemetry-api==1.45.2
pip==26.2.2
pycparser==3.12
pydantic==2.14.3
pydantic_core==2.50.4
PyJWT==2.15.1
python-multipart==0.0.33
pywin32==312
referencing==0.37.0
rpds-py==2026.9.1
sse-starlette==3.7.0
starlette==1.10.0
truststore==0.10.5
typing_extensions==4.16.0
typing-inspection==0.4.5
uvicorn==0.54.0
```

Reading notes:
- Only `mcp==2.3.0` is described as installed by request (`OWNER`). The other packages are resolver results. This revision did not trace each one to its parent requirement.
- This is an observed inventory, not a lock file. It has no hashes, and the D01 lock step has not run.
- `pydantic==2.14.3`, `pydantic_core==2.50.4`, and `uvicorn==0.54.0` equal the exact pins in D01. `pywin32==312` is above the D01 floor of 311. FastAPI, pytest, and Hypothesis are not installed.

### 15.2 Advisory-check results available, and their limits

| Source | Result | Limitation |
|---|---|---|
| D01 Section 6 (data of 2026-11-09) | `mcp` is clear at the floors `>=2.2.0` (2.x) and `>=1.30.0` (1.x). CVE-2026-39313 does not apply to the Python SDK. Advisories found for Pydantic and Uvicorn are older and were fixed in earlier versions. | Queries were filtered by package name. D01 states that coverage is not proven complete. The data is one day older than this revision. |
| Experiment reports and README under `%TEMP%\sean-d02-experiment` | Searched for advisory or audit output in the README, the remediation report, and `env_discovery.out.txt`. None found. | Other files in that folder were not searched. |
| Fresh review required by D01 "Conditions that must be satisfied before installation", item 1 | No result located. | The installation has already happened, so this review is outstanding, not satisfied. |
| Packages in the inventory other than `mcp`, `pydantic`, `pydantic_core`, and `uvicorn` | No advisory result in this record for `cryptography`, `PyJWT`, `starlette`, `sse-starlette`, `python-multipart`, `httpx2`, `httpcore2`, `opentelemetry-api`, `anyio`, `jsonschema`, `pywin32`, `truststore`, and the remaining transitive packages. | Not checked. No audit tool (`pip-audit`, OSV) is installed in the environment, and none was run. |

### 15.3 Limitations

- The environment evidence shows that the set installs and is internally consistent on this machine. It does not show that the set is secure or reproducible.
- Reproducibility needs the lock step with hashes, which D01 leaves pending.
- The overlap between `mcp 2.3.0`'s transitive `starlette==1.10.0` and the `starlette` range that the approved FastAPI version requires was not checked, because FastAPI is not installed. It must be checked at the lock step (Section 18.4).

---

## 16. Production MCP contract (PROPOSED)

### 16.1 Status and authority

This section is a proposal for human review. It is not approved, it does not amend Spec 1 or the Architecture, and it authorizes no implementation. Spec 1 §12 requires that "the exact schemas, required fields, validation rules, error behavior, and transport configuration" be "defined and tested during implementation". This section supplies the definition for review. Where it adds a field or behavior that the approved documents do not state, the item is marked as a decision in Section 19.

Authority order if documents disagree: Spec 1 (§10, §12, §13), Architecture (§2.3, §2.4, §5, §12, §18), then this section. Stop and report any conflict. The Architecture §12.2 gate stays closed. Nothing in this section authorizes creating Sean's MCP configuration in Kiro.

The tool set is exactly the four conceptual tools in Spec 1 §12. This contract adds no tool, no resource, no prompt, no sampling or elicitation use, and no task API. The server uses only `tools/list` and `tools/call`.

### 16.2 Responsibility and boundaries

The Sean MCP server is a thin STDIO adapter in the existing `mcp` backend module (Architecture §7 and §12). It does three things per call: validate and convert the tool input, call the same application logic that the HTTP API calls, and serialize the result.

It must not:
- Contain retrieval, ranking, classification, or explanation logic, or a second Git or GitHub client.
- Import the FastAPI application object, or start or call the HTTP server.
- Run as a separate persistent service, open a network port, or call any AI provider.
- Define evidence or result models that the `api` module would have to import from `mcp`.

### 16.3 Transport and lifecycle

| Aspect | Contract | Verification state |
|---|---|---|
| Transport | STDIO, launched by Kiro as a child process (Spec 1 §12, Architecture §12). | A STDIO launch and one tool call were observed with the probe (Section 14). |
| SDK | `mcp==2.3.0`, `MCPServer`, `server.run("stdio")`. | Same API observed running in the probe. |
| Features | Tools only. Output is a text content block carrying the JSON-serialized envelope. | Text results observed. Structured output is undecided (DEC-5). |
| Startup | Import only the modules the tools need. No FastAPI import, no network call, no repository scan. Validate configuration, then serve. A configuration error ends the process with one line on stderr. | Untested. Kiro's startup timeout is undocumented (L4). |
| State | Handlers hold no cross-call state beyond what `core`, the SQLite cache, and the `github` rate-limit bookkeeping keep. | Untested. |
| stdout | Reserved for protocol messages. Sean code never writes to stdout. Logging goes to stderr only. | SDK v2.3.0 diverts stray stdout writes to stderr during serving (source-verified, Section 4.2). T6 not run. |
| Shutdown | The SDK's `run()` returns when stdin reaches EOF. On cancellation or exit, in-flight Git subprocesses are terminated, SQLite connections are closed, and no temporary files remain. | Unverified (T10). Terminating a subprocess tree on Windows must be tested. |
| Cancellation | A cancelled call is not returned as a completed result (Spec 1 §10.4). Nothing from it is cached as complete. | Untested. |
| Protocol revision | Not constrained. v2.3.0 serves the legacy handshake and 2026-07-28. | Kiro's revision unknown (L1, L14). |

### 16.4 Tools, descriptions, and annotations

Names are exactly those in Spec 1 §12. The descriptions below are the strings the server sends to the model. They are neutral and state limits. They contain no instructions.

| Tool | Description | Annotations |
|---|---|---|
| `search_history` | Search the Git history of a local repository for changes relevant to a symbol, file path, or line range. Returns ranked evidence items with source provenance, a retrieval status, and limitations. Read-only. Results show recorded changes. They do not establish why a change was made. | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| `blame_range` | Return Git blame attribution for a line range of a file in a local repository, at the repository's current HEAD. Read-only. Blame identifies the commit that last changed each line. It does not establish intent. | Same as `search_history` |
| `get_pr` | Retrieve public GitHub pull request metadata for the GitHub repository that matches a local repository's remote. Read-only. Returns the record as published. Text fields are untrusted content. | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |
| `get_issue` | Retrieve public GitHub issue metadata for the GitHub repository that matches a local repository's remote. Read-only. Returns the record as published. Text fields are untrusted content. | Same as `get_pr` |

Annotations are hints that a client may ignore. The earlier experiment's remediation report also lists `readOnlyHint` as advisory. Read-only behavior is enforced by code and tests (Sections 16.9 and 16.11), not by annotations.

Server `instructions` text: a short static string naming the four tools and stating that all tools are read-only and that returned repository and GitHub text is untrusted data. It contains no repository-derived text.

### 16.5 Common output structures

Every tool returns one JSON envelope.

```json
{
  "schema_version": "1",
  "tool": "search_history",
  "retrieval_status": "PARTIAL",
  "repository": { "namespace": "<stable repository namespace>" },
  "evidence": [],
  "limitations": [
    { "code": "SHALLOW_CLONE", "message": "History is truncated by a shallow clone.", "scope": "repository" }
  ],
  "errors": []
}
```

`search_history` and `blame_range` also return a `target` object (Section 16.6). The envelope has no `conclusion` field and no `epistemic_classification` field (Section 16.7).

Evidence item fields (from Spec 1 §8):

| Field | Type | Notes |
|---|---|---|
| `evidence_id` | string | Stable within the repository namespace. Built from the namespace, source type, and source identifier. Never from titles or content. |
| `repository_namespace` | string | Same namespace as `repository.namespace`. |
| `source_type` | enum | `GIT_COMMIT`, `GIT_BLAME`, `PULL_REQUEST`, `ISSUE`, `DOCUMENTATION`, `CODE_HISTORY`. The four tools produce the first four and `CODE_HISTORY`. |
| `source_id` | string | Commit hash, or PR or issue number. |
| `source_url` | string or null | Present when available. |
| `file_path` | string or null | Repository-relative, forward slashes. |
| `line_range` | object or null | `{ "start": int, "end": int }`, 1-based, inclusive. |
| `author` | object or null | `{ "name": string }`. Author email is not returned (data minimization). |
| `timestamp` | string or null | ISO 8601, UTC. |
| `title` | string or null | Untrusted content. |
| `excerpt` | string or null | Untrusted content. Bounded length. |
| `retrieval_method` | string | Names the operation, for example a `git log` mode, `git blame`, or the GitHub REST resource. |
| `integrity` | object | `retrieved_at`, `served_from_cache` (bool), `cache_age_seconds` (int or null), `verified_in_repository` (bool or null; true when a commit hash was confirmed to exist in the repository). |
| `unavailable_fields` | array of string | Fields whose value could not be retrieved. A null field that is not listed means verified absent or not applicable. This keeps unavailable metadata distinct from verified absence (Spec 1 §8). |
| `relationship_to_target` | object or null | `{ "kind": string, "detail": string or null }`. The `evidence` module defines the kinds. The MCP layer passes them through. |
| `ranking` | object or null | `{ "rank": int, "score": number, "criteria": [ { "name", "weight", "awarded" } ] }` for `search_history`. Null for unranked tools. |
| `untrusted_fields` | array of string | Names of fields that hold repository or GitHub text, for example `["title", "excerpt"]`. |
| `limitations` | array | Item-level limitations. |

Limitation object: `{ "code": string, "message": string, "scope": "repository" or "target" or "retrieval" or "evidence_item", "evidence_id": string or absent }`.

Error object: `{ "code": string, "message": string, "retryable": bool, "field": string or absent }`. Messages never contain stack traces, environment values, tokens, or absolute local paths.

Error and limitation codes (initial set): `INVALID_INPUT`, `REPOSITORY_NOT_FOUND`, `REPOSITORY_NOT_ALLOWED`, `PATH_OUTSIDE_REPOSITORY`, `PATH_NOT_FOUND`, `TARGET_AMBIGUOUS`, `TARGET_NOT_IN_CURRENT_STATE`, `SHALLOW_CLONE`, `NO_EVIDENCE_FOUND`, `RESULT_LIMIT_REACHED`, `TEXT_TRUNCATED`, `UNCOMMITTED_LINES`, `GIT_UNAVAILABLE`, `GIT_TIMEOUT`, `OUTPUT_LIMIT_EXCEEDED`, `GITHUB_IDENTITY_UNRESOLVED`, `GITHUB_NOT_FOUND_OR_INACCESSIBLE`, `GITHUB_RATE_LIMITED`, `GITHUB_UNAVAILABLE`, `STALE_CACHE_SERVED`, `INTERNAL_ERROR`.

### 16.6 Tool inputs and outputs

All inputs use `additionalProperties: false`. The numeric and length limits below are initial values for review. They are not validated, and they must be set from configuration in `core` and calibrated (Spec 1 §21 and §22).

**`search_history`**

| Field | Type | Required | Validation |
|---|---|---|---|
| `repository_path` | string | yes | Absolute local directory. Resolved with symlink and junction resolution. Must identify a Git repository. If a repository allowlist is configured (DEC-3), the resolved root must be inside an allowed root. Length at most 1,024. |
| `path` | string | one of `path` or `symbol` | Repository-relative. Slash styles are normalized. Rejected: absolute paths, drive letters, UNC paths, `..` segments after normalization, NUL or control characters, alternate data stream syntax (`name:stream`), reserved device names, and segments with trailing dots or spaces. Containment is checked on resolved paths, not by string prefix. A path that no longer exists in the working tree is allowed, because history may refer to deleted files. |
| `symbol` | string | one of `path` or `symbol` | 1 to 256 characters, no control characters or newlines. Treated as data and never placed in a shell string or an option position. The backend decides whether it is matched as a fixed string or a pattern. Pattern matching needs a timeout and tests. |
| `line_start`, `line_end` | integer | both or neither; require `path` | 1-based, inclusive, start at most end, span at most 2,000 lines. |
| `max_results` | integer | no | Default 20, range 1 to 50. |

Output: envelope plus `target`: `{ "resolution": "RESOLVED" or "AMBIGUOUS" or "UNRESOLVED", "path", "symbol", "line_range", "candidates": [] }`. `evidence` holds `GIT_COMMIT` and `CODE_HISTORY` items in rank order. Ties are broken deterministically by the `evidence` module (Spec 1 §9). A repository, path, or symbol that cannot be validated gives `FAILED`.

**`blame_range`**

| Field | Type | Required | Validation |
|---|---|---|---|
| `repository_path` | string | yes | Same as above. |
| `path` | string | yes | Same path rules. The file must exist at HEAD. |
| `line_start`, `line_end` | integer | yes | 1-based, inclusive, start at most end, span at most 500 lines, within the file's length. |

Blame runs against HEAD. There is no revision parameter in the MVP, which keeps the validation surface small. Output: envelope plus `target` (`path`, `line_range`). `evidence` holds one `GIT_BLAME` item per contiguous attribution group, ordered by `line_start`, with `ranking: null`. Lines with no commit yet produce an `UNCOMMITTED_LINES` limitation and no invented commit.

**`get_pr` and `get_issue`**

| Field | Type | Required | Validation |
|---|---|---|---|
| `repository_path` | string | yes | Same as above. The GitHub owner and name are resolved from the repository's remote configuration by the `repository` and `github` modules (DEC-4). If they cannot be resolved, the result is `GITHUB_IDENTITY_UNRESOLVED`. |
| `number` | integer | yes | 1 to 2,147,483,647. |

Output: envelope with at most one evidence item (`PULL_REQUEST` or `ISSUE`), `ranking: null`. PR fields: number, title, bounded description excerpt, author, created, merged, and closed timestamps, merge status, merge commit, and source URL. Issue fields are the equivalent subset. `get_issue` rejects a number that identifies a pull request. The tools do not link a PR or issue to a commit. Spec 1 §7 states that a commit reference and a PR reference do not establish the same fact.

### 16.7 Retrieval status and epistemic classification

Retrieval status values and meanings are those in Spec 1 §10.2. In these tools:

| `retrieval_status` | Used when |
|---|---|
| `COMPLETE` | All planned retrieval operations finished and at least one evidence item was returned. Hitting the result limit still counts as `COMPLETE`, with a `RESULT_LIMIT_REACHED` limitation. `COMPLETE` does not claim that every historical source was found. |
| `PARTIAL` | Some operations failed, timed out, or returned incomplete data, or the history is known to be incomplete (for example a shallow clone), or the target is ambiguous (DEC-2), or a stale cached record was served after a live request failed. Limitations name what is missing. |
| `INSUFFICIENT` | All planned operations finished and returned no evidence (`NO_EVIDENCE_FOUND`). This does not mean that no history exists. |
| `FAILED` | A blocking error prevented a meaningful result. `evidence` is empty. |

Epistemic classification (`DOCUMENTED`, `INFERRED`, `PARTIAL_EVIDENCE`, `INSUFFICIENT_EVIDENCE`) belongs to an investigation result (Spec 1 §10.1 and §10.3). These four tools return evidence, not a classified investigation. They therefore return no `epistemic_classification` and no conclusion. The envelope uses only the name `retrieval_status`. No tool output uses a classification value as a retrieval status, and none treats a retrieval status as a classification. Whether `search_history` should instead delegate to investigation orchestration and return the full §10.3 result is DEC-1. This proposal chooses the narrower reading because Spec 1 §12 describes the tool as returning "ranked evidence with provenance".

The consistency rules in Spec 1 §10.4 apply to what the shared application logic returns. The MCP layer checks that its envelope is consistent before returning it: `FAILED` has no evidence, `PARTIAL` and `INSUFFICIENT` have at least one limitation, and there is no classification field. An inconsistent result becomes `FAILED` with `INTERNAL_ERROR`. The layer never edits a status silently.

### 16.8 Behavior when evidence is incomplete, unavailable, or retrieval fails

| Situation | `retrieval_status` | Evidence | Limitations and errors |
|---|---|---|---|
| Input fails Sean validation | `FAILED` | none | `INVALID_INPUT` with `field`. |
| Input fails the SDK's schema validation before the handler runs | not under Sean's control | none | The response shape is SDK-defined and `NOT_VERIFIED` (DEC-5). Tests must record it. |
| Repository missing, not a Git repository, or not allowed | `FAILED` | none | `REPOSITORY_NOT_FOUND` or `REPOSITORY_NOT_ALLOWED`. |
| Path escapes the repository | `FAILED` | none | `PATH_OUTSIDE_REPOSITORY`. No detail about what exists outside. |
| Target ambiguous | `PARTIAL` (DEC-2) | none | `TARGET_AMBIGUOUS`, with candidates in `target.candidates`. No candidate is selected silently. |
| Symbol or path absent from the current state | per results | per results | `TARGET_NOT_IN_CURRENT_STATE`. The search continues, because a current location is not the historical location (Spec 1 §5). |
| Shallow clone | at most `PARTIAL` | per results | `SHALLOW_CLONE`. |
| Git operation times out or exceeds the output bound | `PARTIAL` if other operations yielded evidence, otherwise `FAILED` | partial | `GIT_TIMEOUT` or `OUTPUT_LIMIT_EXCEEDED`, `retryable: true` for the timeout. |
| All operations finish, nothing found | `INSUFFICIENT` | none | `NO_EVIDENCE_FOUND`, with text that states it is not proof of absence. |
| Result limit reached | `COMPLETE` | first `max_results` by rank | `RESULT_LIMIT_REACHED`. |
| Text cut to the length bound | unchanged | item present | `TEXT_TRUNCATED` at item scope. |
| `blame_range` on lines with no commit | `COMPLETE` | committed groups only | `UNCOMMITTED_LINES`. |
| `blame_range` path missing at HEAD | `FAILED` | none | `PATH_NOT_FOUND`. |
| GitHub returns 404 | `FAILED` | none | `GITHUB_NOT_FOUND_OR_INACCESSIBLE`. A 404 is also returned for inaccessible private records, so it is never reported as proof that the record does not exist (Spec 1 §7). |
| GitHub rate limit | `FAILED`, or `PARTIAL` with a cached record | none, or the cached item | `GITHUB_RATE_LIMITED`, `retryable: true`, and the retry time if GitHub provides one. A cached item carries `served_from_cache: true`, its age, and `STALE_CACHE_SERVED`. |
| GitHub network failure or timeout | `FAILED` (or `PARTIAL` with a cached record, as above) | none | `GITHUB_UNAVAILABLE`, `retryable: true`. |
| GitHub identity cannot be resolved from the remote | `FAILED` | none | `GITHUB_IDENTITY_UNRESOLVED`. |
| Unexpected exception or inconsistent result | `FAILED` | none | `INTERNAL_ERROR`. Details go to the stderr log, bounded and without secrets. |
| Call cancelled by the client | no completed result | none | Subprocesses terminated. Nothing cached as complete. |
| No AI provider configured | no effect | no effect | The tools never call an AI provider. |

A failed retrieval never carries a classification or a conclusion. Missing metadata is listed in `unavailable_fields` and is never replaced by a default.

### 16.9 Read-only guarantees and security restrictions

1. No tool writes, commits, pushes, rewrites history, changes repository configuration, or changes the index or working tree (Spec 1 §12 and §13). No tool accepts a command, a free-form Git argument, or a revision expression from input.
2. `git_history` exposes an explicit allowlist of read-only Git operations. Nothing else is reachable from MCP input.
3. Subprocesses use argument arrays and no shell, with an explicit working directory, a controlled environment, a timeout, and bounded captured output (Spec 1 §13). Inputs that begin with `-` cannot become options.
4. Repository configuration is untrusted. The implementation must neutralize settings that can launch programs (for example a filesystem monitor, external diff, textconv drivers, or credential and SSH helpers) through command-line overrides and read-only options such as `--no-ext-diff` and `--no-textconv`, and it must never run Git operations that fetch, write, or run hooks. The exact option set must be verified against the installed Git in the implementation task.
5. Path containment uses resolved paths and covers symbolic links and Windows junctions.
6. Network access is limited to the GitHub REST API over HTTPS with a request timeout, a response size bound, and rate-limit handling. No redirect to another host is followed. No credentials are needed for public repositories. An optional token comes from the environment, is never logged or returned, and is never placed in Kiro's configuration file.
7. Commit messages, PR and issue text, comments, and documentation are untrusted data. They appear only in fields listed in `untrusted_fields`, are length-bounded, and are never used in server-authored text such as descriptions, `instructions`, error messages, or limitation messages. A downstream model can still follow instructions embedded in such text. Per-call approval, narrow tools, and read-only operation limit what that could do. They do not remove the risk.
8. stdout carries only protocol messages. Logs go to stderr, use bounded size, and contain no tokens, full environment, or unnecessary repository content (Spec 1 §20, Architecture §18).
9. `autoApprove` stays empty (Section 17), so each call needs user approval.

### 16.10 Relationship to existing backend modules

The MCP handler calls shared application functions that the HTTP API also calls. Request and result models live in the owning modules, so `api` never imports from `mcp`. Function and model names below are illustrative and not binding.

| Tool | Modules used | Responsibility kept outside `mcp` |
|---|---|---|
| `search_history` | `repository`, `symbol_resolution`, `git_history`, `evidence`, `investigation` | Repository identity and path safety, target resolution and ambiguity, history retrieval, evidence normalization and ranking, retrieval status. |
| `blame_range` | `repository`, `git_history`, `evidence` | Repository identity and path safety, blame retrieval, evidence normalization. |
| `get_pr`, `get_issue` | `repository`, `github` (including its SQLite cache) | Remote-based GitHub identity, validation against repository identity, rate limits, caching, record retrieval. |

`mcp` itself holds the tool definitions, the input and output serialization, the STDIO entry point, and logging setup. It adds no abstraction layer beyond plain functions. The `explanation` module is not used by these tools. If the HTTP routes for these operations do not exist yet when the MCP handlers are written, the shared function still belongs in the domain modules, not in `mcp`.

### 16.11 Tool-level tests and acceptance criteria

All tests run with pytest, and property tests use Hypothesis (Spec 1 §18). A test counts as passing only after it has been executed and its result observed. Golden tests are separate and depend on D03 and D04.

| ID | Test | Acceptance criterion |
|---|---|---|
| MCP-01 | Tool registry | Exactly the four tools exist, with the names, descriptions, annotations, and input schemas in this section. Every input schema has `additionalProperties: false`. No write-capable tool exists. |
| MCP-02 | Input validation | Each rule in Section 16.6 is rejected on violation: missing, extra, wrong-type, and out-of-range values, `path` and `symbol` both absent, and a line range without a path. Responses use the structured error shape. The shape produced by SDK-level validation failures is recorded. |
| MCP-03 | Path containment | Traversal, absolute paths, drive-letter and UNC paths, alternate data stream syntax, reserved device names, trailing dots and spaces, 8.3 short names, case differences, symbolic links, and junctions that leave the repository are all rejected. Property tests cover path normalization. |
| MCP-04 | Option injection | `path` and `symbol` values starting with `-` or containing option-like text never change Git's arguments. Arguments are asserted on the recorded argument array. |
| MCP-05 | Read-only | A snapshot of refs, index, configuration, and working tree is identical before and after each tool call. |
| MCP-06 | No repository-controlled execution | A fixture repository with a hook and with configuration that points a filesystem monitor, external diff, and textconv driver at a marker-writing script. After every tool, the marker does not exist. |
| MCP-07 | Subprocess limits | Timeouts and the output bound are enforced with a deliberately slow or verbose Git stand-in. The environment passed to Git contains no inherited secrets. |
| MCP-08 | Retrieval status cases | Every row of Section 16.8 produces the stated status, evidence, and codes. A shallow-clone fixture never yields `COMPLETE` without `SHALLOW_CLONE`. |
| MCP-09 | Status and classification separation | No output contains `epistemic_classification` or a conclusion. No `retrieval_status` value is a classification value. `FAILED` always has empty evidence. |
| MCP-10 | Determinism | Identical repository state, input, and configuration produce identical ordering and content (Hypothesis). |
| MCP-11 | Provenance | Every `GIT_COMMIT`, `CODE_HISTORY`, and `GIT_BLAME` item names a commit hash that exists in the repository. No item is fabricated. Evidence identifiers are stable within a namespace and differ across repositories. |
| MCP-12 | Untrusted content | Commit messages and mocked PR and issue text containing instruction-like strings appear only in fields named by `untrusted_fields`. Server-authored fields are unchanged. Length bounds hold. |
| MCP-13 | GitHub behavior | Mocked responses for 200, 404, rate limit, timeout, malformed body, an oversized body, and a PR number passed to `get_issue`. No token appears in output, logs, or errors. Stale cache is flagged. |
| MCP-14 | Stdout integrity | The entry point runs as a subprocess under a byte-exact STDIO harness. All stdout bytes are protocol messages, including when handler code calls `print()`. stderr holds only bounded log lines with no secrets. |
| MCP-15 | No-AI operation | All tools work with no AI configuration or credentials. |
| MCP-16 | API equivalence | For the same inputs, the MCP tool and the corresponding shared function return equivalent core results. No retrieval or ranking logic exists in `mcp`, which is checked by dependency inspection. |
| MCP-17 | Lifecycle | Startup completes without network access. The process exits when stdin closes. In-flight subprocesses are terminated on exit and on cancellation, including child processes on Windows. |
| MCP-18 | Kiro integration (after MCP-01 to MCP-17 pass) | Under Kiro 1.4.121 on Windows, the four tools are listed, each call prompts for approval, and a real call round-trips. Raw bytes and shutdown follow the T7b and T10 requirements in Section 12. This is the Architecture §12.2 item "Windows host compatibility is verified". |

Acceptance for the contract: MCP-01 to MCP-18 pass, and the Spec 1 §23 items for read-only access, provenance, path containment, subprocess safety, status separation, and MCP reuse (items 8 and 14 to 19) are covered by executed tests.

---

## 17. Production configuration design

### 17.1 Status

This is a design. It writes no file. Architecture §12.2 and decision A24 prohibit creating Sean's MCP configuration in Kiro until the entry point exists, the tool contracts are implemented, input validation, security behavior, and read-only behavior are tested, and Windows host compatibility is verified. The temporary probe registration did not satisfy or waive that gate.

### 17.2 Evaluation

| Topic | Options | Evidence | Recommendation |
|---|---|---|---|
| Configuration level | Workspace `.kiro/settings/mcp.json`; user `~/.kiro/settings/mcp.json`. | Kiro documents both and merges them with workspace precedence (S-K1). Both need absolute Windows paths here, because no relative form is documented. A workspace file is committed unless ignored, and `.gitignore` does not ignore it. Architecture §14 says not to commit machine-specific settings. | User level for the MVP, set up per developer by a documented step. This avoids committing machine paths. The cost is that the server is listed in every workspace of that user. A workspace file becomes reasonable only if a portable form is verified, or if the file is ignored (DEC-7). |
| Interpreter | Absolute venv `python.exe`; `py` launcher; bare `python`. | An absolute venv interpreter path launched the probe under Kiro (Section 14). `py` picks the system default, and a bare name depends on PATH, which Kiro's launch environment may not match (Section 6.2). | Absolute path to `backend\.venv\Scripts\python.exe`. Machine-specific. |
| Backend module resolution | `-m app.modules.mcp` with `PYTHONPATH` set to the backend directory; run a script by path; install the backend into the venv as a package; wrapper launcher. | `-m` gives the same import resolution as the rest of the backend (Section 8.1). Running a script by path still needs `PYTHONPATH` for `app.*` imports. A package install needs a packaging manifest that is not authorized. The launch directory is undocumented, so the current-directory entry on `sys.path` must not be relied on. | `-P -m app.modules.mcp` with `PYTHONPATH` set. `-P` removes the working-directory entry from `sys.path` (S-P2), so the SDK's `mcp` package cannot be shadowed by a local `mcp` folder. Do not use `-I`, because it ignores `PYTHONPATH`. Unverified until T12 is run against the real module (DEC-8). |
| Launcher | Wrapper script or console entry point. | A launcher adds a file, a place for logic, and a second process hop. It is justified only if `PYTHONPATH` delivery or module resolution fails under Kiro. | Not necessary on current evidence. Do not add one. If T12 fails, the first fallback is a minimal `__main__` inside the `mcp` module that fixes `sys.path`, not a separate script. |
| Environment variables | `PYTHONPATH`; `PYTHONDONTWRITEBYTECODE`; token; Sean settings. | Kiro supports an `env` object and `${VAR}` references to approved variables, and does not load project `.env` files (S-K1, S-K4). The probe's `env` was accepted. Delivery to the child was not tested. | `PYTHONPATH` (required, absolute, machine-specific). `PYTHONDONTWRITEBYTECODE=1` (optional, keeps bytecode out of the source tree). A GitHub token only through an approved `${VAR}` reference and never as a literal. Variable names for the token, repository roots, and data location are not defined by any approved document (DEC-9). |
| stdout and stderr | Protocol on stdout, logs on stderr. | SDK v2.3.0 diverts stray stdout to stderr while serving (source-verified). Kiro shows stderr in its MCP logs (S-K1). | Contract in Section 16.3. No Sean code imports the FastAPI app, which could log to stdout. The `core` logging setup must allow a stderr-only mode. |
| Approval and defaults | `autoApprove`, `disabledTools`, `permissions.yaml` rules, `mcpSandboxing`. | `autoApprove: []` was accepted. Per-call approval is Kiro's documented default (S-K3). Whether `mcpSandboxing` wraps stdio servers on Windows is undocumented (L8). Architecture §14 forbids inventing a workspace `permissions.yaml`. | `autoApprove: []`, no `disabledTools` at first, no permission rules from this document. Treat the sandbox as optional hardening that is not relied on. |
| Read-only access | Configuration or code. | Kiro configuration cannot restrict what the process does. | Enforced by the code and tests in Sections 16.9 and 16.11. |

### 17.3 Property verification

| Property | Kiro documentation | Observed | Status |
|---|---|---|---|
| Top-level `mcpServers` | Yes (S-K1) | Probe registered | Verified |
| `command`, absolute path to venv `python.exe` | Yes, required | Probe launched this way | Verified |
| `args` as an array | Yes | Probe launched with a script-path argument | Verified for array form. The values `-P -m app.modules.mcp` are unverified, because the module does not exist. |
| `env` object | Yes | Accepted in the probe configuration | Accepted. Delivery of values to the child is unverified. |
| `autoApprove: []` | Yes | Accepted in the probe configuration | Accepted. Prompt behavior not observed. |
| `disabled`, `disabledTools` | Yes | Not exercised | Documented only |
| `${VAR}` expansion with approval popup | Yes | Not exercised | Documented only |
| `cwd`, `timeout`, `type`, `transport` | No | Not used | Not supported, do not use |
| Relative `command`, workspace-folder variables | No | Not used | Not supported, do not use |
| Server name `sean` | Free-form key | Not exercised | A same-name entry at another level would override this one (S-K1) |

### 17.4 Configuration template

**TEMPLATE ONLY. NOT ACTIVE. DO NOT INSTALL.** Do not create this configuration before every Architecture §12.2 requirement is met. Property names are verified as shown in Section 17.3. The values for `args` and `PYTHONPATH` are unverified and need T12 against the real `app.modules.mcp`. Replace `<CLONE>` with the absolute path of your clone. It must not point to the temporary probe or any file under `%TEMP%`.

```json
{
  "mcpServers": {
    "sean": {
      "command": "<CLONE>\\backend\\.venv\\Scripts\\python.exe",
      "args": ["-P", "-m", "app.modules.mcp"],
      "env": {
        "PYTHONPATH": "<CLONE>\\backend",
        "PYTHONDONTWRITEBYTECODE": "1"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Portable parts: the server name, `args`, the variable names, `disabled`, and `autoApprove`. Machine-specific parts: the interpreter path, the `PYTHONPATH` value, and any repository root or data location setting.

### 17.5 Developer setup outline (for the future setup document)

1. Clone the repository and create the backend virtual environment with `py -3.14 -m venv .venv` in `backend` (D01 supersedes the Architecture §16.1 command).
2. Install the pinned backend dependencies from the lock file once the lock step exists.
3. In Kiro, run "Kiro: Open user MCP config (JSON)", add the `sean` entry from the template with your clone path, and save. Saving reconnects the servers (S-K1).
4. Confirm that the MCP view lists `sean` with its four tools, and that the MCP logs show no launch error.

### 17.6 Unresolved compatibility details

- Delivery of `env` values to the child process, and the launch working directory (T12).
- Resolution of `app.modules.mcp` and non-shadowing of the SDK's `mcp` package under `-P` (T12).
- Whether Kiro's startup window is long enough for the real module's imports (L4).
- Whether a same-name entry at both levels merges by field or overrides completely (L7). The documentation shows complete override.
- Whether `mcpSandboxing` applies on Windows (L8).
- Paths with spaces or non-ASCII characters (L11).

---

## 18. SDK version decision

### 18.1 Four separate questions

| Question | Evidence | Status |
|---|---|---|
| SDK package compatibility | `mcp==2.3.0` installs on Python 3.14.10 on Windows, `pip check` is clean, MIT license (D01), `MCPServer` and `ToolAnnotations` APIs run. Advisory position: clear at the floor for `mcp`, with the limits in Section 15.2. | Compatible on this machine. Security review of the transitive set is outstanding. |
| Kiro functional interoperability | One tool call with no arguments and a text result succeeded under Kiro 1.4.121 (Section 14). | Observed for that case only. Not shown for arguments, structured output, errors, or large results. |
| Protocol and transport | No capture of the handshake, revision, framing, or terminators. The SDK writes CR-LF on Windows (source-verified, no fix merged). | `NOT VERIFIED` (T3, T7b, L1, L2, L14). |
| Remaining lifecycle limitations | No process-tree record, no server-side EOF evidence, ambiguous probe log. | `NOT VERIFIED` (T10, L10). |

### 18.2 Recommendation

Recommend that the owner approve the exact pin `mcp==2.3.0` as the SDK for Sean's planned implementation. The approval would rest on these points:
- It is the only SDK version that has been run under Kiro 1.4.121 here. `mcp==1.30.0` has not been run.
- v2 is the stable line, serves every protocol revision that v1 serves plus 2026-07-28, and diverts stray stdout during serving (Section 7.2).
- Falling back to 1.30.0 would not remove the CR-LF behavior (Section 4.4, M4), so the pin choice does not decide the open framing question.
- Version selection is reversible while no Sean MCP code exists.

This approval does not close D02, and it does not satisfy the Architecture §12.2 gate. Conditions that stay attached to it:
1. Fresh advisory review of the whole locked set at the lock step (D01 condition 1, Section 15.2).
2. T7b and T10 stay required for D02 closure. If T7b fails, the response in Section 12 (mitigation M2 or an upstream fix, owner decision) applies.
3. Any SDK version change repeats the Kiro tests.
4. Approval is the owner's decision. This record only recommends it.

### 18.3 D01 amendment

D01 needs an amendment. D01 was not modified. Proposed exact changes for the owner to apply:

| D01 location | Current text (summary) | Proposed change | Justification |
|---|---|---|---|
| Section 2, "Backend runtime" table, `mcp` row | "**Not selected.** See Section 4." / "Package approved; major line pending D02" | Version `2.3.0` (exact pin). Note: "Package approved. v2 line selected by D02. `mcp-types==2.3.0` is resolved through `mcp` and is not a direct dependency." | Records the selected pin in the same exact-pin form as the other Python packages. |
| Section 4, "MCP major version" row | "**Not selected.** Candidates: `>=2.3.0,<3` or `>=1.30.0,<2`" / "**Pending D02**" | "**Selected: v2 stable line, exact pin `mcp==2.3.0`.** `mcp==1.30.0` remains the fallback only if a Kiro test fails on 2.3.0." Status: "Approved by owner on `<date to be recorded by the owner>`". | Closes the open choice once the owner approves Section 18.2. |
| Section 4, "STDIO compatibility with Kiro 1.4.121" row | "Not verified" / "Pending D02" | "Partially observed: one probe tool call succeeded. Protocol revision, framing, line endings, and shutdown are not verified." Status: "Pending D02 closure". | Keeps D01 from implying that compatibility is proven. |
| Section 4, last sentence "Do not install `mcp` until D02 selects the line." | Instruction | Replace with: "`mcp==2.3.0` was installed in `backend/.venv` for the D02 experiment under owner authorization (date to be recorded by the owner). Changing the version requires repeating the D02 tests." | The installation has happened. The text should state that, so the record matches the environment. |
| Section 6, advisory table | MCP row says "Clear at `>=2.2.0` and `>=1.30.0`" | Add: "Transitive packages of `mcp==2.3.0` were not advisory-checked in D02. A fresh review of the full locked set is required at the lock step." | States the real coverage. |
| Section 2, "Locking approach" | Exact pins in `backend/requirements.txt`, file creation pending | Add: "The observed inventory in D02 Section 15.1 is not a lock file. The lock step must also confirm that `mcp==2.3.0`'s `starlette` requirement is compatible with the approved FastAPI version." | Prevents treating an inventory as a lock, and covers the unchecked overlap. |

D01 §7 and the D02 row in the D01 gate table stay `Pending`. Neither changes until D02 closes.

### 18.4 Items to check at the lock step

- `starlette==1.10.0` (pulled in by `mcp`) against the `starlette` range of the approved FastAPI version. Not checked.
- Hash-pinned lock file. None exists.
- `pywin32==312` against the D01 floor of 311 (observed to satisfy it).
- Advisories for every transitive package in Section 15.1.

---

## 19. Remaining acceptance criteria, decisions, and status

### 19.1 D02 closure criteria still unmet

| Criterion (Section 12 and 13) | Current state |
|---|---|
| T1, T2, T4, T5 `PASS` | T4 observed on the agent side. T1, T2, and T5 are partial. |
| T7a `PASS` | No reviewed result in this document. |
| T7b `PASS` with raw bytes in both directions | Partial. Captures (b) and (c) and a matching log (e) are missing. |
| T10 `PASS` (`PARTIAL` is an owner-reviewed limitation, `FAIL` blocks) | Unverified. Not run. |
| T3 captured or documented as a limitation | Documented as `NOT CAPTURED` here. L1 and L14 stay open. |
| T6 result recorded | Not run. |
| T8, T9, T11 pass or are documented as limitations | Not run. |
| T12 import and environment checks pass | Not run. |
| T13 outcome recorded | Not run. |
| Condition 1: owner approval of `mcp==2.3.0` | Recommended in Section 18.2. Pending. |
| Condition 4: owner decision on Architecture §2.4 (L15) | Pending. |
| Section 12.2 removal criterion (Kiro no longer lists the probe) | Workspace file absent. Kiro views and user level not checked. |

### 19.2 Decisions that need the owner

| ID | Decision |
|---|---|
| DEC-1 | Whether `search_history` returns evidence only (proposed) or delegates to investigation orchestration and returns the full Spec 1 §10.3 result with classification. |
| DEC-2 | Mapping of an ambiguous target to `PARTIAL` (proposed). |
| DEC-3 | Repository selection: any local Git repository named per call with per-call approval (proposed baseline), or a configured allowlist of roots (hardening). |
| DEC-4 | Resolving the GitHub owner and name from the repository's remote configuration. |
| DEC-5 | Text-only results (observed to work) versus structured output, and the SDK's shape for validation failures. Needs a Kiro test. |
| DEC-6 | Using one SQLite cache from both the API process and the MCP process. Depends on D06 and D07. |
| DEC-7 | User-level (proposed) versus workspace-level configuration, and whether to ignore the workspace file in `.gitignore`. |
| DEC-8 | `-P -m app.modules.mcp` with `PYTHONPATH`, to be confirmed by T12. |
| DEC-9 | Names for the optional GitHub token variable, repository roots, and data location. No approved document defines them. |
| DEC-10 | Initial limits and timeouts in Section 16.6, to be set in `core` and calibrated. |
| DEC-11 | Approval of `mcp==2.3.0` and the D01 amendment in Section 18.3. |
| DEC-12 | L15: whether a host-launched child process meets Architecture §2.4. |

### 19.3 Documents checked for conflicts

No change to an approved specification or architecture document is needed for this revision. Items to report:
- D01 Section 4 says "Do not install `mcp` until D02 selects the line", and the package is installed. Section 18.3 proposes the D01 correction.
- Section 12 prerequisites and Appendix A describe the environment as not yet created. Appendix A is marked as applying to the documentary revision, and Appendix B describes this revision.
- Spec 1 §12 leaves schemas to implementation. Section 16 is a proposal against that requirement and is not an approved schema.

### 19.4 Status

| Item | Status |
|---|---|
| D02 overall | `IN PROGRESS` |
| Kiro runtime compatibility, as defined by the Section 12 closure criteria | `NOT VERIFIED` |
| Production MCP contract | `PROPOSED, NOT APPROVED` |
| Production MCP configuration | `NOT CREATED, PROHIBITED` until Architecture §12.2 |
| MCP implementation | `NOT STARTED` |

This record does not claim that Phase 2 is complete or that Phase 3 can start. D03 to D08 and the Architecture and Spec 1 implementation gates remain open.

---

## Appendix A. Scope confirmation (documentary revision)

> This appendix describes the earlier documentary revision. It is kept as history. Appendix B describes the current revision.

- **Files created:** None in this revision.
- **Files modified:** This decision record only (`docs/development/d02-mcp-integration-decision-record.md`). The approved architecture, specification, and playbook documents were not changed.
- **Dependencies:** Nothing installed, upgraded, or removed. No virtual environment created.
- **Manifests and lockfiles:** None created or modified.
- **Kiro configuration:** Not created or modified. Kiro, its settings, permissions, steering, hooks, and sandbox were not changed.
- **Environment variables, PATH, Git:** Not changed.
- **Project code and scripts:** Not executed. No MCP server was started.
- **Network:** Read-only GET requests to kiro.dev, modelcontextprotocol.io, py.sdk.modelcontextprotocol.io, api.github.com, raw.githubusercontent.com, and docs.python.org, plus web searches. No package-manager commands were run.
- **Issue and pull requests:** Read only. No comment, label, or other change was posted upstream.
- **Gates:** D03, D04, D05, and implementation were not started.

---

## Appendix B. Scope confirmation (runtime-evidence and contract revision, 2026-11-10)

- **Files modified:** This decision record only (`docs/development/d02-mcp-integration-decision-record.md`).
- **Files created or deleted:** None. No probe, harness, report, configuration file, or virtual-environment file was created, modified, moved, or deleted.
- **Not modified:** D01, Spec 1, Spec 2, the Architecture document, the Playbook, the Operating Guide, `.gitignore`, any manifest or lock file, source code, tests, and Kiro settings or permissions at workspace and user level.
- **Commands run (read-only):** existence checks and file reads; a process query by command line; `python --version`; `python -m pip list --format=freeze --disable-pip-version-check`; `python -m pip check --disable-pip-version-check` (run with `PYTHONDONTWRITEBYTECODE=1`). No package was installed, upgraded, or removed. No audit scan was run. The repository Git state was not queried successfully in this revision, because the `git status` attempt timed out. This record does not rely on it.
- **Not inspected:** the user-level MCP configuration, the Kiro MCP panel, and Kiro's MCP logs.
- **Not executed:** the probe, any harness, and any MCP tool other than the single earlier probe invocation recorded in Section 14.2.
- **Sources added:** the approved Spec 1 (§5 to §14, §16 to §23), Architecture §12 and §14, D01 §2 to §7, the probe source file, the probe log, and the Kiro documentation page already cited as S-K1. No new web source was fetched in this revision.
- **Gates:** D02 stays `IN PROGRESS`. D03 to D08 and implementation were not started.
