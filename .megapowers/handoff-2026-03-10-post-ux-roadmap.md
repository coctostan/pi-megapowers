# Handoff — Post-UX Issue Roadmap (2026-03-10)

## Context

This handoff captures the recommended path **after the UX split work**:
- #122 — Phase entry UX — explicit kickoff instead of dummy first messages
- #120 — Megapowers context visibility — show and inspect injected context
- #121 — Megapowers operation feedback — progress, result summaries, and next-step clarity

During this session we split #051 into the three issues above. The core UX insight was that phase entry currently feels broken because the user often has to type a meaningless message just to start work.

## Current state

- **Megapowers state:** idle / no active issue / no active phase
- **Open UX work:** #051 umbrella + #119 / #120 / #121 child issues
- **Current PR:** #64 `fix: prevent /issue list width overflow crashes` — CI passing

## Main recommendation

Once the UX issues are done, the next work should focus on **workflow quality and system structure before large scope expansion**.

Recommended order after UX:

1. **#059 — Workflow iteration quality — context management and plan-review versioning**
2. **#089 — Add Zod frontmatter schemas to phase artifact files**
3. **#068 — Add `[prompt-test]` task type for TDD of prompts and skills**
4. **#078 — Init Workflow System**
5. **#079 — Foundation Doc Lifecycle**
6. **#052 — Project lifecycle management — onboarding, roadmap, and branching**

---

## Issue-by-issue guidance

## #059 — Workflow iteration quality — context management and plan-review versioning
**Milestone:** M3  
**Priority:** 2

### Why it should come first after UX
This is the next highest-leverage improvement to the actual development loop. Megapowers is strongest when the workflow remains coherent over time; this issue improves exactly that.

### What it is really about
Two related problems:
1. **Context management per phase/task**
   - phase transitions should not drag irrelevant conversation history forever
   - implement should feel scoped to the current task
   - completed-task noise should be pruned from working context
2. **Plan-review versioning**
   - review/revise rounds should feel like iterations on a concrete object, not a vague restart
   - plan/review artifacts should be version-linked and explainable across rounds

### Recommended implementation direction
- introduce better per-phase/per-task context boundaries
- make revise/review history inspectable and linked by iteration
- keep artifacts canonical; do not rely on raw conversation history as the primary memory
- prefer on-disk version lineage over hidden prompt accumulation

### Why it should precede later work
- makes the core workflow more reliable before expanding scope
- improves the same user pain surfaced in the audit: long-running workflows degrade in clarity
- will make later features like init/foundation-doc lifecycle less brittle

### Risks / watch-outs
- avoid ballooning prompt/context size while adding versioning
- avoid creating two competing histories (artifact history vs prompt history)
- preserve the existing plan-review loop semantics

---

## #089 — Add Zod frontmatter schemas to phase artifact files
**Milestone:** M5  
**Priority:** 3

### Why it should happen relatively early
This is a small-to-medium structural improvement that makes the product more trustworthy. Megapowers claims structured workflows; phase artifacts should become genuinely structured.

### What it is really about
Phase artifacts like `brainstorm.md`, `spec.md`, `verify.md`, and `code-review.md` are still mostly freeform markdown. That means:
- gates rely on regex/content heuristics
- artifact validity is weak
- the auditability story is weaker than it should be

### Recommended implementation direction
- add minimal YAML frontmatter + Zod schemas per artifact type
- keep the markdown body human-authored / LLM-authored
- inject/maintain metadata at the system layer, not by asking the LLM to hand-author strict frontmatter
- preserve backward compatibility for older artifact files

### Why it should come before bigger expansion
- improves integrity of the existing product before adding new workflow families
- sets a stronger foundation for #078 and #079
- reduces reliance on fragile parsing in gates

### Risks / watch-outs
- avoid breaking existing artifacts or tests
- keep schemas minimal and system-owned
- do not force complex frontmatter authoring onto the model

---

## #068 — Add `[prompt-test]` task type for TDD of prompts and skills
**Milestone:** M5  
**Priority:** 2

### Why it matters
Prompts are product code in this repo. Right now prompt changes are either awkward to verify or effectively under-verified.

### What it is really about
Create a third task type between:
- normal test-runner-backed tasks, and
- `[no-test]` tasks

The goal is to support a repeatable prompt-edit loop:
1. baseline
2. change
3. verify expected improvement
4. regression-check another scenario

### Recommended implementation direction
- extend plan parsing to recognize `[prompt-test]`
- update write policy so prompt-test tasks bypass code TDD but remain constrained to prompt/skill work
- update planning/review/implement guidance to make prompt-test tasks concrete and reviewable
- use scenario-based verification, probably subagent-backed, but keep the first version simple and inspectable

