## Approach

This issue should be handled as an end-to-end VCS lifecycle audit, not as a narrow `push-and-pr` patch. The repo already contains pieces of the solution — notably `squashAndPush()` in `extensions/megapowers/vcs/branch-manager.ts`, `createPR()` in `extensions/megapowers/vcs/pr-creator.ts`, branch/base capture in issue activation, and recent stale-branch / remote-sync checks — but the lifecycle is still split across prompts, helpers, and command handlers. As a result, there is no single, testable guarantee that the branch being pushed fully represents the intended local work.

The core design decision is to introduce one canonical shipping path for the active lifecycle: **activation → switch-away → done/finalize → push → PR**. The central invariant is: **before push or PR creation, the branch tip must fully represent the intended local work for the issue**. That means the system must not silently omit dirty tracked files or relevant new files from what gets pushed. It also means that push/PR should no longer be treated as raw shell steps delegated to prompt instructions; they should run through a code-owned finalization path with deterministic preflight checks.

The recommended shipping policy is to always produce **one clean squash commit before push**. During day-to-day work, intermediate WIP commits may still exist, but done-phase shipping should collapse them into a single clean commit. Finalization should include tracked changes and untracked files by default, while using **both `.gitignore` and a small explicit denylist** to block obviously suspicious files from accidental shipment. If suspicious files are present, the system should abort push-and-pr with a clear error and an explicit file list.

## Key Decisions

- **Treat this as a lifecycle audit, not just a done-phase bugfix** — the missing-commit bug is a symptom of split VCS ownership across activation, switching, prompts, and helpers.
- **Scope the audit to activation / switch-away / done / push / PR** — this covers the correctness-critical path end to end without expanding into post-merge cleanup redesign.
- **Ignore pipeline-specific design for this issue** — pipeline code is being deprecated separately, so it should not drive the main VCS architecture here.
- **Add a code-owned finalization step before push** — push-and-pr should mean “finalize branch state, then push, then PR,” not “run git push immediately.”
- **Require one clean shipping commit before push** — preserve a clean PR history and eliminate reliance on messy WIP branches reaching GitHub.
- **Default to include intended local work** — finalization should include tracked changes plus untracked files, so relevant new files are not silently omitted.
- **Use both `.gitignore` and a tiny explicit denylist** — `.gitignore` handles project-defined exclusions; the denylist catches obvious junk that should never be shipped.
- **Abort on suspicious untracked files** — do not silently ignore or partially ship around them; fail closed with a clear list of blocked files.
- **Keep PR creation downstream of successful finalization + push** — `gh` should only run after the branch is known-good and successfully updated.
- **Prefer deterministic orchestration over prompt-only instructions** — prompts can describe behavior, but correctness guarantees should live in code paths that are easy to test.

## Components

- **VCS lifecycle audit map**
  - Document the current ownership and guarantees for activation, switch-away, done/finalize, push, and PR creation.
  - Identify exactly where the current flow can lose work or push an incomplete branch.

- **Finalize-before-push orchestrator**
  - A code-owned path invoked by done-phase `push-and-pr`.
  - Responsibilities:
    - inspect branch/base state
    - inspect dirty/clean working tree state
    - classify untracked files
    - block suspicious files
    - stage intended work
    - squash to one clean shipping commit
    - only then push

- **File classification / shipment policy module**
  - Determines whether a file is:
    - included automatically
    - ignored because it is already ignored by git
    - blocked because it matches the explicit denylist
  - This is the heart of the “no missed work, no junk shipping” rule.

- **Push/PR preflight path**
  - Verifies branch validity before shipping.
  - Detects missing or invalid `branchName` / `baseBranch` early.
  - Ensures PR creation only happens after a successful finalize + push sequence.
  - Reuses existing helpers (`squashAndPush`, `createPR`) where appropriate rather than leaving them orphaned.

- **Lifecycle-facing command integration**
  - Activation remains responsible for branch/base setup.
  - Switch-away remains responsible for persisting in-progress work when moving between issues.
  - Done-phase `push-and-pr` becomes the canonical shipping entrypoint instead of prompt-driven raw git commands.

## Testing Strategy

The testing strategy should verify the lifecycle as a contract, not just individual git helpers. The repo already has useful seams in `git-ops`, `branch-manager`, `pr-creator`, and the VCS command handlers, so the design should lean on dependency-injected tests and only add broader orchestration tests where needed.

1. **Policy unit tests**
   - tracked modified files are included
   - relevant untracked source files are included
   - ignored files are skipped
   - denylisted suspicious files are blocked
   - classification output is deterministic and explicit

2. **Finalization orchestration tests**
   - dirty tree with allowed files results in a final committed/squashed shipping state before push
   - clean tree does not create unnecessary extra commits
   - suspicious untracked files abort finalization and prevent push
   - missing / invalid branch or base aborts early with clear errors
   - push runs only after successful finalization
   - PR creation runs only after successful push

3. **Lifecycle command tests**
   - issue activation captures coherent `branchName` / `baseBranch`
   - switch-away persists work when required and does not silently abandon it
   - push-and-pr on a dirty branch includes intended local work instead of missing it
   - shipped history is a single clean commit rather than accumulated WIP history

4. **Regression tests against existing VCS coverage**
   - preserve or update tests in:
     - `tests/vcs-commands.test.ts`
     - `tests/branch-manager.test.ts`
     - `tests/git-ops.test.ts`
     - `tests/pr-creator.test.ts`
     - prompt/done integration tests as needed

Success for this issue is: activation/switch/done/push/PR have explicit, testable guarantees; `push-and-pr` cannot silently omit intended local work; suspicious files block shipment clearly; and the final branch history shipped to GitHub is one clean squash commit.