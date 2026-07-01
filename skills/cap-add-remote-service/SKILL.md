---
name: cap-add-remote-service
description: Add a remote service integration to an existing CAP Node.js application using the Calesi pattern. Imports external APIs (from other CAP apps or OData/S4 sources), creates consumption views, wires up delegation and data federation handlers, and validates the result with cds watch. Use when a developer wants to consume an external service in their CAP app.
license: MIT
metadata:
  domain: cap
  type: integration
---

## What I do

Guide the developer step-by-step through adding a remote service integration to
an existing CAP Node.js project, following the CAP-Level Service Integration
(Calesi) pattern. This covers importing APIs, defining consumption views,
integrating the model, and wiring up the required Node.js handlers.

## Context I need first

Before starting, inspect the project so I understand its structure:

1. Read `package.json` to learn the project name and existing dependencies.
2. Use `cds-mcp_search_model` to get an overview of the services and entities
   already defined in the project.
3. Ask the user:
   - Which remote service they want to integrate (another CAP app, S/4HANA
     Business Partner, etc.)
   - Whether they have the API already as an npm package, an `.edmx` file, or
     just a URL

## Step 1 — Import the API

### Option A: CAP package from npm

If the remote service is published as a CAP package (e.g. `@capire/xflights-data`):

```sh
npm add <package-name>
```

Check the added package's `index.cds` and `package.json` to understand what
service name and entities it exposes.

**Important**: Also check the package's mock data CSV files (usually in
`srv/external/data/`) to see which columns actually have data. The consumption
view should only project columns that exist in the mock data, otherwise the UI
will show empty values during local development. (Check back with the user if unsure)

### Option B: OData EDMX file

If the developer provides an `.edmx` file (e.g. downloaded from SAP Business
Accelerator Hub):

```sh
cds import path/to/API_NAME.edmx
```

This copies the `.edmx` into `srv/external/` and generates a `.csn` file.
Use `--as cds` if a human-readable `.cds` file is preferred.

After import, check what was generated in `srv/external/`:

```sh
ls srv/external/
```

Add the service to `package.json` under `cds.requires` if not already done:

```json
"cds": {
  "requires": {
    "API_NAME": {
      "kind": "odata-v2"
    }
  }
}
```

Use `"kind": "odata"` for OData v4 services.

## Step 2 — Create a consumption view

Create a new `.cds` file (e.g. `apis/<source-system>.cds` or
`srv/external/<name>.cds`) with a *consumption view* — a projection that maps
the imported definitions to your domain model, renaming and flattening as
needed.

```cds
// Example: mapping S/4 A_BusinessPartner to a domain-friendly Customers entity
using { API_BUSINESS_PARTNER as S4 } from '@capire/s4';
namespace sap.capire.s4;

@federated entity Customers as projection on S4.A_BusinessPartner {
  BusinessPartner as ID,
  PersonFullName  as Name,
  LastChangeDate  as modifiedAt,
} where BusinessPartnerCategory == 1;
```

```cds
// Example: mapping xflights data to a domain-friendly Flights entity
using { sap.capire.flights.data as x } from '@capire/xflights-data';
namespace sap.capire.xflights;

@federated entity Flights as projection on x.Flights {
  ID, date, departure, arrival, modifiedAt,
  airline.icon     as icon,
  airline.name     as airline,
  origin.name      as origin,
  destination.name as destination,
}
```

Key conventions:
- Use `@federated` on entities that will need local data replication (see Step 5).
- Map remote names to your domain names (e.g. `BusinessPartner` → `ID`).
- Flatten associations into columns where useful (works over HCQL, not plain OData).
- Add a `where` clause to pre-filter data if needed.
- If the package annotates the source entity with `@cds.minify:'unused-elements'`,
  you must override it in your consumption view file:
  ```cds
  annotate S4.A_BusinessPartner with @cds.minify:false;
  ```
  Otherwise the projection will have no elements and deployment will fail with
  "Expecting view to have at least one non-virtual element".

## Step 3 — Reference the remote entity from the domain model

In `db/schema.cds` (or the relevant domain model file), import the consumption
view and add the association:

```cds
using { sap.capire.xflights as x } from '../apis/capire/xflights';

entity Bookings {
  // ... existing elements ...
  Flight : Association to x.Flights;
}
```

If the remote entity **replaces** a local entity (e.g. replacing a local
`Customers` with S/4 Business Partner), remove the local entity definition
entirely and import the consumption view instead. Then update any existing test
data CSVs to use IDs that match the remote mock data (e.g. `000001` instead of
`1004155`).

