import { Router } from 'express';
import { getDb } from '../db.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/:tenantId', (req, res) => {
  const db = getDb();
  const tasks = db.all('SELECT * FROM domain_tasks WHERE tenant_id = ? ORDER BY created_at DESC', req.params.tenantId);
  res.json({ success: true, data: tasks });
});

router.post('/:tenantId/provision', (req, res) => {
  const db = getDb();
  const { hostname } = req.body;
  if (!hostname) return res.status(400).json({ success: false, error: 'hostname required' });

  const tenant = db.get('SELECT * FROM tenants WHERE id = ?', req.params.tenantId);
  if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });

  const existing = db.get('SELECT * FROM domain_tasks WHERE tenant_id = ? AND hostname = ?', req.params.tenantId, hostname);
  if (existing) return res.json({ success: true, data: existing, note: 'Domain already registered' });

  const id = uuid();
  db.run(
    "INSERT INTO domain_tasks (id, tenant_id, hostname, status, ssl_status) VALUES (?, ?, ?, 'provisioning', 'pending')",
    id, req.params.tenantId, hostname
  );
  db.run("UPDATE tenants SET custom_domain = ?, updated_at = datetime('now') WHERE id = ?", hostname, req.params.tenantId);

  const task = db.get('SELECT * FROM domain_tasks WHERE id = ?', id);
  res.status(201).json({ success: true, data: task });
});

router.post('/:tenantId/verify-ssl/:taskId', (req, res) => {
  const db = getDb();
  const { passing } = req.body;

  db.run(
    "UPDATE domain_tasks SET ssl_status = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    passing ? 'active' : 'failed', passing ? 'active' : 'error', req.params.taskId, req.params.tenantId
  );

  const task = db.get('SELECT * FROM domain_tasks WHERE id = ? AND tenant_id = ?', req.params.taskId, req.params.tenantId);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  res.json({ success: true, data: task });
});

router.delete('/:tenantId/task/:taskId', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM domain_tasks WHERE id = ? AND tenant_id = ?', req.params.taskId, req.params.tenantId);
  res.json({ success: true, data: { deleted: true } });
});

export default router;
