import { describe, it, expect } from "bun:test";
import { extractAcceptanceCriteria, hasOpenQuestions, extractFixedWhenCriteria } from "../extensions/megapowers/spec-parser.js";

describe("extractAcceptanceCriteria", () => {
  it("extracts numbered criteria from ## Acceptance Criteria section", () => {
    const spec = `# Feature Spec

## Goal
Build the thing.

## Acceptance Criteria
1. User can create a new account with email and password
2. System validates email format before submission
3. User sees an error message when email is invalid
4. Successful registration redirects to the dashboard

## Out of Scope
- Social login
`;
    const criteria = extractAcceptanceCriteria(spec);
    expect(criteria).toHaveLength(4);
    expect(criteria[0]).toEqual({
      id: 1,
      text: "User can create a new account with email and password",
      status: "pending",
    });
    expect(criteria[3]).toEqual({
      id: 4,
      text: "Successful registration redirects to the dashboard",
      status: "pending",
    });
  });

  it("handles criteria with markdown formatting", () => {
    const spec = `## Acceptance Criteria
1. **User** can _log in_ with \`valid credentials\`
2. System returns a **JWT token** on success
`;
    const criteria = extractAcceptanceCriteria(spec);
    expect(criteria).toHaveLength(2);
    expect(criteria[0].text).toBe("**User** can _log in_ with `valid credentials`");
  });

  it("stops at the next ## heading", () => {
    const spec = `## Acceptance Criteria
1. First criterion
2. Second criterion

## Out of Scope
1. This should not be included
`;
    const criteria = extractAcceptanceCriteria(spec);
    expect(criteria).toHaveLength(2);
  });

  it("returns empty array when no Acceptance Criteria section", () => {
    const spec = `# Spec\n\nJust some text.`;
    expect(extractAcceptanceCriteria(spec)).toEqual([]);
  });

  it("returns empty array when section is empty", () => {
    const spec = `## Acceptance Criteria\n\n## Out of Scope\n- stuff`;
    expect(extractAcceptanceCriteria(spec)).toEqual([]);
  });

  it("handles criteria with multi-line continuation (ignores sub-items)", () => {
    const spec = `## Acceptance Criteria
1. First criterion
   - Detail about first
   - More detail
2. Second criterion
`;
    const criteria = extractAcceptanceCriteria(spec);
    expect(criteria).toHaveLength(2);
    expect(criteria[0].text).toBe("First criterion");
  });
});

describe("hasOpenQuestions", () => {
  it("returns false when no Open Questions section", () => {
    const spec = `## Goal\nBuild it.\n\n## Acceptance Criteria\n1. It works`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns false when Open Questions section is empty", () => {
    const spec = `## Acceptance Criteria\n1. It works\n\n## Open Questions\n`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns true when Open Questions has content", () => {
    const spec = `## Acceptance Criteria\n1. It works\n\n## Open Questions\n- What about edge case X?`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });
});

describe("hasOpenQuestions — sentinel detection", () => {
  const sentinels = [
    "None", "None.", "N/A", "n/a", "No open questions", "No open questions.",
    "(none)", "(None)", "- None", "- N/A", "1. None", "* None",
  ];

  for (const sentinel of sentinels) {
    it(`returns false for "${sentinel}"`, () => {
      const spec = `## Acceptance Criteria\n1. Works\n\n## Open Questions\n${sentinel}\n`;
      expect(hasOpenQuestions(spec)).toBe(false);
    });
  }

  it("returns false for empty section", () => {
    const spec = `## Acceptance Criteria\n1. Works\n\n## Open Questions\n\n## Out of Scope\n`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns false for non-list commentary without question marks", () => {
    const spec = `## Open Questions\nNo outstanding questions at this time.\n`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns true for list items with question marks", () => {
    const spec = `## Open Questions\n- What about edge case X?\n- Should we support Y?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });

  it("returns true for numbered items with question marks", () => {
    const spec = `## Open Questions\n1. How should we handle auth?\n2. What's the migration path?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });

  it("returns false for list items without question marks", () => {
    const spec = `## Open Questions\n- None at this time\n- All resolved\n`;
    expect(hasOpenQuestions(spec)).toBe(false);
  });

  it("returns true when mix of sentinel and real question", () => {
    const spec = `## Open Questions\n- None\n- But what about caching?\n`;
    expect(hasOpenQuestions(spec)).toBe(true);
  });
});

describe("extractFixedWhenCriteria", () => {
  it("extracts numbered criteria from ## Fixed When section", () => {
    const diagnosis = `# Diagnosis\n\n## Root Cause\nThe regex is wrong.\n\n## Fixed When\n1. Parser correctly handles multi-line input\n2. Edge case with empty string returns empty array\n`;
    const criteria = extractFixedWhenCriteria(diagnosis);
    expect(criteria).toHaveLength(2);
    expect(criteria[0]).toEqual({ id: 1, text: "Parser correctly handles multi-line input", status: "pending" });
    expect(criteria[1]).toEqual({ id: 2, text: "Edge case with empty string returns empty array", status: "pending" });
  });

  it("returns empty array when no Fixed When section", () => {
    const diagnosis = `# Diagnosis\n\n## Root Cause\nSomething is broken.`;
    expect(extractFixedWhenCriteria(diagnosis)).toEqual([]);
  });

  it("returns empty array when Fixed When section is empty", () => {
    const diagnosis = `## Fixed When\n\n## Risk Assessment\nLow risk.`;
    expect(extractFixedWhenCriteria(diagnosis)).toEqual([]);
  });

  it("stops at the next ## heading", () => {
    const diagnosis = `## Fixed When\n1. First criterion\n2. Second criterion\n\n## Risk Assessment\n1. This should not be included\n`;
    const criteria = extractFixedWhenCriteria(diagnosis);
    expect(criteria).toHaveLength(2);
  });
});
