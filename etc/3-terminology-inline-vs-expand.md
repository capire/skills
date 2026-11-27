# CQL Terminology: "Inline vs. Expand" (final chosen pairing)

## The asymmetry to solve

"Expand" is a triple-threat term — it is:
1. **Snappy** — one punchy word.
2. **Names the effect** — (deeply) structured, nested output.
3. **Names the syntax** — the `{...}` projection block used to achieve it.

The goal: find a single word for the *other* side that does the same triple duty.

## What the other side actually is

- **Effect:** the association collapses into scalar column(s) in one flat row.
- **Syntax:** the dotted path `books.title`.
- **Snappiness:** needs to be one punchy verb/noun.

## Candidates

| Word | Snappy? | Names effect? | Names syntax? | Antonym of expand? |
|---|---|---|---|---|
| **Inline** | ✅ | ✅ (value sits inline) | ✅ (path reads inline) | ✅ good |
| **Flatten** | ✅ | ✅ (flat row) | ⚠️ indirect | ✅ strong |
| **Collapse** | ✅ | ✅ | ❌ | ✅ (literal opposite) |
| **Fold** | ✅ | ✅ | ❌ | ✅ (fold ↔ unfold/expand) |
| **Project** | ✅ | ⚠️ | ⚠️ | ❌ (too generic) |

## Chosen: **"inline"**

It's the only candidate that matches "expand" on **all three** axes:

1. **Snappy** — "inline the author's name," "an inlined path," "inline vs. expand."
2. **Effect** — the related value sits *inline* in the parent row, as a plain column.
3. **Syntax** — `author.name` literally reads *inline* within the projection, whereas `author { name }` opens a nested block. The dotted path *is* the inline form.

"inline vs. expand" is also a familiar, pleasing opposition devs already know ("inline a function" vs. "extract/expand it").

## Supporting term: **"flatten"**

Best on *effect* (result is unambiguously flat → `author_name`); "flatten vs. expand" is the most intuitive plain-English antonym. Weakness: describes the *outcome* more than the *syntax element* — there's no "flatten operator" the way `{...}` is the expand operator. Use it to describe inline's effect.

## Final framing

> You either **inline** an association (its value flattens into a scalar column) or **expand** it (into a nested structure).
