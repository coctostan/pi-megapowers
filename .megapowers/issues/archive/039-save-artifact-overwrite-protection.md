---
id: 39
type: bugfix
status: done
created: 2026-02-23T23:30:00.000Z
---

# `megapowers_save_artifact` silently overwrites existing artifact files

`handleSaveArtifact()` in `tool-artifact.ts` calls `writeFileSync` unconditionally:

```ts
writeFileSync(join(dir, `${phase}.md`), content);
```

If the LLM calls `megapowers_save_artifact` with `phase: "spec"` when `spec.md` already exists (e.g. it re-runs the spec phase, misidentifies the phase, or the user re-activates an issue that already has artifacts), the existing content is silently destroyed with no warning to the LLM or the user.

This is a data-loss bug. A spec that took multiple turns to produce can be clobbered in one errant tool call.

## Scope

The same risk applies to any tool that writes to a specific filename without checking for existence:
- `megapowers_save_artifact` (`tool-artifact.ts`) — primary case
- Any slash command that writes fixed-path files (e.g. docs output)

## Expected behaviour

When the target file already exists, `handleSaveArtifact` should:

**Option A (recommended):** Return an error to the LLM:
```ts
return { error: `File already exists: .megapowers/plans/${state.activeIssue}/${phase}.md. Pass overwrite: true to replace it.` };
```
And add an optional `overwrite` parameter to the tool schema.

**Option B:** Append a timestamp suffix (`spec-2.md`) instead of overwriting.

**Option C:** Backup the existing file (`spec.md.bak`) before writing.

Option A is cleanest — it surfaces the problem to the LLM rather than silently accepting or silently mangling data. The LLM can then decide whether to pass `overwrite: true` (if it genuinely wants to replace) or abort.

## Affected files
- `extensions/megapowers/tool-artifact.ts` — `handleSaveArtifact()`: add existence check + `overwrite` param
- `extensions/megapowers/index.ts` — tool schema for `megapowers_save_artifact`: add optional `overwrite: boolean`
