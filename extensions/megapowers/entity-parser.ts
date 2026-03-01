import matter from "gray-matter";
import { z } from "zod";

export interface ParseError {
  type: "yaml" | "missing_frontmatter" | "validation";
  field?: string;
  message?: string;
}

export type ParseResult<T> =
  | { success: true; data: T; content: string }
  | { success: false; errors: ParseError[] };

export function parseFrontmatterEntity<T>(
  markdown: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  if (!markdown.trimStart().startsWith("---")) {
    return { success: false, errors: [{ type: "missing_frontmatter" }] };
  }
  let parsed: any;
  try {
    parsed = matter(markdown);
  } catch (err: any) {
    return { success: false, errors: [{ type: "yaml", message: err?.message }] };
  }
  const validation = schema.safeParse(parsed.data);

  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.issues.map((issue) => ({
        type: "validation" as const,
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  return { success: true, data: validation.data, content: parsed.content };
}

export function serializeEntity<T>(
  data: T,
  content: string,
  schema: z.ZodType<T>,
): string {
  const validation = schema.safeParse(data);
  if (!validation.success) {
    throw new Error(
      `Invalid entity data: ${validation.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`,
    );
  }
  return matter.stringify(content, validation.data as Record<string, unknown>);
}
