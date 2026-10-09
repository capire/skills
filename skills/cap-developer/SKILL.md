---
name: cap-developer
description: Expert guidance for building and extending CAP (Cloud Application Programming Model) applications in either Node.js or Java. Covers project initialization, CDS modeling, declarative annotations, and custom handler best practices for both runtimes. Use when building a new CAP app, extending an existing one, or reviewing CAP code for correctness and idioms — regardless of whether the stack is Node.js or Java.
license: Apache-2.0
metadata:
  author: cap-team
  team: cap
---

## What I do

Provide correct, lean, idiomatic guidance for CAP development — from project setup and CDS
modeling through declarative annotations and programmatic event handlers.

This SKILL.md is a **router**. Each topic lives in its own reference file so it can be loaded and
cross-referenced on its own. Read only the file(s) the task needs.

## Reference map

| Topic | File | Load when |
|---|---|---|
| Domain model + service projections | `references/cds-modeling.md` | Modeling entities/aspects/associations, or exposing them via projections |
| Declarative annotations (validation, constraints, auth) | `references/declarative.md` | Adding validation, mandatory/readonly/computed values, `@restrict`/`@requires` |
| Custom event handlers | `references/custom-logic.md` | Only when annotations can't express the rule; before/on/after logic |
| Sample / seed data | `references/sample-data.md` | Generating test data with the CLI |
| Node.js runtime specifics | `references/nodejs.md` | The project is a CAP Node.js app |
| Java runtime specifics | `references/java.md` | The project is a CAP Java app |

## Runtime Choice

When in a new project, use the globally installed `@sap/cds-dk` (cli: `cds`).
Defer the language choice until necessary.
This choice is only necessary once code is added or the app is deployed.

When only working with cds models, you can simply start with `cds w` without needing to define a runtime.

## Documentation source

Before guessing at APIs or annotations — and before changing an existing project's model —
consult authoritative CAP documentation. Use whichever source is available; never guess URLs
or invent APIs:

- **CAP MCP server (preferred when present).** Use it to:
  - Search CAP documentation before guessing at APIs or annotations
  - Read the effective CDS model of an existing project before adding or changing anything
- **capire LLM docs (fallback when no MCP server is configured).** The official docs expose
  LLM-friendly entry points — use these instead of ad-hoc web searches:
  - `https://cap.cloud.sap/docs/llms.txt` — a curated index of every documentation page; start
    here to locate the right topic.
  - `https://cap.cloud.sap/docs/llms-full.txt` — the full documentation concatenated into one
    file, for when you need the complete text.
  - `https://cap.cloud.sap/docs/sitemap.md` — the semantic sitemap of all pages.
  - Any page is available as markdown by appending `.md` to its URL (e.g.
    `https://cap.cloud.sap/docs/get-started/bookshop.md`) or by sending an
    `Accept: text/markdown` header. Follow links from `llms.txt`/`sitemap.md` to the exact page
    rather than guessing a path.
  - Inspect the effective CDS model without the MCP server via `cds compile <path>` (e.g.
    `cds compile srv --to edmx`).

Never use CAP docs as a Fiori/SAPUI5 reference. They contain useful information about how CAP
integrates with Fiori/SAPUI5 but are not a complete reference for those frameworks.

**Caveat on release notes and version tables:** documentation sourced from release notes or
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

## Working order

1. **Model the domain** → `references/cds-modeling.md`
2. **Expose services via projections** → `references/cds-modeling.md`
3. **Add constraints declaratively first** → `references/declarative.md`
4. **Write handlers only where annotations fall short** → `references/custom-logic.md`
   (+ the runtime file `references/nodejs.md` or `references/java.md`)
5. **Generate sample data** → `references/sample-data.md`

## Don't

- Write handlers for things the generic service provider already handles
- Hardcode tenant IDs, system IDs, or credentials anywhere
- Put user-facing strings inline — use `_i18n/` bundles
- Run `cds add sample`

Runtime-specific don'ts (e.g. `await` inside `cds.on('served', ...)` in Node) live in the
respective reference file.
