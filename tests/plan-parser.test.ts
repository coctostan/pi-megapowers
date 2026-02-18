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
    expect(tasks[0]).toEqual({ index: 1, description: "Set up the database schema", completed: false });
    expect(tasks[3]).toEqual({ index: 4, description: "Add error handling", completed: false });
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
    expect(tasks[0]).toEqual({ index: 1, description: "Database Schema", completed: false });
    expect(tasks[2]).toEqual({ index: 3, description: "Tests", completed: false });
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
});
