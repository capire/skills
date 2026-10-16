---
name: cap-inner-loop
description: Use when the user asks to start servers, which services are running, or to query data. Learn how to discover, inspect and consume running services, as well as how to quickly start/stop servers locally in separate, visual terminal windows.
license: Apache-2.0
---

# CAP Inner-Loop Development

CAP promotes local inner-loop development: test-driving things locally by quickly starting CAP servers with in-memory databases and mocked platform services. This skill explains how to assist with that — discovering, starting, consuming, and stopping servers. Keep the user in the loop, especially when choosing which servers to start or stop.

## Local services registry

When started locally, CAP apps register themselves in the local service binding environment.
Inspect that with `cds bindings` to find out which servers are running, and which services and entities they serve:

```shell
cds bindings
```
( Note: **don't** read `~/.cds-services.json`, which is removed in cds10. )

Outputs YAML with top-level entries **`services`** and **`servers`**:

```yaml
services:

  AdminService:
    base: http://localhost:4004
    endpoints:
      hcql: /hcql/admin
      odata: /admin
      ...
    entities:
      - Books
      - ...
    server: 4004

  CatalogService:
    ...

servers:

  "4004":
    pid: 102
    ppid: 101
    tty: /dev/tty02

  "4005": ...
```

- Protocols are `odata`, `hcql`, `rest`, `mcp`, `a2a`, ... chosen by providers.
- Endpoint paths are arbitrary; don't assume a specific pattern.
- Process `<pid>` is the *cds watch*-ed child, changing with reloads.
- Process `<ppid>` is *cds watch* itself; kill that to stop a server completely.


## Starting CAP servers

Preferably start CAP servers in new visual terminal window → use the provided `cds-watch` script for that, which accepts multiple project names, and runs `cds watch` for each:

```sh
<skill-base>/scripts/cds-watch <project1> <project2> ...
```

- Start the server with `cds watch` only if you really want to run it in the background.

- If the user doesn't name a project, list the **directories** in cwd (e.g. `ls -d */`), and offer up to 11 to choose from.

> [!tip] CAP servers start fast
> Usually in the range of < 1 second. Poll after 1 second first, and retry every second for up to 10 seconds before giving up.

## Stopping CAP servers

Follow these steps to stop a server

1. Get the servers' `<ppid>` and `<tty>` from `cds bindings` → skip, if known from a prior call.
2. `kill` `<ppid>` → the `cds watch` process, not its child.
3. **Always** offer to close terminal windows using `<tty>` → use the `close` script, if yes:

```sh
<skill-base>/scripts/close <tty1> <tty2> ...
```


## Consuming CAP services

- Consume services at `<base>/<endpoint.path>` – *http://localhost:4004/hcql/admin*
- For HCQL queries, see `cap-hcql`
- For CQL syntax, see `cap-cql`.

During inner loops, `cds watch` restarts on changes to CDS models, .csv files, custom code, or configuration. To trigger a restart explicitly, touch `package.json` or a common .cds file like `db/schema.cds`.


## Ephemeral Data Changes

Local servers usually use an in-memory database, so data modifications vanish on restart. This is expected by users — don't proactively preserve them.

Only in rare cases will the user ask you to persist runtime changes back to .csv files. Because `cds watch` redeploys and reseeds from CSV on any file change, applying HCQL updates and *then* editing a CSV erases those updates. To avoid this trap, follow this order:

1. Read from the database and write to **copies of the .csv files**.
2. Stop the server.
3. **Replace the original .csv** files with the copies.
4. Restart the server.
