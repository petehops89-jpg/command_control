# Links page sync — re-scrapes notes folder and updates links.html
# Schedule: every 4 days at 12:00 AEST
# Reads all .txt files in notes-folder, extracts URLs, writes links.html

param(
    [string]$Action = "sync"
)

$RepoRoot = "C:\vistamations-music"
$NotesDir = Join-Path $RepoRoot ".vscode\pete\notes-folder"
$OutputFile = Join-Path $RepoRoot "links.html"

function Extract-Urls {
    param([string]$Text, [string]$SourceName)
    $urls = @()
    $seen = @{}
    $regex = '(https?://[^\s<>"{}|\\^`\[\]]+)'
    $matches = [regex]::Matches($Text, $regex)
    foreach ($m in $matches) {
        $url = $m.Groups[1].Value.TrimEnd('.,;:!?')
        if (-not $seen.ContainsKey($url)) {
            $seen[$url] = $true
            $urls += @{ url = $url; source = $SourceName }
        }
    }
    return $urls
}

function Get-DomainTag {
    param([string]$Url)
    try {
        $uri = [uri]$Url
        return $uri.Host -replace '^www\.', ''
    } catch {
        return 'unknown'
    }
}

function Get-Category {
    param([string]$Url)
    if ($Url -match '//localhost' -or $Url -match '//127\.0\.0\.1') { return 'localhost' }
    if ($Url -match 'console\.cloud\.google\.com') { return 'google' }
    if ($Url -match 'ai\.studio') { return 'ai-studio' }
    if ($Url -match 'figma\.com') { return 'figma' }
    if ($Url -match 'vistamations\.com') { return 'vistamations' }
    if ($Url -match 'notegpt|webflow|lmstudio') { return 'tools' }
    return 'reference'
}

function Get-SourceShort {
    param([string]$Src)
    switch ($Src) {
        "making money commad controls vistmatios notes 7-8-2026.txt" { return "money/command notes" }
        "7-8 progress report.txt" { return "progress report" }
        "ilinks" { return "ilinks" }
        "notes" { return "notes" }
        default { return $Src }
    }
}

