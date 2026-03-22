# 🗄️ Como Configurar o Supabase — Passo a Passo Completo

---

## Passo 1 — Criar conta no Supabase

1. Acesse **https://supabase.com**
2. Clique em **"Start your project"**
3. Faça login com **GitHub** (recomendado) ou crie uma conta com email
4. É **gratuito** — não precisa de cartão de crédito

---

## Passo 2 — Criar um novo projeto

1. Clique em **"New project"**
2. Preencha:
   - **Name:** `tenkai-delivery`
   - **Database Password:** crie uma senha forte e **salve ela** — você vai precisar
   - **Region:** `South America (São Paulo)` — mais próximo do Brasil
3. Clique em **"Create new project"**
4. Aguarde 1-2 minutos enquanto o banco é criado

---

## Passo 3 — Pegar as credenciais de conexão

### 3.1 — Connection String (para o Prisma)

No painel do Supabase:
1. Clique em ⚙️ **Settings** no menu lateral esquerdo
2. Clique em **Database**
3. Role até **"Connection string"**
4. Selecione a aba **"URI"**
5. Selecione o modo **"Transaction"** (porta 6543)
6. Copie a URL — vai parecer assim:
   ```
   postgresql://postgres.xxxxxxxxxxxx:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
7. Cole no `.env` como `DATABASE_URL`

Agora selecione o modo **"Session"** (porta 5432) e copie como `DIRECT_URL`:
```
postgresql://postgres.xxxxxxxxxxxx:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

> ⚠️ **Substitua `[SUA-SENHA]` pela senha que você criou no Passo 2**

### 3.2 — API Keys (para o Supabase Storage)

1. Ainda em ⚙️ **Settings**, clique em **API**
2. Copie:
   - **Project URL** → cole como `SUPABASE_URL`
   - **service_role** (a segunda key, mais longa) → cole como `SUPABASE_SERVICE_KEY`

> ⚠️ **NUNCA compartilhe a service_role key** — ela tem acesso total ao banco

---

## Passo 4 — Criar o bucket de imagens

1. No menu lateral, clique em **Storage**
2. Clique em **"New bucket"**
3. Nome: `tenkai-images`
4. Marque **"Public bucket"** (✅) — necessário para as imagens serem acessíveis
5. Clique em **"Create bucket"**

Agora configure a política de acesso:
1. Clique no bucket `tenkai-images`
2. Clique na aba **"Policies"**
3. Clique em **"New policy"** → **"For full customization"**
4. Adicione esta política para leitura pública:
   ```sql
   -- Nome: Allow public read
   -- Operation: SELECT
   -- Role: public (anon)
   true
   ```
5. Clique em **"Save policy"**

---

## Passo 5 — Configurar o arquivo .env

Na pasta `tenkai-web`, copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Abra o `.env` e preencha com os valores copiados:

```env
DATABASE_URL="postgresql://postgres.SEU-REF:SUA-SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.SEU-REF:SUA-SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

SUPABASE_URL="https://SEU-REF.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

JWT_SECRET="coloque-aqui-uma-string-longa-e-aleatoria-minimo-32-chars"
JWT_EXPIRES_IN="8h"

PORT=3000
NODE_ENV="development"
PUBLIC_URL="http://localhost:3000"
```

**Para gerar o JWT_SECRET**, abra o terminal e execute:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Cole o resultado como `JWT_SECRET`.

---

## Passo 6 — Instalar e configurar o projeto

```bash
# Na pasta tenkai-web:
npm install

# Criar as tabelas no banco (Supabase)
npm run db:push

# Popular com dados iniciais (cardápio, admin, bairros)
npm run db:seed

# Iniciar o servidor
npm start
```

Acesse: **http://localhost:3000**

**Login inicial:**
- Email: `admin@tenkai.com`
- Senha: `tenkai2024`

> ⚠️ **Troque a senha imediatamente após o primeiro login!**

---

## Passo 7 — Verificar se funcionou

No painel do Supabase:
1. Clique em **Table Editor** no menu lateral
2. Você deve ver as tabelas: `users`, `menu_items`, `orders`, `settings`, `neighborhoods`
3. Clique em `menu_items` — deve mostrar os 10 itens do cardápio criados pelo seed

---

## 🚀 Deploy no Railway (opcional — para acesso pela internet)

### Subir para a internet gratuitamente:

1. Acesse **https://railway.app**
2. Faça login com GitHub
3. Clique em **"New Project"** → **"Deploy from GitHub repo"**
4. Conecte seu repositório com o código do TENKAI
5. Railway detecta automaticamente que é Node.js

### Configurar as variáveis de ambiente no Railway:

1. Na dashboard do projeto, clique em **Variables**
2. Clique em **"Add Variable"** e adicione todas as variáveis do `.env`:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN` = `8h`
   - `NODE_ENV` = `production`
   - `PUBLIC_URL` = `https://seu-projeto.railway.app` (Railway gera este URL)

3. O Railway faz o deploy automaticamente
4. Clique em **"Generate Domain"** para obter seu URL público

### Após o deploy, rodar o seed no Railway:

No painel do Railway, clique em **"Run command"**:
```bash
npm run db:seed
```

---

## 💡 Limites do plano gratuito do Supabase

| Recurso | Limite gratuito |
|---|---|
| Banco de dados | 500 MB |
| Storage (fotos) | 1 GB |
| Transferência | 2 GB/mês |
| Projetos ativos | 2 projetos |

Para um restaurante pequeno/médio, **o plano gratuito aguenta tranquilamente por anos**.

---

## 🔧 Comandos úteis

```bash
# Ver banco de dados visualmente (abre no browser)
npm run db:studio

# Recriar todas as tabelas (APAGA os dados!)
npm run db:push -- --force-reset

# Popular dados iniciais novamente
npm run db:seed

# Ver logs em tempo real
npm start
```

---

## ❓ Problemas comuns

**"Can't reach database server"**
→ Verifique o `DATABASE_URL` no `.env` — especialmente a senha

**"Invalid API key"**
→ Verifique o `SUPABASE_SERVICE_KEY` — use a `service_role`, não a `anon`

**Bucket de imagens não encontrado**
→ Crie o bucket `tenkai-images` no passo 4 acima

**Token JWT inválido**
→ Verifique se o `JWT_SECRET` está preenchido no `.env`
