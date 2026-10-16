---
name: cap-cql
description: Use when querying or modifying entities of CAP services, e.g. via HCQL (see cap-hcql skill). The skill assumes sound existing knowledge of SQL.
---
# CAP's Core Query Language (CQL)

CDS adds *Associations* and *Compositions*, which replace foreign keys by navigational references. CQL adds the following enhancements to SQL to traverse associations:

- *[Path Expressions](#flattened-reads-inline)* *inline* data into *flat* result sets → mostly for *to-one* traversals.
- *[Nested Projections](#deep-reads-expand)* *expand* data into *nested* results → mostly for *to-many*.
- *[Nested Records](#deep-inserts--upserts)* parallel nested projections for *deep inserts*.
- *[Infix Filters](#infix-filters-narrow)* *narrow* association targets.

With these additions, we don't need (and don't support) `JOIN` or sub-`SELECT`s; `UNION` is also not supported. `DISTINCT`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT` work as in SQL.

> [!CAUTION]
> - Use `name: value` in records only — column lists use `expr as name`, as in SQL.
> - Use `'...'` for strings, or `![...]` for labels — `"..."` is ***invalid*** in CQL!
> - Use `\'` or `''` to *escape* apostrophes *within* strings.
> - Treat this skill as ***the*** truth for CAP CQL — don't apply prior knowledge of it.

## Flattened Reads (inline)

Path expressions use dots `.` to traverse chains of associations down to scalar elements, flattening them into the result set:

```sql :cql
SELECT from Authors { *,             -- * as in SQL, but cols below override
  books.title,                       -- path expr
  books.genre.name                   -- path expr
} where books.genre.name != 'Drama'  -- path expr, null-safe != operator
```

- Path expressions work in any clause (*projections, where, group by, order by*).
- Column aliases are added automatically for paths – e.g. `books.title` ***`as`*** `books_title`.
- **Don't** use the flattened names, like `books_title` in queries → always use dotted paths.

## Deep Reads (expand)

A path expression can also end with a nested projection `{...}` after an association:

```sql :cql
SELECT from Authors { *,             -- top-level projection
  books {                            -- nested projection/expand
    title, genre.name                -- path expression
  }
} where books.genre.name != 'Drama'
```

- Top-level projections and nested expands use the same `{ columns }` syntax.
- Path expressions are used the same way in both.
- *to-one* expands yield objects, *to-many* arrays of objects.

## Infix Filters (narrow)

We can optionally put filter clauses into `[...]` blocks after an entity or association path segment, most commonly to narrow *to-many* targets – which can in turn be combined with inline and expand. Leading `where` can be omitted in infix filters.

```sql :cql
SELECT from Departments { ID, 
  members[role='Manager'].addresses[kind='business'].city.name 
  as head_quarter
}
```

```sql :cql
SELECT from Authors { *,
  books [genre.name != 'Drama'] { title, genre }
} -- authors aren't narrowed
```

### Where exists *related data*

Combine paths to associations/compositions with `EXISTS`/`NOT EXISTS` as **concise semi-joins**:

```sql :cql
SELECT from Authors where exists books
```

We can also apply infix filters, similar to the one above:

```sql :cql
SELECT from Authors {
  ID, name, books [genre.name != 'Drama'] {*} -- narrows books
} where exists books [genre.name != 'Drama'] -- narrows authors
```

### Infix *group by*, et al

Infix filters can contain all possible filter clauses — `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT` — in the same SQL order as at the top level:

```sql :cql
SELECT from Authors {
  ID, name, books [                         -- infix filter
    where genre.name != 'Drama'
    group by genre.name
    order by stock desc
    limit 10
  ] {
    genre.name,
    sum(stock) as total_stock,
    count(*) as total_count
  }
}
where exists books [genre.name != 'Drama']  -- top-level filter
order by name
limit 20
```

### Single-row access

Bracket syntax after the top-level entity also supports *single-key access*. These address a specific *single row*, and yield a *not found* error if that row doesn't exist.

```sql :cql
SELECT from Countries['GB']
SELECT from Books[201]
UPDATE Books[201] set stock = stock - 1
UPDATE Books[201] with { stock: 7 } -- `with` takes a JavaScript-like record
DELETE Books[201]
```

The standard SQL variants with `where` are supported as well; these do not raise *not found* errors, but return an *empty result set*, or `{affected:0}`:

```sql :cql
SELECT from Books where ...
DELETE from Books where ...
UPDATE Books set x=1 where ...
```

## Deep Inserts / Upserts

`INSERT`/`UPSERT` support JavaScript-like record notation `{key:value}` with *nested records* to **write *composition* trees** in one statement:

```sql :cql
INSERT into Authors {
  name: 'Alfred, Lord Tennyson',
  books: [
    { title: 'The Lady of Shalott', stock: 23 },
    { title: 'Ulysses', stock: 42 },
  ]
}
```

- Leaf values are literals – no expressions, element refs, or pseudo variables.
- Multiple input records are supported, e.g.: `INSERT into Foo {x:1}, {x:2}, {x:3}`.
- For `INSERT`, single `UUID` keys are filled automatically.
- For `UPSERT`, all keys must be specified in the records.
- Deep writes only follow *compositions*, not associations.
- *Child→parent* uplinks are filled in automatically for *managed* associations.

## Flat Writes / Updates

Unlike deep writes, flat writes don't create a composition tree. They use record syntax to fill an association's nested *foreign key elements*, linking to existing targets. Attempts to write target elements are rejected.

```sql :cql
INSERT into Books {
  title: 'Poems by Edgar Allan Poe',
  author: { ID: 150 } -- nested record with foreign keys
}
```

CQL extends standard SQL's `UPDATE` syntax by a `with` clause:

```sql :cql
UPDATE Books with {
  title: 'Poems by Edgar Allan Poe',
  author: { ID: 150 } -- nested record with foreign keys
} where ID = 144
```

## Operators & Functions

CQL adds **null-safe `==`, `!=` operators**, which behave as in JavaScript: *null* is treated like any other value. SQL's three-valued `=`, `<>` operators (still supported) instead treat comparisons with *null* as *unspecified* → *false*, silently skipping rows:

```sql :cql
... where x != 0  -- null-safe: keeps rows where x is null
... where x <> 0  -- SQL: skips rows where x is null
```

#### Standard SQL operators & predicates

- SQL's standard logic, comparison, arithmetic operators
- `LIKE`, `BETWEEN`, `CASE WHEN`, `IN`, `IS NULL`, `IS NOT NULL`, `||`.

#### Aggregate

- `count(*)`/`count(f)`
- `sum(n)`/`avg(n)`
- `min(f)`/`max(f)`

#### Numeric

- `ceil(n)`, `floor(n)`, `round(n)`

#### String

- `startswith(s,x)`, `endswith(s,x)`, `contains(s,x)` — case-sensitive
- `substring(s,pos,len)` — *0-based* `pos`; omit `len` for remainder
- `indexof(s,x)` — returns  *0-based* position of `x` in `s`, or `-1`
- `length(s)` / `tolower(s)` / `toupper(s)` / `trim(s)`
- `concat(s,...)` — e.g. `concat(first, ' ', last)`

#### Date

- `date(d)` / `time(d)` / `year(d)` / `month(d)` / `day(d)` / `hour(d)` / `minute(d)` / `second(d)`
- `days_between(d1,d2)` / `weeks_between(d1,d2)` / `months_between(d1,d2)` / `years_between(d1,d2)`

Date/time literals are ISO 8601 strings:  
`'2026-10-12T12:34:56.789Z'`, `'2026-10-12'`, `'12:34:56'`.

## Pseudo Variables

- `$now` — current timestamp
- `$user` — current user ID
- Usable in all query clauses, **except** input record values.

```sql :cql
SELECT from Books where createdAt < $now and createdBy = $user
```

## Closing Remarks

**Draft system fields** like `IsActiveEntity`, `HasActiveEntity`, `HasDraftEntity`, `DraftAdministrativeData`, may show up → ignore unless working with drafts.
