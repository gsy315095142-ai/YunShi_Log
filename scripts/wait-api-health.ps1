param(
  [string]$Url = "http://127.0.0.1:8000/health",
  [int]$TimeoutSec = 60
)

$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    if ($resp.StatusCode -eq 200) {
      Write-Host "API healthy: $Url"
      exit 0
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

Write-Error "Timed out waiting for $Url"
exit 1
