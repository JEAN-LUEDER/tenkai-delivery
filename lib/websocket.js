/**
 * lib/websocket.js
 * Gerenciador de WebSocket para notificações em tempo real.
 *
 * Eventos emitidos:
 *   NEW_ORDER     → novo pedido chegou (do cliente via link ou interno)
 *   STATUS_UPDATE → status de pedido alterado
 *   PING          → keepalive a cada 30s
 */

import { WebSocketServer } from 'ws';

let wss = null;

/**
 * Inicializa o servidor WebSocket acoplado ao HTTP server.
 * @param {http.Server} httpServer
 */
export function initWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    ws.isAlive = true;

    // Responde ao pong do cliente (keepalive)
    ws.on('pong', () => { ws.isAlive = true; });

    // Mensagem de boas-vindas
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'TENKAI WebSocket ativo' }));
  });

  // Ping a cada 30s para manter conexões vivas
  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(interval));

  console.log('[WS] WebSocket iniciado');
  return wss;
}

/**
 * Envia um evento para TODOS os clientes conectados (operadores logados).
 * @param {string} type  - tipo do evento
 * @param {object} data  - payload do evento
 */
export function broadcast(type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  wss.clients.forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
}
