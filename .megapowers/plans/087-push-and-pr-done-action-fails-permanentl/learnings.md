# Learnings — #087 push-and-pr permanently stuck after PR merge

- **AC19 "retry on failure" creates a permanent-failure trap.** The retry logic was designed for transient errors (network, auth), but makes no distinction between transient and permanent failures. A structural/permanent failure (local branch deleted) hits the same no-consume path indefinitely. Future done-action handlers with retry logic should consider adding an "is this failure recoverable?" guard before applying AC19.

- **Sequential `doneActions` queue has a single-point-of-failure at index 0.** Any permanent failure at `doneActions[0]` silently blocks all subsequent actions forever. The architecture has no timeout, skip-on-permanent-failure, or queue-level error recovery. This is a broader systemic risk documented in AGENTS.md known issues.

- **`git rev-parse --verify <branch>` is the canonical local-branch existence check.** The pattern was already used in `ensureBranch` (`branch-manager.ts`). Matching existing patterns in the same codebase instead of inventing new ones keeps the fix minimal and self-consistent.

- **"Non-null in state" ≠ "exists in the repo."** `state.branchName` being set is not a guarantee the branch still has a local ref. This distinction matters for any VCS-dependent operation: always verify the prerequisite git state before issuing a git command that will fail permanently if the state doesn't match assumptions.

- **The consume-and-notify graceful-skip pattern was already established in the same handler.** Two prior guards (missing `execGit`/`branchName`, missing `baseBranch`) followed the exact same detect → consume → notify → return pattern. Adding a third guard required zero API design — just following the precedent. When a pattern recurs in the same function, the solution for new cases is nearly always the same pattern.

- **Regression tests should encode the symptom explicitly, not just the fix.** The test comment says "BUG: push-and-pr is never consumed — permanently stuck / Expected fix: detect branch gone and skip/consume." This makes the intent visible to future readers and helps catch accidental reversion.
