/**
 * routes/settings.js
 * Configurações, bairros, dashboard e relatórios.
 * Todas as rotas requerem autenticação.
 */

import { Router }          from 'express';
import { prisma }          from '../lib/prisma.js';
import { uploadImage, deleteImage } from '../lib/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { upload }          from '../middleware/multer.js';

const router = Router();

// ═══════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════

router.get('/', requireAuth, async (_req, res) => {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  res.json(s);
});

router.post('/', requireAuth, upload.single('logo'), async (req, res) => {
  const current = await prisma.settings.findUnique({ where: { id: 1 } });
  const fields  = [
    'company_name','company_phone','company_address','pix_key',
    'motoboy1_name','motoboy1_phone','motoboy2_name','motoboy2_phone',
    'greeting_message'
  ];

  const data = {};
  fields.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });

  // Booleanos
  if (req.body.motoboy1_active !== undefined) data.motoboy1_active = req.body.motoboy1_active === 'true';
  if (req.body.motoboy2_active !== undefined) data.motoboy2_active = req.body.motoboy2_active === 'true';

  // Logo
  if (req.file) {
    if (current?.company_logo_url) await deleteImage(current.company_logo_url);
    const filename = `logo_${Date.now()}.${req.file.mimetype.split('/')[1]}`;
    data.company_logo_url = await uploadImage(req.file.buffer, filename, req.file.mimetype);
  }

  await prisma.settings.upsert({
    where:  { id: 1 },
    update: data,
    create: { id: 1, ...data }
  });

  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════
// BAIRROS
// ═══════════════════════════════════════════════════════

router.get('/neighborhoods', async (_req, res) => {
  // Público — necessário para o link do cliente
  const nbhs = await prisma.neighborhood.findMany({
    where:   { active: true },
    orderBy: { name: 'asc' }
  });
  res.json(nbhs.map(n => ({ ...n, fee: parseFloat(n.fee) })));
});

router.post('/neighborhoods', requireAuth, async (req, res) => {
  const { name, fee } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  const item = await prisma.neighborhood.create({
    data: { name: name.trim(), fee: parseFloat(fee) || 0 }
  });
  res.status(201).json({ ...item, fee: parseFloat(item.fee) });
});

router.put('/neighborhoods/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const item = await prisma.neighborhood.update({
    where: { id },
    data:  { name: req.body.name?.trim(), fee: parseFloat(req.body.fee) || 0 }
  });
  res.json({ ...item, fee: parseFloat(item.fee) });
});

router.delete('/neighborhoods/:id', requireAuth, async (req, res) => {
  await prisma.neighborhood.update({
    where: { id: parseInt(req.params.id) },
    data:  { active: false }
  });
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════

router.get('/dashboard/stats', requireAuth, async (req, res) => {
  const days = req.query.days;
  const where = { status: { not: 'CANCELLED' } };

  if (days && days !== 'all') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(days));
    where.created_at = { gte: cutoff };
  }

  const [orders, delivered, itemStats] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where: { ...where, status: 'DELIVERED' },
      select: { total: true }
    }),
    prisma.orderItem.groupBy({
      by:        ['item_name', 'item_emoji'],
      where:     { order: where },
      _sum:      { quantity: true },
      orderBy:   { _sum: { quantity: 'desc' } },
      take:      10
    })
  ]);

  const revenue  = delivered.reduce((s, o) => s + parseFloat(o.total), 0);
  const avgTicket = delivered.length ? revenue / delivered.length : 0;

  // Pagamentos
  const paymentRows = await prisma.order.groupBy({
    by:      ['payment'],
    where,
    _count:  { id: true }
  });
  const paymentCounts = Object.fromEntries(
    paymentRows.map(r => [r.payment, r._count.id])
  );

  // Vendas por categoria
  const catRows = await prisma.$queryRaw`
    SELECT mi.category, SUM(oi.quantity)::int as total
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'CANCELLED'
    GROUP BY mi.category
    ORDER BY total DESC
  `;

  res.json({
    totalOrders:     orders,
    deliveredOrders: delivered.length,
    revenue,
    avgTicket,
    topItems: itemStats.map(i => ({
      name:  i.item_name,
      emoji: i.item_emoji,
      count: i._sum.quantity ?? 0
    })),
    catSales:      catRows.map(r => [r.category, Number(r.total)]),
    paymentCounts
  });
});

// ═══════════════════════════════════════════════════════
// RELATÓRIOS
// ═══════════════════════════════════════════════════════

/** Relatório de pedidos finalizados (entregues + retirados) */
router.get('/reports/delivered', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const where = { status: 'DELIVERED' };
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = new Date(from);
    if (to)   where.created_at.lte = new Date(to + 'T23:59:59');
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: true, neighborhood: { select: { name: true } } },
    orderBy: { created_at: 'desc' }
  });

  const summary = {
    total_orders:   orders.length,
    total_revenue:  orders.reduce((s, o) => s + parseFloat(o.total), 0),
    by_payment: {
      PIX:    orders.filter(o => o.payment === 'PIX').length,
      CREDIT: orders.filter(o => o.payment === 'CREDIT').length,
      DEBIT:  orders.filter(o => o.payment === 'DEBIT').length,
      CASH:   orders.filter(o => o.payment === 'CASH').length
    },
    by_type: {
      DELIVERY: orders.filter(o => o.delivery_type === 'DELIVERY').length,
      PICKUP:   orders.filter(o => o.delivery_type === 'PICKUP').length
    }
  };

  res.json({ summary, orders: orders.map(serializeOrder) });
});

/** Relatório de entregas feitas pelo motoboy */
router.get('/reports/deliveries', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const where = { status: 'DELIVERED', delivery_type: 'DELIVERY' };
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = new Date(from);
    if (to)   where.created_at.lte = new Date(to + 'T23:59:59');
  }

  const deliveries = await prisma.order.findMany({
    where,
    include: { neighborhood: { select: { name: true } } },
    orderBy: { created_at: 'desc' }
  });

  const totalFees = deliveries.reduce((s, o) => s + parseFloat(o.delivery_fee), 0);

  res.json({
    summary: {
      total_deliveries: deliveries.length,
      total_fees:       totalFees,
      by_neighborhood:  groupByNeighborhood(deliveries)
    },
    deliveries: deliveries.map(serializeOrder)
  });
});

// ── Helpers ───────────────────────────────────────────────
function serializeOrder(o) {
  return {
    ...o,
    total:            parseFloat(o.total),
    delivery_fee:     parseFloat(o.delivery_fee),
    neighborhood_name: o.neighborhood?.name ?? '',
    items: (o.items ?? []).map(i => ({ ...i, item_price: parseFloat(i.item_price) }))
  };
}

function groupByNeighborhood(orders) {
  const map = {};
  orders.forEach(o => {
    const name = o.neighborhood?.name ?? 'Sem bairro';
    map[name] = (map[name] ?? 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export default router;
