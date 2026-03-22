/**
 * js/app.js — Controlador principal do painel TENKAI v4.0
 * Requer autenticação JWT. Conecta ao WebSocket.
 */

import { MenuAPI, OrdersAPI, SettingsAPI } from './api.js';
import { toast, openModal, closeModal, statusBadge, payBadge, srcBadge,
         fmtBRL, fmtId, fmtDate, fmtDateShort, emptyState,
         PAYMENT_LABEL, STATUS_LABEL, getCurrentUser, logout } from './ui.js';
import { buildClientMessage, buildMotoboyMessage, buildGreetingMessage, openWhatsApp } from './whatsapp.js';
import { buildComandaHTML } from './comanda.js';
import { connectWS } from './websocket-client.js';

// ── Proteção de rota — redireciona se não estiver logado ─
if (!localStorage.getItem('tenkai_token')) {
  window.location.href = '/login.html';
}

// ── Estado global ─────────────────────────────────────────
const S = {
  menu: [], neighborhoods: [], settings: {},
  cart: {}, editingItemId: null,
  menuCatFilter: 'Todos', orderCatFilter: 'Todos',
  _waPhone: '', _waMsg: ''
};

// ─────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────
async function init() {
  // Mostra nome do usuário na sidebar
  const user = getCurrentUser();
  if (user) {
    document.getElementById('sidebarUserName').textContent = user.name;
    document.getElementById('sidebarUserInitials').textContent =
      user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    if (user.role === 'ADMIN') {
      document.getElementById('navAdmin')?.style.setProperty('display','block');
    }
  }

  await Promise.all([loadSettings(), loadMenu(), loadNeighborhoods()]);
  renderOrderPage();
  updateOpenBadge();
  connectWS();

  // Escuta eventos WebSocket
  document.addEventListener('ws:NEW_ORDER', () => {
    loadOpenOrders();
    updateOpenBadge();
  });
  document.addEventListener('ws:STATUS_UPDATE', () => {
    loadOpenOrders();
    updateOpenBadge();
  });

  // Fecha modais ao clicar no overlay
  document.querySelectorAll('.moverlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
  });
}

// ── Navigation ────────────────────────────────────────────
window.goTo = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  const handlers = {
    cardapio: renderMenuPage, dashboard: loadDashboard,
    financeiro: loadFinanceiro, historico: loadHistory,
    relatorios: loadRelatorios, configuracoes: renderSettings
  };
  handlers[page]?.();
};

window.doLogout = logout;
window.openModal  = openModal;
window.closeModal = closeModal;

// ── Error handler ─────────────────────────────────────────
window.addEventListener('unhandledrejection', e => {
  toast(e.reason?.message?.includes('fetch') ? 'Servidor indisponível' : `Erro: ${e.reason?.message}`, 'err');
  e.preventDefault();
});

// ─────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────
async function loadSettings() {
  S.settings = await SettingsAPI.get();
  applyBranding();
}

function applyBranding() {
  const { company_name, company_logo_url } = S.settings;
  document.getElementById('sidebarName').textContent = company_name || 'TENKAI';
  document.title = `${company_name || 'TENKAI'} — Delivery`;
  const logoEl = document.getElementById('sidebarLogo');
  if (company_logo_url) { logoEl.src = company_logo_url; logoEl.style.display = 'block'; }
  else logoEl.style.display = 'none';
}

function renderSettings() {
  const s = S.settings;
  const fields = {
    cfgName: 'company_name', cfgPhone: 'company_phone',
    cfgAddress: 'company_address', cfgPix: 'pix_key',
    cfgMotoboy1Name: 'motoboy1_name', cfgMotoboy1Phone: 'motoboy1_phone',
    cfgMotoboy2Name: 'motoboy2_name', cfgMotoboy2Phone: 'motoboy2_phone',
    cfgGreeting: 'greeting_message'
  };
  Object.entries(fields).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.value = s[key] ?? '';
  });
  document.getElementById('cfgMotoboy1Active').checked = !!s.motoboy1_active;
  document.getElementById('cfgMotoboy2Active').checked = !!s.motoboy2_active;
  const lp = document.getElementById('logoPreview');
  if (s.company_logo_url) lp.src = s.company_logo_url;

  // Mostra link do cardápio público
  const link = `${window.location.origin}/pedido`;
  document.getElementById('publicLink').textContent = link;

  // Preview da saudação
  updateGreetingPreview();
  renderNeighborhoods();
}

