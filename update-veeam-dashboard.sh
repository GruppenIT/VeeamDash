#!/bin/bash
# Script de atualização para Veeam Dashboard
# Execute como: sudo bash update-veeam-dashboard.sh

set -e

echo "=========================================="
echo "  Atualizando Veeam VSPC Dashboard"
echo "=========================================="

APP_DIR="/opt/veeam-dashboard"

if [ ! -d "$APP_DIR" ]; then
    echo "Erro: Diretório $APP_DIR não encontrado"
    exit 1
fi

cd "$APP_DIR"

echo "[1/5] Parando aplicação..."
pm2 stop veeam-dashboard || true

if [ -d ".git" ]; then
    echo "[2/5] Atualizando código..."
    git pull origin main
fi

echo "[3/5] Instalando novas dependências..."
npm install

echo "[4/5] Aplicando migrações do banco..."
npm run db:push

echo "[5/5] Reiniciando aplicação..."
pm2 start veeam-dashboard

echo ""
echo "=========================================="
echo "  Atualização concluída!"
echo "=========================================="
echo ""
echo "Para configurar o envio de e-mail via M365:"
echo "  sudo nano $APP_DIR/.env"
echo ""
echo "Adicione as seguintes variáveis:"
echo "  M365_TENANT_ID=seu-tenant-id"
echo "  M365_CLIENT_ID=seu-client-id"
echo "  M365_CLIENT_SECRET=seu-client-secret"
echo "  M365_SENDER_EMAIL=remetente@seudominio.com"
echo ""
echo "Após configurar, reinicie: pm2 restart veeam-dashboard"
