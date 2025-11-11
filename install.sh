#!/bin/bash

# Script de Instalação - Veeam VSPC Dashboard
# Ubuntu 24.04 LTS

set -e

echo "=================================="
echo "Veeam VSPC Dashboard - Instalação"
echo "=================================="
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo "Por favor, execute como root (sudo ./install.sh)"
  exit 1
fi

# Atualizar sistema
echo "[1/8] Atualizando sistema..."
apt-get update -qq
apt-get upgrade -y -qq

# Instalar Node.js 20
echo "[2/8] Instalando Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "Node.js versão: $(node --version)"
echo "NPM versão: $(npm --version)"

# Instalar PostgreSQL
echo "[3/8] Instalando PostgreSQL..."
if ! command -v psql &> /dev/null; then
  apt-get install -y postgresql postgresql-contrib
  systemctl start postgresql
  systemctl enable postgresql
fi

# Criar banco de dados
echo "[4/8] Configurando banco de dados..."
sudo -u postgres psql -c "CREATE DATABASE veeam_dashboard;" 2>/dev/null || echo "Banco de dados já existe"
sudo -u postgres psql -c "CREATE USER veeam_user WITH PASSWORD 'veeam_password';" 2>/dev/null || echo "Usuário já existe"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE veeam_dashboard TO veeam_user;"
sudo -u postgres psql -c "ALTER DATABASE veeam_dashboard OWNER TO veeam_user;"

# Instalar PM2 globalmente
echo "[5/8] Instalando PM2..."
npm install -g pm2

# Criar diretório da aplicação
echo "[6/8] Configurando aplicação..."
APP_DIR="/opt/veeam-dashboard"
mkdir -p $APP_DIR

# Copiar arquivos (assumindo que o script está no diretório do projeto)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cp -r $SCRIPT_DIR/* $APP_DIR/
cd $APP_DIR

# Instalar dependências
echo "[7/8] Instalando dependências..."
npm install --production

# Criar arquivo .env
echo "[8/8] Configurando variáveis de ambiente..."
cat > $APP_DIR/.env << EOF
# Database
DATABASE_URL=postgresql://veeam_user:veeam_password@localhost:5432/veeam_dashboard
PGUSER=veeam_user
PGPASSWORD=veeam_password
PGDATABASE=veeam_dashboard
PGHOST=localhost
PGPORT=5432

# Session
SESSION_SECRET=$(openssl rand -hex 32)

# Veeam API (CONFIGURAR MANUALMENTE)
# VEEAM_API_URL=https://seu-servidor-vspc:1280
# VEEAM_API_KEY=sua-chave-api-aqui

# Node
NODE_ENV=production
PORT=5000
EOF

# Executar migração do banco
echo "Executando migração do banco de dados..."
npm run db:push

# Configurar PM2
echo "Configurando PM2..."
pm2 start npm --name "veeam-dashboard" -- start
pm2 save
pm2 startup systemd -u root --hp /root

# Configurar firewall (se UFW estiver instalado)
if command -v ufw &> /dev/null; then
  echo "Configurando firewall..."
  ufw allow 5000/tcp
fi

echo ""
echo "=================================="
echo "Instalação Concluída!"
echo "=================================="
echo ""
echo "A aplicação está rodando em: http://localhost:5000"
echo ""
echo "IMPORTANTE: Configure as credenciais da API do Veeam:"
echo "1. Edite o arquivo: $APP_DIR/.env"
echo "2. Descomente e preencha:"
echo "   VEEAM_API_URL=https://seu-servidor-vspc:1280"
echo "   VEEAM_API_KEY=sua-chave-api"
echo "3. Reinicie a aplicação: pm2 restart veeam-dashboard"
echo ""
echo "Comandos úteis:"
echo "  pm2 status              - Ver status da aplicação"
echo "  pm2 logs veeam-dashboard - Ver logs em tempo real"
echo "  pm2 restart veeam-dashboard - Reiniciar aplicação"
echo "  pm2 stop veeam-dashboard - Parar aplicação"
echo ""
echo "Login padrão:"
echo "  E-mail: login@sistema.com"
echo "  Senha: (qualquer senha na primeira vez)"
echo ""
