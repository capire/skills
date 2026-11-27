---
name: cap-add-remote-service
description: "Integrate CAP packages or OData APIs into an existing CAP Node.js app: map/delegate reads, handle navigation/federation, and verify across HTTP using Calesi."
license: Apache-2.0
metadata:
  domain: cap
  type: integration
---

## Scope and preparation

Use CAP service APIs unless a provider limitation requires lower-level HTTP.
This guidance is **Node.js-specific**; Java needs its own runtime APIs.

- Inspect instructions, manifest/lockfile, CDS config/models/keys/associations,
  handlers and tests. Use installed Node/CDS/toolkit APIs, not unnecessary upgrades.
- Establish API source, protocol/version, compiled service name, connection key
  and endpoint/binding. Ask only for missing information; respect supplied fixtures
  and restrictions on real providers/credentials.
- Identify reads, navigation/expands, filtering/paging, writes, freshness/outages.
  Add requested branches; explain live/replica tradeoffs if undecided. MCP/model
  search is optional; check docs/runtime for consequential uncertainties.
- Preserve local CRUD, authorization, custom handlers and public endpoints.
  Adding lookup integration does not authorize deleting local entities/data.
  Requested replacement needs migration/key analysis and relevant fixture/UI/
  value-list/text updates, not unrelated rewrites.

## Happy path: interface → configuration → mapping → delegation

### 1. Load the interface

**CAP package:** `npm add <package>` or the project's equivalent. Local directories/
tarballs and direct consumption of supplied public CDS entries are valid. Respect
installation constraints and manifest/lockfile consistency. Inspect `package.json`
(`cds.main`, plugin/config), `index.cds`/public CSN and definitions. Consume interfaces,
not provider database/implementation models; avoid unnecessary EDMX conversion.

**EDMX:** `cds import path/to/API_BUSINESS_PARTNER.edmx`; `--as cds` generates
CDS instead of CSN. Metadata/output normally go to `srv/external/`. Inspect generated
config/files and compiled names/keys/types/associations; namespaces normally follow
the filename, while `keepNamespace` preserves the original. Keep generated interfaces
reproducible and application changes separate.

The API model—not mock CSV headers—defines valid fields. CSVs establish sample
values/foreign keys; absent sample values do not invalidate model fields.

### 2. Configure a required service

Merge into existing configuration, using actual imported names. For example:

```json
{"cds":{"requires":{"s4":{
  "kind":"odata-v2",
  "model":"srv/external/API_BUSINESS_PARTNER",
  "service":"API_BUSINESS_PARTNER"
}}}}
```

`cds.connect.to('s4')` uses the **requires key**; `service` maps to the model service
(omit if names match). `model` can use package/directory public entries. Verify
reachability and remote configuration, not accidental provider embedding.

Use `odata` for V4 (or a supported explicit V4 kind), `odata-v2` for V2, and
`hcql` only for an HCQL provider. Supply the **service-root URL** via test environment/
configuration or production bindings before boot/connect. Tests can set
`cds.env.requires.s4.credentials = { url: providerURL }`; never commit real secrets.

