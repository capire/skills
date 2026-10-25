# Declarative First — annotations before code

Read this file when adding validation, mandatory/readonly/computed constraints, or
authorization. These are shared CDS patterns; verify feature support and enforcement details
for the project's Node.js or Java runtime and version against the CAP docs.

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
| Uniqueness | `@assert.unique.<name>: [ ... ]` on a DB entity; `@assert: (case when exists others[...] then '...' end)` for custom validation — see below |
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
cases. Write a SQL-style `case` expression that returns an **error message or i18n key when a
rule is violated**, and **null when the row is valid**. With no `else`, a non-matching `case`
returns null. This is a message-producing constraint, not a Boolean truth test:

- **Conditionally required field** — when resolved, `resolvedAt` must be set:
  `@assert: (case when status = 'resolved' and resolvedAt is null then 'ASSERT_RESOLVED_AT_REQUIRED' end)`
- **Field-vs-field comparison** — end must not precede start:
  `@assert: (case when endDate < startDate then 'ASSERT_ENDDATE_BEFORE_STARTDATE' end)`
- **Value depends on another field** — a discount is only valid on sale items:
  `@assert: (case when discount > 0 and (onSale is null or onSale = false) then 'ASSERT_DISCOUNT_REQUIRES_SALE' end)`

It can reference any elements on the *same* entity and use the usual comparison, boolean, and null
operators. Via associations it can also reach *other rows* (see uniqueness below). What it *can't*
do is call out to services or run async work — those are the genuine handler cases
(see `custom-logic.md`). A DB lookup alone is not a reason to write a handler. Use `@mandatory`
for unconditionally required fields and explicit null checks for conditional requirements.

See the official [constraint syntax and association examples](https://cap.cloud.sap/docs/guides/services/constraints#assert-constraint)
and [localized messages](https://cap.cloud.sap/docs/guides/services/constraints#localized-messages).

### Target-existence checks

`@assert.target` is the built-in existence check for managed to-one association targets.
Use an `@assert` expression when you need conditional checks or a rule-specific message:

```cds
driver @assert: (case
  when not exists driver then 'ASSERT_DRIVER_UNKNOWN'
end);
```

The message is a plain `i18n` key — resolved from `_i18n/messages.properties`, **no** `{i18n>…}`
wrapper — and it also surfaces as the error `code` in the response.

### Uniqueness: database constraints and custom validation

For equality-based uniqueness, annotate the **DB entity** with a named constraint, for example
`@assert.unique.email: [email]`. CAP translates this into a SQL `UNIQUE` constraint, which
protects database writes, including concurrent ones. See [unique constraints](https://cap.cloud.sap/docs/guides/databases/cdl-to-ddl#unique-constraints).

For custom validation messages or rules such as overlapping periods, add an unmanaged
self-association and use `exists` with a filter. This validation is not a substitute for a
database uniqueness constraint where one fits. In this example, `my` is the DB namespace alias
and `DriverService.Drivers` projects `my.Drivers`:

```cds
// helper to reach all other rows from within the constraint
extend my.Drivers with {
  others : Association to many my.Drivers on 1 = 1;
}

annotate DriverService.Drivers with {
  email @assert: (case
    when exists others[email = $self.email and ID != $self.ID] then 'ASSERT_EMAIL_TAKEN'
  end);
}
```

Notes:

- Use `extend` to define the helper association in the *constraints* file next to the `@assert:` constraint that needs it — reason being it is a mere helper, and we should avoid polluting the core domain with such secondary concerns.

- `@assert.unique.<name>` is an **entity-level** annotation, not an element-level annotation.

- This also catches duplicates *within a single deep insert* — each offending row gets its own
  error, so OData wraps them in "Multiple errors occurred".
- The simple `then 'MESSAGE_KEY'` expressions above supply no message arguments. Use i18n texts
  without `{0}` placeholders for those expressions.

### Verify validation scope

Place input constraints on the service entities that accept writes. Test the supported write
paths: parent constraints do not automatically run when only a child is changed, and child
constraints do not automatically run when only a parent is changed. Check the chosen runtime's
draft behavior separately from active writes: [draft PATCH can persist invalid data with validation messages](https://cap.cloud.sap/docs/guides/uis/fiori#draft-input-validation).
Not every assertion is represented in OData metadata. Custom handlers still participate in the
service request pipeline, but additional direct database operations do not automatically inherit
the service entity's validation or authorization checks.

## Authorization — `@requires` / `@restrict`

Layer access control declaratively before reaching for code:

- Protect services/entities with `@requires: 'role'`.
- Fine-grained rules with `@restrict: [{ grant, to, where }]`.
- Instance-based restrictions (`where: 'createdBy = $user'`) cover most row-level cases without a
  handler.
- The `authenticated-user` pseudo-role applies to every authenticated user.

Only fall back to a `before` handler for instance-level checks that can't be expressed
declaratively. Declare role names in CDS and local test-user configuration; avoid hardcoded
identity checks in handlers and keep credentials out of source code.

Protect all relevant service entities and actions/functions. A custom function reading a DB
entity directly does not inherit the corresponding service entity's authorization restrictions.
In Node.js, restrictions are evaluated on the request's target; associated entities in expands
and nested entities in deep writes are not independently checked. See [authorization limitations](https://cap.cloud.sap/docs/guides/security/authorization#limitations-in-nodejs).
