---
name: cap-cds-review
description: Review and assess CDS data models in CAP applications for correctness, best practices, and potential issues. Produces a structured report with severity-rated findings covering naming conventions, associations/compositions, annotations, reuse patterns, service projections, and performance considerations. Use this skill whenever a developer asks to review, audit, or improve their CDS model, or proactively when you notice potential modeling issues while working on a CAP project.
license: Apache-2.0
metadata:
  author: cap-team
  team: cap
---

## What I do

Perform a comprehensive review of CDS data models in CAP (Cloud Application Programming Model)
projects. Produce a structured report with categorized findings rated by severity, helping
developers catch issues early and align with CAP idioms.

## MCP Server

Always use the CAP MCP server to:
- Load the effective CDS model of the project (`cds-mcp_search_model`) to understand the full picture including resolved aspects and imports
- Search CAP documentation (`cds-mcp_search_docs`) when unsure about a convention or annotation

## Steps

### 1. Gather the model

Collect all `.cds` files in the project. Focus on:
- `db/` — domain model (schema, types, aspects)
- `srv/` — service definitions and projections
- `app/` — annotation files (if present)

Use the MCP model search to get the effective (compiled) model for cross-referencing.

### 2. Run the review checklist

Evaluate the model against each category below. Only report actual findings — skip categories
where everything looks good. For each finding, assign a severity:

| Severity | Meaning |
|----------|---------|
| **error** | Will cause runtime failures, data loss, or broken APIs |
| **warning** | Deviates from best practice; likely causes maintainability or performance issues |
| **info** | Suggestion for improvement; not strictly wrong but could be better |

---

#### 2.1 Naming Conventions

| Rule | Rationale |
|------|-----------|
| Entities and types: PascalCase (e.g. `Books`, `OrderItems`) | CDS convention; consistent OData entity set names |
| Elements: camelCase (e.g. `createdAt`, `orderNo`) | CDS convention; maps cleanly to JSON property names |
| Namespace declared in `db/schema.cds` | Avoids naming collisions between db and srv layers |
| Service names: PascalCase with `Service` suffix (e.g. `CatalogService`) | Convention for discoverability |
| File names: kebab-case matching the service name (e.g. `catalog-service.cds`) | Convention-based handler discovery |

Watch for:
- Mixed naming styles (some entities camelCase, others PascalCase)
- Overly generic names (`Data`, `Info`, `Item` without qualifier)
- Abbreviations that hurt readability (`CustOrdItm` vs `CustomerOrderItems`)

#### 2.2 Keys and Identity

| Rule | Rationale |
|------|-----------|
| Use `cuid` aspect for UUID primary keys | Standard, runtime auto-fills on insert |
| Avoid multi-column natural keys unless business requires them | Simplifies associations and OData navigation |
| Every entity must have at least one key | Required for persistence and OData addressing |

Watch for:
- Entities without explicit keys (compile error in strict mode)
- Hand-rolled UUID keys instead of using `cuid`
- Integer auto-increment keys (not natively supported in CAP)

#### 2.3 Aspects and Reuse

| Rule | Rationale |
|------|-----------|
| Use `managed` aspect on root/independent entities that need audit trails | Auto-fills createdAt/By, modifiedAt/By |
| Don't blindly apply `managed` to composition children | Children are created/modified together with their parent — the parent's audit fields already capture who and when; adding `managed` to every child just bloats the DB with redundant data |
| Use `temporal` aspect for time-slice entities | Enables built-in time-travel queries |
| Factor repeated element groups into custom aspects | DRY; single place to evolve |
| Import from `@sap/cds/common` for standard types | Currency, Country, Language already modeled |

When reviewing `managed` usage, ask: does this entity have an independent lifecycle where you'd want to know *separately* who last touched it? Root entities and independently-addressable entities: yes. Composition children that are always edited through their parent: usually no.

Watch for:
- Manual `createdAt : Timestamp` / `modifiedAt : Timestamp` without `managed`
- `managed` applied indiscriminately to all entities including composition children (ask if audit fields on children are actually needed)
- Duplicated element definitions across multiple entities (extract aspect)
- Not importing `@sap/cds/common` when using countries, currencies, or languages

#### 2.4 Associations and Compositions

| Rule | Rationale |
|------|-----------|
| `Composition of many` for parent-child / document structures | Lifecycle coupling; cascade delete; draft support |
| `Association to` for cross-references between independent entities | No lifecycle coupling |
| `to many` associations must have an ON condition | Required since CDS 9; compiler error without it |
| Backlink associations in children use `Association to <Parent>` | Required for explicit compositions |

Watch for:
- `Composition` used between independent entities (over-coupling)
- `Association` used for header-item relationships (losing cascade semantics)
- `Association to many` without ON condition (breaks in CDS 9+)
- Circular compositions (runtime error)
- Redundant/orphan associations that nothing navigates

