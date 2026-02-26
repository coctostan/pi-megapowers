// extensions/megapowers/workflows/types.ts
import type { Phase, WorkflowType } from "../state/state-machine.js";
import type { MegapowersState } from "../state/state-machine.js";
import type { Store } from "../state/store.js";

// --- Gate Config ---

export interface RequireArtifactGate {
  type: "requireArtifact";
  file: string; // e.g. "spec.md"
}

export interface NoOpenQuestionsGate {
  type: "noOpenQuestions";
  file: string; // file to check for open questions
}

export interface RequireReviewApprovedGate {
  type: "requireReviewApproved";
}

export interface AllTasksCompleteGate {
  type: "allTasksComplete";
}

export interface AlwaysPassGate {
  type: "alwaysPass";
}

export interface CustomGate {
  type: "custom";
  evaluate: (state: MegapowersState, store: Store, cwd?: string) => GateEvalResult;
}

export type GateConfig =
  | RequireArtifactGate
  | NoOpenQuestionsGate
  | RequireReviewApprovedGate
  | AllTasksCompleteGate
  | AlwaysPassGate
  | CustomGate;

export interface GateEvalResult {
  pass: boolean;
  message?: string;
}

// --- Transition Config ---

export interface TransitionConfig {
  from: Phase;
  to: Phase;
  gates: GateConfig[];
  backward?: boolean; // backward transitions skip gates
}

// --- Phase Config ---

export interface PhaseConfig {
  name: Phase;
  artifact?: string;              // e.g. "spec.md" — phase produces this artifact
  tdd?: boolean;                  // phase uses TDD gating
  needsReviewApproval?: boolean;  // phase requires review approval to advance
  openEnded?: boolean;            // suppresses auto phase-transition prompts
  blocking?: boolean;             // blocks source code writes (only .megapowers/ allowed)
  promptTemplate?: string;        // e.g. "write-spec.md"
  guidance?: string;              // short guidance string for UI
}

// --- Workflow Config ---

export interface WorkflowConfig {
  name: WorkflowType;
  phases: PhaseConfig[];
  transitions: TransitionConfig[];
  /** Maps alias names to canonical phase/artifact names.
   *  Keys are artifact base names (e.g. "reproduce", "diagnosis"),
   *  values are the canonical names they alias to (e.g. "brainstorm", "spec").
   *  Used by prompt-inject and derived.ts to resolve bugfix-specific behavior. */
  phaseAliases?: Record<string, string>;
}
