# Git auto-commit and push — scheduled every 2 days at 18:00 AEST
# Commits all changes on the current branch and pushes to origin

param(
    [string]$Action = "commit"
)

$RepoRoot = "C:\vistamations-music"

function Invoke-GitCommit {
    Set-Location -LiteralPath $RepoRoot

    $gitStatus = git status --porcelain 2>&1
    if (-not $gitStatus) {
        Write-Host "[SKIP] No changes to commit."
        return
    }

    $changed = ($gitStatus | Measure-Object).Count
    Write-Host "[COMMIT] $changed file(s) changed. Staging all..."

    git add -A 2>&1 | Out-Null

    $branch = git rev-parse --abbrev-ref HEAD 2>&1
    $dateStr = (Get-Date).ToString('yyyy-MM-dd HH:mm')
    $commitMsg = "Auto-commit [$dateStr AEST] - routine sync, branch: $branch"

    git commit -m $commitMsg 2>&1 | Out-Null

    Write-Host "[PUSH] Pushing to origin/$branch..."
    git push origin $branch 2>&1

    Write-Host "[OK] Committed and pushed."
}

function Register-Schedule {
    Write-Host "Registering Git auto-commit scheduled task (every 2 days at 18:00 AEST)..."

    $TaskName = "Vistamations-GitCommit"
    $ScriptPath = $MyInvocation.MyCommand.Path
    $PwshPath = (Get-Command pwsh).Source

    $Action = New-ScheduledTaskAction -Execute $PwshPath `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" -Action commit" `
        -WorkingDirectory $RepoRoot

    $Trigger = New-ScheduledTaskTrigger -Daily -At "18:00" -DaysInterval 2

    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances Queue `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

    try {
        Register-ScheduledTask -TaskName $TaskName `
            -Action $Action `
            -Trigger $Trigger `
            -Principal $Principal `
            -Settings $Settings `
            -Description "Vistamations Git auto-commit — stages all changes and pushes to origin every 2 days at 18:00 AEST" `
            -Force
        Write-Host "[OK] Task '$TaskName' registered. Every 2 days at 18:00 AEST."
    } catch {
        Write-Host "[ERROR] Failed to register: $_"
    }
}

function Unregister-Schedule {
    try {
        Unregister-ScheduledTask -TaskName "Vistamations-GitCommit" -Confirm:$false -ErrorAction Stop
        Write-Host "[OK] Git commit task removed."
    } catch {
        Write-Host "[INFO] Task not found or already removed."
    }
}

switch ($Action) {
    "commit"     { Invoke-GitCommit }
    "register"   { Register-Schedule }
    "unregister" { Unregister-Schedule }
    "status" {
        try {
            $task = Get-ScheduledTask -TaskName "Vistamations-GitCommit" -ErrorAction Stop
            Write-Host "Task: $($task.TaskName)"
            Write-Host "State: $($task.State)"
            Write-Host "Next Run: $($task.NextRunTime)"
        } catch {
            Write-Host "Task not currently registered."
        }
    }
    default {
        Write-Host "Usage: .\git-commit-schedule.ps1 -Action [commit|register|unregister|status]"
    }
}
