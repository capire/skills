# Review: `cap-cql2` SKILL.md (work-in-progress)

Critical review of the revised CQL skill — synopsis and top-level headings only.

## What's working really well

1. **"inline vs. expand" is now the backbone.** The chosen pairing is baked into the synopsis (lines 10, 14-15, 23-24) and the two top-level headings (lines 33, 35). The terms are introduced *together, as a contrasting pair*, right where the reader first meets them — a big upgrade over v1.

2. **The synopsis leads with the *why* before the *how*.** Starting from "CDS introduces Associations which replace foreign keys" (line 10) grounds CQL in the domain model rather than "SQL with weird syntax." v1 jumped straight to syntax variants. More motivating.

3. **The intent/optimization tip (line 30) is a great addition.** "What, not how" and "one database roundtrip" give the reader a reason to care — not just sugar, but a runtime optimization enabler. v1 had nothing like this.

4. **The single annotated example does triple duty** (lines 12-27): the query, the result shape, and inline/expand labels together. Pairing CQL with its JS result shape immediately is pedagogically excellent.

5. **Heading style `X → Y`** (33/35/37) is self-documenting: "Path Expressions → inlined results." The arrow *is* the mental model.

## Critical concerns

1. **Synopsis first sentence is a dense run-on.** Line 10 packs five concepts into two sentences; new readers may stall. Break after "navigational references," then a second sentence for CQL's role.

2. **The hard syntax synopsis is gone — intentional?** v1 had an at-a-glance block of all five statement forms (SELECT/INSERT/UPSERT/UPDATE/DELETE). The new version only shows a SELECT. That reference-card value is lost; an agent scanning for "how do I write an UPDATE" no longer gets an instant top-of-file answer.

3. **Write-side terminology is asymmetric.** Headings: `Path Expressions → inlined results`, `Nested Projections → expands`, `Nested Records → deep write`. First two are read-side (inline/expand); third is write-side. **Deep write is the write-side analog of expand** — there's no inline analog called out. Make the symmetry explicit, or the reader wonders why writes have only one mode.

4. **"inline" is introduced as noun/adjective, not verb.** Lines 10/15/24 use it adjectivally. Its power (per our analysis) is being a *verb* paralleling "expand" ("you inline an association"). The headings don't yet exploit that.

5. **`description` frontmatter (line 3)** says "IGNORE this for now." Fine for WIP, but it must become a real trigger description before replacing `cap-cql` — current text would never auto-load.

6. **Appendix jumps from `##` (h2) to `#####` (h5)**, skipping h3/h4. Harmless in rendering but inconsistent; pick a level.

## Open questions

- Keep a compact **full statement-form synopsis** (all 5 verbs) somewhere, or is the new skill deliberately read-first with writes demoted?
- Should **infix filters** (`[...]`), **single-object queries** (`Books[201]`), **pseudo-variables**, and **operators/functions** become sub-sections under these three headings, or get their own top-level headings? v1 gave them top-level billing; the new outline doesn't show them yet.

## Net

The conceptual reframing is excellent and clearly better than v1. Main risk: **losing the reference-card completeness** that made v1 useful for quick lookup. Keep the new narrative *and* reintroduce a compact syntax overview → strictly better than the original.