function Sync-Links {
    if (-not (Test-Path $NotesDir)) {
        Write-Host "[ERROR] Notes directory not found: $NotesDir"
        return
    }

    $allUrls = @()
    Get-ChildItem -LiteralPath $NotesDir -File | ForEach-Object {
        $content = Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue
        if ($content) {
            $fileUrls = Extract-Urls -Text $content -SourceName $_.Name
            $allUrls += $fileUrls
        }
    }

    $allUrls = @($allUrls | Sort-Object -Unique -Property url)

    Write-Host "[SYNC] Found $($allUrls.Count) unique URLs across notes files."

    $jsonArray = @()
    foreach ($entry in $allUrls) {
        $jsonArray += @{
            url = $entry.url
            source = $entry.source
            cat = Get-Category $entry.url
            domain = Get-DomainTag $entry.url
        } | ConvertTo-Json -Compress
    }

    $linksJson = "[" + ($jsonArray -join ",") + "]"

    $htmlContent = @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Links — Vistamations Command Control</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #0A0C0F;
    --card: #14171C;
    --card-hover: #1A1D23;
    --border: rgba(255,255,255,0.05);
    --amber: #E8A33D;
    --cyan: #4FD1C5;
    --rust: #C44536;
    --bone: #E8E6DF;
    --bone-dim: rgba(232,230,223,0.45);
    --muted: #6B7280;
    --radius: 10px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--ink); color: var(--bone);
    min-height: 100vh;
    background-image:
      radial-gradient(ellipse at 30% 0%, rgba(232,163,61,0.04) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 100%, rgba(79,209,197,0.02) 0%, transparent 40%);
  }

  .container {
    max-width: 880px; margin: 0 auto; padding: 32px 24px 60px;
  }

  .header-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 20px;
  }
  .header-row h1 {
    font-family: 'JetBrains Mono', monospace; font-size: 16px;
    font-weight: 500; letter-spacing: 1px; color: var(--bone);
  }
  .header-row h1 .accent { color: var(--cyan); }
  .header-row .back-btn {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    color: var(--amber); text-decoration: none; letter-spacing: 1px;
    padding: 6px 14px; border: 1px solid var(--border); border-radius: 6px;
    transition: border-color 0.15s;
  }
  .header-row .back-btn:hover { border-color: rgba(232,163,61,0.3); }
  .header-row .sync-info {
    font-family: 'JetBrains Mono', monospace; font-size: 8px;
    color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px;
  }

  .tab-bar {
    display: flex; gap: 4px; margin-bottom: 20px; flex-wrap: wrap;
  }
  .tab {
    font-family: 'JetBrains Mono', monospace; font-size: 9px;
    padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer;
    text-transform: uppercase; letter-spacing: 1px; transition: all 0.15s;
  }
  .tab:hover { color: var(--bone); border-color: rgba(255,255,255,0.1); }
  .tab.active { color: var(--cyan); border-color: rgba(79,209,197,0.25); background: var(--cyan-dim); }
  .tab .count { color: var(--muted); margin-left: 4px; }

  .count-bar {
    font-family: 'JetBrains Mono', monospace; font-size: 9px;
    color: var(--muted); text-transform: uppercase; letter-spacing: 1.5px;
    margin-bottom: 16px;
  }

  .link-list { display: flex; flex-direction: column; gap: 6px; }

  .link-card {
    display: flex; align-items: center; gap: 12px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 12px 16px;
    text-decoration: none; color: inherit; transition: all 0.15s;
  }
  .link-card:hover {
    background: var(--card-hover);
    border-color: rgba(79,209,197,0.12);
  }

  .link-domain {
    font-family: 'JetBrains Mono', monospace; font-size: 8px;
    text-transform: uppercase; letter-spacing: 0.8px;
    background: rgba(255,255,255,0.03); padding: 4px 8px;
    border-radius: 4px; color: var(--muted); flex-shrink: 0;
    min-width: 52px; text-align: center; white-space: nowrap;
  }

  .link-info { flex: 1; min-width: 0; }
  .link-info .link-url {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    color: var(--bone); letter-spacing: 0.3px; word-break: break-all;
    line-height: 1.4;
  }
  .link-info .link-source {
    font-family: 'JetBrains Mono', monospace; font-size: 7px;
    color: var(--muted); margin-top: 3px;
  }

  .link-arrow {
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: var(--muted); flex-shrink: 0;
  }

  .category.hidden { display: none; }

  .empty-state {
    text-align: center; padding: 60px 20px;
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    color: var(--muted);
  }

  @media (max-width: 500px) {
    .container { padding: 20px 16px 40px; }
    .link-card { padding: 10px 12px; gap: 8px; }
    .link-domain { font-size: 7px; padding: 3px 6px; min-width: 44px; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header-row">
    <div>
      <h1>Command Control <span class="accent">Links</span></h1>
      <div class="sync-info" style="margin-top:4px">Last synced: ${(Get-Date).ToString('yyyy-MM-dd HH:mm:ss')} AEST</div>
    </div>
    <a href="index.html" class="back-btn">&larr; Dashboard</a>
  </div>

  <div class="tab-bar">
    <button class="tab active" onclick="filterCategory('all')" data-cat="all">All<span class="count" id="count-all"></span></button>
    <button class="tab" onclick="filterCategory('localhost')" data-cat="localhost">Localhost<span class="count" id="count-localhost"></span></button>
    <button class="tab" onclick="filterCategory('google')" data-cat="google">Google Cloud<span class="count" id="count-google"></span></button>
    <button class="tab" onclick="filterCategory('ai-studio')" data-cat="ai-studio">AI Studio<span class="count" id="count-ai-studio"></span></button>
    <button class="tab" onclick="filterCategory('figma')" data-cat="figma">Figma<span class="count" id="count-figma"></span></button>
    <button class="tab" onclick="filterCategory('tools')" data-cat="tools">Tools<span class="count" id="count-tools"></span></button>
    <button class="tab" onclick="filterCategory('vistamations')" data-cat="vistamations">Vistamations<span class="count" id="count-vistamations"></span></button>
    <button class="tab" onclick="filterCategory('reference')" data-cat="reference">Reference<span class="count" id="count-reference"></span></button>
  </div>

  <div class="count-bar" id="count-bar"></div>

  <div class="link-list" id="link-list"></div>
</div>

<script>
const LINKS = $linksJson;

function getDomainTag(url) {
  for (const l of LINKS) { if (l.url === url) return l.domain; }
  try { return (new URL(url)).hostname.replace(/^www\./, ''); }
  catch (e) { return url.substring(0, 30); }
}

function getSourceShort(src) {
  const map = {
    "making money commad controls vistmatios notes 7-8-2026.txt": "money/command notes",
    "7-8 progress report.txt": "progress report",
    "ilinks": "ilinks",
    "notes": "notes",
  };
  return map[src] || src;
}

function renderLinks(filter) {
  const filtered = filter === 'all' ? LINKS : LINKS.filter(l => l.cat === filter);
  const list = document.getElementById('link-list');
  const count = document.getElementById('count-bar');
  count.textContent = filtered.length + ' link' + (filtered.length !== 1 ? 's' : '') + ' — synced from notes folder every 4 days';

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No links in this category.</div>';
    return;
  }
  let html = '';
  for (const link of filtered) {
    const host = link.domain || getDomainTag(link.url);
    html += '<a href="' + link.url + '" class="link-card" target="_blank" rel="noopener">' +
      '<span class="link-domain">' + host + '</span>' +
      '<div class="link-info">' +
        '<div class="link-url">' + link.url + '</div>' +
        '<div class="link-source">' + getSourceShort(link.source) + '</div>' +
      '</div>' +
      '<span class="link-arrow">&rarr;</span>' +
    '</a>';
  }
  list.innerHTML = html;
}

function filterCategory(cat) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-cat="' + cat + '"]').classList.add('active');
  renderLinks(cat);
}

