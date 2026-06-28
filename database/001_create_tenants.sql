-- =============================================================================
-- Migration 001: Create tenants table
-- Multi-tenant WaaS CMS - Phase 1
-- =============================================================================

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenant status enum
DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM (
        'provisioning',
        'active',
        'suspended',
        'deactivated'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Table: tenants
-- Core tenant entity. Every row represents an isolated customer (e.g. a school,
-- a cafe, a small business) whose content is invisible to all other tenants.
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL,
    status          tenant_status NOT NULL DEFAULT 'provisioning',
    custom_domain   VARCHAR(255),
    fallback_subdomain VARCHAR(255) NOT NULL,
    config_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
    activation_token UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Indices
-- ---------------------------------------------------------------------------
-- slug:           Used for subdomain-based routing and URL lookups
-- custom_domain:  Used for custom domain lookup at request time
-- fallback_subdomain: Used when no custom domain is configured
-- status:         Filtering active tenants, bulk operations, admin dashboards
-- activation_token: Secure one-time activation link lookups
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug
    ON tenants (slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_custom_domain
    ON tenants (custom_domain)
    WHERE custom_domain IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_fallback_subdomain
    ON tenants (fallback_subdomain);

CREATE INDEX IF NOT EXISTS idx_tenants_status
    ON tenants (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_activation_token
    ON tenants (activation_token);

-- Trigger to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER trg_tenants_updated_at
        BEFORE UPDATE ON tenants
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
