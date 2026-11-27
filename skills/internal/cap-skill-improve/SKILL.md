---
name: cap-skill-improve
description: Capture skill improvement opportunities discovered during skill usage. TRIGGER Activate **procatively** when a skill gives guidance that turns out to be incorrect or outdated, skill instructions caused confusion, the user explicitly mentions that the skill content was wrong, or when you discover a better pattern than what the skill recommends.
license: Apache-2.0
metadata:
  author: cap-team
  team: cap
  internal: true
---

## What I do

When something in a skill is wrong, missing, outdated, or confusing, I help route the feedback to
the right place — either a GitHub Discussion for broader topics or a direct fix via a branch/PR.

## Steps

### 1. Identify the improvement

Classify the finding:

| Category | Examples |
|----------|---------|
| **Incorrect** | Wrong API, deprecated annotation, bad code sample |
| **Missing** | Undocumented edge case, missing prerequisite, absent step |
| **Outdated** | Version-specific info that no longer applies |
| **Unclear** | Ambiguous wording that led to confusion |
| **Enhancement** | Better pattern, additional tip, related skill reference |

Record:
- Which skill is affected (e.g. `cap-developer`)
- Which section/step has the issue
- What the current content says (or lacks)
- What the correct/improved content should be

### 2. Decide: Discussion or Fix

| Route | When to use |
|-------|-------------|
| **Discussion** | Broad topic, needs team input, design decision, multiple valid approaches, or you're unsure of the right fix |
| **Branch + Fix** | Clear-cut correction, typo, missing step with obvious solution, outdated version reference |

### 3a. Open a Discussion

Target: https://github.tools.sap/cap/skills/discussions

Create or contribute to a discussion with:

- **Title**: `[<skill-name>] <short description>`
- **Category**: Choose the most fitting (Ideas, Q&A, or a custom category if available)
- **Body**:
  ```markdown
  ## Skill
  `<skill-name>` — Section: <section reference>

  ## Current behavior
  <what the skill currently says or does>

  ## Observed issue
  <what went wrong or was missing during usage>

  ## Suggested improvement
  <proposed change or question for the team>

  ## Context
  <any relevant details: CAP version, scenario, error messages>
  ```

Use the `gh` CLI to create the discussion:

```sh
gh discussion create \
  --repo github.tools.sap/cap/skills \
  --title "[<skill-name>] <short description>" \
  --category "Ideas" \
  --body "<body>"
```

If a relevant discussion already exists, add a comment instead of creating a new one.

### 3b. Create a Fix Branch

For clear-cut fixes:

1. Navigate to the `cap-skills/` submodule
2. Create a branch:
   ```sh
   git checkout -b fix/<skill-name>/<short-desc>
   ```
3. Edit the SKILL.md file with the correction
4. Commit with a descriptive message:
   ```sh
   git add .
   git commit -m "fix(<skill-name>): <what was fixed>"
   ```
5. Push and create a PR:
   ```sh
   git push -u origin fix/<skill-name>/<short-desc>
   gh pr create \
     --repo github.tools.sap/cap/skills \
     --title "fix(<skill-name>): <short description>" \
     --body "## What\n<description of fix>\n\n## Why\nDiscovered during skill usage: <context>"
   ```

### 4. Inform the user

After routing the feedback, tell the user:
- What was captured
- Where it went (discussion link or PR link)
- That the skill will be improved for future sessions

## Don't

- Silently ignore issues you notice in skills — always surface them
- Make speculative changes to skills without clear evidence from the session
- Create both a discussion AND a branch for the same issue — pick one
- Modify skills in the discovery directories (`.opencode/`, `.claude/`, `.agents/`) — always edit in `cap-skills/skills/`
- Force-push or rewrite history on fix branches
