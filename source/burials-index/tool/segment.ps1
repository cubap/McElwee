param(
    [string]$SrcDir = "$env:TEMP\burials",
    [string]$OutDir = "$env:TEMP\burials\rows",
    [string]$Manifest = "$env:TEMP\burials\rows.json",
    [int]$MinBandH = 5,
    [int]$MergeGap = 2,
    [int]$TargetH = 56,
    [int]$Radius = 11,
    [double]$K = 0.18,
    [bool]$Binarise = $true,
    [double]$FloorMul = 2.5
)
$ErrorActionPreference = 'Stop'
$cs = Get-Content "$PSScriptRoot\segment.cs" -Raw
Add-Type -TypeDefinition $cs -Language CSharp -ReferencedAssemblies System.Drawing
$json = [ScanSegmenter]::Run($SrcDir, $OutDir, $MinBandH, $MergeGap, $TargetH, $Radius, $K, $Binarise, $FloorMul)
[IO.File]::WriteAllText($Manifest, $json, (New-Object Text.UTF8Encoding $false))
$m = [regex]::Matches($json, '"file":"')
"bands written: $($m.Count)"