Also update any UI annotations (value lists, text arrangements) that reference
fields which no longer exist on the new remote-backed entity.

If you also need a back-association from the remote entity to a local one, use
an unmanaged association (no foreign keys on the remote side):

```cds
extend x.Flights with columns {
  Bookings : Association to many Bookings on Bookings.Flight = $self;
}
```

> Unmanaged associations and virtual/calculated fields are the only safe
> extensions to remote entities — avoid regular elements or managed associations.

## Step 4 — Expose the remote entity in your service (for UIs)

If the remote entity needs to be accessible from a Fiori UI or OData service,
expose it as a readonly projection inside your application service:

```cds
// In srv/my-service.cds
using { sap.capire.xflights as x } from '../apis/capire/xflights';

service MyService {
  // ... existing entities ...
  @readonly entity Flights as projection on x.Flights;
}
```

Without this, associations to unexposed entities will be cut off.

## Step 5 — Wire up the integration handlers (Node.js)

Open (or create) the service handler file (e.g. `srv/my-service.js`).

### 5a — Connect to the remote service

The service name passed to `cds.connect.to()` **must exactly match** the service
name defined in the remote package's `index.cds` (or the key used in
`cds.requires` for EDMX imports). Always look this up — do not invent an alias.

```js
module.exports = class MyService extends cds.ApplicationService {
  async init() {
    const remote = await cds.connect.to('sap.capire.flights.data')
    // or: cds.connect.to('API_BUSINESS_PARTNER')
    const { Flights, Customers } = this.entities

    // ... handlers below ...

    return super.init()
  }
}
```

### 5b — Delegation (for value helps / on-demand reads)

Delegate incoming READ requests for a remote entity directly to the upstream
service. CAP auto-translates queries through the consumption view:

```js
this.on('READ', Customers, req => s4.run(req.query))
```

### 5c — Data federation (for joins with local data)

When remote data is needed alongside local data (e.g. displaying flight details
alongside bookings), there are two approaches. **Ask the user which approach
they prefer**, explaining the trade-offs:

#### Option 1: Replicate data locally

Copy remote data into a local persistence table so SQL JOINs work natively.

**Pros:**
- Full SQL JOIN support (filtering, sorting, paging across local + remote data)
- Fast reads — no network round-trips at query time
- Works offline / when the remote service is unavailable

**Cons:**
- Data can be stale (only as fresh as the last replication run)
- Requires replication logic and scheduling (initial load + delta sync)
- Consumes local storage
- More moving parts to maintain and monitor

**Implementation:**

Annotate the consumption view to persist replicated data:

```cds
// In db/schema.cds
annotate x.Flights with @cds.persistence.table;
```

Add replication logic in the service handler (e.g. on startup or on a timer):

```js
const { Flights } = cds.entities('sap.capire.xflights')
let { latest } = await SELECT.one`max(modifiedAt) as latest`.from(Flights)
let touched = await xflights.read(Flights).where`modifiedAt > ${latest || 0}`
if (touched.length) await UPSERT(touched).into(Flights)
```

