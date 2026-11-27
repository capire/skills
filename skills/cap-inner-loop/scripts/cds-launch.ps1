# Starts one `cds watch` per project, each in its own Windows Terminal tab
# (falls back to a separate PowerShell window if wt.exe is unavailable).
# Usage:  cds-launch.ps1 <project1> <project2> ...
#
# NOTE: Authored on macOS and not yet verified on Windows. Before relying on it,
# confirm the wt tab opens in the right directory and runs `cds watch`.

param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Projects)

$cwd = (Get-Location).Path

foreach ($project in $Projects) {
    $projectname = Split-Path -Leaf $project
    $cmd = "Set-Location -LiteralPath '$($cwd.Replace("'", "''"))'; cds watch '$($project.Replace("'", "''"))'"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
    if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
        # Open in a tab of the existing/most-recent Windows Terminal window.
        wt.exe --window 0 new-tab --title "$projectname" --startingDirectory "$cwd" `
            powershell -NoExit -EncodedCommand $encoded
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    else {
        # Fallback: a separate PowerShell window.
        Start-Process powershell -ErrorAction Stop -ArgumentList @(
            '-NoExit', '-EncodedCommand', $encoded
        )
    }
    Write-Output "started $project"
}
exit 0
