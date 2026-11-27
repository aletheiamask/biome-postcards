# Captures the Minecraft window only (used by tools/look.mjs). ASCII only: Windows PowerShell 5.1 reads .ps1 as ANSI.
#   -Out <png file>      where to save
#   -Region "x,y,w,h"    part of the game client area as fractions 0..1 (default: whole window)
#   -Scale <factor>      shrink or enlarge (enlarging uses nearest neighbour to keep pixels sharp)
#   -Count/-IntervalMs   capture several frames into one sheet (-Cols = columns)
#   -Action focus|rclick|esc|enter|click|type|key|probe   act on the window instead of capturing (-Text = chat line for type, keys for key)
#       -HoldMs = how long rclick is held, -At "x,y" = click position as fractions of the client area
param(
  [string]$Out = "",
  [string]$Region = "0,0,1,1",
  [double]$Scale = 1.0,
  [int]$Count = 1,
  [int]$IntervalMs = 250,
  [int]$Cols = 4,
  [string]$Action = "",
  [int]$HoldMs = 60,
  [string]$At = "0.5,0.5",
  [string]$Text = ""
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class BpcWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
"@
[BpcWin]::SetProcessDPIAware() | Out-Null

$proc = Get-Process -Name "Minecraft.Windows" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if (-not $proc) { Write-Output "shot: Minecraft window not found"; exit 2 }
$h = $proc.MainWindowHandle

function Focus-Game {
  if ([BpcWin]::IsIconic($h)) { [BpcWin]::ShowWindow($h, 9) | Out-Null; Start-Sleep -Milliseconds 300 }
  if ([BpcWin]::GetForegroundWindow() -ne $h) {
    # tap Alt so Windows allows the foreground switch
    [BpcWin]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
    [BpcWin]::SetForegroundWindow($h) | Out-Null
    [BpcWin]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 500
  }
  return ([BpcWin]::GetForegroundWindow() -eq $h)
}

$focused = Focus-Game
if ($Action -eq "focus") { Write-Output "shot: focus=$focused"; exit 0 }
if ($Action -eq "rclick") {
  [BpcWin]::mouse_event(0x0008, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds $HoldMs
  [BpcWin]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero)
  Write-Output "shot: rclick ${HoldMs}ms focus=$focused"; exit 0
}
if ($Action -eq "esc" -or $Action -eq "enter") {
  $vk = if ($Action -eq "esc") { 0x1B } else { 0x0D }
  [BpcWin]::keybd_event($vk, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [BpcWin]::keybd_event($vk, 0, 2, [UIntPtr]::Zero)
  Write-Output "shot: $Action focus=$focused"; exit 0
}
if ($Action -eq "probe") {
  # -At "x,y;x,y" : print the colour of client-area points (fractions), used to tell which screen is showing
  $prc = New-Object BpcWin+RECT
  [BpcWin]::GetClientRect($h, [ref]$prc) | Out-Null
  $ppt = New-Object BpcWin+POINT
  [BpcWin]::ClientToScreen($h, [ref]$ppt) | Out-Null
  $one = New-Object System.Drawing.Bitmap 1, 1
  $pg = [System.Drawing.Graphics]::FromImage($one)
  $res = @()
  foreach ($pair in $At.Split(";")) {
    $q = $pair.Split(",") | ForEach-Object { [double]$_ }
    $pg.CopyFromScreen($ppt.X + [int](($prc.R - $prc.L) * $q[0]), $ppt.Y + [int](($prc.B - $prc.T) * $q[1]), 0, 0, (New-Object System.Drawing.Size 1, 1))
    $c = $one.GetPixel(0, 0)
    $res += "$($c.R),$($c.G),$($c.B)"
  }
  $pg.Dispose(); $one.Dispose()
  Write-Output "probe: $($res -join ' ')"; exit 0
}
if ($Action -eq "key") {
  # -Text "DOWN,DOWN,ENTER" : press keys one after another
  $map = @{ UP = 0x26; DOWN = 0x28; LEFT = 0x25; RIGHT = 0x27; TAB = 0x09; ENTER = 0x0D; ESC = 0x1B; SPACE = 0x20; F1 = 0x70; F5 = 0x74; F11 = 0x7A }
  foreach ($k in $Text.Split(",")) {
    $k = $k.Trim().ToUpper()
    $vk = if ($map.ContainsKey($k)) { $map[$k] } elseif ($k.Length -eq 1) { [int][char]$k } else { 0 }
    if ($vk -eq 0) { continue }
    [BpcWin]::keybd_event([byte]$vk, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [BpcWin]::keybd_event([byte]$vk, 0, 2, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 250
  }
  Write-Output "shot: key $Text focus=$focused"; exit 0
}
if ($Action -eq "paste") {
  # chat is already open: paste the text and press Enter
  Set-Clipboard -Value $Text
  [BpcWin]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40
  [BpcWin]::keybd_event(0x56, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [BpcWin]::keybd_event(0x56, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40; [BpcWin]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 400
  [BpcWin]::keybd_event(0x0D, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [BpcWin]::keybd_event(0x0D, 0, 2, [UIntPtr]::Zero)
  Write-Output "shot: paste '$Text' focus=$focused"; exit 0
}
if ($Action -eq "type") {
  # open chat with T, paste the text (layout independent), press Enter
  Set-Clipboard -Value $Text
  [BpcWin]::keybd_event(0x54, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [BpcWin]::keybd_event(0x54, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 700
  [BpcWin]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40
  [BpcWin]::keybd_event(0x56, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [BpcWin]::keybd_event(0x56, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40; [BpcWin]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 400
  [BpcWin]::keybd_event(0x0D, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [BpcWin]::keybd_event(0x0D, 0, 2, [UIntPtr]::Zero)
  Write-Output "shot: type '$Text' focus=$focused"; exit 0
}
if ($Action -eq "click") {
  $crc = New-Object BpcWin+RECT
  [BpcWin]::GetClientRect($h, [ref]$crc) | Out-Null
  $cpt = New-Object BpcWin+POINT
  [BpcWin]::ClientToScreen($h, [ref]$cpt) | Out-Null
  $a = $At.Split(",") | ForEach-Object { [double]$_ }
  $cx = $cpt.X + [int](($crc.R - $crc.L) * $a[0])
  $cy = $cpt.Y + [int](($crc.B - $crc.T) * $a[1])
  [BpcWin]::SetCursorPos($cx, $cy) | Out-Null
  Start-Sleep -Milliseconds 120
  # jiggle so the game (raw input) sees a mouse move before the click
  [BpcWin]::mouse_event(0x0001, 2, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40
  [BpcWin]::mouse_event(0x0001, [uint32]4294967294, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40
  [BpcWin]::SetCursorPos($cx, $cy) | Out-Null
  Start-Sleep -Milliseconds 150
  [BpcWin]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [BpcWin]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Write-Output "shot: click $cx,$cy focus=$focused"; exit 0
}
if (-not $Out) { Write-Output "shot: -Out is required"; exit 2 }

$rc = New-Object BpcWin+RECT
[BpcWin]::GetClientRect($h, [ref]$rc) | Out-Null
$pt = New-Object BpcWin+POINT
[BpcWin]::ClientToScreen($h, [ref]$pt) | Out-Null
$cw = $rc.R - $rc.L
$ch = $rc.B - $rc.T
if ($cw -le 0 -or $ch -le 0) { Write-Output "shot: game window has no client area (minimized?)"; exit 2 }
$r = $Region.Split(",") | ForEach-Object { [double]$_ }
$sx = $pt.X + [int]($cw * $r[0])
$sy = $pt.Y + [int]($ch * $r[1])
$sw = [Math]::Max(1, [int]($cw * $r[2]))
$sh = [Math]::Max(1, [int]($ch * $r[3]))
$dw = [Math]::Max(1, [int]($sw * $Scale))
$dh = [Math]::Max(1, [int]($sh * $Scale))

$frames = @()
for ($i = 0; $i -lt $Count; $i++) {
  if ($i -gt 0) { Start-Sleep -Milliseconds $IntervalMs }
  $bmp = New-Object System.Drawing.Bitmap $sw, $sh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($sx, $sy, 0, 0, (New-Object System.Drawing.Size $sw, $sh))
  $g.Dispose()
  $frames += $bmp
}

$cols = [Math]::Min($Cols, $Count)
$rows = [int][Math]::Ceiling($Count / $cols)
$gap = if ($Count -gt 1) { 2 } else { 0 }
$sheet = New-Object System.Drawing.Bitmap (($dw + $gap) * $cols - $gap), (($dh + $gap) * $rows - $gap)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::FromArgb(255, 255, 0, 255))
if ($Scale -ge 1) {
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
} else {
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
}
for ($i = 0; $i -lt $Count; $i++) {
  $x = ($i % $cols) * ($dw + $gap)
  $y = [int][Math]::Floor($i / $cols) * ($dh + $gap)
  $g.DrawImage($frames[$i], $x, $y, $dw, $dh)
  $frames[$i].Dispose()
}
$g.Dispose()
$dir = Split-Path -Parent $Out
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
$sheet.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "shot: $Out $($sheet.Width)x$($sheet.Height) frames=$Count focus=$focused client=${cw}x${ch}"
$sheet.Dispose()
