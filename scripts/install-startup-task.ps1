# install-startup-task.ps1
# One-time setup: copies wsl2-portforward.ps1 to a stable Windows location
# and registers it as a Task Scheduler task that runs at every logon.
# Must be run as Administrator.

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$TaskName = "TankUp WSL2 Port Forward"
$InstallDir = "$env:LOCALAPPDATA\TankUp"
$ScriptDest = "$InstallDir\wsl2-portforward.ps1"

# -- Copy the script to a stable Windows path ----------------------------------
# (The WSL path may not be accessible when the task fires at logon)

$ScriptSrc = "$PSScriptRoot\wsl2-portforward.ps1"
if (-not (Test-Path $ScriptSrc)) {
    Write-Error "Cannot find wsl2-portforward.ps1 next to this installer. Run from the scripts/ directory."
    exit 1
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Path $ScriptSrc -Destination $ScriptDest -Force
Write-Host "Script copied to: $ScriptDest"

# -- Register the scheduled task -----------------------------------------------

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File `"$ScriptDest`""

# Runs at logon for the current user with elevated privileges
$trigger  = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

# Remove old task if it exists, then register fresh
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Write-Host ""
Write-Host "Startup task '$TaskName' registered successfully."
Write-Host "It will run automatically at every logon."
Write-Host ""
Write-Host "To run it manually right now:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "To remove it later:"
Write-Host "  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
