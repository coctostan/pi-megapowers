---
id: 43
type: feature
status: open
created: 2026-02-24T00:48:17.085Z
sources: [13, 27, 35]
milestone: M0
priority: 2
---

# Workflow architecture — extract slash commands and expose as LLM tools

Complementary architecture work on index.ts, which is 588 lines with 14 internal imports and all slash command handlers inlined. (1) Extract slash command handlers (/mega, /issue, /learn, /plan, /triage, /done, /tdd) to a dedicated commands.ts module, following the pattern established by tool-signal.ts/tool-artifact.ts/tool-overrides.ts. Each handler becomes independently testable without mocking the full extension lifecycle. (2) Register key workflow operations as LLM-callable tools via pi.registerTool() — list open issues, activate an issue, advance phases — so the LLM can drive the workflow without requiring the user to type slash commands. This unblocks LLM-driven orchestration and is a prerequisite for LLM-driven triage batching (#026). Extracting commands first makes adding new registered tools cleaner and avoids doubling the complexity of an already-large index.ts.
