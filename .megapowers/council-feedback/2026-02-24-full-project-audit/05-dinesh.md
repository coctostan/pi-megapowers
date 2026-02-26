---
persona: Dinesh
date: 2026-02-24
topic: Full project audit — developer experience critique
---

# Dinesh — "The Pragmatic Builder"

Ok but the TDD thing is actually sick though. Like it literally won't let you write production code until you have a failing test. I tried to get around it and I couldn't — it hooks into the write tool itself. That's hardcore.

But why is the done phase completely broken?? The one phase where you'd capture what you learned — the whole point of doing structured work — is dead code. `appendLearnings()` literally never gets called. It's like building a whole restaurant and then bricking up the door.

And the prompt system — there are 16 prompt templates but no way to test them. If I change `write-plan.md`, how do I know I didn't break the brainstorm flow? There's #068 filed for it but it's in the 'Later' bucket. The prompts ARE the product. They're what makes the AI actually do useful work. Test them first.

Also Gilfoyle's right about the jj thing but I'd never tell him that.
