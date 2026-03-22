/**
 * routes/orders.js
 * Pedidos com notificação WebSocket em tempo real.
 *
 * GET    /api/orders             → lista (requer auth)
 * GET    /api/orders/:id         → detalhe (requer auth)
 * POST   /api/orders             → cria — PÚBLICO (cliente via link) + interno
 * PATCH  /api/orders/:id/status  → atualiza status (requer auth)
 * DELETE /api/orders/:id         → remove (requer auth)
 */

import { Router }    from 'express';
import { prisma }    from '../lib/prisma.js';
import { broadcast } from '../lib/websocket.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const VALID_STATUS = ['PENDING','MAKING','READY','DELIVERED','CANCELLED'];

// ── Helpers ───────────────────────────────────────────────
function serializeOrder(order) {
  return {
    ...order,
    total:        parseFloat(order.total),
    delivery_fee: parseFloat(order.delivery_fee),
    items: (order.items ?? []).map(i => ({
      ...i,
      item_price: parseFloat(i.item_price)
    }))
  };
}

// ── GET lista ─────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { status, search, from, to, limit } = req.query;

  const where = {};

  // Filtro de status (aceita múltiplos separados por vírgula)
  if (status && status !== 'all') {
    const list = status.split(',').map(s => s.trim().toUpperCase());
    where.status = { in: list };
  }

  // Busca por nome ou telefone
  if (search?.trim()) {
    where.OR = [
      { client_name:  { contains: search, mode: 'insensitive' } },
      { client_phone: { contains: search } }
    ];
  }

  // Filtro de data
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = new Date(from);
    if (to)   where.created_at.lte = new Date(to + 'T23:59:59');
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items:        true,
      neighborhood: { select: { name: true } }
    },
    orderBy: { created_at: 'desc' },
    take:    limit ? parseInt(limit) : undefined
  });

  res.json(orders.map(o => ({
    ...serializeOrder(o),
    neighborhood_name: o.neighborhood?.name ?? ''
  })));
});

// ── GET único ─────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  const order = await prisma.order.findUnique({
    where:   { id: parseInt(req.params.id) },
    include: { items: true, neighborhood: { select: { name: true } } }
  });
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json({ ...serializeOrder(order), neighborhood_name: order.neighborhood?.name ?? '' });
});

// ── POST — cria pedido (público + interno) ────────────────
router.post('/', async (req, res) => {
  const {
    client_name, client_phone, address, neighborhood_id,
    delivery_fee, delivery_type, payment, obs, items, total,
    source // 'INTERNAL' | 'CUSTOMER'
  } = req.body;

  if (!client_name?.trim()) {
    return res.status(400).json({ error: 'Nome do cliente obrigatório' });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Pedido sem itens' });
  }

  const order = await prisma.order.create({
    data: {
      client_name:     client_name.trim(),
      client_phone:    client_phone?.trim()  ?? '',
      address:         address?.trim()       ?? '',
      neighborhood_id: neighborhood_id ? parseInt(neighborhood_id) : null,
      delivery_fee:    parseFloat(delivery_fee) || 0,
      delivery_type:   delivery_type === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
      payment:         normalizePayment(payment),
      obs:             obs?.trim() ?? '',
      status:          'PENDING',
      total:           parseFloat(total),
      source:          source === 'CUSTOMER' ? 'CUSTOMER' : 'INTERNAL',
      items: {
        create: items.map(i => ({
          menu_item_id: i.id   ? parseInt(i.id) : null,
          item_name:    i.name,
          item_emoji:   i.emoji ?? '🍱',
          item_price:   parseFloat(i.price),
          quantity:     parseInt(i.qty)
        }))
      }
    },
    include: { items: true, neighborhood: { select: { name: true } } }
  });

  const result = {
    ...serializeOrder(order),
    neighborhood_name: order.neighborhood?.name ?? ''
  };

  // 🔔 Notifica todos os operadores via WebSocket
  broadcast('NEW_ORDER', result);

  res.status(201).json({ id: order.id, success: true });
});

// ── PATCH — status ────────────────────────────────────────
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status?.toUpperCase())) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const order = await prisma.order.update({
    where: { id: parseInt(req.params.id) },
    data:  { status: status.toUpperCase() },
    include: { items: true, neighborhood: { select: { name: true } } }
  });

  // 🔔 Notifica atualização de status via WebSocket
  broadcast('STATUS_UPDATE', {
    id:     order.id,
    status: order.status,
    client_name: order.client_name
  });

  res.json({ success: true });
});

// ── DELETE ────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const exists = await prisma.order.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: 'Pedido não encontrado' });

  await prisma.order.delete({ where: { id } });
  res.json({ success: true });
});

// ── Normaliza forma de pagamento ──────────────────────────
function normalizePayment(p) {
  const map = { pix: 'PIX', credito: 'CREDIT', debito: 'DEBIT', dinheiro: 'CASH',
                PIX: 'PIX', CREDIT: 'CREDIT', DEBIT: 'DEBIT', CASH: 'CASH' };
  return map[p] ?? 'PIX';
}

export default router;
