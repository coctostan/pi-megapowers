Fixed. Here's what I did:

1. **`state.json`** — Cleared the active issue. Set `activeIssue`, `workflow`, `phase` to `null`, reset `phaseHistory`, `planTasks`, etc. The state machine is now idle with no active issue.

2. **`026-triage-llm-driven-batching.md`** — Changed `status: in-progress` → `status: done`.

This was the **session_shutdown overwrite bug** (known issue 004) — a stale in-memory state got written back on shutdown, regressing the file state from done back to verify. You're now back to a clean idle state ready to pick up the next issue.