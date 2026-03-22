# 🍣 TENKAI Delivery Manager v4.0 — Web Edition

Sistema completo de delivery com Supabase + Prisma + WebSocket.

## Stack
- **Backend:** Node.js + Express + WebSocket
- **Banco:** PostgreSQL via Prisma (Supabase)
- **Storage:** Supabase Storage (fotos)
- **Auth:** JWT com bcrypt
- **Realtime:** WebSocket nativo

## Instalação

```bash
# 1. Configure o .env (veja docs/SETUP_SUPABASE.md)
cp .env.example .env

# 2. Instale dependências
npm install

# 3. Crie as tabelas no Supabase
npm run db:push

# 4. Popule dados iniciais
npm run db:seed

# 5. Inicie
npm start
```

## Configuração completa
→ **`docs/SETUP_SUPABASE.md`**

## Login inicial
- Email: `admin@tenkai.com`
- Senha: `tenkai2024`
- ⚠️ Troque após o primeiro acesso!
