---
name: cap-guided-dev
description: Guided, step-by-step co-development flow for building a CAP (Cloud Application Programming Model) application together with the developer, one stage at a time, instead of one-shotting the whole app. Walks through eleven stages — rough idea, domain model, services, constraints, custom handlers, plugins, MCPs/agents, authentication/authorization, shipment, operations, and improvements/upgrades — pausing to align with the developer at each step and delegating to the specialist CAP skills as needed. Use this whenever a developer wants to build a CAP app collaboratively, wants a guided or walkthrough experience, is starting a CAP project from a vague idea, or explicitly asks to go step by step rather than generating everything at once.
license: Apache-2.0
metadata:
  author: cap-team
  team: cap
---

## What I do

Co-build a CAP application with the developer **stage by stage** instead of generating the
whole thing in one shot. I act as a conductor: I keep the developer oriented across eleven
stages, do the focused work for the current stage, and hand off to the specialist CAP skills
when a stage has one. The point is a collaborative rhythm — small, reviewable increments the
developer stays in control of — not a wall of generated code.

## Why go stage by stage

One-shotting a CAP app produces plausible-looking code that rarely matches what the developer
actually meant. Domain decisions compound: a wrong composition vs. association early makes the
services, constraints, and handlers built on top of it wrong too. Working stage by stage lets
the developer catch drift early, keeps each diff small enough to review, and means every later
stage rests on a foundation they've already agreed to. Move deliberately; the developer's
attention, not your token budget, is the scarce resource.

## The eleven stages

| # | Stage | What happens | Hand off to |
|---|-------|--------------|-------------|
| 1 | **Rough idea** | Turn a vague pitch into a crisp problem statement, actors, and the core "thing" the app manages | — (this skill) |
| 2 | **Domain model** | Model entities, aspects, associations/compositions in CDS, then generate test data | `cap-developer` → `references/cds-modeling.md` + `references/sample-data.md` |
| 3 | **Services** | Expose domain via service projections shaped for consumers | `cap-developer` → `references/cds-modeling.md` |
| 4 | **Constraints** | Add validation, mandatory/readonly, computed values — declaratively first | `cap-developer` → `references/declarative.md` |
| 5 | **Custom handlers** | Only where annotations can't express it — write the test first, then before/on/after logic | `cap-developer` → `references/custom-logic.md` + runtime file |
| 6 | **Plugins** | Add capabilities via `cds add` / cap-js plugins (db, remote services, audit-log, …) | `cap-add-remote-service`, or inline |
| 7 | **MCPs / Agents** | Expose or consume the app through MCP servers / agent tooling | — (this skill) |
| 8 | **Authentication / Authorization** | `@requires` / `@restrict`, roles, instance-based access | `cap-developer` → `references/declarative.md` (auth) + inline |
| 9 | **Shipment** | Package and deploy: HANA, xsuaa, approuter, mta/helm, CF/Kyma | — (this skill) |
| 10 | **Operations** | Run it: observability, troubleshooting, keeping it healthy | — (this skill) |
| 11 | **Improvements / Upgrades** | Iterate the model, bump CDS versions | `cap-upgrade` + inline |

Stages are a **map, not a track**. Real projects loop back — adding a service reveals a missing
entity; security reveals a missing constraint. That's expected.

## How to run the flow

### Start with the menu

Whenever this skill activates, first establish your CAP documentation source: prefer the CAP
MCP server if it's available (it's the richest source of truth for CAP APIs), and otherwise
fall back to capire's LLM docs rather than guessing (see "Documentation source" below).
If the developer already chose a stage, acknowledge it and start there. Otherwise show the
eleven-stage menu using the host's interactive question tool (`question` in OpenCode,
`AskUserQuestion` in Claude Code), or a plain-text question if no such tool is available.
Present it as a single question with the stages as options; briefly note which stages
already look done if you can tell from the project state (e.g. a `db/schema.cds` exists → domain
model started).

If the project is brand new (no CAP project yet), gently suggest starting at stage 1, but let
them choose. If they clearly already described a concrete idea in their message, you can propose
jumping straight to stage 2 with a one-line confirmation instead of re-asking the idea.

