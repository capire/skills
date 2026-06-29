# CDS 10 Upgrade Workflow (Modes A / B / C)

This file contains the full workflow for upgrading to CDS 10 using `cds upgrade`.
It is loaded by the skill router in SKILL.md after mode detection.

---

## Output behavior

These directives govern execution flow and output UX:

- **Run to completion.** Execute all steps without pausing for confirmation
  between them. Never ask "shall I continue with Step N?" – just continue.
- **No internal step numbers.** Use descriptive headings in output, not
  "Step 1", "Step 2". Numbered steps in this file are internal agent structure.
- **Summary first.** Immediately after reading `UPGRADE_OVERVIEW.md`, emit a
  single-line summary of the scan numbers before beginning any analysis:
  > "N rules scanned, M with matches (X 🔴 high, Y 🟠 medium, Z 🟡 low). Analysing now."
  No table at this point. Output order:
  1. One-line scan summary (numbers only)
  2. Per-finding details (only for rules with confirmed matches that apply), in severity order
  3. Action plan (grouped by fix type)
  4. Possibly missed occurrences and manual review (final section after the details)
  5. Full findings table (all applicable findings, columns: Severity | Rule | Matches | Applies | Fix type)
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
- **Severity symbols in overview:** 🔴 high, 🟠 medium, 🟡 low, ⚪ pending.
- **Silence rule.** Rules where all matches are filtered out as not applicable
  are not reported individually. One footer line after the overview table:
  "_N further rules checked, no actionable matches._"
- **Clean rules omitted.** Rules with 0 raw matches (not in findings at all)
  are never mentioned.

---

## Step 0 – Preconditions

Before running `cds upgrade`:

1. **When to use this skill** – this skill adds value when `cds upgrade`
   reports findings that need interpretation. If it reports zero findings,
   the skill's work is done. For simple version bumps without breaking-change
   analysis, `cds upgrade` (and this skill) are unnecessary.

2. **Tool availability** – `cds upgrade` requires a cds-dk version that
   includes the command. If `cds upgrade` is not recognised, install or
   invoke via npx:
   ```sh
   npx @sap/cds-dk@latest upgrade
   ```

3. **Target version availability** – check whether CDS 10 is published on npm:
   ```sh
   npm view @sap/cds@10 version 2>/dev/null
   ```
   - **Exit 0 + version string** → target is available. Proceed with `--fix`.
   - **Exit non-zero or empty** → target is not yet published. `--fix` would
     fail at `npm install`. **Run without `--fix`** (scan-only mode). Note in
     output: "Target CDS 10 not yet published – running in scan-only mode.
     Re-run with `--fix` once the release is available."

The tool itself validates git working-tree status, project structure, and
runtime prerequisites at startup – no need to pre-check these manually.

---

## Step 1 – Run `cds upgrade --fix`

**Execute immediately.** Do not search for the command, check documentation, or
verify installation first. Run `cds upgrade` directly. If it fails with
"unknown command", fall back to `npx @sap/cds-dk@latest upgrade`.

A locally linked cds-dk (e.g. via `npm link`) that includes the `upgrade` command
is perfectly valid — do not switch to npx if `cds upgrade` already works.

**Which flags to use depends on Step 0:**

- **Target available** → run with `--fix` (full upgrade + scan):
  ```sh
  cds upgrade --fix
  ```
  If using npx: `npx @sap/cds-dk@latest upgrade --fix`

- **Target not yet published** → run without `--fix` (scan-only):
  ```sh
  cds upgrade
  ```
  If using npx: `npx @sap/cds-dk@latest upgrade`
  
  In scan-only mode the tool performs pattern detection against current sources
  but does not upgrade dependencies. Findings with `compilerDetects: true`
  remain unconfirmed (compiler did not run on target version). Note this
  limitation when walking findings in Step 3.

**Why `--fix`?** This performs the complete upgrade in one pass: updates
dependencies to CDS 10, runs `npm install`, rebuilds with the new CDS compiler,
sets compat flags, and then scans for remaining migration items. The project is
in git — all changes are reversible via `git checkout .`. Without `--fix`, the
compiler-based detection is incomplete (`compilerDetects` findings stay
unconfirmed).

