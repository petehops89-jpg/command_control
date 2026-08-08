# Big Brother - Google Docs Daily Reader (Scheduled Task)
# Reads 10,000 words/day from Google Docs, discerns Vistamations relevance,
# reports to Olivia via /api/olivia/respond.
# Schedule: daily at 08:00 AEST

param(
    [string]$Action = "register"
)

$TaskName = "Vistamations-BigBrother-DocsReader"
$NodePath = (Get-Command node).Source
$ScriptPath = "C:\vistamations-music\scripts\google-docs-reader.js"
$PwshPath = (Get-Command pwsh).Source
$ThisScriptPath = $MyInvocation.MyCommand.Path

function Invoke-DocsReader {
    Write-Host "[BB-READER $(Get-Date -Format 'HH:mm:ss')] Starting Google Docs daily read..."
    $result = & $NodePath $ScriptPath 2>&1
    Write-Host $result
    Write-Host "[BB-READER] Complete."
}

function Register-Schedule {
    Write-Host "Registering Big Brother Google Docs Daily Reader (08:00 AEST)..."

    $Action = New-ScheduledTaskAction -Execute $PwshPath `
        -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ThisScriptPath`" -Action run" `
        -WorkingDirectory "C:\vistamations-music"

    $Trigger = New-ScheduledTaskTrigger -Daily -At "08:00"

    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances Queue `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

    try {
        Register-ScheduledTask -TaskName $TaskName `
            -Action $Action `
            -Trigger $Trigger `
            -Principal $Principal `
            -Settings $Settings `
            -Description "Big Brother Google Docs Daily Reader - reads 10K words/day, discerns Vistamations relevance, reports to Olivia" `
            -Force
        Write-Host "[OK] Task '$TaskName' registered. Daily at 08:00 AEST."
    } catch {
        Write-Host "[ERROR] $_"
    }
}

function Unregister-Schedule {
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
        Write-Host "[OK] Task removed."
    } catch {
        Write-Host "[INFO] Task not found."
    }
}

switch ($Action) {
    "run"        { Invoke-DocsReader }
    "register"   { Register-Schedule }
    "unregister" { Unregister-Schedule }
    "status" {
        try {
            $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
            Write-Host "Task: $($task.TaskName)"
            Write-Host "State: $($task.State)"
            Write-Host "Next Run: $($task.NextRunTime)"
        } catch {
            Write-Host 'Task not currently registered.'
        }
    }
    default      { Write-Host 'Usage: .\big-brother-docs-reader.ps1 -Action [run|register|unregister|status]' }
}
