# CDS 10 Upgrade Workflow – Analysis & Fixes (Steps 3–6)

This file continues the CDS 10 workflow from `workflow-cds10.md`. Load it after
completing Step 2.5; Mode B skips Steps 0 and 1. Read it before starting analysis.

---

## Output rule: always cite exact locations

For tool findings, use the exact location from `.cds-upgrade/report.yaml` matches.
For manually discovered or additional findings, use independently verified source
locations and identify them as additional checks. Format: `path/to/file.ts:42` when a line is
available, otherwise the file path alone. For a recipe-level finding without any
supplied file, state "no location supplied" and do not invent a path.

**Never** write vague references like "1 match in file.ts" or "found in
some-service.ts". Use `srv/some-service.ts:42` (with line number) whenever
`matches[].position.row` is present.

When a finding has multiple matches, list each location explicitly (up to 5
inline, then "and N more in file-x.ts, file-y.cds"). Use `matches[].position.row`
for the line whenever it is present. OpenRewrite matches may lack a row
(file-only granularity) – cite the file path alone and do not fabricate a line.

This rule applies to every step below without exception.

---

## Step 3 – Walk findings (Code Analysis)

Group findings by `capireSection`, using `Other` for null, and discuss related
`group` values together using `groupTitle` when supplied. `scope` describes the
affected areas, not report placement. Assess every relevant scope of a rule,
but describe and fix the finding once.

### For each finding:

**Efficiency note:** FP verification checks are independent per rule. When
multiple findings need verification (e.g. grep for annotations, check config,
run `cds build`), run these in parallel rather than sequentially. Only
dependencies between checks (rare) require sequential execution.

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
  the default), check the body and `valueStatus` before filtering. For removed
  flags, `valueStatus: default` is actionable cleanup; `killswitch` requires
  adapting code because the old behavior can no longer be enabled. Do not
  discard either as a no-op. For retained flags, an explicit override may
  already have been suppressed by the tool's config-value filtering.

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

- `coverage: "complete"` – catalog metadata or compiler execution caused the tool
  to classify coverage as complete. This is not an independent guarantee that
  every occurrence was found. Regex matches are deduplicated by file/line;
  aliases and dynamic access can escape detection. Use guidance and known
  limitations when deciding whether another check is necessary.
- `coverage: "incomplete"` – structural patterns found hits, but additional
  occurrences may exist. **Action:** After filtering FPs, run a targeted search
  for the construct yourself (grep the codebase for related keywords).
  Report any additional occurrences found. Mention in your output:
  "Coverage is incomplete – searched for additional occurrences: [found N more / none found]."
- `coverage: "unknown"` – no hits and no completeness basis. This includes
  patternless rules and non-exhaustive patterns with zero hits. Such rules
  appear in `manualReviewRules`; see Step 5. `clean` rules are omitted from
  YAML, so omission alone is not proof of absence beyond the tool's coverage.

**D. Explain and link**

