# Starts CAP servers for the given projects and confirms they're up (Windows).
# Mirror of the POSIX `cds-start`: skips already-running projects, starts only the
# missing ones via cds-launch.ps1, then runs a bounded readiness poll using
# `cds bindings -c` (a pure liveness ping: exit 0 once all up, still-down
# projects on stderr otherwise). Exits 0 on success, 1 on timeout.
# Usage:  cds-start.ps1 <project1> <project2> ...
#
# NOTE: Authored on macOS and not yet verified on Windows. Before relying on it,
# confirm cds-launch.ps1 opens the tabs and that `cds bindings -c` exit codes work.

param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Projects)

if (-not $Projects) { Write-Error "usage: cds-start.ps1 <project> ..."; exit 2 }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check each original argument; never turn CLI diagnostics into project names.
foreach ($project in $Projects) {
    $missing = (& cds bindings -c $project 2>&1 1>$null) -join "`n"
    if ($LASTEXITCODE -eq 0) { continue }
    if ($missing -cne $project) { Write-Error "failed to check CAP bindings: $missing"; exit 1 }
    & "$here/cds-launch.ps1" $project
    if (-not $?) { exit 1 }
}

# Bounded poll: ~15s budget at 0.5s steps. `--check` is a pure ping over the
# full list each time; exit 0 once all up.
for ($i = 0; $i -lt 30; $i++) {
    & cds bindings -c @Projects 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 500
}

# Did everything come up?
$down = (& cds bindings -c @Projects 2>&1 1>$null) -join " "
if ($LASTEXITCODE -ne 0) {
    Write-Error "timeout: these projects never came up: $down"
    exit 1
}
