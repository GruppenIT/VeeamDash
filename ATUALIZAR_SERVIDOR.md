# 🔄 Guia Completo - Atualizar Servidor On-Premise

## ⚠️ IMPORTANTE: Execute TODOS os comandos na ordem

### 1️⃣ Conectar ao Servidor
```bash
ssh usuario@IP_DO_SERVIDOR
```

### 2️⃣ Navegar até o Diretório
```bash
cd /opt/veeam-dashboard
```

### 3️⃣ Ver Qual Versão Está no Servidor
```bash
git log --oneline -1
```
**Anote o código do commit atual**

### 4️⃣ Baixar Atualizações do GitHub
```bash
sudo git fetch origin
sudo git reset --hard origin/main
```
**Este comando FORÇA a atualização, descartando qualquer modificação local**

### 5️⃣ Verificar se Atualizou
```bash
git log --oneline -1
```
**O código do commit deve ser diferente do passo 3**

### 6️⃣ Verificar se Arquivo Protected Data Existe
```bash
ls -lh client/src/components/protected-data-overview.tsx
```
**Deve mostrar o arquivo com tamanho ~10KB**

### 7️⃣ Instalar Dependências
```bash
sudo npm install --include=dev
```

### 8️⃣ Fazer Build da Aplicação
```bash
sudo npm run build
```
**Aguarde até aparecer "✓ built in XXXXms"**

### 9️⃣ Reiniciar PM2
```bash
sudo pm2 restart veeam-dashboard
```

### 🔟 Verificar Logs
```bash
sudo pm2 logs veeam-dashboard --lines 50
```
**Não deve ter erros em vermelho**

---

## ✅ Testar no Navegador

1. **Limpar cache do navegador:**
   - Chrome: `Ctrl + Shift + Delete` → Limpar cache
   - Ou abrir em aba anônima: `Ctrl + Shift + N`

2. **Acessar:**
   ```
   https://veeam-dashboard.zerogroup.local/dashboard
   ```

3. **Fazer login:**
   - Email: `login@sistema.com`
   - Senha: `admin`

4. **Verificar se aparece o painel "Protected Data Overview"**
   - Deve aparecer DEPOIS dos 4 cards principais (Total de Backups, Taxa de Sucesso, etc)
   - ANTES do card "Saúde Geral do Sistema"

---

## 🆘 Se NÃO Aparecer Ainda

### Verificar Erro no Console do Navegador

1. Abrir console: `F12` → Aba "Console"
2. Procurar por erros em vermelho
3. Me enviar screenshot se houver erros

### Verificar Build Completo

```bash
cd /opt/veeam-dashboard
ls -lh dist/
```

**Deve mostrar vários arquivos .js e .css**

### Forçar Rebuild Completo

```bash
cd /opt/veeam-dashboard
sudo rm -rf dist/
sudo rm -rf node_modules/.vite
sudo npm run build
sudo pm2 restart veeam-dashboard
```

---

## 📞 Se Continuar com Problema

Me envie:
1. Screenshot do console do navegador (F12)
2. Saída do comando: `sudo pm2 logs veeam-dashboard --lines 100`
3. Saída do comando: `git log --oneline -5`
