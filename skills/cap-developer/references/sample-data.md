# Sample Data — CLI-generated CSVs

Read this file when generating test/seed data. Runtime-agnostic.

Use **CDS DK 10.2 or later** to generate keys and relationships, then fill in domain content.
See [adding initial data](https://cap.cloud.sap/docs/guides/databases/initial-data).

## Workflow

1. **Generate.** Check `@sap/cds-dk` with `cds --version`, then run:
   `cds add data --records <Amount> --keys-only`
   DK 10.2+ fills primary keys and managed foreign keys, including composition backlinks,
   leaving other content empty. Enum code lists include every enum value regardless of
   `--records`, with matching localized `.texts` keys.
   Check options with `cds add data --help`. Scope with `--filter <Entity>` (case-insensitive
   substring match; regex `books$` excludes `.texts` compositions).
2. **Fill and check references.** Preserve headers, generated UUID primary keys, and valid
   foreign keys. Fill content with realistic data for the intended demos/tests. Verify every
   foreign key against its target, including compound keys, associations used as keys, and
   special/unmanaged relationships. Repair references by copying existing target keys, never
   inventing unrelated UUIDs. Code-list keys must be domain values; if corrected, update all
   references and matching `.texts` keys together.
3. **Validate.** Check business rules (dates, currencies, statuses, etc.), deploy, then exercise
   representative service reads and writes. CSV deployment alone does not validate service rules.

Quote CSV strings containing commas or line breaks; escape double quotes by doubling them.

## Gotchas

- Without `--records`, `--keys-only` is ignored: ordinary entities get headers only, but DK 10.2+
  still emits enum code-list rows.
- **DK 10.1:** ordinary foreign keys remain empty and enum code lists may be incomplete. Upgrade,
  or copy existing target keys into missing references and complete code lists and `.texts` rows.
- Unrecognized `--keys-only` usually means an outdated global DK; run `npm i -g @sap/cds-dk`.
- Without `--keys-only`, content gets generic sample values (e.g. `title-29894036`); apply the
  same reference and business-rule checks before replacing them.
