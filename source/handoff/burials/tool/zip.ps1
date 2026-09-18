<#
    Bundles a handoff brief together with the images it refers to, so it can be handed to
    another model as one file.

    powershell -File source/handoff/burials/tool/zip.ps1 [-Doc burials|catalog] [-Out <zip>]

    The reading sheets are ~70 MB of PNG. They are generated, not committed, and this is the
    supported way to get them out of the repo in one piece.
#>
param(
    [ValidateSet('burials', 'catalog')]
    [string]$Doc = 'burials',
    [string]$Out = ''
)

$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
$root = Resolve-Path (Join-Path $here '..\..\..')
$bundle = if ($Doc -eq 'catalog') { Join-Path $root 'source\handoff\catalog' } else { $here }
$stage = Join-Path $env:TEMP ("handoff-zip-" + $Doc)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

if ($Doc -eq 'burials') {
    Copy-Item (Join-Path $bundle 'HANDOFF.md') $stage
    Copy-Item (Join-Path $bundle 'rows.json') $stage
    Copy-Item (Join-Path $bundle 'sheets') (Join-Path $stage 'sheets') -Recurse
    # rows.json names the mirror by absolute path; the zip must not carry that around.
    $rows = Get-Content (Join-Path $stage 'rows.json') -Raw
    $rows = $rows -replace '"image":\s*"[^"]*[\\/](\.jpg|\.png)"', '"image": "$1"'
    Set-Content -Path (Join-Path $stage 'rows.json') -Value $rows -NoNewline -Encoding UTF8
}
else {
    $cat = Join-Path $root 'source\handoff\catalog'
    Copy-Item (Join-Path $cat 'HANDOFF.md') $stage
    Copy-Item (Join-Path $cat 'pages.json') $stage
    $pages = (Get-Content (Join-Path $cat 'pages.json') -Raw | ConvertFrom-Json).pages
    $imgs = Join-Path $stage 'images'
    New-Item -ItemType Directory -Path $imgs | Out-Null
    foreach ($p in $pages) {
        $src = Join-Path $root ($p.local_path -replace '/', '\')
        if (Test-Path $src) { Copy-Item $src (Join-Path $imgs (Split-Path $p.local_path -Leaf)) }
    }
}

if (-not $Out) { $Out = Join-Path $bundle 'handoff.zip' }
if (Test-Path $Out) { Remove-Item $Out -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $Out -CompressionLevel Optimal

$mb = [math]::Round((Get-Item $Out).Length / 1MB, 1)
$count = (Get-ChildItem $stage -Recurse -File).Count
Remove-Item $stage -Recurse -Force
Write-Host "$Out  ($count files, $mb MB)"
