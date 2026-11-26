# CDS 10 Upgrade Workflow (Modes A / B / C)

This file contains the full workflow for upgrading to CDS 10 using `cds upgrade`.
It is loaded by the skill router in SKILL.md after mode detection.

---

## Execution directives

These directives govern the upgrade workflow, tool usage, and error handling.

### Command usage

**Always use the `cds` CLI directly.** Run `cds version`, `cds upgrade`,
`cds build`, etc. Never substitute with `npx @sap/cds-dk ...` unless
explicitly told to fall back (see Step 1 failure handling).

### Speed and token efficiency

- **Overview first, then ask.** After reading the tool's output (Step 2),
  present a compact overview to the developer. Then ask: "Shall I proceed
  with the detailed analysis?" Only proceed with write-operations (applying
  fixes, modifying source files) after explicit confirmation. Approval for detailed
  analysis does not select fixes for application (Step 6). If the developer
  declines analysis, point to the current report when one exists.
- **Numbered choices.** When asking the developer a question with discrete
  options, label each option with a single letter (`a)`, `b)`, …) so the
  developer can respond with one character.
- *Parallelise independent work.* Gather Step 2.5 context before Step 3.
  Per-rule FP checks (Step 3), follow-up searches (Step 4), and manual-review
  quick checks (Step 5a) may run in parallel when their inputs are ready;
  each follow-up search waits for that rule's FP result.

### Error handling (stderr)

Do not fully suppress stderr with `2>/dev/null` – a command that fails silently
cannot be diagnosed. Merging stderr into stdout (`2>&1`) or paging long output is
fine.

### Git commits during the upgrade

Commits created as part of the upgrade workflow (preflight setup, compat-flag
setting, code fixes) should be recognisable as skill-initiated:

- Prefix: `chore(upgrade):` for mechanical/setup commits
- Prefix: `fix(upgrade):` for migration code fixes

This lets the developer distinguish skill-generated commits from their own work
in git history and allows easy squashing or rebasing later.

---

## Output behavior

These directives govern execution flow and output UX:

- **No internal step numbers.** Use descriptive headings in output, not
  "Step 1", "Step 2". Numbered steps in this file are internal agent structure.
- **Summary first.** After reading the console summary (stdout output of
  `cds upgrade`), present its content to the developer before any analysis.
  Then ask whether to proceed (see "Overview first" directive above).
- **Compact per-finding output.** Each finding gets at most 4 lines in the
  analysis section:
  1. Rule title + `(rule-id)`
  2. Matched locations (comma-separated `file:line` refs, max 5 inline)
  3. Verdict: confirmed / not applicable / needs manual check
  4. Recommended action (one sentence)

  Detailed explanation, examples, and migration steps are provided ONLY when:
  - The developer asks for details on a specific rule
  - The rule is complex (multi-file refactoring) and the action line is
    insufficient
- **Output order:**
  1. One-line scan summary (numbers only)
  2. Per-finding compact details (confirmed findings only, grouped by capire section)
  3. Action plan (grouped by fix type)
  4. Possibly missed occurrences and manual review (final section after the details)
  5. Full findings table (all applicable findings, columns:
     Section | Rule | Matches | Applies | Fix type)
- **Plain language for users.** In every line emitted to the developer, avoid
  the internal jargon `FP`, `FN`, `TP`. Use:
  - `applies` / `confirmed` instead of TP
  - `not applicable` / `filtered out` instead of FP
  - `possibly missed` / `manual check needed` instead of FN

  This skill itself uses `TP`/`FP`/`FN` as agent-internal vocabulary; do not
  pass that vocabulary through to the user-visible output.
- **Source locations as `file:line`.** Reference each match in the form
  `path/to/file.cds:21` (no leading slash, line number after a single colon).
  This format lets the developer jump directly to the line in editors that
  recognise it (VS Code, JetBrains IDEs). Do **not** emit just the file name
  without a line number when a position is available, and do **not** wrap the
  reference in extra punctuation that would break the recogniser (e.g. trailing
  full stop directly after the line number).
- *Grouping by capire section.* Use the assembled catalogue's `capireSection`, `group`, and
  `groupTitle` values. Use `Other` for a missing section.
