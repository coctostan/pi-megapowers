---
id: 61
type: bugfix
status: open
created: 2026-02-24T20:00:00.000Z
---

# jj change mismatch dialog is frozen — select widget doesn't accept input during session_start

## Problem

When megapowers detects a jj change ID mismatch on session start, it displays a `ctx.ui.select()` dialog with two options ("Continue on current change" / "Ignore (update stored ID)"). The dialog renders but **doesn't accept keyboard input** — arrow keys and enter do nothing. The user is forced to kill the pi process.

## Reproduction

1. Have a project with jj colocated and an active megapowers issue with a stored `jjChangeId`
2. Do something that changes the jj working copy (e.g., `git checkout main` which creates a new jj commit)
3. Start pi — megapowers detects `jjChangeId` mismatch
4. Dialog appears but is frozen — no keyboard input accepted
5. Must kill pi with ctrl+c

## Root Causes

### Bug 1: Change ID comparison always fails (false mismatch)
`getCurrentChangeId()` in `jj.ts` uses template `change_id` which returns the **full** ID (e.g., `zymtuyqtmqmysvyuxlnmrusrptmtuqus`), but `state.jjChangeId` stores shortened IDs (e.g., `zymtuyqt`). The comparison `currentId !== currentState.jjChangeId` will **always** be true because the full ID never equals the short ID. The dialog triggers on every session start even when you're on the correct change.

**Fix:** Use `currentId.startsWith(currentState.jjChangeId)` instead of strict equality, or store full IDs consistently.

### Bug 2: Select widget frozen during session_start
The `ctx.ui.select()` is called during the `session_start` event handler, which may fire before the TUI is fully initialized and ready to accept input. The dialog renders but doesn't accept keyboard input — arrow keys and enter do nothing. Other select dialogs work fine because they're triggered later in the session lifecycle.

## Workaround

Manually edit `.megapowers/state.json` to update `jjChangeId` to the current working copy ID (from `jj log --no-graph -r @ -T 'change_id.shortest(8)'`).

## Suggested Fix

Instead of a blocking select dialog during session_start, either:
1. Auto-update the stored change ID silently (with a notification)
2. Log a warning but don't block — let the user fix via `/mega` command
3. Move the check to a later hook where the TUI is guaranteed ready

## Related

- #057 — jj install check and colocate HEAD issues (same family of jj integration bugs)
