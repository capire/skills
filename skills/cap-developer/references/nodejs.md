# CAP Node.js — runtime-specific guidance

Read this file when the project is a CAP Node.js app (`package.json` with `@sap/cds`, `cds watch`).
The parent `SKILL.md` covers shared CDS modeling, declarative annotations, sample data, and the
"Don't" list — this file only covers what is Node.js-specific.

## Project initialization

When starting a new Node.js project, run:

```sh
cds init <name> --nodejs
cd <name>
cds watch          # start the dev loop
```

`cds watch` recompiles the CDS model and reloads handlers on every save — keep it running while
editing.


## File and service conventions

- Match `.cds` and `.js` file names exactly (e.g. `order-service.cds` + `order-service.js`) — CAP
  auto-discovers handler implementations by convention; no `@impl` annotation is needed.
- One service per `.cds` file — splitting services keeps convention-based matching clean.
- Use `@restrict` with `where` conditions (e.g. `where: 'userID = $user'`) for row-level access
  control; do not rely on application-level filtering inside handlers.

## Custom handlers

Only use custom handlers, when declarative constraints don't suffice. Constraints and handlers can be mixed, so even when writing a custom handler, don't do all checks there

For custom handlers:
- Register with `srv.before`, `srv.on`, `srv.after` — pick the correct phase.
- Reject with `req.reject(code, message)` — never throw raw errors.
  Use `req.error(code, message)` to collect multiple errors without aborting immediately (processing
  continues; all collected errors are returned together at the end).
- Use explicit column lists in SELECT — never `SELECT *`.
- Rely on CAP's intrinsic transaction handling — no manual transactions.
- Minimize DB round-trips: combine checks into the query itself rather than SELECT + check + UPDATE.

  ```js
  // ❌ two DB calls
  const row = await SELECT.one.from(Entity).where({ ID })
  if (row.status === 'locked') return req.reject(400, '...')
  await UPDATE(Entity, ID).with({ status: 'locked' })

  // ✅ one DB call
  const n = await UPDATE(Entity, ID)
    .where({ status: { '!=': 'locked' } })
    .with({ status: 'locked' })
  if (!n) return req.reject(409, 'Not found or already locked')
  ```

## Node-specific gotchas

- Do not use `await` inside a synchronous `cds.on('served', ...)` callback. The `served` event is
  emitted synchronously; awaiting inside it does not delay startup and silently swallows errors.
  Use an async function only where CAP's API actually awaits it (handler callbacks, bootstrap
  hooks that document async support).
