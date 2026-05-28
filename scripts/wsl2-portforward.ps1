# wsl2-portforward.ps1
# Re-applies WSL2 → Windows port forwarding for the TankUp backend.
# Run manually after a reboot, or let the startup task call it automatically.

param (
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

# Give WSL2 a moment to initialise if this is running at logon
Start-Sleep -Seconds 3

# Wake WSL2 (if not already running) and grab its IP
try {
    $wslIp = (wsl -- hostname -I 2>$null).Trim().Split()[0]
} catch {
    Write-Error "Failed to query WSL2 IP. Is WSL2 installed and a distro configured?"
    exit 1
}

if (-not $wslIp -or $wslIp -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    Write-Error "WSL2 returned an unexpected IP: '$wslIp'"
    exit 1
}

Write-Host "WSL2 IP detected: $wslIp"

# Remove stale rule (ignore errors if it doesn't exist)
netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=0.0.0.0 | Out-Null

# Add fresh rule pointing to current WSL2 IP
netsh interface portproxy add v4tov4 `
    listenport=$Port `
    listenaddress=0.0.0.0 `
    connectport=$Port `
    connectaddress=$wslIp

Write-Host "Port proxy set: 0.0.0.0:$Port -> $wslIp:$Port"

# Ensure firewall rule exists (idempotent)
$firewallRule = netsh advfirewall firewall show rule name="TankUp Backend $Port" 2>&1
if ($LASTEXITCODE -ne 0) {
    netsh advfirewall firewall add rule `
        name="TankUp Backend $Port" `
        dir=in `
        action=allow `
        protocol=TCP `
        localport=$Port | Out-Null
    Write-Host "Firewall rule added for port $Port"
} else {
    Write-Host "Firewall rule already exists"
}

Write-Host "Done. Backend reachable at port $Port from all network interfaces."