**What the tool does depends on the flag:**

| Flag | What it does | What it produces |
|------|--------------|-----------------|
| `--fix` | Upgrades dependencies, installs, rebuilds with CDS 10 compiler, scans, sets compat flags. Full detection. | `findings.json` + `UPGRADE_REPORT.md` + `UPGRADE_OVERVIEW.md` |
| *(none)* | Pattern scan only. No dependency changes, no compiler validation. Incomplete detection. | `findings.json` + `UPGRADE_REPORT.md` + `UPGRADE_OVERVIEW.md` |
| `--dry` | Same as no-flag but writes nothing to disk. All output to stdout. | stdout only |

**Failure handling:**

- Preflight failure (dirty git, wrong Node version): tool aborts with clear message. Fix the precondition and retry.
- Build failure during `--fix`: check `## Node.js Build Output` / `## Java Build Output` in the report. Incompatibilities in the code cause build failures – these are findings, not tool bugs.

---

## Step 2 – Read the report

After `cds upgrade` completes, three output files exist:

### `UPGRADE_OVERVIEW.md` (read first – emit directly)

Read this file and emit its content to the user immediately. It contains
project metadata, scan numbers (rules evaluated, severity breakdown, scopes
affected), quick wins (compat flags auto-fixable with `--fix`), and blocking
issues. Gives the developer an instant picture before any analysis begins.

Then emit the one-line scan summary from the Output behavior directive above.

**Fallback:** If `UPGRADE_OVERVIEW.md` does not exist (older cds-dk version),
derive the numbers from `findings.json` instead.

### `findings.json` (full detail – read in Step 3)

Contains all rule matches with file paths, positions, matched text, per-rule
guidance, severity, compat flags, and coverage signals. Read this file in
full after emitting the overview.

**Primary path:** Read `findings.json` directly. With recent cds-dk versions
the file is lean (no surrounding-lines context) and fits comfortably in one
read operation.

**Fallback (large file):** If the file exceeds the tool's single-read limit,
extract a compact representation using the bundled helper script:

```sh
node <skill-dir>/slim-findings.js ./findings.json
```

This strips `surroundingLines` and non-essential fields, keeping rule metadata,
guidance, and match positions. The output is small enough to read in one pass.

Then read individual source files directly when you need surrounding code
context for FP decisions (which is more precise than pre-extracted snippets
anyway).

Full schema:

```json
{
  "version": "1.0",
  "project": { "root": "/path", "languages": ["js"] },
  "rulesScanned": 54,
  "compilerRan": false,
  "dryRun": false,
  "findings": [
    {
      "ruleId": "example-rule-id",
      "title": "Example Rule Title",
      "scope": ["config"],
      "group": null,
      "guidance": "Rule-specific FP filter instructions...",
      "compilerDetects": false,
      "patternsComplete": false,
      "severity": "medium",
      "compatFlag": "features.example_flag",
      "orRecipe": null,
      "coverage": "incomplete",
      "matches": [
        {
          "file": "srv/handler.js",
          "position": { "row": 42, "col": 0 },
          "matchedText": "the matched source text",
          "surroundingLines": null,
          "source": "ast-grep"
        }
      ]
    }
  ],
  "manualReviewRules": [
    { "ruleId": "semantic-only-rule", "title": "Semantic-Only Rule Title" }
  ]
}
```

### `UPGRADE_REPORT.md` (human-readable)

Section order:

1. `## Preflight Checks` – project type, cds version, git status
2. `## Validation Checks` – baseline build/test results (if `--fix`)
3. `## Preparation Step` – 9.x update details (if `--fix`)
4. `## Migration Step` – target-version dependency bump (if `--fix`)
5. `## Node.js Build Output` / `## Java Build Output` – compiler output post-upgrade
6. `## Code Analysis` – **primary section**: detected migration items grouped by scope
7. `## Manual Review Recommended` – rules without structural matches
8. `## Analysis Warnings` – tool-level issues (timeouts, missing files)

**Key fields per finding:**

