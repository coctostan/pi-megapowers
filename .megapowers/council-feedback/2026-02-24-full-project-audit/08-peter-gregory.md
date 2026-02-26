---
persona: Peter Gregory
date: 2026-02-24
topic: Full project audit — first-principles analysis
---

# Peter Gregory — "The First-Principles Thinker"

*[Long pause. Stares at the architecture diagram.]*

You've built a state machine that governs an AI agent's behavior during software development. But you haven't asked the fundamental question: what is the atomic unit of value here?

It's not the code the agent writes. Code is a commodity — any LLM can produce code. It's not the TDD enforcement, though that's clever. It's not the workflow phases.

The atomic unit of value is **the decision record**. Every phase transition represents a decision. Every artifact represents accumulated reasoning. Every gate check represents a quality threshold. What you've accidentally built is a decision provenance chain for AI-assisted work. The spec is why. The plan is how. The review is validation. The tests are proof. The code is output. The chain is the product.

But you're treating the chain as throwaway scaffolding. The done phase is broken — you discard the chain at the moment of completion. The artifacts overwrite each other — you lose the revision history. There's no way to query "show me every decision that led to this line of code." You have a diamond mine and you're selling gravel.

If I were investing, I'd want to see: every artifact versioned, every phase transition timestamped with context, every backward transition preserving the failure reason. Build the decision graph. That's what enterprises will pay for. That's what makes AI-assisted development auditable, insurable, and trustworthy.

The state machine is a means. The decision record is the end. Reverse your priorities.