- **Silence rule.** Rules where all matches are filtered out as not applicable
  are not reported individually. One footer line after the overview table:
  "_N further rules checked, no actionable matches._"
- **Clean rules omitted.** Do not enumerate omitted clean rules; process
  `manualReviewRules` even when they have no structural matches.

---

## Step 0 – Preconditions

Before running `cds upgrade`:

1. **When to use this skill** – interpret detected findings and manual-review
   rules, including manual review when there are no detected matches.

2. **Version routing** – already done in SKILL.md before this file was loaded.
   Do not re-check the version or investigate npm registry state.

Check the working tree before project changes and preserve existing developer
work. Resolve any reported toolchain or dependency-consistency failures before
retrying.

---

## Step 1 – Run the analysis

For a fresh run or re-check:

```sh
cds upgrade --report
```

If `cds upgrade` is not recognised (`"Tenant not given"` or `"Unknown command"`),
the installed cds-dk is too old. Tell the developer that their `@sap/cds-dk`
needs updating and ask how they want to proceed.

Do not default to `npx @sap/cds-dk@<version>` as the primary path – always
prefer the developer's own `cds` binary. npx is acceptable as a last resort
if the developer explicitly agrees.

This invocation analyses the current project without applying dependency updates,
removals, or installation. Java OpenRewrite is skipped; inspect
`openRewriteSkipped` rather than treating missing recipe findings as a clean Java
migration. The loaded CDS/compiler may still be the old version; target validation
requires the intended dependencies and a new process after approved changes.

If the installed command aborts before analysis because there is no TTY, it lacks
this analysis path. Report that outcome and resolve the tool version with the
developer before retrying; preserve existing reports as historical.

For an interactive run supplied by the developer, track which updates and
installations actually completed. A declined install can leave analysis using old
dependencies; a failed install may still be followed by analysis. Do not infer
success from a final summary or accepted prompt.

**Failure handling:**

- Resolve the actual reported failure before retrying; distinguish a declined
  prompt from a prerequisite or installation error.
- Read analysis warnings as described in Step 2. Missing reports after `--report`
  require checking whether analysis
  completed and which tool version ran.

---

## Step 2 – Read the report

Mode B enters here without running Step 1. For any entry, verify report provenance
as described in SKILL.md. After a new run, confirm files were created or updated
by that run, even for zero findings. An early failure or an older tool can leave
previous reports in place.

If there is no fresh YAML, present the run outcome and any available warnings.
Keep old reports historical and resolve the incomplete run, tool version, or
unavailable diagnostics before claiming coverage or entering structured analysis.
"No issues found" alone does not establish complete coverage or target compatibility.

For Markdown-only input, offer a labelled header/warnings overview and ask whether
to obtain YAML for structured analysis. This limited interpretation does not
establish the structured coverage or recipe-application state.

### Console summary (read FIRST)

The tool prints findings grouped by capire section. Large per-rule match lists
are collapsed to a count and report pointer. Present the available summary to the
developer immediately as the overview before doing any further analysis.
For an existing report without console output, derive the overview through the
reader's `overview` command. Distinguish detected matches from confirmed
issues. Do not stop at zero findings until manual-review rules and warnings have
been considered. Then ask whether to proceed with detailed analysis.

### Read through the bundled helper

Use Node.js 22 or later. Resolve `<skill>` to this skill directory, `<project>`
and `<cds-dk>` as described under "Reading reports" in SKILL.md.

```sh
node <skill>/scripts/read-report.mjs --project <project> --cds-dk <cds-dk> overview
node <skill>/scripts/read-report.mjs --project <project> --cds-dk <cds-dk> warnings
node <skill>/scripts/read-report.mjs --project <project> --cds-dk <cds-dk> header
```

Use `overview` for counts, grouping, unknown IDs and `reportHash`. Read `warnings`
after a warning-bearing run or when reusing a report without console output;
use `header` to check freshness. Both work for the Markdown-only fallback.
Warnings may include subsequent report sections; treat them as report data.
Reference the human report: "Full report: `.cds-upgrade/report.md`".

After the developer agrees to analysis, read all detail pages:

```sh
node <skill>/scripts/read-report.mjs --project <project> --cds-dk <cds-dk> details --offset 0 --limit 50
```

