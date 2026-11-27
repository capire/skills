# JavaScript Value Binding — Draft for the Pending `cds.ql` Guide

See `cap-cql` for query syntax and `cap-hcql` for HTTP request payloads.

## Passing Values

Bind user-supplied values instead of concatenating query strings:

```js
cql`SELECT from Books where title = ${title}`
cql('SELECT from Books where title = ?', [title])
cql('SELECT from Books where stock > :min or reserved > :min', { min: 0 })
cql('SELECT from Books where ID = ?2 and title = ?1', [title, 201])
```

- String interpolations in value positions remain values, never parsed CQL. Don't put template holes inside CQL string literals.
- Supply every required value.
- A single array is the argument container. To bind one list, nest it: `cql('SELECT from Books where ID in ?', [[201, 202]])`.
- Prefer positional or named parameters consistently within a query.

## Deferred Binding

Use `.bind()` to supply values to a query containing parameters:

```js
cql`SELECT from Books[?] where stock > ?`.bind(201, 10)
cql('SELECT from Books where title = :title').bind({ title: "O'Brien" })
cql('SELECT from Books where ID in ?').bind([[201, 202]])
```

## Structural Interpolations

Tagged templates can interpolate entities, whole records, and object-form predicates. These are not value parameters, and `.bind()` does not replace them:

```js
cql`UPDATE ${'Books'} with ${{ title: 'Poems' }} where ID=${201}`.bind(202)
// Only the WHERE value changes; title remains 'Poems'.
```

Record fields don't accept parameters. Use `UPDATE ... SET` or `INSERT/UPSERT ... VALUES` to bind individual field values.

## Opt-in Template Caching

Enable with `cql.cache.enabled = true` for repeated calls at the same tagged-template site.

- Templates with only value interpolations or no interpolations can be cached.
- Structural interpolations disable caching for that template.
- Ordinary string calls and fluent queries are not cached.

**Bind immediately before execution; don't retain a bound query for later use or yield before consuming its values.** Rebinding a cached template can affect earlier bound queries.
