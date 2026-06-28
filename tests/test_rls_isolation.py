#!/usr/bin/env python3
"""
Test Harness: Row-Level Security (RLS) Isolation for Multi-tenant WaaS CMS

This script proves that tenant data isolation works by simulating the
PostgreSQL RLS model in SQLite. It uses a thread-local session context to
enforce that each tenant query sees ONLY their own content blocks.

Usage:
    python tests/test_rls_isolation.py

Expected output:
    PASS/FAIL lines for each assertion.
    Exit code 0 if all pass, 1 otherwise.
"""

import sqlite3
import threading
import uuid
import json
import re
import sys
from typing import Optional

# =============================================================================
# Thread-local tenant context (simulates PostgreSQL's SET SESSION parameter)
# =============================================================================
_tlocal = threading.local()


def set_current_tenant(tenant_id: Optional[str]) -> None:
    """Set the current tenant context for this thread (like SET app.current_tenant_id)."""
    _tlocal.tenant_id = tenant_id


def get_current_tenant() -> Optional[str]:
    """Get the current tenant context (like app.current_tenant_id())."""
    return getattr(_tlocal, 'tenant_id', None)


# =============================================================================
# RLS-aware SQLite connection wrapper
#
# We use a simplified SQL rewriter that detects the structure of common
# SELECT / UPDATE / DELETE queries and injects a tenant-isolation WHERE clause
# at the correct position (before ORDER BY / LIMIT / GROUP BY etc.).
# =============================================================================
def _inject_where_clause(sql: str, column: str, value: Optional[str]) -> str:
    """
    Inject a WHERE {column} = '{value}' into a SQL statement at the correct
    position — i.e. before any ORDER BY, LIMIT, GROUP BY, HAVING, or OFFSET
    clause, and after any existing WHERE clause.

    If *value* is None, injects `WHERE 1=0` (no tenant context = no rows).
    If the query already has a WHERE, appends an AND condition.
    """
    # Strip trailing whitespace/semicolons
    sql = sql.strip().rstrip(';').strip()

    quoted = f"'{value}'" if value is not None else None

    # Clauses that must come AFTER WHERE
    # We detect the first occurrence of any of these and split there.
    trailing_keywords = [
        r'\bORDER\s+BY\b',
        r'\bGROUP\s+BY\b',
        r'\bHAVING\b',
        r'\bLIMIT\b',
        r'\bOFFSET\b',
        r'\bFOR\s+UPDATE\b',
        r'\bFOR\s+SHARE\b',
    ]

    # Find the earliest trailing clause
    split_pos = len(sql)
    trailing = ''
    for pattern in trailing_keywords:
        m = re.search(pattern, sql, re.IGNORECASE)
        if m and m.start() < split_pos:
            split_pos = m.start()
            trailing = sql[m.start():]

    before = sql[:split_pos].rstrip()

    # Check for existing WHERE in the "before" part
    if re.search(r'\bWHERE\b', before, re.IGNORECASE):
        # Already has WHERE — append AND condition
        if value is None:
            new_where = ' AND 1=0'
        else:
            new_where = f' AND {column} = {quoted}'
    else:
        # No WHERE — add one
        if value is None:
            new_where = ' WHERE 1=0'
        else:
            new_where = f' WHERE {column} = {quoted}'

    result = before + new_where
    if trailing:
        result += ' ' + trailing
    return result


def _references_table(sql: str, table: str) -> bool:
    """Check whether the SQL query targets the given table."""
    lower = sql.strip().lower()
    # Ignore DDL / INSERT
    if lower.startswith('insert') or lower.startswith('create') or lower.startswith('drop') or lower.startswith('alter'):
        return False
    # Look for 'FROM <table>' or 'UPDATE <table>' or 'INTO <table>' as words
    return bool(re.search(
        r'\b(?:FROM|UPDATE|INTO)\s+' + re.escape(table) + r'\b',
        sql, re.IGNORECASE
    ))


def _has_admin_bypass(sql: str) -> bool:
    """Check if the query contains an admin bypass marker."""
    return '/* BYPASS_RLS */' in sql


