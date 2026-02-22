
## 2026-02-21 — cross-cutting-concerns

- ui.ts `handleDonePhase` while-loop hangs tests if a mock select returns a menu label that doesn't match any `if` branch and doesn't break — always ensure every menu action either breaks or has a catch-all exit
- Done-phase `PHASE_PROMPT_MAP` defaults can conflict with mode-based prompt selection — when a phase uses modal behavior (doneMode), the default template map entry should be empty/neutral, not a specific action template
- `getLearnings()` merging multiple file sources needs care — the old `/learn` command writes to `.megapowers/learnings/learnings.md` while attributed learnings go to `.megapowers/learnings.md`; keep both paths and merge in the getter
- Subagent-driven development works well for independent store/state/prompt tasks but times out on complex UI tasks with tight integration — consider implementing UI changes directly when they involve while-loop logic that's hard to describe precisely in a prompt
- `buildPhasePrompt` was a convenience wrapper around `getPhasePromptTemplate` + `interpolatePrompt` — once you need to swap templates conditionally (doneMode), you must call the lower-level functions directly and the wrapper becomes dead code
