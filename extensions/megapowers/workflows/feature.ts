// extensions/megapowers/workflows/feature.ts
import type { WorkflowConfig } from "./types.js";

export const featureWorkflow: WorkflowConfig = {
  name: "feature",
  phases: [
    { name: "brainstorm", artifact: "brainstorm.md", openEnded: true, blocking: true, promptTemplate: "brainstorm.md", guidance: "Send a message to brainstorm your idea." },
    { name: "spec", artifact: "spec.md", blocking: true, promptTemplate: "write-spec.md", guidance: "Send a message to write the spec." },
    { name: "plan", artifact: "plan.md", blocking: true, promptTemplate: "write-plan.md", guidance: "Send a message to generate the plan." },
    { name: "implement", tdd: true, promptTemplate: "implement-task.md" },
    { name: "verify", artifact: "verify.md", blocking: true, promptTemplate: "verify.md", guidance: "Send a message to verify the implementation." },
    { name: "code-review", artifact: "code-review.md", tdd: true, promptTemplate: "code-review.md", guidance: "Send a message to review the code." },
    { name: "done", blocking: true },
  ],
  transitions: [
    { from: "brainstorm", to: "spec", gates: [{ type: "alwaysPass" }] },
    { from: "spec", to: "plan", gates: [{ type: "requireArtifact", file: "spec.md" }, { type: "noOpenQuestions", file: "spec.md" }] },
    { from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }] },
    { from: "implement", to: "verify", gates: [{ type: "allTasksComplete" }] },
    { from: "verify", to: "code-review", gates: [{ type: "requireArtifact", file: "verify.md" }] },
    { from: "verify", to: "implement", gates: [], backward: true },
    { from: "code-review", to: "done", gates: [{ type: "requireArtifact", file: "code-review.md" }] },
    { from: "code-review", to: "implement", gates: [], backward: true },
  ],
};
