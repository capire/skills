# Opens one `tail -f` (Get-Content -Wait) per log file, each in its own
# Windows Terminal tab (falls back to a separate PowerShell window if wt.exe
# is unavailable).
# Usage:  watch-log.ps1 <logfile1> <logfile2> ...
#
# NOTE: Authored on macOS and not yet verified on Windows. Before relying on it,
# confirm the wt tab opens and follows the log file.

param([Parameter(ValueFromRemainingArguments = $true)][string[]]$LogFiles)

foreach ($logfile in $LogFiles) {
    $cmd = "Get-Content -Path '$logfile' -Wait -Tail 10"
    if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
        # Open in a tab of the existing/most-recent Windows Terminal window.
        wt.exe --window 0 new-tab --title "$logfile" `
            powershell -NoExit -Command $cmd
    }
    else {
        # Fallback: a separate PowerShell window.
        Start-Process powershell -ArgumentList @(
            '-NoExit', '-Command', $cmd
        )
    }
    Write-Output "watching $logfile"
}
