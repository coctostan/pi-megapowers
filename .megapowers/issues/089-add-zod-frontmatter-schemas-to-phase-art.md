---
id: 89
type: feature
status: open
created: 2026-03-04T03:40:23.634Z
priority: 3
milestone: M5
---
# Add Zod frontmatter schemas to phase artifact files
## Problem

Phase artifacts (`brainstorm.md`, `spec.md`, `verify.md`, `code-review.md`) are plain markdown with no structured metadata. Gates like `NoOpenQuestionsGate` use fragile regex to extract structure from content. There's no validation that an artifact was written correctly.

## Proposed Solution

Add Zod schemas with YAML frontmatter to each artifact type, following the pattern already established by task files (`PlanTaskSchema`) and review files (`PlanReviewSchema`).

### Schemas (minimal metadata, system-written)

```typescript
const BrainstormSchema = z.object({ type: z.literal("brainstorm"), phase: z.literal("brainstorm") });
const SpecSchema = z.object({ type: z.literal("spec"), phase: z.literal("spec") });
const VerifySchema = z.object({ type: z.literal("verify"), phase: z.literal("verify"), verdict: z.enum(["pass", "fail"]) });
const CodeReviewSchema = z.object({ type: z.literal("code-review"), phase: z.literal("code-review") });
```

### Write flow

1. LLM writes markdown content via `write` tool (no frontmatter — LLM doesn't know about it)
2. Tool hook in `tool-overrides.ts` intercepts writes to `.megapowers/plans/<issue>/<artifact>.md`
3. System prepends frontmatter before saving — derives metadata from current phase context
4. Uses existing `serializeEntity()` from `entity-parser.ts`

### Read flow

1. `store.readArtifact(slug, name)` parses frontmatter via `parseFrontmatterEntity()` + schema
2. Returns `{ data: SchemaType, body: string }` or raw string fallback for backward compatibility
3. Gates can check `data.verdict === "pass"` instead of regex

### Edit handling

Not a concern — artifacts are full-writes (one per phase), not incremental edits. If `edit` is used on specific lines, frontmatter is preserved since edit only touches specified lines. If `write` is used (full overwrite), the tool hook re-injects frontmatter.

## Out of Scope

- Changing artifact content format (still LLM-generated markdown)
- Migrating existing artifact files (new format only for new writes)
- Issue file frontmatter migration (separate concern)
