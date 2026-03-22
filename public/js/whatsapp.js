/** js/whatsapp.js — Construtores de mensagens WhatsApp */

import { PAYMENT_LABEL } from './ui.js';

export function buildClientMessage(p, s) {
  const company  = s.company_name || 'TENKAI';
  const payLabel = PAYMENT_LABEL[p.payment] ?? p.payment;
  let msg = `🍣 *${company} — CONFIRMAÇÃO DE PEDIDO*\n━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 *Cliente:* ${p.client_name}\n`;
  if (p.delivery_type === 'DELIVERY') {
    msg += `🛵 *Entrega:* Delivery\n`;
    if (p.address) msg += `📍 *Endereço:* ${p.address}\n`;
  } else {
    msg += `🏪 *Retirada no local*\n`;
  }
  msg += `\n*Itens:*\n`;
  p.items.forEach(i => {
    msg += `  • ${i.quantity}x ${i.item_emoji||''} ${i.item_name} — R$ ${(parseFloat(i.item_price)*i.quantity).toFixed(2)}\n`;
  });
  if (parseFloat(p.delivery_fee) > 0) msg += `\n🛵 *Taxa de entrega:* R$ ${parseFloat(p.delivery_fee).toFixed(2)}\n`;
  msg += `\n💰 *TOTAL: R$ ${parseFloat(p.total).toFixed(2)}*\n`;
  msg += `💳 *Pagamento:* ${payLabel}\n`;
  if (s.pix_key && p.payment === 'PIX') msg += `🔑 *Chave PIX:* ${s.pix_key}\n`;
  if (p.obs?.trim()) msg += `\n📝 *Observações:* ${p.obs.trim()}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\nObrigado pela preferência! 🙏`;
  return msg;
}

export function buildMotoboyMessage(p, s) {
  const company = s.company_name || 'TENKAI';
  let msg = `🏍️ *${company} — NOVA ENTREGA*\n━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 *Cliente:* ${p.client_name}\n`;
  if (p.client_phone) msg += `📞 *Telefone:* ${p.client_phone}\n`;
  if (p.address) {
    msg += `📍 *Endereço:* ${p.address}\n`;
    msg += `🗺️ *Maps:* https://maps.google.com/?q=${encodeURIComponent(p.address)}\n`;
  }
  msg += `\n*Itens:*\n`;
  p.items.forEach(i => { msg += `  • ${i.quantity}x ${i.item_name}\n`; });
  if (parseFloat(p.delivery_fee) > 0) msg += `\n🛵 *Taxa:* R$ ${parseFloat(p.delivery_fee).toFixed(2)}\n`;
  msg += `\n💰 *Total a receber:* R$ ${parseFloat(p.total).toFixed(2)}\n`;
  if (p.obs?.trim()) msg += `\n📝 *Obs:* ${p.obs.trim()}\n`;
  msg += `🕐 *Hora:* ${new Date().toLocaleString('pt-BR')}\n━━━━━━━━━━━━━━━━━━━━`;
  return msg;
}

export function buildGreetingMessage(settings) {
  const link = `${window.location.origin}/pedido`;
  return (settings.greeting_message || '')
    .replace('{company}', settings.company_name || 'TENKAI')
    .replace('{link}', link);
}

export function openWhatsApp(phone, message) {
  const url = phone
    ? `https://wa.me/55${phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}
