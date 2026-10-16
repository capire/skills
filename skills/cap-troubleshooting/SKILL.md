---
name: cap-troubleshooting
description: Diagnose and troubleshoot a CAP Node.js application that is not working as expected. Collects diagnostics, checks for common issues, and suggests fixes. Use when cds watch fails, requests return errors, data is missing, or behavior is unexpected. For plain server start/stop and service discovery with no failure involved, use `cap-inner-loop` instead.
license: Apache-2.0
metadata:
  author: cap-team
  team: cap
---

## What I do

Run a structured diagnostic on a CAP Node.js project to find out why something
is broken. Collect project state, walk through a checklist of common issues,
and suggest concrete fixes.

## Steps

### 1. Understand the symptom

Ask the user (or infer from context) which category the problem falls into:

| Category | Examples |
|----------|---------|
| **Startup failure** | `cds watch` crashes, server won't start |
| **Request error** | 404, 500, 401/403, query returns wrong data |
| **Build/deploy error** | `cds build` fails, HDI deploy fails |
| **Data issue** | Missing data, wrong results, draft problems |
| **Config confusion** | Service bindings, profiles, hybrid testing |

This determines which checks in Step 3 to prioritize.

> This skill covers *diagnosing failures*. For how to start, discover and stop local
> servers in the first place, see `cap-inner-loop`.

### 2. Collect diagnostics

Run these commands from the project root. Capture all output — do not stop on
errors.

#### Version info

```sh
cds version
```

Compare the global `@sap/cds-dk` version against the local `@sap/cds` in
`node_modules`. A major version mismatch (e.g. dk 9 vs cds 7) is a problem.

#### Effective configuration

```sh
cds env requires
cds env requires --profile production
```

This shows the resolved service bindings and feature flags. Look for
unexpected `kind` values, missing credentials, or wrong database config.

#### Dependency health

```sh
npm ls --depth=0 2>&1
```

Look for `UNMET PEER DEPENDENCY`, `MISSING`, or `invalid` entries.

#### Verbose server start

```sh
DEBUG=all cds watch 2>&1 | head -100
```

`DEBUG=all` turns on trace-level logging for every CAP module. Scan the
output for errors, warnings, or unexpected flow. You can also narrow it:

| DEBUG value | What it shows |
|-------------|---------------|
| `all` | Everything |
| `sql` | Generated SQL statements |
| `auth` | Authentication resolution |
| `remote` | Remote service calls |
| `app` | Application-level logs |
| `cds` | Core CDS runtime |

#### Interactive exploration with cds repl

When you need to inspect the live model or test queries interactively, use a
**heredoc** to feed commands into the REPL. This is important: piping via
`echo ... |` closes stdin before the async server boot finishes, so the
entities are not yet in scope and commands fail. A heredoc keeps stdin open
long enough for the server to start and export all globals.

```sh
cds repl --run . <<'EOF'
await SELECT.from(Incidents).limit(3)
EOF
```

After `--run .` boots, the REPL automatically injects all entities and
services as globals, so you can use them directly:

```sh
cds repl --run . <<'EOF'
.inspect cds.model .depth=2
EOF

cds repl --run . <<'EOF'
.inspect cds.services .depth=1
EOF

cds repl --run . <<'EOF'
await SELECT.from(Incidents).where({ status_code: 'N' })
EOF
```

You can also put multiple statements in one heredoc:

```sh
cds repl --run . <<'EOF'
const result = await SELECT.from(Incidents).columns('ID','title','status_code')
console.log(result)
EOF
```

#### Project structure check

Read `package.json` — specifically `cds.requires`, `dependencies`, and
`devDependencies`. Check if these files/folders exist:

- `db/` or `data/` — CDS domain model
- `srv/` — service definitions and handlers
- `app/` — UI / Fiori annotations (optional)
- `.cdsrc.json` or cds config in `package.json`
- `.cdsrc-private.json` — private config / hybrid bindings
- `default-env.json` — legacy service bindings (deprecated, prefer `cds bind`)

### 3. Check for common issues

Walk through these checks. Skip items that don't match the symptom category
from Step 1.

#### 3.1 Version mismatch (global dk vs local cds)

**Symptom:** Strange errors on `cds watch`, features not working as documented.

**Check:** Compare major versions from `cds version` output. The global
`@sap/cds-dk` and local `@sap/cds` must be on the same major version.

**Fix:**
```sh
npm install -g @sap/cds-dk@latest
npm update @sap/cds
```

#### 3.2 Missing or stale node_modules

**Symptom:** `MODULE_NOT_FOUND` errors, or behavior doesn't match code changes
to dependencies.

**Check:** Run `npm ls --depth=0` and look for errors. Check if `node_modules`
exists at all.

**Fix:**
```sh
rm -rf node_modules package-lock.json
npm install
```

#### 3.3 Wrong or missing cds.requires config

**Symptom:** "No service definition found", database errors, wrong database
used in production.

