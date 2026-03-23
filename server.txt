/**
 * server.js
 * Ponto de entrada do TENKAI Web (v4.0)
 * Express + WebSocket + Supabase + Prisma
 */

import 'dotenv/config';
import http            from 'http';
import express         from 'express';
import cors            from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { initWebSocket }  from './lib/websocket.js';
import authRoutes         from './routes/auth.js';
import menuRoutes         from './routes/menu.js';
import ordersRoutes       from './routes/orders.js';
import settingsRoutes     from './routes/settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT      = process.env.PORT ?? 3000;

// ── App ──────────────────────────────────────────────────
const app = express();

// CORS — permite acesso de qualquer origem em produção
// (ajuste para seu domínio específico em produção)
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.PUBLIC_URL
    : '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

// ── API ──────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/menu',     menuRoutes);
app.use('/api/orders',   ordersRoutes);
app.use('/api/settings', settingsRoutes);

// ── Health check (Railway usa para verificar se o app está rodando) ──
app.get('/health', (_req, res) => res.json({ ok: true, version: '4.0.0' }));

// ── SPA fallback ─────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

// ── Middleware de erro global ────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message ?? 'Erro interno' });
});

// ── HTTP + WebSocket ─────────────────────────────────────
const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   🍣  TENKAI Delivery Manager  v4.0     ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║   ✅  http://localhost:${PORT}               ║`);
  console.log('║   🗄️   Banco  : Supabase PostgreSQL       ║');
  console.log('║   📁  Fotos  : Supabase Storage           ║');
  console.log('║   🔌  WS     : WebSocket ativo            ║');
  console.log('╚══════════════════════════════════════════╝\n');
});

// ── Proteção contra crash ────────────────────────────────
process.on('uncaughtException',  err => console.error('[UNCAUGHT]', err));
process.on('unhandledRejection', err => console.error('[UNHANDLED]', err));
