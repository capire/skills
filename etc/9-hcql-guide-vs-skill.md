# HCQL Guide vs. Skill

Date: 2026-11-24

## Context and conclusion

Given the HCQL guide at <http://localhost:5173/docs/guides/protocols/hcql.md> and the `cap-hcql` skill, the comparison asks whether documentation can provide the same efficient agent guidance without losing scope. The guide was fetched and both `cap-hcql` and its companion `cap-cql` were loaded; this was a content comparison, not independent runtime verification.

The guide is more complete and qualified as standalone documentation; the skill pair is more compact for repeated agent use. An agent-first guide can close most of that usability gap through a quick workflow, decision table, contextual hazards and selectively accessible reference sections. Skills then retain chiefly discovery, task matching, resource packaging and environment integration advantages—not inherently superior content.

Recommendation: keep the guide as the canonical protocol reference and a thin skill as its agent entry point, avoiding two independently maintained HCQL contracts. The conversation proposed this direction; no guide or skill changes were made as part of it.

## Reading-cost baseline before client consolidation

Given the revised guides at external-docs commit `6320755e`, the expected outcome is skill-like reading efficiency while retaining the broader reference scope. The actual common read path still spans four Markdown documents and exceeds the protocol skill's size. Selective retrieval alone did not establish comparable efficiency.

Counts below are whitespace-separated words in raw Markdown, including frontmatter and examples; they are not token counts or fresh-session adoption results. Captured on 2026-11-24 before consolidating the client instructions.

| Reading path | Guides | Skills |
| --- | ---: | ---: |
| Simple REST read: entry, requests, reads, responses | 1,806 across 4 files | 1,261 (`cap-hcql`) |
| Same references plus Core QL | 3,464 across 5 files | 2,681 (both skills) |

| File | Words |
| --- | ---: |
| `cap-hcql/SKILL.md` | 1,261 |
| `cap-cql/SKILL.md` | 1,420 |
| `hcql.md` | 362 |
| `hcql/requests.md` | 688 |
| `hcql/reads.md` | 437 |
| `hcql/writes.md` | 681 |
| `hcql/responses.md` | 319 |
| `hcql/core-ql.md` | 1,658 |
| `hcql/server.md` | 819 |
| `hcql/serving.md` | 175 |
| `hcql/qualification.md` | 360 |

The review also found read constraints under writes and ordinary response handling behind a separate retrieval. The approved next step is to consolidate the common client contract and reassign or rename reference files by content. Adoption testing and publication remain deferred. Working, correctly rebased `llms-full.txt` links remain important for embedding skill guidance in Capire.

## After client consolidation

The common client contract now resides directly in `hcql.md`, including general query restrictions, write semantics, operations and response handling. Detailed discovery responses moved to `discovery.md`; richer read/write, translation and operation examples moved to `examples.md`; `server.md` became `config.md`. The four client fragments were retired. Collection-bound operations are now explicitly excluded.

| Reading path | Before | After | Skills |
| --- | ---: | ---: | ---: |
| Routine REST read | 1,806 / 4 files | 1,246 / 1 file | 1,261 / 1 file |
| Same path plus language reference | 3,464 / 5 files | 2,904 / 2 files | 2,681 / 2 files |

The routine path is 31% smaller and close to the protocol skill's size. With Core QL, the guides remain 223 words (8%) larger than the skill pair. These remain static raw-Markdown comparisons; tasks needing detailed discovery or examples incur additional reading. Comparable agent performance has not been established.

| Current file | Words |
| --- | ---: |
| `hcql.md` | 1,246 |
| `hcql/core-ql.md` | 1,658 |
| `hcql/discovery.md` | 340 |
| `hcql/examples.md` | 613 |
| `hcql/config.md` | 819 |
| `hcql/serving.md` | 175 |
| `hcql/qualification.md` | 360 |

Validation: all five rendered-link checks passed. Markdown destinations, merged heading anchors and actual generated `llms-full.txt` links were checked under `/docs/` and `/preview/docs/`, including renamed references and links from included sections back to the client contract. This was an editorial/link check, not a new runtime, deployed-site or adoption qualification. Detailed output and the verification script are retained separately in `/private/var/folders/xp/84p2kpl90jz3d96s4wz4s4q00000gn/T/opencode/hcql-consolidation/`.

## After Core QL review

