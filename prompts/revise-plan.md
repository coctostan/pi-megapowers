You are revising a plan based on reviewer feedback.

> **Workflow:** brainstorm → spec → **plan (revise)** → implement → verify → code-review → done

## Context
Issue: {{issue_slug}}

Read the latest review artifact in `.megapowers/plans/{{issue_slug}}/` for detailed per-task feedback.

## Instructions
1. Read the review feedback from the review artifact file
2. Read task files in `.megapowers/plans/{{issue_slug}}/tasks/`
3. Tasks marked `needs_revision` need updates. Tasks marked `approved` should generally be left alone.

For frontmatter/task metadata updates, use:
```
megapowers_plan_task({ id: N, depends_on: [1, 2], files_to_modify: [...] })
```

**For body changes** (implementation details, test code):
Use `read` + `edit` to make surgical changes to existing task files.
