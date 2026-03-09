# Verification Report — #118

## Test Suite Results

```
bun test
 923 pass
 0 fail
 2190 expect() calls
Ran 923 tests across 93 files. [1287.00ms]
```

Targeted #118 contract suite:
```
bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
 7 pass
 59 filtered out
 0 fail
 21 expect() calls
Ran 7 tests across 1 file. [19.00ms]
```

---

## Per-Criterion Verification

### Criterion 1: `brainstorm.md` instructs mode triage between `Exploratory` and `Direct requirements`
**Evidence:**
```
grep -n "Exploratory\|Direct requirements\|Start by triaging" prompts/brainstorm.md
14:## Start by triaging the mode
18:### Exploratory
24:### Direct requirements
86:- `Exploratory`
87:- `Direct requirements`
```
`prompts/brainstorm.md` line 14 has `## Start by triaging the mode`, with `### Exploratory` at line 18 and `### Direct requirements` at line 24.
**Verdict:** ✅ pass

---

### Criterion 2: `brainstorm.md` requires explicit requirement IDs `R#`, `O#`, `D#`, `C#`, `Q#`
**Evidence:**
```
grep -n "R#\|O#\|D#\|C#\|Q#" prompts/brainstorm.md
55:- **Must-Have Requirement** (`R#`)
56:- **Optional / Nice-to-Have** (`O#`)
57:- **Explicitly Deferred** (`D#`)
58:- **Constraint** (`C#`)
59:- **Open Question** (`Q#`)
135:- every important user-stated behavior appears as `R#`, `O#`, `D#`, `C#`, or `Q#`
```
All five ID types explicitly defined in the "Core rule: preserve requirements explicitly" section.
**Verdict:** ✅ pass

---

### Criterion 3: `brainstorm.md` requires reduced-scope items preserved as `O#`/`D#` rather than silently dropped
**Evidence:**
```
grep -n "silently drop\|scope is reduced\|scoped-down\|preserve" prompts/brainstorm.md
61:Do **not** silently drop or blur a concrete user request.
63:If scope is reduced, preserve the removed item explicitly as optional or deferred rather than letting it disappear.
137:- scoped-down items are still preserved
164:- if scope is reduced, preserve what was reduced
```
Lines 61 and 63 state the rule explicitly; lines 137 and 164 reinforce it in before-saving checks and key principles.
**Verdict:** ✅ pass

---

### Criterion 4: `brainstorm.md` defines exact artifact sections in order
**Evidence:**
```
grep -n "## Goal\|## Mode\|## Must-Have Requirements\|## Optional / Nice\|## Explicitly Deferred\|## Constraints\|## Open Questions\|## Recommended Direction\|## Testing Implications" prompts/brainstorm.md
81:## Goal
84:## Mode
91:## Must-Have Requirements
100:## Optional / Nice-to-Have
105:## Explicitly Deferred
110:## Constraints
120:## Open Questions
124:## Recommended Direction
129:## Testing Implications
```
All nine required sections appear in the specified order.
**Verdict:** ✅ pass

---

### Criterion 5: `write-spec.md` requires a `Requirement Traceability` section mapping every `R#`
**Evidence:**
```
grep -n "Requirement Traceability" prompts/write-spec.md
90:## Requirement Traceability
103:- every `R#` must appear exactly once
```
Section `## Requirement Traceability` at line 90 with the every-R# rule at line 103.
**Verdict:** ✅ pass

---

### Criterion 6: `write-spec.md` requires a `No silent drops` rule — no `R#` may be omitted
**Evidence:**
```
grep -n "No silent drops\|R# may be omitted" prompts/write-spec.md
21:## No silent drops
103:- every `R#` must appear exactly once
104:- no `R#` may be omitted
```
Lines 21, 103, and 104 explicitly establish the no-omit rule.
**Verdict:** ✅ pass

---

### Criterion 7: `write-spec.md` includes `O#`, `D#`, `C#` in traceability when they materially affect scope
**Evidence:**
```
grep -n "O#\|D#\|C#" prompts/write-spec.md
32:Some older brainstorm artifacts may be prose-heavy and may not use `R# / O# / D# / C# / Q#`.
105:- include `O#`, `D#`, and `C#` when they materially affect scope or implementation
```
Line 105 explicitly names `O#`, `D#`, and `C#` with the "materially affect scope" qualifier.
**Verdict:** ✅ pass

---

