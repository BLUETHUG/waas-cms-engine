import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from './api.js';

/* ═══════════════════════════════════════
   Toast System
   ═══════════════════════════════════════ */
const ToastContext = React.createContext();
function useToast() { return React.useContext(ToastContext); }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

/* ═══════════════════════════════════════
   Sidebar
   ═══════════════════════════════════════ */
function Sidebar({ status }) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: '📊', label: 'Dashboard' },
    { path: '/tenants', icon: '🏢', label: 'Tenants' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1><span>WaaS</span> CMS</h1>
        <div className="subtitle">Multi-Tenant Engine v1.0</div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section-title">Platform</div>
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span className={`status-dot ${status === 'healthy' ? 'online' : 'warning'}`}></span>
          Engine {status === 'healthy' ? 'Online' : status || '...'}
        </div>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════
   Dashboard
   ═══════════════════════════════════════ */
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentTenants, setRecentTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    async function load() {
      try {
        const [healthRes, tenantsRes] = await Promise.all([api.health(), api.getTenants()]);
        setStats(healthRes.data);
        setRecentTenants(tenantsRes.data.slice(0, 5));
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Platform overview and quick actions</p>
        </div>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-icon">🏢</div>
          <div className="stat-value">{stats?.tenants || 0}</div>
          <div className="stat-label">Active Tenants</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-value">{stats?.content_blocks || 0}</div>
          <div className="stat-label">Content Blocks</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-value">{Math.floor(stats?.uptime || 0)}s</div>
          <div className="stat-label">Uptime</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>Healthy</div>
          <div className="stat-label">API Status</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Recent Tenants</h3>
        {recentTenants.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏢</div>
            <h3>No tenants yet</h3>
            <p>Create your first tenant to get started</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentTenants.map(t => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/tenants/${t.id}`}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.slug}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.custom_domain || t.fallback_subdomain}</td>
                    <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Tenants List
   ═══════════════════════════════════════ */
function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', custom_domain: '' });
  const toast = useToast();
  const navigate = useNavigate();

  async function loadTenants() {
    try {
      const res = await api.getTenants();
      setTenants(res.data);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTenants(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const res = await api.createTenant(form);
      toast(`Tenant "${res.data.name}" created`, 'success');
      setShowCreate(false);
      setForm({ name: '', slug: '', custom_domain: '' });
      loadTenants();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This will remove all associated content.`)) return;
    try {
      await api.deleteTenant(id);
      toast(`Tenant deleted`, 'success');
      loadTenants();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Tenants</h2>
          <p>{tenants.length} tenant(s) registered</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Tenant</button>
      </div>

      {tenants.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">🏢</div>
            <h3>No tenants</h3>
            <p>Create your first tenant to get started</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Content</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.slug}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t.custom_domain || t.fallback_subdomain}</td>
                    <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>—</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/tenants/${t.id}`)}>Manage</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id, t.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create New Tenant</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Tenant Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} placeholder="e.g. Greenwood School" required />
              </div>
              <div className="form-group">
                <label>Slug</label>
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="greenwood-school" required style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }} />
              </div>
              <div className="form-group">
                <label>Custom Domain (optional)</label>
                <input value={form.custom_domain} onChange={e => setForm({ ...form, custom_domain: e.target.value })} placeholder="school.ac.ke" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Tenant</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Tenant Detail (tabs: Content, Domains, Preview)
   ═══════════════════════════════════════ */
function TenantDetail() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('content');
  const toast = useToast();

  async function load() {
    try {
      const [tRes, cRes] = await Promise.all([api.getTenant(id), api.getContent(id)]);
      setTenant(tRes.data);
      setBlocks(cRes.data);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;
  if (!tenant) return <div className="loading">Tenant not found</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{tenant.name}</h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{tenant.slug} · {tenant.custom_domain || tenant.fallback_subdomain}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className={`badge ${tenant.status}`}>{tenant.status}</span>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'content' ? 'active' : ''}`} onClick={() => setTab('content')}>📝 Content Blocks</button>
        <button className={`tab ${tab === 'domains' ? 'active' : ''}`} onClick={() => setTab('domains')}>🌐 Domains</button>
        <button className={`tab ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>👁️ Preview</button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>⚙️ Settings</button>
      </div>

      {tab === 'content' && <ContentEditor tenant={tenant} blocks={blocks} onUpdate={load} />}
      {tab === 'domains' && <DomainManager tenant={tenant} />}
      {tab === 'preview' && <PagePreview tenant={tenant} />}
      {tab === 'settings' && <TenantSettings tenant={tenant} onUpdate={setTenant} />}
    </div>
  );
}

/* ═══════════════════════════════════════
   Content Editor
   ═══════════════════════════════════════ */
function ContentEditor({ tenant, blocks, onUpdate }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editorData, setEditorData] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const slotKeys = ['hero', 'nav-bar', 'notification-banner', 'about-section', 'services-grid', 'business-hours', 'event-calendar', 'contact-form', 'documents-list', 'footer'];

  const existingSlots = new Set(blocks.map(b => b.slot_key));
  const publishedSlots = new Set(blocks.filter(b => b.is_published).map(b => b.slot_key));

  function selectSlot(slotKey) {
    setSelectedSlot(slotKey);
    const existing = blocks.find(b => b.slot_key === slotKey);
    if (existing) {
      setEditorData(JSON.stringify(existing.content_payload, null, 2));
      setIsPublished(existing.is_published);
    } else {
      setEditorData('{\n  \n}');
      setIsPublished(true);
    }
  }

  async function handleSave() {
    try {
      const payload = JSON.parse(editorData);
      setSaving(true);
      await api.upsertContent(tenant.id, selectedSlot, { content_payload: payload, is_published: isPublished });
      toast(`"${selectedSlot}" saved`, 'success');
      onUpdate();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="slot-list">
        {slotKeys.map(sk => (
          <button key={sk} className={`slot-pill ${selectedSlot === sk ? 'active' : ''}`} onClick={() => selectSlot(sk)}>
            {sk}
            {publishedSlots.has(sk) && <span className="check">✅</span>}
            {existingSlots.has(sk) && !publishedSlots.has(sk) && <span className="check" style={{ opacity: 0.4 }}>📄</span>}
          </button>
        ))}
      </div>

      {selectedSlot ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>{selectedSlot}</h3>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} style={{ width: 'auto' }} />
                Published
              </label>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save'}
              </button>
            </div>
          </div>
          <textarea
            value={editorData}
            onChange={e => setEditorData(e.target.value)}
            style={{ minHeight: '400px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: '1.7' }}
          />
        </div>
      ) : (
        <div className="empty-state">
          <div className="icon">📝</div>
          <h3>Select a content slot</h3>
          <p>Choose a slot from the list above to edit its JSON content payload</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Domain Manager
   ═══════════════════════════════════════ */
function DomainManager({ tenant }) {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const toast = useToast();

  async function load() {
    try {
      const res = await api.getDomains(tenant.id);
      setDomains(res.data);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [tenant.id]);

  async function handleProvision(e) {
    e.preventDefault();
    try {
      const res = await api.provisionDomain(tenant.id, newDomain);
      toast(`Domain "${newDomain}" provisioned`, 'success');
      setNewDomain('');
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleSslVerify(taskId, pass) {
    try {
      await api.verifySsl(tenant.id, taskId, pass);
      toast(`SSL ${pass ? 'verified ✅' : 'marked failed'}`, pass ? 'success' : 'error');
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDelete(taskId) {
    try {
      await api.deleteDomain(tenant.id, taskId);
      toast('Domain removed', 'success');
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Provision New Domain</h3>
        <form onSubmit={handleProvision} style={{ display: 'flex', gap: '0.75rem' }}>
          <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="e.g. school.ac.ke" style={{ flex: 1 }} required />
          <button type="submit" className="btn btn-primary">🚀 Provision</button>
        </form>
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Fallback subdomain: <strong style={{ color: 'var(--text-secondary)' }}>{tenant.fallback_subdomain}</strong>
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Domain Tasks</h3>
        {loading ? <div className="loading"><div className="spinner"></div></div> : domains.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🌐</div>
            <h3>No domains provisioned</h3>
            <p>Add a custom domain above to get started</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Status</th>
                  <th>SSL</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{d.hostname}</td>
                    <td><span className={`badge ${d.status}`}>{d.status}</span></td>
                    <td><span className={`badge ${d.ssl_status === 'active' ? 'active' : d.ssl_status === 'failed' ? 'error' : 'provisioning'}`}>{d.ssl_status || '—'}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        {d.status === 'provisioning' && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleSslVerify(d.id, true)}>✅ SSL OK</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleSslVerify(d.id, false)}>❌ SSL Fail</button>
                          </>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(d.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Page Preview
   ═══════════════════════════════════════ */
function PagePreview({ tenant }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getPreview(tenant.id);
        setHtml(res.data.html);
      } catch (e) { toast(e.message, 'error'); }
      finally { setLoading(false); }
    }
    load();
  }, [tenant.id]);

  if (loading) return <div className="loading"><div className="spinner"></div>Generating preview...</div>;

  return (
    <div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        Live preview for <strong>{tenant.name}</strong> at {tenant.custom_domain || tenant.fallback_subdomain}
      </p>
      <iframe className="preview-frame" srcDoc={html} title="Tenant Preview" />
    </div>
  );
}

/* ═══════════════════════════════════════
   Tenant Settings
   ═══════════════════════════════════════ */
function TenantSettings({ tenant, onUpdate }) {
  const [form, setForm] = useState({ name: tenant.name, status: tenant.status, custom_domain: tenant.custom_domain || '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateTenant(tenant.id, form);
      onUpdate(res.data);
      toast('Settings saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="card" style={{ maxWidth: '600px' }}>
      <form onSubmit={handleSave}>
        <div className="form-group">
          <label>Tenant Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="provisioning">Provisioning</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
        <div className="form-group">
          <label>Custom Domain</label>
          <input value={form.custom_domain} onChange={e => setForm({ ...form, custom_domain: e.target.value })} placeholder={tenant.fallback_subdomain} />
        </div>
        <div className="form-group">
          <label>Tenant ID</label>
          <input value={tenant.id} disabled style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', opacity: 0.6 }} />
        </div>
        <div className="form-group">
          <label>Config Payload (JSON)</label>
          <textarea value={JSON.stringify(JSON.parse(tenant.config_payload || '{}'), null, 2)} disabled style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', opacity: 0.6, minHeight: '120px' }} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════
   App Root
   ═══════════════════════════════════════ */
export default function App() {
  const [status, setStatus] = useState('loading');
  const location = useLocation();

  useEffect(() => {
    api.health()
      .then(r => setStatus(r.data?.status || 'unknown'))
      .catch(() => setStatus('offline'));
  }, []);

  const pageTitle = location.pathname === '/' ? 'Dashboard' :
    location.pathname === '/tenants' ? 'Tenants' :
    location.pathname.startsWith('/tenants/') ? 'Tenant Detail' : 'WaaS CMS';

  return (
    <ToastProvider>
      <div className="app-layout">
        <Sidebar status={status} />
        <div className="main-area">
          <div className="topbar">
            <h2>{pageTitle}</h2>
            <div className="topbar-actions">
              <Link to="/tenants" className="btn btn-primary btn-sm">+ New Tenant</Link>
              <button className="btn btn-secondary btn-icon" onClick={() => window.location.reload()} title="Refresh">🔄</button>
            </div>
          </div>
          <div className="content-area">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tenants" element={<TenantsPage />} />
              <Route path="/tenants/:id" element={<TenantDetail />} />
            </Routes>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
