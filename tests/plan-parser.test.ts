import { describe, it, expect } from "bun:test";
import { extractPlanTasks, type PlanTask } from "../extensions/megapowers/plan-parser.js";

describe("extractPlanTasks", () => {
  it("extracts numbered tasks from markdown", () => {
    const plan = `# Implementation Plan

Some intro text.

## Tasks

1. Set up the database schema
2. Create the API endpoint for auth
3. Write integration tests
4. Add error handling
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(4);
    expect(tasks[0]).toEqual({ index: 1, description: "Set up the database schema", completed: false, noTest: false });
    expect(tasks[3]).toEqual({ index: 4, description: "Add error handling", completed: false, noTest: false });
  });

  it("handles task lines with sub-content", () => {
    const plan = `## Tasks

1. First task
   - Some detail
   - Another detail
2. Second task
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].description).toBe("First task");
  });

  it("handles markdown formatting in task text", () => {
    const plan = `1. **Bold task** with \`code\` in it
2. *Italic task*
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].description).toBe("**Bold task** with `code` in it");
  });

  it("returns empty array for plan with no numbered items", () => {
    const plan = "# Plan\n\nJust some text, no tasks.";
    expect(extractPlanTasks(plan)).toEqual([]);
  });

  it("handles plans with ### Task N: headers", () => {
    const plan = `### Task 1: Database Schema

Details...

### Task 2: API Endpoint

Details...

### Task 3: Tests

Details...
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toEqual({ index: 1, description: "Database Schema", completed: false, noTest: false });
    expect(tasks[2]).toEqual({ index: 3, description: "Tests", completed: false, noTest: false });
  });

  it("prefers ### Task headers over numbered lists when both exist", () => {
    const plan = `### Task 1: Big Feature

1. Sub-step one
2. Sub-step two

### Task 2: Another Feature

1. Sub-step
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].description).toBe("Big Feature");
  });

  it("extracts [no-test] tag from task headers", () => {
    const plan = `### Task 1: Define config schema [no-test]

Details...

### Task 2: Implement retry logic

Details...
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].noTest).toBe(true);
    expect(tasks[0].description).toBe("Define config schema");
    expect(tasks[1].noTest).toBe(false);
  });

  it("extracts [no-test] tag from numbered list items", () => {
    const plan = `## Tasks

1. Define retry config schema [no-test]
2. Implement retry logic with backoff
3. Add type definitions [no-test]
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].noTest).toBe(true);
    expect(tasks[0].description).toBe("Define retry config schema");
    expect(tasks[1].noTest).toBe(false);
    expect(tasks[2].noTest).toBe(true);
  });

  it("tasks without [no-test] default to noTest: false", () => {
    const plan = `### Task 1: Regular task

Details...
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks[0].noTest).toBe(false);
  });

  it("parses [no-test] case-insensitively in headers (uppercase)", () => {
    const plan = `### Task 1: Define config schema [NO-TEST]

Details...

### Task 2: Implement logic

Details...
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks[0].noTest).toBe(true);
    expect(tasks[0].description).toBe("Define config schema");
    expect(tasks[1].noTest).toBe(false);
  });

  it("parses [no-test] case-insensitively in numbered list items (mixed case)", () => {
    const plan = `1. Define retry config schema [No-Test]
2. Implement retry logic
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks[0].noTest).toBe(true);
    expect(tasks[0].description).toBe("Define retry config schema");
    expect(tasks[1].noTest).toBe(false);
  });

  it("extracts [depends: N, M] from task headers", () => {
    const plan = `### Task 1: Set up types

Details...

### Task 2: Build auth module [depends: 1]

Details...

### Task 3: Build logging module

Details...

### Task 4: Integration tests [depends: 2, 3]

Details...
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(4);
    expect(tasks[0].dependsOn).toBeUndefined();
    expect(tasks[1].dependsOn).toEqual([1]);
    expect(tasks[2].dependsOn).toBeUndefined();
    expect(tasks[3].dependsOn).toEqual([2, 3]);
  });

  it("extracts [depends: N] from numbered list items", () => {
    const plan = `1. Set up types
2. Build auth [depends: 1]
3. Build logging
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks[0].dependsOn).toBeUndefined();
    expect(tasks[1].dependsOn).toEqual([1]);
    expect(tasks[2].dependsOn).toBeUndefined();
  });

  it("parses [depends: ...] case-insensitively", () => {
    const plan = `### Task 1: Base types

### Task 2: Auth module [Depends: 1]
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks[1].dependsOn).toEqual([1]);
  });

  it("combines [no-test] and [depends: N] annotations", () => {
    const plan = `### Task 1: Config schema [no-test]

### Task 2: Logic [depends: 1]

### Task 3: Types [no-test] [depends: 1]
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks[0].noTest).toBe(true);
    expect(tasks[0].dependsOn).toBeUndefined();
    expect(tasks[1].noTest).toBe(false);
    expect(tasks[1].dependsOn).toEqual([1]);
    expect(tasks[2].noTest).toBe(true);
    expect(tasks[2].dependsOn).toEqual([1]);
  });

  it("existing plans without [depends:] parse identically (backward compat)", () => {
    const plan = `### Task 1: Database Schema

Details...

### Task 2: API Endpoint

Details...
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toEqual({ index: 1, description: "Database Schema", completed: false, noTest: false });
    expect(tasks[1]).toEqual({ index: 2, description: "API Endpoint", completed: false, noTest: false });
  });

  it("ignores ### Task N: headers inside fenced code blocks", () => {
    const plan = `### Task 1: Real task one

Some description.

\`\`\`markdown
### Task 2: Fake task inside code block

This should be ignored.
\`\`\`

### Task 2: Real task two

More description.

\`\`\`typescript
// ### Task 3: Another fake task
\`\`\`
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].description).toBe("Real task one");
    expect(tasks[1].description).toBe("Real task two");
  });

  it("ignores numbered list items inside fenced code blocks", () => {
    const plan = `\`\`\`
1. Fake item in code block
2. Another fake item
\`\`\`

1. Real first task
2. Real second task
`;
    const tasks = extractPlanTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].description).toBe("Real first task");
    expect(tasks[1].description).toBe("Real second task");
  });
});
