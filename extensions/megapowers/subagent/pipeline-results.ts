import type { DispatchResult } from "./dispatcher.js";
import { extractFilesChanged, extractFinalOutput, extractTestsPassed } from "./message-utils.js";
import type { TddComplianceReport } from "./tdd-auditor.js";
import matter from "gray-matter";
import { ReviewFrontmatterSchema } from "./pipeline-schemas.js";

export interface ImplementResult {
  filesChanged: string[];
  tddReport: TddComplianceReport;
  error?: string;
}

export interface StepResult {
  filesChanged: string[];
  testsPassed: boolean | null;
  finalOutput: string;
  error?: string;
}

export function parseStepResult(dispatch: DispatchResult): StepResult {
  return {
    filesChanged: extractFilesChanged(dispatch.messages),
    testsPassed: extractTestsPassed(dispatch.messages),
    finalOutput: extractFinalOutput(dispatch.messages),
    error: dispatch.exitCode === 0 ? undefined : dispatch.error ?? "Non-zero exit code",
  };
}

/** @deprecated Use {@link ReviewResult} and {@link parseReviewOutput} instead. */
export interface ReviewVerdict {
  verdict: "approve" | "reject";
  findings: string[];
}

/** @deprecated Use {@link parseReviewOutput} instead. */
export function parseReviewVerdict(text: string): ReviewVerdict {
  const approve = /verdict\s*[:\-]?\s*approve/i.test(text);
  const reject = /verdict\s*[:\-]?\s*reject/i.test(text);

  const verdict: "approve" | "reject" = approve && !reject ? "approve" : "reject";

  const findings: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^[-*]\s+(.+)/);
    if (m) findings.push(m[1].trim());
  }

  return { verdict, findings };
}

export interface ReviewResult {
  verdict: "approve" | "reject";
  findings: string[];
  raw: string;
}

export function parseReviewOutput(text: string): ReviewResult {
  if (!text.trim()) {
    return {
      verdict: "reject",
      findings: ["Review parse error: empty output"],
      raw: text,
    };
  }
  const findings: string[] = [];

  try {
    const parsed = matter(text);
    const validation = ReviewFrontmatterSchema.safeParse(parsed.data);

    if (validation.success) {
      for (const line of parsed.content.split("\n")) {
        const m = line.match(/^[-*]\s+(.+)/);
        if (m) findings.push(m[1].trim());
      }
      return {
        verdict: validation.data.verdict,
        findings,
        raw: text,
      };
    }

    const errors = validation.error.issues.map((i) => i.message).join("; ");
    return {
      verdict: "reject",
      findings: [`Review parse error: invalid frontmatter — ${errors}`],
      raw: text,
    };
  } catch (err: any) {
    return {
      verdict: "reject",
      findings: [`Review parse error: ${err?.message ?? "unknown"}`],
      raw: text,
    };
  }
}
