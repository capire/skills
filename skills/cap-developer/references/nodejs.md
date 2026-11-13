# CAP Node.js — runtime-specific guidance

Read this file when the project is a CAP Node.js app (`package.json` with `@sap/cds`, `cds watch`).
Shared, runtime-agnostic guidance lives in sibling references — `cds-modeling.md`,
`declarative.md`, `custom-logic.md`, `sample-data.md` — and the "Don't" list is in `SKILL.md`.
This file only covers what is Node.js-specific.

## Project initialization

When starting a new Node.js project, run:

```sh
cds init <name> --nodejs
cd <name>
npm install        # install the generated project's dependencies
cds watch          # start the dev loop
```

`cds watch` recompiles the CDS model and reloads handlers on every save — keep it running while
editing.


## Module system: use ESM

New CAP Node.js projects use ES modules. Write handlers with `import`/`export`, not `require`:

```js
import cds from '@sap/cds'

export default class CatalogService extends cds.ApplicationService {
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
- Use `req.reject(code, message)` for immediate business-error rejection. An unclassified
  `Error` usually becomes a server error; CAP can handle thrown errors, but expected validation
  failures need a suitable client status and message/code.
- Use `req.error(code, message)` to collect multiple errors without aborting immediately; processing continues, and CAP returns all collected errors together at the end.
- Use explicit column lists in SELECT — never `SELECT *`.
- Rely on CAP's intrinsic transaction handling — no manual transactions.
- Minimize DB round-trips and avoid check/write races: use a guarded atomic update or supported
  concurrency control. For lifecycle actions, consider the generic status flows in `declarative.md` first.

  ```js
  // ❌ two DB calls
  const row = await SELECT.one.from(Entity).where({ ID })
  if (row.status === 'locked') return req.reject(400, '...')
  await UPDATE(Entity, ID).with({ status: 'locked' })

   // ✅ one guarded DB update, inside a custom action implementing this operation
   // db is the primary database service; Entity is the intended persistence entity.
   const result = await db.run(UPDATE(Entity)
     .where({ ID, status: 'open' })
     .with({ status: 'locked' }))
   const affected = typeof result === 'number' ? result : result.affected
   if (affected !== 1) return req.reject(409, 'NOT_FOUND_OR_NOT_OPEN')
   ```

  Check the result contract of the execution API/version: generic application-service CRUD
  results use an array with `.affected`; database adapters may return a numeric count.
  An empty result array is truthy, so `if (!result)` does not detect zero affected rows.
  Direct DB work does not inherit the target application service's authorization/validation:
  use it intentionally within the authorized operation. Do not put this write in a CRUD `before`
  handler and then let a second generic update run. A single-record action must preserve its
  addressed key; navigated/composite targets need model-aware targeting rather than assuming `ID`.

## Node-specific gotchas

- In current CAP, `served` supports asynchronous listeners, which are awaited before the HTTP
  listener starts. Return/await required initialization work there; do not start detached work
  and assume it delays startup. Other lifecycle events may be synchronous: verify the installed
  runtime's [lifecycle contract](https://cap.cloud.sap/docs/node.js/cds-server#served).
- Do not convert an ESM project to CommonJS or remove `"type": "module"` to sidestep a
  `require`/`import` error — see [Module system: use ESM](#module-system-use-esm).
