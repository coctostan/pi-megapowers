import type { TddTaskState } from "./tdd-guard.js";

// --- Types ---

export type WorkflowType = "feature" | "bugfix";

export type FeaturePhase = "brainstorm" | "spec" | "plan" | "review" | "implement" | "verify" | "code-review" | "done";
export type BugfixPhase = "reproduce" | "diagnose" | "plan" | "review" | "implement" | "verify" | "done";
export type Phase = FeaturePhase | BugfixPhase;

export interface PhaseTransition {
  from: Phase | null;
  to: Phase;
  timestamp: number;
  jjChangeId?: string;
}

export interface PlanTask {
  index: number;
  description: string;
  completed: boolean;
  noTest: boolean;
}

export interface AcceptanceCriterion {
  id: number;
  text: string;
  status: "pending" | "pass" | "fail" | "partial";
}

export interface MegapowersState {
  version: 1;
  activeIssue: string | null;
  workflow: WorkflowType | null;
  phase: Phase | null;
  phaseHistory: PhaseTransition[];
  reviewApproved: boolean;
  planTasks: PlanTask[];
  jjChangeId: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  currentTaskIndex: number;
  tddTaskState: TddTaskState | null;
}

// --- Transition Tables ---

const FEATURE_TRANSITIONS: Record<FeaturePhase, FeaturePhase[]> = {
  brainstorm: ["spec"],
  spec: ["plan"],
  plan: ["review", "implement"],
  review: ["implement", "plan"],
  implement: ["verify"],
  verify: ["code-review", "implement"],
  "code-review": ["done", "implement"],
  done: [],
};

const BUGFIX_TRANSITIONS: Record<BugfixPhase, BugfixPhase[]> = {
  reproduce: ["diagnose"],
  diagnose: ["plan"],
  plan: ["review", "implement"],
  review: ["implement"],
  implement: ["verify"],
  verify: ["done"],
  done: [],
};

// --- Functions ---

export function createInitialState(): MegapowersState {
  return {
    version: 1,
    activeIssue: null,
    workflow: null,
    phase: null,
    phaseHistory: [],
    reviewApproved: false,
    planTasks: [],
    jjChangeId: null,
    acceptanceCriteria: [],
    currentTaskIndex: 0,
    tddTaskState: null,
  };
}

export function getFirstPhase(workflow: WorkflowType): Phase {
  return workflow === "feature" ? "brainstorm" : "reproduce";
}

export function getValidTransitions(workflow: WorkflowType | null, phase: Phase): Phase[] {
  if (!workflow) return [];
  const table = workflow === "feature" ? FEATURE_TRANSITIONS : BUGFIX_TRANSITIONS;
  return (table as Record<string, Phase[]>)[phase] ?? [];
}

export function canTransition(workflow: WorkflowType | null, from: Phase, to: Phase): boolean {
  return getValidTransitions(workflow, from).includes(to);
}

export function transition(state: MegapowersState, to: Phase): MegapowersState {
  if (!state.activeIssue) {
    throw new Error("Cannot transition without an active issue");
  }
  if (!state.phase || !state.workflow) {
    throw new Error("Cannot transition without an active phase and workflow");
  }
  if (!canTransition(state.workflow, state.phase, to)) {
    throw new Error(`Invalid transition: ${state.phase} → ${to} in ${state.workflow} mode`);
  }

  const next: MegapowersState = {
    ...state,
    phase: to,
    phaseHistory: [
      ...state.phaseHistory,
      { from: state.phase, to, timestamp: Date.now() },
    ],
  };

  // Reset review approval when entering plan (re-planning invalidates previous review)
  if (to === "plan") {
    next.reviewApproved = false;
  }

  if (to === "implement") {
    next.currentTaskIndex = next.planTasks.findIndex(t => !t.completed);
    if (next.currentTaskIndex === -1) next.currentTaskIndex = 0;
  }

  return next;
}