For each confirmed (non-FP) finding:
- Show the rule-id in a sub-heading: `### rule-title (`rule-id`)`
- Explain what changed and why it matters (use the rule title and guidance)
- Provide the migration fix (from the rule's documentation)
- Use `capireAnchor` verbatim for the migration link. When null, use the body
  and local report; do not construct a public URL from `ruleId`.
- If the guidance indicates the API is *deprecated but not removed* in this version,
  lower the urgency: "This is a deprecation warning – the old API still works but will
  be removed in a future version. Plan to migrate but no immediate breakage."

**E. Categorise fix type**

| Fix type | Who applies | How |
|----------|-------------|-----|
| **Compat flag (config)** | Developer (or agent) | Only when the body confirms the flag remains supported: set it to preserve old behavior. For removed flags, offer cleanup or code adaptation instead. The tool does not set compat flags automatically. |
| **OpenRewrite (Java)** | Apply (`--fix`), interactive dry-run, or skipped | Use `openRewriteApplied` to identify successfully applied recipes. Matches with `source: openrewrite` describe detected changes, including dry-run results. Check `openRewriteSkipped` and `openRewriteFailed`; failures can leave partially applied changes requiring inspection. |
| **Manual (simple)** | Developer with agent guidance | One-line replacements, import path changes, config key renames. Provide exact code diff. |
| **Manual (complex)** | Developer with agent guidance | Multi-statement refactoring, behavioral adaptation, architectural changes. Explain approach, show before/after examples. |

`source: regex` describes lexical detection, not an available code transform.
`source: openrewrite` alone does not establish successful application, even with
`--fix` or a Markdown label saying "auto-fixed". Recipe IDs must be present in
`openRewriteApplied`; otherwise keep the changes unresolved and inspect any
failure before attempting another application. Treat successfully applied recipes
as applied pending validation, not remaining application choices. Their matches
came from the dry-run before application; re-read current source before using
those coordinates for further edits.

**Config match locations:** The evaluator prefers real file locations (e.g.
`.cdsrc.json:8`) over virtual `<cds env>` references when both exist. This means
config findings typically point to an editable file, not to the merged cds env output.

**F. Progressive migration (compat flags)**

For rules whose body confirms a supported `compatFlag`, the developer can choose to set the flag
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

`decimal-sqlite-type-mapping-changed` currently has scope `[cdl]` and enters
`manualReviewRules`, without structural match locations. Search for Decimal
declarations and check whether SQLite arithmetic or tests rely on NUMERIC affinity.
A quoted annotation value such as `'Edm.Decimal'` is not a type declaration.

The body describes this as a non-breaking change from NUMERIC to REAL affinity;
HANA and PostgreSQL are unaffected. When presenting this item, retain the tool's
warning and add a brief note: "SQLite only; non-breaking. Normally no change is
needed unless SQLite arithmetic or tests rely on the old NUMERIC affinity."
If preserving the old behavior is necessary,
the documented setting is `cds.requires.db.decimal_affinity: 'numeric'`.
Use the manual-review body and local report for guidance; a public anchor is not
included in this record. Cite locations found
by the manual check rather than inventing tool matches.

---

## Step 4 – Search for missed occurrences (FN mitigation)

**This step is executed by you (the agent), not delegated to the developer.**
The tool's pattern scan has known blind spots. After processing all reported
findings, actively search for additional occurrences that patterns may have missed.
Report your findings inline – what you searched for, what you found (or didn't).

**Parallelisation:** Each rule's FN-mitigation search is independent. Run them
as parallel tool calls (one search per rule) when supported by the agent
runtime. Do not combine semantically different patterns into a single command –
each rule targets different file types and constructs.

### For rules with `coverage: "incomplete"` that had TPs:

The pattern found *some* occurrences but not necessarily all. After filtering FPs
in Step 3, search the surrounding codebase for additional instances of the same
construct – particularly:

**Exception – "safe-form" FPs:** If all matches were filtered as FPs because they
use a *safe variant* of the construct (e.g. standard 2-argument `req.reject` form)
but the rule's breaking condition targets a *different variant* (e.g. object-literal
first argument, 4+ positional arguments), still search for the unsafe variant. The
pattern may have found only safe usages while missing unsafe ones elsewhere.

- Indirect variable references (`const x = api.method; x(...)`)
- Multiline CDL constructs the regex could not span
- CDL annotation forms 2 and 3 – annotations can be written as:
  1. `@anno` before the element (Form 1, detected by `patternCdl`)
  2. `annotate X with @anno` in a separate statement (Form 2)
  3. Inline `@(anno1, anno2)` syntax (Form 3)
  The tool's CDL regex only reliably matches Form 1. For rules affecting
  annotations, search for Forms 2 and 3 manually.
- Dynamic property access (`obj[varName]` where `varName` resolves to the affected key)

### Compiler validation:

The analysis phase runs `cds.compile('*')`, independently of `--fix`. The tool
offers installation before analysis in interactive runs, but loads CDS earlier
in the same process.
`compilerRan: true` therefore does not certify use of the target compiler.

Compiler matches come from collected compilation-error diagnostics; successful
compilation does not export its warnings. No matches cannot establish absence
of uses requiring a backend or API call the pass did not exercise, for example
`hdbcds` deployment configuration. Follow the rule body for these checks.

When compiler validation matters, confirm dependencies were installed and run
`cds build` in a fresh process with the intended version/profile. If
`compilerRan: false`, explain that the tool did not validate compiler-dependent
findings; keep surviving pattern matches unconfirmed until checked.

### Behavioral changes without structural signal:

Some rules describe behavioral changes where the affected *construct* exists broadly
but the *breaking impact* depends on usage context (e.g. Decimal serialisation, error
code changes). For these, the tool reports the construct locations but cannot confirm
breakage. Actively verify: does the project rely on the old behavior? Check test
assertions, downstream consumers, and documented API contracts.

---

## Step 5 – Manual Review (semantic findings)

`manualReviewRules` contains rules without a completeness basis and without hits,
including non-exhaustive patterns that found nothing. Each record provides only
`ruleId`, `title`, and `body`; do not assume patterns or guidance are included.
Use the body to establish what requires checking.

### Step 5a – Quick check on every rule

Perform a targeted search for each manual-review rule. The goal is presence/absence,
not deep analysis. **Each rule's search is independent** – run them as parallel
tool calls when supported by the agent runtime.

For each rule:

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

### Establish remaining work (all entry modes)

Use the actual project state and run output, not `--fix` or report existence,
to determine which dependency updates, installations, and Java recipes remain.
For Mode B, inspect declarations and resolved versions when the prior run's
outcome is unavailable. Keep a historical report distinct from current validation.

1. **Dependencies and installation** – after the developer selects changes,
   apply the approved dependency updates and removals, then install across affected
   package roots.
   Complete any declined or failed installation from an earlier interactive run.
   Do not substitute a root-only install for independent sidecar/package installs.
2. **Manual code fixes** from Step 3 findings (CDL changes, dependency additions,
   code refactoring)
3. **Semantic fixes** from Step 5
4. **Compat-flag review** (see below)
5. *Final installation and verification* – after the last approved manifest change,
   install across affected package roots so installed dependencies and lock files
   match the manifests. Repeat installation if a later fix changes a manifest,
   even if an earlier installation succeeded. Then build and test in fresh
   processes with the intended dependencies/profile:
   ```sh
   cds build
   npm test
   ```

### Compat-flag review

For findings whose body confirms a supported `compatFlag`, the developer can choose to set the
flag (preserving old behavior) rather than adapting code immediately. Present
these as options during the fix phase:

> "The following findings have compat flags available. For each one:
> a) set the compat flag (conservative – no code changes needed, old behavior preserved), or
> b) adapt code to the new behavior (progressive – may require modifying
> tests or handler code)?"

