# WaaS CMS Engine — Production Multi-Tenant Platform

A production-grade, white-label Multi-Tenant Website-as-a-Service (WaaS) CMS platform targeting Schools and Small Businesses.

## Architecture

```
waas-cms-engine/
├── database/          # PostgreSQL migrations with Row-Level Security
│   ├── 001_create_tenants.sql
│   ├── 002_create_content_blocks.sql
│   ├── 003_enable_rls.sql
│   └── seed.sql
├── infrastructure/    # Edge-network domain mapping & middleware
│   ├── cloudflare-hostnames.js
│   ├── mock-cloudflare-server.js
│   ├── tenant-middleware.js
│   └── package.json
├── ui-engine/         # Locked presentational engine
│   ├── component-registry.js
│   ├── layout-renderer.js
│   ├── schemas/
│   └── sample-data/
├── tests/             # Automated test suites
└── skills/            # Reusable Hermes skill configurations
```

## Core Principles

1. **Tenant Isolation** — Row-Level Security at the database level. No tenant can access another tenant's data.
2. **Locked Presentational Engine** — No raw HTML/JS execution. Strict JSON schema → hardcoded component mapping.
3. **Infrastructure Failure Recovery** — Idempotent retry policies, exponential backoffs, fallback subdomains.

## Quick Start

```bash
# Install infra dependencies
cd infrastructure && npm install && cd ..

# Run ALL tests
npm test

# Run individual test suites
npm run test:db       # RLS isolation test (Python)
npm run test:infra    # Infrastructure & middleware (Node)
npm run test:ui       # UI engine (Node)
```

## Technology Stack

- **Database:** PostgreSQL with Row-Level Security (RLS)
- **Edge DNS:** Cloudflare Custom Hostnames (SSL for SaaS)
- **Runtime:** Node.js 24+
- **Test Runners:** Python unittest, Node `--test`
