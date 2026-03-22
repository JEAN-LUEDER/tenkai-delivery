/**
 * js/api.js — Camada de comunicação com o backend.
 * Injeta automaticamente o token JWT em todas as requisições.
 * Redireciona para /login.html se o token expirar.
 */

function getToken() {
  return localStorage.getItem('tenkai_token');
}

async function request(method, url, data) {
  const opts = { method, headers: { Authorization: `Bearer ${getToken()}` } };

  if (data instanceof FormData) {
    opts.body = data;
  } else if (data) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  }

  const res = await fetch(url, opts);

  // Token expirado → volta para login
  if (res.status === 401) {
    localStorage.removeItem('tenkai_token');
    localStorage.removeItem('tenkai_user');
    window.location.href = '/login.html';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const AuthAPI = {
  me:             ()       => request('GET',  '/api/auth/me'),
  changePassword: (data)   => request('POST', '/api/auth/change-password', data)
};

export const MenuAPI = {
  list:   ()       => request('GET',    '/api/menu'),
  create: (fd)     => request('POST',   '/api/menu',       fd),
  update: (id, fd) => request('PUT',    `/api/menu/${id}`, fd),
  remove: (id)     => request('DELETE', `/api/menu/${id}`)
};

export const OrdersAPI = {
  list:         (params = {}) => request('GET',   `/api/orders?${new URLSearchParams(params)}`),
  get:          (id)          => request('GET',   `/api/orders/${id}`),
  create:       (payload)     => request('POST',  '/api/orders',              payload),
  updateStatus: (id, status)  => request('PATCH', `/api/orders/${id}/status`, { status }),
  remove:       (id)          => request('DELETE', `/api/orders/${id}`)
};

export const SettingsAPI = {
  get:                ()       => request('GET',  '/api/settings'),
  save:               (fd)     => request('POST', '/api/settings',              fd),
  neighborhoods:      ()       => request('GET',  '/api/settings/neighborhoods'),
  addNeighborhood:    (data)   => request('POST', '/api/settings/neighborhoods', data),
  editNeighborhood:   (id, d)  => request('PUT',  `/api/settings/neighborhoods/${id}`, d),
  removeNeighborhood: (id)     => request('DELETE',`/api/settings/neighborhoods/${id}`),
  dashboardStats:     (days)   => request('GET',  `/api/settings/dashboard/stats?days=${days}`),
  reportDelivered:    (p)      => request('GET',  `/api/settings/reports/delivered?${new URLSearchParams(p)}`),
  reportDeliveries:   (p)      => request('GET',  `/api/settings/reports/deliveries?${new URLSearchParams(p)}`)
};

// Requisição pública — sem token (usada pela página do cliente)
export async function publicRequest(method, url, data) {
  const opts = { method, headers: {} };
  if (data) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
