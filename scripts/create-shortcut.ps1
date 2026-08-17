# 创建 DSH Studio 开发快捷方式（鲸鱼图标）：桌面生成 .lnk，
# 指向内置 Electron 直接加载已构建产物（无需 dev 服务器）。
# 把该快捷方式固定到任务栏即可获得鲸鱼任务栏图标（开发模式的 exe 图标限制）。
$project = "D:\AI_tools\DeepSeek Harness\WorkSpace\dsh-studio"
$electron = Join-Path $project "node_modules\electron\dist\electron.exe"
$icon = Join-Path $project "assets\icon.ico"
if (-not (Test-Path $electron)) { Write-Error "未找到 electron.exe，请先 npm install"; exit 1 }
if (-not (Test-Path $icon)) { Write-Error "未找到 icon.ico，请先运行 npm run icons"; exit 1 }

$ws = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path $env:USERPROFILE "Desktop\DSH Studio.lnk"
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = $electron
$lnk.Arguments = '"' + $project + '"'
$lnk.WorkingDirectory = $project
$lnk.IconLocation = "$icon,0"
$lnk.Description = "DSH Studio - DeepSeek Harness 桌面客户端"
$lnk.Save()
Write-Output "已创建快捷方式: $lnkPath"
Write-Output "提示：右键该快捷方式 → 固定到任务栏，任务栏即显示鲸鱼图标"
