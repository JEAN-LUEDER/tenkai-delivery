/**
 * prisma/seed.js
 * Popula o banco com dados iniciais:
 * - Usuário admin padrão
 * - Configurações da empresa
 * - Bairros de exemplo
 * - Cardápio de exemplo
 *
 * Executar: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ── Admin padrão ─────────────────────────────────────
  const adminExists = await prisma.user.findUnique({ where: { email: 'admin@tenkai.com' } });
  if (!adminExists) {
    const hash = await bcrypt.hash('tenkai2024', 10);
    await prisma.user.create({
      data: { name: 'Administrador', email: 'admin@tenkai.com', password: hash, role: 'ADMIN' }
    });
    console.log('✅ Admin criado  →  admin@tenkai.com / tenkai2024');
    console.log('   ⚠️  Troque a senha depois do primeiro login!');
  }

  // ── Configurações ────────────────────────────────────
  await prisma.settings.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1 }
  });
  console.log('✅ Configurações iniciais criadas');

  // ── Bairros ──────────────────────────────────────────
  const bairros = [
    { name: 'Centro',            fee: 5.00 },
    { name: 'Bairro Sul',        fee: 7.00 },
    { name: 'Zona Norte',        fee: 9.00 },
    { name: 'Zona Leste',        fee: 8.00 },
    { name: 'Bairro Industrial', fee: 6.00 },
  ];
  for (const b of bairros) {
    const exists = await prisma.neighborhood.findFirst({ where: { name: b.name } });
    if (!exists) await prisma.neighborhood.create({ data: b });
  }
  console.log('✅ Bairros criados');

  // ── Cardápio ─────────────────────────────────────────
  const menu = [
    { name: 'Temaki Salmão',      category: 'Temaki',     price: 28.90, description: 'Cone de alga com salmão e cream cheese',   portion: '1 unidade',   emoji: '🍣', sort_order: 1  },
    { name: 'Temaki Atum',        category: 'Temaki',     price: 26.90, description: 'Cone de alga com atum temperado',           portion: '1 unidade',   emoji: '🍱', sort_order: 2  },
    { name: 'Combinado 20 Peças', category: 'Combinado',  price: 59.90, description: 'Mix variado de uramaki, nigiri e sashimi',  portion: '20 peças',    emoji: '🎌', sort_order: 3  },
    { name: 'Combinado 30 Peças', category: 'Combinado',  price: 84.90, description: 'Grande variedade de peças premium',         portion: '30 peças',    emoji: '🎎', sort_order: 4  },
    { name: 'Sashimi Salmão',     category: 'Sashimi',    price: 42.00, description: 'Fatias frescas de salmão norueguês',        portion: '10 fatias',   emoji: '🐟', sort_order: 5  },
    { name: 'Philadelphia Roll',  category: 'Uramaki',    price: 32.90, description: 'Salmão, cream cheese e pepino',             portion: '8 peças',     emoji: '🌀', sort_order: 6  },
    { name: 'Hot Roll Camarão',   category: 'Hot Roll',   price: 34.90, description: 'Uramaki empanado e frito com camarão',      portion: '8 peças',     emoji: '🔥', sort_order: 7  },
    { name: 'Gyoza',              category: 'Entradas',   price: 22.00, description: 'Pastel japonês recheado, frito na chapa',   portion: '6 unidades',  emoji: '🥟', sort_order: 8  },
    { name: 'Saquê Quente',       category: 'Bebidas',    price: 18.00, description: 'Saquê tradicional aquecido',                portion: '300ml',       emoji: '🍶', sort_order: 9  },
    { name: 'Mochi Morango',      category: 'Sobremesas', price: 14.00, description: 'Bolinho de arroz recheado com morango',     portion: '3 unidades',  emoji: '🍡', sort_order: 10 },
  ];
  for (const item of menu) {
    const exists = await prisma.menuItem.findFirst({ where: { name: item.name } });
    if (!exists) await prisma.menuItem.create({ data: item });
  }
  console.log('✅ Cardápio criado');

  console.log('\n🎉 Seed concluído! Sistema pronto para uso.');
}

main()
  .catch(e => { console.error('❌ Erro no seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