| Field | Meaning |
|-------|---------|
| `ruleId` | Unique identifier, maps to capire migration entry |
| `scope` | Category: `api`, `config`, `cdl`, `compiler`, `dependency`, `cli`, `prerequisite` |
| `group` | Optional grouping key for related rules. Rules sharing a group can be discussed together when each has TPs. |
| `guidance` | Per-rule false-positive filter instructions |
| `coverage` | `complete` (all occurrences found), `incomplete` (more may exist), `clean` (none found), `unknown` (structural detection not possible) |
| `severity` | `high`, `medium`, or `low`. Use to prioritise findings – address high-severity items first. |
| `compatFlag` | If set, a compat flag exists that defers this change. See Step F. |
| `orRecipe` | If set, an OpenRewrite recipe handles detection and fix for this Java rule. Run `mvn rewrite:run` with the named recipe. |
| `matches[].source` | `ast-grep` or `regex` – how the match was found |
| `compilerDetects` | If true, `cds build` on the target version also flags this. With `--fix`, the compiler already ran (`compilerRan: true`) – check `## Node.js Build Output` in the report for confirmation. If `compilerRan: false` (Mode B), note as pending and suggest `cds build`. |
| `patternsComplete` | If true, the pattern scan covers all possible occurrences |

---

## Step 2.5 – Gather project context

Before walking findings, gather these files to inform FP decisions:

1. **`package.json`** – read `dependencies` and `devDependencies` to know which
   packages are actually used (e.g. if `axios` is not a direct dependency, the
   `axios-replaced-by-fetch` rule is likely an FP from transitive usage)
2. **CDS configuration** – read `.cdsrc.json` or the `cds` block in `package.json`
   to know which compat flags are already set and what config the project uses
3. **Project structure** – note whether `db/`, `srv/`, `app/` exist, whether it's
   a monorepo, and whether Java (`pom.xml`) is involved

Do this once, before Step 3 begins. These files are small and the context they
provide prevents repeated source reads during FP analysis.

---

## Step 3 – Walk findings (Code Analysis)

Process findings in the same order the report groups them:

1. **API** – runtime API changes in JS/TS handlers
2. **Configuration** – cds env settings, compat flags, config files
3. **CDL / Language** – CDS model syntax changes
4. **Compiler** – CDS compiler behavior changes
5. **Dependency** – packages to add/remove/replace
6. **CLI** – command-line interface changes
7. **Prerequisites** – Node.js version, required global tools

Rules with multiple scopes (e.g. `["api", "config"]`) appear once in the report,
under the first scope in their array. Treat each multi-scope finding from both
angles in the assessment – check API usage AND config provenance for an
`["api", "config"]` rule – but only describe and fix it once.

### For each finding:

**A. Apply guidance (false-positive filter)**

Read the `guidance` field. It contains rule-specific FP instructions. Additionally,
apply these generic FP rules to every match:

- **Comment match** – if the matched text is inside a code comment (`//`, `/* */`,
  `--` in CDL), it is not a true positive. Skip.
- **String literal** – if the matched text is inside a string literal (log message,
  error text, documentation string), it is likely not a true positive unless the
  string is used as a dynamic property accessor.
- **CDL annotation values** – in `.cds` files, quoted values inside annotations
  (e.g. `'Edm.Decimal'` in `@Aggregation.CustomAggregate`) are metadata strings,
  not type declarations. A regex match inside a quoted annotation value is an FP.
- **Annotation name/path** – if the matched keyword appears as part of an
  annotation name (e.g. `@Aggregation.default` matching `default`), it is not a
  CDL keyword usage. FP.
- **Test fixture** – matches in test files that set up mock data are usually not
  actionable migration items (the mock mirrors production code that is the real target).
- **Compat-flag provenance** – if a config match shows a compat flag being explicitly
  set to its new default value (e.g. `ieee754compatible: true` when the new version makes it
  the default), this is a no-op, not a finding.

**B. Outcome after FP filter**

After applying the FP filter to all matches in a finding, exactly one of three outcomes
holds:

