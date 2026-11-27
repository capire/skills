# Manual variants

The `cds-start` and `cds-stop` scripts cover the common start/stop flows end to end. The steps below are the lower-level, manual equivalents — reach for them only when you need finer control or started servers with `cds-launch` / `cds watch` directly.

## Starting manually

Always run `cds bindings` first — only start servers that aren't already running — then use the `cds-launch` script, which accepts multiple project names and runs `cds watch` for each in a new terminal:

```sh
$/cds-launch <project1> <project2> ...
```

`cds-start` builds on this: it skips already-running projects, delegates launching to `cds-launch`, then confirms startup (below). Use `cds-launch` directly only when you want to start servers without the automatic readiness poll and registry print.

## Confirm startup manually

Wait for servers you started with `cds-launch` / `cds watch` using a clean two-phase pattern — **ping to wait, then fetch once**:

**1. Ping loop** — `cds bindings --check` (`-c`) is a *pure liveness ping*: no stdout, it prints the still-down projects on **stderr** and exits **1 while any requested project is missing** (0 once all are up). Pass the full project list every iteration — there is no pending-set to track or shrink. Use a **bounded** loop so it always terminates:

```sh
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do   # ~6s budget at 0.5s steps
  cds bindings -c <project1> <project2> ... 2>/dev/null && break
  sleep 0.5
done
```

**2. Fetch once** — after the loop reports all up, load the registry in a single call scoped to those projects:

```sh
cds bindings <project1> <project2> ...   # json by default when piped; add -2 yaml for a human
```

Servers usually register within the first ping. If `cds bindings -c` still exits non-zero after the loop, those projects didn't come up (its stderr lists which) — inform the user before continuing. For a longer wait raise the iteration count.

**Notes:**

- Don't merge intermediate results gradually and don't thread a `<pending>` set — the ping only tells you *whether* to keep waiting; the scoped fetch gets the data once at the end. Symlinked projects (e.g. `events -> xtravels/srv/events`) are resolved by both `-c` and the plain `cds bindings <projects>` call.
- Keep the loop **bounded** and `break` on exit 0. Never use an open-ended `until`/`while` loop or an empty-args `cds bindings -c` call — both can hang.

## Stopping servers manually

Stop a server by hand with:

1. Get the server's `<pid>`, `<ppid>` and `<tty>` from `cds bindings --get servers` (skip if known from a prior call).
2. `kill <ppid>` — the `cds watch` **parent** for watched servers — escalating to `kill -9 <ppid>` if necessary. For non-watched registrations, the parent may be a shell or launcher; use `kill <pid>` to stop only the server itself.
3. For servers with a `tty`, **always** offer to close that window using the `close-terminals` script:

```sh
$/close-terminals <tty1> <tty2> ...
```

> On Windows, `$/close-terminals.ps1` takes *project names* instead of ttys — it stops the server process but leaves the terminal window open.

## Persisting ephemeral data to .csv

Local servers use an in-memory db, so data changes vanish on restart — normally that's expected and you shouldn't preserve them. Only when the user explicitly asks to persist runtime changes back to .csv: because `cds watch` redeploys and reseeds from CSV on any file change, applying updates and *then* editing a CSV erases those updates. Avoid the trap with this order:

1. Read from the database and write to **copies** of the .csv files.
2. Stop the server.
3. **Replace the original .csv** files with the copies.
4. Restart the server.