window.updateGreetingPreview = function() {
  const msg = document.getElementById('cfgGreeting')?.value || '';
  const link = `${window.location.origin}/pedido`;
  const preview = msg
    .replace('{company}', document.getElementById('cfgName')?.value || S.settings.company_name || 'TENKAI')
    .replace('{link}', link);
  const el = document.getElementById('greetingPreview');
  if (el) el.textContent = preview;
};

window.copyPublicLink = function() {
  const link = `${window.location.origin}/pedido`;
  navigator.clipboard.writeText(link).then(() => toast('Link copiado!')).catch(() => toast('Copie manualmente: ' + link, 'info'));
};

window.previewLogo = function(input) {
  const file = input.files[0]; if (!file) return;
  document.getElementById('logoPreview').src = URL.createObjectURL(file);
};

window.saveSettings = async function() {
  const fd = new FormData();
  const fields = {
    company_name: 'cfgName', company_phone: 'cfgPhone',
    company_address: 'cfgAddress', pix_key: 'cfgPix',
    motoboy1_name: 'cfgMotoboy1Name', motoboy1_phone: 'cfgMotoboy1Phone',
    motoboy2_name: 'cfgMotoboy2Name', motoboy2_phone: 'cfgMotoboy2Phone',
    greeting_message: 'cfgGreeting'
  };
  Object.entries(fields).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) fd.append(key, el.value);
  });
  fd.append('motoboy1_active', document.getElementById('cfgMotoboy1Active').checked ? 'true' : 'false');
  fd.append('motoboy2_active', document.getElementById('cfgMotoboy2Active').checked ? 'true' : 'false');
  const logo = document.getElementById('logoInput').files[0];
  if (logo) fd.append('logo', logo);
  try {
    await SettingsAPI.save(fd);
    await loadSettings();
    toast('Configurações salvas!');
  } catch (e) { toast(e.message, 'err'); }
};

// ── Neighborhoods ─────────────────────────────────────────
async function loadNeighborhoods() {
  S.neighborhoods = await SettingsAPI.neighborhoods();
  populateNeighborhoodSelect();
}

function populateNeighborhoodSelect() {
  const sel = document.getElementById('pNeighborhood');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o bairro</option>';
  S.neighborhoods.forEach(n => {
    sel.innerHTML += `<option value="${n.id}" data-fee="${n.fee}">${n.name} — R$ ${n.fee.toFixed(2)}</option>`;
  });
}

function renderNeighborhoods() {
  const el = document.getElementById('nbhList');
  if (!el) return;
  if (!S.neighborhoods.length) { el.innerHTML = '<p style="color:var(--text3);font-size:13px">Nenhum bairro</p>'; return; }
  el.innerHTML = S.neighborhoods.map(n => `
    <div class="nbh-row">
      <span class="nbh-name">${n.name}</span>
      <span class="nbh-fee">${fmtBRL(n.fee)}</span>
      <button class="btn btn-danger btn-xs" onclick="deleteNeighborhood(${n.id})">Remover</button>
    </div>`).join('');
}

window.updateDeliveryFee = function() {
  const sel = document.getElementById('pNeighborhood');
  const opt = sel?.options[sel.selectedIndex];
  document.getElementById('pFee').value = opt ? parseFloat(opt.dataset.fee||0).toFixed(2) : '0.00';
  renderCartFee();
};

window.addNeighborhood = async function() {
  const name = document.getElementById('nbhName').value.trim();
  const fee  = parseFloat(document.getElementById('nbhFee').value);
  if (!name || isNaN(fee)) { toast('Preencha nome e taxa', 'err'); return; }
  try {
    await SettingsAPI.addNeighborhood({ name, fee });
    document.getElementById('nbhName').value = '';
    document.getElementById('nbhFee').value  = '';
    await loadNeighborhoods(); renderNeighborhoods();
    toast('Bairro adicionado!');
  } catch (e) { toast(e.message, 'err'); }
};

window.deleteNeighborhood = async function(id) {
  if (!confirm('Remover este bairro?')) return;
  await SettingsAPI.removeNeighborhood(id);
  await loadNeighborhoods(); renderNeighborhoods();
  toast('Bairro removido');
};

window.onDeliveryTypeChange = function() {
  const isDelivery = document.getElementById('pDeliveryType').value === 'DELIVERY';
  ['nbhField','feeField','addrField'].forEach(id => {
    document.getElementById(id).style.display = isDelivery ? '' : 'none';
  });
  if (!isDelivery) { document.getElementById('pFee').value = '0'; renderCartFee(); }
};

// ─────────────────────────────────────────────────────────
// MENU
// ─────────────────────────────────────────────────────────
async function loadMenu() { S.menu = await MenuAPI.list(); }

