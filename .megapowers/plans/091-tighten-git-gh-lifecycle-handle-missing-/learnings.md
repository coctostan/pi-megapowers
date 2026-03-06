# Learnings — Issue 091: Tighten Git/GH Lifecycle

- **Fail-open is the right default for network-dependent pre-flight checks.** `checkBranchSync` catches every git error and returns an in-sync result rather than blocking activation. Users in offline environments or with SSH auth issues should never be blocked from creating issues — the worst case is a slightly stale branch, not a hard stop.

- **Composing stale-checkout and sync-check together works cleanly** because both operate on the same `baseBranch` variable: stale-checkout sets `baseBranch = "main"`, then sync-check verifies that resolved main is up-to-date. The two concerns don't need to know about each other.

- **The redundant `deps.execGit` guard at `commands.ts:97` is a common artifact of incremental task implementation.** When Task 5 added the stale branch block and Task 6 added the sync check inside it, the defensive check was natural. In a single-pass implementation it would be omitted. Worth watching for during code review.

- **`ctx.ui.select` needs a separate guard from `ctx.hasUI`** because not all contexts that have UI also expose `select` (e.g., headless contexts handle `notify` but not interactive selection). Always check for the specific method when using non-universal UI APIs.

- **`parseInt(...) || 0` is the right pattern for parsing git rev-list output** — handles NaN from empty/malformed output silently. The `?? "0"` prefix is redundant but harmless; would trim in future.

- **Done-phase prompt changes to `push-and-pr` should be explicit about the gh auth flow** — the previous version said "if `gh` is not available, skip" which a model could interpret too broadly (e.g., skip even when gh is installed but just needs login). Explicit step-by-step structure with per-case fallback instructions removes ambiguity.

- **`git checkout main` before `close_issue` is easy to forget** — the old done prompt had no explicit instruction to return to main, leaving users stranded on the feature branch after state reset. This should be a permanent fixture of the close-issue instruction.
