# Manual Upgrade Path (Pre-CDS-10)

This file contains the workflow for upgrading between CDS versions below 10
(e.g. 7→8, 8→9, or minor/patch updates within the same major).
It is loaded by the skill router in SKILL.md when `cds upgrade` is not available.

---

## Manual upgrade path

Use this section when the target version is below CDS 10 (e.g. upgrading from
7 to 8, or 8 to 9).

For multi-major jumps (e.g. 7→10), upgrade one major at a time. Complete each
step and verify before proceeding to the next. Once on CDS 9, switch to the
main workflow (Steps 0–6) for the 9→10 leg.

### M1 – Detect current versions

```sh
cds version
```

This shows global `@sap/cds-dk`, local `@sap/cds`, compiler, and database
plugin versions.

Check `package.json` for declared dependency ranges – pinned versions
(e.g. `"9.7.0"`) prevent minor/patch updates and should use caret ranges
(e.g. `"^9.7.0"`).

### M2 – Compare against latest

Check the latest published version for each CAP package in the project's
`package.json`:

```sh
npm view @sap/cds version
npm view @sap/cds-dk version
npm view @sap/cds-compiler version
```

Also check database plugins and other CAP packages the project uses.
Only check packages that are actually in the project's `package.json` – skip
packages the project doesn't use:

```sh
npm view @cap-js/sqlite version
npm view @cap-js/hana version
npm view @cap-js/postgres version
npm view @sap/cds-mtxs version
npm view @cap-js/cds-test version
```

Classify each upgrade:

| Installed | Latest | Type |
|---|---|---|
| Same major | Higher minor/patch | **Minor/patch** – safe, `npm update` |
| One major behind | Next major | **Major** – has breaking changes |
| Two+ majors behind | Latest | **Multi-major** – upgrade one at a time |

Present a summary table to the developer:

```
Package              Installed   Latest   Upgrade
-------              ---------   ------   -------
@sap/cds             9.5.0       9.8.0    minor
@sap/cds-dk (global) 9.5.0       9.8.0    minor
@cap-js/sqlite       2.0.1       2.1.3    minor
@cap-js/hana         2.0.0       2.0.5    patch
```

### M3 – Run the upgrade

#### Minor / patch (same major)

```sh
npm update
npm install -g @sap/cds-dk@latest
```

If `package.json` has pinned versions (no `^`), `npm update` won't upgrade
anything. Update explicitly instead:

```sh
npm install @sap/cds@latest @cap-js/sqlite@latest @cap-js/hana@latest
```

#### Major version upgrade

Install new versions explicitly:

```sh
npm install @sap/cds@<target-major>
npm install -g @sap/cds-dk@<target-major>
```

Upgrade database plugins and other CAP packages to their compatible versions:

```sh
npm install @cap-js/sqlite@latest @cap-js/hana@latest
```

For a clean dependency state:

```sh
rm -rf node_modules package-lock.json
npm install
```

### M4 – Review breaking changes

After a major upgrade, consult the release notes:

| Target major | Release notes |
|---|---|
| CDS 9 (May 2025) | https://cap.cloud.sap/docs/releases/2025/may25 |
| CDS 8 (June 2024) | https://cap.cloud.sap/docs/releases/2024/jun24 |
| CDS 7 (June 2023) | https://cap.cloud.sap/docs/releases/2023/jun23 |

Read the **Migration** section and walk through each item with the developer.

#### Known migration items: CDS 8 → 9

- **Minimum Node.js 20** (22 LTS recommended)
- **`@cap-js/sqlite` and `@cap-js/hana` moved to v2** – update both
- **`cds.test` moved to `@cap-js/cds-test`** – add to devDependencies:
  ```sh
  npm add -D @cap-js/cds-test
  ```
- **Event Queues enabled by default** – check `cds.requires.eventQueues` if
  synchronous event processing was assumed
- **`req.params` structure changed** – now an object, not array of key-value
  pairs. Check custom handlers.
- **New CDS compiler 6 (new parser)** – no fallback to old parser. Verify
  CDS models compile cleanly.
- **Removed `hdbcds` deploy format** – must use `hdbtable` (default)
- **Removed deprecated packages** – `@sap/cds-runtime`, `@sap/cds-hana`,
  `@sap/cds-sqlite`, `@sap/cds-mtx` (old). Use modern replacements.
- **ESLint 9 required** for `@sap/eslint-plugin-cds` 4

#### Known migration items: CDS 7 → 8

- **Minimum Node.js 18**
- **New database services default** – `@cap-js/sqlite` replaces
  `@sap/cds-sqlite`, `@cap-js/hana` replaces `@sap/cds-hana`
- **`@sap/cds-dk` 8 requires `@sap/cds` 7+** minimum
- **Deprecated features behind `attic` profile** – to temporarily re-enable:
  `CDS_ENV=attic cds watch`

### M5 – Verify

After upgrading, run these checks:

```sh
# Confirm new versions
cds version

# Start the server
cds watch

# Run tests if they exist
npm test
```

If the project has **no tests**, strongly recommend writing a test suite
before (or immediately after) upgrading – especially for major version bumps.
Even well-documented APIs can have subtle behavior changes across majors, and
**undocumented features or internal APIs can change even in minor/patch
releases**. A basic test suite should cover:
- Server startup (`cds.test()` boots the app)
- CRUD operations on the main entities
- Custom handlers and actions/functions
- Authorization scenarios (if `@restrict` / `@requires` is used)

If `cds watch` fails after a major upgrade, use the `cap-troubleshooting`
skill to diagnose.

#### Database redeployment

Some upgrades – even minor ones – change CAP-managed database tables. For
example, enabling Event Queues (default since CDS 9) adds internal tables to
the schema. Other features like Change Tracking or Audit Logging may also
evolve their internal table structures across versions.

For **persistent databases** (HANA, PostgreSQL), redeploy:

```sh
# HANA (via HDI)
cds build --production
# then deploy build output to HDI container

# PostgreSQL
cds deploy --to postgres
```

For local SQLite, `cds watch` recreates the database automatically.

### M6 – Post-upgrade recommendations

- Always keep `@sap/cds-dk` (global) and local `@sap/cds` on the same major.
  Mismatched versions cause hard-to-debug issues.
- Use `npm outdated` to see all outdated packages.
- If the project has no tests, recommend writing a basic test suite covering:
  server startup (`cds.test()`), CRUD on main entities, custom handlers, and
  authorization scenarios.
- After reaching CDS 9, use the main workflow (Steps 0–6 via `cds upgrade`)
  for the CDS 10 migration – it provides deterministic detection, automated
  compat-flag setting, and structured findings.

### Output format

```
CAP Upgrade Report
==================

Current State
-------------
@sap/cds             9.5.0  →  9.8.0   (minor upgrade available)
@sap/cds-dk (global) 9.5.0  →  9.8.0   (minor upgrade available)
@cap-js/sqlite       2.0.1  →  2.1.3   (minor upgrade available)
@cap-js/hana         2.0.0  →  2.0.5   (patch upgrade available)

Upgrade Type: minor (no breaking changes expected)

Actions Taken
-------------
✅ npm update – all local packages upgraded
✅ npm install -g @sap/cds-dk@latest – global CLI upgraded
✅ cds watch – server starts successfully
✅ npm test – all tests pass

No issues found.
```