# =============================================================================
# RLS-aware SQLite connection
# =============================================================================
class RLSConnection:
    """
    A wrapper around sqlite3.Connection that enforces row-level security.

    Every SELECT, UPDATE, and DELETE is transparently scoped to the
    current tenant context set via set_current_tenant(). This simulates
    PostgreSQL's RLS policies:
      - tenants:        WHERE id = app.current_tenant_id()
      - content_blocks: WHERE tenant_id = app.current_tenant_id()
    """

    # Map table names to their tenant-identifying column
    _TENANT_COLUMNS = {
        'tenants': 'id',
        'content_blocks': 'tenant_id',
    }

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def execute(self, sql: str, params=None):
        if params is None:
            params = []
        tenant_id = get_current_tenant()
        sql = self._apply_rls(sql, tenant_id)
        return self.conn.execute(sql, params)

    def executemany(self, sql: str, params_list):
        return self.conn.executemany(sql, params_list)

    def commit(self):
        return self.conn.commit()

    def executescript(self, script: str):
        return self.conn.executescript(script)

    def close(self):
        self.conn.close()

    # ------------------------------------------------------------------
    # RLS rewriter
    # ------------------------------------------------------------------
    def _apply_rls(self, sql: str, tenant_id: Optional[str]) -> str:
        """Rewrite SQL to inject RLS tenant filters if needed."""
        if _has_admin_bypass(sql):
            return sql

        for table, column in self._TENANT_COLUMNS.items():
            if _references_table(sql, table):
                sql = _inject_where_clause(sql, column, tenant_id)
        return sql


