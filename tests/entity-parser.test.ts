import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { parseFrontmatterEntity, serializeEntity } from "../extensions/megapowers/entity-parser.js";

const TestSchema = z.object({
  title: z.string(),
  count: z.number(),
});

describe("parseFrontmatterEntity", () => {
  it("parses valid frontmatter and returns success with data and content", () => {
    const markdown = `---
title: Hello
count: 42
---
## Body

Some content here.`;

    const result = parseFrontmatterEntity(markdown, TestSchema);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data).toEqual({ title: "Hello", count: 42 });
    expect(result.content).toContain("## Body");
    expect(result.content).toContain("Some content here.");
  });

  it("returns yaml error for malformed YAML frontmatter", () => {
    const markdown = `---
title: "unterminated
count: 1
---
Body text`;
    const result = parseFrontmatterEntity(markdown, TestSchema);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.errors[0].type).toBe("yaml");
  });

  it("returns missing_frontmatter error when no frontmatter delimiters", () => {
    const markdown = `# Just a heading

No frontmatter here.`;

    const result = parseFrontmatterEntity(markdown, TestSchema);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].type).toBe("missing_frontmatter");
  });

  it("returns validation errors with field and message for schema failures", () => {
    const markdown = `---
title: 123
---
Body`;

    const result = parseFrontmatterEntity(markdown, TestSchema);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.errors.length).toBeGreaterThanOrEqual(1);

    const titleError = result.errors.find((e) => e.field === "title");
    const countError = result.errors.find((e) => e.field === "count");
    expect(titleError).toBeDefined();
    expect(titleError!.type).toBe("validation");
    expect(typeof titleError!.message).toBe("string");
    expect(countError).toBeDefined();
    expect(countError!.type).toBe("validation");
    expect(typeof countError!.message).toBe("string");
  });
});

describe("serializeEntity", () => {
  it("produces markdown that roundtrips through parseFrontmatterEntity", () => {
    const data = { title: "Hello", count: 42 };
    const content = "## Body\n\nSome content here.\n";

    const serialized = serializeEntity(data, content, TestSchema);
    expect(typeof serialized).toBe("string");
    expect(serialized).toContain("---");

    const parsed = parseFrontmatterEntity(serialized, TestSchema);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("unreachable");
    expect(parsed.data).toEqual(data);
    expect(parsed.content.trimStart()).toBe(content);
  });

  it("throws when data fails schema validation", () => {
    const invalidData = { title: 123 } as any; // missing count, wrong type
    expect(() => serializeEntity(invalidData, "body", TestSchema)).toThrow(
      /Invalid entity data/,
    );
  });
});
