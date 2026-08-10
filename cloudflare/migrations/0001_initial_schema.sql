-- Vistamations Agent Memory — D1 Schema v1
-- Cloudflare D1 (SQLite-compatible)
-- Migration: 0001_initial_schema

-- ─── Agents — persona registry ───
CREATE TABLE IF NOT EXISTS agents (
    id              TEXT PRIMARY KEY,           -- org-AG###-base-env
    agent_id        TEXT NOT NULL,              -- AG###
    name            TEXT NOT NULL,              -- canonical name
    cluster         TEXT NOT NULL DEFAULT 'base-env',
    domain          TEXT NOT NULL,
    persona_json    TEXT,                       -- full persona blob (JSON)
    model           TEXT,                       -- assigned LLM model
    status          TEXT NOT NULL DEFAULT 'active', -- active|idle|offline|archived
    memory_score    INTEGER DEFAULT 0,          -- /100 self-assessed
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    always_on_call  INTEGER DEFAULT 0           -- boolean
);

-- ─── Agent Memory — key-value with vector metadata ───
CREATE TABLE IF NOT EXISTS agent_memory (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    memory_key      TEXT NOT NULL,              -- e.g. 'preference:genre', 'fact:project'
    memory_value    TEXT NOT NULL,              -- JSON or plaintext
    memory_type     TEXT NOT NULL DEFAULT 'fact', -- fact|preference|decision|observation|correction
    confidence      REAL DEFAULT 1.0,           -- 0.0-1.0
    source          TEXT,                       -- where this memory came from
    embedding_ref   TEXT,                       -- pointer to external vector store if used
    cluster_label   TEXT,                       -- vector cluster label for retrieval
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(agent_id, memory_key)
);

-- ─── Sessions — agent interaction tracking ───
CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,           -- ses_xxx format
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at        TEXT,
    summary         TEXT,                       -- LLM-generated summary
    message_count   INTEGER DEFAULT 0,
    tokens_used     INTEGER DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active' -- active|completed|interrupted
);

-- ─── Music Plays — gem / media player tracking ───
CREATE TABLE IF NOT EXISTS music_plays (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    track_title     TEXT,
    track_artist    TEXT,
    source          TEXT,                       -- 'local', 'suno', 'youtube', etc.
    url             TEXT,
    played_at       TEXT NOT NULL DEFAULT (datetime('now')),
    duration_sec    INTEGER,
    completed       INTEGER DEFAULT 0,          -- boolean: did it finish?
    liked           INTEGER,                    -- null=no rating, 0=dislike, 1=like
    genre_tags      TEXT,                       -- JSON array of tags
    agent_id        TEXT REFERENCES agents(id), -- which agent tracked it (gem)
    session_id      TEXT REFERENCES sessions(id)
);

-- ─── Research Findings — Google Docs reader / web search results ───
CREATE TABLE IF NOT EXISTS research_findings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type     TEXT NOT NULL,              -- 'google_docs', 'web_search', 'suno_scrape'
    source_name     TEXT,                       -- doc name or URL
    source_id       TEXT,                       -- Google doc ID or URL hash
    category        TEXT NOT NULL,              -- 'ADK', 'RAG', 'Gemini', 'Suno', etc.
    relevance_score INTEGER DEFAULT 0,
    summary         TEXT NOT NULL,
    keywords        TEXT,                       -- JSON array
    full_text_hash  TEXT,                       -- SHA256 for dedup
    reported_to     TEXT,                       -- 'olivia', 'command-portal', etc.
    discovered_at   TEXT NOT NULL DEFAULT (datetime('now')),
    agent_id        TEXT REFERENCES agents(id)
);

-- ─── Vector Clusters — metadata for vector mapping (no embeddings stored, just pointers) ───
CREATE TABLE IF NOT EXISTS vector_clusters (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cluster_label   TEXT NOT NULL UNIQUE,       -- 'neo-classical-shred', 'adk-patterns', etc.
    description     TEXT,
    centroid_ref    TEXT,                       -- pointer to external vector store centroid
    member_count    INTEGER DEFAULT 0,
    boundary_radius REAL,                       -- cluster boundary in embedding space
    parent_cluster  TEXT REFERENCES vector_clusters(cluster_label),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    refined_at      TEXT                        -- last boundary refinement
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_key ON agent_memory(memory_key);
CREATE INDEX IF NOT EXISTS idx_agent_memory_cluster ON agent_memory(cluster_label);
CREATE INDEX IF NOT EXISTS idx_music_plays_agent ON music_plays(agent_id);
CREATE INDEX IF NOT EXISTS idx_music_plays_date ON music_plays(played_at);
CREATE INDEX IF NOT EXISTS idx_research_category ON research_findings(category);
CREATE INDEX IF NOT EXISTS idx_research_hash ON research_findings(full_text_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id);

-- ─── Seed data: Dominion I agents ───
INSERT OR IGNORE INTO agents (id, agent_id, name, cluster, domain, model, status, always_on_call) VALUES
    ('org-AG001-base-env', 'AG001', 'Gordon', 'base-env', 'Chief Hub Agent', 'DeepSeek V4 Pro', 'active', 0),
    ('org-AG002-base-env', 'AG002', 'Trinity', 'base-env', 'Apprentice Systems Engineer', 'DeepSeek V4 Pro', 'active', 0),
    ('org-AG003-base-env', 'AG003', 'Merlin V.II', 'base-env', 'Wizard Guide', 'DeepSeek V4 Pro', 'active', 0),
    ('org-AG004-base-env', 'AG004', 'Olivia', 'base-env', 'Executive Secretary / Operations Coordinator', 'Mistral Large 3', 'active', 1),
    ('org-AG005-base-env', 'AG005', 'Claw (Dee)', 'base-env', 'Legacy Series MCP Specialist', 'DeepSeek V4 Pro', 'active', 0),
    ('org-AG006-base-env', 'AG006', 'Big Brother', 'base-env', 'Senior Software Architect & Systems Engineer', 'DeepSeek V4 Pro', 'active', 1),
    ('org-AG007-base-env', 'AG007', 'Dee', 'base-env', 'Cron & Research Worker', 'DeepSeek V4 Flash', 'active', 0),
    ('org-AG008-base-env', 'AG008', 'Stefi', 'base-env', 'Graphics & Design Director', 'DeepSeek V4 Pro', 'active', 0),
    ('org-AG009-base-env', 'AG009', 'Terence', 'base-env', 'Think Tank Architect & Metacognition Specialist', 'DeepSeek V4 Pro', 'active', 1),
    ('org-AG010-base-env', 'AG010', 'gem', 'base-env', 'Music AI & Research Curator', 'Gemini 3.5 Flash', 'planned', 0);
