<#
    Hüttenzauber v2 auf den Raspberry Pi bringen.

    Loest copy-huettenzauber.ps1 ab. Der alte Weg baute die Images auf dem
    Windows-Rechner (buildx, arm64-Emulation), schob sie als .tar hinueber und
    startete jeden Container einzeln. Das passt nicht mehr:
      - v2 hat drei Dienste, die zusammen hochfahren muessen (die DB zuerst),
      - der Einstieg liegt jetzt auf Port 80 im Frontend-Container,
        ein eigener Proxy-Container entfaellt,
      - Migrationen laufen beim Start des Backends.

    Deshalb: Quellcode uebertragen, auf dem Pi bauen (der Pi 5 kann das,
    ohne Emulation und schneller), dann `docker compose up -d`.

    Aufruf:
        .\deploy-pi.ps1                     # bauen und starten
        .\deploy-pi.ps1 -Host 192.168.0.207
        .\deploy-pi.ps1 -SkipBuild          # nur Dateien uebertragen
#>
param(
    [string]$PiHost   = "192.168.0.207",
    [string]$PiUser   = "aaron",
    [string]$Source   = "D:\DevLibrary\huettenzauber",
    [string]$RemoteDir = "huettenzauber-v2",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Remote = "$PiUser@$PiHost"
$Archiv = Join-Path $env:TEMP "huettenzauber-deploy.tar.gz"

function Schritt($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }

Schritt "Erreichbarkeit pruefen"
ssh -o BatchMode=yes -o ConnectTimeout=8 $Remote "echo verbunden mit \$(hostname)"
if ($LASTEXITCODE -ne 0) { throw "Keine SSH-Verbindung zu $Remote" }

Schritt "Quellcode packen"
Push-Location $Source
try {
    if (Test-Path $Archiv) { Remove-Item $Archiv }
    # node_modules, .venv und Co. bleiben draussen - der Pi baut selbst.
    tar czf $Archiv `
        --exclude=./frontend/node_modules --exclude=./frontend/dist `
        --exclude=./backend/.venv --exclude='*/__pycache__' `
        --exclude=./.git --exclude=./backend/_legacy_ist `
        --exclude=./frontend/_legacy_ist --exclude=./.pytest_cache `
        --exclude=./backups --exclude='*.tar' --exclude='*.tar.gz' `
        .
    if ($LASTEXITCODE -ne 0) { throw "tar fehlgeschlagen" }
} finally { Pop-Location }
Write-Host ("Archiv: {0:N0} KB" -f ((Get-Item $Archiv).Length / 1KB))

Schritt "Uebertragen"
scp -q $Archiv "${Remote}:/tmp/huettenzauber-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "scp fehlgeschlagen" }

# Die .env bleibt auf dem Pi (enthaelt Passwort und Zugangscode) und wird
# beim Entpacken nicht ueberschrieben.
$entpacken = @"
set -e
mkdir -p ~/$RemoteDir
if [ -f ~/$RemoteDir/.env ]; then cp ~/$RemoteDir/.env /tmp/hz-env.keep; fi
rm -rf ~/$RemoteDir.alt
[ -d ~/$RemoteDir ] && mv ~/$RemoteDir ~/$RemoteDir.alt
mkdir -p ~/$RemoteDir
tar xzf /tmp/huettenzauber-deploy.tar.gz -C ~/$RemoteDir
rm -f /tmp/huettenzauber-deploy.tar.gz
if [ -f /tmp/hz-env.keep ]; then mv /tmp/hz-env.keep ~/$RemoteDir/.env; chmod 600 ~/$RemoteDir/.env; fi
chmod +x ~/$RemoteDir/deploy/*.sh 2>/dev/null || true
echo "entpackt: \$(find ~/$RemoteDir -type f | wc -l) Dateien"
"@
ssh $Remote $entpacken
if ($LASTEXITCODE -ne 0) { throw "Entpacken fehlgeschlagen" }

if (-not (ssh $Remote "test -f ~/$RemoteDir/.env && echo ja")) {
    Write-Host "`nACHTUNG: ~/$RemoteDir/.env fehlt." -ForegroundColor Yellow
    Write-Host "Anlegen nach dem Muster von .env.example, dann erneut ausfuehren."
    throw ".env fehlt auf dem Pi"
}

if ($SkipBuild) { Write-Host "`nUebertragen. Build uebersprungen." -ForegroundColor Green; exit 0 }

Schritt "Bauen (auf dem Pi)"
ssh $Remote "cd ~/$RemoteDir && docker compose -f docker-compose.prod.yml build"
if ($LASTEXITCODE -ne 0) { throw "Build fehlgeschlagen" }

Schritt "Starten"
ssh $Remote "cd ~/$RemoteDir && docker compose -f docker-compose.prod.yml up -d"
if ($LASTEXITCODE -ne 0) { throw "Start fehlgeschlagen" }

Schritt "Warten, bis die Kasse antwortet"
$ok = $false
foreach ($i in 1..40) {
    try {
        $r = Invoke-RestMethod -Uri "http://$PiHost/api/health" -TimeoutSec 4
        if ($r.status -eq "ok" -and $r.database -eq "ok") { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
}
if (-not $ok) { throw "Kasse antwortet nicht - siehe: ssh $Remote 'docker logs huettenzauber_backend'" }
Write-Host "Kasse laeuft: http://$PiHost/" -ForegroundColor Green

Schritt "Aufraeumen"
ssh $Remote "rm -rf ~/$RemoteDir.alt; docker image prune -f >/dev/null; docker compose -f ~/$RemoteDir/docker-compose.prod.yml ps --format 'table {{.Name}}\t{{.Status}}'"

Write-Host "`nFertig. Kiosk neu starten:" -ForegroundColor Green
Write-Host "  ssh $Remote 'DISPLAY=:0 ~/$RemoteDir/deploy/kiosk.sh'"