**Before scaffolding a new project with `cds init`, make sure `@sap/cds-dk` is on the latest
major version.** An outdated dk generates stale project layouts and misses newer CLI flags
(`cds add data --keys-only`, current `cds add` features), which quietly derails later stages.
Check with `cds --version` and compare against `npm view @sap/cds-dk version`; if the installed
major is behind, update with `npm i -g @sap/cds-dk` before running `cds init`. Only needed when
creating a new project — skip it when the developer already has one.

### Free navigation, not a forced march

The developer drives. After finishing the work for a stage, don't silently barrel into the next
one. Summarize what changed in 2–4 lines, then use the available question tool (or plain text) to
offer the natural next moves: continue to the recommended next stage, jump elsewhere, revisit the current stage, or
stop. Make the recommended next stage the first option. Always leave room for them to type their
own direction.

**Always point the developer at the files that changed.** In the stage summary, list every file
you created or edited as a clickable reference using the ``file_path:line_number`` form (e.g.
``db/schema.cds:12``) so they can jump straight to the relevant line in their editor. This keeps
the developer in control — they can review each concrete change before deciding to move on,
instead of trusting a prose description. Prefer real paths from the project over generic names.

Keep each stage's work small and reviewable. If a stage would produce a large diff (e.g. a big
domain model), break it into sub-steps and check in between them. Prefer running `cds watch` and
showing the developer real output over describing hypothetical results.

### Delegate to specialists

