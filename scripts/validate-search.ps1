[CmdletBinding()]
param(
    [string]$HostName = 'localhost',
    [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

$Compose = docker compose config --format json | ConvertFrom-Json
$DbName = $Compose.services.db.environment.POSTGRES_DB
$DbUser = $Compose.services.db.environment.POSTGRES_USER

$SchemaSql = @'
SELECT 'trgm=' || (EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_trgm'))::int;
SELECT 'prefix=' || (to_regclass('app.places_normalized_name_prefix_idx') IS NOT NULL)::int;
SELECT 'trigram=' || (to_regclass('app.places_normalized_name_trgm_idx') IS NOT NULL)::int;
SELECT 'subcategory=' || (to_regclass('app.places_subcategory_idx') IS NOT NULL)::int;
'@
$SchemaOutput = docker compose exec -T db psql -At -v ON_ERROR_STOP=1 `
    -U $DbUser -d $DbName -c $SchemaSql
if ($LASTEXITCODE -ne 0) { throw 'Search schema validation failed.' }
foreach ($Line in $SchemaOutput) {
    $Parts = $Line -split '='
    if ($Parts[1] -ne '1') { throw "Search schema validation failed: $($Parts[0])" }
}

function Invoke-MapSearch([string]$Query, [int]$Limit = 10) {
    $EncodedQuery = [uri]::EscapeDataString($Query)
    $Uri = "http://${HostName}:${Port}/api/v1/search?q=${EncodedQuery}&limit=${Limit}" +
        '&latitude=54.6872&longitude=25.2797&west=25.10&south=54.55&east=25.50&north=54.85'
    $Response = Invoke-RestMethod -Uri $Uri -TimeoutSec 10
    if ($Response.meta.returned -ne $Response.results.Count -or $Response.results.Count -gt $Limit) {
        throw "Search metadata is invalid for '$Query'."
    }
    return $Response
}

$Expectations = @(
    @{ Query = 'Maxima'; Match = { param($Item) $Item.name -match 'Maxima' } },
    @{ Query = 'Rimi'; Match = { param($Item) $Item.name -match 'Rimi' } },
    @{ Query = 'cafe'; Subcategory = 'cafe' },
    @{ Query = 'restaurant'; Subcategory = 'restaurant' },
    @{ Query = 'pharmacy'; Subcategory = 'pharmacy' },
    @{ Query = 'gym'; Subcategory = 'fitness_centre' },
    @{ Query = 'hotel'; Subcategory = 'hotel' },
    @{ Query = 'bank'; Subcategory = 'bank' },
    @{ Query = 'supermarket'; Subcategory = 'supermarket' },
    @{ Query = 'car repair'; Subcategory = 'car_repair' },
    @{ Query = 'maxma'; Match = { param($Item) $Item.name -match 'Maxima' } },
    @{ Query = 'resturant'; Match = { param($Item) $Item.subcategory -eq 'restaurant' } },
    @{ Query = 'pharmcy'; Match = { param($Item) $Item.subcategory -eq 'pharmacy' } }
)

foreach ($Expectation in $Expectations) {
    $Response = Invoke-MapSearch -Query $Expectation.Query
    if ($Response.results.Count -eq 0) { throw "Search returned no results for '$($Expectation.Query)'." }
    $Match = $Expectation.Match
    if ($Expectation.Subcategory) {
        if ($Response.meta.intent -ne 'category') {
            throw "Category intent was not reported for '$($Expectation.Query)'."
        }
        $Irrelevant = @($Response.results | Where-Object { $_.subcategory -ne $Expectation.Subcategory })
        if ($Irrelevant.Count -gt 0) {
            throw "Taxonomy search returned an unrelated result for '$($Expectation.Query)'."
        }
    } else {
        $Relevant = @($Response.results | Where-Object { & $Match $_ })
        if ($Relevant.Count -eq 0) { throw "Search quality failed for '$($Expectation.Query)'." }
    }
}

$Exact = Invoke-MapSearch -Query 'Maxima'
if ($Exact.results[0].name -ne 'Maxima') { throw 'Exact Maxima match was not ranked first.' }
$Prefix = Invoke-MapSearch -Query 'Rim'
if ($Prefix.results[0].name -notmatch 'Rimi') { throw 'Rimi prefix ranking failed.' }
$Gym = Invoke-MapSearch -Query 'gym'
if (@($Gym.results | Where-Object { $_.name -notmatch 'gym' }).Count -eq 0) {
    throw 'Gym discovery did not include a taxonomy match without gym in its name.'
}
$GymBrand = Invoke-MapSearch -Query 'Gym+'
if ($GymBrand.meta.intent -ne 'name' -or $GymBrand.results[0].name -ne 'Gym+') {
    throw 'Gym+ was incorrectly treated as generic gym category intent.'
}
$LemonGym = Invoke-MapSearch -Query 'Lemon Gym'
if ($LemonGym.meta.intent -ne 'name' -or $LemonGym.results[0].name -notmatch 'Lemon Gym') {
    throw 'Lemon Gym brand ranking failed.'
}

Write-Host 'Live Vilnius intent-aware search quality and index validation passed (16 queries).' -ForegroundColor Green
