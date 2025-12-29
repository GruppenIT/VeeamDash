# Veeam VSPC Dashboard

## Visão Geral

Aplicação web profissional para monitoramento de infraestrutura de backup através do **Veeam Service Provider Console (VSPC)**. Desenvolvida para service providers que precisam visualizar métricas de backup de múltiplos clientes de forma centralizada.

## Funcionalidades

### Autenticação
- Login seguro com sessão Express
- **Senhas hasheadas** com bcrypt (10 rounds)
- Usuário padrão: `login@sistema.com`
- Senha padrão: `admin`
- Página de perfil com **troca de senha**

### Dashboard Interativo
- **Seletor de Cliente**: Dropdown no header para alternar entre empresas
- **Métricas Principais**: Cards com total de backups, taxa de sucesso, jobs ativos e armazenamento
- **Protected Data Overview**: Painel com gráfico donut mostrando distribuição de workloads protegidos (Computers, VMs, Cloud Instances, M365 Objects)
- **Status de Saúde**: Indicador visual (Healthy/Warning/Critical) baseado na taxa de sucesso
- **Gráfico de Tendência**: Taxa de sucesso de backups nos últimos 6 meses (dinâmico)
- **Repositórios**: Visualização de uso de armazenamento com barras de progresso
- **Tabela de Falhas**: Lista de jobs que falharam recentemente

### Agendamento de Relatórios
- Página dedicada `/agendamentos` para gerenciar envio automático de relatórios
- Frequência: Diária, Semanal ou Mensal
- Configuração de dia e horário de envio
- Múltiplos destinatários por agendamento
- Geração automática de PDF com métricas do dashboard
- Envio de e-mail via Microsoft Graph API (M365)
- Histórico de execuções com status de sucesso/erro
- Persistência em banco de dados PostgreSQL

## Arquitetura Técnica

### Frontend
- **Framework**: React 18 com TypeScript
- **Routing**: Wouter (SPA)
- **Styling**: Tailwind CSS + Shadcn UI
- **Charts**: Recharts para visualizações
- **State Management**: TanStack Query (React Query v5)
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL (via Neon Serverless)
- **ORM**: Drizzle ORM
- **Session**: Express Session
- **API Integration**: Axios para chamadas ao Veeam VSPC

### Integração com Veeam API

A aplicação se conecta à API REST do Veeam Service Provider Console v3:

**Endpoints Utilizados:**
- `GET /api/v3/organizations/companies` - Lista de clientes
- `GET /api/v3/infrastructure/backupServers/jobs/backupVmJobs` - Jobs de backup
- `GET /api/v3/protectedWorkloads/virtualMachines` - VMs protegidas
- `GET /api/v3/protectedWorkloads/computers` - Computadores protegidos (Veeam Agents)
- `GET /api/v3/protectedWorkloads/vb365ProtectedObjects` - Microsoft 365 Objects

**Modo Demo**: Quando as credenciais do VSPC não estão configuradas, a aplicação usa dados de demonstração para permitir testes da interface.

## Estrutura do Projeto

```
/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── pages/         # Páginas (Login, Dashboard)
│   │   └── lib/           # Utilities
├── server/                # Backend Express
│   ├── routes.ts          # Rotas da API
│   ├── storage.ts         # Interface de persistência
│   ├── veeam-service.ts   # Integração com Veeam API
│   └── db.ts              # Conexão com PostgreSQL
├── shared/                # Código compartilhado
│   └── schema.ts          # Schemas Drizzle + tipos TypeScript
└── install.sh             # Script de instalação Ubuntu 24.04
```

## Desenvolvimento

### Requisitos
- Node.js 20+
- PostgreSQL 14+
- Credenciais da API do Veeam VSPC (opcional para demo)

### Configuração Local

1. Clone o repositório
2. Copie `.env.example` para `.env` e configure as variáveis
3. Instale as dependências:
```bash
npm install
```

4. Execute a migração do banco:
```bash
npm run db:push
```

