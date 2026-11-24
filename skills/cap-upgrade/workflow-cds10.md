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
- **Grouping by capire section.** Use the report's `capireSection`, `group`, and
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

For Markdown-only input, offer a labelled human-guidance overview and ask whether
to obtain YAML for structured analysis. This limited interpretation does not
establish the structured coverage or recipe-application state.

### Console summary (read FIRST)

The tool prints findings grouped by capire section. Large per-rule match lists
are collapsed to a count and report pointer. Present the available summary to the
developer immediately as the overview before doing any further analysis.
For an existing report without console output, derive the overview from YAML's
finding counts and manual-review list. Distinguish detected matches from confirmed
issues. Do not stop at zero findings until manual-review rules and warnings have
been considered. Then ask whether to proceed with detailed analysis.

### `.cds-upgrade/report.md` (human-readable detail)

The report contains a Table of Contents, Summary tables grouped by capire
section, and Details with per-finding body and match locations. YAML remains the
primary analysis source. Read the Markdown generation header to establish freshness
when needed. If a fresh run reports warnings, read only its `Analysis Warnings`
section; without warnings, no additional Markdown read is needed. When reusing
reports without the original console output, search for that section and read it
if present. Read the full report only for Markdown-only guidance. Reference it
in your output: "Full report: `.cds-upgrade/report.md`"

### `.cds-upgrade/report.yaml` (full detail – read for analysis)

Contains reported rule matches with file paths, positions, matched text, per-rule
guidance, compat flags, and coverage signals. Read this file in
full after emitting the overview.

**Primary path:** Read `.cds-upgrade/report.yaml` directly. With recent cds-dk versions
the file is lean (no surrounding-lines context) and fits comfortably in one
read operation.

**Fallback (large file):** If the file exceeds the tool's single-read limit,
read it in sections using offset/limit parameters.

Read individual source files directly when you need surrounding code
context for FP decisions (which is more precise than pre-extracted snippets
anyway).

Representative schema (fields may be null; counts are illustrative):

```yaml
version: "1.0"
project:
  root: /path
  languages: [js]
rulesScanned: 54
compilerRan: true
findings:
  - ruleId: example-rule-id
    title: Example Rule Title
    scope: [config]
    group: null
    groupTitle: null
    capireSection: Changes to Runtime
    guidance: "Rule-specific FP filter instructions..."
    body: "Migration body text from capire..."
    capireAnchor: null
    compilerDetects: false
    patternsComplete: false
    coverage: incomplete
    compatFlag: features.example_flag
    orRecipe: null
    matches:
      - file: srv/handler.js
        position: { row: 42, col: 0 }
        matchedText: "the matched source text"
        source: regex
        valueStatus: null
manualReviewRules:
  - ruleId: semantic-only-rule
    title: Rule Requiring Manual Review
    body: "Details about what to check..."
```

Optional top-level Java fields: `openRewriteApplied` (successful recipe IDs),
`openRewriteSkipped` (true), `openRewriteFailed` (error text). A failure can occur
during checking or application.

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
| `coverage` | Tool coverage assessment from catalog metadata and compiler execution; see Step 3C |
| `compatFlag` | Related setting; check the body for availability. Removed flags cannot preserve behavior. |
| `orRecipe` | Java recipe identifier; check `openRewriteApplied` before describing it as applied |
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
files that rule needs; for large files read bounded snippets around the match
rows rather than the whole file.

---

## Continue: Load Part 2

Steps 3–6 (analysis, FN mitigation, manual review, apply & verify) are in a
separate file. **You MUST load it now** – the workflow is incomplete without it:

[`workflow-cds10-analysis.md`](workflow-cds10-analysis.md)

Load and read that file completely before proceeding with the analysis.
