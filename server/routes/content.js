import { Router } from 'express';
import { getDb } from '../db.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/:tenantId', (req, res) => {
  const db = getDb();
  const blocks = db.all('SELECT * FROM content_blocks WHERE tenant_id = ? ORDER BY slot_key', req.params.tenantId);
  res.json({
    success: true,
    data: blocks.map(b => ({ ...b, content_payload: JSON.parse(b.content_payload), is_published: !!b.is_published }))
  });
});

router.get('/:tenantId/slot/:slotKey', (req, res) => {
  const db = getDb();
  const block = db.get('SELECT * FROM content_blocks WHERE tenant_id = ? AND slot_key = ?', req.params.tenantId, req.params.slotKey);
  if (!block) return res.status(404).json({ success: false, error: 'Content block not found' });
  res.json({ success: true, data: { ...block, content_payload: JSON.parse(block.content_payload), is_published: !!block.is_published } });
});

router.put('/:tenantId/slot/:slotKey', (req, res) => {
  const db = getDb();
  const { content_payload, is_published } = req.body;

  if (!content_payload) return res.status(400).json({ success: false, error: 'content_payload required' });

  const existing = db.get('SELECT * FROM content_blocks WHERE tenant_id = ? AND slot_key = ?', req.params.tenantId, req.params.slotKey);

  if (existing) {
    db.run(
      "UPDATE content_blocks SET content_payload = ?, version = version + 1, is_published = ?, updated_at = datetime('now') WHERE tenant_id = ? AND slot_key = ?",
      JSON.stringify(content_payload), is_published ? 1 : 0, req.params.tenantId, req.params.slotKey
    );
  } else {
    db.run(
      'INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, is_published) VALUES (?, ?, ?, ?, ?)',
      uuid(), req.params.tenantId, req.params.slotKey, JSON.stringify(content_payload), is_published ? 1 : 0
    );
  }

  const block = db.get('SELECT * FROM content_blocks WHERE tenant_id = ? AND slot_key = ?', req.params.tenantId, req.params.slotKey);
  res.json({ success: true, data: { ...block, content_payload: JSON.parse(block.content_payload), is_published: !!block.is_published } });
});

router.delete('/:tenantId/slot/:slotKey', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM content_blocks WHERE tenant_id = ? AND slot_key = ?', req.params.tenantId, req.params.slotKey);
  res.json({ success: true, data: { deleted: true } });
});

export default router;
