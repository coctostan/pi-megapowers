// extensions/megapowers/workflows/bugfix.ts
import type { WorkflowConfig } from "./types.js";

export const bugfixWorkflow: WorkflowConfig = {
  name: "bugfix",
  phases: [
    { name: "reproduce", artifact: "reproduce.md", openEnded: true, promptTemplate: "reproduce-bug.md", guidance: "Send a message to reproduce the bug." },
    { name: "diagnose", artifact: "diagnosis.md", openEnded: true, promptTemplate: "diagnose-bug.md", guidance: "Send a message to diagnose the root cause." },
    { name: "plan", artifact: "plan.md", blocking: true, promptTemplate: "write-plan.md", guidance: "Send a message to generate the plan." },
    { name: "implement", tdd: true, promptTemplate: "implement-task.md" },
    { name: "verify", artifact: "verify.md", blocking: true, promptTemplate: "verify.md", guidance: "Send a message to verify the implementation." },
    { name: "done", blocking: true },
  ],
  transitions: [
    { from: "reproduce", to: "diagnose", gates: [{ type: "requireArtifact", file: "reproduce.md" }] },
    { from: "diagnose", to: "plan", gates: [{ type: "requireArtifact", file: "diagnosis.md" }] },
    { from: "plan", to: "implement", gates: [{ type: "requireTaskFiles" }, { type: "requirePlanApproved" }] },
    { from: "implement", to: "verify", gates: [{ type: "allTasksComplete" }] },
    { from: "verify", to: "done", gates: [{ type: "alwaysPass" }] },
    { from: "verify", to: "implement", gates: [], backward: true },
  ],
  phaseAliases: {
    reproduce: "brainstorm",
    diagnosis: "spec",
  },
};
