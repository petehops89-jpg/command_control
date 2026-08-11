Set-Location "C:\vistamations-music\cloudflare"

Write-Host "=== Vistamations Cloudflare Secret Enrollment ===" -ForegroundColor Cyan
Write-Host ""

$secrets = @(
    @{Name="GOOGLE_API_KEY"; Desc="Gemini API key for Cloudflare Workers"; Required=$true},
    @{Name="DEEPSEEK_API_KEY"; Desc="DeepSeek V4 Pro for agent chat fallback"; Required=$true},
    @{Name="MISTRAL_API_KEY"; Desc="Mistral Large 3 for Olivia model"; Required=$false},
    @{Name="CLOUDFLARE_API_TOKEN"; Desc="Cloudflare API token for management"; Required=$true},
    @{Name="OLIVIA_API_URL"; Desc="Olivia command portal endpoint"; Required=$false}
)

$existing = @()
try { $existing = npx wrangler secret list 2>&1 | Out-String } catch {}

Write-Host "Existing secrets:"
if ($existing -match "No secrets") { Write-Host "  (none)" } else { Write-Host $existing }
Write-Host ""

foreach ($s in $secrets) {
    if ($existing -match $s.Name) {
        Write-Host "[SKIP] $($s.Name) — already set" -ForegroundColor DarkGray
        continue
    }
    
    $tag = if ($s.Required) { "REQUIRED" } else { "optional" }
    Write-Host "[$tag] $($s.Name): $($s.Desc)" -ForegroundColor Yellow
    
    $value = Read-Host "  Enter value (or press Enter to skip)"
    if ($value) {
        try {
            $value | npx wrangler secret put $s.Name 2>&1 | Out-Null
            Write-Host "  [OK] $($s.Name) stored" -ForegroundColor Green
        } catch {
            Write-Host "  [FAIL] $($s.Name): $_" -ForegroundColor Red
        }
    } else {
        if ($s.Name -eq "OLIVIA_API_URL") {
            $val = "http://localhost/api/olivia"
            $val | npx wrangler secret put OLIVIA_API_URL 2>&1 | Out-Null
            Write-Host "  [OK] OLIVIA_API_URL set to default" -ForegroundColor Green
        } else {
            Write-Host "  Skipped" -ForegroundColor DarkGray
        }
    }
}

Write-Host ""
Write-Host "=== Enrolled ===" -ForegroundColor Cyan
npx wrangler secret list 2>&1
Write-Host ""
Write-Host "Secrets are now bound to the Cloudflare Worker at runtime as env.<NAME>"
Write-Host "To deploy: npx wrangler deploy"