function getCategories(items) { return ['Todos', ...new Set(items.map(i=>i.category))]; }

function renderMenuPage() {
  const cats  = getCategories(S.menu);
  const items = S.menuCatFilter === 'Todos' ? S.menu : S.menu.filter(i=>i.category===S.menuCatFilter);
  document.getElementById('menuCatTabs').innerHTML = cats.map(c =>
    `<button class="ct ${c===S.menuCatFilter?'active':''}" onclick="setMenuCat('${c}')">${c}</button>`
  ).join('');
  if (!items.length) {
    document.getElementById('menuGrid').innerHTML = `<div style="grid-column:1/-1">${emptyState('🍽️','Nenhum item')}</div>`; return;
  }
  document.getElementById('menuGrid').innerHTML = items.map(item => `
    <div class="mc">
      <div class="mc-img">
        ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" loading="lazy">` : `<div class="mc-emoji">${item.emoji||'🍱'}</div>`}
        ${!item.available ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center"><span class="badge badge-gray">Indisponível</span></div>` : ''}
      </div>
      <div class="mc-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:2px">
          <div class="mc-name">${item.name}</div>
          <span class="badge ${item.available?'badge-green':'badge-gray'}">${item.available?'Ativo':'Off'}</span>
        </div>
        <div class="mc-cat">${item.category}${item.portion?' · '+item.portion:''}</div>
        ${item.description?`<div class="mc-desc">${item.description}</div>`:''}
        <div class="mc-price">${fmtBRL(item.price)}</div>
        <div class="mc-actions">
          <button class="btn btn-ghost btn-sm" onclick="openItemModal(${item.id})">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem(${item.id})">Remover</button>
        </div>
      </div>
    </div>`).join('');
}

window.setMenuCat = c => { S.menuCatFilter = c; renderMenuPage(); };

window.openItemModal = function(id) {
  S.editingItemId = id ?? null;
  document.getElementById('modalItemTitle').textContent = id ? 'Editar Item' : 'Novo Item';
  const item = id ? S.menu.find(i=>i.id===id) : null;
  document.getElementById('iName').value     = item?.name        || '';
  document.getElementById('iEmoji').value    = item?.emoji       || '';
  document.getElementById('iCategory').value = item?.category    || 'Temaki';
  document.getElementById('iPrice').value    = item?.price       || '';
  document.getElementById('iDesc').value     = item?.description || '';
  document.getElementById('iPortion').value  = item?.portion     || '';
  document.getElementById('iAvailable').checked = item ? !!item.available : true;
  document.getElementById('iImage').value    = '';
  const prev   = document.getElementById('iImagePreview');
  const upText = document.querySelector('.img-upload-box .uptext');
  if (item?.image_url) { prev.src = item.image_url; prev.style.display = 'block'; upText.style.display = 'none'; }
  else { prev.style.display = 'none'; upText.style.display = 'block'; }
  openModal('modalItem');
};

window.previewItemImage = function(input) {
  const file = input.files[0]; if (!file) return;
  document.getElementById('iImagePreview').src = URL.createObjectURL(file);
  document.getElementById('iImagePreview').style.display = 'block';
  document.querySelector('.img-upload-box .uptext').style.display = 'none';
};

window.saveItem = async function() {
  const name  = document.getElementById('iName').value.trim();
  const price = parseFloat(document.getElementById('iPrice').value);
  if (!name)                      { toast('Informe o nome', 'err'); return; }
  if (isNaN(price) || price <= 0) { toast('Preço inválido', 'err'); return; }
  const fd = new FormData();
  fd.append('name',      name);
  fd.append('emoji',     document.getElementById('iEmoji').value || '🍱');
  fd.append('category',  document.getElementById('iCategory').value);
  fd.append('price',     price);
  fd.append('description', document.getElementById('iDesc').value);
  fd.append('portion',   document.getElementById('iPortion').value);
  fd.append('available', document.getElementById('iAvailable').checked ? '1' : '0');
  const img = document.getElementById('iImage').files[0];
  if (img) fd.append('image', img);
  try {
    if (S.editingItemId) { await MenuAPI.update(S.editingItemId, fd); toast('Item atualizado!'); }
    else                 { await MenuAPI.create(fd);                  toast('Item adicionado!'); }
    await loadMenu(); closeModal('modalItem'); renderMenuPage(); renderOrderMenu();
  } catch (e) { toast(e.message, 'err'); }
};

window.deleteItem = async function(id) {
  if (!confirm('Remover este item?')) return;
  await MenuAPI.remove(id); await loadMenu(); renderMenuPage(); renderOrderMenu();
  toast('Item removido');
};

// ─────────────────────────────────────────────────────────
// ORDERS PAGE
// ─────────────────────────────────────────────────────────
function renderOrderPage() {
  renderOrderCatTabs(); renderOrderMenu(); renderCart(); loadOpenOrders();
}

function renderOrderCatTabs() {
  const avail = S.menu.filter(i=>i.available);
  const cats  = getCategories(avail);
  document.getElementById('orderCatTabs').innerHTML = cats.map(c =>
    `<button class="ct ${c===S.orderCatFilter?'active':''}" onclick="setOrderCat('${c}')">${c}</button>`
  ).join('');
}

function renderOrderMenu() {
  const avail = S.menu.filter(i=>i.available);
  const items = S.orderCatFilter === 'Todos' ? avail : avail.filter(i=>i.category===S.orderCatFilter);
  const el = document.getElementById('orderMenu');
  if (!el) return;
  if (!items.length) { el.innerHTML = emptyState('🍽️','Sem itens'); return; }
  el.innerHTML = items.map(item => `
    <div class="omi" onclick="addToCart(${item.id})">
      ${item.image_url ? `<img class="omi-img" src="${item.image_url}" alt="${item.name}" loading="lazy">` : `<div class="omi-emoji">${item.emoji||'🍱'}</div>`}
      <div class="omi-name">${item.name}</div>
      <div class="omi-price">${fmtBRL(item.price)}</div>
    </div>`).join('');
}

window.setOrderCat = c => { S.orderCatFilter = c; renderOrderMenu(); };

// ── Cart ──────────────────────────────────────────────────
window.addToCart = id => { S.cart[id] = (S.cart[id]??0) + 1; renderCart(); };

window.changeQty = (id, delta) => {
  S.cart[id] = (S.cart[id]??0) + delta;
  if (S.cart[id] <= 0) delete S.cart[id];
  renderCart();
};

window.limparCarrinho = () => { S.cart = {}; renderCart(); document.getElementById('cartFeeRow').style.display='none'; };

function getCartItems() {
  return Object.keys(S.cart).map(id => {
    const item = S.menu.find(i=>i.id==id);
    return item ? {...item, qty: S.cart[id]} : null;
  }).filter(Boolean);
}
function getSubtotal() { return getCartItems().reduce((s,i)=>s+i.price*i.qty, 0); }
function getDeliveryFee() {
  if (document.getElementById('pDeliveryType').value !== 'DELIVERY') return 0;
  return parseFloat(document.getElementById('pFee').value) || 0;
}

function renderCartFee() {
  const fee = getDeliveryFee();
  const row = document.getElementById('cartFeeRow');
  row.style.display = fee > 0 ? 'flex' : 'none';
  document.getElementById('cartFeeVal').textContent = fmtBRL(fee);
  updateCartTotal();
}

function updateCartTotal() {
  document.getElementById('cartTotal').textContent = fmtBRL(getSubtotal() + getDeliveryFee());
}

function renderCart() {
  const items = getCartItems();
  const el = document.getElementById('cartItems');
  if (!items.length) { el.innerHTML = emptyState('🍱','Nenhum item'); document.getElementById('cartTotal').textContent = fmtBRL(0); return; }
  el.innerHTML = items.map(item => `
    <div class="cart-line">
      <div class="cart-name">${item.emoji||''} ${item.name}</div>
      <div class="qty-ctrl">
        <button class="qbtn" onclick="changeQty(${item.id},-1)">−</button>
        <span class="qnum">${item.qty}</span>
        <button class="qbtn" onclick="changeQty(${item.id},1)">+</button>
      </div>
      <div class="cline-total">${fmtBRL(item.price * item.qty)}</div>
    </div>`).join('');
  renderCartFee(); updateCartTotal();
}

// ── Finalize ──────────────────────────────────────────────
window.finalizarPedido = async function() {
  const name  = document.getElementById('pClientName').value.trim();
  const items = getCartItems();
  if (!name)         { toast('Informe o nome do cliente', 'err'); return; }
  if (!items.length) { toast('Carrinho vazio!', 'err'); return; }
  const payload = {
    client_name:     name,
    client_phone:    document.getElementById('pClientPhone').value.trim(),
    address:         document.getElementById('pAddress').value.trim(),
    neighborhood_id: document.getElementById('pNeighborhood').value || null,
    delivery_fee:    getDeliveryFee(),
    delivery_type:   document.getElementById('pDeliveryType').value,
    payment:         document.getElementById('pPayment').value,
    obs:             document.getElementById('pObs').value.trim(),
    items:           items.map(i=>({id:i.id,name:i.name,emoji:i.emoji,price:i.price,qty:i.qty})),
    total:           getSubtotal() + getDeliveryFee(),
    source:          'INTERNAL'
  };
  try {
    const result = await OrdersAPI.create(payload);
    S.cart = {};
    ['pClientName','pClientPhone','pAddress','pObs'].forEach(id => { document.getElementById(id).value = ''; });
    renderCart(); loadOpenOrders(); updateOpenBadge();
    toast(`Pedido ${fmtId(result.id)} registrado!`);
  } catch (e) { toast(e.message, 'err'); }
};

// ── WA ────────────────────────────────────────────────────
function buildCartPayload() {
  const items = getCartItems();
  const fee   = getDeliveryFee();
  return {
    client_name:   document.getElementById('pClientName').value.trim() || 'Cliente',
    client_phone:  document.getElementById('pClientPhone').value.trim(),
    address:       document.getElementById('pAddress').value.trim(),
    delivery_type: document.getElementById('pDeliveryType').value,
    payment:       document.getElementById('pPayment').value,
    obs:           document.getElementById('pObs').value.trim(),
    delivery_fee:  fee, total: getSubtotal() + fee,
    items: items.map(i=>({item_name:i.name,item_emoji:i.emoji,item_price:i.price,quantity:i.qty}))
  };
}

function showWAModal(msg, phone) {
  S._waMsg = msg; S._waPhone = phone;
  document.getElementById('waMsgPreview').textContent = msg;
  document.getElementById('waSendBtn').onclick = () => { openWhatsApp(phone, msg); closeModal('modalWA'); };
  openModal('modalWA');
}

window.abrirWA = () => {
  const items = getCartItems();
  if (!items.length) { toast('Carrinho vazio!', 'err'); return; }
  showWAModal(buildClientMessage(buildCartPayload(), S.settings), buildCartPayload().client_phone);
};

window.enviarMotoboy = () => {
  const items = getCartItems();
  if (!items.length) { toast('Carrinho vazio!', 'err'); return; }
  if (document.getElementById('pDeliveryType').value !== 'DELIVERY') { toast('Tipo não é delivery', 'err'); return; }
  // Prioriza motoboy ativo
  const phone = S.settings.motoboy1_active ? S.settings.motoboy1_phone
              : S.settings.motoboy2_active ? S.settings.motoboy2_phone : '';
  showWAModal(buildMotoboyMessage(buildCartPayload(), S.settings), phone);
};

// Botão de saudação — copia mensagem com link
window.copiarSaudacao = () => {
  const msg = buildGreetingMessage(S.settings);
  navigator.clipboard.writeText(msg).then(() => toast('Mensagem copiada!')).catch(() => showWAModal(msg, ''));
};

// ── Open orders ───────────────────────────────────────────
async function loadOpenOrders() {
  const orders = await OrdersAPI.list({ status: 'PENDING,MAKING,READY', limit: 15 });
  const el = document.getElementById('openOrdersList');
  if (!orders.length) { el.innerHTML = `<p style="font-size:12.5px;color:var(--text3)">Sem pedidos em aberto</p>`; return; }
  el.innerHTML = orders.map(o => `
    <div class="oo-card">
      <div class="oo-left">
        <div class="oo-client">${o.client_name} ${srcBadge(o.source)}</div>
        <div class="oo-info">${fmtBRL(o.total)} · ${o.items.length} item(s)</div>
        ${o.address?`<div class="oo-info" style="font-size:11px">${o.address}</div>`:''}
        ${o.obs?`<div class="oo-info" style="font-size:11px;color:var(--gold2)">📝 ${o.obs}</div>`:''}
      </div>
      <div class="oo-right">
        ${statusBadge(o.status)}
        <select onchange="updateStatus(${o.id},this.value)" style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:4px 7px;color:var(--text);font-size:11px;font-family:var(--font);outline:none">
          ${['PENDING','MAKING','READY','DELIVERED','CANCELLED'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${STATUS_LABEL[s]}</option>`).join('')}
        </select>
        <div style="display:flex;gap:5px">
          <button class="btn btn-teal btn-xs" onclick="printComanda(${o.id})">🖨️</button>
          <button class="btn btn-ghost btn-xs" onclick="viewDetail(${o.id})">Ver</button>
          ${o.delivery_type==='DELIVERY'?`<button class="btn btn-gold btn-xs" onclick="notifyMotoboy(${o.id})">🏍️</button>`:''}
        </div>
      </div>
    </div>`).join('');
}

window.updateStatus = async (id, status) => {
  await OrdersAPI.updateStatus(id, status);
  loadOpenOrders(); updateOpenBadge();
};

async function updateOpenBadge() {
  const orders = await OrdersAPI.list({ status: 'PENDING,MAKING,READY' });
  const badge = document.getElementById('openBadge');
  badge.textContent = orders.length;
  badge.style.display = orders.length > 0 ? 'inline-block' : 'none';
}

window.notifyMotoboy = async (orderId) => {
  const order = await OrdersAPI.get(orderId);
  const phone = S.settings.motoboy1_active ? S.settings.motoboy1_phone
              : S.settings.motoboy2_active ? S.settings.motoboy2_phone : '';
  showWAModal(buildMotoboyMessage(order, S.settings), phone);
};

// ── Comanda & Detail ──────────────────────────────────────
window.printComanda = async (orderId) => {
  const order = await OrdersAPI.get(orderId);
  const html  = buildComandaHTML(order, S.settings);
  document.getElementById('comandaContent').innerHTML = html;
  document.getElementById('printArea').innerHTML      = html;
  openModal('modalPrint');
};

window.viewDetail = async (orderId) => {
  const o = await OrdersAPI.get(orderId);
  const mapsUrl = o.address ? `https://maps.google.com/?q=${encodeURIComponent(o.address)}` : null;
  document.getElementById('orderDetailContent').innerHTML = `
    <div style="display:grid;gap:10px">
      <div class="fg-row cols2">
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Cliente</div><div style="font-size:14px;font-weight:600">${o.client_name}</div></div>
        <div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Data/Hora</div><div style="font-size:13.5px">${fmtDate(o.created_at)}</div></div>
      </div>
      ${o.client_phone?`<div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">WhatsApp</div><div>${o.client_phone}</div></div>`:''}
      ${o.address?`<div><div style="font-size:11px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Endereço</div><div>${o.address}${mapsUrl?` <a href="${mapsUrl}" target="_blank" style="color:var(--teal2);font-size:12px">📍 Maps</a>`:''}</div></div>`:''}
      <div class="div" style="margin:6px 0"></div>
      ${o.items.map(i=>`<div style="display:flex;justify-content:space-between;font-size:13.5px;padding:6px 0;border-bottom:1px solid var(--border)"><span>${i.quantity}x ${i.item_emoji||''} ${i.item_name}</span><span style="color:var(--gold2);font-weight:600">${fmtBRL(i.item_price*i.quantity)}</span></div>`).join('')}
      ${parseFloat(o.delivery_fee)>0?`<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text3)"><span>Taxa de entrega</span><span>${fmtBRL(o.delivery_fee)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;padding-top:8px"><span>Total</span><span style="color:var(--gold2);font-family:var(--font-jp)">${fmtBRL(o.total)}</span></div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:4px">${payBadge(o.payment)} ${statusBadge(o.status)} ${srcBadge(o.source)}</div>
      ${o.obs?`<div style="background:var(--bg3);border-radius:var(--r);padding:10px 13px;border-left:3px solid var(--gold2);margin-top:4px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Observações</div><div>${o.obs}</div></div>`:''}
    </div>`;
  openModal('modalOrderDetail');
};

// ─────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────
window.loadHistory = async function() {
  const params = {};
  const search = document.getElementById('histSearch').value.trim();
  const status = document.getElementById('histStatus').value;
  const from   = document.getElementById('histFrom').value;
  const to     = document.getElementById('histTo').value;
  if (status !== 'all') params.status = status;
  if (search) params.search = search;
  if (from)   params.from = from;
  if (to)     params.to   = to;
  const orders = await OrdersAPI.list(params);
  const el = document.getElementById('histList');
  if (!orders.length) { el.innerHTML = emptyState('📋','Nenhum pedido'); return; }
  el.innerHTML = orders.map(o => `
    <div class="hist-item">
      <div class="hist-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:11px;color:var(--text3);font-family:monospace">${fmtId(o.id)}</span>
          <span style="font-size:14px;font-weight:600">${o.client_name}</span>
          ${statusBadge(o.status)} ${srcBadge(o.source)}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--font-jp);font-size:16px;font-weight:700;color:var(--gold2)">${fmtBRL(o.total)}</span>
          ${payBadge(o.payment)}
          <button class="btn btn-ghost btn-xs" onclick="viewDetail(${o.id})">Ver</button>
          <button class="btn btn-teal btn-xs" onclick="printComanda(${o.id})">🖨️</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px">${fmtDate(o.created_at)} · ${o.delivery_type==='DELIVERY'?'🛵 Delivery':'🏪 Retirada'}${o.address?' · '+o.address:''}</div>
      <div style="font-size:12.5px;color:var(--text2);margin-top:5px">${o.items.map(i=>`${i.quantity}x ${i.item_name}`).join(', ')}</div>
      ${o.obs?`<div style="font-size:12px;color:var(--gold2);margin-top:4px">📝 ${o.obs}</div>`:''}
    </div>`).join('');
};

// ─────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────
window.loadDashboard = async function() {
  const days = document.getElementById('dashPeriod').value;
  const data = await SettingsAPI.dashboardStats(days);
  document.getElementById('dashStats').innerHTML = `
    <div class="stat"><div class="stat-label">Total Pedidos</div><div class="stat-value">${data.totalOrders}</div><div class="stat-sub">no período</div></div>
    <div class="stat"><div class="stat-label">Entregues</div><div class="stat-value col-green">${data.deliveredOrders}</div><div class="stat-sub">${data.totalOrders?Math.round(data.deliveredOrders/data.totalOrders*100):0}%</div></div>
    <div class="stat"><div class="stat-label">Faturamento</div><div class="stat-value col-gold">${fmtBRL(data.revenue)}</div><div class="stat-sub">pedidos entregues</div></div>
    <div class="stat"><div class="stat-label">Ticket Médio</div><div class="stat-value col-red">${fmtBRL(data.avgTicket)}</div><div class="stat-sub">por pedido</div></div>`;
  const maxItem = data.topItems[0]?.count||1;
  document.getElementById('topItems').innerHTML = data.topItems.length
    ? data.topItems.map(i=>`<div class="bar-row"><div class="bar-lbl">${i.emoji||''} ${i.name}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(i.count/maxItem*100)}%"></div></div><div class="bar-cnt">${i.count}x</div></div>`).join('')
    : '<p style="color:var(--text3);font-size:13px">Sem dados</p>';
  const maxCat = data.catSales[0]?.[1]||1;
  document.getElementById('catChart').innerHTML = data.catSales.length
    ? data.catSales.map(([cat,cnt])=>`<div class="bar-row"><div class="bar-lbl">${cat}</div><div class="bar-track"><div class="bar-fill teal" style="width:${Math.round(cnt/maxCat*100)}%"></div></div><div class="bar-cnt">${cnt}x</div></div>`).join('')
    : '<p style="color:var(--text3);font-size:13px">Sem dados</p>';
  const PAY_COLORS = {PIX:'var(--teal2)',CREDIT:'var(--blue2)',DEBIT:'#a78bfa',CASH:'var(--gold2)'};
  const PAY_LABELS = {PIX:'PIX',CREDIT:'Crédito',DEBIT:'Débito',CASH:'Dinheiro'};
  const totalPay = Object.values(data.paymentCounts).reduce((a,b)=>a+b,0)||1;
  document.getElementById('payChart').innerHTML = Object.entries(data.paymentCounts).map(([pay,cnt])=>`
    <div style="text-align:center;padding:16px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border)">
      <div style="font-size:26px;font-weight:900;color:${PAY_COLORS[pay]||'var(--text)'};font-family:var(--font-jp)">${cnt}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px">${PAY_LABELS[pay]||pay}</div>
      <div style="font-size:11px;color:var(--text3)">${Math.round(cnt/totalPay*100)}%</div>
    </div>`).join('') || '<p style="color:var(--text3);font-size:13px;grid-column:1/-1">Sem dados</p>';
};

// ─────────────────────────────────────────────────────────
// FINANCEIRO
// ─────────────────────────────────────────────────────────
window.loadFinanceiro = async function() {
  const filter = document.getElementById('finFilter').value;
  const allDelivered = await OrdersAPI.list({ status: 'DELIVERED' });
  const orders = filter==='all' ? allDelivered : allDelivered.filter(o=>o.payment===filter);
  const sum = arr => arr.reduce((s,o)=>s+parseFloat(o.total), 0);
  document.getElementById('finStats').innerHTML = `
    <div class="stat"><div class="stat-label">Total Recebido</div><div class="stat-value col-gold">${fmtBRL(sum(orders))}</div><div class="stat-sub">${orders.length} pedido(s)</div></div>
    <div class="stat"><div class="stat-label">PIX</div><div class="stat-value col-teal" style="font-size:22px">${fmtBRL(sum(allDelivered.filter(o=>o.payment==='PIX')))}</div></div>
    <div class="stat"><div class="stat-label">Cartão</div><div class="stat-value col-blue" style="font-size:22px">${fmtBRL(sum(allDelivered.filter(o=>['CREDIT','DEBIT'].includes(o.payment))))}</div></div>
    <div class="stat"><div class="stat-label">Dinheiro</div><div class="stat-value col-gold" style="font-size:22px">${fmtBRL(sum(allDelivered.filter(o=>o.payment==='CASH')))}</div></div>`;
  document.getElementById('finTable').innerHTML = orders.length
    ? orders.map(o=>`<tr>
        <td style="font-family:monospace;font-size:11.5px;color:var(--text3)">${fmtId(o.id)}</td>
        <td><span style="font-weight:600">${o.client_name}</span>${o.client_phone?`<br><span style="font-size:11px;color:var(--text3)">${o.client_phone}</span>`:''}</td>
        <td style="font-size:12.5px;color:var(--text2)">${fmtDate(o.created_at)}</td>
        <td style="font-size:12px">${o.items.map(i=>`${i.quantity}x ${i.item_name}`).join(', ')}</td>
        <td>${o.delivery_type==='DELIVERY'?'🛵':'🏪'} ${o.neighborhood_name||''}</td>
        <td>${payBadge(o.payment)}</td>
        <td style="font-weight:700;color:var(--gold2);font-family:var(--font-jp)">${fmtBRL(o.total)}</td>
        <td><button class="btn btn-ghost btn-xs" onclick="printComanda(${o.id})">🖨️</button></td>
      </tr>`).join('')
    : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text3)">Nenhum pedido finalizado</td></tr>`;
};

