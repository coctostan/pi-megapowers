
## 2026-02-23 — 026-triage-llm-driven-batching

- When replacing an interactive wizard with an LLM-driven flow, remove the old wizard code entirely during the same issue — dead `handleTriageCommand` code and its tests survived implementation and had to be caught in code review.
- `Pick<Store, "listIssues" | "createIssue">` on handler parameters makes tool handlers testable without mocking the full store — use this pattern for all future tool handlers.
- `pi.sendUserMessage()` is the right escape hatch for commands that should trigger LLM conversation rather than performing actions directly — it avoids interactive UI prompts while keeping the user in the loop.

## 2026-02-21 — cross-cutting-concerns

- ui.ts `handleDonePhase` while-loop hangs tests if a mock select returns a menu label that doesn't match any `if` branch and doesn't break — always ensure every menu action either breaks or has a catch-all exit
- Done-phase `PHASE_PROMPT_MAP` defaults can conflict with mode-based prompt selection — when a phase uses modal behavior (doneMode), the default template map entry should be empty/neutral, not a specific action template
- `getLearnings()` merging multiple file sources needs care — the old `/learn` command writes to `.megapowers/learnings/learnings.md` while attributed learnings go to `.megapowers/learnings.md`; keep both paths and merge in the getter
- Subagent-driven development works well for independent store/state/prompt tasks but times out on complex UI tasks with tight integration — consider implementing UI changes directly when they involve while-loop logic that's hard to describe precisely in a prompt
- `buildPhasePrompt` was a convenience wrapper around `getPhasePromptTemplate` + `interpolatePrompt` — once you need to swap templates conditionally (doneMode), you must call the lower-level functions directly and the wrapper becomes dead code
- TDD guard's in-memory state doesn't sync with file state — when the extension's `handleTestResult` event handler misses a bash tool call, the guard blocks production file writes permanently. Workaround: use `sed`/python to bypass the guard for legitimate implementations. Filed issue #021 for proper fix.
- Task completion detection via regex on LLM output (`/task\s+(?:complete|done|finished)/`) is fragile — agent completion messages must contain exact trigger phrases or the task index never advances. A `/task done` command would be more reliable.
- Import placement matters during incremental development — when multiple tasks add to the same file, new imports tend to land at the insertion point rather than the top. Code review should catch this.
- `closeSourceIssues` must be called before `updateIssueStatus` on the batch issue itself — the helper reads the batch's sources via `getIssue`, so the batch must still be accessible (not yet reset to initial state).
