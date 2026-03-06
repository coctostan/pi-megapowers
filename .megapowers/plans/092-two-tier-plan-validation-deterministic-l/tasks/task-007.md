---
id: 7
title: Create lint-plan-prompt.md template
status: approved
depends_on: []
no_test: true
files_to_modify: []
files_to_create:
  - prompts/lint-plan-prompt.md
---

**Covers:** AC18

**Justification:** Prompt/skill file change — no observable behavior beyond string content. The prompt is tested indirectly through Task 6's tests verifying prompt assembly contains the right sections.

**Files:**
- Create: `prompts/lint-plan-prompt.md`

**Step 1 — Make the change**

Create `prompts/lint-plan-prompt.md`:

```markdown
You are a plan quality checker. Your job is to quickly verify a plan meets basic quality standards before it goes to deep review.

## Spec (Acceptance Criteria)

{{spec_content}}

## Plan Tasks

{{tasks_content}}

## Checks

Evaluate the plan against these checks:

1. **Spec coverage** — Does every acceptance criterion have at least one task that explicitly addresses it? List any uncovered ACs.
2. **Dependency coherence** — Are task dependencies logically ordered? Does any task depend on work that comes after it?
3. **Description quality** — Are task descriptions substantive and actionable? Flag any that are vague hand-waves (e.g., "handle edge cases", "add proper validation", "implement the feature").
4. **File path plausibility** — Do the file paths look reasonable for this project? Flag any that look like placeholders (e.g., "src/foo.ts", "path/to/file.ts").

## Response Format

Respond with ONLY a JSON object (no markdown fences, no explanation):

If all checks pass:
{"verdict": "pass", "findings": []}

If any checks fail:
{"verdict": "fail", "findings": ["Finding 1: specific issue description", "Finding 2: specific issue description"]}

Each finding must be specific and actionable — reference task IDs and AC numbers.
```

**Step 2 — Verify**
Run: `bun run build` (or `bun typecheck` if available)
Expected: Build succeeds — prompt file doesn't affect compilation. Verify the file exists at `prompts/lint-plan-prompt.md` with `cat prompts/lint-plan-prompt.md`.
