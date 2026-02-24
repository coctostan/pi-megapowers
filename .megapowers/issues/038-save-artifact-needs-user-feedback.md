---
id: 38
type: bugfix
status: open
created: 2026-02-23T23:30:00.000Z
---

# `megapowers_save_artifact` tool gives no feedback to the user

`handleSaveArtifact()` in `tool-artifact.ts` writes the artifact to disk and returns:

```ts
return { message: `Artifact saved: .megapowers/plans/${state.activeIssue}/${phase}.md` };
```

This message goes back to the **LLM** as the tool result. The LLM typically echoes it in its prose response, but that is indirect — the user only learns the file was saved if they happen to read the LLM's text carefully.

There is no `ctx.ui.notify()` call, no status bar update, no dashboard refresh. From the user's perspective the tool is a black box: something happened, maybe, somewhere.

The existing pattern in the codebase for successful operations is:
```ts
if (ctx.hasUI) ctx.ui.notify(`Feature doc saved to .megapowers/docs/${state.activeIssue}.md`, "info");
```
(e.g. in `index.ts` lines ~233, ~237, ~423)

`handleSaveArtifact` doesn't have access to `ctx` — it's a pure function called from the tool handler in `index.ts`. The fix is to call `ctx.ui.notify()` in the `megapowers_save_artifact` tool handler in `index.ts` after `handleSaveArtifact` returns a success message, and also refresh the dashboard (a new artifact may make a previously-blocked phase transition now available).

## Expected behaviour

After a successful save:
1. `ctx.ui.notify("Artifact saved: .megapowers/plans/<slug>/spec.md", "info")` shown to user
2. `ui.renderDashboard(...)` called to refresh any gated-transition states

## Affected files
- `extensions/megapowers/index.ts` — `megapowers_save_artifact` tool handler
- `extensions/megapowers/tool-artifact.ts` — `handleSaveArtifact()` (no change needed here — fix is in the caller)
