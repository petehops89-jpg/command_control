# Olivia Dispatch Watcher — polls responses.json every 10s for unprocessed messages
# Detects "received" entries, flags them, and for known simple patterns POSTs replies
# For complex tasks that need agent delegation, logs and waits for /olivia-process in Kilo
# Start: runs as persistent background process, Task Scheduler at logon

$ResponsesPath = "C:\vistamations-music\crons\openclaw\olivia\responses.json"
$ApiBase = "http://localhost/api/olivia"
$PollInterval = 10

$ts = Get-Date -Format 'HH:mm:ss'
Write-Host "[OLIVIA-DISPATCH $ts] Watching $ResponsesPath every ${PollInterval}s..."

$processedIds = @{}

while ($true) {
    try {
        if (-not (Test-Path $ResponsesPath)) {
            Start-Sleep -Seconds $PollInterval
            continue
        }

        $data = Get-Content -Raw -LiteralPath $ResponsesPath | ConvertFrom-Json
        $unprocessed = @($data | Where-Object { $_.status -eq "received" -and (-not $_.agentReply) })

        foreach ($entry in $unprocessed) {
            if ($processedIds.ContainsKey($entry.id)) { continue }
            $processedIds[$entry.id] = $true

$ts = Get-Date -Format 'HH:mm:ss'
            Write-Host "[OLIVIA-DISPATCH $ts] NEW: $($entry.id) — '$($entry.message.Substring(0, [Math]::Min(50, $entry.message.Length)))...'"

            $subject = $entry.message.ToLower()

            $reply = $null

            # Simple patterns handled directly
            if ($subject -match "status|health check|container" -and -not ($subject -match "git|branch|merge|commit")) {
                try {
                    $containers = docker compose ps --format json 2>&1 | ConvertFrom-Json
                    $lines = @()
                    foreach ($c in $containers) {
                        $lines += "  - $($c.Service): $($c.State) — $($c.Status)"
                    }
                    $reply = "Health check:`n`n$($lines -join "`n")`n`nAll containers reporting."
                } catch {
                    Write-Host "[OLIVIA-DISPATCH] Docker check failed: $_"
                }
            }
            elseif ($subject -match "confirm|received|testing|test") {
                $reply = "Message received and logged. I'll route this to the appropriate agents. —Olivia"
            }
            elseif ($subject -match "stand\s*by|good work") {
                $reply = "Standing by. Let me know when you're ready. —Olivia"
            }

            if ($reply) {
                try {
                    $body = @{
                        responseId = $entry.id
                        agent = "olivia"
                        message = $reply
                    } | ConvertTo-Json

                    $result = Invoke-RestMethod -Uri "$ApiBase/agent-reply" -Method POST -Body $body -ContentType "application/json"
                    $ts = Get-Date -Format 'HH:mm:ss'
                    Write-Host "[OLIVIA-DISPATCH $ts] REPLY SENT: $($entry.id) — $($result.ok)"
                } catch {
                    $ts = Get-Date -Format 'HH:mm:ss'
                    Write-Host "[OLIVIA-DISPATCH $ts] REPLY FAILED: $_"
                }
            } else {
                $ts = Get-Date -Format 'HH:mm:ss'
                Write-Host "[OLIVIA-DISPATCH $ts] QUEUED: $($entry.id) needs agent delegation — run /olivia-process in Kilo Code"
            }
        }

    } catch {
        $ts = Get-Date -Format 'HH:mm:ss'
        Write-Host "[OLIVIA-DISPATCH $ts] Error: $_"
    }

    Start-Sleep -Seconds $PollInterval
}
