## Approach
We will add a minimally useful, project-scoped planning scout that relies on the external pi-subagents extension rather than building new in-repo orchestration. The first slice is intentionally small: a `.pi/agents/plan-scout.md` agent definition, plus a short companion design/usage artifact describing the bounded `context.md` handoff and experiment success criteria. This keeps the feature useful immediately without broadening into review/revise families or a new runtime layer.

The scout’s job is advisory only. It reads the active planning input (`spec.md` for features or `diagnosis.md` for bugfixes) plus targeted repo files, then writes a compact `context.md` artifact under the active plan directory root. That artifact is a planning handoff, not a source of truth. The main planning session still owns `megapowers_plan_task`, `megapowers_plan_review`, and workflow transitions.

We will also remove or narrow conflicting repo-local guidance that says subagents are broken or should never be used, at least where that conflicts with planning-scout usage. The design explicitly fails closed: if `spec.md`/`diagnosis.md` is missing, the scout should stop and report missing required input instead of doing a vague repo-only scan.

## Key Decisions
- Use the external pi-subagents extension, not new megapowers orchestration code.
- Keep scope to a single useful scout; defer review/revise agent families.
- Write `context.md` at `.megapowers/plans/<issue-slug>/context.md` for easy discovery and consumption.
- Treat `context.md` as advisory only; canonical planning state remains in `spec.md`/`diagnosis.md` and plan task files.
- Require `spec.md` or `diagnosis.md`; fail closed if missing.
- Bound scout output to: acceptance-criteria mapping, key files, APIs/tests/conventions, risks, and suggested task slices.
- Remove or narrow contradictory in-repo guidance that claims subagents are broken.
- Prefer prompt-file and documentation tests over brittle end-to-end subagent execution tests.

## Components
- `.pi/agents/plan-scout.md`
  - Frontmatter for a planning-specific project agent.
  - Prompt instructing read-heavy repo scouting only.
  - Explicit prohibition on workflow transitions, task writing, and hidden authority.
  - Bounded output contract targeting a compact `context.md`.

- Planning usage / experiment artifact
  - Documents how the main planning session consumes `context.md`.
  - Defines the recommended artifact layout for this v1 and the broader experiment.
  - States success criteria, failure modes, and non-goals.
  - Aligns the scout with the existing draft-assist / review-fanout direction without implementing the whole family now.

- Conflicting guidance cleanup
  - Update or remove repo guidance that globally says `subagent`/`pipeline` are broken when that conflicts with planning-scout adoption.
  - Keep the distinction clear: implementation pipeline concerns are separate from advisory planning scout usage.

## Testing Strategy
Test at the artifact-contract level rather than by invoking real subagents.

- Agent definition tests:
  - `.pi/agents/plan-scout.md` exists.
  - Frontmatter is present and identifies a planning-specific scout.
  - Prompt says the scout is advisory only and cannot own megapowers tool calls or transitions.
  - Prompt requires `spec.md`/`diagnosis.md` and fails closed if missing.
  - Prompt defines a bounded `context.md` format.

- Documentation tests:
  - A written design/experiment artifact exists.
  - It explains that `context.md` is consumed by the main planning session.
  - It includes at least one draft-assist chain and one review-fanout pattern.
  - It explicitly states non-goals, especially no implementation delegation.

- Guidance consistency tests:
  - Conflicting language that says subagents are broadly broken is removed, narrowed, or clarified so planning-scout usage is not contradicted.

Success means a developer can manually run the external scout, obtain a compact `context.md`, and use it to draft plan tasks with less repo rediscovery and no confusion about authority.