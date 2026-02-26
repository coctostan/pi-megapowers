# Phase 3: PRD — Megapowers

> **Date:** 2026-02-25
> **Participants:** Max + Claude (collaborative — questions first, document last)

---

## Scope

Megapowers V1.0 is two interlocking systems with four flavors:

| System | Flavor | Description |
|--------|--------|-------------|
| **Init** | Greenfield | New project. Discovery → Vision → PRD → Architecture → Roadmap → Issues |
| **Init** | Brownfield | Existing codebase. Audit → Discovery → Vision → PRD → Architecture → Roadmap → Issues |
| **Dev** | Feature | Brainstorm → Spec → Plan/Review → Implement → Verify → Code Review → Done |
| **Dev** | Bugfix | Reproduce → Diagnose → Plan/Review → Implement → Verify → Done |

The init system runs once per project and produces **foundation documents** (audit, discovery, vision, PRD, architecture, roadmap). The dev system runs per-issue and executes work. The two are connected: brainstorm draws from foundation docs, done phase revisits and updates them.

---

## V1.0 Requirements — Priority Ordered

### 1. UX Overhaul

**Current state:** 2/10. Prompts ask questions at the wrong time. Choices are too rigid. Selections produce no visible feedback. Only usable by the person who built it. Specific example: selecting an issue shows a blank screen (brainstorm prompt loaded invisibly), completing brainstorm shows a confusing "go back or forward?" popup, dismissing it shows another blank screen. Every transition requires insider knowledge.

**V1 requirement:** A user who isn't the author can follow the workflows without reading source code.

**Phase transition experience:**
- On phase complete: message showing what was saved, what's next, and what to do ("✅ Brainstorm complete. Artifact saved. **Next: Spec phase.** Press Enter to proceed / type `back` to revisit.")
- On phase start: clean context window (see below), agent begins immediately with orientation ("I've read the brainstorm. Let me draft the spec...")
- Default is always forward. Backward is an explicit user action (`/mp back`), not a popup choice.
- Phase transitions may use a UI widget showing contextual commands available in the current phase — not generic "back/forward" but specific actions relevant NOW.

**`/mp` as the single entry point:**
- `/mp` with no args shows all available commands, contextual to current state
- No need to memorize `/issue new`, `/issue list`, etc. — `/mp` lists everything
- Commands are organized by what makes sense right now (phase-specific actions first, then general actions)

**Issue creation is LLM-driven:**
- Not a form/UI box entry system. User describes the issue to the LLM.
- LLM writes the issue using a specific template, consulting existing issues for format consistency
- Structured process, not "ask the LLM and hope it looks right"

**Clean context windows between phases:**
- When a phase completes and its artifact is saved, the next phase starts with a fresh context
- Only the artifact carries forward, not the full conversation history
- This applies to both init and dev workflows
- V1 scope — not V1.1

**General principles:**
- Prompts appear at decision points, not arbitrarily
- Selections show what was selected and what happens next
- Error states explain what went wrong and what to do about it
- The prompt/skill system matches the current architecture — prompts guide the right behavior at the right phase

### 2. Subagent Delegation

**Current state:** Broken. Subagents have never completed a task correctly. The UI shows "Subagent" with no detail. JJ workspace squash doesn't work. The connection between jj commits and the implementing agent's understanding of what was done is broken.

**V1 requirement:** Subagent delegation works reliably for sequential task execution.

**Context & delegation:**
- Subagent receives: task description from plan, relevant file paths, acceptance criteria, TDD instructions (or explicit TDD skip)
- Subagent receives just its task, not the full plan — enough to complete the work, no more
- Subagent knows how to do TDD development when required

**Per-task chain (from oh-my-opencode superpowers-plus pattern):**
- Implement subagent → verify subagent → code review subagent (all for a single task)
- Different prompts for each role (implementer vs verifier vs reviewer)
- Models may differ per role but don't have to for V1
- If code review rejects, it loops back to the main implementing agent (not the subagent) for decision

