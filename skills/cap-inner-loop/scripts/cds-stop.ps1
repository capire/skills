# Stops CAP servers for the given projects (Windows).
# On Unix `cds-stop` kills by ppid and closes windows by tty; Windows has no
# ttys and Windows Terminal shares one process across tabs, so we stop the
# server processes by project name via close-terminals.ps1 (tabs/windows stay —
# close them manually). With no args, stops ALL running servers (project names are
# derived from the basenames of each server.root in `cds bindings`).
# Usage:  cds-stop.ps1 <project1> <project2> ...
#
# NOTE: Authored on macOS and not yet verified on Windows.

param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Projects)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $Projects) {
    # Derive project names from the basenames of all running server roots.
    $json = (& cds bindings --get servers)
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    try { $b = $json | ConvertFrom-Json -ErrorAction Stop }
    catch { Write-Error "invalid CAP bindings JSON"; exit 1 }
    $Projects = @()
    if ($b -and $b.servers) {
        foreach ($srv in $b.servers.PSObject.Properties.Value) {
            $Projects += (Split-Path -Leaf ($srv.root -replace '/', '\'))
        }
    }
}

if (-not $Projects) { Write-Output "no running servers matched"; exit 0 }

& "$here/close-terminals.ps1" @Projects
if (-not $?) { exit 1 }
