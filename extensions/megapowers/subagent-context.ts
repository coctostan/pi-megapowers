/**
 * Extract the section content for a specific task from plan markdown.
 * Supports ### Task N: headers and numbered list items.
 */
export function extractTaskSection(planContent: string, taskIndex: number): string {
  const lines = planContent.split("\n");

  // Try ### Task N: header format first
  const headerPattern = new RegExp(`^###\\s+Task\\s+${taskIndex}:\\s*`);
  const nextHeaderPattern = /^###\s+Task\s+\d+:/;

  let inSection = false;
  let sectionLines: string[] = [];

  for (const line of lines) {
    if (headerPattern.test(line)) {
      inSection = true;
      sectionLines.push(line);
      continue;
    }
    if (inSection && nextHeaderPattern.test(line)) break;
    if (inSection) sectionLines.push(line);
  }

  if (sectionLines.length > 0) return sectionLines.join("\n").trim();

  // Fall back to numbered list: "N. Description"
  const numberedPattern = new RegExp(`^\\s{0,1}${taskIndex}[.)]\\s+`);
  const nextNumberedPattern = /^\s{0,1}\d+[.)]\s+/;

  inSection = false;
  sectionLines = [];

  for (const line of lines) {
    if (!inSection && numberedPattern.test(line)) {
      inSection = true;
      sectionLines.push(line);
      continue;
    }
    if (inSection && nextNumberedPattern.test(line) && !numberedPattern.test(line)) break;
    if (inSection) sectionLines.push(line);
  }

  return sectionLines.join("\n").trim();
}

export interface SubagentPromptInput {
  taskDescription: string;
  planSection?: string;
  learnings?: string;
  phase?: string;
  specContent?: string;
}

export function buildSubagentPrompt(input: SubagentPromptInput): string {
  const parts: string[] = [];
  parts.push(`## Task\n\n${input.taskDescription}`);
  if (input.phase) parts.push(`## Current Phase\n\n${input.phase}`);
  if (input.planSection) parts.push(`## Plan Details\n\n${input.planSection}`);
  if (input.specContent) parts.push(`## Acceptance Criteria\n\n${input.specContent}`);
  if (input.learnings) parts.push(`## Project Learnings\n\n${input.learnings}`);
  return parts.join("\n\n");
}
