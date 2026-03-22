/** js/comanda.js — Gerador HTML da comanda para impressão */

import { PAYMENT_LABEL } from './ui.js';

export function buildComandaHTML(order, settings) {
  const company  = settings.company_name    || 'TENKAI';
  const addr     = settings.company_address || '';
  const logo     = settings.company_logo_url || '';
  const payLabel = PAYMENT_LABEL[order.payment] ?? order.payment;
  const dt       = new Date(order.created_at).toLocaleString('pt-BR');
  const orderId  = `#${String(order.id).padStart(4,'0')}`;
  const isPickup = order.delivery_type === 'PICKUP';

  let html = `<div class="comanda">`;
  if (logo) html += `<img src="${logo}" style="width:60px;height:60px;object-fit:contain;display:block;margin:0 auto 6px;border-radius:8px" alt="logo">`;
  html += `<h2>${company}</h2>`;
  if (addr) html += `<p class="sub">${addr}</p>`;
  html += `<hr>`;
  html += `<div class="row"><span><b>Pedido ${orderId}</b></span><span>${dt}</span></div>`;
  html += `<div class="row"><span>Cliente</span><span>${order.client_name}</span></div>`;
  html += `<div class="row"><span>Entrega</span><span>${isPickup ? 'Retirada no local' : 'Delivery'}</span></div>`;
  if (!isPickup && order.address) html += `<div style="font-size:11px;color:#555;margin-top:2px">${order.address}</div>`;
  html += `<hr>`;
  (order.items ?? []).forEach(i => {
    const price = parseFloat(i.item_price) || 0;
    const qty   = parseInt(i.quantity)     || 0;
    html += `<div class="row"><span>${qty}x ${i.item_name}</span><span>R$ ${(price*qty).toFixed(2)}</span></div>`;
  });
  html += `<hr>`;
  if (parseFloat(order.delivery_fee) > 0) {
    html += `<div class="row"><span>Taxa de entrega</span><span>R$ ${parseFloat(order.delivery_fee).toFixed(2)}</span></div>`;
  }
  html += `<div class="row total-line"><span>TOTAL</span><span>R$ ${parseFloat(order.total).toFixed(2)}</span></div>`;
  html += `<div class="row" style="margin-top:4px"><span>Pagamento</span><span>${payLabel}</span></div>`;
  if (order.obs?.trim()) {
    html += `<hr><div class="obs-box"><b>Observações:</b><br>${order.obs.trim()}</div>`;
  }
  html += `<hr><div class="footer">Obrigado pela preferência!<br>${company}</div></div>`;
  return html;
}