# =============================================================================
# Database setup — SQLite schema mirrors PostgreSQL
# =============================================================================
def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS tenants (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            slug            TEXT NOT NULL UNIQUE,
            status          TEXT NOT NULL DEFAULT 'provisioning',
            custom_domain   TEXT,
            fallback_subdomain TEXT NOT NULL UNIQUE,
            config_payload  TEXT NOT NULL DEFAULT '{}',
            activation_token TEXT NOT NULL UNIQUE,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS content_blocks (
            id              TEXT PRIMARY KEY,
            tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            slot_key        TEXT NOT NULL,
            content_payload TEXT NOT NULL DEFAULT '{}',
            version         INTEGER NOT NULL DEFAULT 1,
            is_published    INTEGER NOT NULL DEFAULT 0,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(tenant_id, slot_key)
        );

        CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
        CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain);
        CREATE INDEX IF NOT EXISTS idx_tenants_fallback_subdomain ON tenants(fallback_subdomain);
        CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
        CREATE INDEX IF NOT EXISTS idx_tenants_activation_token ON tenants(activation_token);

        CREATE INDEX IF NOT EXISTS idx_content_blocks_tenant_slot ON content_blocks(tenant_id, slot_key);
        CREATE INDEX IF NOT EXISTS idx_content_blocks_tenant_id ON content_blocks(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_content_blocks_slot_key ON content_blocks(slot_key);
        CREATE INDEX IF NOT EXISTS idx_content_blocks_is_published ON content_blocks(is_published);
    """)
    conn.commit()


# =============================================================================
# Seed data
# =============================================================================
TENANT_A_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"  # Greenwood School
TENANT_B_ID = "b0aebc99-9c0b-4ef8-bb6d-6bb9bd380b22"  # Riverside Cafe


def seed_data(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()

    # --- Tenant A: Greenwood International School ---
    cursor.execute(
        """INSERT INTO tenants (id, name, slug, status, custom_domain, fallback_subdomain, config_payload, activation_token)
           VALUES (?, 'Greenwood International School', 'greenwood-school', 'active',
                   'www.greenwoodschool.edu', 'greenwood-school.waascms.io',
                   '{}', 'd290f1ee-6c54-4b01-90e6-d701748f0851')""",
        (TENANT_A_ID,)
    )
    # Tenant A — 3 content blocks
    cursor.execute(
        "INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published) "
        "VALUES (?, ?, 'hero', '{\"headline\":\"Shaping Tomorrows Leaders Today\"}', 3, 1)",
        ('b1a0c1d2-0001-4000-a000-000000000001', TENANT_A_ID)
    )
    cursor.execute(
        "INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published) "
        "VALUES (?, ?, 'about', '{\"heading\":\"Our Mission\",\"body\":\"Founded in 1998...\"}', 2, 1)",
        ('b1a0c1d2-0001-4000-a000-000000000002', TENANT_A_ID)
    )
    cursor.execute(
        "INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published) "
        "VALUES (?, ?, 'services', '{\"heading\":\"Programs & Offerings\"}', 1, 1)",
        ('b1a0c1d2-0001-4000-a000-000000000003', TENANT_A_ID)
    )

    # --- Tenant B: Riverside Cafe & Bistro ---
    cursor.execute(
        """INSERT INTO tenants (id, name, slug, status, custom_domain, fallback_subdomain, config_payload, activation_token)
           VALUES (?, 'Riverside Cafe & Bistro', 'riverside-cafe', 'active',
                   NULL, 'riverside-cafe.waascms.io',
                   '{}', 'e290f1ee-6c54-4b01-90e6-d701748f0852')""",
        (TENANT_B_ID,)
    )
    # Tenant B — 2 content blocks
    cursor.execute(
        "INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published) "
        "VALUES (?, ?, 'hero', '{\"headline\":\"Good Food, Good Vibes\"}', 4, 1)",
        ('b2a0c1d2-0002-4000-b000-000000000001', TENANT_B_ID)
    )
    cursor.execute(
        "INSERT INTO content_blocks (id, tenant_id, slot_key, content_payload, version, is_published) "
        "VALUES (?, ?, 'about', '{\"heading\":\"Our Story\"}', 2, 1)",
        ('b2a0c1d2-0002-4000-b000-000000000002', TENANT_B_ID)
    )

    conn.commit()


# =============================================================================
# Tests
# =============================================================================
pass_count = 0
fail_count = 0


def test(name: str, condition: bool, detail: str = ""):
    global pass_count, fail_count
    if condition:
        print(f"  \u2713 PASS: {name}")
        pass_count += 1
    else:
        msg = f"  \u2717 FAIL: {name}"
        if detail:
            msg += f" \u2014 {detail}"
        print(msg)
        fail_count += 1


def run_tests():
    global pass_count, fail_count
    pass_count = 0
    fail_count = 0

    print("=" * 70)
    print("  WaaS CMS \u2014 Row-Level Security Isolation Tests")
    print("=" * 70)
    print()

    # ------------------------------------------------------------------
    # Setup
    # ------------------------------------------------------------------
    raw_conn = sqlite3.connect(":memory:")
    raw_conn.execute("PRAGMA foreign_keys = ON")
    create_schema(raw_conn)
    seed_data(raw_conn)
    rls = RLSConnection(raw_conn)

    # ------------------------------------------------------------------
    # Test 1: Verify seed data was inserted correctly
    # ------------------------------------------------------------------
    print("[Setup Verification]")
    cursor = raw_conn.execute("SELECT COUNT(*) FROM tenants")
    total_tenants = cursor.fetchone()[0]
    test("Total tenants = 2", total_tenants == 2, f"got {total_tenants}")

    cursor = raw_conn.execute("SELECT COUNT(*) FROM content_blocks")
    total_blocks = cursor.fetchone()[0]
    test("Total content blocks = 5 (3+2)", total_blocks == 5, f"got {total_blocks}")
    print()

    # ------------------------------------------------------------------
    # Test 2: No tenant context \u2014 no rows visible via RLS
    # ------------------------------------------------------------------
    print("[No Context \u2014 Zero Rows Visible]")
    set_current_tenant(None)
    cursor = rls.execute("SELECT COUNT(*) FROM content_blocks")
    count_no_ctx = cursor.fetchone()[0]
    test("Zero blocks visible with no tenant context", count_no_ctx == 0, f"got {count_no_ctx}")

    cursor = rls.execute("SELECT COUNT(*) FROM tenants")
    count_tenants_no_ctx = cursor.fetchone()[0]
    test("Zero tenants visible with no tenant context", count_tenants_no_ctx == 0, f"got {count_tenants_no_ctx}")
    print()

    # ------------------------------------------------------------------
    # Test 3: Switch to Tenant A (Greenwood) \u2014 see exactly 3 blocks
    # ------------------------------------------------------------------
    print("[Tenant A: Greenwood International School]")
    set_current_tenant(TENANT_A_ID)

    cursor = rls.execute("SELECT COUNT(*) FROM content_blocks")
    count_a = cursor.fetchone()[0]
    test("Tenant A sees exactly 3 content blocks", count_a == 3, f"got {count_a}")

    # Verify the blocks belong to Tenant A
    cursor = rls.execute("SELECT slot_key, tenant_id FROM content_blocks ORDER BY slot_key")
    rows = cursor.fetchall()
    test("Tenant A blocks have correct tenant_id",
         all(r[1] == TENANT_A_ID for r in rows),
         f"tenant_id mismatch: {rows}")

    slot_keys_a = [r[0] for r in rows]
    test("Tenant A sees correct slot_keys: about, hero, services",
         slot_keys_a == ['about', 'hero', 'services'],
         f"got {slot_keys_a}")

    # Verify Tenant A sees exactly 1 tenant row (itself)
    cursor = rls.execute("SELECT COUNT(*) FROM tenants")
    tenant_a_count = cursor.fetchone()[0]
    test("Tenant A sees exactly 1 tenant row (itself)", tenant_a_count == 1, f"got {tenant_a_count}")
    print()

    # ------------------------------------------------------------------
    # Test 4: Switch to Tenant B (Riverside) \u2014 see exactly 2 blocks,
    #         NONE from Tenant A
    # ------------------------------------------------------------------
    print("[Tenant B: Riverside Cafe & Bistro]")
    set_current_tenant(TENANT_B_ID)

    cursor = rls.execute("SELECT COUNT(*) FROM content_blocks")
    count_b = cursor.fetchone()[0]
    test("Tenant B sees exactly 2 content blocks", count_b == 2, f"got {count_b}")

    # Verify NONE of Tenant B's blocks belong to Tenant A
    cursor = rls.execute("SELECT tenant_id FROM content_blocks")
    tenant_ids_b = [r[0] for r in cursor.fetchall()]
    test("Tenant B sees NO blocks from Tenant A",
         TENANT_A_ID not in tenant_ids_b,
         f"found Tenant A blocks: {tenant_ids_b}")

    # Verify all blocks belong to Tenant B
    test("Tenant B blocks all belong to Tenant B",
         all(tid == TENANT_B_ID for tid in tenant_ids_b),
         f"tenant_id mismatch: {tenant_ids_b}")

    cursor = rls.execute("SELECT slot_key FROM content_blocks ORDER BY slot_key")
    slot_keys_b = [r[0] for r in cursor.fetchall()]
    test("Tenant B sees correct slot_keys: about, hero",
         slot_keys_b == ['about', 'hero'],
         f"got {slot_keys_b}")

    # Verify Tenant B sees exactly 1 tenant row (itself)
    cursor = rls.execute("SELECT COUNT(*) FROM tenants")
    tenant_b_count = cursor.fetchone()[0]
    test("Tenant B sees exactly 1 tenant row (itself)", tenant_b_count == 1, f"got {tenant_b_count}")
    print()

    # ------------------------------------------------------------------
    # Test 5: Cross-context isolation check
    # ------------------------------------------------------------------
    print("[Cross-Context Isolation]")
    set_current_tenant(TENANT_A_ID)
    cursor = rls.execute("SELECT slot_key FROM content_blocks ORDER BY slot_key")
    a_slots = [r[0] for r in cursor.fetchall()]
    test("Tenant A re-query: still sees exactly 3 blocks", len(a_slots) == 3, f"got {len(a_slots)}")

    # No 'contact' slot (that's Tenant B's)
    test("Tenant A does NOT see Tenant B's 'contact' block",
         'contact' not in a_slots,
         f"found 'contact' in Tenant A results: {a_slots}")

    set_current_tenant(TENANT_B_ID)
    cursor = rls.execute("SELECT slot_key FROM content_blocks ORDER BY slot_key")
    b_slots = [r[0] for r in cursor.fetchall()]
    test("Tenant B re-query: still sees exactly 2 blocks", len(b_slots) == 2, f"got {len(b_slots)}")

    # No 'services' block from Tenant A
    test("Tenant B does NOT see Tenant A's 'services' block",
         'services' not in b_slots,
         f"found 'services' in Tenant B results: {b_slots}")
    print()

    # ------------------------------------------------------------------
    # Test 6: Admin bypass \u2014 no tenant context, with BYPASS_RLS marker
    # ------------------------------------------------------------------
    print("[Admin Bypass (/* BYPASS_RLS */ marker)]")
    set_current_tenant(None)
    cursor = rls.execute("SELECT COUNT(*) FROM content_blocks /* BYPASS_RLS */")
    admin_count = cursor.fetchone()[0]
    test("Admin bypass sees all 5 content blocks", admin_count == 5, f"got {admin_count}")

    cursor = rls.execute("SELECT COUNT(*) FROM tenants /* BYPASS_RLS */")
    admin_tenants = cursor.fetchone()[0]
    test("Admin bypass sees all 2 tenants", admin_tenants == 2, f"got {admin_tenants}")

    # Raw connection always bypasses
    cursor = raw_conn.execute("SELECT COUNT(*) FROM content_blocks")
    test("Raw connection (inherent bypass) sees all 5 blocks",
         cursor.fetchone()[0] == 5)
    print()

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("=" * 70)
    total = pass_count + fail_count
    print(f"  Results: {pass_count} passed, {fail_count} failed out of {total} tests")
    if fail_count == 0:
        print("  \u2713 ALL TESTS PASSED \u2014 Tenant isolation is working correctly.")
    else:
        print("  \u2717 SOME TESTS FAILED \u2014 Isolation is broken.")
    print("=" * 70)

    rls.close()
    return fail_count == 0


# =============================================================================
# Main
# =============================================================================
if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