5. Inicie o servidor:
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5000`

## Instalação em Produção (Ubuntu 24.04)

### 🚀 Instalação/Atualização Automatizada

Execute o script de instalação que funciona tanto para **instalação nova** quanto para **atualização**:

```bash
curl -fsSL https://raw.githubusercontent.com/GruppenIT/VeeamDash/refs/heads/main/install.sh | sudo bash
```

**O script é seguro e não-destrutivo:**
- ✅ **Preserva arquivo .env** existente (faz backup e restaura)
- ✅ **Preserva banco de dados** (usa apenas migrações)
- ✅ PostgreSQL + Node.js 20 + PM2 + Nginx + Playwright
- ✅ **Certificado SSL self-signed** para HTTPS
- ✅ **Domínio local**: `veeamdash.zerogroup.local`
- ✅ Build da aplicação e migração incremental do banco
- ✅ PM2 com auto-restart configurado
- ✅ Crontab para coleta automática de snapshots

### 🌐 Acesso Após Instalação

**No próprio servidor:**
```
https://veeamdash.zerogroup.local
```

**De outro computador na rede:**

Adicione ao arquivo hosts do cliente:
- Linux/Mac: `/etc/hosts`
- Windows: `C:\Windows\System32\drivers\etc\hosts`

```
<IP_DO_SERVIDOR> veeamdash.zerogroup.local
```

Depois acesse: `https://veeamdash.zerogroup.local`

⚠️ **Certificado Self-Signed**: O navegador mostrará aviso de segurança (comportamento normal). Clique em "Avançado" → "Prosseguir para o site".

### ⚙️ Configurar API do Veeam (Opcional)

1. Edite o arquivo de configuração:
```bash
sudo nano /opt/veeam-dashboard/.env
```

2. Descomente e configure:
```
VEEAM_API_URL=https://seu-vspc-server:1280
VEEAM_API_KEY=sua-chave-privada
```

3. Reinicie a aplicação:
```bash
pm2 restart veeam-dashboard
```

### 📁 Diretórios Importantes

- **Aplicação**: `/opt/veeam-dashboard`
- **Logs Nginx**: `/var/log/nginx/veeam-dashboard-*.log`
- **Certificados SSL**: `/etc/ssl/veeam-dashboard/`
- **Config Nginx**: `/etc/nginx/sites-available/veeam-dashboard`

## Gerenciamento com PM2

```bash
# Ver status
pm2 status

# Logs em tempo real
pm2 logs veeam-dashboard

# Reiniciar
pm2 restart veeam-dashboard

# Parar
pm2 stop veeam-dashboard

# Monitoramento
pm2 monit
```

## Configuração de API do Veeam

### Gerar Chave de API no VSPC

1. Acesse o Veeam Service Provider Console
2. Vá em **Configuration > REST API Keys**
3. Clique em **Add** > **Simple Key**
4. Copie a **Private Key** gerada
5. Configure no `.env` da aplicação

### Formato da URL
```
VEEAM_API_URL=https://vspc-server.exemplo.com:1280
```

**Porta padrão**: 1280 (HTTPS)

## Configuração de E-mail (Microsoft 365)

Para habilitar o envio automático de relatórios por e-mail, é necessário configurar uma aplicação no Azure AD com permissões do Microsoft Graph.

### Criar Aplicação no Azure AD

