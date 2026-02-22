# Bugfix Mode — Pre-Flight Issues

Date: 2026-02-22

These issues were found during a pre-flight check before user-testing megapowers. Feature mode is fully wired and ready; bugfix mode has the state machine transitions defined but the supporting infrastructure is skeletal.

## Issues

### 1. No `reproduce` prompt template

`PHASE_PROMPT_MAP` maps `reproduce → "diagnose-bug.md"`, which says "You are diagnosing a bug." That's wrong for the reproduce phase — it should guide the LLM to help establish reliable reproduction steps, environment details, and expected vs actual behavior.

**Files:** `extensions/megapowers/prompts.ts`, `prompts/` (needs new `reproduce-bug.md`)

### 2. No `reproduce` gate

Gates don't check `reproduce→diagnose`. The transition always passes, meaning there's no enforcement that a reproduction was actually captured before moving to diagnosis.

**Files:** `extensions/megapowers/gates.ts`

### 3. No `reproduce` artifact routing

`artifact-router.ts` handles `diagnose` but not `reproduce`. LLM output during the reproduce phase won't be saved anywhere.

**Files:** `extensions/megapowers/artifact-router.ts`

### 4. `diagnose-bug.md` is sparse and has wrong template variable

Only 15 lines. References `{{diagnosis_content}}` which would be empty at diagnose time (it's the *output* of this phase, not input). Should reference `{{reproduce_content}}` or similar for the reproduction info gathered in the previous phase.

**Files:** `prompts/diagnose-bug.md`

### 5. Missing `diagnose→plan` gate

No gate checks that `diagnosis.md` exists before allowing transition from diagnose to plan. Could skip diagnosis entirely.

**Files:** `extensions/megapowers/gates.ts`

### 6. No `verify→done` gate for bugfix workflow

Bugfix goes verify→done directly (no code-review phase), but there's no `verify→done` gate. Should require verify.md to exist.

**Files:** `extensions/megapowers/gates.ts`
