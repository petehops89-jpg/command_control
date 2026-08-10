/**
 * Vistamations Agent Memory — Cloudflare D1 Worker
 * 
 * Exposes the D1 agent memory database via REST API.
 * Provides: agent CRUD, memory read/write, session tracking, music plays, research findings.
 * 
 * Deploy: npx wrangler deploy
 * Local:  npx wrangler dev
 */

export default {
    async fetch(request, env) {
        try {
        const url = new URL(request.url);
        const path = url.pathname;
        const db = env.AGENT_DB;

        // ─── Health ───
        if (path === '/health') {
            const row = await db.prepare('SELECT count(*) as count FROM agents').first();
            return json({ status: 'ok', agents: row.count, service: 'vistamations-agent-memory' });
        }

        // ─── Agents ───
        if (path === '/agents' && request.method === 'GET') {
            const agents = await db.prepare('SELECT * FROM agents ORDER BY agent_id').all();
            return json(agents.results);
        }
        if (path === '/agents' && request.method === 'POST') {
            const body = await request.json();
            await db.prepare(
                'INSERT OR REPLACE INTO agents (id, agent_id, name, cluster, domain, persona_json, model, status, always_on_call, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
            ).bind(body.id, body.agent_id, body.name, body.cluster, body.domain, JSON.stringify(body.persona_json ?? null), body.model, body.status, body.always_on_call ?? 0).run();
            return json({ ok: true, id: body.id });
        }

        // ─── Agent Memory ───
        if (path.startsWith('/memory/') && request.method === 'GET') {
            const agentId = path.split('/')[2];
            const memories = await db.prepare(
                'SELECT * FROM agent_memory WHERE agent_id = ? ORDER BY updated_at DESC'
            ).bind(agentId).all();
            return json(memories.results);
        }
        if (path.startsWith('/memory/') && request.method === 'POST') {
            const agentId = path.split('/')[2];
            const body = await request.json();
            await db.prepare(
                'INSERT OR REPLACE INTO agent_memory (agent_id, memory_key, memory_value, memory_type, confidence, source, cluster_label, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
            ).bind(agentId, body.memory_key, JSON.stringify(body.memory_value), body.memory_type || 'fact', body.confidence || 1.0, body.source, body.cluster_label || null).run();
            return json({ ok: true, agent_id: agentId, key: body.memory_key });
        }

        // ─── Music Plays ───
        if (path === '/music/play' && request.method === 'POST') {
            const body = await request.json();
            await db.prepare(
                'INSERT INTO music_plays (track_title, track_artist, source, url, duration_sec, completed, genre_tags, agent_id, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(body.track_title, body.track_artist, body.source, body.url, body.duration_sec, body.completed, JSON.stringify(body.genre_tags), body.agent_id, body.session_id).run();
            return json({ ok: true });
        }
        if (path === '/music/history' && request.method === 'GET') {
            const limit = parseInt(url.searchParams.get('limit') || '50');
            const plays = await db.prepare(
                'SELECT * FROM music_plays ORDER BY played_at DESC LIMIT ?'
            ).bind(limit).all();
            return json(plays.results);
        }
        if (path === '/music/stats' && request.method === 'GET') {
            const stats = await db.prepare(
                "SELECT track_artist, track_title, count(*) as plays, sum(duration_sec) as total_sec, sum(completed) as completions FROM music_plays GROUP BY track_artist, track_title ORDER BY plays DESC LIMIT 20"
            ).all();
            return json(stats.results);
        }

        // ─── Research Findings ───
        if (path === '/research' && request.method === 'POST') {
            const body = await request.json();
            await db.prepare(
                'INSERT INTO research_findings (source_type, source_name, source_id, category, relevance_score, summary, keywords, full_text_hash, reported_to, agent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(body.source_type, body.source_name, body.source_id, body.category, body.relevance_score, body.summary, JSON.stringify(body.keywords), body.full_text_hash, body.reported_to, body.agent_id).run();
            return json({ ok: true });
        }
        if (path === '/research' && request.method === 'GET') {
            const category = url.searchParams.get('category');
            let query = 'SELECT * FROM research_findings';
            let params = [];
            if (category) { query += ' WHERE category = ?'; params.push(category); }
            query += ' ORDER BY discovered_at DESC LIMIT 50';
            const findings = await db.prepare(query).bind(...params).all();
            return json(findings.results);
        }

        // ─── Sessions ───
        if (path === '/sessions' && request.method === 'POST') {
            const body = await request.json();
            await db.prepare(
                'INSERT INTO sessions (id, agent_id, status) VALUES (?, ?, ?)'
            ).bind(body.id, body.agent_id, body.status || 'active').run();
            return json({ ok: true, id: body.id });
        }
        if (path.startsWith('/sessions/') && request.method === 'PATCH') {
            const sessionId = path.split('/')[2];
            const body = await request.json();
            if (body.status) {
                await db.prepare("UPDATE sessions SET status = ?, ended_at = datetime('now') WHERE id = ?").bind(body.status, sessionId).run();
            }
            if (body.summary) {
                await db.prepare("UPDATE sessions SET summary = ? WHERE id = ?").bind(body.summary, sessionId).run();
            }
            return json({ ok: true, id: sessionId });
        }

        // ─── Clusters ───
        if (path === '/clusters' && request.method === 'GET') {
            const clusters = await db.prepare('SELECT * FROM vector_clusters ORDER BY member_count DESC').all();
            return json(clusters.results);
        }
        if (path === '/clusters' && request.method === 'POST') {
            const body = await request.json();
            await db.prepare(
                'INSERT OR REPLACE INTO vector_clusters (cluster_label, description, centroid_ref, member_count, boundary_radius, parent_cluster, refined_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
            ).bind(body.cluster_label, body.description, body.centroid_ref, body.member_count, body.boundary_radius, body.parent_cluster).run();
            return json({ ok: true, label: body.cluster_label });
        }

        return json({ error: 'not found' }, 404);
        } catch (e) {
            return json({ error: e.message, stack: e.stack?.substring(0, 500) }, 500);
        }
    }
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}
