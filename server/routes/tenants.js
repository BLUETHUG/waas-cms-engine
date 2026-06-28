import { Router } from 'express';
import { getDb } from '../db.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const tenants = db.all('SELECT * FROM tenants ORDER BY created_at DESC');
  res.json({ success: true, data: tenants });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const tenant = db.get('SELECT * FROM tenants WHERE id = ?', req.params.id);
  if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
  res.json({ success: true, data: tenant });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, slug, custom_domain, config_payload } = req.body;
  if (!name || !slug) return res.status(400).json({ success: false, error: 'name and slug required' });

  const existing = db.get('SELECT id FROM tenants WHERE slug = ?', slug);
  if (existing) return res.status(409).json({ success: false, error: 'Slug already exists' });

  const id = uuid();
  const fallbackSubdomain = `${slug}.waas.app`;
  db.run(
    'INSERT INTO tenants (id, name, slug, status, fallback_subdomain, config_payload, activation_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, name, slug, 'active', fallbackSubdomain, JSON.stringify(config_payload || {}), uuid()
  );

  const tenant = db.get('SELECT * FROM tenants WHERE id = ?', id);
  res.status(201).json({ success: true, data: tenant });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const tenant = db.get('SELECT * FROM tenants WHERE id = ?', req.params.id);
  if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });

  const { name, status, custom_domain, config_payload } = req.body;
  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (custom_domain !== undefined) { updates.push('custom_domain = ?'); params.push(custom_domain); }
  if (config_payload !== undefined) { updates.push('config_payload = ?'); params.push(JSON.stringify(config_payload)); }

  if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.run(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`, ...params);
  const updated = db.get('SELECT * FROM tenants WHERE id = ?', req.params.id);
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM tenants WHERE id = ?', req.params.id);
  res.json({ success: true, data: { deleted: true } });
});

export default router;
