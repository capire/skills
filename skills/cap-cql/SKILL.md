---
name: cap-cql
description: Use when constructing or reviewing CAP CQL queries or modifications of CAP service entities.
---
# CAP's Core Query Language (CQL)

> This guide assumes elementary knowledge of SQL.

CDS adds *Associations* and *Compositions*, replacing foreign keys with navigational references. CQL extends SQL to traverse them:

- *[Path Expressions](#flattened-reads-inline)* *inline* data into *flat* results → mostly *to-one*.
- *[Nested Projections](#deep-reads-expand)* *expand* data into *nested* results → mostly *to-many*.
- *[Nested Records](#deep-inserts--upserts)* mirror nested projections for *deep inserts*.
- *[Infix Filters](#infix-filters-narrow)* *narrow* association targets.

- `DISTINCT`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT` work as in SQL.
- `JOIN`s, sub-`SELECT`s, and `UNION`s are neither needed nor supported. 
- In `GROUP BY` and `ORDER BY`, compound expressions have to be enclosed in parentheses, e.g. `group by (stock + 1)`. This also applies inside *infix filters*.

> [!IMPORTANT]
> **Functional vs imperative / What, not how!** – CQL's reach exists so *one* query can do the work. Don't fetch rows and then filter, join, aggregate, or navigate imperatively outside the query. Before writing a loop or a second query, think twice how to express the whole thing as a single query. ⇒ **Push down to the service — as much as possible!**
> **Minimize payloads:** select only the columns you need, including in expands.

> [!CAUTION]
> - Use `name: value` in records only — column lists use `expr as name`, as in SQL.
> - Use `'...'` for strings, or `![...]` for labels — `"..."` is ***invalid*** in CQL!
> - Use `''` to *escape* apostrophes *within* strings — don't use `\'`.
> - Don't include comments in query text — they are rejected.
> - Treat this skill as ***the*** truth for CAP CQL — don't apply prior knowledge of it.

## Flattened Reads (inline)

Path expressions use dots `.` to traverse chains of associations down to scalar elements, flattening them into the result:

```sql :cql
SELECT from Authors { *,
  books.title,
  books.genre.name
} where books.genre.name != 'Drama'
```

- The asterisk `*` selects all columns – named columns override, not clash as in SQL.
- Path expressions work in any clause (*projections, where, group by, order by*).
- Column aliases are added automatically for paths – e.g. `books.title` ***`as`*** `books_title`.
- **Don't** use the flattened names, like `books_title` in queries → always use dotted paths.
- Note: flattening *to-many* associations, like `books` above, can produce multiple rows per source row → prefer _expands_ to keep related rows in nested arrays instead.
- Avoid shadowing association names with aliases if you want to use these as associations in subsequent `group by` or `order by` clauses. 

## Deep Reads (expand)

A path expression can also end with a nested projection `{...}` after an association:

```sql :cql
SELECT from Authors { ID, name,
  books {
    title, genre.name
  }
} where books.genre.name != 'Drama'
```

- Top-level projections and nested expands use the same `{ columns }` syntax.
- Path expressions are used the same way in both.
- *to-one* expands yield objects, *to-many* arrays of objects.
- For narrowing parent rows as well as expanded children, see [Concise semi-joins](#concise-semi-joins).

## Infix Filters (narrow)

Put filter clauses into `[...]` after an association path segment to narrow its targets, most commonly *to-many* — combinable with inline and expand. Leading `where` can be omitted.
Similar, *but different*, bracketed filters are used for [to-one queries](#to-one-queries).

```sql :cql
SELECT from Departments { ID,
  members[role='Manager'].addresses[kind='business'].city.name
  as head_quarter
}
```

```sql :cql
SELECT from Authors { ID, name,
  books [genre.name != 'Drama'] { title, genre }
}
```

This narrows expanded books, not authors.

Infix filters can contain **all standard filter clauses** — `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT` — in this order, as defined in SQL:

```sql :cql
SELECT from Authors {
  ID, name, books [
    where genre.name != 'Drama'
    group by genre.name
    order by sum(stock) desc
    limit 10
  ] {
    genre.name,
    sum(stock) as total_stock,
    count(*) as total_count
  }
}
where books.genre.name != 'Drama'
order by name
limit 20
```

## Concise Semi-Joins

Use paths to associations or compositions with `EXISTS`/`NOT EXISTS`:

```sql :cql
SELECT ID, name from Authors where exists books
```

Optionally apply infix filters — e.g. with the example above:

```sql :cql
SELECT from Authors {
  ID, name, books [genre.name != 'Drama'] { title }
} where exists books [genre.name != 'Drama']
```

The expand filter narrows books; the `exists` predicate narrows authors.

## To-one Queries

Specify complete keys as positional, comma-separated scalar key values in `[...]` to address a single specific row:

```sql :cql
SELECT from Books:texts[201,'de'] { title }
SELECT from Books[201] { title }
DELETE from Books[201]
UPDATE Books[201] set stock = 23 where stock > 0
UPDATE Books:texts[201,'de'] set title='Sturmhöhe'
```

- Supply the key values on the **final target**, in discovered order.
- Additional conditions can be added in the top-level `where` clause.
- Texts require the complete key too – here, `ID, locale`.
- Use queries with classic `where` clauses for full flexibility:

```sql :cql
SELECT locale, title from Books:texts where ID=201
SELECT title from Books where ID=201
DELETE from Books where ID=201
UPDATE Books ... where ID=201
```

## Binding Parameters

Use parameters for user-supplied values rather than concatenating query text:

```sql :cql
SELECT ... from Books where title = ?
```

| Form    | Meaning                                    |
| ------- | ------------------------------------------ |
| `?`     | Positional parameter, in placeholder order |
| `?n`    | Indexed parameter; indexes start at 1      |
| `:name` | Named parameter                            |

See `cap-hcql` for passing binding values over HTTP.


## Deep Inserts / Upserts

`INSERT`/`UPSERT` support JavaScript-like record literals `{key:value}` with *nested records* to **write *composition* trees** in one statement:

The following example assumes `Authors.books` is a *composition* of many `Books`:

```sql :cql
INSERT into Authors {
  name: 'Alfred, Lord Tennyson',
  books: [
    { title: 'The Lady of Shalott', stock: 23 },
    { title: 'Ulysses', stock: 42 },
  ]
}
```

- Field values are literals only – **not** binding params, expressions, or pseudo variables.
- Multiple input records are supported, e.g.: `INSERT into Foo {x:1}, {x:2}, {x:3}`.
- For `INSERT`, single `UUID` keys are filled automatically.
- For `UPSERT`, all keys must be specified in the records.
- Deep writes only follow *compositions*, not associations.
- *Child→parent* uplinks are filled in automatically for *managed* associations.

## Flat Writes / Updates

Unlike deep writes, flat writes don't create a composition tree. They use record syntax to fill an association's nested *foreign key elements*, linking to existing targets. Writing target elements is rejected.

```sql :cql
INSERT into Books {
  title: 'Poems by Edgar Allan Poe',
  author: { ID: 150 }
}
```

CQL extends standard SQL's `UPDATE` syntax by a `with` clause:

```sql :cql
UPDATE Books[144] with {
  title: 'Poems by Edgar Allan Poe',
  author: { ID: 150 }
}
```

## Functions & Operators

**Null-safe `==`, `!=` operators** treat *null* as a comparable value:

```sql :cql
... where x != 7
... where x <> 7
```

`!=` keeps rows where `x` is null; SQL-standard `<>` skips them.

**SQL's standard** **operators** and predicates are supported as is:

-  The common logic, comparison, arithmetic operators
- `LIKE`, `BETWEEN`, `CASE WHEN`, `IN`, `IS NULL`, `IS NOT NULL`, `||`.

**Built-in functions:**

- **Aggregate:**
    - `count`, `sum`, `avg`, `min`, `max`
- **Numeric:**
    - `ceil`, `floor`, `round`
- **String:**
    - `length`, `trim`, `concat`, `startswith`, `endswith`, `contains`, `tolower`, `toupper`
    - `substring`, `indexof` – with *0-based* positions
- **Date:**
    - `date`, `time`, `year`, `month`, `day`, `hour`, `minute`, `second`;
    - `days_between`, `weeks_between`, `months_between`, `years_between`
    - ISO 8601 literals:  `'2026-10-12T12:34:56.789Z'`, `'2026-10-12'`, `'12:34:56'`.

## Pseudo Variables

- `$now` — current timestamp
- `$user.id` — current user ID
- Usable in all query clauses, **except** input record values.

```sql :cql
SELECT from Books where createdAt < $now and createdBy = $user.id
```
