<#
    Renders the burial-index reading sheets.

    Reads rows.json (regenerate it with: node ../make-rows.mjs), crops every numbered row
    out of the mirrored photograph, levels it, magnifies it, and stacks the strips onto
    seq-labelled PNG sheets in sheets/. Also writes sheets/sheets.json, which maps each
    sheet back to the seq numbers it carries.

        powershell -ExecutionPolicy Bypass -File tool/sheets.ps1
#>
param(
    [int]$MaxRows = 16,
    [int]$MaxSheetH = 2400,
    [int]$Gutter = 96,
    [int]$TargetW = 1800
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$bundle = Split-Path $here -Parent
$rowsJson = Join-Path $bundle 'rows.json'
if (-not (Test-Path $rowsJson)) { throw "rows.json missing - run: node source/handoff/burials/make-rows.mjs" }

$outDir = Join-Path $bundle 'sheets'
$tmp = Join-Path $env:TEMP 'burials'
if (-not (Test-Path $tmp)) { New-Item -ItemType Directory -Force $tmp | Out-Null }
$tsv = Join-Path $tmp 'handoff-rows.tsv'

$data = Get-Content $rowsJson -Raw | ConvertFrom-Json
$lines = foreach ($p in $data.pages) {
    foreach ($it in $p.items) {
        "{0}`t{1}`t{2}`t{3}`t{4}`t{5}`t{6}`t{7}`t{8}" -f $p.id, $p.image, $p.skew, $p.width, $p.height, $it.seq, $it.y0, $it.y1, $it.kind
    }
}
Set-Content -LiteralPath $tsv -Value $lines -Encoding UTF8
"rows to place: $($lines.Count)"

Add-Type -AssemblyName System.Drawing
$cs = Get-Content (Join-Path $here 'sheets.cs') -Raw
Add-Type -TypeDefinition $cs -Language CSharp -ReferencedAssemblies System.Drawing

$json = [SheetMaker]::Run($tsv, $outDir, $MaxRows, $MaxSheetH, $Gutter, $TargetW)
[IO.File]::WriteAllText((Join-Path $outDir 'sheets.json'), $json, (New-Object Text.UTF8Encoding $false))

$files = Get-ChildItem $outDir -Filter '*.png'
$mb = [math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB, 2)
"sheets/: $($files.Count) PNGs, $mb MB"
