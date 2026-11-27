---
name: cap-mtx
description: Develop and deploy multitenant CAP Node.js SaaS applications using @sap/cds-mtxs. Covers enabling multitenancy, MTX sidecar setup, extensibility and feature toggles, local and hybrid testing, deploying to Cloud Foundry (MTA) and Kyma (Helm), tenant lifecycle management, approuter/XSUAA/IAS wiring, and common deployment pitfalls.
license: Apache-2.0
metadata:
  author: cap-team
  team: cap
---

## What I do

Guide developers through building, testing, and deploying multitenant CAP Node.js applications
as SaaS solutions on SAP BTP — covering the MTX sidecar architecture, tenant lifecycle,
extensibility, and production deployment to Cloud Foundry or Kyma.

## Decision Points

Before scaffolding, determine the project's choices on three coupled decisions. **First check
whether the project already has these decided** (look for `cds add xsuaa`/`cds add ias` in
existing config, presence of `mta.yaml` vs Helm charts, etc.). If not already decided, ask the
user:

### 1. Authentication: XSUAA vs IAS+AMS

| | XSUAA (traditional) | IAS + AMS (modern) |
|---|---|---|
| Auth service | SAP Authorization and Trust Management | SAP Cloud Identity Services |
| Authorization | Role collections via xs-security.json | Policies via AMS (DCL files) |
| Subscription service | `saas-registry` | `subscription-manager` |
| Trust model | SAML or OIDC | OIDC only |

**These are coupled:** choosing IAS implies `subscription-manager`; choosing XSUAA implies
`saas-registry`. This affects MTA resources, sidecar bindings, and subscriber prerequisites.

### 2. Deployment Target: Cloud Foundry vs Kyma

| | Cloud Foundry | Kyma / Kubernetes |
|---|---|---|
| Descriptor | `mta.yaml` | Helm chart (`values.yaml`) |
| Build tool | `mbt build` | `cds up -2 k8s` / `pack` + `helm` |
| CLI | `cf deploy` | `helm upgrade --install` |
| Add command | `cds add mta` | `cds add kyma` |

### 3. Extensibility

Whether subscriber tenants can extend the CDS model at runtime. Adds `ExtensibilityService`
to the sidecar and requires configuring extension allowlists. Default: no unless explicitly
needed.

### Detection from Existing Project

Before asking, check:
- `package.json` → `cds.requires.auth` = `"ias"` or presence of `@sap/xssec` → auth decided
- `mta.yaml` present → CF deployment decided
- `chart/` or `containerize.yaml` present → Kyma decided
- `cds.requires.extensibility` → extensibility decided

If a decision is already made in the project, respect it and don't ask again.

## MCP Server

Always use the CAP MCP server to:
- Search CAP documentation (`cds-mcp_search_docs`) for current MTX APIs, configuration, and deployment patterns before writing code
- Read the effective CDS model (`cds-mcp_search_model`) of an existing project before modifying multitenancy configuration

## Architecture Overview

A multitenant CAP app consists of these components:

| Component | Role |
|---|---|
| **Main App (srv)** | Serves business logic; resolves tenant at runtime via JWT |
| **MTX Sidecar** | Separate Node.js process handling tenant provisioning, model serving, extensibility |
| **App Router** | Routes tenant-specific requests; resolves subdomain to tenant |
| **HANA (HDI)** | Tenant-isolated database containers managed by Service Manager |
| **SAP SaaS Registry** | BTP service that manages tenant subscriptions |
| **XSUAA / IAS** | Authentication and authorization; issues tenant-scoped JWTs |

The sidecar handles all tenant lifecycle operations (subscribe, unsubscribe, upgrade) and
serves tenant-specific CDS models (for extensibility). The main app never talks to the SaaS
Registry directly — the sidecar mediates everything.

## Step 1 — Enable Multitenancy

Add MTX support to an existing CAP project:

```sh
cds add multitenancy
npm install
cd mtx/sidecar && npm install && cd ../..
```

This scaffolds:
- `mtx/sidecar/` subproject with `@sap/cds-mtxs` dependency
- Configuration in the root `package.json` enabling `multitenancy: true`
- Sets profile `with-mtx-sidecar` on the main app
- Required service bindings (service-manager, saas-registry)

**Critical:** Always run `npm install` in `mtx/sidecar/` immediately after scaffolding.
The sidecar needs a `package-lock.json` or `mbt build` will fail later with `npm ci` errors
because the MTA build tool uses `npm ci` (which requires a lockfile).

For extensibility (allowing customers to extend your model at runtime):

