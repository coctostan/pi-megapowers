# Learnings — #130

- Session storage reset and agent-runtime replacement are different operations. A read-only API cast bypasses compile-time protection but supplies no lifecycle safety.
- Test the host's persistence boundary: assistant call before execute, result afterward, then canonical projection. A mock asserting newSession was called protected the defect rather than the transcript invariant.
- Pairing guarantees must include the containing assistant message, sibling results in either order, and nested tools' outer call/result pair—not only the transition's local call ID.
- Domain transitions can succeed before a provider rejects the next request. Blindly retrying task_done can affect the next task; inspect persisted state first.
- Editing a self-hosted extension does not replace loaded callbacks. Reload before using the repaired transition tools, and distinguish preventing new corruption from repairing old sessions.
- Keep pure regressions separate from real-host and live-provider checks. The installed-manager RED/GREEN control and successful OpenAI continuation provide distinct evidence; Anthropic quota failure is a limitation, not a pass.
- Session policy is part of the user-facing contract. Descriptions, next-step messages, and documentation must not promise fresh context when only workflow state changes.
