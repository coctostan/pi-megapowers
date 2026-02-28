import type { DispatchResult } from "./dispatcher.js";
import { extractFilesChanged, extractFinalOutput, extractTestsPassed } from "./message-utils.js";

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

export interface ReviewVerdict {
  verdict: "approve" | "reject";
  findings: string[];
}

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
