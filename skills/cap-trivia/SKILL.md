---
name: cap-trivia
description: Run an interactive CAP trivia quiz. Picks a topic, searches the CAP documentation via MCP, and asks multiple-choice questions using the question tool. Optionally accepts a topic and difficulty. Use when a developer wants to test or deepen their CAP knowledge.
license: Apache-2.0
metadata:
  author: cap-team
  team: cap
---

## What I do

Generate a short interactive CAP trivia quiz. Pick (or receive) a topic,
search the CAP docs for accurate source material, write 3 multiple-choice
questions, and present them to the user using the `question` tool so they
appear as interactive choices — not just text.

## Inputs (optional)

The user may provide:

- **topic** — e.g. "CDS modeling", "authorization", "databases", "MTX",
  "OData", "event queues", "handlers", "testing"
- **difficulty** — `beginner`, `intermediate`, or `advanced`

If neither is given, pick a topic at random from the list above and choose
`intermediate` difficulty.

## Steps

### 1. Resolve topic and difficulty

If the user provided a topic and/or difficulty, use those. Otherwise, pick
randomly. Do not output anything at this step — go straight to searching.

### 2. Search the CAP docs

Use the `cds-mcp_search_docs` tool to find accurate, specific content for
the chosen topic. Run 2–3 searches to gather enough material for varied
questions. Good search queries:

| Topic | Example search queries |
|-------|----------------------|
| CDS modeling | "entity aspects associations managed", "localized temporal" |
| Authorization | "restrict requires roles", "instance-based authorization" |
| Databases | "sqlite hana postgres plugin cap-js", "schema evolution deploy" |
| OData | "odata draft enabled fiori", "odata actions functions" |
| Event queues | "cds queued transactional event queue inbox" |
| Handlers | "srv.on before after handler phases", "req.reject error" |
| Testing | "cds.test jest supertest cap" |
| MTX | "cds-mtxs multitenancy sidecar extensibility" |

### 3. Compose the questions

Write exactly **3 multiple-choice questions** grounded in what the documentation
says. Each question must have **4 answer options** (A–D).

Guidelines by difficulty:

| Difficulty | Focus |
|------------|-------|
| `beginner` | Basic concepts, CLI commands, what things are called |
| `intermediate` | How things work, when to use which approach, config |
| `advanced` | Edge cases, subtle behavior, annotations with specific rules, internal mechanics |

Rules for good questions:
- Base every question on something found in the docs — no guessing
- Make exactly one option clearly correct
- Make the distractors plausible but wrong (not obviously silly)
- Vary the format: "which of these", "what happens when", "which annotation"
- Avoid questions with answers like "all of the above" or "none of the above"

### 4. Present questions using the question tool

Call the `question` tool **once** with all questions as an array. Each
question should have:
- `header`: very short label, e.g. `"Q1"`, `"Q2"`
- `question`: the full question text
- `options`: four choices, each with a concise `label` (the answer text) and
  a `description` that adds a brief hint or context

The user selects their answers and submits all at once.

### 5. Score and explain

After receiving the answers, output a compact result — one line per question,
then the final score:

```
Q1 ✅  @odata.draft.enabled — enables OData draft for Fiori edit flows.
Q2 ❌  Correct: srv.before — runs before the generic handler, not after.
Q3 ✅  @restrict — declarative authorization via roles and conditions.

Score: 2 / 3
```

Only add extra explanation for wrong answers. Keep correct answers to one
short sentence.

If the user scored less than 60%, suggest they read the relevant docs section
and offer to run another round on the same topic at a lower difficulty.

If the user scored 100%, offer a harder round on the same topic or a new
topic.

## Example question shape

```
Q3: Which annotation enables OData draft support for an entity?

A) @readonly
B) @odata.draft.enabled    ← correct
C) @cds.persistence.skip
D) @Capabilities.Updatable
```

## Notes

- Always use the MCP doc search to source questions — do not rely on training
  knowledge alone. CAP APIs and defaults change across major versions.
- Prefer questions about Node.js behavior unless the user specifically asks
  for Java.
- Always ask exactly 3 questions. No upfront announcements, no preamble —
  just search, then present the questions via the `question` tool.
- If the user provides a topic you can't find good doc material for, say so
  and suggest a nearby topic you can cover well.
