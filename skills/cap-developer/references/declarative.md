# Declarative First — annotations before code

Read this file when adding validation, mandatory/readonly/computed constraints, or
authorization. Runtime-agnostic — the annotations are identical in Node.js and Java.

Prefer annotations over custom handler code. Only write handlers when declarative options are
insufficient (see `custom-logic.md`).

## Declarative First table

| Need | Annotation |
|---|---|
| Input validation (format) | `@assert.format: '...'` |
| Input validation (range) | `@assert.range: [min, max]` |
| Input validation (enum) | `@assert.range enum { val1; val2; }` |
| Target Entity exists check | `@assert: (case when not exists <assoc> then '...' end)` |
| Cross-field / exists check | `@assert: (case when ... then '...' end)` |
| Uniqueness | `@assert: (case when exists others[...] then '...' end)` — see below |
| Required field | `@mandatory` |
| Read-only entity | `@readonly` |
| Insert-only entity | `@insertonly` |
| Authorization | `@restrict` / `@requires` |
| Audit fields | `: managed` aspect |
| Draft support | `@odata.draft.enabled` |
| Derived / computed values | Calculated elements: `total : Decimal = price * quantity;` |
| Status-transition workflow (approve/reject/etc.) | `@flow.status` + `@from` / `@to` on actions pre-GA / Gamma |

> Use Draft only when building a Fiori / SAPUI5 application. It is a complex mechanism that other
> UI frameworks cannot handle easily.

## `@assert: (case when … end)` — the workhorse

Don't underestimate `@assert: (case when … end)` — it eliminates most "I need a handler for this"
cases. It's an expression evaluated per row over that row's own elements; the row is rejected when
the expression yields a falsy / null result, so you write it to *return the thing that must hold*.
Because it's plain CDS/SQL-style logic, it covers rules that feel procedural but aren't:

- **Conditionally required field** — when resolved, `resolvedAt` must be set:
  `@assert: (case when status = 'resolved' then resolvedAt end)`
- **Field-vs-field comparison** — end must not precede start:
  `@assert: (endDate >= startDate)`
- **Value depends on another field** — a discount is only valid on sale items:
  `@assert: (case when discount > 0 then onSale end)`

It can reference any elements on the *same* entity and use the usual comparison, boolean, and null
operators. Via associations it can also reach *other rows* (see uniqueness below). What it *can't*
do is call out to services or run async work — those are the genuine handler cases
(see `custom-logic.md`).

### Prefer `@assert:` over `@assert.target`

For "the referenced entity must exist" checks, write the `exists` predicate yourself instead of
using `@assert.target`, because that lets you provide a specific error message:

```cds
driver @assert: (case
  when not exists driver then 'ASSERT_DRIVER_UNKNOWN'
end);
```

The message is a plain `i18n` key — resolved from `_i18n/messages.properties`, **no** `{i18n>…}`
wrapper — and it also surfaces as the error `code` in the response.

### Prefer `@assert:` over `@assert.unique` too

Uniqueness *is* expressible declaratively: add an unmanaged self-association that reaches all rows, then use `exists` with a filter. Again the payoff is a specific message instead of a generic one:

```cds
// helper to reach all other rows from within the constraint
extend my.Drivers with {
  others : Association to many my.Drivers on 1 = 1;
}

annotate my.Drivers with {
  email @assert: (case
    when exists others[email = $self.email and ID != $self.ID] then 'ASSERT_EMAIL_TAKEN'
  end);
}
```

Notes:

- Use `extend` to define the helper association in the *constraints* file next to the `@assert:` constraint that needs it — reason being it is a mere helper, and we should avoid polluting the core domain with such secondary concerns.

- The `@assert.unique` annotation is not supported as an **element-level** annotation, only as the rather clumsy entity-level form. One more reason to use the `exists` form.

- This also catches duplicates *within a single deep insert* — each offending row gets its own
  error, so OData wraps them in "Multiple errors occurred".
- Messages from annotations cannot carry `args`, so don't point them at i18n texts containing
  `{0}` placeholders — those render literally.

## Authorization — `@requires` / `@restrict`

Layer access control declaratively before reaching for code:

- Protect services/entities with `@requires: 'role'`.
- Fine-grained rules with `@restrict: [{ grant, to, where }]`.
- Instance-based restrictions (`where: 'createdBy = $user'`) cover most row-level cases without a
  handler.
- The `authenticated-user` pseudo-role applies to every authenticated user.

Only fall back to a `before` handler for instance-level checks that can't be expressed
declaratively. Never hardcode roles, tenant IDs, or credentials.

Why declarative wins: constraints are enforced consistently across OData, drafts, and batch
requests, are visible in metadata, and can't be accidentally bypassed by another handler — a
hand-written `before` check gets none of that for free.
