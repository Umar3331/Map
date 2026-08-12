[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

function Test-TlsHandshake([string]$Mode) {
    $StartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $StartInfo.FileName = 'docker'
    $StartInfo.Arguments = "compose run --rm --no-deps rsa-pki-validator validate $Mode"
    $StartInfo.UseShellExecute = $false
    $StartInfo.RedirectStandardOutput = $true
    $StartInfo.RedirectStandardError = $true
    $Process = New-Object System.Diagnostics.Process
    $Process.StartInfo = $StartInfo
    [void]$Process.Start()
    $StandardOutput = $Process.StandardOutput.ReadToEndAsync()
    $StandardError = $Process.StandardError.ReadToEndAsync()
    $Process.WaitForExit()
    $ExitCode = $Process.ExitCode
    $Text = $StandardOutput.Result + [Environment]::NewLine + $StandardError.Result
    Write-Host $Text

    if ($ExitCode -ne 0) {
        throw "RSA PKI validation failed for the '$Mode' TLS handshake."
    }
    if ($Text -match 'no peer certificate available|tlsv1 alert internal error') {
        throw "The '$Mode' TLS handshake returned the known no-SNI certificate failure."
    }
    if ($Text -notmatch 'leaf_sha256=([0-9a-f]{64})') {
        throw "The '$Mode' TLS handshake did not obtain the active leaf certificate."
    }
    return $Matches[1]
}

$SniLeafFingerprint = Test-TlsHandshake 'sni'
$NoSniLeafFingerprint = Test-TlsHandshake 'no-sni'
$ImplicitHostLeafFingerprint = Test-TlsHandshake 'implicit-connect-host'
if (
    $SniLeafFingerprint -ne $NoSniLeafFingerprint -or
    $SniLeafFingerprint -ne $ImplicitHostLeafFingerprint
) {
    throw 'The SNI, no-SNI, and implicit connect-host handshakes presented different leaves.'
}

Write-Host 'SNI, no-SNI, and implicit connect-host handshakes presented the same active RSA leaf.' -ForegroundColor Green
