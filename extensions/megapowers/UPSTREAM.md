# Upstream Dependencies

## pi-subagents

- **Repository:** https://github.com/nicobailon/pi-subagents
- **Pinned Commit:** 1281c04 (feat: background mode toggle and --bg slash command flag)
- **Patterns Used:**
  - Async runner with status file protocol
  - Agent discovery from markdown files with YAML frontmatter
  - Error detection via repeated failure heuristics
  - Compatible frontmatter schema: `name`, `model`, `tools`, `thinking`
  - JSONL streaming for turn counting and test result detection
  - SIGTERM→SIGKILL escalation for timeout handling
- **Patterns Not Used:**
  - Agent chains/pipelines
  - Agent manager UI
  - MCP integration
  - Session sharing
- **Last Audit:** 2026-02-24

## pi example subagent extension

- **Source:** pi-coding-agent/examples/extensions/subagent/
- **Patterns Used:**
  - `spawn("pi", ["--mode", "json", "-p", "--no-session", ...])` invocation
  - `--append-system-prompt` for agent system prompts
  - `@file` arg for prompt to avoid CLI length limits
  - JSONL stdout parsing with `message_end` / `tool_execution_end` events
  - Prompt written to temp file, cleaned up after completion

## Audit Schedule

Review pi-subagents for improvements to shared patterns quarterly or when upstream publishes breaking changes.
