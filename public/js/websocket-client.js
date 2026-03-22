/**
 * js/websocket-client.js
 * Cliente WebSocket com reconexão automática.
 * Emite eventos customizados no document para o app.js escutar.
 */

let ws        = null;
let reconnectTimer = null;
let attempts  = 0;

export function connectWS() {
  if (ws?.readyState === WebSocket.OPEN) return;

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);

  ws.onopen = () => {
    attempts = 0;
    console.log('[WS] Conectado');
    document.dispatchEvent(new CustomEvent('ws:connected'));
  };

  ws.onmessage = ({ data }) => {
    try {
      const msg = JSON.parse(data);
      document.dispatchEvent(new CustomEvent(`ws:${msg.type}`, { detail: msg.data }));

      // Toca som e mostra notificação visual para novos pedidos
      if (msg.type === 'NEW_ORDER') {
        playNotificationSound();
        showNotificationBell(msg.data);
      }
    } catch (e) {
      console.warn('[WS] Mensagem inválida', e);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Desconectado — reconectando...');
    scheduleReconnect();
  };

  ws.onerror = () => ws.close();
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  const delay = Math.min(1000 * 2 ** attempts, 30000); // max 30s
  attempts++;
  reconnectTimer = setTimeout(connectWS, delay);
}

// ── Som de notificação (Web Audio API) ───────────────────
function playNotificationSound() {
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* contexto de áudio não disponível */ }
}

// ── Banner de novo pedido ─────────────────────────────────
function showNotificationBell(order) {
  let bell = document.getElementById('notifBell');
  if (!bell) {
    bell = document.createElement('div');
    bell.id = 'notifBell';
    bell.className = 'notif-bell';
    bell.onclick = () => {
      bell.classList.remove('show');
      // Navega para pedidos se a função estiver disponível
      if (typeof window.goTo === 'function') window.goTo('pedidos');
    };
    document.body.appendChild(bell);
  }
  const isPickup = order?.delivery_type === 'PICKUP';
  bell.innerHTML = `
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
    </svg>
    Novo pedido! ${isPickup ? '🏪 Retirada' : '🛵 Delivery'} — ${order?.client_name ?? ''}
  `;
  bell.classList.add('show');
  setTimeout(() => bell.classList.remove('show'), 8000);
}