**Check:** Run `cds env requires` and compare against what you expect. Common
mistakes:
- `db` kind is `sql` but no database plugin installed
- `auth` not configured for production profile
- Service bindings set for wrong profile

**Fix:** Correct `package.json` cds section or `.cdsrc.json`. Use
`cds env requires --profile <profile>` to verify each profile.

#### 3.4 Missing database plugin

**Symptom:** "No database service configured" or "Cannot find module" for
database.

**Check:** Look at `devDependencies` / `dependencies` for one of:

| Plugin | Database |
|--------|----------|
| `@cap-js/sqlite` | SQLite (dev) |
| `@cap-js/hana` | SAP HANA (production) |
| `@cap-js/postgres` | PostgreSQL |

**Fix:**
```sh
# For local development:
npm add -D @cap-js/sqlite
# For production with HANA:
npm add @cap-js/hana
```

#### 3.5 Stale build artifacts

**Symptom:** Model changes not reflected at runtime, deployed schema differs
from CDS.

**Check:** If `gen/` folder exists, check if it's outdated vs the source `.cds`
files.

**Fix:**
```sh
cds build
# or just use cds watch during development — it rebuilds automatically
```

#### 3.6 Authentication / authorization issues

**Symptom:** 401 Unauthorized, 403 Forbidden, or auth works locally but not
in production.

**Check:**
- Are mock users defined in `.cdsrc.json` for local dev?
- Do mock user roles match `@requires` / `@restrict` annotations?
- Run `DEBUG=auth cds watch` and inspect which user is resolved.
- For production: is `@sap/xssec` installed? Is XSUAA bound?

**Fix (local mock users):** Add to `.cdsrc.json`:
```json
{
  "requires": {
    "auth": {
      "[development]": {
        "kind": "mocked",
        "users": {
          "alice": { "roles": ["admin"] },
          "bob": { "roles": ["viewer"] }
        }
      }
    }
  }
}
```

#### 3.7 Hybrid testing / binding issues

**Symptom:** Works locally with SQLite but fails when testing against remote
HANA or other BTP services.

**Check:**
- Was `cds bind` run to create bindings? Check `.cdsrc-private.json`.
- Run `cds env requires.db --profile hybrid` to see resolved config.

**Fix:**
```sh
cds bind -2 <hana-service-instance>
cds watch --profile hybrid
```

#### 3.8 Draft issues

**Symptom:** Draft operations fail, "DRAFT_ACTIVE" table errors, Fiori edit
flow broken.

**Check:**
- Is `@odata.draft.enabled` on the right entity (the service-level
  projection, not the db entity)?
- Does the entity use `Composition of many` correctly for sub-items?
- Is the client actually a Fiori Elements app? Draft requires a compatible
  UI framework.

**Fix:** Ensure the annotation is on the service entity:
```cds
service CatalogService {
  @odata.draft.enabled
  entity Books as projection on db.Books;
}
```

#### 3.9 Port conflict

**Symptom:** `EADDRINUSE` error on startup.

**Check:** Another process is using port 4004 (default).

**Fix:**
```sh
cds watch --port 4005
# or kill the existing process:
lsof -ti:4004 | xargs kill
```

#### 3.10 Startup hangs or connects to wrong services

**Symptom:** `cds watch` starts but hangs, or connects to unexpected external
services.

**Check:** Run `cds env requires` and look for remote service bindings that
may be active in the current profile. Check for leftover `default-env.json`
or `.cdsrc-private.json` files injecting credentials.

**Fix:** Remove or rename stale config files. Use explicit profiles:
```sh
CDS_ENV=development cds watch
```

#### 3.11 Model-layer issues

**Symptom:** Requests succeed but fields are missing, associations resolve to
null, or expands return nothing.

**Check:** The cause is usually the CDS model, not the runtime — run a
`cap-cds-review` pass over the affected entities and service projections.

### 4. Report findings

Present findings as:

1. **Root cause** — the most likely cause of the issue
2. **Evidence** — the specific command output or file content that confirms it
3. **Fix** — the exact command(s) or file edit to resolve it
4. **Verification** — how to confirm the fix worked (usually `cds watch` + a test request)

If no issue is found from the checklist, suggest the user run with full debug
logging and share the output:
```sh
DEBUG=all cds watch 2>&1 | tee cds-debug.log
```

## Notes

- Always run `cds version` first — many issues boil down to version mismatches.
- `DEBUG=all` is noisy but invaluable. Narrow to specific modules once the
  problem area is identified.
- `cds repl --run .` starts a live server inside the REPL, letting you query
  the model and database interactively — very useful for data issues. Feed
  commands via heredoc (`<<'EOF' ... EOF`), not via pipe (`echo ... |`):
  piping closes stdin before the async boot completes, causing commands to
  fail with "not defined" errors. The heredoc keeps stdin open until the
  server is ready and all entity/service globals are injected.
- `cds env` shows the *effective* merged config from all sources. It's the
  single source of truth for "what config is actually active".
- This skill is for CAP Node.js. For Java-specific issues, defer to Java
  diagnostics (Spring Boot logs, Maven build).
