# OpenClaw Scheduled Publishing Engine
# Schedule: 09:00 | 12:00 | 15:00 | 18:00 Australia/Sydney daily
# Uses Windows Task Scheduler to trigger Node.js runtime

param(
    [string]$Action = "register"
)

$TaskName = "Vistamations-OpenClaw-PublishingEngine"
$ScriptPath = "C:\vistamations-music\crons\openclaw\runtime.js"
$NodePath = (Get-Command node).Source
$WorkingDir = "C:\vistamations-music\crons\openclaw"
$LogDir = "$WorkingDir\logs"

function Register-Schedule {
    Write-Host "Registering OpenClaw scheduled publishing engine..."

    $Action = New-ScheduledTaskAction -Execute $NodePath `
        -Argument "`"$ScriptPath`"" `
        -WorkingDirectory $WorkingDir

    $Trigger = New-ScheduledTaskTrigger -Daily -At "09:00"
    $Trigger2 = New-ScheduledTaskTrigger -Daily -At "12:00"
    $Trigger3 = New-ScheduledTaskTrigger -Daily -At "15:00"
    $Trigger4 = New-ScheduledTaskTrigger -Daily -At "18:00"

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
            -Trigger $Trigger, $Trigger2, $Trigger3, $Trigger4 `
            -Principal $Principal `
            -Settings $Settings `
            -Description "Vistamations OpenClaw LLM Scheduled Publishing Engine — 4 daily executions" `
            -Force
        Write-Host "[OK] Task '$TaskName' registered successfully."
        Write-Host "     Schedule: Daily at 09:00, 12:00, 15:00, 18:00 AEST"
    } catch {
        Write-Host "[ERROR] Failed to register task: $_"
    }
}

function Unregister-Schedule {
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
        Write-Host "[OK] Task '$TaskName' removed."
    } catch {
        Write-Host "[INFO] Task '$TaskName' not found or already removed."
    }
}

function Test-Run {
    Write-Host "Running manual test execution..."
    & $NodePath $ScriptPath
}

switch ($Action) {
    "register" { Register-Schedule }
    "unregister" { Unregister-Schedule }
    "test" { Test-Run }
    "status" {
        try {
            $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
            Write-Host "Task: $($task.TaskName)"
            Write-Host "State: $($task.State)"
            Write-Host "Next Run: $($task.NextRunTime)"
            $task.Triggers | ForEach-Object {
                Write-Host "  Trigger: Daily at $($_.StartBoundary.Substring(11,5))"
            }
        } catch {
            Write-Host "[INFO] Task '$TaskName' is not registered."
        }
    }
    default {
        Write-Host "Usage: .\schedule.ps1 -Action [register|unregister|test|status]"
    }
}
