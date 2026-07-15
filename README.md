# CAP Skills

## About this project

Curated set of skills helping AI coding agents build and maintain [CAP](https://cap.cloud.sap) applications.

## Requirements and Setup

Skills work with AI coding tools that support the open skill standard, such as [OpenCode](https://opencode.ai), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), or VS Code Copilot.

### `skills` CLI

Inside your project, run:

```sh
npx skills add https://github.com/capire/skills.git
```

See [skills CLI](https://www.skills.sh/docs/cli).

### Claude Code Plugin

Inside Claude Code, run:

```text
/plugin marketplace add capire/skills
/plugin install cap-developer@cap
```

See [Claude Code plugins](https://code.claude.com/docs/en/discover-plugins#add-marketplaces).

### VS Code Copilot Plugin

Add the repository to your Copilot marketplace sources in `settings.json`:

```json
"chat.plugins.marketplaces": [
  "https://github.com/capire/skills.git"
]
```

In Extensions (<kbd>Shift+Cmd+X</kbd>), search for `@agentPlugins`, find the desired skill, and click "Install".

See [Copilot agent plugins](https://code.visualstudio.com/docs/copilot/customization/agent-plugins).

### Symlink (manual)

Symlink the `skills/` directory into your tool's config folder:

```sh
# OpenCode (project-level)
ln -s /path/to/cap-skills-public/skills .opencode/skills

# OpenCode (global)
ln -s /path/to/cap-skills-public/skills ~/.config/opencode/skills

# Claude Code (project-level)
ln -s /path/to/cap-skills-public/skills .claude/skills
```

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/capire/skills/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2026 SAP SE or an SAP affiliate company and capire/skills contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/capire/skills).