function updateCounts() {
  const counts = {};
  LINKS.forEach(l => { counts[l.cat] = (counts[l.cat] || 0) + 1; });
  counts.all = LINKS.length;
  for (const [cat, n] of Object.entries(counts)) {
    const el = document.getElementById('count-' + cat);
    if (el) el.textContent = n;
  }
}

updateCounts();
renderLinks('all');
</script>
</body>
</html>
"@

    $htmlContent | Set-Content -LiteralPath $OutputFile -Encoding UTF8 -NoNewline
    Write-Host "[SYNC] links.html written with $($allUrls.Count) links."
    return $allUrls.Count
}

function Register-Schedule {
    Write-Host "Registering Links Sync scheduled task (every 4 days at 12:00 AEST)..."
    $TaskName = "Vistamations-LinksSync"
    $ScriptPath = $MyInvocation.MyCommand.Path
    $NodePath = (Get-Command pwsh).Source

    $Action = New-ScheduledTaskAction -Execute $NodePath `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" -Action sync" `
        -WorkingDirectory $RepoRoot

    $Trigger = New-ScheduledTaskTrigger -Daily -At "12:00" -DaysInterval 4

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
            -Description "Vistamations Links Sync — re-scrapes notes folder and updates links.html every 4 days at 12:00 AEST" `
            -Force
        Write-Host "[OK] Task '$TaskName' registered. Every 4 days at 12:00 AEST."
    } catch {
        Write-Host "[ERROR] Failed to register task: $_"
    }
}

function Unregister-Schedule {
    try {
        Unregister-ScheduledTask -TaskName "Vistamations-LinksSync" -Confirm:$false -ErrorAction Stop
        Write-Host "[OK] Links Sync task removed."
    } catch {
        Write-Host "[INFO] Task not found or already removed."
    }
}

switch ($Action) {
    "sync"      { Sync-Links }
    "register"  { Register-Schedule }
    "unregister"{ Unregister-Schedule }
    "status" {
        try {
            $task = Get-ScheduledTask -TaskName "Vistamations-LinksSync" -ErrorAction Stop
            Write-Host "Task: $($task.TaskName)"
            Write-Host "State: $($task.State)"
            Write-Host "Next Run: $($task.NextRunTime)"
        } catch {
            Write-Host "Task not currently registered."
        }
    }
    default {
        Write-Host 'Usage: .\sync-links.ps1 -Action [sync|register|unregister|status]'
    }
}
