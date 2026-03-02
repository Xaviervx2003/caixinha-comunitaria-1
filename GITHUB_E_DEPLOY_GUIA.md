# 📚 Guia Completo: GitHub + Deploy no Gemini

## 🚀 PARTE 1: EXPORTAR PARA GITHUB

### Passo 1: Criar Repositório no GitHub

1. Acesse https://github.com/new
2. Preencha os dados:
   - **Repository name**: `caixinha-comunitaria`
   - **Description**: `App de gerenciamento de caixinha comunitária com PWA e sincronização em tempo real`
   - **Visibility**: Escolha `Public` (público) ou `Private` (privado)
   - **Clique em "Create repository"**

### Passo 2: Conectar Repositório Local ao GitHub

Abra o terminal e execute os comandos:

```bash
# Navegue até a pasta do projeto
cd /home/ubuntu/caixinha-comunitaria

# Adicione o repositório remoto (substitua SEU_USUARIO e SEU_REPO)
git remote add origin https://github.com/SEU_USUARIO/caixinha-comunitaria.git

# Verifique se foi adicionado
git remote -v

# Faça o primeiro commit
git add .
git commit -m "Initial commit: Caixinha Comunitária v4.1"

# Envie para o GitHub (substitua main se usar outra branch)
git branch -M main
git push -u origin main
```

### Passo 3: Configurar GitHub (Opcional mas Recomendado)

1. **Adicionar Colaboradores**:
   - Vá para Settings → Collaborators
   - Clique em "Add people"
   - Digite o username de quem quer adicionar

2. **Proteger Branch Main**:
   - Vá para Settings → Branches
   - Clique em "Add rule"
   - Branch name pattern: `main`
   - Ative "Require pull request reviews"

3. **Configurar GitHub Actions** (CI/CD):
   - Vá para Actions
   - Escolha um template Node.js
   - Configure para rodar testes automaticamente

---

## 🌐 PARTE 2: DEPLOY NO GEMINI (Google Cloud)

### ⚠️ Nota Importante
Gemini é um modelo de IA, não um servidor. Para fazer deploy, você precisa usar:
- **Google Cloud Run** (recomendado - serverless)
- **Google Cloud App Engine**
- **Google Compute Engine** (máquina virtual)

Vou mostrar como fazer deploy no **Google Cloud Run** (mais fácil e barato).

---

## 📦 DEPLOY NO GOOGLE CLOUD RUN

### Pré-requisitos

1. **Criar conta Google Cloud**:
   - Acesse https://console.cloud.google.com
   - Crie uma nova conta ou use a existente
   - Ative o faturamento (você ganha $300 de crédito grátis)

2. **Instalar Google Cloud CLI**:
   ```bash
   # No Linux/Mac
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   
   # Ou no Windows (use PowerShell como admin)
   (New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe") & & $env:Temp\GoogleCloudSDKInstaller.exe
   ```

3. **Autenticar no Google Cloud**:
   ```bash
   gcloud init
   gcloud auth login
   ```

### Passo 1: Preparar Projeto para Deploy

1. **Criar arquivo `.gcloudignore`** (na raiz do projeto):
   ```
   node_modules/
   .git/
   .env.local
   .DS_Store
   dist/
   build/
   *.log
   ```

2. **Criar arquivo `Dockerfile`** (na raiz do projeto):
   ```dockerfile
   FROM node:22-alpine

   WORKDIR /app

   # Copiar package.json e pnpm-lock.yaml
   COPY package.json pnpm-lock.yaml ./

   # Instalar pnpm
   RUN npm install -g pnpm

   # Instalar dependências
   RUN pnpm install --frozen-lockfile

   # Copiar código
   COPY . .

   # Build
   RUN pnpm build

   # Expor porta
   EXPOSE 3000

   # Comando para iniciar
   CMD ["pnpm", "start"]
   ```

3. **Criar arquivo `app.yaml`** (na raiz do projeto):
   ```yaml
   runtime: nodejs22
   env: standard
   
   env_variables:
     NODE_ENV: "production"
   
   handlers:
   - url: /.*
     script: auto
   ```

### Passo 2: Fazer Deploy

```bash
# 1. Defina o projeto
gcloud config set project SEU_PROJECT_ID

# 2. Faça deploy
gcloud run deploy caixinha-comunitaria \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=sua_url_banco,JWT_SECRET=sua_chave_secreta,RESEND_API_KEY=sua_chave_resend

# 3. Aguarde o deploy terminar
# Você receberá uma URL como: https://caixinha-comunitaria-xxxxx.run.app
```

### Passo 3: Configurar Variáveis de Ambiente

No Google Cloud Console:

1. Vá para **Cloud Run** → Seu serviço
2. Clique em **Edit & Deploy New Revision**
3. Vá para **Runtime settings** → **Runtime environment variables**
4. Adicione:
   - `DATABASE_URL`: URL do seu banco de dados
   - `JWT_SECRET`: Chave secreta para JWT
   - `RESEND_API_KEY`: Chave da API Resend
   - `VITE_APP_ID`: ID da app Manus
   - `OAUTH_SERVER_URL`: URL do servidor OAuth
   - Todas as outras variáveis necessárias

