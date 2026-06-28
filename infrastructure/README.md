# WaaS CMS Engine — Infrastructure Layer

Platform API & Dynamic Routing Core for the multi-tenant WaaS CMS.

## Modules

### 1. Cloudflare API Wrapper (`cloudflare-hostnames.js`)

A robust, fault-tolerant Node.js module that wraps the Cloudflare Custom
Hostnames API (SSL for SaaS).

**Functions:**

| Function | Description |
|---|---|
| `createCustomHostname(zoneId, hostname, sslMethod)` | Creates a custom hostname. Returns the existing record if it already exists (409 idempotency). |
| `deleteCustomHostname(zoneId, hostnameId)` | Deletes a custom hostname. Returns success if already deleted (404 idempotent). |
| `getCustomHostnameStatus(zoneId, hostnameId)` | Gets the current status/validation state of a custom hostname. |

**All functions return structured `{success, data, error}` objects — they never
throw.**

**Error Classification:**

| Category | HTTP Status | Behavior |
|---|---|---|
| `rate_limited` | 429 | Retry with exponential backoff |
| `client_error` | 4xx (except 409) | Throw immediately |
| `server_error` | 5xx | Retry with exponential backoff |
| `timeout` | — | Retry with exponential backoff |
| `network` | — | Retry with exponential backoff |

**Idempotency:** On 409 Conflict, the wrapper automatically looks up the
existing hostname record and returns it.

**Retry Policy:**

- Max 3 retries
- Initial backoff: 1s
- Multiplier: 2×
- Max backoff: 10s
- Jitter: ±25%

**Timeout:** 30s per request.

**SSL Fallback:** If SSL verification fails, returns a structured response with
a suggested fallback subdomain (`<slug>.ourdomain.com`).

### 2. Mock Cloudflare API Server (`mock-cloudflare-server.js`)

An Express.js server that simulates the Cloudflare Custom Hostnames API for
testing.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/zones/:id/custom_hostnames` | Create a custom hostname |
| `DELETE` | `/zones/:id/custom_hostnames/:hostname_id` | Delete a custom hostname |
| `GET` | `/zones/:id/custom_hostnames/:hostname_id` | Get single record |
| `GET` | `/zones/:id/custom_hostnames?hostname=xxx` | List / lookup by hostname |
| `GET` | `/health` | Health check |
| `POST` | `/reset` | Reset in-memory store |

**Failure Simulation Query Params:**

| Param | Effect |
|---|---|
| `?fail=429` | Returns 429 rate limit error |
| `?fail=500` | Returns 500 server error |
| `?simulate_existing=true` | Returns 409 conflict |
| `?ssl_slow=true` | Creates hostname with pending SSL validation |

### 3. Multi‑Tenant Request Middleware (`tenant-middleware.js`)

Express middleware that resolves the incoming request to a tenant.

**Behavior:**

1. Sanitizes the incoming hostname (lowercase, strip port, strip `www.`)
2. Validates against RFC‑952 hostname pattern
3. Looks up the tenant by custom domain in an in-memory store
4. Falls back to `slug.ourdomain.com` subdomain pattern
5. Caches resolved tenants for 60s (configurable)
6. Mounts `req.tenant = {id, name, slug, custom_domain, state, config}`
7. Returns **404** with structured JSON if no tenant found
8. Returns **503** if tenant state is `provisioning` or `suspended`

**Usage:**

```js
import { createTenantMiddleware, initTenantStore } from './tenant-middleware.js';
import express from 'express';

const app = express();

// Seed tenants
initTenantStore([
  {
    id: 't1',
    name: 'Acme Corp',
    slug: 'acme',
    custom_domain: 'shop.acme.com',
    state: 'active',
    config: { theme: 'default' },
  },
]);

app.use(createTenantMiddleware());

app.get('/', (req, res) => {
  res.json({ tenant: req.tenant });
});
```

**Cache:** 60s TTL by default. Disable with `createTenantMiddleware({ cache: false })`.
Custom TTL: `createTenantMiddleware({ cacheTtl: 30000 })`.

## Running Tests

```bash
cd infrastructure
npm install
node --test ../tests/test_infrastructure.mjs
```

All tests start the mock Cloudflare server, exercise the API wrapper and
middleware, then clean up.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | `test-token` | Cloudflare API token |
| `CF_API_BASE_URL` | `https://api.cloudflare.com/client/v4` | Base URL (set to mock server in tests) |
| `MOCK_CF_PORT` | `3099` | Port for mock server |
