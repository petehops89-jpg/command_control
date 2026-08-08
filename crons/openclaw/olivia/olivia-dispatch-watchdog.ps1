# Olivia Dispatch Watchdog — checks every 5 minutes that the dispatch loop is alive
# If dead, restarts it. Runs as a scheduled task (every 5 min, starts at logon).
# This is the crash-recovery net for the persistent 10s dispatch process.

param(
    [string]$Action = "register"
)

$ScriptPath = "C:\vistamations-music\crons\openclaw\olivia\olivia-dispatch.ps1"
$PwshPath = (Get-Command pwsh).Source

function Invoke-Watchdog {
    $active = Get-WmiObject Win32_Process -Filter "CommandLine LIKE '%olivia-dispatch.ps1%'" | Where-Object { $_.ProcessId -ne $PID }

    if (-not $active) {
        Write-Host "[WATCHDOG $(Get-Date -Format 'HH:mm:ss')] Dispatch process not found. Starting..."
        try {
            Start-Process -FilePath $PwshPath `
                -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`"" `
                -WindowStyle Hidden
            Write-Host "[WATCHDOG] Restarted."
        } catch {
            Write-Host "[WATCHDOG] Start failed: $_"
        }
    } else {
        Write-Host "[WATCHDOG $(Get-Date -Format 'HH:mm:ss')] Dispatch alive. PID $($active.ProcessId)"
    }
}

function Register-Watchdog {
    Write-Host "Registering Olivia Dispatch Watchdog (every 5 min)..."

    $TaskName = "Vistamations-OliviaWatchdog"
    $ThisScriptPath = $MyInvocation.MyCommand.Path

    $Action = New-ScheduledTaskAction -Execute $PwshPath `
        -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ThisScriptPath`" -Action check" `
        -WorkingDirectory "C:\vistamations-music"

    $Trigger = New-ScheduledTaskTrigger -Daily -At "00:00" -DaysInterval 1
    $Trigger.Repetition = (New-ScheduledTaskTrigger -Once -At "00:00" -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)).Repetition

    $Principal = New-ScheduledTaskPrincipal -UserId "VISTA-PRIME-I5\peteh" -LogonType Interactive

    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

    try {
        Register-ScheduledTask -TaskName $TaskName `
            -Action $Action `
            -Trigger $Trigger `
            -Principal $Principal `
            -Settings $Settings `
            -Description "Vistamations Olivia Dispatch Watchdog — restarts dispatch loop if crashed, runs every 5 min" `
            -Force
        Write-Host "[OK] Watchdog '$TaskName' registered. Every 5 min."
    } catch {
        Write-Host "[ERROR] $_"
    }
}

function Unregister-Watchdog {
    try {
        Unregister-ScheduledTask -TaskName "Vistamations-OliviaWatchdog" -Confirm:$false -ErrorAction Stop
        Write-Host "[OK] Watchdog task removed."
    } catch {
        Write-Host "[INFO] Not found."
    }
}

switch ($Action) {
    "check"      { Invoke-Watchdog }
    "register"   { Register-Watchdog }
    "unregister" { Unregister-Watchdog }
    default      { Write-Host "Usage: .\watchdog.ps1 -Action [check|register|unregister]" }
}
