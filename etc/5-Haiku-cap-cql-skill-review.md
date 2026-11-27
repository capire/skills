# Review of cap-cql Skill

## Overall Assessment
The skill strikes a **reasonable balance** between conciseness and completeness, but has some **gaps that could lead to trial-and-error**, especially for smaller models:

---

## Strengths (Context Window Optimization)

1. **Concise Syntax Synopsis** (lines 11-28)
   - Excellent overview of the four main operations with clear notation
   - Immediately signals what's supported and what's not (no UNION, JOIN, sub-SELECT)
   - Good use of visual markers (`[ ]` for optional, `{ }` for projections)

2. **Strategic Cautions** (lines 30-34)
   - Critical gotchas are flagged upfront (null checks, string quotes, apostrophes)
   - Prevents the most common errors before they happen

3. **Modular Reference Structure**
   - Main concepts in SKILL.md; detailed operators/functions split into separate references
   - Allows models to load only what they need for a specific task

4. **Clear Examples with Expected Output** (lines 74-89)
   - Shows both CQL and resulting JavaScript shape
   - Essential for understanding nested projections

## Weaknesses (Accuracy & Completeness Gaps)

1. **Missing Key Disambiguation** 
   - **No clear guidance on when to use path expressions vs. nested projections**
     - What's the actual difference in results/performance?
     - When should I pick one over the other?
     - Example: `SELECT from Authors { ID, books.title }` vs. `SELECT from Authors { ID, books { title } }`
     - The skill doesn't explain this critical distinction

2. **Nested Records Clarity Issues**
   - Lines 116-117: "Deep *UPDATEs* delete omitted children → ensure to list every child to keep (by key)"
     - This is vague. What does "omitted" mean exactly? In nested records?
     - Does this apply to both compositions and managed associations?
     - No example showing the dangerous behavior

3. **Incomplete Function Coverage**
   - `operators-and-functions.md` doesn't mention **type conversion functions** (cast, coerce)
   - **Type coercion rules** are not documented
   - Smaller models will struggle guessing: `SELECT from Books where price > '100'` — is this valid?

4. **Infix Filter Behavior Under-explained**
   - Line 128: "Nested expands disallow trailing WHERE..."
   - But what about **multiple nested levels**? 
     - Line 155-161 example shows chained infix filters, but doesn't explain the scope — does `[role='Manager']` only apply to the first `.addresses`, or the whole chain?
     - No clarification on operator precedence/association

5. **Deep Write Edge Cases Not Covered**
   - When inserting nested records, what happens with circular references?
   - How do you handle **partial updates** of nested arrays?
   - The troubleshooting mentions draft issues (lines 22-24) but not general composition mutation pitfalls

6. **No Examples for Complex Scenarios**
   - Multiple aggregates with GROUP BY across nested expands
   - Combining `exists` with complex predicates
   - Filtering on computed/aliased columns

7. **Pseudo Variables Limitation Not Clear**
   - Line 124: "Record syntax allows only plain strings, numbers, and booleans — **not:** element references or pseudo variables"
   - But are there **any contexts** where `$now` can be used in writes? Server-side defaults?
   - This is important for data integrity patterns

8. **No SQL Functions Reference**
   - Which standard SQL functions are **not** supported?
   - Case sensitivity in function names?
   - Variadic functions (`concat` takes `...` but how many args max)?

---

## Recommendations for Improvement

### High Priority (prevents most trial-and-error):
1. Add a section: **"Path Expressions vs. Nested Projections: When to Use Each"** with performance/semantics differences
2. Expand the deep write section with clear before/after examples showing deletion behavior
3. Document **all type coercion rules** or link to them
4. Clarify scope rules for chained infix filters with a complex example

### Medium Priority (reduces confusion for edge cases):
5. Add a FAQ or pattern section: "Common Write Patterns" (partial updates, bulk upserts, compositions)
6. Explicitly document function **arity** (number of args) and **return types**
7. Show examples of `exists` with complex predicates and negation

### Low Priority (nice-to-have):
8. Add a "Common Mistakes by Skill Level" section mapping to troubleshooting
9. Link examples to an online playground/sandbox where users can experiment

---

## Verdict

**For experienced CAP developers:** The skill is solid and efficient.

**For smaller models or those new to CAP:** The skill provides a good foundation but lacks specificity in three critical areas:
- When/how to combine features (path vs. nested)
- Edge cases in mutations (deep writes, compositions)
- Type and function details

A model trying to write a complex query with nested filters, aggregates, and conditionals will likely need to iterate. Adding 2-3 worked examples of "medium complexity" queries would significantly reduce trial-and-error.