**HTTP client:** current CAP's native fetch is Beta with narrower auth/proxy support;
Cloud SDK is not mandatory for all local URLs. Check installed capabilities.
Explicit `cds.remote.native_fetch` controls selection, otherwise SDK availability;
older runtimes differ. If SDK is selected/required, install compatible
`@sap-cloud-sdk/connectivity`, `@sap-cloud-sdk/http-client`, `@sap-cloud-sdk/resilience`.
Keep existing setups unless changes are needed. [Remote Services](https://cap.cloud.sap/docs/node.js/remote-services)
covers clients, timeout/CSRF, authentication/destinations; production connectivity
is supported, not required for local integration.

### 3. Map and expose

Consumption views are optional but recommended for vocabulary/field selection.
A service projection suffices; separate consumption layers support reuse:

```cds
using { API_BUSINESS_PARTNER as S4 } from './external/API_BUSINESS_PARTNER';
service TravelService {
  // Retain existing local entities/operations.
  @readonly entity Customers as projection on S4.A_BusinessPartner {
    key BusinessPartner as ID, PersonFullName as name, LastChangeDate as modifiedAt
  };
}
```

Preserve **all keys** (including composite) and avoid internal-field leaks. CAP
resolves suitable projections, maps incoming aliases/predicates and results.
**CDS 10.2.2 ignores declared view `where` in remote resolution.** Enforce required
data scope on every read path with typed CQN combined with incoming filters,
retaining mapping. Test exclusions through collections, keys and nested reads;
compilation is not enforcement proof.

HCQL association flattening such as `airline.name as airline` is not ordinary
OData alias mapping. For OData use supported navigation/expand plus mapping, or
provider-side flattened fields; verify actual protocol capabilities.

Check effective annotations/elements. `@cds.persistence.skip` marks nonpersistent
remote entities and can propagate; it is not `@federated`. If
`@cds.minify: 'unused-elements'` removes needed elements, investigate reachability/
package intent; consider a scoped `@cds.minify: false` override and verify the build.

Local managed associations store local foreign keys; unmanaged ones can reuse keys.
Expose targets in the application service to retain navigation metadata. Remote
extensions cannot change provider storage: use unmanaged backlinks or virtual/
supported calculated fields, not new persisted fields/managed foreign keys. Keep
application-only fields/navigation out of upstream requests.

### 4. Delegate without losing semantics

In existing service initialization, connect once and register the scoped
handler: `this.on('READ', this.entities.Customers, req => remote.run(req.query))`.
Keep established subclass/`cds.service.impl` style; string entity names are valid.
Preserve initialization/order; scoped `prepend` can supersede handlers. Avoid
wildcard delegation; preserve local enrichment/custom behavior via `next()` where
appropriate. Make only intended remote entities read-only, not the writable service.

Forward unchanged CQN without cloning; **clone before mutation**, e.g.
`cds.ql.clone(req.query)`. Retain selection/filter/order/limit/offset, singleton shape
and requested options. Combine scope/correlation with filters using typed CQN,
not concatenated URLs/regexes. Keys can occur in `SELECT.from.ref`, not only `where`.
Retarget to the compiled **consumption/application projection** or translate every
clause/result explicitly. Raw provider targets with public aliases lose mapping.

## Requested branches

### Navigation from local parents

Associations are not distributed SQL joins. Never send local-parent paths to a
provider without that entity. For `Bookings(<key>)/Customer`:

1. Identify the actual CQN path/association and typed/composite parent keys; scope
   dispatch deliberately rather than guessing the last parameter.
2. Read parent/key fields while preserving service authorization/custom policy.
   Request context alone does **not** apply service authorization to direct DB reads;
   propagate policy failures, not successful empty relations.
3. Distinguish absent parent, null foreign key and missing target (semantics below).
   Skip upstream lookup for a null key. Otherwise constrain a singleton query on the
   remote projection by the foreign keys, retaining selection/applicable query options
   and data-scope enforcement. Verify HTTP behavior after custom handling.

### Live expands/backlinks

- Clone the local query; remove only the remote expand from DB execution. Preserve
  local handlers/options/result shape and fetch required correlation keys.
- Deduplicate non-null keys, fetch remote matches and correlate **by key**, not row
  position. Batch/chunk for provider limits; per-row calls create N+1 latency/load
  but may suit tiny scenarios. Document a request budget.
- Honor nested selection/filter/order/paging, including **per-parent to-many paging**,
  or explicitly reject unsupported requests. Remove temporary helper fields outside
  the public contract. OData can include additional public/key properties, but honor
  stricter application payload requirements. Missing to-one is `null`, to-many `[]`.
- Preserve root/local filter/order/page/count. Nested filters affect related matches;
  root remote-field predicates affect **which parents match**. Never filter/order an
  already paged parent set and claim globally correct results. Implement a correct
  split plan before paging (e.g. remote candidate keys), broader correlation or a
  replica; otherwise reject unsupported scope, not silently drop it.

Remote-to-local backlinks reverse the split/correlation direction. Live calls do
not guarantee a cross-service snapshot. [Calesi](https://cap.cloud.sap/docs/guides/integration/calesi#navigation)
provides navigation/expand patterns, not universal automatic handling.

### Replica or hybrid

Live reads avoid storage/staleness but depend on upstream availability/latency.
Replicas enable native joins/filter/order, speed and availability at storage/refresh/
staleness cost. Associations/list UIs do not mandate replication. Hybrids can use
live lookups/cached expands; document differing policies.

A consumption view can become a replica with `@cds.persistence.table`; verify
annotations/schema and implement initial load/refresh/upsert. Define read routing,
cold cache, refresh trigger, freshness/outages. Address paging/deletes/equal-timestamp
updates and overlapping/failed refreshes; use local transactions to preserve usable
snapshots. A watermark alone is insufficient. No undeclared seeded live fallback.
`@federated` is intent used by the sample's **custom implementation**, not built-in
auto-replication. Identify/configure that implementation if used.
[Data Federation](https://cap.cloud.sap/docs/guides/integration/data-federation)
covers fuller refresh designs; production scheduling is optional unless requested.

### Writes/actions and queues

Delegate only requested, upstream-supported synchronous writes/actions, mapping
inputs/results and configuring CSRF as needed. Do not add writes to read-only lookup.
For reliable asynchronous work after a local save, `cds.outboxed(remote).send(...)`
is available with a configured persistent queue/outbox. Verify transactional enqueue,
retries, idempotency and failed delivery: no distributed transaction/exactly-once
provider guarantee. See [Event Queues](https://cap.cloud.sap/docs/guides/events/event-queues).

## Missing data versus remote failure

For OData, direct missing-key reads and absent parents normally yield **404**;
an existing parent's empty single-valued relationship normally yields **204**;
missing expanded to-one is **null**. Establish dangling-target/auth policy separately.
Custom handlers may replace generic existence checks; returning `null` alone does
not guarantee the correct HTTP status.

Upstream record 404 can be wrapped as 502. Inspect structured provider status (e.g.
`error.reason.response.status`), not outer status/message text; versions/clients/
batches differ. Normalize **genuine record absence in validated singleton lookups**
to the above semantics. Empty successful filtered collections can establish absence
if typing/mapping/shape are preserved. Endpoint/config 404 is not record absence.

Never turn arbitrary failures into `[]`/`null` or retry blindly. Network/timeouts,
auth, provider 5xx and unexpected queries remain explicit failures unless a declared
replica/fallback policy applies. Avoid public credential/raw-error leakage. Unrelated
local operations should continue during outages.

## Verification and handoff

Compile/load models (e.g. `cds compile '*'`) and run existing tests. `cds watch`
logs distinguish mocks/URL connections; issue reads. `cds repl ./` with
`remote.read(consumptionEntity).limit(3)` probes mapping; check mock seed names.
Shared in-process persistence can hide remote joins/expand defects. Compilation,
logs, empty collections and service API probes do not prove inbound OData behavior.

Use a **separate-process** CAP provider/conformant HTTP fixture, explicit URL,
independent data, bounded readiness and cleanup. Interactively run
`cds mock <interface-model>` and `cds watch` separately. V2 metadata does not make
a V4 mock serve V2. Observe upstream traffic; stubbed `remote.run` is not wire proof.
Diagnose stale discovery via bindings/logs or explicit URL; don't delete unrelated
registry entries or promise unreachable providers silently return empty data.

Add meaningful HTTP tests for implemented scope:

- Selected fields/filter/order/page; existing/missing direct keys; mapping/no leaks.
  Required data-scope exclusions hold across collections, keys and nested paths.
- Navigation: matching, null key, dangling target, **absent parent** separately,
  with narrow selection/options. Expands: repeated/missing keys, shapes/nulls,
  helper cleanup, nested options or rejection, root paging/count and request budget.
- Mutate upstream; reread a **filtered collection and direct key**, plus supported
  navigation/expand. Live shows current data; replicas show stale-before-refresh /
  fresh-after-refresh, cold cache and failed-refresh preservation. Measure refresh
  cost separately from query-time cost.
- Read-only CREATE/UPDATE/DELETE deliberately reject as client errors, with no
  forwarded writes—not any 5xx accepted. Local CRUD has readback, including relevant
  foreign-key changes. Distinguish missing records/outages; local operations survive.

Use existing tests, `cds.test` HTTP helpers or supported Node test/fetch.
No placeholders, swallowed assertions or misleading labels; distinguish smoke/
focused tests. **Execute documented commands**: e.g. `node --test test/remote.test.cjs`;
directory arguments depend on Node version. Run `npm test` if documented, not just
an alternative. Report blockers/failures, not unsupported green claims.

Hand off files, actual model/connection names, strategy/tradeoffs, exact commands/
observed results, local CRUD preservation and unsupported/unverified scope.
Smoke/compilation do not prove all tests or production readiness.
