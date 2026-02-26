---
persona: Open Source Maintainer
date: 2026-02-24
topic: Full project audit — contributor experience and ecosystem
---

# Open Source Maintainer — "The Community Builder"

I'm evaluating this as someone who might contribute or recommend it to others.

**Documentation gap is significant.** AGENTS.md is an internal architecture doc — great for contributors who already understand the system, useless for someone evaluating whether to try it. There's no user-facing documentation. No "Getting Started" guide. No "How It Works" explainer with screenshots. No FAQ. The prompts directory has 16 templates that constitute the core UX, and they're undocumented.

**Contribution path is unclear.** If I want to add a new workflow phase, where do I start? The architecture is spread across 20+ files with interdependencies (state-machine.ts defines phases, gates.ts defines checks, write-policy.ts defines permissions, prompts.ts loads templates). There's no CONTRIBUTING.md. There's no architecture diagram. The AGENTS.md description in the project root is a compressed reference, not an onboarding guide.

**Extension API surface is undefined.** This is a pi extension, but can other extensions build on it? Can someone create a custom workflow? Custom phases? Custom gates? Right now the answer is no — everything is hardcoded. If this is meant to be a platform, it needs extensibility points. If it's meant to be an opinionated tool, that's fine, but say so.

**Test quality is a strength.** 574 tests, pure design, no framework dependency — this is contributor-friendly. Someone can clone, run `bun test`, and get confidence. The test-per-module pattern makes it obvious where to add tests for changes. This is genuinely good.

**What would make me contribute:**
1. A CONTRIBUTING.md with architecture walkthrough
2. "Good first issues" labeled in the issue tracker
3. A clear extension/plugin API for custom workflows
4. User-facing docs separate from the architecture reference
5. A changelog that helps me understand what's changing and why (the existing CHANGELOG.md exists but I haven't evaluated its quality)
