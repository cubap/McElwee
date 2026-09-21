# Measure per-row text-extent boxes in source-page pixel space (600x800).
# Iterates over source/handoff/burials/rows.json items (authoritative page, seq,
# y-range), loads each page once into a flat grayscale array, and finds the
# horizontal ink extent for each row box. Writes row-bounds.json keyed by page
# then seq.
Add-Type -AssemblyName System.Drawing
$base = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$rowsJson = Get-Content (Join-Path $base 'source\handoff\burials\rows.json') -Raw | ConvertFrom-Json

$imgFor = @{
  BurialsAlpha000 = 'eCoMoCemMcElweeBurialsAlpha000-vi.jpg'
  BurialsAlpha001 = 'eCoMoCemMcElweeBurialsAlpha001-vi.jpg'
  BurialsAlpha002 = 'eCoMoCemMcElweeBurialsAlpha3-vi.jpg'
  BurialsAlpha003 = 'eCoMoCemMcElweeBurialsAlpha003-vi.jpg'
  BurialsAlpha004 = 'eCoMoCemMcElweeBurialsAlpha004-vi.jpg'
  BurialsAlpha005 = 'eCoMoCemMcElweeBurialsAlpha005-vi.jpg'
  BurialsIndex001 = 'eCoMoCemMcElweeBurialsIndex001-vi.jpg'
  BurialsIndex002 = 'eCoMoCemMcElweeBurialsIndex002-vi.jpg'
  BurialsIndex003 = 'eCoMoCemMcElweeBurialsIndex003-vi.jpg'
  BurialsPage002  = 'keCoMoCemMcElweeBurialsPage002-vi.jpg'
  BurialsPage003  = 'keCoMoCemMcElweeBurialsPage003-vi.jpg'
  BurialsPage004  = 'keCoMoCemMcElweeBurialsPage004-vi.jpg'
  BurialsPage005  = 'keCoMoCemMcElweeBurialsPage005-vi.jpg'
  BurialsPage006  = 'keCoMoCemMcElweeBurialsPage006-vi.jpg'
  BurialsPage007  = 'keCoMoCemMcElweeBurialsPage007-vi.jpg'
}

$out = @{}
foreach ($page in $rowsJson.pages) {
  $short = $page.id
  if (-not $imgFor.ContainsKey($short)) { continue }
  $imgPath = Join-Path (Join-Path (Join-Path $base 'web\manifest\fotki') 'burials') $imgFor[$short]
  if (-not (Test-Path $imgPath)) { continue }
  $bmp = New-Object System.Drawing.Bitmap($imgPath)
  $W = [int]$bmp.Width; $H = [int]$bmp.Height
  $gray = New-Object 'byte[]' ($W * $H)
  for ($y = 0; $y -lt $H; $y++) {
    for ($x = 0; $x -lt $W; $x++) {
      $p = $bmp.GetPixel($x, $y)
      $gray[($y*$W + $x)] = [byte](0.299*$p.R + 0.587*$p.G + 0.114*$p.B)
    }
  }
  $bmp.Dispose()

  # A "desk column" is dark across nearly the entire page height (the wood /
  # shadow at the edges, not paper). Mark these so they never count as ink.
  $deskCol = New-Object bool[] $W
  for ($x = 0; $x -lt $W; $x++) {
    $darkCount = 0
    for ($y = 0; $y -lt $H; $y += 3) {
      if ([int]$gray[($y*$W + $x)] -lt 110) { $darkCount++ }
    }
    $sampleCount = [math]::Ceiling($H / 3)
    $deskCol[$x] = ($darkCount -ge ($sampleCount * 0.55))
  }
  $paperL = 0; $paperR = $W - 1
  for ($x = 0; $x -lt $W; $x++) { if (-not $deskCol[$x]) { $paperL = $x; break } }
  for ($x = $W - 1; $x -ge 0; $x--) { if (-not $deskCol[$x]) { $paperR = $x; break } }

  $rows = @()
  foreach ($item in $page.items) {
    $y0 = [int]$item.y0; $y1 = [int]$item.y1
    if ($y1 -ge $H) { $y1 = $H - 1 }
    $colMin = New-Object int[] $W
    $bandLums = New-Object System.Collections.ArrayList
    for ($x = 0; $x -lt $W; $x++) {
      $min = 255
      for ($y = $y0; $y -le $y1; $y++) {
        $l = [int]$gray[($y*$W + $x)]
        if ($l -lt $min) { $min = $l }
        [void]$bandLums.Add($l)
      }
      $colMin[$x] = $min
    }
    $sorted = @($bandLums | Sort-Object)
    $bgIdx = [int]($sorted.Count * 0.5)
    $bg = $sorted[$bgIdx]
    $isInk = New-Object bool[] $W
    for ($x = $paperL; $x -le $paperR; $x++) { $isInk[$x] = ($colMin[$x] -lt ($bg - 60)) }
    $inkIdx = @()
    for ($x = $paperL; $x -le $paperR; $x++) { if ($isInk[$x]) { $inkIdx += $x } }
    $x0 = -1; $x1 = -1
    if ($inkIdx.Count -gt 0) {
      $best = @()
      $cur = @($inkIdx[0])
      for ($j = 1; $j -lt $inkIdx.Count; $j++) {
        if (($inkIdx[$j] - $inkIdx[$j-1]) -le 75) { $cur += $inkIdx[$j] }
        else {
          if ($cur.Count -gt $best.Count) { $best = $cur }
          $cur = @($inkIdx[$j])
        }
      }
      if ($cur.Count -gt $best.Count) { $best = $cur }
      if ($best.Count -ge 8) { $x0 = $best[0]; $x1 = $best[$best.Count-1] }
    }
    $rows += [PSCustomObject]@{ seq=[int]$item.seq; kind=$item.kind; y0=$y0; y1=$y1; x0=$x0; x1=$x1; skew=[double]$page.skew }
  }
  $out[$short] = $rows
  Write-Host "measured $short ($($rows.Count) items)"
}
$out | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $PSScriptRoot 'row-bounds.json')
Write-Host ("wrote row-bounds.json for " + $out.Count + " pages")
