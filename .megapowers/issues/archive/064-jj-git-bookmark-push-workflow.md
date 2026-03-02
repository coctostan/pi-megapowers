---
id: 64
type: feature
status: done
created: 2026-02-24T00:21:00.000Z
milestone: M4
priority: 1
---

# jj bookmark + git push workflow for issue branch management

## Problem

Megapowers creates jj changes per phase and per task, but the work never reaches git or GitHub. There is no bookmark (branch) management, no git push, and no way to create a PR from completed work.

### What exists today
- `jj.ts` has `bookmarkSet()` — **never called anywhere**
- `phase-advance.ts` creates child jj changes per phase and stores `jjChangeId` in state
- `tool-signal.ts` squashes task changes into the implement phase change on done — **not the full issue tree**
- `jjChangeId` in state tracks the *current* working change, updated on every phase advance
- No `rootChangeId` — by the time we reach done, we can't squash the entire issue's work

### What's missing
1. **No bookmark created** — jj changes are anonymous, never mapped to a git branch
2. **No root change tracked** — can't squash the full issue tree because we lost the root
3. **No git push** — completed work stays local forever
4. **No session resume** — if a session dies, the next session doesn't navigate back to the right jj change
5. **Squash on done is incomplete** — only squashes task changes into implement, not the full brainstorm→done tree

### Current jj change tree (unmanaged)
```
(trunk)
  └── brainstorm phase change
       └── spec phase change
            └── plan phase change
                 └── implement phase change
                      ├── task-1 change
                      ├── task-2 change
                      └── task-3 change
                           └── verify phase change
```

## Desired Behavior

### Issue start (on issue selection)
- Create a root jj change: `jj new -m "mega(<issue-slug>)"`
- Set bookmark: `jj bookmark set mega/<issue-slug>`
- Save `rootChangeId` to state (new field, never overwritten during the issue lifecycle)
- All subsequent phase/task changes descend from this root

### During work (no changes to existing behavior)
- Phase advances create child changes (already works via `phase-advance.ts`)
- Task completion creates sibling changes (already works via `tool-signal.ts`)
- `jjChangeId` continues tracking the current working change

### Done phase
- Squash **all** descendants into `rootChangeId` (not just task changes into implement)
- Push bookmark: `jj git push --bookmark mega/<issue-slug>`
- This creates/updates the remote git branch, ready for PR

### Session resume (on session_start)
- Read `jjChangeId` from state
- Run `jj edit <jjChangeId>` to restore working copy to the right change
- If the change doesn't exist (abandoned/rewritten), fall back to `rootChangeId`
- If that also fails, warn the user

## Implementation Details

### State schema change
Add `rootChangeId: string | null` to state. Set once on issue selection, never updated. Used only for final squash target.

```typescript
// state-machine.ts — add to MegapowersState
rootChangeId: string | null;
```

### index.ts — issue selection hook
When an issue is selected (wherever `activeIssue` gets set), after setting the issue:

```typescript
const changeId = await jj.new(`mega(${issueSlug})`);
await jj.bookmarkSet(`mega/${issueSlug}`);
state.rootChangeId = changeId;
state.jjChangeId = changeId;
await writeState(cwd, state);
```

~10 lines. Need to identify the exact hook point where issue selection happens.

### index.ts — session_start hook
On session start, if there's an active issue with a `jjChangeId`:

```typescript
const state = readState(cwd);
if (state.jjChangeId) {
  try {
    await jj.edit(state.jjChangeId);
  } catch {
    if (state.rootChangeId) {
      await jj.edit(state.rootChangeId);
    } else {
      // warn user — VCS state is lost
    }
  }
}
```

### phase-advance.ts — done squash
Change the done-phase squash from `squashInto(jjChangeId)` to `squashInto(rootChangeId)`:

```typescript
if (nextPhase === 'done' && state.rootChangeId) {
  await jj.squashInto(state.rootChangeId);
  await jj.gitPush(`mega/${issueSlug}`);
}
```

### jj.ts — add gitPush function
```typescript
export async function gitPush(bookmark: string): Promise<void> {
  await exec(`jj git push --bookmark ${bookmark}`);
}
```

### Prompt guidance
Add a single line to `megapowers-protocol.md`:
> Version control is managed automatically. Do not run jj or git commands.

## Out of Scope
- **Per-phase pushes** — only push on done. Local jj changes are durable enough.
- **Conflict resolution** — if the branch has remote changes, surface a warning but don't try to auto-resolve. Human intervention required.
- **PR creation** — pushing the branch is enough. PR creation can be manual or a future issue.
- **Bookmark cleanup** — after PR merge, cleaning up the bookmark is left to the user.

## Risks
- **`jj git push` requires git remote configured** — if no remote exists, the push will fail. Should handle gracefully with a warning, not crash.
- **Squash into root may conflict** — if phase changes touched overlapping files, the squash could produce conflicts. `jj.hasConflicts()` exists and should be checked after squash.
- **State migration** — existing issues in progress won't have `rootChangeId`. Need a fallback: if `rootChangeId` is null on done, skip the full squash and just push whatever `jjChangeId` points to.

## Related
- #061 — jj mismatch dialog frozen (existing jj bug)
- AGENTS.md AC20 — jj task change creation not wired (this issue supersedes that gap)
