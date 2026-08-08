# At-boot + repeating starter for Olivia Dispatch Watcher
# Registered in Windows Task Scheduler, fires daily and repeats every 5 min
# Uses IgnoreNew: if already running, skips
# Starts the 10s polling loop as a background PowerShell process

param(
    [string]$Action = "register"
)

$PwshPath = (Get-Command pwsh).Source
$ScriptPath = "C:\vistamations-music\crons\openclaw\olivia\olivia-dispatch.ps1"

function Register-LogonTask {
    Write-Host "Registering Olivia Dispatch (daily repeat every 5 min)..."

    $TaskName = "Vistamations-OliviaDispatch"

    $Action = New-ScheduledTaskAction -Execute $PwshPath `
        -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`"" `
        -WorkingDirectory "C:\vistamations-music"

    $Trigger = New-ScheduledTaskTrigger -Daily -At "00:00" -DaysInterval 1
    $Trigger.Repetition = (New-ScheduledTaskTrigger -Once -At "00:00" -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)).Repetition

    $Principal = New-ScheduledTaskPrincipal -UserId "VISTA-PRIME-I5\peteh" -LogonType Interactive

    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit (New-TimeSpan -Days 365)

    try {
        Register-ScheduledTask -TaskName $TaskName `
            -Action $Action `
            -Trigger $Trigger `
            -Principal $Principal `
            -Settings $Settings `
            -Description "Vistamations Olivia Dispatch - polls responses.json every 10s, daily repeat every 5 min" `
            -Force
        Write-Host "[OK] Task '$TaskName' registered. Daily repeat every 5 min, MultipleInstances=IgnoreNew."
    } catch {
        Write-Host "[ERROR] $_"
    }
}

function Unregister-Task {
    try {
        Unregister-ScheduledTask -TaskName "Vistamations-OliviaDispatch" -Confirm:$false -ErrorAction Stop
        Write-Host "[OK] Task removed."
    } catch {
        Write-Host "[INFO] Task not found."
    }
}

switch ($Action) {
    "register"   { Register-LogonTask }
    "unregister" { Unregister-Task }
    default      { Write-Host 'Usage: .\olivia-dispatch-login.ps1 -Action [register|unregister]' }
}
