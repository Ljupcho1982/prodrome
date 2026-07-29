# Rebuild the Prodrome Android APK. Run from the prodrome/ folder.
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

Write-Host "==> running tests" -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { throw "tests failed — aborting build" }

Write-Host "==> syncing web assets" -ForegroundColor Cyan
npx cap sync android

Write-Host "==> gradle assembleDebug" -ForegroundColor Cyan
Set-Location android
.\gradlew.bat assembleDebug
Set-Location ..

Copy-Item android\app\build\outputs\apk\debug\app-debug.apk .\Prodrome-debug.apk -Force
Write-Host "==> done: Prodrome-debug.apk" -ForegroundColor Green
Get-Item .\Prodrome-debug.apk | Select-Object Name, Length, LastWriteTime
