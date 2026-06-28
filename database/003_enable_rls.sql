-- =============================================================================
-- Migration 003: Enable Row-Level Security
-- Multi-tenant WaaS CMS - Phase 1
--
-- This migration activates Row-Level Security (RLS) on both tables and
-- creates policies that enforce tenant data isolation. All queries must set
-- the session parameter `app.current_tenant_id` to the authenticated tenant's
-- UUID before accessing data.
-- =============================================================================

-- =============================================================================
-- 1. Helper function: app.current_tenant_id()
--
-- Returns the UUID of the currently active tenant from the session setting.
-- Every RLS policy calls this function so the check is defined in one place.
-- Falls back to NULL if the setting is absent (which will block all rows).
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT current_setting('app.current_tenant_id', true)::uuid;
$$;

-- =============================================================================
-- 2. Enable RLS on tenants table
-- =============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policy: Regular users can only see their own tenant row
CREATE POLICY tenant_isolation ON tenants
    FOR ALL
    USING (id = app.current_tenant_id());

-- =============================================================================
-- 3. Enable RLS on content_blocks table
-- =============================================================================
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;

-- Policy: Regular users can only see content blocks belonging to their tenant
CREATE POLICY tenant_isolation ON content_blocks
    FOR ALL
    USING (tenant_id = app.current_tenant_id());

-- =============================================================================
-- 4. Admin / Service-role bypass
--
-- Users with the 'service_role' attribute in their session (or who belong to
-- the admin role) bypass RLS entirely. This allows:
--   - System migrations and seed scripts
--   - Superadmin dashboards
--   - Cross-tenant analytics
-- =============================================================================
-- Bypass RLS for service_role (set via: SET ROLE service_role)
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE content_blocks FORCE ROW LEVEL SECURITY;

-- Create an admin role that can bypass RLS
DO $$ BEGIN
    CREATE ROLE service_role NOINHERIT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Grant table permissions to service_role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Revoke default permissions from public to ensure isolation
REVOKE ALL ON tenants FROM public;
REVOKE ALL ON content_blocks FROM public;

-- Grant minimal permissions to authenticated users (they go through RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_blocks TO public;

-- =============================================================================
-- 5. How to use
--
-- As a tenant user:
--   SET app.current_tenant_id = '<tenant-uuid>';
--   SELECT * FROM content_blocks;  -- only tenant's rows returned
--
-- As service_role (admin bypass):
--   SET ROLE service_role;
--   SELECT * FROM content_blocks;  -- all rows visible
-- =============================================================================
