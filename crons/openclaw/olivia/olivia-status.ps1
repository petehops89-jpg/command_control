# Olivia Daily Status — sends a system status message to Olivia every day at 18:30 AEST
# Olivia processes it and posts a reply to the command portal

param(
    [string]$Action = "send"
)

function Send-StatusMessage {
    $branches = git branch -a 2>&1 | Out-String
    $currentBranch = git rev-parse --abbrev-ref HEAD 2>&1
    $lastCommit = git log -1 --format="%s (%h, %ar)" 2>&1
    $status = git status --short 2>&1
    $changed = ($status | Where-Object { $_ -ne '' } | Measure-Object).Count
    $dockerCheck = docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>&1 | Out-String

    $message = @"
Daily System Status Report — 18:30 AEST

Branch: $currentBranch
Last commit: $lastCommit
Uncommitted changes: $changed file(s)

Containers:
$dockerCheck

Branches:
$branches

Git strategy tasks to discuss:
- main always current/complete site
- Stages downstream (evidence-registry, publishing-engine-v2)
- Merge vs rebase strategy
- Review: is 'downstream' the correct term?

Olivia, review and reply with suggestions.
"@

    $body = @{
        from = "Pete"
        message = $message
        timestamp = (Get-Date).ToString("o")
    } | ConvertTo-Json

    try {
        $result = Invoke-RestMethod -Uri "http://localhost/api/olivia/respond" -Method POST -Body $body -ContentType "application/json"
        Write-Host "[OK] Status message sent. TaskId: $($result.taskId)"
    } catch {
        Write-Host "[ERROR] Failed to send: $_"
    }
}

function Register-Schedule {
    Write-Host "Registering Olivia daily status task (every day at 18:30 AEST)..."

    $TaskName = "Vistamations-OliviaStatus"
    $ScriptPath = $MyInvocation.MyCommand.Path
    $PwshPath = (Get-Command pwsh).Source

    $Action = New-ScheduledTaskAction -Execute $PwshPath `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" -Action send" `
        -WorkingDirectory "C:\vistamations-music"

    $Trigger = New-ScheduledTaskTrigger -Daily -At "18:30"

    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances Queue `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 3)

    try {
        Register-ScheduledTask -TaskName $TaskName `
            -Action $Action `
            -Trigger $Trigger `
            -Principal $Principal `
            -Settings $Settings `
            -Description "Vistamations Olivia daily status — sends system report to Olivia every day at 18:30 AEST" `
            -Force
        Write-Host "[OK] Task '$TaskName' registered. Every day at 18:30 AEST."
    } catch {
        Write-Host "[ERROR] Failed to register: $_"
    }
}

function Unregister-Schedule {
    try {
        Unregister-ScheduledTask -TaskName "Vistamations-OliviaStatus" -Confirm:$false -ErrorAction Stop
        Write-Host "[OK] Olivia status task removed."
    } catch {
        Write-Host "[INFO] Task not found or already removed."
    }
}

switch ($Action) {
    "send"       { Send-StatusMessage }
    "register"   { Register-Schedule }
    "unregister" { Unregister-Schedule }
    "status" {
        try {
            $task = Get-ScheduledTask -TaskName "Vistamations-OliviaStatus" -ErrorAction Stop
            Write-Host "Task: $($task.TaskName)"
            Write-Host "State: $($task.State)"
            Write-Host "Next Run: $($task.NextRunTime)"
        } catch {
            Write-Host "Task not currently registered."
        }
    }
    default {
        Write-Host 'Usage: .\olivia-status.ps1 -Action [send|register|unregister|status]'
    }
}
