import matter from "gray-matter";
import { stringify as yamlStringify } from "yaml";
import type { ZodType } from "zod";

export interface EntityDoc<T> {
  data: T;
  content: string;
}

/**
 * Parse frontmatter markdown into a typed entity document.
 * Returns EntityDoc<T> on success, { error } on parse/validation failure, null is unused here
 * (callers check file existence separately and pass null for not-found).
 */
export function parseFrontmatterEntity<T>(
  markdown: string,
  schema: ZodType<T>,
): EntityDoc<T> | { error: string } {
  let parsed: { data: Record<string, unknown>; content: string };
  try {
    parsed = matter(markdown);
  } catch (e) {
    return { error: `Failed to parse frontmatter: ${e instanceof Error ? e.message : String(e)}` };
  }

  // gray-matter returns empty data when there's no frontmatter delimiter
  if (!markdown.trimStart().startsWith("---")) {
    return { error: "No frontmatter found (missing --- delimiters)" };
  }

  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { error: `Schema validation failed: ${issues}` };
  }

  return {
    data: result.data,
    content: parsed.content.trim(),
  };
}

/**
 * Serialize data and markdown body into frontmatter markdown.
 */
export function serializeEntity<T extends Record<string, unknown>>(data: T, content: string): string {
  const yaml = yamlStringify(data).trim();
  return `---\n${yaml}\n---\n\n${content}\n`;
}
