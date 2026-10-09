# Sample Data — CLI-generated CSVs

Read this file when generating test/seed data. Runtime-agnostic.

Generate data files with the CLI, never create them manually or invent UUIDs. Let the CLI own the
keys and foreign keys (so associations and compositions line up reliably), then use AI to fill in
meaningful domain content.

## Workflow

1. Generate CSVs with keys and foreign keys only:
   `cds add data --records <Amount> --keys-only`
   This fills only key columns (including the foreign keys backing associations and compositions),
   leaving all other columns empty. Because the CLI generates consistent UUIDs and FK references,
   relationships resolve correctly and you never risk breaking them by hand.
   Use `--filter <Entity>` to scope to specific entities (case-insensitive substring match; use
   regex like `books$` to exclude `.texts` compositions).
2. Fill in the empty non-key columns with realistic, meaningful domain content. Keep the generated
   header row (column names) and the generated keys and foreign-key references exactly as-is —
   never rename headers, and never edit or invent keys/FKs. Quote strings that contain commas.

**Why `--keys-only`**: hand-editing UUIDs and FKs is error-prone and silently breaks
associations/compositions. Delegating keys to the CLI and content to AI keeps referential integrity
intact while still producing realistic data.

## Gotchas

- `--keys-only` requires `--records`; without `--records` you get header-only CSVs regardless.
- If `--keys-only` is not recognized, the globally installed `@sap/cds-dk` is likely outdated —
  update it with `npm i -g @sap/cds-dk` and retry.
- If you omit `--keys-only`, the CLI fills every column with placeholders (e.g. `title-29894036`)
  that you then replace — keys and FK references must still be left intact.