window.exportCSV = function() {
  OrdersAPI.list({status:'DELIVERED'}).then(orders => {
    const header = ['ID','Cliente','Telefone','Data','Endereço','Entrega','Bairro','Pagamento','Total','Obs'];
    const rows   = orders.map(o=>[fmtId(o.id),o.client_name,o.client_phone||'',fmtDate(o.created_at),o.address||'',o.delivery_type,o.neighborhood_name||'',o.payment,parseFloat(o.total).toFixed(2),o.obs||'']);
    const csv    = [header,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const a      = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
    a.download = `tenkai_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); toast('CSV exportado!');
  });
};

// ─────────────────────────────────────────────────────────
// RELATÓRIOS
// ─────────────────────────────────────────────────────────
window.loadRelatorios = async function() {
  const from = document.getElementById('repFrom').value;
  const to   = document.getElementById('repTo').value;
  const type = document.querySelector('input[name="repType"]:checked')?.value || 'delivered';
  const params = {};
  if (from) params.from = from;
  if (to)   params.to   = to;
  const data = type === 'deliveries'
    ? await SettingsAPI.reportDeliveries(params)
    : await SettingsAPI.reportDelivered(params);
  const { summary } = data;
  document.getElementById('repStats').innerHTML = type === 'deliveries' ? `
    <div class="stat"><div class="stat-label">Total Entregas</div><div class="stat-value col-teal">${summary.total_deliveries}</div></div>
    <div class="stat"><div class="stat-label">Total em Taxas</div><div class="stat-value col-gold">${fmtBRL(summary.total_fees)}</div></div>
    <div class="stat"><div class="stat-label">Bairro Top</div><div class="stat-value col-red" style="font-size:18px">${summary.by_neighborhood?.[0]?.[0]||'—'}</div></div>
  ` : `
    <div class="stat"><div class="stat-label">Pedidos</div><div class="stat-value">${summary.total_orders}</div></div>
    <div class="stat"><div class="stat-label">Receita Total</div><div class="stat-value col-gold">${fmtBRL(summary.total_revenue)}</div></div>
    <div class="stat"><div class="stat-label">Delivery</div><div class="stat-value col-teal">${summary.by_type?.DELIVERY||0}</div></div>
    <div class="stat"><div class="stat-label">Retirada</div><div class="stat-value col-blue">${summary.by_type?.PICKUP||0}</div></div>
  `;
  document.getElementById('repTable').innerHTML = (data.orders||data.deliveries||[]).slice(0,50).map(o=>`
    <tr>
      <td style="font-family:monospace;font-size:11.5px;color:var(--text3)">${fmtId(o.id)}</td>
      <td style="font-weight:600">${o.client_name}</td>
      <td style="font-size:12px;color:var(--text2)">${fmtDate(o.created_at)}</td>
      <td>${o.delivery_type==='DELIVERY'?'🛵':'🏪'} ${o.neighborhood_name||''}</td>
      <td>${payBadge(o.payment)}</td>
      <td style="font-weight:700;color:var(--gold2)">${fmtBRL(o.total)}</td>
    </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3)">Sem dados</td></tr>`;
};

// ─────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────
init();
