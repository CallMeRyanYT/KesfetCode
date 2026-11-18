# One-time setup: creates the Android release signing key and stores it as
# encrypted GitHub Actions secrets so the release workflow can sign the APK.
#
# Run from the repository folder:   powershell -ExecutionPolicy Bypass -File scripts\setup-android-signing.ps1
#
# KEEP THE GENERATED FOLDER SAFE. Android only installs an update over an
# existing app when both are signed with the same key. If the key is lost,
# every tablet must uninstall and reinstall the app.

$ErrorActionPreference = 'Stop'
$repo = 'CallMeRyanYT/KesfetCode'
$folder = Join-Path (Split-Path $PSScriptRoot -Parent | Split-Path -Parent) 'KesfetCode-android-signing'
$keystore = Join-Path $folder 'kesfet-release.jks'
$keytool = 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'

if (-not (Test-Path $keytool)) { throw "keytool not found at $keytool. Install Android Studio first." }
if (Test-Path $keystore) { throw "A key already exists at $keystore. Delete it only if you are sure no installed app uses it." }
gh auth status | Out-Null

New-Item -ItemType Directory -Force $folder | Out-Null
$chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
$bytes = New-Object byte[] 28
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })

& $keytool -genkeypair -keystore $keystore -alias kesfet -keyalg RSA -keysize 4096 -validity 10000 `
  -storepass $password -keypass $password -dname 'CN=Kesfet Lab, OU=Kesfet Code, O=Kesfet Lab, C=TR' | Out-Null

@"
Keşfet Code Android signing key
================================
Back this folder up (for example on a USB stick) and save the password in a password manager.
If this key is lost, installed tablets cannot receive new APK versions.

Keystore file : kesfet-release.jks
Key alias     : kesfet
Password      : $password   (same for the keystore and the key)

These values are also stored as encrypted GitHub Actions secrets in $repo.
"@ | Out-File -Encoding utf8 (Join-Path $folder 'README-KEEP-SAFE.txt')

gh secret set ANDROID_KEYSTORE_BASE64 -R $repo --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore)))
gh secret set ANDROID_KEYSTORE_PASSWORD -R $repo --body $password
gh secret set ANDROID_KEY_PASSWORD -R $repo --body $password
gh secret set ANDROID_KEY_ALIAS -R $repo --body 'kesfet'

Write-Host "Signing key created in $folder and saved to GitHub secrets." -ForegroundColor Green
gh secret list -R $repo