```sh
cds add multitenancy,extensibility
```

The configuration shortcuts in `package.json`:

```json
{
  "cds": {
    "requires": {
      "multitenancy": true,
      "extensibility": true,
      "toggles": true
    }
  }
}
```

These activate the following MTX services:

| Flag | SaasProvisioningService | DeploymentService | ExtensibilityService | ModelProviderService |
|---|:---:|:---:|:---:|:---:|
| `multitenancy` | yes | yes | — | yes |
| `extensibility` | — | — | yes | yes |
| `toggles` | — | — | — | yes |

### Profile-Based Activation

`cds add multitenancy` already configures a `with-mtx` profile. Use it to run locally
with MTX enabled without affecting normal development:

```sh
cds watch --with-mtx
```

This activates multitenancy, the sidecar connection, and related settings only for
that run. No custom profile configuration needed.

## Step 2 — The MTX Sidecar

The sidecar is a dedicated Node.js app at `mtx/sidecar/` that runs the MTX services.

### Sidecar package.json

```json
{
  "name": "myapp-mtx",
  "version": "0.0.0",
  "dependencies": {
    "@sap/cds": "^9",
    "@cap-js/hana": "^2",
    "@sap/cds-mtxs": "^3",
    "@sap/xssec": "^4",
    "express": "^4"
  },
  "devDependencies": {
    "@cap-js/sqlite": "^2"
  },
  "scripts": {
    "start": "cds-serve"
  },
  "cds": {
    "profile": "mtx-sidecar"
  }
}
```

The `"profile": "mtx-sidecar"` preset configures:
- `cds.xt.ModelProviderService` with `in-sidecar` mode
- `cds.xt.DeploymentService`
- `cds.xt.SaasProvisioningService`
- `cds.xt.ExtensibilityService`

### Development Settings

The sidecar defaults to port 4005 in development and uses mocked auth automatically.
You only need to configure the shared SQLite database path so both sidecar and main app
see the same data:

```json
{
  "cds": {
    "[development]": {
      "db": { "kind": "sqlite", "credentials": {
        "url": "../../db.sqlite"
      }}
    }
  }
}
```

## Step 3 — Local Testing

Local MTX testing requires **three terminals**:

**Terminal 1 — Start the Sidecar:**
```sh
cds watch mtx/sidecar
```
Expected output: sidecar serves MTX endpoints on `http://localhost:4005`

**Terminal 2 — Start the Main App:**
```sh
cds watch --with-mtx
```

**Terminal 3 — Subscribe Tenants:**
```sh
cds subscribe t1 --to http://localhost:4005
cds subscribe t2 --to http://localhost:4005
```

The sidecar creates tenant-specific SQLite databases (e.g., `db-t1.sqlite`) and deploys
the schema plus initial data from CSV files.

### Unsubscribe and Upgrade

```sh
# Remove a tenant
cds unsubscribe t1 --from http://localhost:4005

# Upgrade tenant schema after model changes
cds upgrade t1 --at http://localhost:4005 -u yves:
```

### Programmatic Tenant Management

```js
const ds = await cds.connect.to('cds.xt.SaasProvisioningService')
await ds.subscribe('t1')

const deploy = await cds.connect.to('cds.xt.DeploymentService')
await deploy.upgrade('t1')
```

## Step 4 — Hybrid Testing

Test locally against real cloud services (HANA, SaaS Registry):

```sh
# Bind main app to cloud service instances
cds bind -a myapp-srv

# Bind the sidecar
cd mtx/sidecar
cds bind -a myapp-mtx

# Build production artifacts (HANA HDI)
cds build --production

# Run sidecar in hybrid mode (from project root)
cds watch mtx/sidecar --profile hybrid

# Run main app in hybrid mode
cds watch --profile hybrid
```

## Step 5 — Production Services

Add required BTP services based on the decisions above:

```sh
cds add hana                # HANA Cloud database (always)
cds add approuter           # Tenant-aware request routing (always)
```

Then add auth based on the chosen path:

**Path A — XSUAA:**
```sh
cds add xsuaa --for production
```
This adds `saas-registry` as the subscription service (automatic with multitenancy).

Re-generate `xs-security.json` after model changes:
```sh
cds compile srv --to xsuaa > xs-security.json
```

**Path B — IAS + AMS:**
```sh
cds add ias
cds add ams
```
This adds `subscription-manager` as the subscription service instead of `saas-registry`.

After adding AMS, generate the base policies:
```sh
cds build --for ams   # generates ams/dcl/cap/basePolicies.dcl
```