Given the consolidated HCQL client contract and the 1,658-word Core QL reference, the expected outcome was a compact two-file reading path retaining the language reference's scope. Tightening repeated and verbose prose reduced Core QL to 1,411 words while preserving all 18 fenced examples and 13 headings.

| Reading path | Before consolidation | After both edits | Skills |
| --- | ---: | ---: | ---: |
| HCQL client contract | 1,806 / 4 files | 1,246 / 1 file | 1,261 / 1 file |
| Core QL reference alone | 1,658 / 1 file | 1,411 / 1 file | 1,420 / 1 file |
| Common client path plus language reference | 3,464 / 5 files | 2,657 / 2 files | 2,681 / 2 files |

The guides' common reading path now closely matches the skill pair in raw-Markdown word count and number of files. This establishes a comparable static reading budget, not equivalent agent performance. Detailed discovery, translations, examples and server configuration still add task-dependent reading.

### Scope and navigation assessment

| Area | Result |
| --- | --- |
| Applicability | Explicit Core QL versus classic CQL distinction retained. |
| Language | Navigation, infix filters, semi-joins, keyed/predicate queries, binding forms and deep/flat writes remain together. |
| Query policy | Short warnings remain beside affected write examples, with independent bulk/SET opt-ins and links to configuration. |
| Bindings | Core QL defines placeholder semantics; HCQL defines envelope argument shapes and JSON payload handling. |
| Translations | Positional key order remains beside syntax; metadata derivation stays in the linked translation example. |
| Functions | One function table retains indexing, ISO literals and execution-support qualifications. |
| Common HCQL contract | Discovery workflow, transport, read restrictions, write semantics, operations and responses are available in one file. |

No further language-example split was needed. Brief repeated constraints are retained where they make examples usable on their own; detailed protocol explanations are linked rather than repeated. `CALL`, fresh-session adoption testing, publication and release applicability remain deferred.

Validation: all Core QL fenced examples and headings were compared with the pre-edit reference. Markdown destinations, rendered heading anchors and generated `llms-full.txt` links passed again under `/docs/` and `/preview/docs/`; `git diff --check` passed. Runtime qualification remains the previously recorded scope.

## Developer entry order

Serving HCQL now precedes Client Instructions, following the developer workflow: enable the protocol, discover the service, send requests, then customize configuration. Setup remains in `serving.md`, included in the rendered guide and directly linked for raw-Markdown readers. This reorder and setup link bring `hcql.md` to 1,252 words; the tables above retain their measurement-stage counts. All five rendered-link checks passed after the reorder.

## Final editorial counts and adoption check

Given the compact HCQL/Core QL guides and HTTP bootstrap, the expected outcome is correct retrieval and verified application behavior on CAP Node.js 10.3.0. Actual adoption succeeded with Sol and Sonnet but failed with Haiku; all three stopped when required guidance was unusable.

| Reference | Guide words | Skill words |
| --- | ---: | ---: |
| HCQL | 1,222 | 1,261 |
| Core QL | 1,401 | 1,420 |
| Common two-file path | 2,623 | 2,681 |

Additional guide files: `config.md` 623 words, `examples.md` 554, `discovery.md` 315, `serving.md` 170. Counts are raw-Markdown whitespace-separated words measured after editorial review; subsequent anchor/whitespace corrections do not change them.

### Adoption results

Acceptance baseline: local `@sap/cds` 10.3.0 at `f926f1458a0a3c79215f7ae1bce168bae7dce143`, SQLite 3.1.3. Each application task began with the HTTP bootstrap and no prior editorial conversation; embedded HCQL/CQL skills were excluded. Sonnet received a runtime correction during its run; Sol and Haiku's 10.3 runs started fresh. Earlier 10.2.2 checks are historical and excluded from acceptance.

| Check | Sol 6.1 | Sonnet 4.6 | Haiku 4.5 |
| --- | --- | --- | --- |
| Required 10.3 runtime identified | Pass | Pass | Pass |
| Bootstrap and relevant HCQL Markdown retrieved | Pass, index fallback reported | Pass, index fallback reported | Bootstrap only; complete reference retrieval not established |
| Bounded author/book query over HTTP | Pass | Pass | Not verified |
| Partial stock edit over HTTP | Pass | Pass | Not verified |
| Modeled reservation over HTTP | Pass, competing requests also checked | Pass, success and rejection checked | Not verified |
| German localized read over HTTP | Pass | Pass, fallback and translation keys also checked | Not verified |
| Database plug-and-play without override | Pass | Pass | Fail: added `cds.requires.db` |
| Unusable required guidance reported; task stopped | Pass | Pass | Pass |

