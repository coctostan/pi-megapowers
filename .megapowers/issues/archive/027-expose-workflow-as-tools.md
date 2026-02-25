---
id: 27
type: feature
status: done
created: 2026-02-23T15:35:00.000Z
---

# Expose workflow commands as LLM-callable tools

Currently `/issue`, `/triage`, `/done`, and `/mega` are registered as commands (`pi.registerCommand()`), which means only the user can invoke them via the TUI input bar. The LLM cannot call them, making the workflow unnecessarily manual — the user has to copy-paste or type commands that the LLM should be able to trigger directly.

## Goal

Register key workflow operations as tools via `pi.registerTool()` so the LLM can:
- List open issues
- Activate an issue (start a workflow)
- Advance phases (done)
- Trigger triage

This unblocks LLM-driven workflow orchestration and is a prerequisite for #026 (LLM-driven triage batching).
