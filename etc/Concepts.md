# OpenCode Concepts

## Concept Diagram

```js
┌─────────────────────────────────────────────────────────────────────┐
│  OpenCode                                                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Session  (has parent/child hierarchy)                        │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Conversation  (message history: user ↔ agent)          │  │  │
│  │  │                                                         │  │  │
│  │  │  ┌───────────────────────────────────────────────────┐  │  │  │
│  │  │  │  Agent  (configured AI assistant)                 │  │  │  │
│  │  │  │                                                   │  │  │  │
│  │  │  │   mode: primary ──── user interacts directly      │  │  │  │
│  │  │  │         │  [build, plan]                          │  │  │  │
│  │  │  │         │                                         │  │  │  │
│  │  │  │         └─── invokes ──► subagent                 │  │  │  │
│  │  │  │                          [general,                │  │  │  │
│  │  │  │                           explore, scout]         │  │  │  │
│  │  │  │                          creates child session    │  │  │  │
│  │  │  │                                                   │  │  │  │
│  │  │  │   uses ──► Model  (LLM: provider/model-id)        │  │  │  │
│  │  │  │                                                   │  │  │  │
│  │  │  │   calls ──► Tools  (capabilities)                 │  │  │  │
│  │  │  │              ├── bash      (run shell cmds)       │  │  │  │
│  │  │  │              ├── read      (read files)           │  │  │  │
│  │  │  │              ├── edit      (modify files)         │  │  │  │
│  │  │  │              ├── glob      (find files)           │  │  │  │
│  │  │  │              ├── grep      (search content)       │  │  │  │
│  │  │  │              ├── webfetch  (fetch URLs)           │  │  │  │
│  │  │  │              ├── task ────► spawns subagent       │  │  │  │
│  │  │  │              ├── skill ───► loads Skill           │  │  │  │
│  │  │  │              └── ...                              │  │  │  │
│  │  │  │                                                   │  │  │  │
│  │  │  │   loads ──► Skills  (SKILL.md instruction         │  │  │  │
│  │  │  │              files, loaded on demand)             │  │  │  │
│  │  │  │                                                   │  │  │  │
│  │  │  │   governed by ──► Permissions                     │  │  │  │
│  │  │  │              (allow / ask / deny per tool)        │  │  │  │
│  │  │  └───────────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Server  (HTTP/OpenAPI)                                             │
│   └── exposes sessions, messages, agents, tools via REST + SSE      │
│                                                                     │
│  Clients: TUI │ Web │ IDE extension │ programmatic (SDK)            │
└─────────────────────────────────────────────────────────────────────┘
```

## Relationships at a Glance

```js
Session ────────────── contains ──────────────► Conversation
   │                                                  │
   │ parent/child                              user ↔ Agent
   │ (subagent work)                                  │
   └──► child Session                          uses ──┼──► Model
                                               calls ─┼──► Tools
                                               loads ─┼──► Skills
                                               limits ┴──► Permissions
```

## Concept Descriptions

| Concept       | Description                                                                 |
|---------------|-----------------------------------------------------------------------------|
| **Session**   | Persistent container for a conversation. Can have parent/child hierarchy when subagents are spawned. |
| **Conversation** | The message history within a session — the back-and-forth between user and agent. |
| **Agent**     | Configured AI assistant. Bundles a model, system prompt, tool permissions, and a mode (`primary` or `subagent`). |
| **Model**     | The underlying LLM (e.g. `anthropic/claude-sonnet-4-5`). Each agent picks one; subagents inherit the invoking agent's model by default. |
| **Tools**     | Functions the model can call to act: read/write files, run shell commands, fetch URLs, spawn subagents, load skills, etc. |
| **Skills**    | On-demand `SKILL.md` instruction files. Agents see available skills and load them when relevant via the `skill` tool. |
| **Permissions** | Per-agent access control (`allow` / `ask` / `deny`) for each tool or tool category. |

## Built-in Agents

```
Primary agents (Tab to switch)       Subagents (spawned via task / @mention)
─────────────────────────────        ────────────────────────────────────────
build  ── all tools enabled          general ── full access, multi-step tasks
plan   ── file edits / bash = ask    explore ── read-only, fast codebase search
                                     scout   ── read-only, external docs/deps
```
