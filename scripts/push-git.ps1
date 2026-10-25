# push-git.ps1
# Script para fazer push rapido no Git
# Os scripts ficam em /scripts: sempre roda a partir da raiz do projeto
#
# Uso:
#   .\scripts\push-git.ps1                       -> commit automatico "Update: data hora" + push
#   .\scripts\push-git.ps1 -Mensagem "Meu texto"  -> commit com a sua mensagem + push
# Sem mudancas para commitar, o script ainda envia (push) os commits
# locais que ainda nao subiram para o GitHub.
param([string]$Mensagem = "")

Set-Location (Split-Path -Parent $PSScriptRoot)


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

if ($gitStatus) {
    # Mostrar mudancas
    Write-Host "Mudancas detectadas:" -ForegroundColor Yellow
    git status --short

    # Adicionar todos os arquivos
    Write-Host ""
    Write-Host "Adicionando arquivos..." -ForegroundColor Yellow
    git add .

    # Fazer commit (mensagem informada ou automatica com data e hora)
    if ($Mensagem) {
        $commitMessage = $Mensagem
    } else {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $commitMessage = "Update: $timestamp"
    }

    Write-Host "Fazendo commit..." -ForegroundColor Yellow
    git commit -m $commitMessage

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Commit realizado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "Erro ao fazer commit!" -ForegroundColor Red
        exit 1
    }
} else {
    # Nada para commitar: ainda pode haver commits locais que nao subiram
    $pendentes = git rev-list --count "@{u}..HEAD" 2>$null
    if ($LASTEXITCODE -eq 0 -and $pendentes -eq "0") {
        Write-Host "Nada para enviar: tudo em dia com o GitHub." -ForegroundColor Green
        exit 0
    }
    Write-Host "Sem mudancas novas, mas ha commit(s) local(is) para enviar." -ForegroundColor Yellow
}

# Verificar e configurar remote se necessario
Write-Host "Verificando remote..." -ForegroundColor Yellow
$remoteExists = git remote get-url origin 2>$null

if (-not $remoteExists) {
    Write-Host "Configurando remote origin..." -ForegroundColor Yellow
    git remote add origin https://github.com/eduabjr/projeto-site-chaveiro-senador.git
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erro ao configurar remote!" -ForegroundColor Red
        exit 1
    }
}

# Obter branch atual
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Branch atual: $currentBranch" -ForegroundColor Cyan

# Fazer push
Write-Host "Fazendo push..." -ForegroundColor Yellow
git push -u origin $currentBranch

if ($LASTEXITCODE -eq 0) {
    Write-Host "Push realizado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Erro ao fazer push!" -ForegroundColor Red
    Write-Host "Verifique se o remote esta configurado corretamente." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Operacao concluida com sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
