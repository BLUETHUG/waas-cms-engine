const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!data.success && !res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  // Health
  health: () => request('/health'),

  // Tenants
  getTenants: () => request('/tenants'),
  getTenant: (id) => request(`/tenants/${id}`),
  createTenant: (data) => request('/tenants', { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (id, data) => request(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTenant: (id) => request(`/tenants/${id}`, { method: 'DELETE' }),

  // Content
  getContent: (tenantId) => request(`/content/${tenantId}`),
  getContentSlot: (tenantId, slotKey) => request(`/content/${tenantId}/slot/${slotKey}`),
  upsertContent: (tenantId, slotKey, data) =>
    request(`/content/${tenantId}/slot/${slotKey}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContent: (tenantId, slotKey) =>
    request(`/content/${tenantId}/slot/${slotKey}`, { method: 'DELETE' }),

  // Domains
  getDomains: (tenantId) => request(`/domains/${tenantId}`),
  provisionDomain: (tenantId, hostname) =>
    request(`/domains/${tenantId}/provision`, { method: 'POST', body: JSON.stringify({ hostname }) }),
  verifySsl: (tenantId, taskId, passing) =>
    request(`/domains/${tenantId}/verify-ssl/${taskId}`, { method: 'POST', body: JSON.stringify({ passing }) }),
  deleteDomain: (tenantId, taskId) =>
    request(`/domains/${tenantId}/task/${taskId}`, { method: 'DELETE' }),

  // Preview
  getPreview: (tenantId) => request(`/preview/${tenantId}`),
};
