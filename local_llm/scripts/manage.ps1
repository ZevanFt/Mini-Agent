# MiniAgent 本地模型管理脚本
# 用法：.\local_llm\scripts\manage.ps1 <命令>
#
# 命令:
#   start      启动 Ollama 服务
#   stop       停止 Ollama 服务
#   list       列出已安装模型
#   pull <名>  下载模型
#   rm   <名>  删除模型
#   switch <名> 切换评测用模型（改 config）

param(
    [ValidateSet('start','stop','list','pull','rm','switch','status')]
    [string]$Command,
    [string]$Model = ''
)

$env:OLLAMA_MODELS = 'G:\ollama\models'
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:PATH = "G:\ollama\app;$env:PATH"
$ollama = "G:\ollama\app\ollama.exe"

function Start-OllamaService {
    if (Get-Process -Name "ollama" -ErrorAction SilentlyContinue) {
        Write-Host "Ollama 已在运行中" -ForegroundColor Green
        return
    }
    Write-Host "启动 Ollama 服务..." -ForegroundColor Yellow
    $proc = Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 3
    Write-Host "已启动 (PID: $($proc.Id))" -ForegroundColor Green
}

function Stop-OllamaService {
    $procs = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
    if (-not $procs) { Write-Host "Ollama 未运行"; return }
    $procs | Stop-Process -Force
    Write-Host "Ollama 已停止" -ForegroundColor Green
}

function List-Models {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -ErrorAction SilentlyContinue
    if (-not $r) {
        Write-Host "Ollama 服务未运行，请先运行 start" -ForegroundColor Red
        return
    }
    $json = $r.Content | ConvertFrom-Json
    $json.models | Format-Table Name, Size, ModifiedAt
}

function Pull-Model {
    if (-not $Model) { Write-Host "请指定模型名：pull qwen2.5-coder:3b"; return }
    Write-Host "拉取 $Model ..." -ForegroundColor Yellow
    & $ollama pull $Model 2>&1
    Write-Host "完成" -ForegroundColor Green
}

function Remove-Model {
    if (-not $Model) { Write-Host "请指定模型名：rm deepseek-coder:1.3b"; return }
    & $ollama rm $Model 2>&1
    Write-Host "$Model 已删除" -ForegroundColor Green
}

function Show-Status {
    Write-Host "=== Ollama 状态 ===" -ForegroundColor Cyan
    $proc = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "服务: 运行中 (PID: $($proc.Id -join ','))"
        Write-Host "内存: $([math]::Round(($proc | Measure-Object WorkingSet64 -Sum).Sum / 1GB, 2)) GB"
    } else {
        Write-Host "服务: 未运行" -ForegroundColor Red
    }
    Write-Host "模型路径: $env:OLLAMA_MODELS"
    $size = Get-ChildItem $env:OLLAMA_MODELS -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
    Write-Host "模型占用: $([math]::Round($size.Sum / 1GB, 2)) GB"
    Write-Host "Ollama: $(G:\ollama\app\ollama.exe --version 2>&1)"
}

switch ($Command) {
    'start'  { Start-OllamaService }
    'stop'   { Stop-OllamaService }
    'list'   { List-Models }
    'pull'   { Pull-Model }
    'rm'     { Remove-Model }
    'status' { Show-Status }
    default  {
        Write-Host @"
MiniAgent 模型管理
用法: manage.ps1 <命令> [-Model <模型名>]

命令:
  start      启动 Ollama 服务
  stop       停止 Ollama 服务
  list       列出已安装模型
  pull       下载模型（需 -Model）
  rm         删除模型（需 -Model）
  status     查看服务状态和模型占用

示例:
  .\local_llm\scripts\manage.ps1 start
  .\local_llm\scripts\manage.ps1 pull qwen2.5-coder:3b
  .\local_llm\scripts\manage.ps1 list
"@
    }
}