Or use `@federated` (already on the consumption view) together with the
[CAP Data Federation](https://cap.cloud.sap/docs/guides/integration/data-federation)
plugin for automatic replication.

#### Option 2: Delegate reads to the remote service (no replication)

Handle READ requests for the remote entity by forwarding the query to the
upstream service at request time, keeping data always fresh.

**Pros:**
- Always up-to-date — no stale data
- No local storage or replication logic needed
- Simpler setup for read-only scenarios

**Cons:**
- No native SQL JOINs across local and remote data
- Every read incurs a network round-trip (latency, availability risk)
- Filtering/sorting across local + remote fields not supported without
  additional application-level logic
- If the remote service is down, reads fail

**Implementation:**

Delegate the READ in your service handler:

```js
this.on('READ', Flights, req => xflights.run(req.query))
```

No `@cds.persistence.table` annotation is needed. The entity remains virtual
from the local DB perspective.

#### Recommendation

Use **replication** when the remote data is needed for JOINs, filtering, or
sorting together with local data, or when resilience against remote outages
matters. Use **delegation** when data freshness is critical, the dataset is
large/volatile, or the entity is only accessed independently (e.g. value helps,
detail views).

**Important:** If the project schema has a local entity with an `Association to`
the remote entity, and that local entity is exposed in a list view (i.e. a SQL
JOIN is required), then replication is **mandatory** — delegation cannot support
SQL JOINs across service boundaries. The association will silently return `null`
at runtime. You do not need to ask the user in this case — choose replication.

### 5d — Outboxed events (reliable fire-and-forget writes)

For write operations to the remote service that don't need a synchronous result:

```js
const xflights_ = cds.outboxed(xflights)

this.after('SAVE', Travels, ({ Bookings = [] }) => {
  return Promise.all(Bookings.map(b => {
    let { Flight_ID: flight, Flight_date: date } = b
    return xflights_.send('POST', 'BookingCreated', { flight, date })
  }))
})
```

This stores the event in a local outbox table within the same DB transaction,
then forwards it asynchronously with retries.

## Step 6 — Install Cloud SDK prerequisites

Remote HTTP communication requires the SAP Cloud SDK packages. Check if already
installed; if not, add them:

```sh
npm add @sap-cloud-sdk/connectivity @sap-cloud-sdk/http-client @sap-cloud-sdk/resilience
```

## Step 7 — Verify with cds watch

Start the app and check the log output:

```sh
cds watch
```

**Check the connection line carefully.** You want to see either:
- `mocking <service-name>` — CAP is auto-mocking in-process (good for dev)
- `connect to <service-name> > odata { url: ... }` — CAP is connecting to an
  external mock process

If you see `connect to ... > odata` pointing to a URL but no mock is running
there, READ requests will fail silently and return empty results. This happens
when `~/.cds-services.json` has a stale entry from a previous `cds mock` run.
Fix by either:
- Starting the mock: `cds mock <service-name>`
- Or removing the stale entry so CAP falls back to in-process mocking

Expected: lines like:

```
[cds] - mocking sap.capire.flights.data { at: [...], ... }
```

This confirms CAP is auto-mocking the remote service for local development —
no upstream service needed during inner-loop development.

To test real delegation (separate mock processes):

```sh
# Terminal 1
cds mock apis/capire/xflights.cds

# Terminal 2
cds watch
```

Check that the consuming service now logs `connect to ... > hcql` (or odata)
instead of `mocking`.

## Step 8 — Test queries in cds repl

Quickly validate the integration without starting a UI:

```sh
cds repl ./
```

```js
// Connect to the service
const svc = await cds.connect.to('sap.capire.flights.data')
const { Flights } = cds.entities('sap.capire.xflights')

// Read through the consumption view
await svc.read(Flights).limit(3)

// Check that column mapping worked (should see domain names, not remote names)
```

## Key patterns summary

| Scenario | Pattern |
|---|---|
| Read remote data on demand (e.g. value help) | Delegation: `this.on('READ', Entity, req => remote.run(req.query))` |
| Remote data needed for local SQL JOINs | Data federation: `@federated` + `@cds.persistence.table` + replication logic |
| Fire-and-forget write to remote | Outboxed emit: `cds.outboxed(remote).send(...)` |
| Local dev without upstream running | Automatic — CAP mocks in-process; no config needed |
| Renaming / reshaping remote API to fit domain | Consumption view (projection with column aliases and `where` clause) |

## Common mistakes to avoid

- **Don't** expose raw imported entities directly in your service — always go
  through a consumption view or projection.
- **Don't** use the `view` keyword for consumption views — always use
  `entity ... as projection on`. (`view` is a different CDS concept.)
- **Don't** use `@cds.persistence.skip` on consumption views — that is a
  different annotation. Use `@federated` instead (marks the entity for data
  federation), and add `@cds.persistence.table` separately when you want local
  replication.
- **Don't** use string entity names in handler registrations — always destructure
  from `this.entities`: `const { Flights } = this.entities` then
  `this.on('READ', Flights, ...)` not `this.on('READ', 'Flights', ...)`.
- **Don't** invent the service name in `cds.connect.to()` — look it up in the
  package's `index.cds` or in `cds.requires` for EDMX imports.
- **Don't** modify CQN objects without cloning them first:
  `const q2 = cds.ql.clone(q1)`.
- **Don't** add regular elements or managed associations to remote entity
  extensions — only unmanaged associations, virtual, and calculated fields.
- **Don't** rely on live cross-service navigation for filtering/sorting without
  data federation in place — it will fail at runtime.
- **Don't** forget Cloud SDK packages — without them, remote HTTP calls will
  error with a missing dependency message.
- **Don't** project columns that don't exist in the remote mock data — the UI
  will show blank values. Always cross-check the mock CSV headers against your
  consumption view columns.
- **Don't** forget to update test data foreign keys when replacing a local
  entity with a remote one — old IDs won't match the remote mock data.
- **Don't** ignore `@cds.minify` annotations on imported entities — they can
  strip all elements from your projection, causing deployment failures.