### Why it should follow #059 / #089
- after UX and workflow quality are improved, prompt work becomes easier to execute cleanly
- after artifact structure is stronger, prompt-task outputs and verification notes can be recorded more cleanly

### Risks / watch-outs
- avoid over-designing a prompt regression framework in v1
- require concrete scenarios and expected outcomes, not vague “verify it works” language
- keep it aligned with existing TDD philosophy without pretending prompts are unit-testable in the same way

---

## #078 — Init Workflow System
**Milestone:** M6  
**Priority:** 1

### Why it is important but should stay later
This is a major expansion of scope. It creates a second product surface: using megapowers to initialize a project/process, not just drive issue-by-issue development.

### What it is really about
- brownfield init workflow
- greenfield init workflow
- new workflow families, artifacts, and commands
- generalized engine support for init output under `.megapowers/init/<project>/`

### Recommended implementation direction
- keep it as a workflow-engine extension, not a one-off wizard
- ship brownfield first if scope gets too large
- make output artifacts and gates mirror the discipline of the main workflow system

### Why it should not come before the earlier issues
- it multiplies surface area significantly
- the main workflow should feel polished before introducing a second major workflow family
- it will benefit from stronger artifact structure (#089) and better context/version behavior (#059)

### Risks / watch-outs
- easy to let init become a prompt/template dump rather than a real workflow system
- avoid mixing foundation-doc lifecycle concerns directly into init v1
- keep generalization disciplined; don’t fork the engine unnecessarily

---

## #079 — Foundation Doc Lifecycle
**Milestone:** M6  
**Priority:** 2

### Why it is valuable
This is one of the most strategically interesting issues because it connects project-level intent to day-to-day issue execution.

### What it is really about
Three modes:
1. **Read** — inject relevant foundation docs into normal workflow context
2. **Update** — propose foundation doc updates when completed work changes reality
3. **Audit** — analyze drift between docs and code/project state

### Recommended implementation direction
Ship this in layers:
1. **Read first** — simplest and highest immediate value
2. **Update second** — done-phase suggestions with approval
3. **Audit last** — likely subagent/analyzer-driven

### Dependency note
This should conceptually follow #078. Init creates the docs; lifecycle manages them afterward.

### Risks / watch-outs
- avoid loading too many docs into every brainstorm/context prompt
- make injection selective and configurable
- keep “propose update” separate from “auto-apply update”

---

## #052 — Project lifecycle management — onboarding, roadmap, and branching
**Milestone:** M6  
**Priority:** 3

### Why it should come last in this group
This issue is currently a broad umbrella that spans multiple concerns:
- onboarding
- roadmap upkeep
- branching model

Those concerns become much clearer after #078 and #079 are in place.

### Recommended interpretation
Treat #052 as a later integration/consolidation issue that ties together:
- init onboarding flows (#078)
- foundation doc lifecycle (#079)
- roadmap maintenance rules
- project-level branching conventions

### Recommendation
Do **not** tackle #052 as a big undifferentiated feature before #078/#079. If needed, re-slice it later once those two are shipping.

### Risks / watch-outs
- too broad to implement cleanly as-is
- overlaps conceptually with both #078 and #079
- likely wants decomposition or reframing once the lower-level pieces exist

---

## Dependency / sequencing summary

### Best next sequence after UX
1. **#059** — improve the quality of the current workflow loop
2. **#089** — strengthen artifact structure and gate integrity
3. **#068** — add prompt-oriented verification as a first-class task type
4. **#078** — build init workflows
5. **#079** — attach lifecycle behaviors to foundation docs
6. **#052** — consolidate project lifecycle concerns on top of the above

### Short rationale
- **First:** polish the core workflow and its artifacts
- **Then:** expand the definition of “tested work” to include prompts
- **Then:** expand product scope into init + foundation docs
- **Last:** unify project-level lifecycle concerns

---

## If only one non-UX issue is tackled next
Pick **#059**.

It has the best combination of:
- direct product quality impact
- leverage on the current workflow
- alignment with the recent audit findings
- lower scope risk than the M6 expansion work

---

## Starting point for the next session

If resuming after UX work, read in this order:
1. `.megapowers/handoff-2026-03-10-post-ux-roadmap.md` (this file)
2. `.megapowers/issues/059-workflow-iteration-quality.md`
3. `.megapowers/issues/089-add-zod-frontmatter-schemas-to-phase-art.md`
4. `.megapowers/issues/068-prompt-test-task-type.md`
5. `ROADMAP.md`
6. `.megapowers/milestones.md`

## Recommended next decision
After #119 / #120 / #121 are complete, decide whether to:
- go directly into **#059**, or
- do a small structural hardening pass first if the UX work exposed architecture debt worth cleaning immediately.
