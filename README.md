# 💰 Caixinha Comunitária

Um aplicativo web moderno para gerenciar caixinhas comunitárias com sincronização em tempo real, PWA (funciona como app mobile) e suporte offline.

![Version](https://img.shields.io/badge/version-4.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-22-green)

## ✨ Características

- 📱 **PWA (Progressive Web App)** - Funciona como app nativo em iOS e Android
- 🔄 **Sincronização em Tempo Real** - Múltiplos usuários veem atualizações instantaneamente
- 📧 **Envio de Emails** - Confirmação automática de pagamentos
- 💾 **Offline First** - Funciona sem internet, sincroniza quando voltar online
- 👥 **Compartilhamento** - Convide amigos para gerenciar a caixinha juntos
- 📊 **Dashboard** - Visualize estatísticas e histórico de transações
- 🎨 **Design Moderno** - Interface intuitiva e responsiva

## 🚀 Quick Start

### Pré-requisitos

- Node.js 22+
- pnpm (ou npm)
- Banco de dados MySQL/PostgreSQL

### Instalação Local

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/caixinha-comunitaria.git
cd caixinha-comunitaria

# 2. Instale as dependências
pnpm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local

# 4. Configure o banco de dados
pnpm db:push

# 5. Inicie o servidor de desenvolvimento
pnpm dev

# 6. Acesse http://localhost:3000
```

## 📋 Variáveis de Ambiente

Crie um arquivo `.env.local` com:

```env
# Banco de Dados
DATABASE_URL=mysql://usuario:senha@localhost:3306/caixinha

# Autenticação
JWT_SECRET=sua_chave_secreta_aqui
VITE_APP_ID=seu_app_id_manus
OAUTH_SERVER_URL=https://api.manus.im

# Email
RESEND_API_KEY=re_seu_api_key_aqui

# URLs
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=sua_chave_frontend

# Manus
OWNER_NAME=Seu Nome
OWNER_OPEN_ID=seu_open_id
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=sua_chave_backend
```

## 📚 Documentação

- [Guia de GitHub e Deploy](./GITHUB_E_DEPLOY_GUIA.md) - Como exportar para GitHub e fazer deploy
- [API Documentation](./docs/API.md) - Documentação da API tRPC
- [Database Schema](./drizzle/schema.ts) - Estrutura do banco de dados

## 🏗️ Arquitetura

```
caixinha-comunitaria/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Páginas do app
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── lib/           # Utilitários
│   │   └── main.tsx       # Entrada do app
│   └── public/            # Assets estáticos
├── server/                # Backend Express + tRPC
│   ├── routers.ts         # Procedimentos tRPC
│   ├── db.ts              # Helpers de banco
│   ├── email.ts           # Envio de emails
│   └── _core/             # Framework core
├── drizzle/               # Migrações do banco
├── shared/                # Código compartilhado
└── package.json
```

## 🔧 Desenvolvimento

### Scripts Disponíveis

```bash
# Iniciar servidor de desenvolvimento
pnpm dev

# Build para produção
pnpm build

# Rodar testes
pnpm test

# Lint e format
pnpm lint
pnpm format

# Migrações do banco
pnpm db:push      # Aplicar migrações
pnpm db:studio    # Abrir Drizzle Studio
```

### Stack Tecnológico

**Frontend:**
- React 19
- Tailwind CSS 4
- shadcn/ui
- tRPC Client
- Wouter (routing)

**Backend:**
- Express 4
- tRPC 11
- Drizzle ORM
- MySQL/PostgreSQL

**DevOps:**
- Vite
- esbuild
- Vitest
- TypeScript

## 📦 Deployment

### Google Cloud Run

```bash
gcloud run deploy caixinha-comunitaria \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Railway

1. Conecte seu repositório GitHub
2. Configure variáveis de ambiente
3. Deploy automático em cada push

Veja [GITHUB_E_DEPLOY_GUIA.md](./GITHUB_E_DEPLOY_GUIA.md) para instruções detalhadas.

## 🧪 Testes

```bash
# Rodar testes
pnpm test

# Rodar testes com coverage
pnpm test -- --coverage

# Modo watch
pnpm test -- --watch
```

## 📧 Email

O app usa Resend para enviar emails de confirmação de pagamento.

Para testar localmente:
1. Obtenha uma chave de API em https://resend.com
2. Configure `RESEND_API_KEY` no `.env.local`
3. Emails serão enviados para o endereço de teste registrado

## 🔐 Segurança

- ✅ Autenticação OAuth com Manus
- ✅ JWT para sessões
- ✅ Validação de entrada com Zod
- ✅ HTTPS em produção
- ✅ CORS configurado
- ✅ Rate limiting

## 🐛 Troubleshooting

### Erro: "Database connection failed"

```bash
# Verifique se DATABASE_URL está correto
echo $DATABASE_URL

# Teste a conexão
mysql -h seu_host -u seu_usuario -p seu_banco
```

### Erro: "Missing API key"

Certifique-se de que todas as variáveis de ambiente estão configuradas em `.env.local`.

### Servidor não inicia

```bash
# Limpe cache
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Tente novamente
pnpm dev
```

## 📱 PWA (App Mobile)

O app funciona como Progressive Web App:

**Android:**
1. Abra em Chrome
2. Menu → "Instalar app"
3. O app aparecerá na tela inicial

**iOS:**
1. Abra em Safari
2. Compartilhar → "Adicionar à Tela Inicial"
3. O app aparecerá na tela inicial

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](./LICENSE) para mais detalhes.

## 📞 Suporte

- 📧 Email: suporte@caixinha.com
- 🐛 Issues: https://github.com/seu-usuario/caixinha-comunitaria/issues
- 💬 Discussões: https://github.com/seu-usuario/caixinha-comunitaria/discussions

## 🙏 Agradecimentos

- [Manus](https://manus.im) - Plataforma de desenvolvimento
- [React](https://react.dev) - UI library
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [tRPC](https://trpc.io) - API framework

---

**Desenvolvido com ❤️ para gerenciar sua caixinha comunitária**

Última atualização: Janeiro 2026 | Versão: 4.1