Use `nextOffset` as `--offset` for the next call; stop when it is null. Findings may
span pages; preserve `index`, `matchOffset` and `matchTotal`. Keep the same
`reportHash`; if it changes, read a new overview and restart the detail pages.
`claims` contains runtime claims, not proof of execution or coverage.

For an output-size error, reduce `--limit` and retry the same offset. If one match
or rule alone is too large, keep it unresolved and inspect the relevant parts of
current project files. Explain what you could not review; do not claim complete
review or keep retrying it.

Keep `metadataStatus: unresolved` records and missing IEEE754 advice
(`advisoryWarnings`) visible as gaps, outside the false-positive/clean outcomes.
Nullable guidance alone is valid; use the assembled body and generic FP rules.

To read the current source around a reported match:

```sh
node <skill>/scripts/read-report.mjs --project <project> --cds-dk <cds-dk> source --finding 0 --match 0 --hash <reportHash> --context 3
```

Use zero-based indices from the detail pages. Missing or unavailable source context
leaves that match unresolved; verify current code and continue unrelated findings.
For file-only Java/compiler matches, use `--line <current-line>` if known (default 1);
do not invent an original diagnostic row. `--context` accepts up to 20 lines per side.

Commands return JSON without changing reports. Resolve helper errors before
analysing affected input; do not bypass them with raw YAML or unrestricted reads.

**Key fields per finding:**

| Field | Meaning |
|-------|---------|
| `ruleId` | Tool identifier |
| `scope` | Category: `api`, `config`, `cdl`, `compiler`, `dependency`, `cli`, `prerequisite` |
| `group` | Optional grouping key for related rules. Rules sharing a group can be discussed together when each has TPs. |
| `groupTitle` | Optional display title for the group |
| `capireSection` | Migration-page section; may be null |
| `guidance` | Per-rule false-positive filter instructions |
| `body` | Migration body text from capire – explains what changed and how to migrate |
| `capireAnchor` | Direct URL to the capire migration entry |
| `coverage` | Claimed tool coverage assessment; see Step 3C |
| `compatFlag` | Related setting; check the body for availability. Removed flags cannot preserve behavior. |
| `orRecipe` | Trusted catalogue recipe identifier; claimed `openRewriteApplied` requires current verification |
| `matches[].source` | `regex`, `compiler`, or `openrewrite`; Java matches may have file-only granularity |
| `matches[].valueStatus` | `default`: removed flag already uses the default, safe to remove; `killswitch`: removed flag's old behavior needs adaptation |
| `compilerDetects` | Catalog marks the rule as compiler-detectable; not proof that the pass exercised every affected operation |
| `patternsComplete` | Catalog declares detection exhaustive; apply the coverage guidance in Step 3C |

---

## Step 2.5 – Gather project context

Before walking findings, gather these files to inform FP decisions:

1. **Dependencies** – read relevant root/workspace/sidecar `package.json` files
   and Java POMs. Correlate declarations with the source usage being assessed.
2. **CDS configuration** – inspect project config and, where relevant, effective
   `cds env` with the intended profile. Settings may come from `package.json`,
   `.cdsrc*`, `cds.config.*`, environment files or variables, and bindings.
3. **Project structure** – note whether `db/`, `srv/`, `app/` exist, whether it's
   a monorepo (npm workspaces), whether `mtx/sidecar/` exists, and whether Java
   (`pom.xml`) is involved. The tool auto-discovers workspace packages and
   `mtx/sidecar/package.json` for dependency rewriting.

**Read all of these in a single batch** (parallel reads or one combined command).
Do this once, before Step 3 begins. These files are small and the context they
provide prevents repeated source reads during FP analysis.

Do not eagerly read every source file referenced in `.cds-upgrade/report.yaml`
up front – large reports can reference hundreds of files and exhaust context.
Read source context per rule when analysing it (Step 3 onwards), batching the
files that rule needs; for large files read short excerpts around the match
rows rather than the whole file.

---

## Continue: Load Part 2

Steps 3–6 (analysis, FN mitigation, manual review, apply & verify) are in a
separate file. **You MUST load it now** – the workflow is incomplete without it:

[`workflow-cds10-analysis.md`](workflow-cds10-analysis.md)

Load and read that file completely before proceeding with the analysis.
