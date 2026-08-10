# Vistamations Cloudflare D1 Setup
# Creates the agent memory database and deploys the worker.
# 
# Prerequisites: npx wrangler login (opens browser, log in to Cloudflare)
#
# Usage:
#   .\cloudflare\setup-d1.ps1 -Action setup    # Full setup: create DB, migrate, deploy
#   .\cloudflare\setup-d1.ps1 -Action status   # Check status

param(
    [string]$Action = "setup"
)

$WranglerDir = "C:\vistamations-music\cloudflare"
$DatabaseName = "vistamations-agent-memory"

function Invoke-Setup {
    Write-Host "=== Vistamations Cloudflare D1 Setup ==="
    Write-Host ""

    # 1. Check wrangler auth
    Write-Host "[1/5] Checking wrangler auth..."
    try {
        $whoami = npx wrangler whoami 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[BLOCKED] Not authenticated. Run first: npx wrangler login"
            Write-Host "         This opens a browser to log into your Cloudflare account."
            return
        }
        Write-Host "[OK] Authenticated as: $whoami"
    } catch {
        Write-Host "[BLOCKED] Wrangler not available or not authenticated."
        Write-Host "         Run: npx wrangler login"
        return
    }

    # 2. Create D1 database
    Write-Host "[2/5] Creating D1 database: $DatabaseName..."
    try {
        $result = npx wrangler d1 create $DatabaseName --config "$WranglerDir\wrangler.toml" 2>&1
        Write-Host $result

        # Extract database_id from output
        if ($result -match 'database_id\s*=\s*"([^"]+)"') {
            $dbId = $Matches[1]
            Write-Host "[OK] Database ID: $dbId"

            # Update wrangler.toml with the database_id
            $tomlPath = "$WranglerDir\wrangler.toml"
            $toml = Get-Content $tomlPath -Raw
            $toml = $toml -replace 'database_id = ""', "database_id = `"$dbId`""
            Set-Content $tomlPath $toml
            Write-Host "[OK] Updated wrangler.toml with database_id"
        }
    } catch {
        # Database might already exist — try listing
        Write-Host "[INFO] Create may have failed — checking if DB already exists..."
        $list = npx wrangler d1 list --config "$WranglerDir\wrangler.toml" 2>&1
        Write-Host $list
    }

    # 3. Run migration
    Write-Host "[3/5] Running schema migration..."
    try {
        $migrate = npx wrangler d1 migrations apply $DatabaseName --config "$WranglerDir\wrangler.toml" 2>&1
        Write-Host $migrate
        Write-Host "[OK] Migration applied."
    } catch {
        Write-Host "[WARN] Migration may have issues: $_"
    }

    # 4. Deploy worker
    Write-Host "[4/5] Deploying worker..."
    try {
        $deploy = npx wrangler deploy --config "$WranglerDir\wrangler.toml" 2>&1
        Write-Host $deploy
        Write-Host "[OK] Worker deployed."
    } catch {
        Write-Host "[WARN] Deploy may have issues: $_"
    }

    # 5. Test
    Write-Host "[5/5] Testing deployed worker..."
    Write-Host "[READY] After deploy, test with:"
    Write-Host "        curl https://vistamations-agent-memory.YOUR-SUBDOMAIN.workers.dev/health"
    Write-Host ""
    Write-Host "Setup complete. Next steps:"
    Write-Host "  1. Set worker URL as VISTAMATIONS_D1_URL env var"
    Write-Host "  2. Test: Invoke-RestMethod `$env:VISTAMATIONS_D1_URL/agents"
}

function Invoke-Status {
    Write-Host "=== Cloudflare D1 Status ==="
    try {
        $whoami = npx wrangler whoami 2>&1
        Write-Host "Auth: $whoami"
    } catch {
        Write-Host "Auth: NOT AUTHENTICATED (run: npx wrangler login)"
    }

    try {
        $list = npx wrangler d1 list --config "$WranglerDir\wrangler.toml" 2>&1
        Write-Host "Databases:"
        Write-Host $list
    } catch {
        Write-Host "Databases: Error listing — $($_.Exception.Message.Substring(0,100))"
    }

    try {
        $deployments = npx wrangler deployments list --config "$WranglerDir\wrangler.toml" 2>&1
        Write-Host "Deployments:"
        Write-Host $deployments
    } catch {
        Write-Host "Deployments: Error listing"
    }
}

switch ($Action) {
    "setup"  { Invoke-Setup }
    "status" { Invoke-Status }
    default  { Write-Host "Usage: .\setup-d1.ps1 -Action [setup|status]" }
}