1. Acesse o [Azure Portal](https://portal.azure.com)
2. Vá em **Azure Active Directory** > **App registrations**
3. Clique em **New registration**
4. Configure:
   - **Name**: Veeam Dashboard Reports
   - **Supported account types**: Single tenant
5. Após criar, anote o **Application (client) ID** e **Directory (tenant) ID**
6. Vá em **Certificates & secrets** > **New client secret**
7. Anote o **Value** do secret gerado

### Configurar Permissões

1. Vá em **API permissions** > **Add a permission**
2. Selecione **Microsoft Graph** > **Application permissions**
3. Adicione: `Mail.Send`
4. Clique em **Grant admin consent**

### Variáveis de Ambiente M365

Configure as seguintes variáveis no `.env`:

```env
M365_TENANT_ID=seu-tenant-id
M365_CLIENT_ID=seu-client-id
M365_CLIENT_SECRET=seu-client-secret
M365_SENDER_EMAIL=remetente@seudominio.com
```

**Importante**: O e-mail remetente (`M365_SENDER_EMAIL`) deve ser uma conta válida no tenant configurado e ter licença para envio de e-mails.

### Testar Configuração

Após configurar as variáveis, reinicie a aplicação:
```bash
pm2 restart veeam-dashboard
```

O sistema mostrará nos logs se a configuração foi bem-sucedida ao iniciar.

## Banco de Dados

### Schema

**Tabela: users**
- `id` (varchar, PK): UUID gerado automaticamente
- `username` (text): E-mail do usuário
- `password` (text): Senha hasheada com bcrypt (10 rounds)
- `name` (text): Nome completo

**Tabela: report_schedules**
- `id` (varchar, PK): UUID gerado automaticamente
- `name` (text): Nome do agendamento
- `companyId` (text): ID da empresa Veeam
- `companyName` (text): Nome da empresa
- `frequency` (text): 'daily', 'weekly' ou 'monthly'
- `dayOfWeek` (integer, nullable): 0-6 (Domingo-Sábado) para frequência semanal
- `dayOfMonth` (integer, nullable): 1-31 para frequência mensal
- `hour` (integer): 0-23
- `minute` (integer): 0, 15, 30, 45
- `isActive` (boolean): Se o agendamento está ativo
- `userId` (varchar, FK): Referência ao usuário criador
- `createdAt` (timestamp): Data de criação

**Tabela: schedule_recipients**
- `id` (varchar, PK): UUID gerado automaticamente
- `scheduleId` (varchar, FK): Referência ao agendamento
- `email` (text): E-mail do destinatário

**Tabela: schedule_runs**
- `id` (varchar, PK): UUID gerado automaticamente
- `scheduleId` (varchar, FK): Referência ao agendamento
- `status` (text): 'running', 'success' ou 'failed'
- `recipientCount` (integer): Número de destinatários
- `errorMessage` (text, nullable): Mensagem de erro se falhou
- `startedAt` (timestamp): Início da execução
- `completedAt` (timestamp, nullable): Fim da execução

### Migrations

O projeto usa Drizzle Kit para migrações:

```bash
# Gerar e aplicar migration
npm run db:push

# Forçar migration (se houver conflitos)
npm run db:push --force
```

## Design System

A aplicação segue as diretrizes definidas em `design_guidelines.md`:

- **Cores Principais**: Verde Veeam (#00B336) como primary
- **Tipografia**: Inter (títulos/corpo), Roboto Mono (dados/métricas)
- **Componentes**: Shadcn UI com tema customizado
- **Layout**: Responsivo, mobile-first
- **Tema**: Suporte a modo claro/escuro

## Segurança

- **Senhas hasheadas** com bcrypt (10 rounds)
- Sessões HTTP-only cookies (24h de duração)
- Validação de dados com Zod em todos os endpoints
- Prepared statements (proteção contra SQL injection via Drizzle)
- HTTPS obrigatório em produção (Nginx com SSL self-signed)
- Session secret forte (gerado automaticamente pelo install.sh)
- **Troca de senha** segura com validação da senha atual

## Monitoramento

### Logs da Aplicação
```bash
# PM2 logs
pm2 logs veeam-dashboard --lines 100

# Logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Health Check
```bash
curl http://localhost:5000/api/companies
```

## Troubleshooting

### Aplicação não inicia
```bash
# Verificar logs
pm2 logs veeam-dashboard

# Verificar se o banco está acessível
psql -U veeam_user -d veeam_dashboard -h localhost
```

### Conexão com Veeam falha
- Verifique se a URL está correta (incluindo porta 1280)
- Confirme que a chave de API é válida
- Teste conectividade: `curl -k https://vspc-server:1280`
- Verifique firewall/rede entre o servidor e o VSPC

### Banco de dados não conecta
```bash
# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Verificar status
sudo systemctl status postgresql
```

## Licença e Suporte

Aplicação desenvolvida para integração com Veeam Service Provider Console.

Para suporte com a API do Veeam: https://helpcenter.veeam.com/docs/vac/rest/

## Changelog

### v1.2.0 (2024-12-12)
- **✨ Novo**: Tabela "Jobs com Falha" exibindo jobs com status Failed/Warning
- **🔧 Fix**: Correção do endpoint de failed jobs - agora usa dados direto do endpoint de jobs (API Veeam não tem endpoint global de sessions)
- **📊 Dashboard**: Jobs com falha exibidos abaixo do calendário de estados de sessão

### v1.1.0 (2024-11-14)
- **🔒 Segurança**: Implementado hash de senhas com bcrypt (10 rounds)
- **✨ Novo**: Painel "Protected Data Overview" com gráfico donut e tabela de workloads
- **✨ Novo**: Página de perfil com troca de senha
- **🔧 Melhoria**: Gráfico de sucesso mensal agora mostra últimos 6 meses dinamicamente
- **🔌 API**: Integração com endpoints v3 de protected workloads (VMs, computers, M365)
- **🔧 Fix**: Correção de driver PostgreSQL para on-premise (pg ao invés de @neondatabase/serverless)
- **🔧 Fix**: Session cookies configuradas para funcionar com Nginx proxy (secure=false)

### v1.0.0 (2024-11-11)
- Lançamento inicial
- Dashboard completo com métricas em tempo real
- Integração com Veeam VSPC API v3
- Sistema de agendamento de relatórios
- Script de instalação automatizado para Ubuntu 24.04
- Modo demo para testes sem conexão ao VSPC
