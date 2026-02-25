---
id: 67
type: bugfix
status: open
created: 2026-02-24T00:21:00.000Z
---

# Subagent workspace changes never squashed into main working copy

## Problem

When a subagent completes, its changes are captured as a diff in `status.json` but are never integrated into the primary workspace's working copy. The `buildWorkspaceSquashArgs()` function exists in `subagent-workspace.ts` but has zero callers.

### Current flow (broken)
1. `jj workspace add` creates isolated workspace for subagent
2. Subagent works, makes changes in its workspace
3. On completion: `jj diff` captures the diff → written to status
4. `jj workspace forget` removes the workspace
5. The workspace's change still exists in jj history but is NOT in the main working copy
6. Primary session sees unchanged files → LLM is confused

### Expected flow
1-2 same as above
3. On completion: `jj squash --from <workspace>@` merges changes into main working copy
4. `jj workspace forget` cleans up
5. Primary session sees updated files

## Fix

In `index.ts`, in the subagent's `child.on("close")` handler, before `workspace forget`:

```typescript
// Squash subagent changes into main working copy
if (code === 0) {
  const squashArgs = buildWorkspaceSquashArgs(wsName);
  await pi.exec("jj", squashArgs);
}

// Then cleanup
await pi.exec("jj", buildWorkspaceForgetArgs(wsName));
```

The squash must happen BEFORE the forget — once the workspace is forgotten, `<workspace>@` no longer resolves.

### Error handling
- If squash fails (conflicts), write a warning to status and don't forget the workspace — let the user resolve manually
- If squash succeeds but produces jj conflicts in the main working copy, detect via `jj.hasConflicts()` and warn

## Temporary workaround

The `implement-task.md` prompt currently documents the subagent lifecycle step-by-step (dispatch → poll → interpret status → act on result) including "re-read any files you were working on" and failure recovery paths. This works around the missing squash by giving the LLM enough context to understand what's happening. Once the squash is wired up, the prompt can be simplified — the "re-read files" warning becomes less critical and the failure recovery for squash conflicts can be added.

## Files
- `extensions/megapowers/index.ts` — add squash call in child close handler (~3 lines)
- `extensions/megapowers/subagent-workspace.ts` — `buildWorkspaceSquashArgs` already exists, just needs a caller
- `prompts/implement-task.md` — simplify subagent section after fix (remove workaround language)
