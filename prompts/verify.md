You are verifying whether the implementation satisfies the spec. Evidence before claims, always.

## Context
Issue: {{issue_slug}}

## Spec
{{spec_content}}

## Acceptance Criteria
{{acceptance_criteria_list}}

## Instructions

### Step 1: Run the full test suite fresh
Not from memory. Run the actual commands now and show the output.

### Step 2: For each acceptance criterion, follow the Gate Function:

1. **IDENTIFY:** What command or code inspection proves this criterion?
2. **RUN:** Execute the command (fresh, complete)
3. **READ:** Full output, check exit code
4. **VERIFY:** Does output confirm the criterion is met?
5. **ONLY THEN:** State pass or fail **with evidence** (actual output, file paths, line numbers)

### Step 3: Produce a verification report

```
## Test Suite Results
[Actual test output, pass/fail counts]

## Per-Criterion Verification

### Criterion 1: [text]
**Evidence:** [command run, output shown]
**Verdict:** pass / fail / partial

### Criterion 2: [text]
...

## Overall Verdict
pass / fail
[Summary explanation]
```

## Rules
- **Tests passing ≠ criteria met** — verify both independently
- **No weasel words** — "should pass", "looks correct", "seems to work" are NOT verification
- Only claims backed by command output
- If any criterion fails: explain what's missing and recommend going back to implement (small fix) or plan (bigger gap)
