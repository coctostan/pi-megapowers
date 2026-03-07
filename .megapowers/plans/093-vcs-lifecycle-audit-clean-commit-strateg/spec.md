## Goal

Establish a single, testable VCS shipping flow for the active issue lifecycle — activation, switch-away, done, push, and PR creation — so that `push-and-pr` cannot silently omit intended local work, suspicious untracked files block shipment with a clear error, and shipped branches produce one clean squash commit instead of leaking messy intermediate history.

## Acceptance Criteria

1. When an issue is activated, the system records a feature or bugfix branch name for that issue when git branch creation succeeds.

2. When an issue is activated from a non-feature base branch, the system records that base branch for later shipping operations.

3. When switching away from an active issue with a dirty working tree, the system persists that issue’s local work before activating the next issue.

4. When switching away from an active issue with a clean working tree, the system does not create an unnecessary WIP commit.

5. The done-phase `push-and-pr` flow runs a code-owned finalization step before any push attempt.

6. If the working tree contains tracked modifications at finalization time, `push-and-pr` includes those modifications in the shipped branch state before pushing.

7. If the working tree contains relevant untracked files that are not ignored and not denylisted, `push-and-pr` includes those files in the shipped branch state before pushing.

8. If the working tree contains files ignored by git, finalization does not include those files in the shipped branch state.

9. If the working tree contains denylisted suspicious untracked files, finalization aborts before push and returns a clear error listing the blocked files.

10. If finalization aborts, the system does not attempt `git push`.

11. If `branchName` is missing, empty, or equal to the base branch at shipping time, `push-and-pr` aborts early with a clear error instead of attempting push.

12. Before pushing, the shipping flow squashes the issue branch into a single clean commit representing the final shipped state.

13. If the squash step fails, the system returns a targeted squash error and does not attempt push.

14. If push succeeds, PR creation runs only after the successful push completes.

15. If push fails, the system does not attempt PR creation.

16. If the GitHub CLI is unavailable, the system returns a clear PR-skipped result instead of failing with an opaque command error.

17. If the GitHub CLI is available but PR creation fails, the system returns a clear PR creation error without hiding the earlier push result.

18. Existing VCS command and helper coverage is extended so the activation, switch-away, finalize, push, and PR lifecycle guarantees above are verified by automated tests.

## Out of Scope

- Pipeline or worktree redesign
- Post-merge cleanup behavior after a PR is merged
- Interactive file-picking UI for deciding what to ship
- Replacing the existing branch-per-issue workflow model
- General-purpose audit logging or telemetry beyond what is needed to enforce and test this lifecycle

## Open Questions
