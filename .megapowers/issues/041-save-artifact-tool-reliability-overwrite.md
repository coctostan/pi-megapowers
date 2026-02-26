---
id: 41
type: bugfix
status: open
created: 2026-02-24T00:48:02.892Z
sources: [38, 39]
milestone: M1
priority: 3
---

# save_artifact tool reliability — overwrite protection and user feedback

Two focused fixes to the megapowers_save_artifact tool in tool-artifact.ts and its handler in index.ts: (1) writeFileSync is called unconditionally — if the LLM calls save_artifact for a phase that already has an artifact (e.g. second spec attempt, re-activated issue), the existing content is silently destroyed. Add an existence check and an optional overwrite param to the tool schema. (2) On success, the tool returns a message to the LLM only — no ctx.ui.notify, no dashboard refresh. The user has no indication an artifact was written. Mirror the existing notify+renderDashboard pattern used elsewhere in index.ts. Both fixes are in the same file pair (tool-artifact.ts + the save_artifact tool handler in index.ts), making this a natural single batch.

## Versioning implementation detail

When an artifact already exists, rename it to a versioned backup before writing the new one. The current file (`spec.md`, `plan.md`, etc.) is always the latest version.

```typescript
// tool-artifact.ts — in handleSaveArtifact, before writeFileSync:
import { existsSync, readdirSync, renameSync } from "node:fs";

const target = join(dir, `${phase}.md`);
if (existsSync(target)) {
  const existing = readdirSync(dir).filter(f => f.startsWith(`${phase}.v`));
  const nextVersion = existing.length + 1;
  renameSync(target, join(dir, `${phase}.v${nextVersion}.md`));
}
writeFileSync(target, content);
```

This preserves the full revision history when review kicks back to plan or spec phases. Example directory after two plan revisions:
```
.megapowers/plans/<issue>/
  plan.md        ← current (v3)
  plan.v1.md     ← original
  plan.v2.md     ← after first review rejection
  spec.md        ← current
```

No changes needed to `deriveTasks()` or `deriveAcceptanceCriteria()` — they always read from `plan.md` / `spec.md` (the unversioned name).
