---
id: 5
title: Document the current session policy
status: approved
depends_on:
  - 1
  - 2
  - 3
  - 4
no_test: true
files_to_modify:
  - README.md
  - AGENTS.md
  - .megapowers/docs/080-clean-context-windows.md
files_to_create: []
---

### Task 5: Document the current session policy [no-test] [depends: 1, 2, 3, 4]

**Justification:** Documentation-only corrections for an explicitly chosen compatibility policy; no new runtime behavior. Observable behavior is tested in Tasks 1–4.

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `.megapowers/docs/080-clean-context-windows.md`

Covers Fixed When 7 and supplies operator guidance for 8. All three files were inspected before planning.

**Step 1 — Make the change**
In README's plan-loop list, replace the complete submit item:
```md
2. **Submit** — `megapowers_signal({ action: "plan_draft_done" })` → enters review mode in the current Pi session
```
Immediately after that plan-loop list, add:
```md
### Session boundaries

Megapowers phase, task, and plan-review transitions preserve the current Pi session. They update workflow state without automatically clearing history or starting a fresh agent runtime.

For a fresh context window, use Pi's `/new` command between agent runs. Workflow state and artifacts remain on disk, so the next agent start builds context for the current phase/task. This context is injected at agent start, not on every follow-up model request inside an existing run.

After updating the extension, reload it before testing transitions. A session already corrupted by an older version may need a one-time `/new`; this fix prevents new corruption but does not repair historical transcripts.
```

In AGENTS.md, replace the submit-draft instruction with:
```md
- **Submit draft:** `megapowers_signal({ action: "plan_draft_done" })` → enters review mode in the current Pi session
```
Add this key-concept bullet:
```md
- **Session boundaries:** workflow tools preserve the current Pi session. Fresh context is user-initiated with `/new` between runs; the next agent start rebuilds phase/task context from disk. Never reset a raw/read-only session manager from a tool or lifecycle hook.
```

Replace the entire historical #080 document with:
```md
# Historical Feature: Clean Context Windows (#080)

> Superseded by #130 for session handling. This document records historical intent, not the current session API contract.

#080 aimed to give each phase/task a focused context window. Its implementation called the underlying session manager's newSession() during model-tool execution. That reset changed storage without replacing the agent runtime and split persisted tool calls from their results. Pi's canonical session projection exposed the resulting invalid provider history.

Current policy after #130:
- Megapowers transition tools preserve the current Pi session and its transcript.
- They continue to update workflow state, gates, task completion, and plan-review artifacts.
- Fresh sessions are user-initiated with Pi's /new command between runs, not automatic side effects of workflow tools.
- Workflow state and artifacts remain on disk; the next agent start builds context from that current state.
- Context injection occurs at agent start, not before every follow-up provider request inside an already-running tool loop.
- No raw/read-only session-manager mutation, command-only session API invoked from a tool, or deferred-reset workaround is supported.

The historical done-phase/close_issue cleanup shipped with #080 remains separate from this session-compatibility correction. TypeScript casts do not fail at runtime or make mutating a read-only API safe.

```

Do not edit immutable past plans, completed-issue acceptance criteria, or auto-generated prompt-assembler caches. Do not add automatic context-reset promises elsewhere.

**Step 2 — Verify**
Use `read` on all three files and `grep` for `new session|fresh session|triggerNewSession|newSession` over current extension code, README, AGENTS, and the #080 document. Expected: runtime producers/consumers are gone, active guidance consistently states preservation, and any historical mention explicitly explains the superseded behavior. String-key negative tests and issue artifacts are allowed to mention the removed flag.

Run: `bun test`
Expected: all passing.

Ask the plan/code reviewer (fresh context when available) to check that docs make no claim of phase-prompt reinjection inside the current run and do not recommend a tool-side or hook-side replacement API. Read-only review is sufficient; no new subagent infrastructure is needed.
