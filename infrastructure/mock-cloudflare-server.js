// ---------------------------------------------------------------------------
// Mock Cloudflare Custom Hostnames API Server
// ---------------------------------------------------------------------------
// Simulates the Cloudflare SSL for SaaS Custom Hostnames API for testing.
// Supports configurable failure modes via query parameters.
// ---------------------------------------------------------------------------

import express from 'express';

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const hostnameStore = new Map();  // zoneId -> Map<hostnameId, record>
let nextId = 1;

function getZoneStore(zoneId) {
  if (!hostnameStore.has(zoneId)) {
    hostnameStore.set(zoneId, new Map());
  }
  return hostnameStore.get(zoneId);
}

// ---------------------------------------------------------------------------
// Helper to produce structured Cloudflare-like responses
// ---------------------------------------------------------------------------
function cfResult(result, errors = [], messages = []) {
  return { success: errors.length === 0, errors, messages, result };
}

// ---------------------------------------------------------------------------
// POST /zones/:id/custom_hostnames
// ---------------------------------------------------------------------------
app.post('/zones/:zoneId/custom_hostnames', (req, res) => {
  const { zoneId } = req.params;
  const { fail, simulate_existing, ssl_slow } = req.query;

  // --- Configurable failures ---
  if (fail === '429') {
    return res.status(429).json(cfResult(null, [{ code: 10000, message: 'Rate limited' }]));
  }
  if (fail === '500') {
    return res.status(500).json(cfResult(null, [{ code: 20000, message: 'Internal server error' }]));
  }

  const { hostname, ssl } = req.body;
  if (!hostname) {
    return res.status(400).json(cfResult(null, [{ code: 6003, message: 'Missing hostname' }]));
  }

  // --- Simulate existing (409 conflict) ---
  if (simulate_existing === 'true') {
    // Check if we actually have it
    const store = getZoneStore(zoneId);
    for (const [, record] of store) {
      if (record.hostname === hostname) {
        return res.status(409).json(cfResult(null, [{ code: 10100, message: 'Hostname already exists' }]));
      }
    }
    // Even if we don't have it, simulate it
    return res.status(409).json(cfResult(null, [{ code: 10100, message: 'Hostname already exists' }]));
  }

  // --- SSL slow mode ---
  if (ssl_slow === 'true') {
    // Return with pending SSL validation
    const id = String(nextId++);
    const record = {
      id,
      hostname,
      ssl: {
        status: 'pending_validation',
        method: ssl?.method || 'http',
        type: 'dv',
      },
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    const store = getZoneStore(zoneId);
    store.set(id, record);
    return res.status(201).json(cfResult(record));
  }

  // --- Simulate SSL verification failure ---
  if (ssl && ssl.method === 'txt' && hostname.includes('fail-ssl')) {
    return res.status(422).json(cfResult(null, [{ code: 1400, message: 'SSL verification failed — could not validate domain ownership' }]));
  }

  // --- Happy path ---
  const id = String(nextId++);
  const record = {
    id,
    hostname,
    ssl: {
      status: 'active',
      method: ssl?.method || 'http',
      type: 'dv',
    },
    status: 'active',
    created_at: new Date().toISOString(),
  };
  const store = getZoneStore(zoneId);
  store.set(id, record);
  return res.status(201).json(cfResult(record));
});

// ---------------------------------------------------------------------------
// DELETE /zones/:id/custom_hostnames/:hostname_id
// ---------------------------------------------------------------------------
app.delete('/zones/:zoneId/custom_hostnames/:hostnameId', (req, res) => {
  const { zoneId, hostnameId } = req.params;
  const { fail } = req.query;

  if (fail === '429') {
    return res.status(429).json(cfResult(null, [{ code: 10000, message: 'Rate limited' }]));
  }
  if (fail === '500') {
    return res.status(500).json(cfResult(null, [{ code: 20000, message: 'Internal server error' }]));
  }

  const store = getZoneStore(zoneId);
  if (!store.has(hostnameId)) {
    return res.status(404).json(cfResult(null, [{ code: 7000, message: 'Hostname not found' }]));
  }

  store.delete(hostnameId);
  return res.status(200).json(cfResult({ id: hostnameId }));
});

// ---------------------------------------------------------------------------
// GET /zones/:id/custom_hostnames/:hostname_id — single record
// ---------------------------------------------------------------------------
app.get('/zones/:zoneId/custom_hostnames/:hostnameId', (req, res) => {
  const { zoneId, hostnameId } = req.params;
  const { fail } = req.query;

  if (fail === '429') {
    return res.status(429).json(cfResult(null, [{ code: 10000, message: 'Rate limited' }]));
  }
  if (fail === '500') {
    return res.status(500).json(cfResult(null, [{ code: 20000, message: 'Internal server error' }]));
  }

  const store = getZoneStore(zoneId);
  const record = store.get(hostnameId);
  if (!record) {
    return res.status(404).json(cfResult(null, [{ code: 7000, message: 'Hostname not found' }]));
  }

  return res.status(200).json(cfResult(record));
});

// ---------------------------------------------------------------------------
// GET /zones/:id/custom_hostnames — list / lookup by hostname
// ---------------------------------------------------------------------------
app.get('/zones/:zoneId/custom_hostnames', (req, res) => {
  const { zoneId } = req.params;
  const { hostname, fail } = req.query;

  if (fail === '429') {
    return res.status(429).json(cfResult(null, [{ code: 10000, message: 'Rate limited' }]));
  }
  if (fail === '500') {
    return res.status(500).json(cfResult(null, [{ code: 20000, message: 'Internal server error' }]));
  }

  const store = getZoneStore(zoneId);
  const records = Array.from(store.values());

  if (hostname) {
    const filtered = records.filter(r => r.hostname === hostname);
    return res.status(200).json(cfResult(filtered));
  }

  return res.status(200).json(cfResult(records));
});

// ---------------------------------------------------------------------------
// Health / reset endpoints (for test setup/teardown)
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/reset', (_req, res) => {
  hostnameStore.clear();
  nextId = 1;
  res.json({ status: 'reset' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.MOCK_CF_PORT || '0', 10);

export function startMockServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const addr = server.address();
      const actualPort = addr.port;
      console.log(`[mock-cloudflare] Server listening on port ${actualPort}`);
      resolve({ server, port: actualPort, baseURL: `http://127.0.0.1:${actualPort}` });
    });
    server.on('error', reject);
  });
}

// When run directly
if (process.argv[1] && (process.argv[1].endsWith('mock-cloudflare-server.js'))) {
  const port = parseInt(process.env.MOCK_CF_PORT || '3099', 10);
  app.listen(port, () => {
    console.log(`[mock-cloudflare] Server running on http://127.0.0.1:${port}`);
  });
}

export default app;
