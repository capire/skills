---
name: cap-developer
description: Expert guidance for building and extending CAP (Cloud Application Programming Model) applications in either Node.js or Java. Covers project initialization, CDS modeling, declarative annotations, and custom handler best practices for both runtimes. Use when building a new CAP app, extending an existing one, or reviewing CAP code for correctness and idioms — regardless of whether the stack is Node.js or Java.
license: MIT
metadata:
  author: cap-team
  team: cap
---

## What I do

Provide correct, lean, idiomatic guidance for CAP development — from project setup and CDS
modeling through declarative annotations and programmatic event handlers.

## Runtime Choice

When in a new project, use the globally installed `@sap/cds-dk` (cli: `cds`).
Defer the language choice until necessary.
This choice is only necessary once code is added or the app is deployed.

When only working with cds models, you can simply start with `cds w` without needing to define a runtime.

## MCP Server

Always use the CAP MCP server to:
- Search CAP documentation before guessing at APIs or annotations
- Read the effective CDS model of an existing project before adding or changing anything

Never use the CAP MCP server as Fiori/SAPUI5 documentation. It contains useful information about
how CAP integrates with Fiori/SAPUI5 but is not a complete reference for those frameworks.

**Caveat on release notes and version tables:** MCP search results sourced from release notes or
version recommendation tables may be outdated — they reflect what was true *at the time of that
release*, not necessarily today. Always cross-check version-specific claims (e.g. "recommended
Node.js version") against live sources like `cds version`, `npm view`, or the current Getting
Started page rather than trusting a snapshot from a past release note.

## Project setup rules

Start a new project with:

```sh
cds init <name>        # creates a subdirectory; omit <name> to init in cwd
cd <name>
cds watch              # start the dev loop (works without a runtime for pure modeling)
```

When the runtime is known upfront, pass `--java` or `--nodejs` to `cds init` (see the
runtime-specific reference files for details).

- **Never** run `cds add sample` — it scaffolds a full demo app into the project.
- Use `cds add tiny-sample` only if the user explicitly wants a minimal starter model.
- Use `cds add <feature>` (e.g. `hana`, `xsuaa`, `approuter`, `mta`) to add features incrementally
  and only when needed (e.g. when deployment is requested).

## CDS Modeling

Apply these conventions consistently:

- Reuse built-in aspects: `cuid`, `managed`, `temporal` from `@sap/cds/common`
- Use `Composition of many` for parent-child / document structures; `Association to` for references
- Use `localized String` for user-facing text that needs translation
- Naming: PascalCase for entities and types, camelCase for elements
- Define a `namespace` in `db/schema.cds` to avoid naming collisions between db and service layers
- Always expose db entities via projections in services — never expose db entities directly
- Expose only the elements clients actually need; use `{*, ...} excluding { ... }` to trim
  (`excluding` only works after the wildcard `*` selector)
- Don't expose an entity just because it exists — shape the projection for the consumer: trim with
  `excluding`, add calculated fields or flattened associations (e.g. `author.name as author`), and
  restrict with `@restrict`; only reach for actions/functions when the shape can't be expressed
  declaratively
- Entities written to only internally don't belong in the public service; put them in an admin
  service if needed
- Avoid two projections in the same service pointing to the same underlying entity — CDS can't
  auto-redirect associations and will error; remove the redundant projection or use
  `@cds.redirection.target`
- Keep Fiori UI annotations in `app/` annotation files, not in service definitions

## Declarative First

Prefer annotations over custom handler code. Only write handlers when declarative options are
insufficient.

| Need | Annotation |
|---|---|
| Input validation (format) | `@assert.format: '...'` |
| Input validation (range) | `@assert.range: [min, max]` |
| Input validation (enum) | `@assert.range enum { val1; val2; }` |
| Target Entity exists check | `@assert.target` |
| Cross-field / exists check | `@assert: (case when ... then '...' end)` |
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

## Programmatic custom logic

Only when declarative annotations aren't enough, write an event handler. Three phases exist
(runtime-agnostic):

- **before** — input validation that can't be expressed declaratively; reject early before DB writes.
- **on** — custom actions and functions.
- **after** — side effects like emitting async events.

Two rules hold for both runtimes:

- Don't write handlers for things the generic service provider already handles.
- Rely on CAP's intrinsic transaction handling — no manual transactions.

The handler API differs substantially between runtimes. Read the matching reference for full guidance:

- `references/nodejs.md` — `srv.before` / `srv.on` / `srv.after`, `req.reject(code, message)`,
  intrinsic transactions, the round-trip-minimization pattern.
- `references/java.md` — `@Before` / `@On` / `@After` with reflection-based event/entity
  detection, typed `CdsResult<D>` vs untyped `Result`, `ServiceException` vs `messages.error`,
  the race-condition-safe `.set(field, expr)` update pattern, and more.

## Sample Data

Generate data files with the CLI, never create them manually or invent UUIDs.

1. Generate CSVs for all entities: `cds add data --records <Amount>`
   Use `--filter <Entity>` to scope to specific entities (case-insensitive substring match; use
   regex like `books$` to exclude `.texts` compositions).
2. Replace placeholder values (e.g. `title-29894036`) with realistic domain content. Keep generated
   IDs and foreign-key references intact.

**Gotcha**: `cds add data` without `--records` generates header-only CSVs — always pass
`--records`.


## Don't

- Write handlers for things the generic service provider already handles
- Hardcode tenant IDs, system IDs, or credentials anywhere
- Put user-facing strings inline — use `_i18n/` bundles
- Run `cds add sample`

Runtime-specific don'ts (e.g. `await` inside `cds.on('served', ...)` in Node) live in the
respective reference file.
