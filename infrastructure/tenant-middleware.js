// ---------------------------------------------------------------------------
// Multi-Tenant Request Middleware
// ---------------------------------------------------------------------------
// Intercepts incoming request hostname, resolves the tenant, and mounts
// req.tenant on the request lifecycle.
//
// Features:
//   - Hostname sanitization (lowercase, strip port, strip www., validate)
//   - In-memory cache with 60s TTL
//   - Tenant lookup by custom domain or slug.ourdomain.com subdomain
//   - Returns 404 if no tenant found
//   - Returns 503 if tenant is provisioning or suspended
// ---------------------------------------------------------------------------

import { setTimeout as sleep } from 'timers/promises';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60_000;
const OUR_DOMAIN = 'ourdomain.com';

// Valid hostname pattern (RFC 952 / RFC 1123-ish, with support for wildcard
// but we only accept plain hostnames here).
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

// ---------------------------------------------------------------------------
// In-memory tenant store + cache
// ---------------------------------------------------------------------------
// In a production system this would be backed by a DB; here we provide a
// simple mutable store that can be populated for testing.
const tenantStore = new Map();   // hostname -> tenant record
const subdomainStore = new Map(); // slug -> tenant record
const cache = new Map();         // sanitized hostname -> { tenant, expiresAt }

let storeInitialized = false;

/**
 * Initialize the tenant store with a set of tenants.
 * Each tenant: { id, name, slug, custom_domain, state, config }
 */
export function initTenantStore(tenants) {
  tenantStore.clear();
  subdomainStore.clear();
  cache.clear();

  for (const t of tenants) {
    if (t.custom_domain) {
      const key = sanitizeHostname(t.custom_domain);
      tenantStore.set(key, t);
    }
    if (t.slug) {
      subdomainStore.set(t.slug, t);
    }
  }

  storeInitialized = true;
}

/**
 * Add or update a single tenant at runtime.
 */
export function upsertTenant(tenant) {
  if (tenant.custom_domain) {
    const key = sanitizeHostname(tenant.custom_domain);
    tenantStore.set(key, tenant);
  }
  if (tenant.slug) {
    subdomainStore.set(tenant.slug, tenant);
  }
  // Bust cache entries that might reference this tenant
  for (const [cachedHost, entry] of cache) {
    if (entry.tenant.id === tenant.id) {
      cache.delete(cachedHost);
    }
  }
}

/**
 * Remove a tenant.
 */
export function removeTenant(tenantId) {
  for (const [host, t] of tenantStore) {
    if (t.id === tenantId) {
      tenantStore.delete(host);
    }
  }
  for (const [slug, t] of subdomainStore) {
    if (t.id === tenantId) {
      subdomainStore.delete(slug);
    }
  }
  for (const [cachedHost, entry] of cache) {
    if (entry.tenant.id === tenantId) {
      cache.delete(cachedHost);
    }
  }
}

// ---------------------------------------------------------------------------
// Hostname sanitization
// ---------------------------------------------------------------------------
export function sanitizeHostname(rawHostname) {
  if (!rawHostname || typeof rawHostname !== 'string') {
    return '';
  }

  let hostname = rawHostname.trim().toLowerCase();

  // Strip port (e.g., "example.com:8080" → "example.com")
  hostname = hostname.replace(/:\d+$/, '');

  // Strip leading www.
  hostname = hostname.replace(/^www\./, '');

  return hostname;
}

export function isValidHostname(hostname) {
  return HOSTNAME_RE.test(hostname) && hostname.length > 0;
}

// ---------------------------------------------------------------------------
// Tenant resolution
// ---------------------------------------------------------------------------
function lookupTenantByHostname(sanitizedHostname) {
  // 1. Direct match in tenant store (custom domain)
  if (tenantStore.has(sanitizedHostname)) {
    return tenantStore.get(sanitizedHostname);
  }

  // 2. Check slug.ourdomain.com subdomain pattern
  const ourDomainSuffix = `.${OUR_DOMAIN}`;
  if (sanitizedHostname.endsWith(ourDomainSuffix)) {
    const slug = sanitizedHostname.slice(0, -ourDomainSuffix.length);
    if (slug && subdomainStore.has(slug)) {
      return subdomainStore.get(slug);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------
export function createTenantMiddleware(options = {}) {
  const cacheTtl = options.cacheTtl || CACHE_TTL_MS;
  const enableCache = options.cache !== false;

  return function tenantMiddleware(req, res, next) {
    // --- Sanitize ---
    const rawHostname = req.headers['host'] || req.hostname || '';
    const sanitized = sanitizeHostname(rawHostname);

    if (!sanitized || !isValidHostname(sanitized)) {
      return res.status(404).json({
        error: 'TenantNotFound',
        message: 'No valid hostname could be resolved.',
      });
    }

    // --- Check cache ---
    if (enableCache && cache.has(sanitized)) {
      const cached = cache.get(sanitized);
      if (cached.expiresAt > Date.now()) {
        const tenant = cached.tenant;

        // Check state
        if (tenant.state === 'provisioning' || tenant.state === 'suspended') {
          return res.status(503).json({
            error: 'TenantUnavailable',
            message: `Tenant '${tenant.name}' is currently ${tenant.state}. Please try again later.`,
            tenantState: tenant.state,
          });
        }

        req.tenant = tenant;
        return next();
      }
      // Expired
      cache.delete(sanitized);
    }

    // --- Resolve tenant ---
    const tenant = lookupTenantByHostname(sanitized);

    if (!tenant) {
      return res.status(404).json({
        error: 'TenantNotFound',
        message: `No tenant found for hostname '${sanitized}'.`,
      });
    }

    // --- Cache the result ---
    if (enableCache) {
      cache.set(sanitized, {
        tenant,
        expiresAt: Date.now() + cacheTtl,
      });
    }

    // --- Check tenant state ---
    if (tenant.state === 'provisioning' || tenant.state === 'suspended') {
      return res.status(503).json({
        error: 'TenantUnavailable',
        message: `Tenant '${tenant.name}' is currently ${tenant.state}. Please try again later.`,
        tenantState: tenant.state,
      });
    }

    req.tenant = tenant;
    next();
  };
}

// ---------------------------------------------------------------------------
// Default export: a pre-built middleware with an empty store.
// Call initTenantStore() before use, or use createTenantMiddleware().
// ---------------------------------------------------------------------------
const defaultMiddleware = createTenantMiddleware();
export default defaultMiddleware;
