# MiniAgent 模型烟雾测试生成器
# 对指定模型跑一遍 5 个任务，输出存入 test/fixtures/models/
# 用法: .\local_llm\scripts\smoke-test.ps1 -Model qwen2.5-coder:3b

param(
    [Parameter(Mandatory)]
    [string]$Model,
    [switch]$WithPostprocessor
)

$ErrorActionPreference = 'Stop'

$env:OLLAMA_MODELS = 'G:\ollama\models'
$env:OLLAMA_HOST = '127.0.0.1:11434'

$tasksPath = "evaluation\tasks\tasks.json"
$outBase = "test\fixtures\models\$($Model -replace '[:./]', '-')"

# 加载任务
$tasks = Get-Content $tasksPath -Encoding utf8 | ConvertFrom-Json

if (-not (Test-Path $outBase)) { New-Item -ItemType Directory -Path $outBase -Force | Out-Null }
Write-Host "输出目录: $outBase"

$postprocessor = "evaluation\runners\code_postprocessor.py"

foreach ($task in $tasks) {
    $taskDir = "$outBase\$($task.id)"
    if (-not (Test-Path $taskDir)) { New-Item -ItemType Directory -Path $taskDir -Force | Out-Null }

    Write-Host "`n[$($task.id)] $($task.name) ..." -ForegroundColor Cyan

    # 调用 Ollama
    $body = @{
        model  = $Model
        system = "You write Python code. Output only code. No prose. No markdown fences. Use type hints."
        prompt = $task.prompt
        stream = $false
        options = @{ temperature = 0.1; num_predict = 2048; num_ctx = 4096 }
    } | ConvertTo-Json

    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/generate" `
        -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 180
    $raw = ($resp.Content | ConvertFrom-Json).response

    # 提取代码
    $code = $raw
    if ($raw -match '```[\s\S]*?```') {
        $block = [regex]::Match($raw, '```(?:python)?\s*\n([\s\S]*?)```').Groups[1].Value
        if ($block) { $code = $block.TrimStart() }
    }

    # 保存原始输出
    $raw | Out-File -FilePath "$taskDir\raw.txt" -Encoding utf8
    $code | Out-File -FilePath "$taskDir\output.py" -Encoding utf8

    # 如需要后处理器版本
    if ($WithPostprocessor) {
        $cleaned = $code | python $postprocessor 2>&1
        $cleaned | Out-File -FilePath "$taskDir\cleaned.py" -Encoding utf8
        Write-Host "  + 已保存 cleaned.py"
    }

    Write-Host "  + raw.txt + output.py 已保存"
}

Write-Host "`n=== 完成 === 共 $($tasks.Count) 个任务，输出到 $outBase" -ForegroundColor Green
Write-Host "文件结构:"
$root = (Get-Location).Path
Get-ChildItem $outBase -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length + 1)
    "$rel  $([math]::Round($_.Length/1KB,1))KB"
}