- **All matches filtered (0 TPs).** Do not report this rule individually.
  Increment the silent-rules counter for the footer line (see Output behavior).
  Steps C–F do not apply. Move on.
- **Some matches survive (mix of TPs and FPs).** Continue to step C for the surviving TPs.
  Skip the FPs without ceremony.
- **All matches survive (no FPs).** Continue to step C for all.

Caveats in `guidance` (e.g. "requires integration testing") apply only to surviving TPs.
For an all-FP finding, ignore them.

When two rules report a match on the same `file:line`, apply FP filtering independently
per rule but note the overlap. If both surface as TPs, explain them together as related
findings rather than as two unrelated items.

**C. Read the coverage signal**

`coverage` describes what the *pattern* found, not how many matches are TPs:

- `coverage: "complete"` – the pattern is exhaustive: every textual occurrence in
  scanned files is in `matches`. A high FP rate is still possible if the pattern is
  intentionally broad (e.g. matching every `annotate` statement). The `guidance`
  field explains how to filter.
- `coverage: "incomplete"` – structural patterns found hits, but additional
  occurrences may exist. **Action:** After filtering FPs, run a targeted search
  for the construct yourself (grep the codebase for related keywords).
  Report any additional occurrences found. Mention in your output:
  "Coverage is incomplete – searched for additional occurrences: [found N more / none found]."
- `coverage: "unknown"` – no structural detection possible. This rule appears in
  `manualReviewRules` instead. See Step 5.

**D. Explain and link**

