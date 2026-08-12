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


## Module system: use ESM

New CAP Node.js projects use ES modules. Write handlers with `import`/`export`, not `require`:

```js
import cds from '@sap/cds'

export class CatalogService extends cds.ApplicationService {
  async init () {
    // register handlers here, e.g. this.on('READ', 'Books', req => { ... })
    return super.init()   // required: attaches generic CRUD, auth, ETags, etc.
  }
}
```

- If `package.json` already contains `"type": "module"`, keep it. **Never** delete it or rewrite
  handlers as CommonJS to sidestep a `require`/`import` mistake — fix the import instead.
- CDS 10 test tooling is ESM-native: Chai 6 is ESM-only, and `cds test` wraps Node's built-in
  test runner (`node --test`). Jest still marks its [ESM support as experimental](https://jestjs.io/docs/ecmascript-modules)
  and requires `--experimental-vm-modules`, so it's not the smoothest fit for a new CAP Node.js
  project — prefer `node --test` or Vitest.
- Use `import.meta.dirname` / `import.meta.url` instead of `__dirname` / `__filename` when you
  need the current file's path.


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
- Use `req.error(code, message)` to collect multiple errors without aborting immediately; processing continues, and CAP returns all collected errors together at the end.
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
- Do not convert an ESM project to CommonJS or remove `"type": "module"` to sidestep a
  `require`/`import` error — see [Module system: use ESM](#module-system-use-esm).