Sol's final suite passed six HTTP behavioral checks; Sonnet's passed eight. Haiku was stopped after drifting into direct database queries, manual schema/configuration changes and OData startup rather than the requested HCQL verification. Its two reported database checks do not satisfy the HTTP contract; the fixture with five authors also does not establish truncation at ten. This is failed adoption/instruction following, not evidence of an HCQL runtime defect. No broad claim of model-independent adoption is justified.

All unavailable-source sessions received the same deliberately nonexistent Markdown URL. The local server returned an HTML shell rather than guidance; each model reported inability to load the instructions and did not implement the task. Sol and Haiku identified the shell explicitly; Sonnet reported no usable content.

The local `llms.txt` and some release URLs returned HTML shells. Successful agents used the bootstrap's permitted direct-Markdown fallback and disclosed this limitation. Generated full-text checks under `/docs/` and `/preview/docs/` remain separate from actual index delivery and adoption. Publication remains deferred.

Evidence is retained under the approved temporary directory: `adoption-hcql-sol-103/evidence.md`, `adoption-hcql-sonnet/evidence.md`, and `adoption-hcql-haiku-103/EVIDENCE.md`. Child sessions preserve unavailable-source responses. Final editorial checks passed all five rendered-link tests and actual generated full-text destinations under both bases, including the detailed localized-data anchor. Existing user edits were preserved; only trailing whitespace was removed.

### Commit and local index delivery

The reviewed documentation and rendered-link corrections were committed in external docs as `cdd085bf` (`Streamline HCQL client guidance and reference layout`). Further Haiku investigation was explicitly skipped; its failed adoption result remains evidence.

Given the local bootstrap's link to `/docs/llms.txt`, an agent expects a readable index. Direct HTTP checks instead returned status 200, `Content-Type: text/html`, and the same 480-character VitePress shell for both `/docs/llms.txt` and `/docs/llms-full.txt`. The bootstrap Markdown URL returned status 200, `text/markdown; charset=utf-8`, and the actual instructions.

The cause is build-only generation: internal `.vitepress/config.js:149–159` initializes and collects LLM content only when `NODE_ENV === 'production'`; `buildEnd` writes the two files at line 218. Development mode neither generates nor serves them, so missing text paths fall through to VitePress's HTML response. This explains the local adoption limitation; it does not establish a failure in generated or deployed indexes. Direct Markdown fallback remains usable. Live development index support would be a separate change; publication remains deferred.

### Built-site validation

The first full build failed on six links: a stale `core-data-apis` destination in the protocol-adapters page, and five relative links from the included agent instructions that VitePress rebased through `@external`. The stale destination now points to HCQL; the Markdown link normalizer resolves included bootstrap links to published paths. Two regression cases cover normal and rewritten source paths; all seven rendered-link checks pass.

`npx vitepress build` then completed successfully with dead-link checking enabled. Browser-externalization, compiler-directive and bundle-size warnings remained non-blocking. Preview at `http://127.0.0.1:4173/docs/` served `llms.txt` and `llms-full.txt` with HTTP 200 and `text/plain`; the bootstrap, HCQL and Core QL Markdown returned HTTP 200 and `text/markdown`. The index lists HCQL, the generated files and coding-agents page contain no malformed `../../@external/guides` links, and the rendered HCQL guide targets its detailed localized-data examples at `#localized-data-1`. This verifies local built-site delivery; public deployment remains deferred.

## Archived runtime qualification

Moved from the HCQL guide's qualification chapter during editorial review. These are historical validation results and unresolved qualification notes, not new runtime checks or published support guarantees.

### Runtime and qualification scope

The HCQL guide describes the CAP Node.js adapter, reviewed against local `@sap/cds` 10.3.0 source `505b12efc`. Selected examples were checked with SQLite and Core QL; this is not a minimum released version or a CAP Java guarantee. Supported-release applicability remains to be confirmed before publication.

