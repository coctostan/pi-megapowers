import type { AcceptanceCriterion } from "./state-machine.js";

export type { AcceptanceCriterion };

/**
 * Extract numbered criteria from a markdown section with the given heading pattern.
 * Stops at the next ## heading.
 */
function extractNumberedSection(content: string, headingPattern: RegExp): AcceptanceCriterion[] {
  const lines = content.split("\n");
  const criteria: AcceptanceCriterion[] = [];
  let inSection = false;

  for (const line of lines) {
    if (headingPattern.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      break;
    }
    if (!inSection) continue;

    const match = line.match(/^\s{0,1}(\d+)[.)]\s+(.+)/);
    if (match) {
      criteria.push({
        id: parseInt(match[1]),
        text: match[2].trim(),
        status: "pending",
      });
    }
  }

  return criteria;
}

/**
 * Extract numbered acceptance criteria from a spec document.
 * Looks for content under a "## Acceptance Criteria" heading.
 */
export function extractAcceptanceCriteria(specContent: string): AcceptanceCriterion[] {
  return extractNumberedSection(specContent, /^##\s+Acceptance\s+Criteria/i);
}

/**
 * Extract numbered criteria from a "## Fixed When" section in a diagnosis.
 */
export function extractFixedWhenCriteria(diagnosisContent: string): AcceptanceCriterion[] {
  return extractNumberedSection(diagnosisContent, /^##\s+Fixed\s+When/i);
}

export function hasOpenQuestions(specContent: string): boolean {
  const lines = specContent.split("\n");
  let inSection = false;

  for (const line of lines) {
    if (/^##\s+Open\s+Questions/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      break;
    }
    if (inSection && line.trim().length > 0) {
      return true;
    }
  }

  return false;
}
