# CDS Modeling — domain model and service projections

Read this file when modeling the domain (entities, aspects, associations/compositions) or when
exposing that domain through service projections shaped for consumers. Runtime-agnostic — applies
to both Node.js and Java.

## Domain model conventions

Apply these consistently:

- Reuse built-in aspects: `cuid`, `managed`, `temporal` from `@sap/cds/common`
  - Apply `managed` only to root entities of a composition tree; not to children — the parent's audit fields already cover them
- Use `Composition of many` for parent-child / document structures; `Association to` for references
- Use `localized String` for user-facing text that needs translation
- Naming: PascalCase for entities and types, camelCase for elements
- Define a `namespace` in `db/schema.cds` to avoid naming collisions between db and service layers

## Service projections

Never expose db entities directly — always shape them for the consumer:

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
