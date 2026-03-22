/**
 * routes/menu.js
 * CRUD de itens do cardápio com upload para Supabase Storage.
 *
 * GET    /api/menu          → lista (público — usado pelo link do cliente)
 * POST   /api/menu          → cria  (requer auth)
 * PUT    /api/menu/:id      → edita (requer auth)
 * DELETE /api/menu/:id      → remove (requer auth)
 */

import { Router }           from 'express';
import { prisma }           from '../lib/prisma.js';
import { uploadImage, deleteImage } from '../lib/supabase.js';
import { requireAuth }      from '../middleware/auth.js';
import { upload }           from '../middleware/multer.js';

const router = Router();

// ── GET — lista pública ───────────────────────────────────
router.get('/', async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    orderBy: [{ sort_order: 'asc' }, { category: 'asc' }, { name: 'asc' }]
  });
  // Converte Decimal para number para o JSON
  res.json(items.map(serializeItem));
});

// ── POST — cria item ──────────────────────────────────────
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  const { name, category, price, description, portion, emoji, available, sort_order } = req.body;

  if (!name?.trim())                        return res.status(400).json({ error: 'Nome obrigatório' });
  if (isNaN(parseFloat(price)) || price <= 0) return res.status(400).json({ error: 'Preço inválido' });

  let image_url = null;
  if (req.file) {
    const filename = `item_${Date.now()}_${req.file.originalname.replace(/\s/g, '_')}`;
    image_url = await uploadImage(req.file.buffer, filename, req.file.mimetype);
  }

  const item = await prisma.menuItem.create({
    data: {
      name:        name.trim(),
      category,
      price:       parseFloat(price),
      description: description?.trim() ?? '',
      portion:     portion?.trim()     ?? '',
      emoji:       emoji?.trim()       || '🍱',
      image_url,
      available:   available === '1' || available === 'true',
      sort_order:  parseInt(sort_order) || 0
    }
  });

  res.status(201).json(serializeItem(item));
});

// ── PUT — edita item ──────────────────────────────────────
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  const id  = parseInt(req.params.id);
  const old = await prisma.menuItem.findUnique({ where: { id } });
  if (!old) return res.status(404).json({ error: 'Item não encontrado' });

  const { name, category, price, description, portion, emoji, available, sort_order } = req.body;

  let image_url = old.image_url;
  if (req.file) {
    // Remove imagem antiga do Storage
    if (old.image_url) await deleteImage(old.image_url);
    const filename = `item_${Date.now()}_${req.file.originalname.replace(/\s/g, '_')}`;
    image_url = await uploadImage(req.file.buffer, filename, req.file.mimetype);
  }

  const item = await prisma.menuItem.update({
    where: { id },
    data:  {
      name:        name?.trim()        ?? old.name,
      category:    category            ?? old.category,
      price:       price ? parseFloat(price) : old.price,
      description: description?.trim() ?? old.description,
      portion:     portion?.trim()     ?? old.portion,
      emoji:       emoji?.trim()       || old.emoji,
      image_url,
      available:   available !== undefined ? (available === '1' || available === 'true') : old.available,
      sort_order:  sort_order !== undefined ? parseInt(sort_order) : old.sort_order
    }
  });

  res.json(serializeItem(item));
});

// ── DELETE ────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const id   = parseInt(req.params.id);
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: 'Item não encontrado' });

  if (item.image_url) await deleteImage(item.image_url);
  await prisma.menuItem.delete({ where: { id } });

  res.json({ success: true });
});

// ── Serializa Decimal → number ────────────────────────────
function serializeItem(item) {
  return { ...item, price: parseFloat(item.price) };
}

export default router;
