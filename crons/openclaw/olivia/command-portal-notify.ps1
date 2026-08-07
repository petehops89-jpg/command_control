<#
.SYNOPSIS
  Command Portal — fires a Windows notification to Pete with a Respond button.
  Click opens the Command Portal where Pete types and Olivia routes to agents.
  Tracks the 1-hour response window via /olivia/notified.

.PARAMETER Message
  The notification body text.

.PARAMETER Subject
  Short subject line for the notification.

.EXAMPLE
  .\command-portal-notify.ps1 -Subject "Container rebuilt" -Message "App container is live. All 3 API endpoints verified."
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Message,

    [Parameter(Mandatory=$false)]
    [string]$Subject = "Olivia - Vistamations"
)

$portalUrl = "http://localhost/crons/openclaw/olivia/command-portal.html"

$btn = New-BTButton -Content "Respond" -Arguments $portalUrl

New-BurntToastNotification `
    -Text $Subject, $Message `
    -Button $btn

# Track the notification for 1-hour response window
try {
    $body = @{ subject=$Subject; message=$Message; sentAt=(Get-Date -Format "o") } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost/api/olivia/notified" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 3 | Out-Null
} catch { }

Write-Output "Notification fired: $Subject"
