---
name: cap-inner-loop
description: Use to discover, start, stop, and consume locally running CAP servers and services, including querying data, calling actions, and following CAP's inner-loop best practices.
license: Apache-2.0
---
> [!important]
> **This skill requires `@sap/cds` 10.2.x or higher!** → run `cds version -c 10.2.x` before proceeding, and abort with an upgrade hint if it fails: `npm i -g @sap/cds-dk`


# CAP Inner-Loop Development

CAP promotes local inner-loop development: quickly starting CAP servers with in-memory databases and mocked platform services. This skill covers discovering, starting, consuming, and stopping them. Keep the user in the loop when choosing which servers to start or stop.

> - Several **scripts** are provided with this skill, available in folder `<skill-base>/scripts/`.  
> - In the remainder we shortcut that as `$/` → for example, `$/cds-start`.  
> - On Windows, append a `.ps1` to the script's name, e.g. `$/cds-start.ps1`.

## Cold start instructions

If this skill is loaded explicitly, e.g. through `@cap-inner-loop` in OpenCode, without additional instructions, guide the user by offering next steps in a menu via the `question` tool. Go on to do so as appropriate until the user dismisses a menu with ***esc***. 

## Local service bindings 

Local CAP apps register in the service binding environment. Inspect it with `cds bindings` to see which _services_ are running, and which _entities_ or _actions_ they serve:

```shell
cds bindings
```

Returns a compact JSON – here shown as YAML for readability:

```yaml
services:
  AdminService:
    server: http://localhost:4004    # the server's base url
    endpoints:
      hcql: /hcql/admin
      odata: /admin
    entities:
      - Authors
      - Books
      - Genres
    actions: []
  # ... more services
servers:
  http://localhost:4004:      # the server's base url
    root: ~/cap/bookshop      # the project's root directory
    tty: /dev/ttys001         # only when started in a terminal (see below)
    ppid: 101                 # parent process; cds watch for watched servers
    pid: 102                  # server process; changes on watch reload
  # ... more servers
```

Use the `--check` option to quickly check if servers for given projects are running. Lists found bindings on `stdout`, and missing ones on `stderr`:

```sh
cds bindings --check bookshop reviews   # project roots relative to cwd
cds bindings --check                    # all server.roots in bindings
```


## Starting CAP servers

Use the `cds-start` script to start servers. It takes project folders as input, checks what's already running, starts the missing ones in new terminals, and waits until they're up:

```sh
$/cds-start <projects>   # relative to cwd, symlinks are resolved
$/cds-start .            # from within a CAP project
```

- If the current working directory (cwd) is a CAP project, start that with `.`
- If no project given, `ls -d */` in cwd and offer up to 11 via the `question` tool.
- Once `cds-start` succeeds, call `cds bindings` to load the registry — it's required later on to know services, endpoints and protocols.


## Consuming services

- **Consume services** at `<base>/<endpoint>` — e.g. *http://localhost:4004/hcql/admin*.
- **Don't guess** protocols or endpoints — always take them from the *[service bindings](#local-service-bindings)*.

- For `mcp` endpoints → use connected MCP tools.
- For `a2a` endpoints → use available A2A clients, if any.

### Before discovering HCQL services

- Before making HCQL requests, fetch and read the client instructions in `guides/protocols/hcql.md` from the selected CAP documentation base URL (default: `https://cap.cloud.sap/docs/`). Reuse guidance already read while it remains current and applicable; do not guess metadata routes.
- Use bindings to select relevant services and reuse known contracts. When a service's purpose or entity/action names are unknown, start with `GET /` at its HCQL endpoint for a lightweight summary; do not probe every service unnecessarily.
- Then request only needed schemas together, e.g. `GET /?describe=Books,Authors,submitOrder`. If the needed names are already known from bindings or prior discovery, request their schemas directly. Use `GET /?describe=all` only when the complete contract is needed.
- Paths above are relative to the HCQL service endpoint, not the server root. If required guidance cannot be loaded, report that before making affected requests; do not silently substitute remembered routes.

### Before composing data queries

- Before writing HCQL or MCP data queries, fetch and read the relevant sections of `guides/protocols/hcql/core-ql.md` from the selected CAP documentation base URL (default: `https://cap.cloud.sap/docs/`). Reuse guidance already read while it remains current and applicable.
- Schema discovery establishes entity names, fields and operation signatures, not query grammar. Follow the Core QL reference and query-tool description rather than assuming SQL or Classic CQL syntax.
- If the required reference cannot be loaded, report that before executing affected queries; do not silently substitute remembered syntax.

## Restarting CAP servers

Servers started with `cds watch` restart on content changes; to trigger that...

1. Lookup the server's project `root` from the *[service bindings](#local-service-bindings)*.
2. Simply `touch <server.root>/package.json`.

**In-memory data is ephemeral** and vanishes on restart — this is expected by users; don't try to prevent it or mention it unless the user explicitly asks.

## Stopping CAP servers

Use the `cds-stop` script to shutdown specific servers or all found in the bindings:

```sh
$/cds-stop <projects>  # omit to shutdown all
```

On macOS, this also closes the associated terminal windows.
