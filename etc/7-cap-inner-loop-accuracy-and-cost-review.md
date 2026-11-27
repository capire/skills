# Review: cap-inner-loop Accuracy and Costs

The main skill is already compact. The largest costs come from failed lifecycle operations, unnecessary registry loads, and unsuitable project/platform selection—not from its prose.

## Validation

Reviewed `skills/cap-inner-loop/SKILL.md`, both references, and the bundled Unix/PowerShell scripts against the installed `@sap/cds-dk` 10.2.0 CLI and a local development checkout of `@sap/cds` reporting 10.3.0. This establishes behavior for those snapshots, not every supported CAP version.

Executed the version gate and registry commands. Reproduced Unix script defects with isolated mock CLI/AppleScript commands. Subsequently checked registration by starting and cleaning up a minimal test service with plain `cds serve`, `--with-mocks`, `--with-bindings`, and `cds watch`, each with an isolated HOME/registry and random port. No terminal windows were opened or existing user servers stopped. PowerShell findings are static analysis; Windows was not available. The initial review did not change skill or bundled script files; the subsequent fix for finding 1 is recorded below.

Line references refer to the reviewed snapshot.

## Accuracy

### 1. Medium: Select the Correct PID When Stopping Registered Servers

**Locations:** `SKILL.md:49,87–100`; `scripts/cds-stop:19–38`; `reference/manual.md:45–46`.

**Clarification after double-check:** plain `cds serve` does not register bindings by default. The original finding was too broad about that default and has been narrowed and downgraded. The skill's `cds watch` launch path does produce the expected watcher `ppid`.

However, registration is gated by `(features.mocked_bindings && o.mocked) || o['with-bindings']`, not by `cds.watched` (`@sap/cds/bin/serve.js:192–199`). `cds watch` adds `--with-mocks` (`@sap/cds-dk/bin/watch/index.js:131`). Awaiting bindings installs the export listener, which records the actual process parent (`@sap/cds/lib/srv/bindings.js:16–21,122–126`).

An isolated runtime check confirmed:

| Command | Registered? | Binding `ppid` |
|---|---|---|
| `cds serve` | No | — |
| `cds serve --with-mocks` | Yes | Test launcher, not a watcher |
| `cds serve --with-bindings` | Yes | Test launcher, not a watcher |
| `cds watch` | Yes | Watcher PID |

Therefore the registry can contain non-watched servers, even though the normal skill launch path is safe under its watcher assumption. Killing their `ppid` can target a shell/launcher; touching `package.json` will not restart them.

**Scope clarification:** all registered servers are valid stop targets, including non-watched ones. Watcher ownership is not an authorization requirement, and no restriction to skill-launched servers is needed.

**Recommendation:** stop all requested registered servers using the appropriate process: `ppid` for a verified watcher, `pid` for a directly running server. The remaining finding concerns process selection, not permission to stop registered servers. Keep the touch-based restart recipe specific to watched servers.

**Resolution:** retained only documentation clarifications distinguishing server and parent PIDs and limiting touch-based restarts to watched servers. The proposed process-inspection implementation and its tests were reverted at the user's request to avoid complexity. The Unix stop script retains its original `ppid` behavior; non-watched registrations remain a documented caveat. Windows process-selection logic is unchanged.

### 2. High: Start/Stop Can Report Success After Failure

**Locations:** `scripts/cds-start:19–40`; `scripts/cds-stop:14–30,36–39`; `scripts/cds-start.ps1:18–36`.

Unix startup infers success from an empty stderr string rather than the final exit status. With a mock `cds` that exits 1 without stderr, it exhausts all 30 polls and then exits 0. Launch failures are also not checked. The PowerShell startup script uses a similar stderr-based final decision.

Unix shutdown silently converts a failed registry read or invalid JSON into “no running servers matched” and exit 0. It suppresses `kill` errors and prints `stopped` regardless: a mock binding with the invalid PID `not-a-pid` reproduced this false success without targeting a real process.

**Recommendation:** preserve and check command exit statuses, distinguish registry failure from an empty registry, validate PIDs, and report stop success only after successful termination. Treat unexpected CLI diagnostics as errors, not project names.

