# Bugfix Mode

Megapowers supports a dedicated bugfix workflow alongside the existing feature workflow. The bugfix workflow follows a streamlined path optimized for diagnosing and fixing bugs.

## Workflow Phases

```
reproduce → diagnose → plan → implement → verify → done
```

### reproduce
The agent receives the `reproduce-bug.md` prompt and documents:
- Steps to reproduce the bug
- Expected vs actual behavior
- Environment details
- A failing test (if feasible)

Output is saved as `reproduce.md` in the issue's plan directory.

### diagnose
The agent receives the `diagnose-bug.md` prompt with the reproduction report interpolated as `{{reproduce_content}}`. The agent identifies root cause without fixing.

The diagnosis may include an optional `## Fixed When` section with numbered acceptance criteria. These are extracted on demand during verify.

Output is saved as `diagnosis.md`.

### plan → implement → verify
These phases work identically to feature mode, except:
- **Plan phase**: `{{brainstorm_content}}` is aliased to `reproduce.md` content, and `{{spec_content}}` is aliased to `diagnosis.md` content
- **Verify phase**: If `## Fixed When` criteria were extracted, they are checked alongside plan tasks

### done
The done-phase menu includes bugfix-specific options:
- **Generate bugfix summary** — sets `doneMode` to `"generate-bugfix-summary"` and produces a durable summary document from all artifacts (reproduction, diagnosis, plan, files changed, learnings)
- **Write changelog entry** — standard changelog entry
- **Capture learnings** — save insights for future reference
- **Close issue** — marks issue as done and resets state
- **Squash task changes into phase change** — consolidates task work into the phase change (stays in menu after)

Note: Feature mode shows "Generate feature doc" instead of "Generate bugfix summary". The remaining options are shared.

## Phase Gates

| Transition | Requirement |
|------------|-------------|
| reproduce → diagnose | `reproduce.md` must exist |
| diagnose → plan | `diagnosis.md` must exist |

## Templates

| Phase | Template File | Key Variables |
|-------|--------------|---------------|
| reproduce | `reproduce-bug.md` | `{{issue_slug}}` |
| diagnose | `diagnose-bug.md` | `{{issue_slug}}`, `{{reproduce_content}}` |
| done (summary) | `generate-bugfix-summary.md` | `{{issue_slug}}`, `{{reproduce_content}}`, `{{diagnosis_content}}`, `{{plan_content}}`, `{{files_changed}}`, `{{learnings}}` |

## Implementation notes

- **Section extraction**: Both `extractAcceptanceCriteria` (specs) and `extractFixedWhenCriteria` (diagnoses) share a common `extractNumberedSection` helper in `spec-parser.ts`. They differ only by the heading pattern matched.
- **Variable aliasing**: In `index.ts`, bugfix mode sets `brainstorm_content = reproduce_content` and `spec_content = diagnosis_content` so that shared templates like `write-plan.md` work without modification.
- **State type**: `MegapowersState.doneMode` includes `"generate-bugfix-summary"` alongside feature values (`"generate-docs"`, `"capture-learnings"`, `"write-changelog"`).