For stages with a dedicated skill (the "Hand off to" column), **load that skill and follow it**
rather than re-deriving its guidance here. This skill is deliberately thin on those topics — the
specialists are authoritative and kept up to date. Your job at those stages is to keep the
developer oriented (why we're here, what we decided last stage) and then let the specialist do
the domain work. When a stage has no dedicated skill, use the inline guidance below.

**After the domain model (stage 2), always generate test data before moving on.** Realistic
sample data makes every later stage tangible — services return real rows, constraints and
security rules can be exercised, and `cds watch` shows something meaningful instead of empty
collections. Follow `cap-developer`'s sample-data workflow (`references/sample-data.md`). Check the
**CDS DK version before generating data**: use **10.2 or later** for
`cds add data --records <n> --keys-only`, which preserves managed association foreign keys,
including composition backlinks, and emits all enum code-list keys. In DK 10.1, ordinary
foreign-key columns are left empty; upgrade or populate them by copying existing target keys.
Keep generated UUID primary keys and valid foreign-key references stable, then fill the remaining
content columns with meaningful domain data. Verify code-list keys and localized rows, special
relationships, and business rules; generated keys do not ensure valid dates, currencies, or states.
Never invent unrelated UUIDs for foreign keys. Then point the
developer at the generated CSVs (e.g. ``db/data/<namespace>-Books.csv``) and confirm the data
looks right in `cds watch` before continuing.

## Documentation source

Follow `cap-developer`'s **"Documentation source"** section — it's the single source of truth
for this: prefer the CAP MCP server when present, and otherwise fall back to capire's LLM docs
(`llms.txt`, `llms-full.txt`, `sitemap.md`, and the append-`.md` / `Accept: text/markdown` page
trick). Never guess URLs or invent APIs, and don't treat CAP docs as a Fiori/SAPUI5 reference.

## Inline guidance for gap-fill stages

Several stages have no dedicated skill, so carry the flow yourself with the guidance below.
Keep it lightweight and conversational — you're aligning with the developer, not lecturing. For
anything not covered here, search the CAP docs (MCP server or capire — see "Documentation
source" above) rather than guessing.

### Stage 1 — Rough idea

Goal: convert a vague pitch into a shared, written problem statement you both agree on before any
modeling. Draw it out with a few focused questions (don't interrogate — 2–4 is plenty):

- **Who uses it and to do what?** The primary actor and their job-to-be-done.
- **What is the core "thing" the app manages?** The one or two nouns everything orbits (Orders,
  Incidents, Bookings…). These become your root entities.
- **What must the system enforce or prevent?** Early signal for later constraints and security.
- **Where does data come from / go to?** Hints at remote services, messaging, integrations.

Write back a 3–5 line summary: purpose, primary actors, core entities, and any hard rules. Get a
thumbs-up before moving on. Resist modeling here — the artifact of this stage is shared
understanding, not CDS.

Once the developer confirms the summary, **record it in the project's `readme.md`.** A fresh
`cds init` leaves a generic "Getting Started" boilerplate there; replace that intro (keep the
useful folder-layout and next-steps sections) with a short project description built from the
agreed summary — purpose, primary actors, core entities, and hard rules. This gives the project a
durable record of the decisions so later stages and future sessions don't have to re-derive the
intent, and it's the natural first artifact of the flow. Then point the developer at
`readme.md` so they can see what was captured.

### Stage 7 — MCPs / Agents

Goal: decide how the app participates in the agent/MCP ecosystem. CAP has two official cap-js
plugins for this; pick the direction the developer wants and build the smallest useful slice.

- **Expose CAP services over MCP → `@cap-js/mcp`.** A CDS plugin that turns the app's services
  into an MCP server so AI agents can query and act on the domain. Add it as a dependency and
  explicitly expose the intended services with `@mcp`, preserving any existing protocols.
  Configure under `cds.mcp` in `package.json` and guide the agent with `@mcp.instructions`
  (supports i18n refs). Discover the served tool schemas and supported operations rather than
  assuming that every bound action or CRUD operation is available.
  Docs: `cap.cloud.sap/docs/guides/ai/cap-mcp`. **Caveat:** the SAP API
  Policy still applies to data exposed over MCP — confirm the use case is allowed before exposing
  SAP data.
- **Build agents inside CAP → `@cap-js/agents`.** A CDS plugin for building agents on the
  [A2A](https://a2a-protocol.org) (Agent-to-Agent) protocol. Use this when the app itself should
  host an agent rather than just expose tools. Docs: `cap.cloud.sap/docs/guides/ai/cap-agents`.

These packages move fast — search the CAP docs (MCP or capire) and check the linked guides for the current setup
steps and options before scaffolding, rather than relying on memory. Keep secrets out of the
model: use CDS-bound credentials / destinations, never hardcoded keys.

> Don't confuse these with `@cap-js/mcp-server`, which is an MCP server for *AI-assisted CAP
> development* (tooling for your editor), not a way to expose your app. That's out of scope here.

### Stage 8 — Authentication / Authorization

Goal: layer access control declaratively before reaching for code. Sequence:

1. **Authentication strategy** — for local dev, use mocked authentication and configure test
   users in `.cdsrc.json` or `package.json`; XSUAA scaffolding is not required for local mock
   authentication. For production, choose XSUAA or IAS and add the corresponding feature.
   Confirm the intended strategy before wiring anything.
2. **Authorization, declarative first** — protect services/entities with `@requires: 'role'` and
   fine-grained rules with `@restrict: [{ grant, to, where }]`. Instance-based restrictions
   (`where: 'createdBy = $user'`) cover most row-level cases without a handler.
3. **Only then, code** — instance-level checks that can't be expressed declaratively go in a
   `before` handler that rejects early.

Declare role names in CDS annotations and local test-user configuration, rather than hardcoding
identity checks in handlers. Keep credentials and tenant-specific identities out of source code.
Protect every exposed entity and action/function as appropriate; a custom handler reading the DB
directly does not inherit a service entity's authorization checks. For the annotation details,
lean on `cap-developer`'s `references/declarative.md` (`@restrict`/`@requires` section) and verify
specifics against the CAP docs (MCP or capire). Match the depth to the app — a demo doesn't need production IAS wiring.

### Stage 4 — Constraints (declarative-first reminder)

This stage mostly delegates to `cap-developer`'s `references/declarative.md` ("Declarative First"
table — `@assert.*`, `@mandatory`, `@readonly`, calculated elements). Your conductor job is to work
through the hard rules captured in stage 1 and turn each into the leanest declarative form.

Before writing *any* logic for a rule, ask explicitly: **can this be expressed declaratively?**
Most rules people reach for handlers on are actually annotations — a value range is
`@assert.range`, a required field is `@mandatory`, a format is `@assert.format`, an allowed set
is an enum, a derived value is a
calculated element, and a huge range of conditional and cross-field rules fit
`@assert: (case when … end)` (see below). A handler
is the *last* resort, justified only when you can name the specific reason no annotation fits
(e.g. an external call, a side effect, or action-specific validation that the available
annotations don't cover). A DB lookup alone is not a reason: `@assert` can query associated rows.
Declarative constraints centralize validation in the generic runtime and selected annotations
also contribute UI metadata. Verify their scope for the chosen runtime/version and write paths:
a parent constraint does not automatically run when only a child is written, or vice versa.
Draft writes can persist invalid data with validation messages so users can correct it later.
When you do fall back to code, say why in one line so the developer
can sanity-check the call. Confirm the full constraint list with the developer before implementing.

**Don't underestimate `@assert: (case when … end)`** — it's the workhorse that eliminates most
"I need a handler for this" cases. Write a SQL-style `case` expression that returns an **error
message or i18n key when a rule is violated**, and **null when the row is valid**. Omitting
`else` yields null when no `when` branch matches. Do not use a bare Boolean assertion or return
the field's value as if this were a truth test. Examples:

- **Conditionally required field** — when resolved, `resolvedAt` must be set:
  `@assert: (case when status = 'resolved' and resolvedAt is null then 'ASSERT_RESOLVED_AT_REQUIRED' end)`
- **Field-vs-field comparison** — end must not precede start:
  `@assert: (case when endDate < startDate then 'ASSERT_ENDDATE_BEFORE_STARTDATE' end)`
- **Value depends on another field** — a discount is only valid on sale items:
  `@assert: (case when discount > 0 and (onSale is null or onSale = false) then 'ASSERT_DISCOUNT_REQUIRES_SALE' end)`

The key mental shift: reach for `case when` *before* concluding a rule is "too complex for
annotations." It can reference any elements on the *same* entity and use the usual comparison,
boolean, and null operators. It can also compare with associated entities through path expressions
and inspect related sets using `exists` with infix filters. It cannot call an external service
or perform arbitrary asynchronous application work. Put the error message or plain i18n key in
the `then` branch; resolve keys from `_i18n/messages.properties`. Handle null explicitly in
conditional-required checks, and use `@mandatory` for unconditionally required fields.
The exact expression syntax for a tricky rule is easy to get subtly wrong — confirm it against
the CAP docs (MCP or capire; search
`@assert expression case when`) or `cap-developer`'s `references/declarative.md` rather than
guessing, and, per stage 5, prove it with a quick test.

### Stage 5 — Custom handlers (test-driven)

You only arrive here for logic that the available declarative features don't cover (see stage 4)
— custom action/function implementations, side effects, external calls, or validation that needs
a specific event boundary. Check generic status-flow handlers before implementing lifecycle actions;
associated-row lookups alone do not justify a handler. Because these are the
riskiest, least-generic parts of the app, build them **test-first**:

1. **Write the test before the handler.** Capture the behaviour the developer described as an
   executable expectation — the request in, the expected result or rejection out (status code and
   message for `before` validations, returned data for `on` actions, the emitted event or side
   effect for `after`). Use `cds.test` (see `cap-developer`'s runtime reference —
   `references/nodejs.md` / `references/java.md` — for the exact Node/Java shape). Search the MCP
   docs if you're unsure of the current testing API rather than guessing.
2. **Run it and inspect the result.** For missing behavior, the test must fail for the intended
   business reason, not missing actions, invalid fixture IDs, authentication, or setup errors.
   If it already passes, check whether annotations or existing handlers satisfy the contract;
   do not add redundant code merely to force a red-then-green sequence.
3. **Implement the handler** in the right phase (`before` for early validation/rejection, `on` for
   custom actions/functions, `after` for side effects), following `cap-developer`'s
   `references/custom-logic.md` and its runtime file. Don't reimplement what the generic provider
   already does, and rely on CAP's intrinsic transactions.
4. **Run the tests again until green.** For validation, cover both a rejected request and an
   allowed request, including the expected state/result, so an unconditional rejection cannot
   pass the suite. Use valid, isolated fixtures. Then show the developer the changed files and
   passing tests as `file_path:line_number` references.

Working test-first here matters more than elsewhere: handler logic is where subtle,
app-specific bugs hide, and a red-then-green test is the cheapest way to prove the handler does
what the developer actually asked for — and to keep it working as later stages change the app.
Keep each handler and its test a small, reviewable increment; don't batch several handlers before
testing.

### Stage 6 — Plugins (routing)

Plugins add capabilities incrementally via `cds add <feature>` or cap-js community plugins. Route
to the right place:

- Consuming an external/remote service → load `cap-add-remote-service`.
- Persistence (`hana`, `postgres`, `sqlite`), messaging/events, `audit-logging`, `attachments`,
  `notifications`, etc. → `cds add <feature>`; search the CAP docs (MCP or capire) for the current feature list,
  the correct annotations, and configuration before wiring anything.

Add plugins only when the current need calls for them, one at a time, and verify with `cds watch`.

### Stage 9 — Shipment

Goal: get the app deployable, adding production concerns only as the target demands. Work
outside-in and confirm the target first (Cloud Foundry vs. Kyma, single- vs. multi-tenant),
because it decides everything downstream.

- Add production features incrementally with `cds add`: `hana` for persistence, `xsuaa` (or IAS)
  for auth, `approuter` for the UI/entry, `mta` (CF) or `helm` (Kyma) for packaging.
- Search the CAP docs (MCP or capire) for the current, target-specific deployment steps and required
  configuration before running commands — deployment tooling and recommended defaults shift
  between releases, so verify rather than trusting memory.
- Keep it incremental: add one feature, check the build (`mbt build` / `cds build`), then the
  next. Never hardcode credentials, destinations, or tenant/system IDs — bind them.

Multitenant SaaS deployment is substantially more involved (sidecar, tenant onboarding); if the
developer wants that, flag that it's a larger effort and scope a first slice together.

### Stage 10 — Operations

Goal: keep the deployed app healthy and diagnosable. Keep this proportional to where the app is —
a local/demo app needs almost nothing here.

- **Observability** — logging and tracing; search the CAP docs (MCP or capire) for CAP's current logging/telemetry
  guidance for the chosen platform.
- **Troubleshooting** — when `cds watch` fails, requests error, or data is missing: reproduce the
  smallest failing case, read the actual error/stack, inspect the effective model (via the MCP
  server, or `cds compile <path>` / `cds compile srv --to edmx` without it), and fix the root
  cause rather than papering over symptoms.
- **Health** — confirm the app starts cleanly against the production-like profile before calling
  a stage done.

### Stage 11 — Improvements / Upgrades

Goal: iterate safely on a working app.

- **Model/quality improvements** — revisit the domain model and services against the conventions
  in `cap-developer` (`references/cds-modeling.md` — projection shaping, reuse aspects, association
  vs. composition); make one focused change at a time and re-verify with `cds watch`.
- **Version upgrades** — to bump the CDS version, load `cap-upgrade` and follow it; it drives the
  `cds upgrade` CLI and handles major-version jumps.

Prioritise with the developer — improvements are open-ended, so agree on the one or two highest-
value changes rather than rewriting everything.

## Working style

- One stage in focus at a time; small, reviewable diffs; check in via the available question tool
  or plain text at stage boundaries.
- Prefer showing real `cds watch` / CLI output over describing what "should" happen.
- Reuse `cap-developer`, `cap-add-remote-service`, and `cap-upgrade` as the source of truth for
  their domains — load and follow them rather than paraphrasing here.
- When the developer wants to skip ahead or backtrack, let them; update your sense of project
  state and continue from wherever they point.
- Never one-shot the whole app "to save time" unless the developer explicitly asks for it — the
  guided rhythm is the value.