**Resolution:** added small fail-fast exit-status checks to the Unix and PowerShell lifecycle scripts. Startup now fails on a silent initial check error, failed launch, or unsuccessful final readiness check. Shutdown distinguishes registry/JSON failures from an empty registry and no longer prints `stopped` after a failed signal; Unix parent PIDs are validated before signalling. Launch helpers now propagate immediate terminal-launch failures. The original `ppid` behavior and polling strategy are unchanged; no process inspection or termination-wait loop was added. Finding 3 subsequently removed the startup stderr splitting and rejects unexpected diagnostics before launching. All 13 isolated Unix mock checks passed without signalling real processes. PowerShell changes remain unverified on Windows.

### 3. High: Project Paths Lose Argument Boundaries

**Locations:** `scripts/cds-start:19–23`; `scripts/cds-launch:11–12,25–26`; `scripts/cds-start.ps1:18–20`; `scripts/cds-launch.ps1:14–24`.

With the quoted argument `"my project"`, mocked Unix discovery caused `cds-start` to open two launch requests: `cds watch my` and `cds watch project`. Even direct `cds-launch "my project"` embeds the unquoted command `cds watch my project`. The PowerShell scripts also split stderr on whitespace and interpolate project arguments into command strings.

Shell metacharacters and quotes additionally cross shell/AppleScript/PowerShell parsing boundaries unsafely.

**Recommendation:** retain an argument array, rather than reparsing human-readable stderr. Escape project paths and cwd for each interpreter boundary; test spaces, apostrophes, symlinks, and absolute paths.

**Resolution:** startup now checks each original project argument individually, launches it only when the CLI reports that exact argument missing, and rejects other diagnostics. No whitespace splitting is used. This trades one initial batch check for one check per project; the readiness loop still checks the full list. The macOS launcher passes cwd, project and title as AppleScript arguments and uses `quoted form` for the shell command. The PowerShell launcher single-quotes literal paths and passes a UTF-16LE encoded command to both terminal variants, avoiding outer command-string quoting. Mocked Unix checks covered spaces, apostrophes, double quotes, shell metacharacters, absolute paths, symlinks, skipping existing servers, rejecting diagnostics, and the Terminal branch. Actual AppleScript shell-quoting roundtrips preserved all tested arguments. The 13 finding-2 checks also still pass. No terminal windows were opened; Windows changes remain unverified.

### 4. Medium: Platform Support Is Overstated

**Locations:** `SKILL.md:14–16,64,96–100`; `scripts/cds-launch`; `scripts/cds-stop.ps1:15–29`; `scripts/close-terminals.ps1:13–20`.

The non-Windows launcher is macOS-only: both branches require `osascript`. Linux/headless environments have no main-skill fallback link, although `reference/background.md` exists. The Windows shutdown script explicitly leaves windows open, contrary to the main skill's general promise to close them.

Windows shutdown also derives basenames and matches command lines with `cds\s+watch\s+<project>`. This loses full-root identity, can confuse identical basenames, and does not match the conventional `node …\bin\cds.js watch <project>` form. Paths and `.` need not match the launcher's original spelling. These are source-level risks, not Windows execution results.

**Recommendation:** state macOS terminal support explicitly, link the background alternative, and document Windows limitations. Prefer registry PID/root identity over process-name regex matching.

**Resolution:** the background reference identifies macOS/Windows terminal launching and the Linux/headless alternative. The proposed main-skill fallback link was not retained. Added Windows stopping caveats were reverted at the user's request to keep the instructions concise; the main skill states only that macOS stopping also closes associated terminal windows. The background example now actually backgrounds the process, and log viewing no longer assumes GUI terminal scripts work on Linux. No platform or shutdown logic was added; Windows PID/root-based matching remains deferred.

### 5. Medium: “Pure Liveness Ping” Is Misleading

**Locations:** `reference/manual.md:13,19,31,39`; startup script comments. The main `SKILL.md:54–59` correctly describes found stdout and missing stderr.

The installed `cds bindings --check` emits found project paths on stdout plus blank lines; it does not suppress stdout as the manual claims. Registry import checks whether registered server PIDs exist using `ps`/`tasklist`; it does not make an HTTP health request. Registration occurs after listening, so this is a useful startup signal, but not an ongoing service-readiness probe.

With no bindings, empty-argument `cds bindings --check` returned exit 0 and three newline characters. It does not wait for an intended project that has never registered. Also, `cds-start` does not print the registry as the manual implies; the main skill correctly requires a subsequent fetch.

