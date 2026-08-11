$root = "C:\vistamations-music"
$files = @("$root\server.js","$root\agent-daemon.js","$root\start.sh","$root\package.json","$root\images\Dockerfile")
$hash = @{}
foreach ($f in $files) { if (Test-Path $f) { $hash[$f] = (Get-FileHash $f -Algorithm SHA256).Hash } }
Write-Output "[watcher] Watching 5 files every 10s"
while ($true) {
    Start-Sleep 10
    foreach ($f in $files) {
        if (-not (Test-Path $f)) { continue }
        $current = (Get-FileHash $f -Algorithm SHA256).Hash
        if ($current -ne $hash[$f]) {
            $name = Split-Path $f -Leaf
            Write-Output "[watcher] CHANGE: $name - rebuilding container..."
            docker compose -f "$root\docker-compose.yml" up -d --build app
            Write-Output "[watcher] Rebuild complete."
            $hash[$f] = $current
        }
    }
}
