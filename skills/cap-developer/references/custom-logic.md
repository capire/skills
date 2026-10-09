# Programmatic custom logic — event handlers

Read this file only when declarative annotations (`declarative.md`) aren't enough. Custom
handlers are for custom actions/functions, side effects, and checks that need a DB lookup or an
external call.

## When a handler is justified

Reach for a handler only when you can name the specific reason no annotation fits — e.g. the check
needs a DB lookup, an external call, or async work. Most rules people reach for handlers on are
actually annotations (see `declarative.md`).

Two rules hold for both runtimes:

- Don't write handlers for things the generic service provider already handles.
- Rely on CAP's intrinsic transaction handling — no manual transactions.

Constraints and handlers can be mixed: even when writing a custom handler, don't do all checks
there — keep declarative what can stay declarative.

## The three phases (runtime-agnostic)

- **before** — input validation that can't be expressed declaratively; reject early before DB writes.
- **on** — custom actions and functions.
- **after** — side effects like emitting async events.

## Runtime references

The handler API differs substantially between runtimes. Read the matching reference for full
guidance:

- `nodejs.md` — `srv.before` / `srv.on` / `srv.after`, `req.reject(code, message)`,
  intrinsic transactions, the round-trip-minimization pattern.
- `java.md` — `@Before` / `@On` / `@After` with reflection-based event/entity
  detection, typed `CdsResult<D>` vs untyped `Result`, `ServiceException` vs `messages.error`,
  the race-condition-safe `.set(field, expr)` update pattern, and more.
