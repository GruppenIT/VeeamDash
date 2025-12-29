#!/bin/bash

# Script de Instalação/Atualização - Veeam VSPC Dashboard
# Ubuntu 24.04 LTS
# Modo seguro: preserva .env e banco de dados existentes

set -e

DOMAIN="veeamdash.zerogroup.local"
APP_DIR="/opt/veeam-dashboard"
DB_NAME="veeam_dashboard"
DB_USER="veeam_user"
DB_PASS="veeam_password"
REPO_URL="https://github.com/GruppenIT/VeeamDash.git"

echo "==========================================="
echo "Veeam VSPC Dashboard - Instalação/Atualização"
echo "==========================================="
echo ""

# ============================================
# VERIFICAÇÕES INICIAIS
# ============================================
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, execute como root (sudo ./install.sh)"
  exit 1
fi

# Detectar se é instalação nova ou atualização
IS_UPDATE=false
if [ -d "$APP_DIR" ] && [ -f "$APP_DIR/.env" ]; then
  IS_UPDATE=true
  echo "🔄 Modo ATUALIZAÇÃO detectado"
  echo "   - Arquivo .env será preservado"
  echo "   - Banco de dados será preservado"
  echo ""
else
  echo "🆕 Modo INSTALAÇÃO NOVA detectado"
  echo ""
fi

# Mudar para diretório seguro
cd /root

# ============================================
# INSTALAÇÃO DOS COMPONENTES DE SISTEMA
# ============================================

# [1] Atualizar sistema
echo "[1/10] Atualizando sistema..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

# [2] Instalar Node.js 20
echo "[2/10] Verificando Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
echo "  ✓ Node.js versão: $(node --version)"
echo "  ✓ NPM versão: $(npm --version)"

# [3] Instalar PostgreSQL
echo "[3/10] Verificando PostgreSQL..."
if ! command -v psql &> /dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
  systemctl start postgresql
  systemctl enable postgresql
fi
echo "  ✓ PostgreSQL instalado"

# [4] Instalar Nginx
echo "[4/10] Verificando Nginx..."
if ! command -v nginx &> /dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
fi
echo "  ✓ Nginx instalado"

# [5] Instalar Git e OpenSSL
echo "[5/10] Instalando ferramentas..."
DEBIAN_FRONTEND=noninteractive apt-get install -y git openssl curl

# [6] Configurar banco de dados (apenas se não existir)
echo "[6/10] Configurando banco de dados..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")
if [ "$DB_EXISTS" != "1" ]; then
  echo "  Criando banco de dados..."
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
  sudo -u postgres psql -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;" 2>/dev/null || true
  echo "  ✓ Banco de dados criado"
else
  echo "  ✓ Banco de dados já existe (preservado)"
fi

# [7] Instalar PM2 globalmente
echo "[7/10] Verificando PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 --silent
fi
echo "  ✓ PM2 instalado"

# ============================================
# BACKUP E ATUALIZAÇÃO DA APLICAÇÃO
# ============================================
echo "[8/10] Atualizando código-fonte..."

# Fazer backup do .env se existir
ENV_BACKUP=""
if [ -f "$APP_DIR/.env" ]; then
  ENV_BACKUP=$(cat "$APP_DIR/.env")
  echo "  ✓ Backup do .env realizado"
fi

# Parar aplicação se estiver rodando
pm2 stop veeam-dashboard 2>/dev/null || true

# Clonar ou atualizar repositório
if [ -d "$APP_DIR/.git" ]; then
  echo "  Atualizando repositório existente..."
  cd $APP_DIR
  git fetch origin
  git reset --hard origin/main
  echo "  ✓ Código atualizado via git pull"
else
  echo "  Clonando repositório..."
  rm -rf $APP_DIR 2>/dev/null || true
  git clone $REPO_URL $APP_DIR
  cd $APP_DIR
  echo "  ✓ Repositório clonado"
fi

# Restaurar .env do backup
if [ -n "$ENV_BACKUP" ]; then
  echo "$ENV_BACKUP" > "$APP_DIR/.env"
  echo "  ✓ Arquivo .env restaurado"
else
  # Criar .env apenas se não existir
  echo "  Criando arquivo .env..."
  cat > $APP_DIR/.env << ENV_EOF
# Database
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
PGUSER=$DB_USER
PGPASSWORD=$DB_PASS
PGDATABASE=$DB_NAME
PGHOST=localhost
PGPORT=5432

# Session
SESSION_SECRET=$(openssl rand -hex 32)

# Veeam API (CONFIGURAR MANUALMENTE)
# VEEAM_API_URL=https://seu-servidor-vspc:1280
# VEEAM_API_KEY=sua-chave-api-aqui

# Microsoft 365 (para envio de e-mails)
# M365_TENANT_ID=
# M365_CLIENT_ID=
# M365_CLIENT_SECRET=
# M365_SENDER_EMAIL=

# Node
NODE_ENV=production
PORT=5000
ENV_EOF
  echo "  ✓ Arquivo .env criado"
fi

# [9] Instalar dependências
echo "[9/10] Instalando dependências..."
cd $APP_DIR
npm install --include=dev --silent
echo "  ✓ Dependências Node.js instaladas"

# Instalar dependências do Playwright
echo "  Instalando dependências do Playwright..."
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  libnss3 \
  libxss1 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  fonts-liberation \
  libfontconfig1 \
  2>/dev/null || echo "  ⚠ Algumas dependências já instaladas"
npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium
echo "  ✓ Playwright e Chromium instalados"

# ============================================
# BUILD E MIGRAÇÃO
# ============================================
echo "[10/10] Compilando e migrando..."

# Carregar variáveis de ambiente
set -a
source $APP_DIR/.env
set +a

# Build da aplicação
npm run build
echo "  ✓ Aplicação compilada"

# Executar migração (preserva dados existentes)
npm run db:push
echo "  ✓ Migração do banco executada"

# Criar usuário padrão apenas se tabela estiver vazia
USER_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h localhost -U $PGUSER -d $PGDATABASE -tAc "SELECT COUNT(*) FROM users" 2>/dev/null || echo "0")
if [ "$USER_EXISTS" = "0" ]; then
  echo "  Criando usuário padrão..."
  npx tsx server/seed.ts
  echo "  ✓ Usuário padrão criado"
else
  echo "  ✓ Usuários existentes preservados ($USER_EXISTS encontrados)"
fi

# ============================================
# CONFIGURAR SCRIPTS AUXILIARES
# ============================================

# Copiar script de coleta de snapshots
if [ -f "$APP_DIR/scripts/collect-snapshots.sh" ]; then
  chmod +x $APP_DIR/scripts/collect-snapshots.sh
  echo "  ✓ Script de coleta de snapshots configurado"
fi

# Criar script wrapper para PM2
cat > $APP_DIR/start.sh << 'START_EOF'
#!/bin/bash
set -a
source /opt/veeam-dashboard/.env
set +a
exec node /opt/veeam-dashboard/dist/index.js
START_EOF
chmod +x $APP_DIR/start.sh

# Criar configuração do PM2
cat > $APP_DIR/ecosystem.config.cjs << 'PM2_EOF'
module.exports = {
  apps: [{
    name: 'veeam-dashboard',
    script: '/opt/veeam-dashboard/start.sh',
    cwd: '/opt/veeam-dashboard',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/root/.pm2/logs/veeam-dashboard-error.log',
    out_file: '/root/.pm2/logs/veeam-dashboard-out.log',
    time: true
  }]
};
PM2_EOF

# ============================================
# CONFIGURAR NGINX E SSL
# ============================================
if [ ! -f "/etc/ssl/veeam-dashboard/cert.pem" ]; then
  echo "Configurando certificado SSL..."
  mkdir -p /etc/ssl/veeam-dashboard
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/veeam-dashboard/key.pem \
    -out /etc/ssl/veeam-dashboard/cert.pem \
    -subj "/C=BR/ST=SP/L=SaoPaulo/O=GruppenIT/CN=$DOMAIN"
  chmod 600 /etc/ssl/veeam-dashboard/key.pem
  chmod 644 /etc/ssl/veeam-dashboard/cert.pem
  echo "  ✓ Certificado SSL criado"
fi

# Configurar Nginx
cat > /etc/nginx/sites-available/veeam-dashboard << NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/ssl/veeam-dashboard/cert.pem;
    ssl_certificate_key /etc/ssl/veeam-dashboard/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    access_log /var/log/nginx/veeam-dashboard-access.log;
    error_log /var/log/nginx/veeam-dashboard-error.log;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/veeam-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t
systemctl restart nginx
systemctl enable nginx
echo "  ✓ Nginx configurado"

# ============================================
# INICIAR APLICAÇÃO
# ============================================
pm2 start $APP_DIR/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
echo "  ✓ Aplicação iniciada com PM2"

# ============================================
# CONFIGURAR CRONTAB (se ainda não configurado)
# ============================================
CRON_EXISTS=$(crontab -l 2>/dev/null | grep -c "collect-snapshots.sh" || echo "0")
if [ "$CRON_EXISTS" = "0" ]; then
  echo "Configurando crontab para coleta de snapshots..."
  (crontab -l 2>/dev/null; echo "*/15 * * * * $APP_DIR/scripts/collect-snapshots.sh >> /var/log/veeam-snapshots.log 2>&1") | crontab -
  echo "  ✓ Crontab configurado (execução a cada 15 minutos)"
else
  echo "  ✓ Crontab já configurado"
fi

# ============================================
# FINALIZAÇÃO
# ============================================
echo ""
echo "==========================================="
echo "✅ Instalação/Atualização Concluída!"
echo "==========================================="
echo ""
echo "📌 Acesso:"
echo "   URL: https://$DOMAIN"
echo "   Login: login@sistema.com"
echo "   Senha: admin"
echo ""
echo "📁 Diretórios:"
echo "   App: $APP_DIR"
echo "   Logs: pm2 logs veeam-dashboard"
echo ""
if [ "$IS_UPDATE" = true ]; then
  echo "🔄 ATUALIZAÇÃO:"
  echo "   - Seu arquivo .env foi preservado"
  echo "   - Seu banco de dados foi preservado"
  echo "   - Apenas o código foi atualizado"
else
  echo "⚙️  PRÓXIMOS PASSOS:"
  echo "   1. Edite: $APP_DIR/.env"
  echo "   2. Configure VEEAM_API_URL e VEEAM_API_KEY"
  echo "   3. Reinicie: pm2 restart veeam-dashboard"
fi
echo ""
echo "📋 Comandos úteis:"
echo "   pm2 status              - Ver status"
echo "   pm2 logs veeam-dashboard - Ver logs"
echo "   pm2 restart veeam-dashboard - Reiniciar"
echo ""
