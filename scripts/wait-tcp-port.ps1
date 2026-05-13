param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int]$Port,

  [int]$TimeoutSeconds = 120,
  [int]$IntervalMs = 400
)

$deadline = [datetime]::UtcNow.AddSeconds($TimeoutSeconds)

function Test-TcpPort([int]$TcpPort) {
  $client = $null
  try {
    $client = New-Object Net.Sockets.TcpClient
    $client.Connect('127.0.0.1', $TcpPort)
    return $client.Connected
  }
  catch {
    return $false
  }
  finally {
    if ($null -ne $client) {
      try { $client.Close() } catch { }
      $client.Dispose()
    }
  }
}

while ([datetime]::UtcNow -lt $deadline) {
  if (Test-TcpPort -TcpPort $Port) {
    exit 0
  }
  Start-Sleep -Milliseconds $IntervalMs
}

exit 1
