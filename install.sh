#!/bin/bash

# Script de Instalação - Veeam VSPC Dashboard
# Ubuntu 24.04 LTS
# Instalação com Hard Reset, Nginx e Certificado Self-Signed

set -e

DOMAIN="veeamdash.zerogroup.local"
APP_DIR="/opt/veeam-dashboard"
DB_NAME="veeam_dashboard"
DB_USER="veeam_user"
DB_PASS="veeam_password"

echo "==========================================="
echo "Veeam VSPC Dashboard - Instalação Completa"
echo "==========================================="
echo ""
echo "🔄 HARD RESET - Limpeza completa do sistema"
echo ""

# ============================================
# HARD RESET - Limpar tudo antes de começar
# ============================================
echo "[RESET] Parando e removendo serviços existentes..."

# Parar e remover PM2
if command -v pm2 &> /dev/null; then
  pm2 delete veeam-dashboard 2>/dev/null || true
  pm2 kill 2>/dev/null || true
fi

# Parar Nginx
if command -v nginx &> /dev/null; then
  systemctl stop nginx 2>/dev/null || true
fi

# Remover diretório da aplicação
if [ -d "$APP_DIR" ]; then
  echo "Removendo diretório da aplicação..."
  rm -rf $APP_DIR
fi

# Remover configuração do Nginx
if [ -f "/etc/nginx/sites-enabled/veeam-dashboard" ]; then
  echo "Removendo configuração do Nginx..."
  rm -f /etc/nginx/sites-enabled/veeam-dashboard
  rm -f /etc/nginx/sites-available/veeam-dashboard
fi

# Remover certificados antigos
if [ -d "/etc/ssl/veeam-dashboard" ]; then
  echo "Removendo certificados antigos..."
  rm -rf /etc/ssl/veeam-dashboard
fi

# Limpar banco de dados
if command -v psql &> /dev/null; then
  echo "Limpando banco de dados..."
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
  sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true
fi

echo "✅ Limpeza concluída!"
echo ""

# ============================================
# VERIFICAÇÕES INICIAIS
# ============================================
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, execute como root (sudo ./install.sh)"
  exit 1
fi

# ============================================
# INSTALAÇÃO DOS COMPONENTES
# ============================================

# [1] Atualizar sistema
echo "[1/11] Atualizando sistema..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

# [2] Instalar Node.js 20
echo "[2/11] Instalando Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
echo "  ✓ Node.js versão: $(node --version)"
echo "  ✓ NPM versão: $(npm --version)"

# [3] Instalar PostgreSQL
echo "[3/11] Instalando PostgreSQL..."
if ! command -v psql &> /dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
  systemctl start postgresql
  systemctl enable postgresql
fi
echo "  ✓ PostgreSQL instalado"

# [4] Instalar Nginx
echo "[4/11] Instalando Nginx..."
if ! command -v nginx &> /dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
fi
echo "  ✓ Nginx instalado"

# [5] Instalar Git e OpenSSL
echo "[5/11] Instalando Git e ferramentas..."
DEBIAN_FRONTEND=noninteractive apt-get install -y git openssl

# [6] Configurar banco de dados
echo "[6/11] Configurando banco de dados PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;"
echo "  ✓ Banco de dados configurado"

# [7] Instalar PM2 globalmente
echo "[7/11] Instalando PM2..."
npm install -g pm2 --silent
echo "  ✓ PM2 instalado"

# [8] Clonar e configurar aplicação
echo "[8/11] Baixando código-fonte do GitHub..."
git clone https://github.com/GruppenIT/VeeamDash.git $APP_DIR
cd $APP_DIR

# [9] Instalar dependências (SEM --production para incluir drizzle-kit)
echo "[9/11] Instalando dependências..."
npm install --silent
echo "  ✓ Dependências instaladas"

# [10] Criar certificado SSL self-signed
echo "[10/11] Criando certificado SSL self-signed..."
mkdir -p /etc/ssl/veeam-dashboard
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/veeam-dashboard/key.pem \
  -out /etc/ssl/veeam-dashboard/cert.pem \
  -subj "/C=BR/ST=SP/L=SaoPaulo/O=GruppenIT/CN=$DOMAIN"
chmod 600 /etc/ssl/veeam-dashboard/key.pem
chmod 644 /etc/ssl/veeam-dashboard/cert.pem
echo "  ✓ Certificado SSL criado"

# [11] Configurar Nginx
echo "[11/11] Configurando Nginx como reverse proxy..."

# Detectar IP do servidor
SERVER_IP=$(hostname -I | awk '{print $1}')

