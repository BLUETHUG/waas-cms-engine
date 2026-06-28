# WaaS CMS — Database Schema & Row-Level Security

## Overview

This directory contains the PostgreSQL database schema and Row-Level Security
(RLS) layer for the multi-tenant WaaS (Website as a Service) CMS engine.

The design enables **full tenant isolation at the database level**: every query
is transparently scoped to the authenticated tenant, preventing accidental or
malicious cross-tenant data leaks. No application-level WHERE clauses needed.

## Schema Design

### 1. `tenants` — Customer/Tenant Registry

Each row represents an isolated customer (e.g. a school, a cafe, a business).
The table stores identity, routing, configuration, and lifecycle state.

| Column             | Type      | Description                                         |
|--------------------|-----------|-----------------------------------------------------|
| `id`               | UUID PK   | Primary identifier, used as the tenant context      |
| `name`             | varchar   | Display name (e.g. "Greenwood International School") |
| `slug`             | varchar   | URL-safe identifier (unique)                        |
| `status`           | enum      | provisioning / active / suspended / deactivated     |
| `custom_domain`    | varchar?  | Custom domain (e.g. www.greenwoodschool.edu)          |
| `fallback_subdomain` | varchar | Auto-generated subdomain (unique)                   |
| `config_payload`   | jsonb     | Tenant-specific configuration (branding, features)  |
| `activation_token` | uuid      | Secure one-time token for tenant activation         |
| `created_at`       | timestamptz | Row creation timestamp                            |
| `updated_at`       | timestamptz | Row last-modified timestamp                        |

### 2. `content_blocks` — Per-Tenant CMS Content

Each row is a named content slot (e.g. `hero`, `about`, `services`, `contact`)
for a specific tenant. Content is stored as free-form JSON.

| Column             | Type        | Description                                      |
|--------------------|-------------|--------------------------------------------------|
| `id`               | UUID PK     | Primary identifier                               |
| `tenant_id`        | UUID FK     | References `tenants(id)` with ON DELETE CASCADE  |
| `slot_key`         | varchar     | Content slot name (e.g. 'hero', 'about')         |
| `content_payload`  | jsonb       | Arbitrary content as JSON                        |
| `version`          | integer     | Incrementing version number (default: 1)         |
| `is_published`     | boolean     | Whether this content is live (default: false)    |
| `created_at`       | timestamptz | Row creation timestamp                           |
| `updated_at`       | timestamptz | Row last-modified timestamp                      |

**Composite unique index** on `(tenant_id, slot_key)` ensures each tenant can
have at most one content block per slot key.

## Row-Level Security (RLS) Approach

PostgreSQL RLS provides **mandatory access control** at the row level. Every
query is transparently filtered based on a session-level parameter.

### How It Works

1. **Session context**: The application sets a session parameter after
   authentication:
   ```sql
   SET app.current_tenant_id = '<tenant-uuid>';
   ```

2. **Helper function**: `app.current_tenant_id()` returns the UUID from the
   session setting (or NULL if not set).

3. **Policies**: Two RLS policies enforce isolation:
   - `tenants`: `USING (id = app.current_tenant_id())`
   - `content_blocks`: `USING (tenant_id = app.current_tenant_id())`

4. **Automatic filtering**: PostgreSQL applies these policies to every
   `SELECT`, `UPDATE`, `DELETE` — no application-level `WHERE` needed.

### Admin / Service Role Bypass

For migrations, seed scripts, and superadmin dashboards, a `service_role`
exists that bypasses RLS entirely:

```sql
SET ROLE service_role;
SELECT * FROM content_blocks;  -- all rows visible
```

Alternatively, a `/* BYPASS_RLS */` marker is recognized in the SQLite test
harness (conceptual equivalent for PostgreSQL: use `SET ROLE service_role`).

## How to Run Migrations

### Prerequisites

- PostgreSQL 15+ (for `uuid-ossp`, `pgcrypto`, and RLS features)
- `psql` client or a migration tool (e.g. Flyway, Sqitch, pgAdmin)

### Migration Order

Execute migrations in order:

```bash
# Using psql directly
psql -U admin -d waas_cms -f database/001_create_tenants.sql
psql -U admin -d waas_cms -f database/002_create_content_blocks.sql
psql -U admin -d waas_cms -f database/003_enable_rls.sql

# Seed with sample data (run as service_role to bypass RLS)
psql -U service_role -d waas_cms -f database/seed.sql
```

### Using with Flyway / Sqitch

Place migrations in your migration directory in order:

```
database/
├── 001_create_tenants.sql
├── 002_create_content_blocks.sql
├── 003_enable_rls.sql
└── seed.sql
```

## How to Verify Isolation

### PostgreSQL (Manual)

```sql
-- 1. Set context as Tenant A
SET app.current_tenant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
SELECT * FROM content_blocks;  -- Only Tenant A's blocks

-- 2. Set context as Tenant B
SET app.current_tenant_id = 'b0aebc99-9c0b-4ef8-bb6d-6bb9bd380b22';
SELECT * FROM content_blocks;  -- Only Tenant B's blocks

-- 3. Admin bypass (all rows)
SET ROLE service_role;
SELECT * FROM content_blocks;  -- All 5 blocks
```

### SQLite Test Harness (Automated)

A Python test harness simulates the RLS model in SQLite:

```bash
cd ~/waas-cms-engine
python tests/test_rls_isolation.py
```

The test harness:
1. Creates in-memory SQLite tables mirroring the PostgreSQL schema
2. Seeds Tenant A (Greenwood School) with 3 content blocks
3. Seeds Tenant B (Riverside Cafe) with 2 content blocks
4. Simulates tenant-context session switching via thread-local state
5. Asserts that each tenant sees ONLY their own content
6. Tests cross-context isolation (no data leakage between tenants)
7. Tests admin bypass (all rows visible without RLS filter)
8. Exits with code 0 on success, 1 on failure

## Files

| File                | Description                                          |
|---------------------|------------------------------------------------------|
| `001_create_tenants.sql` | Creates the `tenants` table with indices          |
| `002_create_content_blocks.sql` | Creates `content_blocks` table with indices |
| `003_enable_rls.sql` | Enables RLS, creates policies and helper functions   |
| `seed.sql`          | Sample data: 2 tenants, 5 content blocks total       |
| `README.md`         | This file                                            |

## Security Considerations

- **RLS is mandatory**: Both tables have `FORCE ROW LEVEL SECURITY` enabled,
  preventing even table owners from bypassing policies without `service_role`.
- **Parameterized queries**: Always use parameterized queries or the
  `app.current_tenant_id()` function — never interpolate tenant IDs directly
  into SQL.
- **Token activation**: The `activation_token` is a UUID generated with
  `gen_random_uuid()` and should be treated as a secret for tenant onboarding.
- **Connection pooling**: When using connection poolers (PgBouncer), use
  session-level pooling so `SET app.current_tenant_id` persists for the
  connection's lifetime.
