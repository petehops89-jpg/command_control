<#
.SYNOPSIS
  Watches for agent replies via /api/olivia/pending-replies and fires
  BurntToast notifications to Pete when agents respond.

.DESCRIPTION
  Polls every 10 seconds. Tracks which replies have already been notified.
  When a new agentReply appears, fires a notification with the agent name,
  the response snippet, and a Respond button that opens the Command Portal.

  Run this as a background process or via Task Scheduler.
#>

$portalUrl = "http://localhost/crons/openclaw/olivia/command-portal.html"
$apiUrl = "http://localhost/api/olivia/pending-replies"
$stateFile = Join-Path $PSScriptRoot "reply-watcher-state.json"

$lastSeen = @{}
if (Test-Path $stateFile) {
    try { $lastSeen = Get-Content $stateFile | ConvertFrom-Json -AsHashtable } catch { $lastSeen = @{} }
}

while ($true) {
    try {
        $replies = Invoke-RestMethod -Uri $apiUrl -Method GET -TimeoutSec 5

        foreach ($reply in $replies) {
            $key = $reply.id + ":" + $reply.agentReply.from
            if ($lastSeen.ContainsKey($key)) { continue }

            # Only Olivia notifies Pete — she reports agent activity
            if ($reply.agentReply.from -ne 'olivia') {
                $lastSeen[$key] = $true
                continue
            }

            $msg = $reply.agentReply.message
            $short = if ($msg.Length -gt 80) { $msg.Substring(0, 77) + "..." } else { $msg }

            $subject = "Olivia — Report"
            $body = "$short"

            $respondUrl = "$portalUrl" + "?resp=" + $reply.id

            $btn = New-BTButton -Content "View Reply" -Arguments $respondUrl

            $id = "vistamations-olivia-" + $reply.id

            New-BurntToastNotification `
                -Text $subject, $body `
                -Button $btn `
                -UniqueIdentifier $id `
                -AppId "Vistamations.CommandPortal" `
                -Silent

            $lastSeen[$key] = $true
            Write-Host "$(Get-Date -Format 'HH:mm:ss') Notified: $subject"
        }

        $lastSeen | ConvertTo-Json | Set-Content $stateFile
    } catch {
        # API not yet available, keep polling
    }

    Start-Sleep -Seconds 10
}
