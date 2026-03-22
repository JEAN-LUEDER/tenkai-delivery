/** js/ui.js — Utilitários de interface */

let _toastTimer = null;

export function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  const icons = { ok:'✓', err:'✕', info:'ℹ' };
  const colors = { ok:'var(--green2)', err:'var(--red3)', info:'var(--blue2)' };
  el.innerHTML = `<span style="color:${colors[type]}">${icons[type]}</span> ${msg}`;
  el.className = `toast show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

export function openModal(id)  { document.getElementById(id)?.classList.add('open');    }
export function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

const STATUS_META = {
  PENDING:   { cls:'s-PENDING',   label:'Pendente'   },
  MAKING:    { cls:'s-MAKING',    label:'Preparando' },
  READY:     { cls:'s-READY',     label:'Pronto'     },
  DELIVERED: { cls:'s-DELIVERED', label:'Entregue'   },
  CANCELLED: { cls:'s-CANCELLED', label:'Cancelado'  }
};
const PAY_META = {
  PIX:    { cls:'pay-PIX',    label:'PIX'      },
  CREDIT: { cls:'pay-CREDIT', label:'Crédito'  },
  DEBIT:  { cls:'pay-DEBIT',  label:'Débito'   },
  CASH:   { cls:'pay-CASH',   label:'Dinheiro' }
};

export const PAYMENT_LABEL = Object.fromEntries(Object.entries(PAY_META).map(([k,v])=>[k,v.label]));
export const STATUS_LABEL  = Object.fromEntries(Object.entries(STATUS_META).map(([k,v])=>[k,v.label]));

export function statusBadge(s) {
  const m = STATUS_META[s] ?? STATUS_META.PENDING;
  return `<span class="status ${m.cls}">${m.label}</span>`;
}
export function payBadge(p) {
  const m = PAY_META[p] ?? PAY_META.PIX;
  return `<span class="pay ${m.cls}">${m.label}</span>`;
}
export function srcBadge(s) {
  return s === 'CUSTOMER'
    ? `<span class="src-badge src-CUSTOMER">🌐 Online</span>`
    : `<span class="src-badge src-INTERNAL">🖥️ Interno</span>`;
}

export const fmtBRL  = v => `R$ ${parseFloat(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
export const fmtId   = id => `#${String(id).padStart(4,'0')}`;
export const fmtDate = iso => new Date(iso).toLocaleString('pt-BR');
export const fmtDateShort = iso => new Date(iso).toLocaleDateString('pt-BR');

export function emptyState(icon, text) {
  return `<div class="empty"><div class="ei">${icon}</div><p>${text}</p></div>`;
}

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('tenkai_user')); } catch { return null; }
}

export function logout() {
  localStorage.removeItem('tenkai_token');
  localStorage.removeItem('tenkai_user');
  window.location.href = '/login.html';
}
