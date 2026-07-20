# 输出本机局域网 IPv4 地址（供 start-dev.bat 显示局域网访问链接）
# 优先取带默认网关且网卡已启用的接口；取不到则退回第一个非回环、非 169.254 的 IPv4。

$ip = (Get-NetIPConfiguration -ErrorAction SilentlyContinue |
    Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
    Select-Object -First 1).IPv4Address.IPAddress

if (-not $ip) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notlike '169.254.*' } |
        Select-Object -First 1).IPAddress
}

if ($ip) { Write-Output $ip }
