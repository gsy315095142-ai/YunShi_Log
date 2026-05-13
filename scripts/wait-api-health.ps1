param(
  [Parameter(Mandatory = $false)]
  [string]$Url = 'http://127.0.0.1:8000/api/health',
  [int]$TimeoutSeconds = 120,
  [int]$IntervalMs = 400
)

$deadline = [datetime]::UtcNow.AddSeconds($TimeoutSeconds)

while ([datetime]::UtcNow -lt $deadline) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
      exit 0
    }
  }
  catch {
    # e.g. ECONNREFUSED during startup — keep polling
  }
  Start-Sleep -Milliseconds $IntervalMs
}

exit 1
