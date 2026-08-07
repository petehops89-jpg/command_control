<#
.SYNOPSIS
  Olivia Gate — fires a Windows notification to Pete with a respond button.
  Click opens the Olivia Gate response form where Pete types and Olivia routes.

.PARAMETER Message
  The notification body text.

.PARAMETER Subject
  Short subject line for the notification.

.PARAMETER Context
  Longer context passed to the response form so Pete knows what he's responding to.

.EXAMPLE
  .\olivia-notify.ps1 -Subject "Stage 3 scoped" -Message "5 open questions need your input" -Context "Stage 3.1 MODULES, 3.2 COMMUNITY, 3.3 SECURITY sequenced. Need decision on dashboard replacement, Olivia delivery channel, and INDEPENDENT LEARNING scope."

  .\olivia-notify.ps1 -Subject "Container rebuild" -Message "App container is stale — API returning 404" -Context "server.js has Olivia Gate routes added. Container needs rebuild to pick them up. docker compose up -d --build app"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Message,

    [Parameter(Mandatory=$false)]
    [string]$Subject = "Olivia - Vistamations",

    [Parameter(Mandatory=$false)]
    [string]$Context = ""
)

$gateUrl = "http://localhost/crons/openclaw/olivia/olivia-gate.html"
if ($Context) {
    $encodedMsg = [System.Web.HttpUtility]::UrlEncode($Context)
    $encodedSubject = [System.Web.HttpUtility]::UrlEncode($Subject)
    $gateUrl = "$gateUrl" + "?msg=$encodedMsg&subject=$encodedSubject"
}

$button = New-BTButton -Content "Respond" -Arguments $gateUrl

New-BurntToastNotification `
    -Text $Subject, $Message `
    -Button $button `
    -AppLogo "C:\vistamations-music\images\command-control.png"

Write-Output "Notification fired: $Subject"
Write-Output "Gate URL: $gateUrl"
