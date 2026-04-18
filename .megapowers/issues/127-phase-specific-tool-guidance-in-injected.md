---
id: 127
type: feature
status: in-progress
created: 2026-04-18T15:36:25.874Z
milestone: M1
priority: 2
---
# Phase-specific tool guidance in injected prompts
Explore and implement a way to give each workflow phase targeted tool guidance instead of relying only on the global tool instructions. The goal is to steer the agent toward project-specific tools such as `pi-hashline-readmap`, `pi-codegraph`, `pi-ptc-next`, and `pi-codex-review` where they are most appropriate, without confusing the model or bloating context.

Problem:
- Megapowers already injects phase-specific prompts, but tool guidance is still mostly generic/global.
- Different phases want different tool behavior: e.g. planning/exploration should favor read/map/code graph tools; implementation may want targeted next-step/task-context tools; code review may want reviewer-specific tools.
- If too much tool policy is repeated in every phase prompt, context grows and instructions become noisy or contradictory.

Desired outcome:
- Define which tools should be emphasized per phase/mode.
- Decide where that guidance should live (shared base prompt, per-phase overlay, compact tool-profile block, etc.).
- Keep prompts small and non-conflicting.
- Make the injected guidance inspectable/debuggable so prompt behavior can be understood.

Acceptance criteria:
- There is a documented mapping of workflow phases/modes to preferred tool guidance.
- Prompt assembly has a clear strategy for combining base instructions with phase-specific tool overlays.
- The strategy avoids duplicating large tool descriptions across prompts.
- The strategy defines how to handle project-specific tools that are absent in other repos.
- The resulting design is debuggable and does not materially worsen context bloat.
