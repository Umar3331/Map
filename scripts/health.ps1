[CmdletBinding()]
param([string]$HostName = 'localhost', [int]$Port = 5173)

$ErrorActionPreference = 'Stop'
$Health = Invoke-RestMethod -Uri "http://${HostName}:${Port}/health" -TimeoutSec 10
$Config = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/config" -TimeoutSec 10
if ($Health.status -ne 'ok' -or $Config.region -ne 'vilnius') { throw 'Map services returned unexpected data.' }
$Places = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/places?west=25.20&south=54.66&east=25.34&north=54.73&limit=5" -TimeoutSec 10
if ($Places.type -ne 'FeatureCollection' -or $Places.features.Count -lt 1 -or $Places.features.Count -gt 5 `
    -or $Places.meta.returned -ne $Places.features.Count -or $Places.meta.total -lt $Places.meta.returned `
    -or $Places.meta.truncated -ne ($Places.meta.total -gt $Places.meta.returned)) {
    throw 'Map place endpoint returned unexpected data. Run .\scripts\places-data.ps1 first.'
}
$Search = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/search?q=Maxima&limit=1" -TimeoutSec 10
if ($Search.query -ne 'maxima' -or $Search.meta.returned -ne 1 `
    -or $Search.results.Count -ne 1 -or $Search.results[0].name -notmatch '^Maxima') {
    throw 'Map search endpoint returned unexpected data.'
}
$SpaSearch = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/search?q=spa&limit=10" -TimeoutSec 10
if ($SpaSearch.meta.intent -ne 'service' -or $SpaSearch.results.Count -lt 1 -or
    @($SpaSearch.results | Where-Object {
        $_.result_type -ne 'provider_service' -or $_.matched_service.code -ne 'massage' -or
        $_.name -match 'Lietuvos spauda|Spartuko kebabai'
    }).Count -gt 0) {
    throw 'Map service-aware search endpoint returned unexpected data.'
}
$ProviderSearch = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/search?q=gym&limit=1" -TimeoutSec 10
$ProviderPlaceId = $ProviderSearch.results[0].id
$PlaceProviders = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/places/${ProviderPlaceId}/providers" -TimeoutSec 10
if ($PlaceProviders.meta.returned -lt 1 -or $PlaceProviders.providers[0].service_count -lt 1) {
    throw 'Map provider endpoint returned unexpected data. Run .\scripts\provider-data.ps1 first.'
}
$ProviderId = $PlaceProviders.providers[0].id
$Provider = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/providers/${ProviderId}" -TimeoutSec 10
$Services = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/providers/${ProviderId}/services" -TimeoutSec 10
if (-not $Provider.display_name -or $Provider.locations.Count -lt 1 -or $Provider.sources.Count -lt 1 `
    -or $Services.meta.returned -lt 1) {
    throw 'Map provider profile or services returned unexpected data.'
}
$Health | ConvertTo-Json
$Config | ConvertTo-Json -Depth 4
Write-Host "PWA gateway, API health, Vilnius configuration, places, search, and provider checks passed ($($Places.features.Count) places)." -ForegroundColor Green
