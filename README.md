# CAP Skills Library

A shared library of reusable **skills**, **agents**, and **prompts**. Compatible with [OpenCode](https://opencode.ai), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), and other AI coding tools that follow the open standards.

| Included Skills                                                  | Description                                        |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| [cap-guided-dev](skills/cap-guided-dev/SKILL.md)                 | Guided, step-by-step dev flow one stage at a time  |
| [cap-developer](skills/cap-developer/SKILL.md)                   | Expert guidance for building and CAP apps          |
| [cap-inner-loop](skills/cap-inner-loop/SKILL.md)                 | Test-drive CAP services locally                    |
| [cap-hcql](skills/cap-hcql/SKILL.md)                             | Consume CAP services through HCQL endpoints        |
| [cap-cql](skills/cap-cql/SKILL.md)                               | Use CQL to read and write data from CAP services   |
| [cap-check-setup](skills/cap-check-setup/SKILL.md)               | Check and validate a CAP dev environment           |
| [cap-troubleshooting](skills/cap-troubleshooting/SKILL.md)       | Diagnose and troubleshoot a CAP application        |
| [cap-upgrade](skills/cap-upgrade/SKILL.md)                       | Stay up to date with CAP's latest versions         |
| [cap-add-remote-service](skills/cap-add-remote-service/SKILL.md) | Integrate remote services using the Calesi pattern |
| [cap-trivia](skills/cap-trivia/SKILL.md)                         | CAP knowledge quiz with multiple-choice questions  |

| Included Agents                                | Description                       |
| ---------------------------------------------- | --------------------------------- |
| [CAPNodeDeveloper](agents/CAPNodeDeveloper.md) | CAP Node.js development assistant |
| [CAPJavaDeveloper](agents/CAPJavaDeveloper.md) | CAP Java development assistant    |

## Install

This repository contains a `marketplace.json`, making it easy to install directly from the github repository or from a local clone.

### Using `skills` CLI

Inside your project, run:

```sh
npx skills add https://github.tools.sap/cap/skills.git
```

See [skills cli](https://www.skills.sh/docs/cli).

### Plugin: Claude Code

Inside Claude Code, run:

```text
/plugin marketplace add https://github.tools.sap/cap/skills.git
/plugin install cap-developer@cap
```

Install referencing a local clone:

```text
/plugin marketplace add ~/cap/skills
/plugin install cap-developer@cap
```

See [Claude Code plugins](https://code.claude.com/docs/en/discover-plugins#add-marketplaces).

### Plugin: VSCode Copilot

Add `https://github.tools.sap/cap/skills.git` or `file:///.../cap/skills` (path to local clone) to your Copilot marketplace sources:
```json
"chat.plugins.marketplaces": [
  ...
  "https://github.tools.sap/cap/skills.git"
]
```

In Extensions (<kbd>⇧⌘X</kbd>), search for `@agentPlugins`, find the `cap-developer` plugin, and click "Install".

See [Copilot agent plugins](https://code.visualstudio.com/docs/copilot/customization/agent-plugins).



## Other install methods

### Option A — Symlink

Symlink the relevant subdirectory into your tool's config folder so you always get the latest version:

**OpenCode (project-level)**
```sh
# from your project root
ln -s /path/to/prompts-skills-agents/skills .opencode/skills
ln -s /path/to/prompts-skills-agents/agents .opencode/agents
```

**OpenCode (global)**
```sh
ln -s /path/to/prompts-skills-agents/skills ~/.config/opencode/skills
ln -s /path/to/prompts-skills-agents/agents ~/.config/opencode/agents
```

**Claude Code (project-level)**
```sh
ln -s /path/to/prompts-skills-agents/skills .claude/skills
```

**Claude Code (global)**
```sh
ln -s /path/to/prompts-skills-agents/skills ~/.claude/skills
```

> Symlink individual skill folders if you only want a subset:
> ```sh
> ln -s /path/to/prompts-skills-agents/skills/cap-check-setup .opencode/skills/cap-check-setup
> ```

### Option B — Copy/paste

Copy any folder or file you need directly into your tool's config directory.

```sh
cp -r skills/cap-check-setup ~/.config/opencode/skills/
cp agents/cap-reviewer.md ~/.config/opencode/agents/
```


## Discovery Paths

### Skill discovery paths

OpenCode and Claude Code look for skills in:

| Scope | Path |
|---|---|
| OpenCode project | `.opencode/skills/<name>/SKILL.md` |
| OpenCode global | `~/.config/opencode/skills/<name>/SKILL.md` |
| Claude Code project | `.claude/skills/<name>/SKILL.md` |
| Claude Code global | `~/.claude/skills/<name>/SKILL.md` |
| Generic agents project | `.agents/skills/<name>/SKILL.md` |
| Generic agents global | `~/.agents/skills/<name>/SKILL.md` |

### Agent discovery paths

| Scope | Path |
|---|---|
| OpenCode project | `.opencode/agents/<name>.md` |
| OpenCode global | `~/.config/opencode/agents/<name>.md` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add your own skill, agent, or prompt.
