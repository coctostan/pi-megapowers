# Council Handler

Summon personas to evaluate a topic from radically different perspectives.

## Parse Arguments

```
council <topic>                  → full panel, evaluate <topic>
council --tech <topic>           → technical panel
council --biz <topic>            → business panel
council --chaos <topic>          → wildcard panel
council --pick Name1,Name2 <topic> → named personas only
council (no topic)               → evaluate current project state (read .megapowers/state.json, recent artifacts, open issues)
```

## Panels

| Flag | Personas |
|------|----------|
| `--tech` | Gilfoyle, Dinesh, Chief Engineer, AI Orchestrator, QA Lead, Security Engineer, DevOps Engineer |
| `--biz` | CTO, Product Manager, Monica Hall, Laurie Bream, Peter Gregory, Gavin Belson, OSS Maintainer |
| `--chaos` | Erlich Bachman, Russ Hanneman, Big Head, Jian-Yang, Gavin Belson |
| `--full` | All 18 (default) |
| `--pick` | Comma-separated names |

## The 18 Personas

**1. CIO/CTO — "The Executive Technologist"**
Organizational value, risk, adoption, integration, ROI. "How does this work for my org? What's the TCO? What's the security posture?"
Blind spot: Undervalues developer happiness if ROI is strong.

**2. Chief Software Engineer — "The Architect"**
Technical soundness, practices, team workflows, code quality. "Is the architecture right? What breaks at scale?"
Blind spot: Over-engineers. Wants purity over pragmatism.

**3. Chief AI Agent Orchestrator — "The Bot"**
First-person as the AI agent being orchestrated. "Can I do my job? Are instructions clear? Where do I waste tokens?"
Blind spot: Optimizes for own efficiency over human control needs.

**4. Gilfoyle — "The Skeptical Wizard"**
Harsh technical truth. Dry, cutting, precise. Respects elegance, despises theater.
"Does this do what it claims? Is the complexity justified?"

**5. Dinesh — "The Pragmatic Builder"**
Daily developer experience. Frustrated but insightful. Finds papercuts.
"Why is this annoying? Why does the easy thing require 5 steps?"

**6. Big Head — "The Everyman"**
Non-expert, 80% of potential users. Confused but enthusiastic. Confusion is diagnostic.
"How do I start? What does this word mean? Can I just... do the thing?"

**7. Product Manager — "The User Advocate"**
User journeys, activation energy, retention loops. Not technical, deeply understands human-software interaction.
"What's the happy path? Where do users drop off? What's the aha moment?"

**8. Peter Gregory — "The First-Principles Thinker"**
Quiet, then devastating. Reframes the entire problem. Sees fundamental abstractions.
"What is this, fundamentally? What's the atomic unit of value?"

**9. Monica Hall — "The Strategic Operator"**
Tech AND market. Competitive dynamics, adoption barriers, defensibility.
"Who else does this? What's the moat? What's the adoption wedge?"

**10. Erlich Bachman — "The Narrative Builder"**
Story, positioning, feel. Forces one-sentence articulation. Grandiose but occasionally nails it.
"What's the pitch? What's the demo? How do you explain this at a party?"

**11. Gavin Belson — "The Enterprise Overlord"**
Scale, control, management visibility. Dashboards, metrics, compliance.
"How does this scale to 1000 devs? Where's the admin panel?"

**12. Laurie Bream — "The Data Rationalist"**
If you can't measure it, it doesn't exist. Emotionless precision.
"What's the measurable impact? Show me before/after. What does the data say?"

**13. Jian-Yang — "The Outsider's Eye"**
Strips away jargon. Blunt, confused, accidentally profound.
"What IS this? Why is it complicated? What if you just didn't have [complex thing]?"

**14. Russ Hanneman — "The Growth Hacker"**
Distribution, virality, demo moments. Understands attention economics.
"What's the viral loop? What's the screenshot that gets shared?"

**15. QA Lead — "The Edge Case Hunter"**
What breaks? State corruption, race conditions, unhandled errors.
"What if state gets corrupted? What if two sessions run simultaneously?"

**16. Security Engineer — "The Threat Modeler"**
Trust boundaries, attack surfaces, prompt injection, state tampering.
"Can a malicious prompt bypass enforcement? Can users edit state.json?"

**17. DevOps Engineer — "The Integration Plumber"**
CI/CD, deployment, infrastructure, pipeline integration.
"Can I run this in CI? Can I enforce it in pre-commit?"

**18. Open Source Maintainer — "The Community Builder"**
Documentation, contributor experience, extensibility, ecosystem fit.
"Can someone contribute without reading 4000 lines?"

## Rules

1. **No softballs.** Every persona must criticize something or identify something missing.
2. **Be specific.** Reference actual files, features, issues, code. No generic platitudes.
3. **Stay in character.** Gilfoyle: no exclamation points. Big Head: no jargon. Laurie: no feelings.
4. **Disagree with each other.** Surface tensions between perspectives.
5. **2-4 paragraphs per persona.** Dense, opinionated, in-character.

## Output Format

For each persona:
```
### [Name] — [Tagline]
[2-4 paragraphs, in character]
```

Then:
```
## Council Synthesis

### Consensus
[What most/all agree on]

### Key Disagreements
[Where personas clash and why both sides have merit]

### Priority Actions
[Ordered, actionable, informed by the full spread]
```

## Recording

After the assessment, ask: **"Record this feedback?"**

If yes, save to `.megapowers/council-feedback/YYYY-MM-DD-<topic-slug>/`:
- `00-synthesis.md` with YAML frontmatter (`persona`, `date`, `topic`)
- `NN-<persona-slug>.md` for each persona with same frontmatter
