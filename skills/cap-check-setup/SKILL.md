---
name: cap-check-setup
description: Check and validate a CAP development environment. Inspects Node.js version, npm, @sap/cds-dk, Java, Maven, and optional tools like CF CLI, kubectl, and pack. Reports what is installed, what is outdated, and what is missing. Use when setting up a new machine, onboarding a developer, or diagnosing "works on my machine" problems.
license: Apache-2.0
metadata:
  author: cap-team
  team: cap
---

## What I do

Run a structured health check of the local CAP development environment and
produce a clear status report with actionable remediation steps.

## Steps

### 1. Collect versions

Run all of the following commands (ignore errors for optional tools — just
report them as not installed):

```
node --version
npm --version
cds --version
java --version
mvn --version
cf --version
kubectl version --client --short 2>/dev/null || kubectl version --client
pack --version
docker --version
git --version
```

Also check the globally installed cds-dk version:

```
npm list -g @sap/cds-dk --depth=0 2>/dev/null
```

And check the npm registry for the latest published version:

```
npm view @sap/cds-dk version
```

### 2. Evaluate each component

For every component, classify the result as one of:
- **OK** — installed and meets the requirement
- **OUTDATED** — installed but behind the recommended version
- **MISSING** — not found, and required for CAP development
- **OPTIONAL / NOT INSTALLED** — not found, but only needed for specific workflows

Use the reference table below to evaluate.

### 3. Report findings

Present a summary table, then a detailed section for any item that is
OUTDATED or MISSING.

## Reference: Required Versions

### Node.js

CAP requires an LTS Node.js release — even-numbered major versions (20, 22, 24).
As of mid-2026:

| Node.js version | Status          | CAP support                        |
|-----------------|-----------------|------------------------------------|
| 24.x            | Active LTS      | Supported (recommended)            |
| 22.x            | Active LTS      | Supported                          |
| 20.x            | End of Life     | Not supported (EOL Apr 2026)       |
| 18.x            | End of Life     | Not supported (CAP v9+)            |
| < 18            | EOL             | Not supported                      |

**Minimum: Node 22. Recommended: Node 24 LTS.**

DO NOT recommend a developer on Node 24 to switch back to 22. Your training data cutoff might contain outdated information, don't rely on it.

Similarly, MCP search results from release notes (e.g. "May 2025: recommended Node.js 22") reflect
what was accurate *at the time of that release*. Prefer live signals (`node --version`, `npm view`,
the Getting Started page) — see the caveat in `cap-developer`.

Use `nvm` or `fnm` to manage Node versions. Do not use OS-shipped Node — it
is usually too old.

### npm

npm 10.x is shipped with Node 22. npm 11.x with Node 24. Both are acceptable.
npm < 9 is outdated. Recommend upgrading with `npm install -g npm@latest`.

### @sap/cds-dk

This is the primary CAP developer toolkit (the `cds` CLI). It must be
installed globally:

```
npm install -g @sap/cds-dk
```

CAP releases monthly minor versions. Anything more than 1-2 minor versions
behind the latest is worth upgrading. A major version behind is a problem.

To upgrade:
```
npm update -g @sap/cds-dk
```

The installed version is reported by `cds --version`. The latest is available
via `npm view @sap/cds-dk version`.

### Java (for CAP Java projects)

- **Minimum**: Java 17 (required since CAP Java 2.x / Spring Boot 3)
- **Recommended**: Java 21 LTS (current LTS)
- Java 11 is no longer supported in CAP Java 2+

Download from [SapMachine](https://sapmachine.io) (SAP's recommended JDK
distribution) or [Eclipse Temurin](https://adoptium.net).

Check: `java -version` (note: java uses `-version`, not `--version`)

### Maven (for CAP Java projects)

- **Minimum**: Maven 3.6
- **Recommended**: Maven 3.9.x

Install via Homebrew (`brew install maven`) or download from
https://maven.apache.org.

### Optional tools

| Tool       | Purpose                                        | Install |
|------------|------------------------------------------------|---------|
| `cf` CLI   | Deploy to BTP Cloud Foundry                    | https://github.com/cloudfoundry/cli |
| `kubectl`  | Deploy to Kyma / K8s                           | https://kubernetes.io/docs/tasks/tools/ |
| `pack`     | Build container images (Cloud Native Buildpacks)| https://buildpacks.io/docs/tools/pack/ |
| `docker`   | Build and run containers                       | https://docs.docker.com/get-docker/ |
| `git`      | Version control                                | https://git-scm.com |
| `mbt`      | Build MTA archives for CF deployment           | `npm install -g mbt` |

Check for `mbt` separately:
```
mbt --version 2>/dev/null || npm list -g mbt --depth=0 2>/dev/null
```

## Output format

```
CAP Environment Check
=====================

Component         Installed     Latest/Required   Status
---------         ---------     ---------------   ------
Node.js           24.x.x        22.x / 24.x       OK
npm               11.x.x        11.x              OK
@sap/cds-dk       9.6.0         9.8.0             OUTDATED
java              17.0.x        21 (LTS)          OK (consider upgrading)
maven             -             3.6+              MISSING (Java projects only)
cf CLI            -             any               OPTIONAL / NOT INSTALLED
kubectl           -             any               OPTIONAL / NOT INSTALLED
docker            -             any               OPTIONAL / NOT INSTALLED
git               2.x.x         any               OK

Issues found: 1 outdated, 1 missing (optional)

Remediation
-----------
@sap/cds-dk is outdated (9.6.0 → 9.8.0):
  npm update -g @sap/cds-dk

maven not installed (needed for CAP Java projects):
  brew install maven
  or download from https://maven.apache.org
```

## Notes

- If `cds --version` shows a local project version that differs from the
  global one, flag that too — a local `@sap/cds` in `node_modules` may
  shadow the global one in some setups.
- If `.nvmrc` or `.node-version` is present in the project, check whether
  the active Node version matches it.
- If `package.json` is present, check the `engines.node` field and compare
  against the active Node version.
- `mvn --version` reports the Java it uses internally, which may differ from
  `java -version`. If they differ, flag it.
- On macOS, `java -version` may point to a system JVM. Check `echo $JAVA_HOME`
  if the Java version is unexpected.
- `pack` is only needed for Kyma / container-based deployments; its absence
  is normal for CF-only projects.