### Criterion 8: `write-spec.md` includes legacy handling for unstructured brainstorm artifacts
**Evidence:**
```
grep -n "Legacy handling\|older brainstorm artifacts\|prior artifact is unstructured\|extract the implied\|confirmation" prompts/write-spec.md
31:## Legacy handling
32:Some older brainstorm artifacts may be prose-heavy and may not use `R# / O# / D# / C# / Q#`.
34:If the prior artifact is unstructured:
35:- extract the implied requirements and scope items first
36:- present that extraction to the user for confirmation
37:- then write the spec
```
`## Legacy handling` at line 31; lines 34–37 mandate extract → confirm → spec flow.
**Verdict:** ✅ pass

---

### Criterion 9: `write-spec.md` requires reduced-scope items remain visible instead of disappearing
**Evidence:**
```
grep -n "reduced-scope\|remain visible" prompts/write-spec.md
29:Optional, deferred, and constraint items should also remain visible when they materially affect scope or acceptance criteria.
118:- every `R#` appears in `Requirement Traceability`
120:- reduced-scope items remain visible instead of disappearing
```
Line 120 directly: "reduced-scope items remain visible instead of disappearing".
**Verdict:** ✅ pass

---

### Criterion 10: Prompt tests lock in brainstorm contract (mode triage, required sections, R/O/D/C/Q buckets, scope-preservation language)
**Evidence:**
```
bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
 7 pass, 0 fail
```
Four brainstorm assertions verified by name in `tests/prompts.test.ts` lines 456–483:
- "brainstorm prompt includes Exploratory and Direct requirements modes" (toContain Exploratory, Direct requirements)
- "brainstorm prompt includes required requirement sections" (toContain Must-Have Requirements, Optional / Nice-to-Have, Explicitly Deferred, Constraints, Open Questions)
- "brainstorm prompt preserves reduced scope instead of dropping it" (toMatch /if scope is reduced|scoped-down items/i + /preserve|rather than letting it disappear|do not silently drop/i)
- "brainstorm prompt includes R/O/D/C/Q requirement ID buckets" (toContain R#, O#, D#, C#, Q#)

All pass.
**Verdict:** ✅ pass

---

### Criterion 11: Prompt tests lock in spec contract (No silent drops, Requirement Traceability, every R# exactly once, legacy handling, reduced-scope visibility)
**Evidence:**
Three spec assertions verified by name in `tests/prompts.test.ts` lines 484–499:
- "write-spec prompt includes no-silent-drops and traceability requirements" (toContain "No silent drops", "Requirement Traceability", "every `R#` must appear exactly once")
- "write-spec prompt includes legacy handling for older unstructured brainstorm artifacts" (toMatch /older brainstorm artifacts|prior artifact is unstructured/i, /R# \/ O# \/ D# \/ C# \/ Q#|extract the implied requirements/i)
- "write-spec prompt says reduced-scope items remain visible" (toMatch /reduced-scope|reduced scope/i, /remain visible|instead of disappearing|do not silently lose/i)

All 7 #118 tests pass (7 pass, 0 fail confirmed above).
**Verdict:** ✅ pass

---

### Criterion 12: External workflow phase name remains `brainstorm` — no rename
**Evidence:**
```
# state-machine.ts type definition:
export type FeaturePhase = "brainstorm" | "spec" | "plan" | "review" | "implement" | "verify" | "code-review" | "done";

# write-spec.md workflow breadcrumb (line 6):
> **Workflow:** brainstorm → **spec** → plan → implement → verify → code-review → done

# README.md (line 17):
**Feature:** `brainstorm → spec → plan → implement → verify → code-review → done`
```
The phase identifier `"brainstorm"` is unchanged in the type definition, prompt workflow breadcrumb, and README.
**Verdict:** ✅ pass

---

### Criterion 13: README and CHANGELOG reflect the updated brainstorm/spec model
**Evidence:**
```
bash -lc '
  grep -Fq "phase name is kept for compatibility" README.md &&
  grep -Fq "preserve explicit requirements" README.md &&
  grep -Fq "acceptance criteria with traceability" README.md &&
  grep -Fq "No silent drops" CHANGELOG.md &&
  grep -Fq "Requirement Traceability" CHANGELOG.md &&
  grep -Fq "older unstructured brainstorm artifacts" CHANGELOG.md &&
  grep -Fq "(#118)" CHANGELOG.md &&
  echo "ALL CHECKS PASSED"'

ALL CHECKS PASSED
```
README line 23 contains the requirements-first model note. CHANGELOG `## [Unreleased]` → `### Changed` line 8 has the full #118 entry.
**Verdict:** ✅ pass

---

## Overall Verdict

**pass**

All 13 acceptance criteria verified with direct command output from this session. The implementation is prompt-and-test-only (no runtime logic changed), and the full 923-test suite passes cleanly. The 7 targeted `#118` prompt-contract tests individually cover every required brainstorm and spec contract element.