cat > /etc/nginx/sites-available/veeam-dashboard << NGINX_EOF
server {
    listen 80 default_server;
    server_name veeamdash.zerogroup.local $SERVER_IP _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2 default_server;
    server_name veeamdash.zerogroup.local $SERVER_IP _;

    ssl_certificate /etc/ssl/veeam-dashboard/cert.pem;
    ssl_certificate_key /etc/ssl/veeam-dashboard/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    access_log /var/log/nginx/veeam-dashboard-access.log;
    error_log /var/log/nginx/veeam-dashboard-error.log;

    client_max_body_size 100M;

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

# Ativar site
ln -sf /etc/nginx/sites-available/veeam-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração do Nginx
nginx -t

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx
echo "  ✓ Nginx configurado e iniciado"

# ============================================
# CONFIGURAR VARIÁVEIS DE AMBIENTE
# ============================================
echo ""
echo "Configurando variáveis de ambiente..."
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

# Node
NODE_ENV=production
PORT=5000
ENV_EOF

# ============================================
# BUILD DA APLICAÇÃO
# ============================================
echo "Compilando aplicação..."
npm run build

# ============================================
# EXECUTAR MIGRAÇÃO DO BANCO
# ============================================
echo "Executando migração do banco de dados..."
npm run db:push

# ============================================
# CONFIGURAR PM2
# ============================================
echo "Configurando PM2 para inicialização automática..."

# Criar arquivo de configuração do PM2 que carrega o .env
cat > $APP_DIR/ecosystem.config.cjs << 'PM2_EOF'
module.exports = {
  apps: [{
    name: 'veeam-dashboard',
    script: 'npm',
    args: 'start',
    cwd: '/opt/veeam-dashboard',
    env: {
      NODE_ENV: 'production',
      PORT: '5000'
    },
    env_file: '/opt/veeam-dashboard/.env',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/root/.pm2/logs/veeam-dashboard-error.log',
    out_file: '/root/.pm2/logs/veeam-dashboard-out.log',
    log_file: '/root/.pm2/logs/veeam-dashboard-combined.log',
    time: true
  }]
};
PM2_EOF

# Iniciar aplicação com PM2
pm2 start $APP_DIR/ecosystem.config.cjs
pm2 save

# Configurar PM2 para iniciar no boot
PM2_STARTUP_CMD=$(pm2 startup systemd -u root --hp /root | grep 'sudo env')
if [ -n "$PM2_STARTUP_CMD" ]; then
  eval "$PM2_STARTUP_CMD" 2>/dev/null || true
fi
echo "  ✓ PM2 configurado para auto-start"

# ============================================
# CONFIGURAR FIREWALL
# ============================================
if command -v ufw &> /dev/null; then
  echo "Configurando firewall..."
  ufw allow 80/tcp 2>/dev/null || true
  ufw allow 443/tcp 2>/dev/null || true
fi

# ============================================
# ADICIONAR ENTRADA NO /etc/hosts
# ============================================
if ! grep -q "$DOMAIN" /etc/hosts; then
  echo "Adicionando $DOMAIN ao /etc/hosts..."
  echo "127.0.0.1 $DOMAIN" >> /etc/hosts
fi

# ============================================
# VERIFICAÇÃO FINAL
# ============================================
echo ""
echo "Verificando status dos serviços..."

# Verificar Nginx
if systemctl is-active --quiet nginx; then
  echo "  ✓ Nginx rodando"
else
  echo "  ✗ Nginx não está rodando"
fi

# Verificar PM2
if pm2 list | grep -q "veeam-dashboard.*online"; then
  echo "  ✓ Aplicação PM2 rodando"
else
  echo "  ✗ Aplicação PM2 não está rodando"
fi

# Verificar PostgreSQL
if systemctl is-active --quiet postgresql; then
  echo "  ✓ PostgreSQL rodando"
else
  echo "  ✗ PostgreSQL não está rodando"
fi

# Aguardar a aplicação iniciar
echo ""
echo "Aguardando aplicação iniciar (5s)..."
sleep 5

# Testar conectividade local
echo "Testando conectividade..."
if curl -k -s -o /dev/null -w "%{http_code}" https://localhost:443 | grep -q "200\|301\|302"; then
  echo "  ✓ HTTPS (443) respondendo"
else
  echo "  ⚠  HTTPS pode levar alguns segundos para responder"
fi

# ============================================
# FINALIZAÇÃO
# ============================================
echo ""
echo "==========================================="
echo "✅ Instalação Concluída com Sucesso!"
echo "==========================================="
echo ""
echo "📊 ACESSO À APLICAÇÃO:"
echo "  Domínio: https://$DOMAIN"
echo "  Por IP:  https://$SERVER_IP"
echo "  Direto:  http://localhost:5000"
echo ""
echo "🔐 CREDENCIAIS DE LOGIN:"
echo "  E-mail: login@sistema.com"
echo "  Senha:  admin"
echo ""
echo "⚙️  CERTIFICADO SSL:"
echo "  ⚠️  Certificado self-signed criado"
echo "  📁 Localização: /etc/ssl/veeam-dashboard/"
echo "  ℹ️  Navegador mostrará aviso de segurança (normal)"
echo "  ℹ️  Clique em 'Avançado' > 'Prosseguir'"
echo ""
echo "🔧 CONFIGURAÇÃO DO VEEAM (OPCIONAL):"
echo "  1. Edite: $APP_DIR/.env"
echo "  2. Descomente e configure:"
echo "     VEEAM_API_URL=https://seu-servidor-vspc:1280"
echo "     VEEAM_API_KEY=sua-chave-api"
echo "  3. Reinicie: pm2 restart veeam-dashboard"
echo ""
echo "📝 COMANDOS ÚTEIS:"
echo "  pm2 status                    - Status da aplicação"
echo "  pm2 logs veeam-dashboard      - Ver logs em tempo real"
echo "  pm2 restart veeam-dashboard   - Reiniciar aplicação"
echo "  pm2 stop veeam-dashboard      - Parar aplicação"
echo "  systemctl status nginx        - Status do Nginx"
echo "  systemctl restart nginx       - Reiniciar Nginx"
echo ""
echo "📁 DIRETÓRIOS IMPORTANTES:"
echo "  Aplicação:    $APP_DIR"
echo "  Logs Nginx:   /var/log/nginx/"
echo "  SSL Certs:    /etc/ssl/veeam-dashboard/"
echo ""
echo "🌐 ACESSO REMOTO:"
echo "  Configure o DNS ou /etc/hosts no cliente:"
echo "  <IP_DO_SERVIDOR> $DOMAIN"
echo ""
echo "==========================================="
