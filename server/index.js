import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { initDb, getDb, closeDb } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (!req.path.startsWith('/api/preview')) // keep logs quieter
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

import tenantRoutes from './routes/tenants.js';
import contentRoutes from './routes/content.js';
import domainRoutes from './routes/domains.js';

app.use('/api/tenants', tenantRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/domains', domainRoutes);

app.get('/api/health', (req, res) => {
  try {
    const db = getDb();
    const tenantCount = db.get('SELECT COUNT(*) as c FROM tenants')?.c || 0;
    const blockCount = db.get('SELECT COUNT(*) as c FROM content_blocks')?.c || 0;
    res.json({
      success: true,
      data: { status: 'healthy', uptime: process.uptime(), tenants: tenantCount, content_blocks: blockCount, version: '1.0.0' }
    });
  } catch (e) {
    res.json({ success: true, data: { status: 'starting', uptime: process.uptime(), tenants: 0, content_blocks: 0, version: '1.0.0' } });
  }
});

// Preview endpoint generates HTML using our UI engine pattern
app.get('/api/preview/:tenantId', (req, res) => {
  try {
    const db = getDb();
    const tenant = db.get('SELECT * FROM tenants WHERE id = ?', req.params.tenantId);
    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });

    const blocks = db.all('SELECT * FROM content_blocks WHERE tenant_id = ? AND is_published = 1 ORDER BY slot_key', req.params.tenantId);
    const parsedBlocks = blocks.map(b => ({ ...b, content_payload: JSON.parse(b.content_payload) }));

    const html = buildRenderedPage(tenant, parsedBlocks);
    res.json({ success: true, data: { tenant, html } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve static frontend
const frontendPath = join(__dirname, '..', 'frontend', 'dist');
if (existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(join(frontendPath, 'index.html'));
    } else {
      next();
    }
  });
}

// Start server after DB init
async function start() {
  await initDb();
  console.log('✅ Database initialized');

  // Seed if empty
  const db = getDb();
  const count = db.get('SELECT COUNT(*) as c FROM tenants')?.c || 0;
  if (count === 0) {
    console.log('🌱 No tenants found — run `node seed.js` to populate sample data');
  }

  const server = app.listen(PORT, () => {
    console.log(`\n  🚀 WaaS CMS Engine — http://localhost:${PORT}`);
    console.log(`  📡 API:          http://localhost:${PORT}/api/health`);
    console.log(`  🏢 Dashboard:    http://localhost:${PORT}\n`);
  });

  process.on('SIGTERM', async () => { await closeDb(); server.close(); });
  process.on('SIGINT', async () => { await closeDb(); server.close(); });
}

start().catch(e => { console.error('Failed to start:', e); process.exit(1); });

export default app;

/* ════════ RENDER ENGINE (simplified UI engine inline) ════════ */

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function buildRenderedPage(tenant, blocks) {
  const slotMap = {};
  for (const b of blocks) slotMap[b.slot_key] = b.content_payload;

  const hero = slotMap.hero || { heading: tenant.name, subheading: 'Welcome' };
  const nav = slotMap['nav-bar'] || { logo: { text: tenant.name, url: '/' }, menuItems: [] };
  const footer = slotMap.footer || { columns: [], socialLinks: [], copyright: `© ${tenant.name}` };
  const banner = slotMap['notification-banner'];

  const contentSections = blocks.filter(b => !['hero','nav-bar','footer','notification-banner'].includes(b.slot_key));

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(tenant.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Inter',sans-serif;color:#1a1a2e;background:#fafafa;line-height:1.6;}
  nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;
    background:#0a0a0f;position:sticky;top:0;z-index:100;}
  nav a{color:rgba(255,255,255,0.85);text-decoration:none;margin:0 1rem;font-size:0.9rem;}
  nav a:hover{color:white;}
  .hero{min-height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;
    background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);color:white;padding:4rem 2rem;}
  .hero h1{font-size:3.5rem;font-weight:700;margin-bottom:1rem;}
  .hero p{font-size:1.25rem;opacity:0.9;max-width:600px;margin:0 auto 2rem;}
  .hero a{display:inline-block;background:#4f46e5;color:white;padding:0.85rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;}
  .container{max-width:1200px;margin:0 auto;padding:4rem 2rem;}
  .section-title{font-size:2rem;font-weight:700;margin-bottom:2rem;text-align:center;}
  .banner{background:#4f46e5;color:white;text-align:center;padding:1rem;font-size:0.9rem;}
  .footer{background:#1a1a2e;color:rgba(255,255,255,0.8);padding:3rem 2rem;text-align:center;}
  .footer a{color:#818cf8;text-decoration:none;}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center;}
  .card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:2rem;}
  .card{background:white;padding:2rem;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
  .card h3{margin-bottom:0.5rem;}
  .card p{color:#64748b;}
  .card .icon{font-size:2rem;margin-bottom:1rem;}
  table{width:100%;border-collapse:collapse;max-width:500px;margin:0 auto;}
  tr{border-bottom:1px solid #e2e8f0;}
  td{padding:0.75rem 0;}
  td:last-child{text-align:right;}
  .closed{color:#ef4444;}
  .event-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;}
  .event{border-left:4px solid #4f46e5;background:white;padding:1.5rem;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
  .event-date{font-size:0.85rem;color:#4f46e5;font-weight:600;margin-bottom:0.5rem;}
  .form-wrap{max-width:600px;margin:0 auto;background:white;padding:2.5rem;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
  .form-group{margin-bottom:1.25rem;}
  .form-group label{display:block;margin-bottom:0.5rem;font-weight:500;font-size:0.9rem;}
  .form-group input,.form-group textarea{width:100%;padding:0.75rem;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;}
  .form-group textarea{min-height:100px;}
  .btn-submit{background:#4f46e5;color:white;padding:0.85rem 2rem;border:none;border-radius:8px;font-weight:600;cursor:pointer;width:100%;}
  .doc-card{background:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;}
</style></head>
<body>
<nav>
  <a href="/" style="font-weight:700;font-size:1.1rem;">${escapeHtml(nav.logo?.text || tenant.name)}</a>
  <div>${(nav.menuItems || []).map(m => `<a href="${escapeHtml(m.url)}">${escapeHtml(m.label)}</a>`).join('')}</div>
</nav>
${banner ? `<div class="banner">${escapeHtml(banner.message)}</div>` : ''}
<section class="hero"${hero.backgroundImage ? ` style="background:linear-gradient(135deg,rgba(15,12,41,0.85),rgba(48,43,99,0.85)),url(${escapeHtml(hero.backgroundImage)}) center/cover"` : ''}>
  <div><h1>${escapeHtml(hero.heading)}</h1>
  <p>${escapeHtml(hero.subheading || '')}</p>
  ${hero.cta ? `<a href="${escapeHtml(hero.cta.url || '#')}">${escapeHtml(hero.cta.text || 'Get Started')}</a>` : ''}
  </div>
</section>
${contentSections.map(b => renderBlock(b)).join('')}
<footer class="footer">
  ${(footer.columns || []).map(c => `<div><strong>${escapeHtml(c.heading)}</strong><br>${(c.links || []).map(l => `<a href="${escapeHtml(l.url)}">${escapeHtml(l.label)}</a><br>`).join('')}</div>`).join('')}
  <div style="margin-top:1.5rem;">${(footer.socialLinks || []).map(s => `<a href="${escapeHtml(s.url)}" style="margin:0 0.5rem;">${escapeHtml(s.label)}</a>`).join('')}</div>
  <div style="margin-top:1rem;opacity:0.7;">${escapeHtml(footer.copyright || '')}</div>
</footer>
</body>
</html>`;
}

function renderBlock(block) {
  const d = block.content_payload;
  const t = (s) => escapeHtml(s ?? '');
  switch (block.slot_key) {
    case 'about-section':
      return `<section class="container"><h2 class="section-title">${t(d.title)}</h2>
        <div class="grid-2"><p style="font-size:1.1rem;line-height:1.8;color:#475569;">${t(d.body || '')}</p>
        ${d.image ? `<img src="${t(d.image)}" alt="" style="width:100%;border-radius:12px;">` : ''}</div></section>`;
    case 'services-grid':
      return `<section class="container"><h2 class="section-title">${t(d.title)}</h2>
        <div class="card-grid">${(d.items || []).map(i => `<div class="card"><div class="icon">${i.icon || '📄'}</div><h3>${t(i.title)}</h3><p>${t(i.description)}</p></div>`).join('')}</div></section>`;
    case 'business-hours':
      return `<section class="container"><h2 class="section-title">Hours</h2>
        <table>${(d.hours || []).map(h => `<tr><td>${t(h.day)}</td><td class="${h.is_closed?'closed':''}">${h.is_closed?'Closed':`${t(h.open)} - ${t(h.close)}`}</td></tr>`).join('')}</table>
        ${d.note ? `<p style="text-align:center;margin-top:1.5rem;color:#64748b;font-size:0.9rem;">${t(d.note)}</p>` : ''}</section>`;
    case 'event-calendar':
      return `<section class="container"><h2 class="section-title">${t(d.title)}</h2>
        <div class="event-grid">${(d.events || []).map(e => `<div class="event"><div class="event-date">${t(e.date)}${e.time ? ` · ${t(e.time)}` : ''}</div><h3>${t(e.title)}</h3><p style="color:#64748b;font-size:0.95rem;">${t(e.description||'')}</p>${e.location ? `<div style="margin-top:0.5rem;font-size:0.85rem;color:#94a3b8;">📍 ${t(e.location)}</div>`:''}</div>`).join('')}</div></section>`;
    case 'documents-list':
      return `<section class="container"><h2 class="section-title">${t(d.title)}</h2>
        ${(d.documents || []).map(doc => `<div class="doc-card"><div><strong>${t(doc.title)}</strong>${doc.description?`<p style="font-size:0.85rem;color:#64748b;">${t(doc.description)}</p>`:''}</div><a href="${t(doc.file_url)}" style="background:#4f46e5;color:white;padding:0.5rem 1rem;border-radius:6px;text-decoration:none;font-size:0.85rem;">Download</a></div>`).join('')}</section>`;
    case 'contact-form':
      return `<section class="container"><h2 class="section-title">${t(d.title||'Contact Us')}</h2>
        <div class="form-wrap">${(d.fields || []).map(f => `<div class="form-group"><label>${t(f.label)}${f.required?' <span style="color:#ef4444;">*</span>':''}</label>${f.type==='textarea'?`<textarea placeholder="${t(f.placeholder||'')}"></textarea>`:`<input type="${t(f.type)}" placeholder="${t(f.placeholder||'')}">`}</div>`).join('')}
        <button class="btn-submit">${t(d.submitText||'Submit')}</button></div></section>`;
    default:
      return '';
  }
}
