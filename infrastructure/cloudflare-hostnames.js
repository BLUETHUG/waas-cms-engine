// ---------------------------------------------------------------------------
// Cloudflare Custom Hostnames API Wrapper (SSL for SaaS)
// ---------------------------------------------------------------------------
// Robust, fault-tolerant module with:
//   - Retry with exponential backoff
//   - Idempotency (409 Conflict → lookup & return existing)
//   - Error classification (429 → retry, 4xx → throw, 5xx → retry)
//   - 30s request timeout
//   - SSL verification failure → structured fallback suggestion
// ---------------------------------------------------------------------------

import axios from 'axios';
import https from 'https';
import { setTimeout as sleep } from 'timers/promises';

// ---------------------------------------------------------------------------
// Configuration defaults
// ---------------------------------------------------------------------------
const DEFAULTS = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 10000,
  requestTimeoutMs: 30000,
};

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------
class CloudflareError extends Error {
  constructor(message, { status, statusText, data, code, type }) {
    super(message);
    this.name = 'CloudflareError';
    this.status = status;
    this.statusText = statusText;
    this.responseData = data;
    this.cloudflareCode = code;
    this.errorType = type; // 'rate_limited' | 'client_error' | 'server_error' | 'timeout' | 'network'
  }
}

function classifyError(error) {
  if (error.response) {
    const status = error.response.status;
    if (status === 429) {
      return new CloudflareError('Rate limited by Cloudflare API', {
        status,
        statusText: error.response.statusText,
        data: error.response.data,
        type: 'rate_limited',
      });
    }
    if (status >= 400 && status < 500) {
      return new CloudflareError(`Client error: ${error.response.status} ${error.response.statusText}`, {
        status,
        statusText: error.response.statusText,
        data: error.response.data,
        type: 'client_error',
      });
    }
    if (status >= 500) {
      return new CloudflareError(`Server error: ${error.response.status} ${error.response.statusText}`, {
        status,
        statusText: error.response.statusText,
        data: error.response.data,
        type: 'server_error',
      });
    }
  }

  if (error.code === 'ECONNABORTED') {
    return new CloudflareError('Request timed out', {
      status: 0,
      data: null,
      type: 'timeout',
    });
  }

  return new CloudflareError(`Network error: ${error.message}`, {
    status: 0,
    data: null,
    type: 'network',
  });
}

function isRetryable(error) {
  return error.errorType === 'rate_limited'
    || error.errorType === 'server_error'
    || error.errorType === 'timeout'
    || error.errorType === 'network';
}