#### 2.5 Types and Element Definitions

| Rule | Rationale |
|------|-----------|
| Specify `String` lengths (e.g. `String(100)`) | Prevents oversized DB columns; explicit contracts |
| Use `localized String` for user-facing translatable text | Enables built-in i18n text handling |
| Use reuse types (`Currency`, `Country`, `Language`) from common | Consistent code-list handling |
| Prefer typed enums over free-text status fields | Type safety; value-help generation |
| Use `Decimal(precision, scale)` for money/quantities | Avoids floating-point issues |

Watch for:
- Bare `String` without length (defaults to 5000 chars unless configured)
- `String` or `LargeString` without length used for content that might be a file/attachment — ask whether the field is meant to store document bodies, rich text, or binary content; if so, recommend using a media entity or the CAP attachment service (`@cap-js/attachments`) instead of inlining large content into a regular entity
- `Integer` used for monetary values (precision loss)
- Status/category fields as `String` instead of enum or code-list association
- `Double`/`Float` for financial amounts

#### 2.6 Service Projections

| Rule | Rationale |
|------|-----------|
| Never expose db entities directly — always via projections | Decouples API from storage; allows trimming |
| Use `excluding { ... }` to hide internal elements | Don't expose internal fields (UUIDs of FK tables, audit fields clients don't need) |
| One service per `.cds` file | Convention-based handler discovery |
| Don't expose entities that are only written internally | Reduce API surface; use admin service if needed |
| Avoid two projections of the same entity in one service | CDS can't auto-redirect associations; causes errors |

Watch for:
- `entity X as projection on db.X` exposing everything unchanged (is trimming needed?)
- Entities that exist in the service but have no consumer use case
- Missing `@readonly` on reference/code-list entities exposed for value-help only
- Draft-enabled entities that aren't consumed by Fiori Elements

#### 2.7 Annotations

| Rule | Rationale |
|------|-----------|
| Use `@title` and `@description` (not OData-specific variants) | Protocol-agnostic; mapped automatically |
| Keep Fiori UI annotations in `app/` annotation files | Separation of concerns; db/srv stay UI-agnostic |
| Use `@mandatory` instead of custom handler validation | Declarative; works with generic providers |
| Use `@assert.format`, `@assert.range` for input validation | Declarative; less handler code |
| Use `@restrict` / `@requires` for authorization | Declarative; enforced by CAP framework |
| Use `@readonly` / `@insertonly` where appropriate | Declarative; no handler needed |

Watch for:
- `@UI.*` annotations in `srv/` or `db/` files instead of `app/`
- Custom handler validation logic that could be replaced by `@assert.*`
- Missing `@title` on important elements (hurts Fiori auto-generation)
- `@odata.draft.enabled` without a Fiori Elements consumer

#### 2.8 Performance and Scalability

| Rule | Rationale |
|------|-----------|
| Avoid deeply nested compositions (>3 levels) | Deep expand queries become expensive |
| Don't model large blobs/attachments inline | Use dedicated attachment service or media entity |
| Consider `@cds.search` for entities with free-text search needs | Enables efficient full-text search |
| Calculated elements are read-only and re-computed on every read | Don't use for expensive computations |

Watch for:
- Entities with 50+ elements (consider splitting or using aspects)
- Binary/LargeBinary fields on heavily-queried entities
- Missing indexes for common filter patterns (annotate with `@cds.persistence.index`)

### 3. Produce the report

Structure the output as follows:

```
## CDS Model Review

### Summary
<1-2 sentence overview: number of findings by severity>

### Findings

#### <Category Name>

| # | Severity | Location | Finding | Recommendation |
|---|----------|----------|---------|----------------|
| 1 | warning  | db/schema.cds:15 | ... | ... |

...repeat for each category with findings...

### Positive Observations
<Brief notes on things done well — encourages good patterns>
```

Rules for the report:
- Order categories by highest severity found in each
- Include file path and line number in Location when possible
- Keep Finding concise (one sentence); put detail in Recommendation
- If there are no findings at all, say so and highlight what was done well

### 4. Offer follow-up

After presenting the report, offer to:
- Fix specific findings (edit the CDS files)
- Explain the rationale for any finding in more detail
- Re-run the review after fixes are applied

## Notes

- This review covers the data model layer. For handler code review, defer to the
  `cap-developer` skill.
- When in doubt about a convention, search the CAP documentation via MCP rather than guessing.
- The review should be pragmatic — a small prototype doesn't need the same rigor as a
  production application. Calibrate based on project maturity.
- If the project has a `package.json` with `@sap/cds` version info, note the CDS version
  to ensure recommendations are compatible (e.g., ON conditions for `to many` are required
  starting CDS 9).
