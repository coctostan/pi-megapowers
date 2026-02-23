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

export type TddState = "no-test" | "test-written" | "impl-allowed";

export interface TddTaskState {
  taskIndex: number;
  state: TddState;
  skipped: boolean;
  skipReason?: string;
}

export interface PlanTask {
  index: number;
  description: string;
  completed: boolean;
  noTest: boolean;
  /** Task indices this task depends on — parsed from [depends: N, M] annotations */
  dependsOn?: number[];
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
  currentTaskIndex: number;
  completedTasks: number[];   // PlanTask.index values (1-based)
  tddTaskState: TddTaskState | null;
  taskJJChanges: Record<number, string>;
  jjChangeId: string | null;
  doneMode: "generate-docs" | "capture-learnings" | "write-changelog" | "generate-bugfix-summary" | null;
  megaEnabled: boolean;
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

/**
 * Open-ended phases suppress automatic phase-transition prompts after every message.
 * Transitions from these phases happen only via explicit /phase next command.
 */
export const OPEN_ENDED_PHASES: ReadonlySet<Phase> = new Set(["brainstorm", "reproduce", "diagnose"]);

// --- Functions ---

export function createInitialState(): MegapowersState {
  return {
    version: 1,
    activeIssue: null,
    workflow: null,
    phase: null,
    phaseHistory: [],
    reviewApproved: false,
    currentTaskIndex: 0,
    completedTasks: [],
    tddTaskState: null,
    taskJJChanges: {},
    jjChangeId: null,
    doneMode: null,
    megaEnabled: true,
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

export function transition(state: MegapowersState, to: Phase, tasks?: PlanTask[]): MegapowersState {
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

  if (to === "implement" && tasks) {
    const completedSet = new Set(state.completedTasks);
    const firstIncomplete = tasks.findIndex(t => !completedSet.has(t.index));
    next.currentTaskIndex = firstIncomplete >= 0 ? firstIncomplete : 0;
    next.taskJJChanges = {};  // Reset per-task changes on re-entry
  } else if (to === "implement") {
    next.taskJJChanges = {};
  }

  // Reset doneMode on every phase transition
  next.doneMode = null;

  return next;
}