The MTA will include a policy deployer module that uploads authorization policies to IAS
on deploy. Assign policies in IAS Admin Console: Applications → select your app →
Authorization Policies → assign to users.

**IAS + XSUAA fallback** (migration path — accepts both token types):
```json
{
  "cds": {
    "requires": {
      "auth": "ias",
      "xsuaa": true
    }
  }
}
```

### Subscription Service Coupling

| Auth choice | Subscription service | BTP service plan |
|---|---|---|
| XSUAA | `saas-registry` | `saas-registry` / `application` |
| IAS | `subscription-manager` | `subscription-manager` / `provider` |

The sidecar must be bound to whichever subscription service you use. `cds add multitenancy`
wires this up, but verify in `mta.yaml` or `values.yaml` that the binding is correct for
your auth choice.

### App Router Configuration

The approuter's `xs-app.json` must route MTX sidecar callbacks without its own
authentication (the sidecar handles auth itself):

```json
{
  "routes": [
    {
      "source": "^/-/cds/.*",
      "destination": "mtx-api",
      "authenticationType": "none"
    }
  ]
}
```

### SaaS Dependencies

If your app needs BTP services per subscriber tenant (e.g., Connectivity, Destination),
configure them in the sidecar's `package.json`:

```json
{
  "cds": {
    "requires": {
      "connectivity": true,
      "destinations": true,
      "html5-repo": true
    }
  }
}
```

## Step 6 — Deploy to Cloud Foundry

### Prepare

```sh
cds add hana,xsuaa
cds add approuter
cds add multitenancy
cds add mta
```

### MTA Pitfalls (Fix Before First Deploy)

The generated `mta.yaml` has defaults that often need manual adjustment. Address these
before your first `mbt build`:

#### a. appName with Spaces Breaks XSUAA

The default `appName: myapp-${org}-${space}` produces names with spaces if your org name
contains spaces (e.g., "My Company_my-team"). XSUAA rejects xsappnames with spaces.

**Fix:** Remove `${org}` or sanitize:
```yaml
appName: myapp-${space}   # safe if your space name has no spaces
```

#### b. Approuter Hostname Exceeds 63-Character Limit

The default `${default-uri}` generates long hostnames. With tenant prefixes like
`<subdomain>-<long-default-uri>`, you easily exceed CF's 63-character hostname limit.

**Fix:** Use an explicit short route:
```yaml
- name: myapp-approuter
  parameters:
    routes:
      - route: "myapp-${space}.cfapps.eu12.hana.ondemand.com"
  properties:
    TENANT_HOST_PATTERN: "^(.*)-myapp-${space}.cfapps.eu12.hana.ondemand.com"
  provides:
    - name: app-api
      properties:
        app-protocol: ${protocol}
        app-uri: myapp-${space}.cfapps.eu12.hana.ondemand.com
```

#### c. Sidecar Missing Service Bindings

The sidecar needs bindings to **all services** that contribute to SaaS dependencies.
If a service is bound to the main app but not the sidecar, the dependencies callback
returns HTTP 500 with errors like:
```
Cannot resolve dependency at path 'uaa' in service 'audit-log'.
Make sure the service is bound to the MTX sidecar.
```

**Fix:** Add any service the sidecar needs to resolve dependencies for:
```yaml
- name: myapp-mtx
  requires:
    - name: myapp-db
    - name: myapp-sms          # service-manager (always)
    - name: myapp-auditlog     # if using audit-log
    - name: myapp-auth         # xsuaa or ias binding
```

#### d. Failed Service Instances Block Redeployment

If a service instance creation fails during deploy (wrong plan, invalid name, quota),
the deployer retries but ultimately fails. The instance stays in `create failed` state
and blocks subsequent deploys.

**Fix:** Delete the stuck instance manually, then redeploy:
```sh
cf delete-service <service-name> -f
cf deploy gen/mta.tar -f
```

### Build and Deploy

```sh
# Ensure sidecar lockfile exists
cd mtx/sidecar && npm install && cd ../..

# One-step deployment
cds up

# Or manual steps:
mbt build -t gen --mtar mta.tar
cf deploy gen/mta.tar -f
```

### MTA Hooks for Tenant Upgrade

Add an upgrade hook in `mta.yaml` so tenants are upgraded automatically on redeployment:

```yaml
hooks:
  - name: upgrade-all
    type: task
    phases:
      - blue-green.application.before-start.idle
      - deploy.application.before-start
    parameters:
      name: upgrade
      memory: 512M
      disk-quota: 768M
      command: cds-mtx upgrade '*'
```