5. Clique em **Deploy**

### Passo 4: Configurar Domínio Customizado (Opcional)

1. No Google Cloud Console, vá para **Cloud Run**
2. Clique em seu serviço
3. Clique em **Manage Custom Domains**
4. Clique em **Add Mapping**
5. Selecione seu domínio (ou adicione um novo)
6. Clique em **Continue**
7. Siga as instruções para configurar DNS

---

## 🔄 ALTERNATIVA: DEPLOY NO RAILWAY (Mais Fácil)

Railway é mais simples que Google Cloud. Aqui está como fazer:

### Passo 1: Criar Conta no Railway

1. Acesse https://railway.app
2. Clique em "Start Project"
3. Faça login com GitHub (recomendado)

### Passo 2: Conectar Repositório

1. Clique em "New Project"
2. Selecione "Deploy from GitHub"
3. Autorize Railway a acessar seu GitHub
4. Selecione o repositório `caixinha-comunitaria`
5. Clique em "Deploy"

### Passo 3: Configurar Variáveis de Ambiente

1. No Railway, vá para **Variables**
2. Clique em **Raw Editor**
3. Cole suas variáveis de ambiente:
   ```
   DATABASE_URL=sua_url_banco
   JWT_SECRET=sua_chave_secreta
   RESEND_API_KEY=sua_chave_resend
   VITE_APP_ID=seu_app_id
   OAUTH_SERVER_URL=sua_url_oauth
   ```
4. Clique em **Save**

### Passo 4: Configurar Domínio

1. Vá para **Settings** → **Domains**
2. Clique em **+ Add Domain**
3. Digite seu domínio
4. Siga as instruções para configurar DNS

---

## 🗄️ BANCO DE DADOS

### Opção 1: Usar Banco Existente (Recomendado)

Se você já tem um banco de dados (MySQL, PostgreSQL, etc):

1. Obtenha a string de conexão
2. Adicione como variável de ambiente `DATABASE_URL`

### Opção 2: Criar Banco Novo

**No Google Cloud SQL**:
```bash
gcloud sql instances create caixinha-db \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=us-central1
```

**No Railway**:
1. Clique em **+ Create** → **Database**
2. Selecione **MySQL** ou **PostgreSQL**
3. Railway criará automaticamente e fornecerá a URL

---

## 🔐 SEGURANÇA

### Checklist de Segurança

- [ ] Nunca commit `.env` ou arquivos com secrets
- [ ] Use variáveis de ambiente para todas as chaves
- [ ] Ative HTTPS (automático no Cloud Run e Railway)
- [ ] Configure CORS corretamente
- [ ] Use JWT para autenticação
- [ ] Valide todas as entradas do usuário
- [ ] Use prepared statements para queries SQL

### Arquivo `.gitignore` (já deve estar configurado)

```
node_modules/
.env
.env.local
.env.*.local
dist/
build/
*.log
.DS_Store
.vscode/
.idea/
```

---

## 📊 MONITORAMENTO

### Google Cloud Run

1. Vá para **Cloud Run** → Seu serviço
2. Clique em **Logs** para ver logs em tempo real
3. Clique em **Metrics** para ver performance

### Railway

1. Vá para **Deployments**
2. Clique em um deployment para ver logs
3. Vá para **Monitoring** para ver métricas

---

## 🚨 TROUBLESHOOTING

### Erro: "Build failed"

```bash
# Verifique se o build local funciona
pnpm build

# Verifique se todas as dependências estão no package.json
pnpm list
```

### Erro: "Database connection failed"

```bash
# Verifique se DATABASE_URL está correto
echo $DATABASE_URL

# Teste a conexão
mysql -h seu_host -u seu_usuario -p seu_banco
```

### Erro: "Port already in use"

```bash
# Mude a porta no código ou use variável de ambiente
PORT=3000 pnpm start
```

---

## 📝 PRÓXIMOS PASSOS

1. **Fazer primeiro commit no GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Fazer deploy no Cloud Run ou Railway**:
   - Escolha uma das opções acima
   - Siga os passos
   - Teste a URL fornecida

3. **Configurar domínio customizado**:
   - Compre um domínio (GoDaddy, Namecheap, etc)
   - Configure DNS apontando para seu serviço
   - Ative HTTPS

4. **Configurar CI/CD**:
   - Adicione GitHub Actions para testes automáticos
   - Configure deploy automático ao fazer push

---

## 📞 SUPORTE

Se tiver dúvidas:

- **Google Cloud**: https://cloud.google.com/docs
- **Railway**: https://docs.railway.app
- **GitHub**: https://docs.github.com
- **Node.js**: https://nodejs.org/docs

---

**Última atualização**: Janeiro 2026
**Versão do Projeto**: 4.1
