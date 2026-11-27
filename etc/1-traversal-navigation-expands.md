# CQL: Traversal vs Expands

Based on the `cap-cql` skill guide. These three terms are related but distinct — and the guide is careful to keep them separate.

## Traversal 

**Traversal** = following an association to reach a related entity, using a dotted *path expression* — this is CQL's replacement for SQL JOINs (SKILL.md:8, :37).

```sql
SELECT from Authors { ID, name, books.title }
```

Key property: a traversal **flattens** into a single scalar column in the result. `books.title` becomes `books_title` (SKILL.md:45). You stay "wide and flat" — no nesting, just more columns.

## Expand

**Expand** = adding a postfix projection `{...}` *after* an association to pull its target into a **nested, structured** result instead of flattening it (SKILL.md:86-96).

```sql
SELECT from Authors {
  ID, name, books {        -- expand, not traverse
    ID, title, genre.name
  }
}
```

Key property: an expand **nests** rather than flattens:
- to-one association → nested **object**
- to-many association → nested **array** of objects (SKILL.md:106-107)

## The core distinction

Same association, two different shapes of result:

|               | Syntax            | Result shape              |
| ------------- | ----------------- | ------------------------- |
| **Traversal** | `books.title`     | flat column `books_title` |
| **Expand**    | `books { title }` | nested array/object       |

The guide makes this explicit in two places:

1. The tip at SKILL.md:121-123 — **don't expand to-one associations** for simple cases; prefer a flat traversal (`genre.name`, not `genre { name }`).

2. SKILL.md:162 — "infix filters don't change traversals into expands." Even `members[role='Manager'].addresses[...].city.name` with filters still *flattens* to one scalar column (`members_addresses_city_name`). The `[...]` filter narrows which rows are followed, but it does **not** turn a traversal into an expand — only a postfix `{...}` does that.

## Mental model

- **Traversal** = navigate across associations (output stays flat).
- **Expand** = navigate *and* request structure (output nests).
