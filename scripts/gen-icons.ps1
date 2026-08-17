# DSH Studio 图标生成脚本
# 来源：官方 @deepseek-ai/dsh-web-frontend/dist/favicon.svg（DeepSeek 鲸鱼 Logo）
# 用 System.Drawing 解析 SVG path 并渲染为品牌蓝 PNG（透明底）。
# 商标声明：DeepSeek 图形为深度求索公司商标，此处仅作为其开源项目
# DeepSeek Harness 桌面封装的应用图标使用；正式分发请遵循 DeepSeek 品牌指南。
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot "..\assets"
$svgPath = Join-Path $PSScriptRoot "..\node_modules\@deepseek-ai\dsh-web-frontend\dist\favicon.svg"
New-Item -ItemType Directory -Force -Path $assets | Out-Null

$svg = [System.IO.File]::ReadAllText($svgPath)
$m = [regex]::Match($svg, '\bd="([^"]+)"')
if (-not $m.Success) { throw "SVG 中未找到 path d 属性" }
$d = $m.Groups[1].Value

# 切分为 命令字母 与 数值
$tokens = [regex]::Matches($d, '[A-Za-z]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?') | ForEach-Object { $_.Value }

# 构建 GraphicsPath
$gp = New-Object System.Drawing.Drawing2D.GraphicsPath
$cx = 0.0; $cy = 0.0; $sx = 0.0; $sy = 0.0
$cmd = ''
$i = 0
while ($i -lt $tokens.Count) {
  $t = $tokens[$i]
  if ($t -match '^[A-Za-z]$') { $cmd = $t; $i++; continue }
  $nx = [double]$tokens[$i]; $ny = [double]$tokens[$i + 1]
  switch ($cmd) {
    'M' { $cx = $nx; $cy = $ny; $sx = $nx; $sy = $ny; $i += 2; $cmd = 'L'; break }
    'm' { $cx += $nx; $cy += $ny; $sx = $cx; $sy = $cy; $i += 2; $cmd = 'l'; break }
    'L' { $gp.AddLine($cx, $cy, $nx, $ny); $cx = $nx; $cy = $ny; $i += 2; break }
    'l' { $gp.AddLine($cx, $cy, $cx + $nx, $cy + $ny); $cx += $nx; $cy += $ny; $i += 2; break }
    'C' {
      $x2 = [double]$tokens[$i + 2]; $y2 = [double]$tokens[$i + 3]
      $x3 = [double]$tokens[$i + 4]; $y3 = [double]$tokens[$i + 5]
      $gp.AddBezier($cx, $cy, $nx, $ny, $x2, $y2, $x3, $y3)
      $cx = $x3; $cy = $y3; $i += 6; break
    }
    'c' {
      $x2 = $cx + [double]$tokens[$i + 2]; $y2 = $cy + [double]$tokens[$i + 3]
      $x3 = $cx + [double]$tokens[$i + 4]; $y3 = $cy + [double]$tokens[$i + 5]
      $gp.AddBezier($cx, $cy, $cx + $nx, $cy + $ny, $x2, $y2, $x3, $y3)
      $cx = $x3; $cy = $y3; $i += 6; break
    }
    'Z' { $gp.CloseFigure(); $cx = $sx; $cy = $sy; $i++; break }
    'z' { $gp.CloseFigure(); $cx = $sx; $cy = $sy; $i++; break }
    default { throw "不支持的 SVG 命令：$cmd" }
  }
}

# 品牌蓝（DeepSeek Blue）
$blue = [System.Drawing.Color]::FromArgb(255, 77, 107, 254)

function New-WhaleIcon([int]$size, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)
  # viewBox 50x50 → 目标尺寸
  $scale = [float]$size / 50.0
  $g.ScaleTransform($scale, $scale)
  $brush = New-Object System.Drawing.SolidBrush $blue
  $g.FillPath($brush, $gp)
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $brush.Dispose(); $bmp.Dispose()
  Write-Output "generated: $outPath"
}

New-WhaleIcon 256 (Join-Path $assets "icon-256.png")
New-WhaleIcon 512 (Join-Path $assets "icon-512.png")
New-WhaleIcon 1024 (Join-Path $assets "icon-1024.png")
New-WhaleIcon 32  (Join-Path $assets "icon-32.png")
New-WhaleIcon 16  (Join-Path $assets "icon-16.png")

# Windows 任务栏/快捷方式用 .ico：手工构造（ICONDIR 6B + ICONDIRENTRY 16B + PNG 帧）
$pngBytes = [System.IO.File]::ReadAllBytes((Join-Path $assets "icon-256.png"))
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]1)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]32)
$bw.Write([UInt32]$pngBytes.Length)
$bw.Write([UInt32]22)
$bw.Write($pngBytes)
$bw.Flush()
$icoPath = Join-Path $assets "icon.ico"
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$ms.Close(); $bw.Close()
$icoBytes = [System.IO.File]::ReadAllBytes($icoPath)
$valid = $icoBytes.Length -gt 6 -and $icoBytes[0] -eq 0 -and $icoBytes[1] -eq 0 -and $icoBytes[2] -eq 1 -and $icoBytes[3] -eq 0
Write-Output ("generated: {0} ({1} B, ICO 头 {2})" -f $icoPath, $icoBytes.Length, $(if ($valid) { "有效" } else { "无效" }))

# 自检：256 图标中非透明像素占比（鲸鱼应在 5%~60% 区间）
$check = [System.Drawing.Bitmap]::FromFile((Join-Path $assets "icon-256.png"))
$opaque = 0
for ($y = 0; $y -lt 256; $y += 4) {
  for ($x = 0; $x -lt 256; $x += 4) {
    if ($check.GetPixel($x, $y).A -gt 0) { $opaque++ }
  }
}
$check.Dispose()
$ratio = $opaque / (64 * 64)
Write-Output ("自检：采样非透明占比 {0:P1}" -f $ratio)
if ($ratio -lt 0.03 -or $ratio -gt 0.7) { throw "图标渲染异常（占比 $ratio）" }
