# Bugfix Mode

Megapowers supports a dedicated bugfix workflow alongside the existing feature workflow. The bugfix workflow follows a streamlined path optimized for diagnosing and fixing bugs.

## Workflow Phases

```
reproduce → diagnose → plan → review → implement → verify → done
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

The diagnosis may include an optional `## Fixed When` section with numbered acceptance criteria. These are automatically extracted into `state.acceptanceCriteria` for tracking during verify.

Output is saved as `diagnosis.md`.

### plan → review → implement → verify
These phases work identically to feature mode, except:
- **Plan phase**: `{{brainstorm_content}}` is aliased to `reproduce.md` content, and `{{spec_content}}` is aliased to `diagnosis.md` content
- **Verify phase**: If `## Fixed When` criteria were extracted, they're tracked alongside plan tasks

### done
The done-phase menu includes bugfix-specific options:
- **Generate bugfix summary** — produces a durable summary document from all artifacts (reproduction, diagnosis, plan, files changed, learnings)
- **Write changelog** — standard changelog entry
- **Capture learnings** — save insights for future reference
- **Done** — close the issue

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
