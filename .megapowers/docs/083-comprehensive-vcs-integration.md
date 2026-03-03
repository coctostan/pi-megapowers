## Code Review Complete ✅

**Assessment: ready** (after fixes implemented during review)

### Two bugs found and fixed:

**Critical — Feature dead in production (`index.ts`)**  
`execGit` and `execCmd` were never initialized in `runtimeDeps` (it was just `{}`). Every VCS guard checked `if (deps.execGit && ...)` and short-circuited. Fixed by wiring `pi.exec` into both executors at startup, matching the pattern in `register-tools.ts`.

**Important — Wrong `baseBranch` on issue switch (`commands.ts`)**  
When switching from issue A (`feat/001`) to issue B, the code captured `baseBranch` from the current HEAD — which was `feat/001`, not `main`. At done-time, `squashOnto` would soft-reset onto `feat/001`, targeting the wrong branch. Fixed by propagating `prevState.baseBranch` when switching issues (only capture from HEAD on fresh activation). Added a regression test.

**Final test count: 711 pass, 0 fail** (up from 710).