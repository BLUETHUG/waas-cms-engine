-- =============================================================================
-- Migration 002: Create content_blocks table
-- Multi-tenant WaaS CMS - Phase 1
-- =============================================================================

-- =============================================================================
-- Table: content_blocks
-- Stores individual CMS content slots per tenant. Each row is a named slot
-- (e.g. 'hero', 'about', 'services', 'contact') that holds arbitrary JSON
-- content. Tenants see ONLY their own rows via Row-Level Security.
-- =============================================================================
CREATE TABLE IF NOT EXISTS content_blocks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slot_key        VARCHAR(255) NOT NULL,
    content_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    version         INTEGER NOT NULL DEFAULT 1,
    is_published    BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Indices
-- ---------------------------------------------------------------------------
-- (tenant_id, slot_key):  Composite unique — each tenant can only have one
--                         content block per slot_key. Also speeds up the most
--                         common query: "get all content for this tenant".
-- tenant_id:              Fast tenant-scoped lookups
-- slot_key:               Filtering by slot across tenants (admin only)
-- is_published:           Filtering published vs draft content
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_blocks_tenant_slot
    ON content_blocks (tenant_id, slot_key);

CREATE INDEX IF NOT EXISTS idx_content_blocks_tenant_id
    ON content_blocks (tenant_id);

CREATE INDEX IF NOT EXISTS idx_content_blocks_slot_key
    ON content_blocks (slot_key);

CREATE INDEX IF NOT EXISTS idx_content_blocks_is_published
    ON content_blocks (is_published);

-- Trigger to auto-update updated_at on row modification
DO $$ BEGIN
    CREATE TRIGGER trg_content_blocks_updated_at
        BEFORE UPDATE ON content_blocks
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
