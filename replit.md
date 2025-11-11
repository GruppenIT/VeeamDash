# Veeam VSPC Dashboard

## Visão Geral

Aplicação web profissional para monitoramento de infraestrutura de backup através do **Veeam Service Provider Console (VSPC)**. Desenvolvida para service providers que precisam visualizar métricas de backup de múltiplos clientes de forma centralizada.

## Funcionalidades

### Autenticação
- Login seguro com sessão Express
- Usuário padrão: `login@sistema.com`
- Senha padrão: `admin`

### Dashboard Interativo
- **Seletor de Cliente**: Dropdown no header para alternar entre empresas
- **Métricas Principais**: Cards com total de backups, taxa de sucesso, jobs ativos e armazenamento
- **Status de Saúde**: Indicador visual (Healthy/Warning/Critical) baseado na taxa de sucesso
- **Gráfico de Tendência**: Taxa de sucesso de backups nos últimos meses
- **Repositórios**: Visualização de uso de armazenamento com barras de progresso
- **Tabela de Falhas**: Lista de jobs que falharam nos últimos 7 dias

### Agendamento de Relatórios
- Modal para configurar envio automático de relatórios por e-mail
- Frequência: Semanal ou Mensal
- Configuração de dia e horário de envio
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

### Instalação Automatizada

1. Transfira os arquivos para o servidor
2. Execute o script de instalação:
```bash
sudo chmod +x install.sh
sudo ./install.sh
```

3. Configure as credenciais do Veeam:
```bash
sudo nano /opt/veeam-dashboard/.env
```

Adicione:
```
VEEAM_API_URL=https://seu-vspc-server:1280
VEEAM_API_KEY=sua-chave-privada
```

4. Reinicie a aplicação:
```bash
pm2 restart veeam-dashboard
```

### O que o Script Faz

- Atualiza o sistema Ubuntu
- Instala Node.js 20 via NodeSource
- Instala e configura PostgreSQL
- Cria banco de dados e usuário dedicado
- Instala PM2 para gerenciamento de processos
- Configura a aplicação em `/opt/veeam-dashboard`
- Executa migração do banco de dados
- Inicia a aplicação com PM2 (auto-restart)
- Configura firewall (se UFW estiver ativo)

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

## Banco de Dados

### Schema

**Tabela: users**
- `id` (varchar, PK): UUID gerado automaticamente
- `username` (text): E-mail do usuário
- `password` (text): Senha (em produção, usar hash)
- `name` (text): Nome completo

**Tabela: email_schedules**
- `id` (varchar, PK): UUID gerado automaticamente
- `email` (text): Destinatário do relatório
- `frequency` (text): 'weekly' ou 'monthly'
- `dayOfWeek` (integer): 0-6 (Domingo-Sábado)
- `dayOfMonth` (integer): 1-31
- `hour` (integer): 0-23
- `minute` (integer): 0, 15, 30, 45
- `companyId` (text): ID da empresa Veeam
- `companyName` (text): Nome da empresa
- `userId` (varchar, FK): Referência ao usuário
- `createdAt` (timestamp): Data de criação

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

- Sessões HTTP-only cookies
- Validação de dados com Zod
- Prepared statements (proteção contra SQL injection via Drizzle)
- HTTPS recomendado em produção
- Session secret forte (gerado automaticamente pelo install.sh)

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

### v1.0.0 (2024-11-11)
- Lançamento inicial
- Dashboard completo com métricas em tempo real
- Integração com Veeam VSPC API v3
- Sistema de agendamento de relatórios
- Script de instalação automatizado para Ubuntu 24.04
- Modo demo para testes sem conexão ao VSPC