**Result handoff:**
- Subagent produces a structured summary: files created/modified, tests run (pass/fail), what was done, what wasn't done, any issues encountered
- The implementing agent (main agent) must know 100% what happened and judge: take another crack, do it themselves, or stop and ask user for help
- On failure: 1x retry attempt by the implementing agent before escalating to user

**Human UI:**
- Subagent display shows: agent name, model, task description, status (running/done/failed), tool calls, duration, cost, token usage
- Collapsed view with expand-for-detail (Ctrl+O for full output — adopt patterns from pi example subagent extension)
- Full output visible for debugging purposes

**JJ workspace isolation:**
- Originally designed for parallel execution and TDD enforcement via filesystem isolation
- For V1 (sequential only): evaluate whether jj workspace isolation is needed or if prompt-based TDD enforcement is sufficient
- Architecture decision: defer to Phase 4

**V1.1:** Parallel subagent execution. Multiple tasks dispatched simultaneously with progress tracking ("2/3 done, 1 running"). JJ workspace isolation becomes essential for parallel.

### 3. Done Phase

**Current state:** "Absolute dogshit." Artifacts write to wrong files (#063). JJ/git workflow has gaps (#064). No automated VCS close.

**V1 requirement:** Done phase automates the full close of a unit of work.

**The done sequence:**
1. Agent reviews and updates artifacts (correct locations, correct naming)
2. Agent reviews foundation docs and proposes updates where the completed work changes the picture
3. Agent updates changelog
4. Confirmation prompt: "Ready for final processes? [Lists: foundation doc updates, changelog, VCS close]" — user confirms or selects "discuss" to talk through any concerns
5. VCS close executes automatically:
   - **Local merge:** squash and merge to target branch
   - **Push/PR:** push branch and open PR
6. Issue is marked complete and archived

**Key details:**
- User chooses merge strategy (local merge vs push/PR) at done phase, not configured globally
- Foundation doc updates are proposed and user-approved before committing
- The entire close sequence is automated and regimented — user is not tasked with manual VCS operations
- Every workflow ends with a clean close. No "keep branch open" — if more work is needed, start a new issue.

### 4. Plan/Review as One Iterative Phase

**Current state:** Plan and review are separate phases. Plan generates once, review is a binary gate (approve/reject). No iteration, no conversation, no ruthless quality check.

**V1 requirement:** Plan/review is a single phase with an internal loop, modeled after the Momus pattern from oh-my-opencode.

**The loop:**
1. **Interview:** Agent asks clarifying questions about the work. Draws from foundation docs, issue description, and codebase context. Continues until requirements are clear.
2. **Draft plan:** Agent generates a structured plan with tasks, acceptance criteria, and file references.
3. **Review:** A separate model (configured, default GPT-5.2) reviews the plan against a concrete checklist:
   - Every task specifies WHERE (file references verified against codebase)
   - ≥90% of tasks have concrete, measurable acceptance criteria
   - No tasks require assumptions about business logic or unresolved ambiguities
   - Scope matches the issue (not over-engineered, not under-specified)
   - Test strategy is explicit for each task that modifies behavior
4. **Verdict:** OKAY → proceed to implement. REJECT → reviewer provides specific issues → planner fixes → back to step 3.
5. **No maximum retry limit.** Loop continues until OKAY or user intervenes.

**Autonomy with checkpoints:**
- The plan/review loop runs autonomously — planner drafts, reviewer reviews, planner fixes, repeat
- User is prompted when: the loop hits X passes, or reviewer score exceeds a threshold (e.g., >90%), or the planner believes it's ready
- User can intervene at any point ("task 3 is wrong", "add a task for X", "this is overscoped")

**Key details:**
- Planner and reviewer use different models and different prompts. The planner prompt optimizes for thoroughness and structure. The reviewer prompt optimizes for ruthless gap-finding.
- Plan artifact is saved only after OKAY verdict

### 5. Backward Transitions

**Current state:** Limited backward transitions exist but behavior is inconsistent. Going backward doesn't invalidate downstream state.

**V1 requirement:** Going backward invalidates everything downstream, with a warning.

- `phase_goto(target)` command with explicit reason requirement
- Before executing: warn user what will be invalidated ("Going back to spec will require re-doing plan/review and re-implementing. Proceed?")
- On confirm: downstream artifacts are marked stale (not deleted), downstream phase states reset
- You cannot skip phases on the way forward. Going back to spec means you MUST go through plan/review before implement.
- The warning explains exactly what will happen — no surprises

### 6. TDD Flexibility

**Current state:** TDD is enforced globally — production writes blocked until test file exists and test runner fails. No exceptions.

**V1 requirement:** TDD is the default but overridable.

- Default: TDD enforced (write test → run test → see it fail → write production code)
- Plan can mark specific tasks as `tdd: false` (e.g., config files, documentation, scaffolding)
- User can override per-task during implementation ("skip TDD for this task")
- When TDD is skipped, it's logged in the task artifact (explicit, not silent)

### 7. Issue Management

**Current state:** Issues are markdown files with frontmatter. Batch operations exist. No archiving process. No priority sorting. Mild UI issues.

**V1 requirement:** Issues are manageable at scale.

- **Priority sorting:** Issues have a priority field. There's a process (not just a field) for triaging and ordering issues — likely a `/mp triage` command or phase
- **Archiving:** Completed issues move to an archive directory with a standard process, not ad-hoc LLM requests
- **UI improvements:** Issue list shows priority, status, workflow type. Selection is clear and provides context.

---

## Init System Requirements

### Init Workflows

**Brownfield (7 phases):**
0. Audit → 1. Discovery → 2. Vision → 3. PRD → 4. Architecture → 5. Roadmap → 6. Issues

**Greenfield (6 phases):**
1. Discovery → 2. Vision → 3. PRD → 4. Architecture → 5. Roadmap → 6. Issues

Each phase:
- Is collaborative (agent asks questions, human answers, agent synthesizes, repeat)
- Produces a foundation document stored in `.megapowers/init/{project}/`
- Has a gate (specific conditions that must be met before advancing)
- Produces a process template stored in `.megapowers/init/process/` (written AFTER the phase is completed, capturing what was learned)
- Uses clean context windows — each phase starts fresh with only the previous phase's artifact as input

### Init vs Dev: Lighter Touch

The init system uses the same state machine engine as dev but is significantly simpler:
- No TDD enforcement, no write policy blocking, no subagent delegation, no task-level tracking
- Mostly: track which phase you're in, store the artifact, check the gate, advance
- Backward transitions are simpler — "go back and redo" without complex cascade invalidation
- The state machine engine must be general enough to accept different phase configs, with init and dev as two different configurations

### Foundation Doc Lifecycle

Foundation documents are **living documents**, not write-once artifacts.

- **During brainstorm:** Agent consults relevant foundation docs (vision, PRD, architecture) for grounding
- **During done:** Agent reviews foundation docs and proposes updates where the completed work changes the picture
- **On demand:** User can trigger a foundation doc revisit or full re-audit via explicit command (`/mp audit`, `/mp revisit`)
- Foundation doc updates follow a lightweight process: propose change → user approves → update doc → note the change and reason

---

## Version Roadmap

### V1.0 — The Machine Works
Everything above. Two systems (init + dev), four flavors (greenfield, brownfield, feature, bugfix), seven dev priorities delivered. The full lifecycle works end-to-end without gaps. You never hit `/mega off` because the tool broke.

### V1.1 — Learning Machine
- **Wisdom accumulation:** Task N+1 receives a summary of learnings from tasks 1..N
- **Parallel subagents:** Multiple tasks dispatched simultaneously with progress tracking
- **Ship reports:** Summary artifact at done phase capturing what was built, decisions made, and lessons learned

### V2 — Polish & Power
- Full TUI (rich interactive UI, not just text prompts)
- Metrics and reporting (cycle time, test coverage trends, defect rates)
- Deeper pi integration
- Automation (auto-triage, auto-prioritize, CI/CD integration)
- Configurable VCS strategies (beyond just merge/PR)
- Automated init option (less collaborative, more autonomous)

### V3 — Agent-Orchestratable
- Megapowers as a service — external agent orchestrators can drive it programmatically
- API for phase transitions, artifact retrieval, workflow status
- Multi-agent coordination with megapowers as the process layer

> **Note:** V2 and V3 may swap depending on which need becomes more urgent. If multi-agent coordination demand appears before polish matters, V3 ships first.

---

## FAQ

### External: How does it work?

**Q: How do I start a new project with megapowers?**
A: `pi install megapowers`, then `/mp init`. The init system walks you through audit (brownfield) or discovery (greenfield), then vision, PRD, architecture, roadmap, and issue creation. Each phase is collaborative — the agent asks, you answer, it synthesizes.

**Q: How do I work on an issue?**
A: Select an issue, megapowers assigns a workflow (feature or bugfix), and you walk through the phases. Brainstorm the approach, write a spec, iterate on a plan until it's approved, implement with TDD, verify, code review, done.

**Q: Can I skip phases?**
A: No. That's the point. Each phase has a gate. But phases scale — a trivial spec can be three lines. The gate is "it exists and answers the required questions," not "it's long."

**Q: What if I need to go back?**
A: You can go back to any earlier phase. Megapowers warns you that everything downstream becomes stale and must be redone. If you accept, it resets.

### Internal: What are the top 3 reasons V1 fails?

**1. Subagent reliability.**
If subagents can't complete tasks in jj workspaces and squash results back cleanly, the entire implement phase falls apart for any non-trivial plan. This is the highest-risk technical challenge.

*Mitigation:* Focus on sequential first. Get one subagent → one task → clean squash working perfectly before adding complexity. Use the pi example subagent extension as the reference implementation.

**2. UX remains unusable for anyone but the author.**
If the prompts, choices, and feedback don't improve dramatically, megapowers stays a personal tool that can't even be demonstrated, let alone adopted.

*Mitigation:* UX is priority #1 for a reason. Every feature should be evaluated through the lens of "could a stranger use this without reading source code?"

**3. Plan/review loop doesn't produce good plans.**
If the Momus-style review loop approves bad plans or rejects good ones, the entire downstream chain (implement → verify → done) suffers. Garbage in, garbage out.

*Mitigation:* The reviewer prompt and checklist must be tuned empirically. Start strict, loosen based on experience. The reviewer model matters — use a model known for critical analysis (GPT-5.2), not the same model that wrote the plan.

### Internal: What's technically hard?

- **JJ workspace isolation + squash:** The mechanics of creating a workspace, running a subagent in it, capturing the results, and squashing commits back to the parent workspace without conflicts or lost work.
- **Multi-model orchestration:** Plan/review loop uses different models for different roles. Managing API keys, model selection, prompt routing, and cost tracking across models within a single workflow.
- **Foundation doc lifecycle:** Knowing WHEN a completed issue changes a foundation doc and WHAT to update requires semantic understanding, not just file diffing. This needs good prompting, not automation.

### Internal: What assumptions must be true?

- pi's extension API is stable enough to build on without constant breakage
- jj's workspace feature is reliable enough for subagent isolation
- LLM quality (planning, reviewing, implementing) is sufficient for the workflow to produce net-positive results vs unstructured coding
- A single developer (Max) can build and maintain this while also using it to build real software

---

## Appetite

**Investment:** Open-ended. Max is willing to put in the work as long as the tool is effective.

**Kill signal:** Ineffectiveness. If megapowers makes building software harder or slower without a meaningful quality improvement, it's not working.

**Not a kill signal:** Effort required, time to V1, number of iterations. The goal is a tool that works, not a tool that ships fast.