**Recommendation:** describe this as a registry/PID check, reconcile stdout and registry-print claims, and require explicit projects for startup waits. Keep an HTTP probe conditional on tasks that actually need stronger readiness assurance.

### 6. Medium: Ephemeral Data Is a Configuration Assumption

**Locations:** `SKILL.md:92`; `reference/manual.md:55–61`.

`cds watch` defaults to `--in-memory?`, not unconditional `--in-memory`: configured database implementations and credentials can remain in effect. Therefore “data … vanishes on restarts” and “Local servers use an in-memory db” are not universally true. The instruction never to mention data loss is also too broad when the user explicitly needs preservation.

The preservation recipe does not say where CSV copies go. Writing copies beneath a watched, non-ignored project directory can itself trigger reload/reseed while later tables are still being exported.

**Recommendation:** qualify the data statement for in-memory configurations, honor explicit preservation requests, and stage exports outside the watched tree before stopping and replacing originals.

**Resolution:** the main skill now qualifies the statement as in-memory data and permits explicit user requests. The warning against unsolicited persistence remains intentional: some models otherwise write runtime changes back to CSV eagerly. The manual's CSV staging recipe is unchanged; the outside-watched-tree recommendation remains outstanding.

### 7. Medium: The Upgrade Hint May Not Fix the Failed Gate

**Location:** `SKILL.md:7`.

The tested `cds version -c 10.2.x` correctly accepts 10.3.0; the `.x` spelling is not an exact-minor constraint. However, the CLI prefers project-local `@sap/cds`. Upgrading global `@sap/cds-dk` alone need not fix a check failing against an old local runtime. Scripts can also launch other roots whose runtime versions were not checked from the original cwd.

**Recommendation:** identify whether the failing requirement is the CLI or the selected project's runtime and provide the appropriate upgrade hint. Keep installation user-controlled; check additional roots when their versions matter to the requested operation.

**Resolution:** no skill change requested. Retain the single version check and concise upgrade hint to keep the common path simple. The project-local dependency caveat remains valid, but does not justify adding discovery branches or per-project version checks to this skill.

## Costs

### Avoid Unnecessary Discovery and Interaction

- `SKILL.md:73` fetches the entire registry after startup. Prefer `cds bindings <projects>` when only those projects matter; reuse it in HCQL discovery rather than fetching again without a reason. Retain global discovery for genuinely global tasks.
- `SKILL.md:72` lists every child directory and offers up to 11, including potentially `node_modules`, generated folders, or non-CAP repositories. Select plausible CAP roots with shallow checks; do not recursively inspect everything.
- `SKILL.md:20` mandates repeated menus until Escape. Offer a menu for an otherwise unspecified invocation, but stop when the requested task finishes or the user declines. Repeated question turns add latency and token costs without advancing a completed task.

### Polling Is Bounded by Iterations, Not Wall Time

Unix startup performs one initial check plus up to 30 poll checks; PowerShell adds a final check. Each check starts Node, reads the registry, and enumerates processes. On this machine individual registry calls took about 0.14–0.16 seconds. An unsuccessful Unix startup can thus take roughly 20 seconds after launching, not merely 15; terminal-launch time and a stalled individual command are not bounded by the loop.

Keep the scripted poll and one final registry fetch: this avoids many agent tool turns and repeatedly importing large JSON. Correct “never hangs”/“15s budget” claims. Add a deadline or per-command timeout if a hard limit is required; do not add extra health requests to every normal startup solely for completeness.

## Context/Token Cost

Measured the original reviewed snapshot, before the subsequent edits, with `tiktoken` 0.14.0 on 2026-10-28:

| Loaded content | `o200k_base` | `cl100k_base` |
|---|---:|---:|
| Main skill, full file | 1,075 | 1,084 |
| Main skill, body only | 1,024 | 1,033 |
| Manual reference | 915 | 922 |
| Background reference | 206 | 205 |
| Main + HCQL + CQL skills, full files | 4,867 | 4,896 |

Counts are exact for these tokenizers and this snapshot, excluding loader wrappers, tool output, and conversation overhead. They are not verified token counts for `gpt-6.1-sol`; dollar costs depend on the model, caching, and provider rates.

About 1.1k tokens is reasonable for the main skill. Keep references and scripts on demand, and load HCQL/CQL only for consumption that needs them. Prioritize reliable scripts and scoped discovery over shortening useful instructions.
