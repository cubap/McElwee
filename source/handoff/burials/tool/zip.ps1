<#
    Bundles a handoff brief together with the images it refers to, so it can be handed to
    another model as one file.

    powershell -File source/handoff/burials/tool/zip.ps1 [-Doc burials|catalog] [-Mode review|transcribe] [-Out <zip>]

    For the burial index, -Mode review (the default) bundles REVIEW.md and review-batch.jsonl:
    our machine read, for a model to confirm or refute. -Mode transcribe bundles HANDOFF.md
    only, for a model that must not see our read.

    The reading sheets are ~70 MB of PNG. They are generated, not committed, and this is the
    supported way to get them out of the repo in one piece.
#>
param(
    [ValidateSet('burials', 'catalog')]
    [string]$Doc = 'burials',
    [ValidateSet('transcribe', 'review')]
    [string]$Mode = 'review',
    [string]$Out = ''
)

$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
$root = Resolve-Path (Join-Path $here '..\..\..')
$bundle = if ($Doc -eq 'catalog') { Join-Path $root 'source\handoff\catalog' } else { $here }
$stage = Join-Path $env:TEMP ("handoff-zip-" + $Doc + "-" + $Mode)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

if ($Doc -eq 'burials') {
    Copy-Item (Join-Path $bundle 'sheets') (Join-Path $stage 'sheets') -Recurse
    Copy-Item (Join-Path $bundle 'rows.json') $stage
    if ($Mode -eq 'review') {
        # Adjudication pass: our machine read goes in the box, so the reader can confirm or
        # refute it. REVIEW.md is handed over as HANDOFF.md so there is one brief to open,
        # and the real HANDOFF.md travels beside it as RULES.md because REVIEW.md defers to
        # it for the shared transcription rules.
        Copy-Item (Join-Path $bundle 'REVIEW.md') (Join-Path $stage 'HANDOFF.md')
        Copy-Item (Join-Path $bundle 'HANDOFF.md') (Join-Path $stage 'RULES.md')
        Copy-Item (Join-Path $bundle 'review-batch.jsonl') $stage
    }
    else {
        # Independent pass: nothing that could anchor the reader goes in the box.
        Copy-Item (Join-Path $bundle 'HANDOFF.md') $stage
    }
    # sheets/sheets.json maps every sheet to the seq numbers it carries, which is how a
    # reader checks it has seen all of them. rows.json names the source photograph by a
    # repo-relative path only for provenance; the photographs are not in the zip.
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

if (-not $Out) {
    $suffix = if ($Doc -eq 'burials') { "-" + $Mode } else { "" }
    $Out = Join-Path $bundle ("handoff" + $suffix + ".zip")
}
if (Test-Path $Out) { Remove-Item $Out -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $Out -CompressionLevel Optimal

$mb = [math]::Round((Get-Item $Out).Length / 1MB, 1)
$count = (Get-ChildItem $stage -Recurse -File).Count
Remove-Item $stage -Recurse -Force
Write-Host "$Out  ($count files, $mb MB)"
