import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase } from "./state-machine.js";

// --- Prompt file mapping ---

export const PHASE_PROMPT_MAP: Record<Phase, string> = {
  brainstorm: "brainstorm.md",
  spec: "write-spec.md",
  plan: "write-plan.md",
  review: "review-plan.md",
  implement: "write-plan.md",  // Re-use plan prompt (LLM sees plan tasks)
  verify: "write-spec.md",    // Re-use spec prompt (LLM checks criteria)
  done: "generate-docs.md",
  reproduce: "diagnose-bug.md",
  diagnose: "diagnose-bug.md",
};

// --- Template loading ---

function getPromptsDir(): string {
  // Resolve relative to this file's location: extensions/megapowers/prompts.ts → ../../prompts/
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return join(thisDir, "..", "..", "prompts");
}

export function getPhasePromptTemplate(phase: Phase): string {
  const filename = PHASE_PROMPT_MAP[phase];
  if (!filename) return "";
  try {
    return readFileSync(join(getPromptsDir(), filename), "utf-8");
  } catch {
    return "";
  }
}

// --- Interpolation ---

export function interpolatePrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] ?? match;
  });
}

// --- High-level: build prompt for a phase ---

export function buildPhasePrompt(
  phase: Phase,
  vars: Record<string, string>
): string {
  const template = getPhasePromptTemplate(phase);
  if (!template) return "";
  return interpolatePrompt(template, vars);
}
