#!/bin/bash
# Script para coleta automática de snapshots de sessão
# Adicionar à crontab: */15 * * * * /opt/veeam-dashboard/scripts/collect-snapshots.sh >> /var/log/veeam-snapshots.log 2>&1

set -e

APP_DIR="/opt/veeam-dashboard"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# Carregar variáveis de ambiente
if [ -f "$APP_DIR/.env" ]; then
  set -a
  source "$APP_DIR/.env"
  set +a
else
  echo "$LOG_PREFIX ERRO: Arquivo .env não encontrado em $APP_DIR"
  exit 1
fi

# Usar INTERNAL_API_KEY ou SESSION_SECRET como chave de autenticação
API_KEY="${INTERNAL_API_KEY:-$SESSION_SECRET}"

if [ -z "$API_KEY" ]; then
  echo "$LOG_PREFIX ERRO: Nenhuma chave de API configurada (INTERNAL_API_KEY ou SESSION_SECRET)"
  exit 1
fi

BASE_URL="${BASE_URL:-http://localhost:5000}"

echo "$LOG_PREFIX Iniciando coleta de snapshots..."

# Fazer requisição ao endpoint interno
RESPONSE=$(curl -s -X POST "$BASE_URL/api/internal/collect-snapshots" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  --max-time 300)

if [ $? -eq 0 ]; then
  COLLECTED=$(echo "$RESPONSE" | grep -o '"collected":[0-9]*' | cut -d':' -f2)
  echo "$LOG_PREFIX Coleta concluída. Empresas processadas: ${COLLECTED:-0}"
  echo "$LOG_PREFIX Resposta: $RESPONSE"
else
  echo "$LOG_PREFIX ERRO: Falha ao conectar ao servidor"
  exit 1
fi