Run ad-hoc upgrades:
```sh
cf run-task <sidecar-app> --name "upgrade-all" --command "cds-mtx upgrade '*'"
```

### SaaS Registry / Subscription Manager in MTA

**When using XSUAA** — `saas-registry` resource:
```yaml
- name: myapp-registry
  type: org.cloudfoundry.managed-service
  parameters:
    service: saas-registry
    service-plan: application
    config:
      appName: myapp-${space}
```

**When using IAS** — `subscription-manager` resource:
```yaml
- name: myapp-sms
  type: org.cloudfoundry.managed-service
  parameters:
    service: subscription-manager
    service-plan: provider
```

`cds add multitenancy` generates the appropriate resource based on which auth you added
first, but always verify.

### Route Mapping for Subscribers

After a tenant subscribes, manually map a route for each tenant to the approuter:
```sh
cf map-route <approuter-app> cfapps.<region>.hana.ondemand.com \
  --hostname <subscriber-subdomain>-myapp-<space>
```

## Step 7 — Deploy to Kyma

### Prepare

```sh
cds add hana,xsuaa
cds add multitenancy
cds add kyma    # shorthand for helm + containerize
```

### Build and Deploy

```sh
cds up -2 k8s
```

### Sidecar Values (values.yaml)

```yaml
srv:
  env:
    CDS_MULTITENANCY_APPUI_TENANTSEPARATOR: "-"

mtx-upgrade:
  bindings:
    saas-registry:                    # when using XSUAA
      serviceInstanceName: saas-registry
    # subscription-manager:           # when using IAS (use this INSTEAD of saas-registry)
    #   serviceInstanceName: subscription-manager
    service-manager:
      serviceInstanceName: service-manager
  image:
    repository: myapp-sidecar
  resources:
    limits:
      memory: 1G
    requests:
      cpu: 1000m
      memory: 1G
  command: ["launcher"]
  args: ["cds-mtx", "upgrade", "*"]
```

Use `saas-registry` binding when authenticating with XSUAA, or `subscription-manager`
binding when authenticating with IAS. Never both.

## Step 8 — Extensibility

### Provider-Side: Restrict Extension Points

Configure in `mtx/sidecar/package.json`:

```json
{
  "cds": {
    "requires": {
      "cds.xt.ExtensibilityService": {
        "element-prefix": ["x_"],
        "namespace-blocklist": ["com.sap.", "sap."],
        "extension-allowlist": [
          {
            "for": ["my.namespace"],
            "kind": "entity",
            "new-fields": 2
          },
          {
            "for": ["MyService"],
            "new-entities": 2,
            "annotations": ["@readonly"]
          }
        ]
      }
    }
  }
}
```

### Consumer-Side: Push Extensions

```sh
cds login <app-url>
cds pull                  # fetch base model
# ... develop extensions ...
cds push                  # deploy extension to SaaS app
```

## Step 9 — Tenant Database Upgrade

When deploying model changes to production, all tenant databases must be upgraded:

```sh
# From the sidecar project
cd mtx/sidecar
cds-mtx upgrade t1       # single tenant
cds-mtx upgrade '*'      # all tenants
```

Or via the sidecar HTTP API:
```http
POST /-/cds/saas-provisioning/upgrade
Content-Type: application/json

{ "tenants": ["t1"] }
```

### Monitor Upgrade Jobs

Poll the job endpoint to check status:
```http
GET /-/cds/jobs/pollJob
```

Response includes per-tenant status:
```json
{
  "status": "FAILED",
  "op": "upgrade",
  "tenants": {
    "tenant-a": { "status": "FINISHED" },
    "tenant-b": { "status": "FAILED", "error": "..." }
  }
}
```

## Common Patterns

### Inspect Tenant Metadata

```http
GET /-/cds/saas-provisioning/tenant/<tenant-id>
GET /-/cds/saas-provisioning/tenant/
```

### Secure Internal Endpoints

The MTX sidecar endpoints (`/-/cds/*`) should only be accessible by internal technical
users. The sidecar must run in the same trust zone (shared XSUAA instance) as the main app:

```cds
@requires: 'internal-user'
service InternalService { ... }
```

### Custom Subscription Handlers (Node.js)

```js
const cds = require('@sap/cds')

module.exports = class extends cds.ApplicationService {
  async init() {
    const ds = await cds.connect.to('cds.xt.DeploymentService')

    ds.before('subscribe', async (req) => {
      // Custom logic before tenant DB is created
      const { tenant } = req.data
      console.log(`Subscribing tenant: ${tenant}`)
    })

    ds.after('subscribe', async (_, req) => {
      // Custom logic after tenant DB is created (e.g., seed data)
      const { tenant } = req.data
      console.log(`Tenant ${tenant} subscribed successfully`)
    })

    return super.init()
  }
}
```