For each confirmed (non-FP) finding:
- Show the rule-id in a sub-heading: `### rule-title (`rule-id`)`
- Explain what changed and why it matters (use the rule title and guidance)
- Provide the migration fix (from the rule's documentation)
- Link to the capire migration entry:
  `https://cap.cloud.sap/docs/releases/migration#{ruleId}`
- If the guidance indicates the API is *deprecated but not removed* in this version,
  lower the urgency: "This is a deprecation warning — the old API still works but will
  be removed in a future version. Plan to migrate but no immediate breakage."

**E. Categorise fix type**

| Fix type | Who applies | How |
|----------|-------------|-----|
| **Deterministic (config)** | `cds upgrade --fix` | Compat-flag setting in package.json / .cdsrc.json. Already applied if `--fix` was used. |
| **Deterministic (code)** | `cds upgrade --fix` | AST-based code transform via ast-grep fix rules. Only some rules have auto-fixes – consult the rule's migration documentation to determine availability. |
| **OpenRewrite (Java)** | `mvn rewrite:run` | Java API removals and renames. The finding's guidance names the specific OR recipe. Run it; it handles detection AND fix in one pass. Spring Boot 3→4 requires separate OR recipes not bundled with CAP. |
| **Manual (simple)** | Developer with agent guidance | One-line replacements, import path changes, config key renames. Provide exact code diff. |
| **Manual (complex)** | Developer with agent guidance | Multi-statement refactoring, behavioral adaptation, architectural changes. Explain approach, show before/after examples. |

Note: `source: "ast-grep"` in a match means the finding was *detected* by ast-grep.
It does not imply an auto-fix exists. Detection method and fix availability are independent.

**F. Progressive migration (compat flags)**

For rules with a `compatFlag` field, the developer can choose to set the flag
(preserving old behavior) rather than adapting code immediately. If they do:

1. The compat flag keeps the old behavior temporarily
2. To fully migrate: adapt the code to the new behavior, then remove the flag
3. Compat flags may be removed in future CDS versions – they are not permanent

**Default recommendation:** When presenting fix options, always recommend one.
Prefer the progressive option (adopt new behavior) unless:
- The code change is complex (multi-file refactoring, architectural change)
- The project has no test coverage for the affected area
- The change has runtime-observable effects on consumers (API contract change)

In those cases, recommend the conservative option (compat flag) with a note:
"Recommended for now – schedule migration when test coverage is in place."

### Worked example

Finding: `decimal-sqlite-type-mapping-changed`, scope `[config, cdl]`, 8 matches,
`coverage: "incomplete"`.

Matches:

```
app/travel_analytics/annotations.cds:4  Decimal
db/master-data.cds:27  Decimal
db/schema.cds:17  Decimal
... 5 more ...
```

**A. FP filter:**
- Generic CDL annotation rule – the `app/travel_analytics/annotations.cds:4` match
  is inside a string literal `'Edm.Decimal'` in an `@Aggregation.CustomAggregate`
  annotation. Not a CDL type declaration. **FP.**
- Remaining 7 matches are genuine `Decimal(16,3)` element declarations.

**B. Outcome:** mix – 7 TPs survive, 1 FP dropped.

**C. Coverage:** `incomplete` – after filtering, check if there are additional
`Decimal` declarations the regex might have missed (e.g. multiline definitions,
typedefs). Spot-check.

**D. Explain:** "On SQLite, `Decimal` columns now map to REAL affinity (IEEE 754 float)
instead of NUMERIC. Production HANA is unaffected, but development/test on SQLite
will see different behavior for non-integer arithmetic. See:
https://cap.cloud.sap/docs/releases/migration#decimal-sqlite-type-mapping-changed"

**E. Fix type:** Deterministic (config). The `--fix` flag would set
`cds.sql.decimal_affinity: 'NUMERIC'` to preserve old behavior. Alternative: accept
new behavior and update test assertions that compare exact decimal values.

**F. Progressive:** if the compat setting is applied, schedule removing it once
test assertions are adapted to REAL affinity.

---

## Step 4 – Search for missed occurrences (FN mitigation)

**This step is executed by you (the agent), not delegated to the developer.**
The tool's pattern scan has known blind spots. After processing all reported
findings, actively search for additional occurrences that patterns may have missed.
Report your findings inline – what you searched for, what you found (or didn't).

### For rules with `coverage: "incomplete"` that had TPs:

The pattern found *some* occurrences but not necessarily all. After filtering FPs
in Step 3, search the surrounding codebase for additional instances of the same
construct — particularly:

- Indirect variable references (`const x = api.method; x(...)`)
- Multiline CDL constructs the regex could not span
- CDL annotation forms 2 and 3 — annotations can be written as:
  1. `@anno` before the element (Form 1, detected by `patternCdl`)
  2. `annotate X with @anno` in a separate statement (Form 2)
  3. Inline `@(anno1, anno2)` syntax (Form 3)
  The tool's CDL regex only reliably matches Form 1. For rules affecting
  annotations, search for Forms 2 and 3 manually.
- Dynamic property access (`obj[varName]` where `varName` resolves to the affected key)

### Compiler validation:

With `--fix`, the CDS 10 compiler ran during the upgrade (`compilerRan: true`).
For findings with `compilerDetects: true`, check the `## Node.js Build Output`
section in `UPGRADE_REPORT.md` — compiler errors there definitively confirm
the finding. If the build passed without errors for a `compilerDetects: true`
rule, the project is clean for that rule (no TP despite pattern matches).

If `compilerRan: false` (Mode B – existing report from a no-flag run), the
compiler has not confirmed or denied these issues. Run `cds build` after
applying fixes to get definitive diagnostics.

### Behavioral changes without structural signal:

Some rules describe behavioral changes where the affected *construct* exists broadly
but the *breaking impact* depends on usage context (e.g. Decimal serialisation, error
code changes). For these, the tool reports the construct locations but cannot confirm
breakage. Actively verify: does the project rely on the old behavior? Check test
assertions, downstream consumers, and documented API contracts.

---

## Step 5 – Manual Review (semantic findings)

Rules in `manualReviewRules` have `coverage: "unknown"` – no structural pattern
can detect them reliably. These require semantic understanding of the codebase.

### Step 5a – Quick check on every rule

Perform a targeted search for each manual-review rule. The goal is presence/absence,
not deep analysis. For each rule:

1. Read the rule title and identify the construct it checks (API, CDL keyword,
   config setting, dependency).
2. Run one targeted search using grep/glob for that construct across the project.
3. Record one of three outcomes:
   - **not present** – search returned no relevant matches; cite the search terms used
   - **present, look unaffected** – matches exist but context suggests no breakage
     (e.g. test code, comments) – cite location(s)
   - **present, may be affected** – matches in production code; needs deeper look –
     cite location(s)

**Never skip the search.** "Unlikely to apply" without a search is not a valid outcome.

### Step 5b – Present results and ask

Present the quick-check results as a compact list, grouped by outcome:

```
Manual-review quick check (N rules):

May be affected (M):
  - rule-id-1: <one line, location>
  - rule-id-2: <one line, location>

Present, look unaffected (K):
  - rule-id-3: <one line, location>

Not present (P):
  - rule-id-4, rule-id-5, … (search terms: …)
```

Then ask:

> "Which of these should I investigate in depth?
> (a)ll / specific ids / (o)nly the 'may be affected' group / (n)one"

### Step 5c – Deep investigation on user-selected rules

For each rule the user selected:

- Read CDS models for entity/type definitions related to the rule
- Read service handlers for affected API patterns
- Check configuration files for relevant settings
- Correlate findings across files
- Report as a proper finding with full context, or as clean with reasoning

**Example:** A rule about Decimal default-serialisation changes would require
searching for `Decimal` or `Double` types in `.cds` models and checking whether
the application relies on the serialisation format.

---

## Step 6 – Apply and verify

Since `--fix` was used in Step 1, the dependency upgrade, `npm install`, and
compat-flag settings are already done. What remains:

1. **Manual code fixes** from Step 3 findings (CDL changes, dependency additions,
   code refactoring)
2. **Semantic fixes** from Step 5
3. **Compat-flag review** (see below)
4. **Verify:**
   ```sh
   cds build
   npm test
   ```

### Compat-flag review

`--fix` sets compat flags that preserve old behavior (listed in Quick Wins).
After the manual fixes are applied, ask the developer:

> "The following compat flags were set to preserve old behavior. For each one,
> would you like to keep it (conservative – no further code changes needed) or
> remove it and adopt the new behavior (progressive – may require adapting tests
> or handler code)?"

Present each flag with a one-line explanation of what changes when removed.
For flags the developer wants to remove: identify and apply the necessary code
adaptations, then delete the flag from configuration.

### Execution offer

After completing the analysis, **always** offer to apply the identified code fixes
directly. Do not end with a passive table listing "fix type: manual" – that tells the
developer what needs doing without offering help. Instead:

1. Present a numbered list of all actionable fixes (from Steps 3–5) grouped by effort:
   - "Ready to apply" – deterministic or simple one-line changes you can do now
   - "Guided refactoring" – complex changes where you walk the developer through each step
2. Ask: "Which of these should I apply? (all / selection / none)"
3. For each chosen fix, apply the edit and show the resulting change.
4. Do not wait for per-fix permission once the selection is made.

### Mode B fallback (existing report without `--fix`)

If entering via Mode B (existing `findings.json` from a no-flag run), the
dependency upgrade has not happened. After analysis, suggest running
`cds upgrade --fix` to complete the upgrade, or offer to apply compat flags
and manual fixes directly if the developer prefers incremental control.

---

## Limitations

- **Indirect references** – patterns detect direct usage only. If a deprecated API
  is wrapped in a utility function, only the wrapper location is found, not all callers.
- **Multiline CDL** – CDL regex patterns may miss constructs split across many lines.
  When `coverage: "incomplete"`, check surrounding context.
- **Transitive dependencies** – third-party libraries using deprecated CAP APIs are
  not scanned. Check `node_modules` manually if a library wraps CAP services.
- **Consumer-side impact** – if the project is consumed by other projects (reuse model),
  API changes may affect downstream consumers. The tool only scans the current project.
- **Java projects** – Java API migration is handled via OpenRewrite recipes
  (`mvn rewrite:run`), not by `cds upgrade` pattern scan. The tool detects the need
  and suggests the appropriate recipe. Spring Boot 3 to 4 migration requires separate
  OR recipes not bundled with CAP.

---

## Future versions

The same workflow applies to future CDS versions. The `cds upgrade` CLI
updates its rule set with each cds-dk release. Re-run `cds upgrade` after updating
cds-dk to get new migration rules.

