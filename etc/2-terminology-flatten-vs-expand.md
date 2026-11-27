# CQL Terminology: "Flatten vs. Expand" (recommended framing)

Assessment of whether to keep the terms **traversal** vs. **expand**, or use better ones.

## Verdict: keep them, with one refinement

### "Expand" — keep unconditionally
- Established industry term: OData `$expand`, GraphQL nested selections, SQL/ORM "eager loading." Anyone from those worlds gets it instantly.
- CAP's own docs use "expand." A synonym would only add friction.

### "Traversal" — good, but one weakness
- Accurately describes the *action* (walking across associations).
- Weakness: by itself, "traversal" describes what **both** operations do. An expand also traverses the association — it just returns a different shape. The guide itself implies this: "infix filters don't change traversals into expands" (SKILL.md:162) means an expand *is* a kind of traversal.
- So "traversal vs. expand" is slightly category-confused: one names the *act of navigating*, the other the *result shape*.

## The real distinction

Both operations follow an association. They differ in **output shape**:

| Concept | What differs | Better emphasis |
|---|---|---|
| `books.title` | result is **flat** | *flattened path* / *inlined* |
| `books { title }` | result is **nested** | *expand* |

The cleanest contrast isn't "traversal vs. expand" — it's **"flatten vs. expand"** (or **"inline vs. expand"**).

## Recommendation

Keep **"expand"**. For the other side, pick by context:

1. **"path expression"** — when naming the *syntax* (`books.title`). Already the guide's primary term (SKILL.md:35) and unambiguous.
2. **"flattened path" / "inlined association"** — when contrasting the *result shape* against an expand. Directly names what differs.

Use **"traverse/navigate"** only as the shared verb for *both* ("both expands and path expressions traverse associations"), never as the name for one side.

## Sharpest framing

> Following an association either **flattens** it into scalar columns (path expression) or **expands** it into a nested structure.