## Subscription Prerequisites

For a subscriber subaccount to successfully subscribe to your SaaS app:

1. **Same region** — subscriber must be in the same CF region as the provider (e.g., `cf-eu12`)
2. **Different subaccount** — you cannot subscribe from the same subaccount as the provider;
   IAS rejects tokens with the same `app_tid`, and XSUAA has similar constraints
3. **Route mapping** — after subscription succeeds, a route must be mapped to the approuter
   for the subscriber to access the app (CF only; Kyma handles this via ingress)

**Additional prerequisites when using IAS:**

4. **OIDC trust** — the subscriber subaccount must have OIDC trust (not SAML) established
   to the provider's IAS tenant
5. **Trust propagation delay** — trust can take 1-2 minutes to propagate; wait before subscribing

## Required BTP Entitlements

**Always required:**

| Service | Plan | Purpose |
|---------|------|---------|
| SAP HANA Cloud | `hdi-shared` | Tenant HDI containers |
| SAP Service Manager | `container` | Manages tenant DB containers |

**If using XSUAA:**

| Service | Plan | Purpose |
|---------|------|---------|
| SAP Authorization and Trust Management (XSUAA) | `application` | Auth + role collections |
| SAP SaaS Provisioning Service (saas-registry) | `application` | Subscription lifecycle |

**If using IAS + AMS:**

| Service | Plan | Purpose |
|---------|------|---------|
| SAP Cloud Identity Services | `application` | User authentication (IAS) |
| SAP Authorization Management Service | `standard` | AMS policies |
| SAP Subscription Manager | `provider` | Subscription lifecycle |

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `npm ci` fails for sidecar during `mbt build` | Missing `package-lock.json` in `mtx/sidecar/` | Run `cd mtx/sidecar && npm install` before building |
| `Invalid xsappname` (spaces in name) | Org name with spaces flows into `appName: ${org}-${space}` | Use `appName: myapp-${space}` without `${org}` |
| `Host is too long (maximum 63 characters)` | Default approuter hostname + tenant prefix too long | Use explicit short route in MTA (see Step 6b) |
| `Cannot resolve dependency at path 'uaa'...` | Service not bound to the MTX sidecar | Add the missing service to sidecar's `requires` in `mta.yaml` |
| `Service plan premium not found` | Plan not entitled or region-specific | Use `oauth2` plan or entitle the correct plan for your region |
| `Subscription cannot be created with same app_tid` | Subscribing from provider subaccount | Use a different subscriber subaccount |
| OIDC trust missing or auth errors on subscribe | Subscriber has SAML trust or no trust at all | Establish OIDC trust in subscriber, wait 1-2 min for propagation |
| Service instance stuck in `create failed` | Previous deploy failed mid-creation | `cf delete-service <name> -f` then redeploy |
| `User lacking required roles` (with AMS) | AMS policy not assigned or not yet propagated | Assign policy in IAS Admin → Applications → your app → Authorization Policies |
| Sidecar returns 500 on dependencies callback | Missing service bindings on sidecar | Ensure all dependency-contributing services are bound to the sidecar module |
| Wrong subscription service bound | XSUAA app using `subscription-manager` or vice versa | Match: XSUAA → `saas-registry`, IAS → `subscription-manager` |

## Don't

- Run the MTX sidecar and main app in the same process in production — they must be separate deployments
- Hardcode tenant IDs in application code — always resolve from `cds.context.tenant`
- Skip the sidecar for Node.js apps with extensibility — the sidecar is required for dynamic model serving
- Forget to upgrade tenants after deploying schema changes — new tables/fields won't exist until upgrade runs
- Use `@sap/cds-mtx` (the old package) — always use `@sap/cds-mtxs` (streamlined MTX)
- Expose MTX sidecar endpoints publicly without proper auth — they must be behind XSUAA/IAS trust
- Run `cds subscribe` against the main app — always target the sidecar URL
- Use `appName: myapp-${org}-${space}` if your org name might contain spaces
- Forget `package-lock.json` in `mtx/sidecar/` — `mbt build` uses `npm ci` which requires it
- Try to subscribe from the same subaccount that hosts the provider app

## Related Skills

- `cap-developer` — general CAP development guidance
- `cap-check-setup` — verify your development environment
- `cap-troubleshooting` — diagnose issues with a running CAP app
- `cap-upgrade` — upgrade CAP packages to latest versions
