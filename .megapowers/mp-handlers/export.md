# Export Handler [STUB]

> **Status:** Designed, not fully implemented. Can bundle existing artifacts, but lacks transition log, versioned artifacts, and structured timeline.

## What It Will Do
Export the full decision chain for an issue — every artifact, every transition, bundled into a portable package. The audit trail. Peter Gregory's "diamond mine."

## What Works Now
Can collect whatever artifact files exist for an issue and copy them to an export directory. Basic file bundling.

## What's Missing
- **Transition log:** No timestamped phase transitions → timeline is reconstructed from file timestamps (unreliable)
- **Artifact versioning (#041):** Artifacts overwrite on revision → export only captures final version, not the decision history (spec v1 → v2 → v3)
- **Structured timeline:** No machine-readable event log → can't build a proper chronological narrative
- **JSON schema:** No defined schema for programmatic export → ad-hoc structure
- **Bundle integrity:** No checksums or manifest → can't verify export completeness

## Syntax (Planned)
```
/mp export              → current issue, markdown bundle
/mp export <issue-slug> → specific issue
/mp export --json       → JSON format for programmatic use
```

## Output (Planned)

**Markdown:** `.megapowers/exports/NNN-<slug>/`
```
README.md           — index + summary
issue.md            — original issue
brainstorm.md       — brainstorm artifact
spec.md             — spec (+ spec.v1.md, spec.v2.md if versioned)
plan.md             — plan (+ versions)
verify.md           — verification results
code-review.md      — review findings
ship-report.md      — ship report
learnings.md        — learnings scoped to this issue
timeline.md         — chronological phase transitions
manifest.json       — file list + checksums
```

**JSON:** `.megapowers/exports/NNN-<slug>.json`
```json
{
  "issue": { "id": N, "title": "...", "type": "feature" },
  "workflow": "feature",
  "artifacts": { "brainstorm": "...", "spec": "...", ... },
  "timeline": [
    { "phase": "brainstorm", "entered": "...", "exited": "..." },
    ...
  ],
  "learnings": [...],
  "metrics": { "totalTime": "...", "phases": N }
}
```

## Dependencies
- Transition log with timestamps (feeds timeline)
- Artifact versioning (#041) (feeds revision history)
- Ship report (feeds summary)
- JSON schema definition

## Interim
Can copy existing artifact files to an export directory. No timeline, no versioning, no JSON. Ask: "bundle all artifacts for the current issue into .megapowers/exports/."
