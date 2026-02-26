---
id: 71
type: feature
status: open
created: 2026-02-25T18:50:00.000Z
milestone: M0
priority: 2
---

# Generalize State Machine — WorkflowConfig

## Problem

Workflow definitions (feature, bugfix) are hardcoded across transitions.ts, prompts, and enforcement logic. Adding a new workflow type (e.g., init-brownfield, init-greenfield, prompt-audit) requires touching 5+ files and knowing which switch statements to update. The state machine is implicit — it exists as scattered if/else chains rather than a declarative structure.

## Proposed Solution

Introduce a `WorkflowConfig` type that declaratively defines:
- Phase sequence (ordered list)
- Transition rules (forward gates, backward rules)
- Required artifacts per phase
- Prompt template keys per phase
- Write policy per phase
- TDD applicability per phase

```typescript
type WorkflowConfig = {
  name: string;
  phases: PhaseConfig[];
  transitions: TransitionRule[];
  tddPhases?: string[];  // which phases enforce TDD
};
```

Feature, bugfix become configs. Init-brownfield, init-greenfield, prompt-audit become future configs that drop in without touching core logic.

Transition engine reads config, not hardcoded phase names.

## Acceptance Criteria

- [ ] WorkflowConfig type defined with phases, transitions, artifacts, prompts, write policy
- [ ] Feature workflow expressed as WorkflowConfig
- [ ] Bugfix workflow expressed as WorkflowConfig
- [ ] Transition engine drives from config, not hardcoded phase names
- [ ] Adding a new workflow = adding a new config object (no core changes)
- [ ] All existing tests pass
- [ ] At least one test verifies a custom WorkflowConfig drives correctly

## Notes

- Depends on #070 (directory restructure) for clean placement.
- Unblocks #062 (prompt-audit workflow), #078 (init workflow system).
- The bugfix aliasing hack (reproduce→brainstorm, diagnosis→spec) should become proper config, not special-case code.
