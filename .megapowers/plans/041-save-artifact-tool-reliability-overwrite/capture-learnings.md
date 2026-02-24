## Learnings — 041-save-artifact-tool-reliability-overwrite

- For destructive write paths, default behavior should be safe (fail closed), and destructive behavior should require an explicit flag (`overwrite: true`).
- Returning tool success text to the LLM is not equivalent to user feedback; user-visible operations should include direct UI notifications.
- After operations that affect phase gating (like writing `spec.md`/`diagnosis.md`), force a dashboard refresh to avoid stale transition affordances.
- Source-inspection integration tests in `index-integration.test.ts` are a practical guard for architectural guarantees (e.g., ensuring `ctx.ui.notify` is present in a specific tool handler).
