/**
 * middleware/auth.js
 * Middleware de autenticação JWT.
 *
 * Uso nas rotas:
 *   router.get('/rota', requireAuth, handler)
 *   router.get('/admin', requireAuth, requireAdmin, handler)
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifica se o token JWT é válido.
 * Adiciona req.user com { id, email, role } se válido.
 */
export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Exige role ADMIN. Deve ser usado APÓS requireAuth.
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

/**
 * Gera um token JWT para um usuário.
 * @param {object} user - { id, email, role, name }
 * @returns {string} token
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' }
  );
}