Checked observations include the service example's advertised endpoint and schema, keyed PATCH/CQL record updates preserving other fields and a sibling row, and PUT preserving omitted scalar fields or creating a missing row. Corresponding CQL renderings explain requests; they do not independently qualify every form.

Deep UPSERT execution remains unverified: the checks recorded here do not establish whether UPSERT creates or updates nested composition records.

The Books/Authors service example passed three HTTP integration tests with in-memory SQLite and Core QL, covering both discovery response samples, composition inserts, association navigation, filtered expands, aggregation, full-text search and a targeted child update preserving siblings.

Subsequent checks against local `@sap/cds` 10.3.0 source `b6da748f3` with the working-tree text-key ordering fix passed all 29 consumer tests and 15 translation-contract tests using in-memory SQLite and Core QL. Coverage includes REST/CQL deep updates preserving omitted parent and child fields, keys-only child retention, modeled operations, language-header reads, and translation reads/updates using derived keys for single, renamed, composite and draft-enabled parent keys. The translation checks also include model-shape and diagnostic key-order controls.

Full-text search was additionally checked with SQLite against local `@sap/cds` 10.3.0 source `1aa45f578` plus working-tree changes: all 14 REST search tests passed, covering search alone and with filters, and an equivalent AND query over REST, CQL and CQN.

### Configuration qualification

Configuration defaults and their consumers were reviewed against local `@sap/cds` 10.3.0 source `4dc41996a` on `2bmain`. The format, database write-guard, readonly-update and REST search suites passed all 121 tests, covering query-format combinations, REST/operation independence, SET opt-in and keyed writes. With subsequent working-tree changes, all 16 array-allowlist tests passed, covering replacement, empty lists and invalid configuration. Endpoint resolution was source-reviewed; allowlist checks exercised query validation, not end-to-end database execution.

## Conversation

Tool outputs and the repeated request to save the conversation are omitted below.

### User: Comparing the guide and skill

> How would you compare http://localhost:5173/docs/guides/protocols/hcql.md to the cap-hcql skill wrt. overlap/deltas, which is better?

### Assistant

**The guide is better as standalone documentation; `cap-hcql` is better as a compact agent runbook.** They share most of the protocol contract, but the guide adds useful explanations and qualifications—not just length.

This comparison is of the fetched text and loaded skills, not an independent runtime verification.

#### Overlap

Both cover essentially the same core:
- Schema discovery and reuse; REST for simple CRUD, CQL for complex queries.
- Query options, parameter bindings, composition writes and operation calls.
- Complete-key write guards, default rejection of `UPDATE SET`, and trusted-server opt-ins.
- Response envelopes, missing reads returning 204, and status-first error handling.
- Server-side filtering/aggregation instead of client-side loops.

The guide also incorporates material delegated by `cap-hcql` to **`cap-cql`**, particularly navigation, aggregation and deep updates. Comparing against the *combined skills* therefore reduces the apparent delta.

#### Meaningful deltas

| Area | Guide | Skill |
|---|---|---|
| Activation and scope | Runnable `@hcql` model; Node.js/source/version qualification | Assumes an already discovered endpoint |
| Discovery | Explains schema shape, relative index links and example-model assumptions | Short operational instructions |
| Reads | Concrete bounded expands, `exists` and aggregation | Delegates richer syntax to `cap-cql` |
| Search | Explicit warning that REST `$where` can overwrite `$search` | Recommends CQL for combinations, without explaining that hazard |
| PUT | Clarifies UPSERT versus replacement and qualifies omitted-field preservation | Only identifies PUT as UPSERT |
| Write safety | Warns against replacing atomic updates with read–compute–write; suggests scoped confirmation | Strong query guards, but fewer application-level cautions |
| Responses | Adds decimal representation, 405/415 and safe-retry cautions | More compact status table |
| Localization | **Missing** | `Accept-Language` and keyed `texts` reads/writes |
| Root operation calls | **Missing `CALL` form** | Includes unbound root `CALL` |
| Authentication | Environment-neutral guidance | Assumes “username; no password required”—too broad outside local mocked authentication |

#### Which is better?

**For a reader implementing HCQL: the guide.** It explains prerequisites, distinguishes illustrative examples from the activation model, and qualifies observed behavior. Its service-relative URL explanation is also clearer: the skill initially says paths are relative to the *server*, then explains that examples are *service-local*.

