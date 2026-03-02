# Learnings — Issue 090

- **Gate coverage should mirror the intent of each phase transition.** The `plan → implement` gate only checked artifact existence, not review completion — a mismatch between what the gate enforced and what the workflow required. When adding a phase transition, ask: "What invariant must hold for this transition to be safe?" and encode it as a gate, not just a precondition comment.

- **Two code paths doing the same job is a latent inconsistency.** `handleApproveVerdict` called `transition()` directly with correctly formatted tasks; `phase_next` called `advancePhase()` with only an artifact check. Both could advance plan→implement but only one was safe. Single exit point (one authoritative path out of plan) would have prevented the bypass entirely.

- **Legacy functions that predate a new subsystem need explicit ownership transfer.** `deriveTasks` was written when `plan.md` was the only source of truth. When task files were introduced, `deriveTasks` was never updated to know about them. The principle: when you add a new canonical data store, audit every consumer of the old store and update them.

- **Strict parsers cause silent failures under format drift.** `extractTaskHeaders` matched only `### Task N:` — a format produced only by the machine. LLM-written plans naturally drift (double hash, em-dash). Making parsers lenient by default (accepting reasonable variants) is safer than a strict parser that silently returns `[]`, which is indistinguishable from "no tasks exist."

- **Prompt instructions and runtime enforcement must be kept in sync.** The gate fix (hard enforcement) and the prompt fix (soft guidance) are complementary — the gate prevents the wrong action from succeeding, the prompt prevents the LLM from trying it. Either alone is incomplete: a gate with no prompt guidance generates confusing errors; a prompt with no gate can still be bypassed.

- **Test files documenting buggy behavior are a double-edged sword.** The `reproduce-090.test.ts` approach (write tests asserting buggy behavior first, then flip them) gives a clear before/after signal. But tests asserting `toBe(true)` for a bypass that should be blocked are dangerous if someone accidentally runs them as a regression suite — they'd pass on buggy code. Clearly naming them (e.g., "currently buggy") and flipping them as part of the fix is the right discipline.
