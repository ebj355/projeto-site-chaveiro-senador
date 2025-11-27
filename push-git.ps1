# push-git.ps1
# Script para fazer push rapido no Git

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   PUSH RAPIDO - GIT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos em um repositorio Git
if (-not (Test-Path ".git")) {
    Write-Host "Erro: Este diretorio nao e um repositorio Git!" -ForegroundColor Red
    exit 1
}

# Verificar status do Git
Write-Host "Verificando status do Git..." -ForegroundColor Yellow
$gitStatus = git status --porcelain

if (-not $gitStatus) {
    Write-Host "Nao ha mudancas para commitar." -ForegroundColor Green
    exit 0
}

# Mostrar mudancas
Write-Host "Mudancas detectadas:" -ForegroundColor Yellow
git status --short

# Adicionar todos os arquivos
Write-Host ""
Write-Host "Adicionando arquivos..." -ForegroundColor Yellow
git add .

# Fazer commit com mensagem automatica
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "Update: $timestamp"

Write-Host "Fazendo commit..." -ForegroundColor Yellow
git commit -m $commitMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "Commit realizado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Erro ao fazer commit!" -ForegroundColor Red
    exit 1
}

# Fazer push
Write-Host "Fazendo push..." -ForegroundColor Yellow
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "Push realizado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Erro ao fazer push!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Operacao concluida com sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
