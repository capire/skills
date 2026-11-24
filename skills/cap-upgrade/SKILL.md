---
name: cap-upgrade
description: Upgrade a CAP project to the latest CDS version. Drives the `cds upgrade` CLI for CDS 10+ (pattern detection, false-positive filtering, fix categorisation) and handles manual upgrades for earlier versions (major jumps like 7→8, 8→9 as well as minor/patch updates). Use when a developer needs to upgrade CDS in a CAP project, already has a `cds upgrade` report, or wants to move to a newer CDS version.
license: Apache-2.0
compatibility: all
metadata:
  author: Tim Schulze-Hartung
  co-authors:
    - Daniel Schlachter
  team: cap-tools
---

## What I do

I drive the `cds upgrade` CLI, interpret its findings, and walk the developer
through each migration item with concrete fix instructions and links to the
official CAP migration documentation on capire.

### What `cds upgrade` does

`cds upgrade` is a deterministic command-line tool shipped with `@sap/cds-dk`.
It is the foundation this skill works on top of.

It proposes dependency updates and installation interactively. The target major
comes from the running cds-dk. `--fix` applies Java OpenRewrite recipes;
without it, recipes run as a dry-run.

Use `cds upgrade --help` to discover the installed command's options and follow
its actual prompts and output. This skill consumes its machine-readable report.

With `--report`, findings or manual-review rules produce files in `.cds-upgrade/`:

- `report.yaml` – structured per-rule matches with file positions, guidance,
  compat flags, OpenRewrite recipes, and coverage signals (for AI consumption)
- `report.md` – human-readable report with TOC, summary tables grouped by
  capire section, and detailed findings with migration body and locations

The console groups findings by capire section, collapsing large match lists to
counts. Verify the run outcome and report freshness before interpreting results.

### What this skill adds

The CLI's outputs are dense – many rules, many matches per rule, many of which
may be false positives in any given codebase. This skill:

- Filters false positives using per-rule `guidance` and generic FP rules
- Reads source files to verify ambiguous matches
- Searches for occurrences the patterns may have missed
- Categorises each finding by fix type (deterministic, OpenRewrite, manual)
- Offers to apply deterministic fixes directly

## Version routing

Before starting a fresh run, inspect the toolchain:

```sh
cds version
```

Use the running `@sap/cds-dk` major as the command's effective target. Determine
the project's current version from dependency declarations and lock files,
including workspace/sidecar packages, or `cds.services.version` in Java POMs.
The displayed `@sap/cds` version alone may belong to the toolchain rather than
the project. Resolve any difference between the requested and tool target before
running an upgrade.

### If `cds version` fails

If the command errors (TypeError, "command not found", stack trace), ask the
developer to fix their `cds` installation. An existing report can still be interpreted.
With the developer's agreement, use a pinned fallback:
`npx --package @sap/cds-dk@<version> -- cds upgrade --report`.

### Routing table

| Current major | Target | Workflow |
|---|---|---|
| Earlier major | Target < 10 | Manual upgrade path |
| Earlier major | Tool target ≥ 10 | Main workflow; cover intervening changes using the manual appendix when needed |
| On target ≥ 10 | Same major | Mode C (re-check) |

## Trigger modes

### Mode A – Fresh run

The developer asks to upgrade (e.g. "migrate my project", "run cds upgrade").
Follow the main workflow from Step 0:

1. Verify preconditions (Step 0)
2. Run `cds upgrade --report` interactively (Step 1); add `--fix` only for approved Java recipe application
3. Read and interpret output (Steps 2–5)
4. Apply manual fixes, review compat flags (Step 6)

### Mode B – Existing report

The developer already ran `cds upgrade` and has `.cds-upgrade/report.yaml`
in the project. This is the common case when:

- The developer ran the tool first and now wants help interpreting findings
- A teammate, IDE integration, or CI job produced the report
- A previous session ended after Step 1 and is being resumed

Check `project.root`, file modification times, the corresponding Markdown report's
generation time when available, and relevant project changes. YAML has no generation
timestamp or dependency-install status. If freshness is uncertain, label the report
as historical and arrange a new run before claiming current coverage.

Skip execution and enter Step 2. Establish remaining work from project state and
run results. If only Markdown is available, interpret it as human guidance;
obtain current YAML before the structured analysis workflow.

### Mode C – Already on target (re-check)

The project already upgraded to CDS 10 but may have:
- Unresolved findings from a previous run
- Compat flags that should eventually be removed
- New migration rules added in a cds-dk patch

Run `cds upgrade --report` interactively to check remaining migration items;
dependency updates may still be proposed. If
`.cds-upgrade/report.yaml` already exists and is current (Mode B detection
applies), skip directly to Step 2.

### Out of scope

This skill assumes a developer-type environment where `cds upgrade` can run
and agent capabilities are present. It does not cover:

- **NO-AI mode** – if the developer runs `cds upgrade --report` without an AI
  agent, `.cds-upgrade/report.md` is the human deliverable. The skill is unnecessary.
- **CI / headless** – `.cds-upgrade/report.yaml` can be consumed by a custom pipeline
  (e.g. SARIF conversion for IDE Problems Panel). The skill is invoked only
  when an agent walks a developer through findings interactively.

---

## Load the relevant workflow

Based on the version routing above, select one of the following files
from this skill's directory and follow its instructions:

| Scenario | File to load |
|----------|-------------|
| Mode A, B, or C (tool target ≥ 10) | [`workflow-cds10.md`](workflow-cds10.md) |
| Manual upgrade path (target < 10) | [`manual-upgrade.md`](manual-upgrade.md) |

Load the selected workflow; consult the manual appendix additionally when an
upgrade crosses earlier majors. For an existing report, enter at Step 2 rather
than repeating command execution.