// ---------------------------------------------------------------------------
// Exponential backoff
// ---------------------------------------------------------------------------
function calculateBackoff(attempt, config) {
  const delay = Math.min(
    config.initialBackoffMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxBackoffMs
  );
  // Add jitter ±25% to avoid thundering herd
  const jitter = delay * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

// ---------------------------------------------------------------------------
// Minimal in-memory lookup for idempotency
// When we get a 409, we attempt to look up the existing hostname record
// so we can return it instead of throwing.
// ---------------------------------------------------------------------------
async function lookupHostnameByHostname(httpClient, zoneId, hostname) {
  try {
    const resp = await httpClient.get(
      `/zones/${zoneId}/custom_hostnames`,
      { params: { hostname } }
    );
    const records = resp.data?.result ?? [];
    return records.find(r => r.hostname === hostname) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Structured result helpers
// ---------------------------------------------------------------------------
function successResult(data) {
  return { success: true, data, error: null };
}

function errorResult(error, extra = null) {
  return {
    success: false,
    data: extra,
    error: {
      message: error.message,
      status: error.status || 0,
      type: error.errorType || 'unknown',
      cloudflareCode: error.cloudflareCode || null,
      responseData: error.responseData || null,
      ...(extra ? { fallback: extra } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Fallback suggestion for SSL failures
// ---------------------------------------------------------------------------
function buildSslFallback(hostname) {
  // Extract tenant slug from custom domain, or generate a fallback
  const slug = hostname
    .replace(/^www\./i, '')
    .split('.')[0]
    .toLowerCase();
  return {
    suggestedFallback: `${slug}.ourdomain.com`,
    message: `SSL verification for ${hostname} failed. ` +
      `Use the tenant subdomain ${slug}.ourdomain.com as a temporary fallback.`,
    sslStatus: 'failed',
  };
}

// ---------------------------------------------------------------------------
// Axios client factory
// ---------------------------------------------------------------------------
function createClient(apiToken, config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  const client = axios.create({
    baseURL: cfg.baseURL || 'https://api.cloudflare.com/client/v4',
    timeout: cfg.requestTimeoutMs,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    httpsAgent: new https.Agent({ keepAlive: true }),
  });

  return { client, config: cfg };
}

// ---------------------------------------------------------------------------
// createCustomHostname(zoneId, hostname, sslMethod)
// ---------------------------------------------------------------------------
export async function createCustomHostname(zoneId, hostname, sslMethod = 'http') {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'test-token';
  const configOverrides = {};
  if (process.env.CF_API_BASE_URL) {
    configOverrides.baseURL = process.env.CF_API_BASE_URL;
  }

  const { client, config } = createClient(apiToken, configOverrides);

  const payload = {
    hostname,
    ssl: {
      method: sslMethod,
      type: 'dv',
    },
  };

  let lastError = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await client.post(
        `/zones/${zoneId}/custom_hostnames`,
        payload
      );

      const record = response.data?.result ?? response.data;
      return successResult(record);
    } catch (rawError) {
      const cfError = classifyError(rawError);

      // --- Idempotency: 409 Conflict → lookup existing ---
      if (rawError.response && rawError.response.status === 409) {
        const existing = await lookupHostnameByHostname(client, zoneId, hostname);
        if (existing) {
          return successResult({
            ...existing,
            _note: 'Hostname already existed; returned existing record.',
          });
        }
        // If lookup fails, treat as client error
        return errorResult(cfError);
      }

      // --- SSL failure → structured fallback ---
      const responseBody = rawError.response?.data;
      if (
        responseBody &&
        (
          (responseBody.errors && responseBody.errors.some(e =>
            /ssl|certificate|verification/i.test(e.message || e.code)
          )) ||
          (responseBody.error && /ssl|certificate|verification/i.test(responseBody.error))
        )
      ) {
        const fallback = buildSslFallback(hostname);
        return errorResult(cfError, fallback);
      }

      // --- Non-retryable client errors ---
      if (cfError.errorType === 'client_error') {
        return errorResult(cfError);
      }

      // --- Retryable errors ---
      if (isRetryable(cfError) && attempt < config.maxRetries) {
        lastError = cfError;
        const backoff = calculateBackoff(attempt, config);
        await sleep(backoff);
        continue;
      }

      // --- Out of retries ---
      lastError = cfError;
    }
  }

  return errorResult(lastError || new Error('Max retries exceeded'));
}

// ---------------------------------------------------------------------------
// deleteCustomHostname(zoneId, hostnameId)
// ---------------------------------------------------------------------------
export async function deleteCustomHostname(zoneId, hostnameId) {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'test-token';
  const configOverrides = {};
  if (process.env.CF_API_BASE_URL) {
    configOverrides.baseURL = process.env.CF_API_BASE_URL;
  }

  const { client, config } = createClient(apiToken, configOverrides);

  let lastError = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      await client.delete(`/zones/${zoneId}/custom_hostnames/${hostnameId}`);
      return successResult({ deleted: true, hostnameId });
    } catch (rawError) {
      const cfError = classifyError(rawError);

      // 404 means already deleted — treat as success (idempotent)
      if (rawError.response && rawError.response.status === 404) {
        return successResult({ deleted: true, hostnameId, _note: 'Already deleted.' });
      }

      if (cfError.errorType === 'client_error') {
        return errorResult(cfError);
      }

      if (isRetryable(cfError) && attempt < config.maxRetries) {
        lastError = cfError;
        const backoff = calculateBackoff(attempt, config);
        await sleep(backoff);
        continue;
      }

      lastError = cfError;
    }
  }

  return errorResult(lastError || new Error('Max retries exceeded'));
}

// ---------------------------------------------------------------------------
// getCustomHostnameStatus(zoneId, hostnameId)
// ---------------------------------------------------------------------------
export async function getCustomHostnameStatus(zoneId, hostnameId) {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'test-token';
  const configOverrides = {};
  if (process.env.CF_API_BASE_URL) {
    configOverrides.baseURL = process.env.CF_API_BASE_URL;
  }

  const { client, config } = createClient(apiToken, configOverrides);

  let lastError = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await client.get(
        `/zones/${zoneId}/custom_hostnames/${hostnameId}`
      );
      const record = response.data?.result ?? response.data;
      return successResult(record);
    } catch (rawError) {
      const cfError = classifyError(rawError);

      if (cfError.errorType === 'client_error') {
        return errorResult(cfError);
      }

      if (isRetryable(cfError) && attempt < config.maxRetries) {
        lastError = cfError;
        const backoff = calculateBackoff(attempt, config);
        await sleep(backoff);
        continue;
      }

      lastError = cfError;
    }
  }

  return errorResult(lastError || new Error('Max retries exceeded'));
}
