/**
 * routes/auth.js
 * Autenticação de usuários do painel.
 *
 * POST /api/auth/login           → login com email + senha
 * POST /api/auth/logout          → invalida sessão (client-side)
 * GET  /api/auth/me              → retorna usuário logado
 * POST /api/auth/change-password → troca senha (requer auth)
 */

import { Router }        from 'express';
import bcrypt            from 'bcryptjs';
import { prisma }        from '../lib/prisma.js';
import { requireAuth, generateToken } from '../middleware/auth.js';

const router = Router();

// ── Login ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha obrigatórios' });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const token = generateToken(user);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// ── Retorna usuário atual ─────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, active: true }
  });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(user);
});

// ── Trocar senha ─────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Preencha todos os campos' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter mínimo 6 caracteres' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await bcrypt.compare(current_password, user.password);
  if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

  const hash = await bcrypt.hash(new_password, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { password: hash } });

  res.json({ success: true, message: 'Senha alterada com sucesso' });
});

export default router;
