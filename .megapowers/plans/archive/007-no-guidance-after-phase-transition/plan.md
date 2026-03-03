# Plan: Show phase guidance in dashboard and transition notification

### Task 1: Add `PHASE_GUIDANCE` map and show guidance in `renderDashboardLines`

**Modify:** `extensions/megapowers/ui.ts`  
**Test:** Existing test `"shows phase instruction in dashboard after transition"` — expects dashboard to contain "send" when in spec phase  
**What:** Add a `PHASE_GUIDANCE` map (phase → short instruction) and a conditional block in `renderDashboardLines` that shows guidance for phases without their own specific content (brainstorm, spec, plan, review, reproduce, diagnose, verify, code-review).

### Task 2: Enhance transition notification with phase guidance

**Modify:** `extensions/megapowers/ui.ts`  
**Depends on:** Task 1 (reuses `PHASE_GUIDANCE`)  
**Test:** Existing test `"provides phase-specific guidance after transition"` — expects notification to contain "send" after brainstorm→spec transition  
**What:** Replace `"Transitioned to: spec"` with `"Transitioned to: spec. Send a message to write the spec."` by appending the guidance from the map.