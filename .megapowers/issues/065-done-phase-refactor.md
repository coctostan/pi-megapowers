---
id: 65
type: feature
status: open
created: 2026-02-24T00:21:00.000Z
---

# Done phase refactor — reliable artifact capture and wrap-up flow

## Problem

The done phase is unreliable and architecturally flawed. Artifacts sometimes get written, sometimes don't. The capture mechanism is fragile, the menu UX is clunky, and learnings are effectively broken.

### Bug catalog

#### 1. `appendLearnings()` is dead code
`store.appendLearnings(issueSlug, entries)` exists but has zero callers outside tests. The capture-learnings mode tells the user to manually `/learn` each entry individually — tedious and rarely done in practice. Result: learnings almost never get captured.

#### 2. No approval/save flow for capture-learnings
The LLM proposes learnings, user reviews... then nothing happens. `doneMode` intentionally stays set (line 274 of index.ts), presumably waiting for approval, but there's no approval mechanism. No handler ever persists the proposed learnings.

#### 3. Artifact capture via message scraping is fragile
The current flow: `doneMode` controls which prompt template gets injected → LLM responds → `agent_end` scrapes the last assistant message → checks `text.length > 100` → writes to file.

Failure modes:
- Short responses silently dropped (< 100 chars)
- If the LLM uses tool calls instead of a text response, nothing is captured
- If `agent_end` fires before the LLM finishes (race), nothing is captured
- The assistant message extraction depends on message structure assumptions

This is a Rube Goldberg machine. `megapowers_save_artifact` already exists as a reliable, LLM-driven persistence mechanism.

#### 4. Menu is one-action-then-exit
Every done menu selection sets `continueMenu = false` and breaks the loop. To perform multiple wrap-up actions, the user must re-invoke `/done` each time. Should either loop naturally or track completion state.

#### 5. Redundant menu options
"Close issue" and "Done — finish without further actions" execute identical code — both call `closeSourceIssues()`, `updateIssueStatus()`, and `createInitialState()`.

#### 6. No tracking of completed wrap-up actions
The menu shows the same options every time. User can accidentally generate the feature doc twice or never realize they forgot learnings. `doneMode` gets nulled after each action, losing history.

#### 7. Existing issue: artifacts write to wrong files (#063)
Filed separately but likely same root cause — the message scraping approach doesn't reliably match content to target files.

## Desired Behavior

### Architecture: LLM-driven artifact saving (not message scraping)

Eliminate the `agent_end` message scraping entirely. Instead:

1. Done mode sets the prompt template (this part works fine)
2. LLM generates the content
3. **LLM calls `megapowers_save_artifact`** to persist it (already exists, just underused)
4. For learnings specifically: LLM proposes → user confirms → LLM calls a save mechanism

This aligns with how every other phase works — the LLM produces content and saves it via the artifact tool.

### Learnings flow

Option A — extend `megapowers_save_artifact`:
- LLM calls `megapowers_save_artifact` with `phase: "learnings"` and content as a markdown list
- Handler parses the list and calls `appendLearnings(issueSlug, entries)`
- Prompt instructs: "Present learnings to user for review. When approved, save via megapowers_save_artifact."

Option B — new `megapowers_signal` action:
- `action: "save_learnings"` with entries in the payload
- Keeps artifact tool for file-shaped content, signal for structured data

Recommendation: **Option A** — simpler, fewer new concepts. The artifact tool already handles per-phase content.

### Done menu improvements

1. **Track completed actions** — add `doneActionsCompleted: string[]` to state (or derive from which artifact files exist)
2. **Show completion status** — mark completed actions with ✓ in the menu
3. **Loop the menu** — don't exit after each action. Stay in the loop until user selects "Finish"
4. **Remove redundant option** — collapse "Close issue" and "Done — finish" into one "Close issue & finish" option
5. **Recommended flow** — on first entry to done phase, auto-suggest: learnings → docs/summary → changelog → close

### Prompt updates

Each done-mode prompt should end with:
```
When the content is finalized, save it using `megapowers_save_artifact` with phase "<phase-name>".
```

The capture-learnings prompt specifically should say:
```
Present the learnings to the user. When they approve (or edit), save using `megapowers_save_artifact` with phase "learnings".
```

## Implementation scope

### Must have
- Wire `megapowers_save_artifact` phase "learnings" to call `appendLearnings()`
- Update done-mode prompts to instruct LLM to use `megapowers_save_artifact`
- Remove `agent_end` message scraping for done-mode artifacts
- Fix capture-learnings flow end-to-end
- Remove redundant "Close issue" menu option

### Should have
- Track completed wrap-up actions in state
- Show ✓ markers on completed actions
- Loop the menu instead of one-action-then-exit

### Nice to have
- Auto-suggest recommended wrap-up order
- Derive completion status from artifact file existence (no state changes needed)

## Files involved
- `extensions/megapowers/index.ts` — remove `agent_end` done-mode scraping block (lines 260-278)
- `extensions/megapowers/tool-artifact.ts` — add learnings handler for phase "learnings"
- `extensions/megapowers/ui.ts` — `handleDonePhase()` menu loop, completion tracking, dedup options
- `extensions/megapowers/state-machine.ts` — possibly add `doneActionsCompleted` to state (or derive)
- `prompts/capture-learnings.md` — add save instruction
- `prompts/generate-docs.md` — add save instruction
- `prompts/generate-bugfix-summary.md` — add save instruction
- `prompts/write-changelog.md` — add save instruction

## Relationship to other issues
- **Supersedes #063** (done phase artifacts write to wrong files) — same root cause
- **Depends on nothing** — can be done independently
- **#064** (jj bookmark/push) adds squash + push to the done phase but is orthogonal to this refactor
