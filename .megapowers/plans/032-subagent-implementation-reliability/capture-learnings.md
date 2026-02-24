## 2026-02-24 — 032-subagent-implementation-reliability

- When a jj workspace has a different `cwd` than the project root, satellite sessions need `MEGA_PROJECT_ROOT` passed via environment to locate `state.json` — relying on `ctx.cwd` in satellite handlers silently disables TDD enforcement.
- Subprocess timeout handlers should only kill the process and set a flag — never do cleanup directly. Let the `close` event always run cleanup, or you risk a race where the workspace is forgotten before the process finishes writing.
- Detecting test results from bash output requires gating on the *command*, not just the output — `grep` results containing "pass"/"fail" strings will cause false positives without an `isTestCommand()` check correlated via `toolCallId`.
- When passing long prompts to child CLI processes, write to a file and pass as `@path` rather than inline — OS argument length limits silently truncate inline arguments above ~100KB.
- YAML frontmatter `tools:` arrays have three valid forms (inline `[a, b]`, comma-separated, multiline `- item`) — a custom parser must handle all three or agent files written by hand will silently lose their tools list.
