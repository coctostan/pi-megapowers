import { describe, it, expect } from "bun:test";
import { extractAcceptanceCriteria, hasOpenQuestions } from "../extensions/megapowers/spec-parser.js";

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
