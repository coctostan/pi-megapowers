# Implementation Conventions

- **Language:** TypeScript (strict), bun runtime, ESM modules
- **Imports:** Use `.js` extensions. `import { foo } from "./bar.js"`
- **Files:** kebab-case. One concern per file. Small (25-300 lines).
- **Types:** PascalCase. `MegapowersState`, `PlanTask`, `WorkflowConfig`
- **Functions:** camelCase. `checkGate()`, `readState()`, `buildInjectedPrompt()`
- **Constants:** UPPER_SNAKE for config maps/sets. `OPEN_ENDED_PHASES`, `FEATURE_TRANSITIONS`
- **Pure functions preferred.** Core logic has no I/O, no pi dependency. I/O at the edges only (`state-io.ts`, `store.ts`, `jj.ts`).
- **Error handling:** Return result types (`{ pass: boolean, reason?: string }`), don't throw. Throw only for programmer errors (invariant violations).
- **Error messages:** Say what failed, why, and what to do about it.
- **Commits:** Imperative mood, concise. One logical change per commit.