For entirely removed flags, offer removal and any required code adaptation,
not a conservative flag-setting option. Present each supported flag with a
one-line explanation of what changes when the new
behavior is adopted. For flags the developer wants to skip (adopt new behavior):
identify and apply the necessary code adaptations.

### Execution offer

After completing the analysis, **always** offer to apply the identified code fixes
directly. Do not end with a passive table listing "fix type: manual" – that tells the
developer what needs doing without offering help. Instead:

1. Present a numbered list of remaining actionable fixes (from Steps 3–5), excluding
   successfully applied recipes, grouped by effort:
   - "Ready to apply" – deterministic or simple one-line changes you can do now
   - "Guided refactoring" – complex changes where you walk the developer through each step
2. Include remaining dependency changes, removals, installation, and Java recipe
   application in the proposed scope. Ask: "Which of these should I apply? (all / selection / none)"
3. For each chosen fix, apply the edit and show the resulting change.
4. Do not wait for per-fix permission once the selection is made.

For approved Java recipe application, run `cds upgrade --report --fix`;
dependency updates, removals, and installation still need their own approved
execution. This applies the tool's collected recipe set, not an arbitrary subset.
If only a subset is approved, keep the remaining Java work pending rather than
applying the full set with `--fix`.
Verify `openRewriteApplied`, `openRewriteSkipped`, and `openRewriteFailed` in the
fresh report, then check target versions, build, and project tests in new processes.

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
  integrated into `cds upgrade`. OR findings appear inline in the report with
  `source: "openrewrite"`. If `mvn` is not found or the recipe artifact is
  unreachable, OR is skipped with a warning. Spring Boot 3→4 migration requires
  separate OR recipes not bundled with CAP.

---

## Future versions

The same workflow applies to future CDS versions. The `cds upgrade` CLI
updates its rule set with each cds-dk release. Re-run `cds upgrade` after updating
cds-dk to get new migration rules.
