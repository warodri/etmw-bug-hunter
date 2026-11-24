$ErrorActionPreference = "Stop"

$TaskName = "ETMWBugHunterAgent"
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DestDir = Join-Path $env:LOCALAPPDATA "ETMW\BugHunterAgent"
$LogFile = Join-Path $DestDir "agent.log"

function Fail($Message) {
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

$Node = Get-Command node -ErrorAction SilentlyContinue
$Npm = Get-Command npm -ErrorAction SilentlyContinue

if (-not $Node -or -not $Npm) {
    Fail "Node.js 20+ is required. Install it from https://nodejs.org/ and run this script again."
}

$Major = [int](& $Node.Source -p "process.versions.node.split('.')[0]")

if ($Major -lt 20) {
    Fail "Node.js 20 or newer is required (found $(& $Node.Source -v))."
}

Write-Host "==> Installing the ETMW Bug Hunter agent"
if (Test-Path $DestDir) { Remove-Item -Recurse -Force $DestDir }
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
Copy-Item -Path (Join-Path $SourceDir "*") -Destination $DestDir -Recurse -Force
Set-Location $DestDir

Write-Host "==> Installing dependencies"
& $Npm.Source install --omit=dev --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }

$Runner = Join-Path $DestDir "run-agent.cmd"
@"
@echo off
cd /d "%~dp0"
:loop
"$($Node.Source)" agent.cjs >> "$LogFile" 2>&1
timeout /t 10 /nobreak >nul
goto loop
"@ | Set-Content -Path $Runner -Encoding ASCII

Write-Host "==> Registering the background task"
$Action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\cmd.exe" -Argument "/c `"$Runner`"" -WorkingDirectory $DestDir
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "ETMW Bug Hunter read-only desktop agent" -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Installed. The agent starts now and at every login."
} catch {
    Write-Host "Could not create the scheduled task; using the Startup folder instead."
    $Startup = [Environment]::GetFolderPath("Startup")
    $Vbs = Join-Path $Startup "ETMWBugHunterAgent.vbs"
    @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """$Runner""", 0, False
"@ | Set-Content -Path $Vbs -Encoding ASCII
    Start-Process -FilePath $Runner -WindowStyle Hidden
    Write-Host "Installed in the Startup folder. The agent starts at every login."
}

Write-Host ""
Write-Host "Logs: $LogFile"
Write-Host "To uninstall: Unregister-ScheduledTask -TaskName $TaskName -Confirm:`$false; Remove-Item -Recurse -Force `"$DestDir`""
