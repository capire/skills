# Shared Deep-Update Guidance

## Scope

User-authorized skill fix, 2026-11-20; leave uncommitted for review.
Update only `skills/cap-cql/SKILL.md` and `skills/cap-hcql/SKILL.md`.
No XTravels, framework, installation, staging, commit or push changes.
Existing untracked `PR chain.md` is unrelated and untouched.

Standard composition-update semantics belong in shared guidance, not repeated
application descriptions. App hints should cover business meaning or deviations.
Availability of a skill does not prove a client loads it: consumers must receive
the updated guidance before relying on removal of application-level repetition.

## Changes

- CQL: add deep UPDATE syntax, omitted-composition preservation, supplied-collection
  reconciliation by complete child keys, and the distinction from scalar/targeted
  child updates. Prefer targeted updates for single-child edits.
- HCQL: explain composition PATCH reconciliation, explicit JSON clearing (`[]`
  to-many, `null` to-one), with a link to the shared CQL rules.
- Cross-link the sections; do not conflate HCQL PUT/UPSERT with OData PUT semantics.
- Keep implementation findings here, outside the compact skill bodies.

Reference: [CAP generic deep UPDATE documentation](https://cap.cloud.sap/docs/guides/services/served-ootb#deep-update).

## Validation

Ad hoc integration checks used an isolated generic CAP service with string-keyed
Authors/Books and a to-one Profile, an in-memory SQLite database, and an ephemeral
loopback HTTP listener, closed after testing. No running application data was used.
The CQL and JSON examples were extracted from the edited skill files, not retyped.

**8/8 passed:** exact HCQL collection example; omitted composition during scalar
PATCH; exact CQL deep UPDATE example including key-only child preservation;
creation/deletion reconciliation; targeted child update preserving siblings;
scalar CQL update preserving compositions; JSON `[]` clearing; JSON `null` removal.

Local versions: `@sap/cds` 10.3.0, `@cap.core/ql` 2.5.4,
`@cap-js/sqlite` 3.1.3, `@cap-js/db-service` 3.2.0.
These are local development checkouts, not a cross-version/runtime/database guarantee.
No permanent test harness or additional dependencies were introduced.
`git diff --check`, frontmatter-name/code-fence checks, and the cross-skill
deep-update link check passed. Frontmatter was not changed.

### Context-Window Refinement

User authorized trimming the additions after review. Keep one CQL example and three
rules; remove redundant example narration and the repeated HCQL collection example.
HCQL now retains only its deletion warning, shared-rule link and JSON clearing syntax.
The 8/8 integration results above refer to the pre-trim example snapshot; the remaining
CQL example is unchanged. The REST example was removed, not invalidated. Follow-up
validation checks the remaining example, Markdown structure, links and whitespace.
No staging/commit/push authorized.
Follow-up checks passed: both remaining CQL examples parse with `@cap.core/ql`;
frontmatter names, code fences, cross-skill link and `git diff --check` pass.
Runtime checks were not rerun for this editorial-only trim. Net skill additions:
16 lines in cap-cql, 5 in cap-hcql.

## Findings for Separate Follow-up

1. **CQL empty array syntax:** `UPDATE Authors[101] with { books: [] }`
   is rejected by the tested `@cap.core/ql` parser (expected a record).
   Clearing examples therefore use HCQL JSON, not an invalid CQL literal.
2. **Integer-keyed HCQL REST deep PATCH:** with numeric parent/child keys,
   `PATCH /Authors/101` and `{ books: [{ ID: 201, title: 'Revised' }, { ID: 202 }] }`
   retained child 202 but reset its omitted title to null. A subsequent probe
   supplying titles for both children also reset the omitted parent name to null.
   The equivalent CQL deep UPDATE through the HCQL service root preserved the
   key-only child's title; scalar REST PATCH preserved the composition.
   Cause is not diagnosed. This is an observed implementation limitation,
   not the documented generic deep-update contract or an intended new policy.
   Final examples use string keys; REST guidance does not promise key-only field
   preservation. Review this limitation before treating integer-key REST deep
   PATCH as interchangeable with the tested CQL path.

No framework fix or bug report was attempted in this skill-only slice.

## Review and Closeout

User polished the CQL section into nested reconciliation bullets and a fenced
targeted-child example, then authorized committing. Their final edit already removed
the stray backtick/period and trailing whitespace identified during review; preserved
without further source changes. This supersedes the earlier review-only boundary.

Final checks: both CQL examples parse with `@cap.core/ql`; frontmatter names,
code fences, cross-skill link and `git diff --check` pass. The earlier 8/8 runtime
checks still apply to the unchanged query semantics; not rerun after editorial polish.
Commit the two skills and this supporting review note only. No push; unrelated
`PR chain.md`, XTravels, framework and installation remain untouched.
