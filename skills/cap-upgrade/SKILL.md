---
name: cap-upgrade
description: Upgrade a CAP project to the latest CDS version. Drives the `cds upgrade` CLI for CDS 10+ (pattern detection, false-positive filtering, fix categorisation) and handles manual upgrades for earlier versions (major jumps like 7→8, 8→9 as well as minor/patch updates). Use when a developer needs to upgrade CDS in a CAP project, already has a `cds upgrade` report, or wants to move to a newer CDS version.
license: MIT
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

With `--fix` it:

- Updates CDS-related dependencies in `package.json` to the target version
- Runs `npm install`
- Rebuilds the project with the new compiler
- Sets compatibility flags that preserve previous behaviour where applicable

Without flags it scans only — no changes to project sources or dependencies
(the report files below are still written).

With `--dry` nothing is written to disk at all — all output goes to stdout.

In every mode it scans the project for breaking-change patterns and produces:

- `findings.json` — structured per-rule matches with file positions, guidance,
  severity, compat flags, OpenRewrite recipes, and coverage signals
- `UPGRADE_REPORT.md` — human-readable report grouping findings by scope
- `UPGRADE_OVERVIEW.md` — short summary with scan numbers and quick wins

### What this skill adds

The CLI's outputs are dense — many rules, many matches per rule, many of which
may be false positives in any given codebase. This skill:

- Filters false positives using per-rule `guidance` and generic FP rules
- Reads source files to verify ambiguous matches
- Searches for occurrences the patterns may have missed
- Categorises each finding by fix type (deterministic, OpenRewrite, manual)
- Offers to apply deterministic fixes directly

## Version routing

Before starting any workflow, detect the current CDS major version:

```sh
cds version
```

Parse the `@sap/cds` line (e.g. `@sap/cds: 9.8.0`). Extract the major number.

| Current major | Target | Workflow |
|---|---|---|
| < 9 | Ask the developer: "What target version? (9 or 10)" | If target < 10 → **Manual upgrade path** (appendix). If target = 10 → multi-major: upgrade to 9 first (manual path), then run `cds upgrade` for 9→10. |
| 9 | 10 (default) | **Main workflow** (Steps 0–6 below) |
| 10 | 10 (re-check) | **Mode C** (see Trigger modes below) |

## Trigger modes

### Mode A – Fresh run

The developer asks to upgrade (e.g. "migrate my project", "run cds upgrade").
Run `cds upgrade --fix` from scratch:

1. Verify preconditions (Step 0)
2. Run `cds upgrade --fix` (Step 1) – upgrades dependencies AND scans
3. Read and interpret output (Steps 2–5)
4. Apply manual fixes, review compat flags (Step 6)

### Mode B – Existing report

The developer already ran `cds upgrade` and has `UPGRADE_REPORT.md` and/or
`findings.json` in the project root. This is the common case when:

- The developer ran the tool first and now wants help interpreting findings
- A teammate, IDE integration, or CI job produced the report
- A previous session ended after Step 1 and is being resumed

**Detection:** Check if `UPGRADE_REPORT.md` or `findings.json` exists in the
project root. If present, check whether any source file tracked by the project
has been modified after `.cdsupgrade.json` was written. If no relevant changes
occurred, reuse the existing report. Otherwise, suggest re-running `cds upgrade`.

Skip to Step 2 (Read the report).

### Mode C – Already on target (re-check)

The project already upgraded to CDS 10 but may have:
- Unresolved findings from a previous run
- Compat flags set by `--fix` that should eventually be removed
- New migration rules added in a cds-dk patch

Run `cds upgrade` to scan for remaining migration items. If
`UPGRADE_REPORT.md` or `findings.json` already exist and are recent
(Mode B detection applies), skip directly to Step 2.

### Out of scope

This skill assumes a developer-type environment where `cds upgrade` can run
(globally installed cds-dk with upgrade support, or via `npx @sap/cds-dk@latest`) and agent
capabilities are present. It does not cover:

- **NO-AI mode** – if the developer runs `cds upgrade` without an AI agent,
  `UPGRADE_REPORT.md` is the human deliverable. The skill is unnecessary.
- **CI / headless** – `findings.json` can be consumed by a custom pipeline
  (e.g. SARIF conversion for IDE Problems Panel). The skill is invoked only
  when an agent walks a developer through findings interactively.

---

## Load the relevant workflow

Based on the version routing above, load **exactly one** of the following files
from this skill's directory and follow its instructions:

| Scenario | File to load |
|----------|-------------|
| Mode A, B, or C (target is CDS 10, or already on 10) | [`workflow-cds10.md`](workflow-cds10.md) |
| Manual upgrade path (target < 10, or first leg of multi-major) | [`manual-upgrade.md`](manual-upgrade.md) |

**Do not load both.** Only the file matching the detected scenario is relevant.
After loading, follow that file's instructions from the beginning.

