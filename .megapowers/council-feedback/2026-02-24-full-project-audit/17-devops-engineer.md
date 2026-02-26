---
persona: DevOps Engineer
date: 2026-02-24
topic: Full project audit — CI/CD and infrastructure integration
---

# DevOps Engineer — "The Integration Plumber"

First question: can I run this in CI? The answer right now is "sort of, but not really."

**The jj dependency is a problem.** Most CI environments have git. Almost none have jj. The tool requires jj for change tracking. If I want to enforce megapowers in a CI pipeline — say, validating that a PR was actually built through the workflow — I need jj installed in the CI runner. That's a non-trivial infrastructure ask. Either provide a git fallback or make jj optional for read-only validation.

**No CI validation mode.** I want a command like `megapowers validate` that checks: does this branch have the expected artifacts? Was the workflow followed? Did verify pass? This would be a PR gate — reject PRs that bypassed the workflow. Right now the tool is purely interactive. It has no headless/batch mode.

**The `.megapowers/` directory question.** Should this be committed? If yes, it's part of the repo and visible in PRs — that's good for audit but clutters diffs. If no, it's local-only and provides no team visibility. Need a clear convention and `.gitignore` guidance.

**Session resume is missing.** If a CI job crashes mid-workflow, can it resume? The disk-first architecture should support this, but there's no documented "attach to existing state" flow. For long-running features that span multiple CI runs or developer sessions, resume is essential.

**Environment portability.** The tool assumes a local filesystem with read-write access to the working directory. What about remote development (Codespaces, Gitpod, SSH)? What about containerized dev environments? The `.megapowers/` state needs to travel with the project, which argues for committing it.

**What I'd need to adopt this:**
1. Git adapter (jj optional)
2. `megapowers validate` CLI command for PR gates
3. Clear guidance on `.megapowers/` in version control
4. Session resume documentation
5. Docker/Codespace compatibility testing
