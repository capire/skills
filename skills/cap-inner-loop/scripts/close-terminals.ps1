# Stops `cds watch` servers on Windows, by project name.
# Unix identifies windows by tty; Windows has none and Windows Terminal shares
# one process across tabs, so we can't safely close an individual tab/window.
# Instead this stops the server process itself: in a wt tab the command ends
# (the tab stays, close it manually); a fallback PowerShell window stays open.
# Usage:  close-terminals.ps1 <project1> <project2> ...
#
# NOTE: Authored on macOS and not yet verified on Windows. Before relying on it,
# confirm the regex below matches a real `cds watch` node.exe command line.

param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Projects)

foreach ($project in $Projects) {
    $pattern = "cds\s+watch\s+$([regex]::Escape($project))(\s|$)"
    $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop |
        Where-Object { $_.CommandLine -match $pattern }

    if ($procs) {
        foreach ($p in $procs) {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
        }
        Write-Output "stopped $project"
    }
    else {
        Write-Error "not found: $project"; exit 1
    }
}
