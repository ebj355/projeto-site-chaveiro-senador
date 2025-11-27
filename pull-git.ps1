# pull-git.ps1
# Script para fazer pull rapido no Git

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   PULL RAPIDO - GIT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se estamos em um repositorio Git
if (-not (Test-Path ".git")) {
    Write-Host "Erro: Este diretorio nao e um repositorio Git!" -ForegroundColor Red
    exit 1
}

# Verificar status do Git antes do pull
Write-Host "Verificando status do Git..." -ForegroundColor Yellow
$gitStatus = git status --porcelain

if ($gitStatus) {
    Write-Host ""
    Write-Host "ATENCAO: Voce tem mudancas locais nao commitadas:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    
    $response = Read-Host "Deseja fazer stash das mudancas locais antes do pull? (S/N)"
    
    if ($response -eq "S" -or $response -eq "s") {
        Write-Host "Fazendo stash das mudancas..." -ForegroundColor Yellow
        git stash push -m "Auto-stash antes do pull - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Stash realizado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "Erro ao fazer stash!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Pull cancelado. Commit ou descarte suas mudancas locais primeiro." -ForegroundColor Red
        exit 1
    }
}

# Verificar branch atual
Write-Host ""
Write-Host "Verificando branch atual..." -ForegroundColor Yellow
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Branch atual: $currentBranch" -ForegroundColor Cyan

# Fazer pull
Write-Host ""
Write-Host "Fazendo pull do repositorio remoto..." -ForegroundColor Yellow
git pull origin $currentBranch

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Pull realizado com sucesso!" -ForegroundColor Green
    
    # Verificar se ha stash para restaurar
    $stashList = git stash list
    if ($stashList -match "Auto-stash antes do pull") {
        Write-Host ""
        $restoreStash = Read-Host "Deseja restaurar as mudancas do stash? (S/N)"
        
        if ($restoreStash -eq "S" -or $restoreStash -eq "s") {
            Write-Host "Restaurando mudancas do stash..." -ForegroundColor Yellow
            git stash pop
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Mudancas restauradas com sucesso!" -ForegroundColor Green
            } else {
                Write-Host "Erro ao restaurar mudancas. Verifique conflitos!" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host ""
    Write-Host "Erro ao fazer pull!" -ForegroundColor Red
    Write-Host "Verifique se ha conflitos ou problemas de conexao." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Operacao concluida com sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

