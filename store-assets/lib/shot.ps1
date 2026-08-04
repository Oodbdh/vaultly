# Screenshot capture + Play-compliant post-processing.
#
# Dot-source this, then call Capture-Shot for each screen:
#   . store-assets\lib\shot.ps1
#   Capture-Shot -Name '01-home'
#
# Why the post-processing exists: the device panel is 1080x2400 (20:9), and
# Google Play wants phone screenshots at 16:9 or 9:16, with the long side no
# more than twice the short side. 2400/1080 = 2.22, so a raw capture is
# rejected on both counts. Each shot is therefore scaled to fit inside
# 1080x1920 and centred on a canvas filled with the screenshot's own corner
# colour, so the padding is invisible on light screens and equally invisible on
# the black camera screen. Nothing is cropped and nothing is stretched.

Add-Type -AssemblyName System.Drawing

$script:Adb = "C:\Users\عدي\AppData\Local\Temp\claude\C--Users-----OneDrive------------------1\612c26be-63ac-4bc0-819b-81eb9e89f4bc\scratchpad\android-tools\platform-tools\adb.exe"
$script:Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$script:OutDir = Join-Path $script:Root 'google-play\screenshots'
$script:RawDir = Join-Path $script:Root '.raw'
$script:TargetW = 1080
$script:TargetH = 1920

New-Item -ItemType Directory -Force -Path $script:OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $script:RawDir | Out-Null

function Invoke-Adb { & $script:Adb @args }

<# Tap, then wait for the UI to settle before the next action. #>
function Tap([int]$x, [int]$y, [int]$settleMs = 900) {
  & $script:Adb shell input tap $x $y | Out-Null
  Start-Sleep -Milliseconds $settleMs
}

function Swipe([int]$x1, [int]$y1, [int]$x2, [int]$y2, [int]$ms = 300, [int]$settleMs = 900) {
  & $script:Adb shell input swipe $x1 $y1 $x2 $y2 $ms | Out-Null
  Start-Sleep -Milliseconds $settleMs
}

function Back([int]$settleMs = 900) {
  & $script:Adb shell input keyevent 4 | Out-Null
  Start-Sleep -Milliseconds $settleMs
}

function TypeText([string]$text, [int]$settleMs = 900) {
  $escaped = $text -replace ' ', '%s'
  & $script:Adb shell input text $escaped | Out-Null
  Start-Sleep -Milliseconds $settleMs
}

<#
  Pull one frame and write both the raw capture and the Play-ready PNG.
  Returns the output path so the caller can eyeball it.
#>
function Capture-Shot {
  param([Parameter(Mandatory)][string]$Name)

  $raw = Join-Path $script:RawDir "$Name.png"
  # exec-out keeps the PNG bytes intact; `adb shell screencap > file` mangles
  # them on Windows by translating CRLF.
  $bytes = & $script:Adb exec-out screencap -p
  [System.IO.File]::WriteAllBytes($raw, $bytes)

  $src = [System.Drawing.Image]::FromFile($raw)
  try {
    $canvas = New-Object System.Drawing.Bitmap($script:TargetW, $script:TargetH)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    try {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

      # Fill from the source's own top-left pixel so padding never reads as a border.
      $bmpSrc = New-Object System.Drawing.Bitmap($src)
      $fill = $bmpSrc.GetPixel(2, 2)
      $bmpSrc.Dispose()
      $g.Clear($fill)

      $scale = [Math]::Min($script:TargetW / $src.Width, $script:TargetH / $src.Height)
      $w = [int][Math]::Round($src.Width * $scale)
      $h = [int][Math]::Round($src.Height * $scale)
      $x = [int](($script:TargetW - $w) / 2)
      $y = [int](($script:TargetH - $h) / 2)
      $g.DrawImage($src, $x, $y, $w, $h)
    } finally { $g.Dispose() }

    $out = Join-Path $script:OutDir "$Name.png"
    $canvas.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    "{0,-34} {1}x{2}" -f "$Name.png", $script:TargetW, $script:TargetH
    return $out
  } finally { $src.Dispose() }
}

<#
  SystemUI demo mode: fixed clock, full battery, full signal, no notification
  icons. Keeps the status bar from dating the screenshots or leaking whatever
  happens to be on the device. Silently does nothing on skins that block it.
#>
function Enter-CleanStatusBar {
  & $script:Adb shell settings put global sysui_demo_allowed 1 | Out-Null
  $demo = 'am broadcast -a com.android.systemui.demo'
  & $script:Adb shell "$demo -e command enter" | Out-Null
  & $script:Adb shell "$demo -e command clock -e hhmm 0930" | Out-Null
  & $script:Adb shell "$demo -e command battery -e level 100 -e plugged false" | Out-Null
  & $script:Adb shell "$demo -e command network -e wifi show -e level 4" | Out-Null
  & $script:Adb shell "$demo -e command network -e mobile show -e level 4 -e datatype none" | Out-Null
  & $script:Adb shell "$demo -e command notifications -e visible false" | Out-Null
}

function Exit-CleanStatusBar {
  & $script:Adb shell "am broadcast -a com.android.systemui.demo -e command exit" | Out-Null
}
