-- Mya's World — Customer Names Table
-- Migration: 0002_mya_customers

CREATE TABLE IF NOT EXISTS mya_customers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name   TEXT NOT NULL,
    display_name    TEXT,
    email           TEXT,
    registered_at   TEXT NOT NULL DEFAULT (datetime('now')),
    source          TEXT DEFAULT 'mya-page',       -- 'mya-page', 'api', 'manual'
    fortnite_tag    TEXT,                           -- gamer tag
    favourite_skin  TEXT,
    age_verified    INTEGER DEFAULT 0,             -- COPPA: 0=unverified, 1=parent-verified
    parent_email    TEXT,                           -- for COPPA compliance
    consent_given   INTEGER DEFAULT 0,             -- explicit consent flag
    data_deleted    INTEGER DEFAULT 0,             -- right to deletion flag
    agent_id        TEXT REFERENCES agents(id)      -- which agent registered them
);

-- Legal compliance logging
CREATE TABLE IF NOT EXISTS mya_consent_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     INTEGER REFERENCES mya_customers(id),
    action          TEXT NOT NULL,                  -- 'consent_given', 'consent_revoked', 'data_request', 'data_deleted'
    details         TEXT,
    logged_at       TEXT NOT NULL DEFAULT (datetime('now')),
    ip_hash         TEXT,
    agent_id        TEXT
);

CREATE INDEX IF NOT EXISTS idx_mya_customers_email ON mya_customers(email);
CREATE INDEX IF NOT EXISTS idx_mya_consent_customer ON mya_consent_log(customer_id);