**For an agent executing requests: the skill pair.** The workflow is easier to scan, keeps critical constraints prominent, and avoids loading a full tutorial. Its localization coverage is additionally useful.

The guide’s main weakness is occasional investigation-specific wording—such as “record syntax does not repair native validation or composition-lifecycle defects”—without a concrete linked issue. That is less actionable than its otherwise clear guidance.

#### Recommendation

Keep both; **align contracts, not prose**:

- Add to the skill: the REST search hazard, PUT clarification, scoped confirmation, and atomic-update caution.
- Fix the skill’s URL-base wording and scope its password-free authentication advice to local mocked auth.
- Add localization and root `CALL` to the guide.
- Retain the guide’s runtime qualification until supported-release applicability is confirmed.

**If choosing only one today: the guide is more complete and carefully qualified; the skill is more efficient for repeated agent use.**

### User: Optimizing the guide for agents

> How hard would it be to make the guide similar efficient for agent use, w/o loosing scope?

### Assistant

**Not hard—a modest structural edit, not a rewrite.** Most of the necessary content already exists. The goal is to make the guide *progressively readable*: agents get the essentials first; humans and unusual tasks retain the full detail.

#### Suggested structure

1. **Put a compact agent workflow at the top**
   - Discover endpoint and needed schema; reuse it.
   - Choose REST CRUD, CQL queries, or modeled operations.
   - Select needed fields and bound collections; avoid fetch-and-loop.
   - Bind dynamic scalar values; use JSON for dynamic records.
   - Respect write guards and composition reconciliation.
   - Inspect status before parsing; confirm stored state when required.

2. **Follow with a request decision table**

   | Need | Use |
   |---|---|
   | Simple read/write | REST-style |
   | Navigation, aggregation, search plus predicates | CQL envelope |
   | Composite-key data request | CQL positional keys |
   | Atomic business change | Modeled action |
   | Trusted structured integration | CQN under server-owned policy |

3. **Move critical hazards beside the relevant examples**
   Keep 204/no-body, REST search interaction, PUT semantics, destructive composition reconciliation and single-key route limits immediately visible—not only in later reference sections.

4. **Keep the full guide below**
   Preserve activation, examples, runtime qualification, response details and internal policy. Use stable headings and links from the quick workflow. Add localization and root `CALL` to close the existing coverage gaps.

#### What would actually improve efficiency?

**Less duplication and better ordering**, rather than shorter total length. Explain each contract once; let the quick section point to it. Separate:
- **Client instructions**
- **Server configuration**
- **Qualification and implementation caveats**

The current guide mixes these somewhat, making an agent spend attention deciding which advice applies.

**Effort:** a few hours for restructuring and editorial checks; runtime verification of new examples is separate.

**Caveat:** if an agent always loads the entire Markdown file, restructuring improves navigation but barely reduces token cost. For skill-like loading efficiency, offer a short entry section with links to selectively fetched reference pages. The full guide can remain intact for human readers.

### User: Remaining advantages of skills

> If we do so, what advantages are left to skills over such agent-first/optimized guides?

### Assistant

**Mostly delivery and integration—not better content.** An equally accurate, agent-optimized guide can provide the same instructions as a skill.

| Remaining skill advantage | Why it matters |
|---|---|
| **Automatic discovery** | The harness can recognize a matching task and load the skill; a guide’s URL must first be known or found. |
| **Explicit applicability** | A skill description tells the agent when to use it, rather than relying on search relevance. |
| **Bundled resources** | Scripts, fixtures and references can accompany instructions with predictable relative paths. |
| **Environment-specific guidance** | Skills can supply local authentication, tooling and workflow conventions without putting them into public documentation. |
| **Availability and version control** | Installed skills can work offline and be pinned alongside tooling. Whether that beats a guide depends on freshness. |

**Neither format inherently guarantees correctness, instruction priority, selective loading or lower token cost.** Those depend on the harness and how the material is organized and maintained.

For **`cap-hcql` specifically**, an optimized guide would remove most of the current skill’s substantive advantage: it bundles no scripts, and much of its content duplicates documentation. Its main remaining value would be automatic task matching and coordination with `cap-cql` and `cap-inner-loop`.

**Best arrangement:** make the guide the canonical protocol reference; retain a **thin skill as its entry point**, adding only agent/environment-specific workflow and links to the relevant sections. Avoid maintaining two independent versions of the HCQL contract.
