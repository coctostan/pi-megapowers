import { loadPromptFile, interpolatePrompt } from "../prompts.js";

export type CompleteFn = (prompt: string) => Promise<string>;

export type ModelLintResult =
  | { pass: true; warning?: string }
  | { pass: false; errors: string[] };

interface TaskSummary {
  id: number;
  title: string;
  description: string;
  files: string[];
}

interface ModelResponse {
  verdict: "pass" | "fail";
  findings: string[];
}

export async function lintPlanWithModel(
  tasks: TaskSummary[],
  specContent: string,
  completeFn: CompleteFn,
): Promise<ModelLintResult> {
  const prompt = buildLintPrompt(tasks, specContent);

  let responseText: string;
  try {
    responseText = await completeFn(prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { pass: true, warning: `T1 lint skipped — API error: ${msg}` };
  }

  return parseModelResponse(responseText);
}

export function buildLintPrompt(tasks: TaskSummary[], specContent: string): string {
  const taskList = tasks
    .map(t => `### Task ${t.id}: ${t.title}\n${t.description}\nFiles: ${t.files.join(", ")}`)
    .join("\n\n");
  const template = loadPromptFile("lint-plan-prompt.md");
  if (template) {
    return interpolatePrompt(template, {
      spec_content: specContent,
      tasks_content: taskList,
    });
  }

  // Fallback if template not found
  return `## Spec\n${specContent}\n\n## Plan Tasks\n${taskList}\n\nCheck: spec coverage, dependency coherence, description quality, file path plausibility. Respond with JSON: {"verdict": "pass"|"fail", "findings": [...]}`;
}

function parseModelResponse(text: string): ModelLintResult {
  try {
    // Try to extract JSON from the response (model might wrap it in markdown)
    const jsonMatch = text.includes("{") ? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1) : text;
    const parsed: ModelResponse = JSON.parse(jsonMatch);

    if (parsed.verdict === "pass") {
      return { pass: true };
    }

    if (parsed.verdict === "fail" && Array.isArray(parsed.findings) && parsed.findings.length > 0) {
      return { pass: false, errors: parsed.findings };
    }

    // Verdict is "fail" but no findings — treat as pass
    return { pass: true, warning: "T1 model returned fail with no findings — treating as pass." };
  } catch {
    return { pass: true, warning: "T1 lint response was malformed — treating as pass (fail-open)." };
  }
}
