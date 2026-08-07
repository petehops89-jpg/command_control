const express = require('express');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const RESEARCH_LINKS_PATH = path.join(__dirname, 'crons', 'openclaw', 'research', 'inventory', 'links.json');
const OLIVIA_RESPONSES_PATH = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'responses.json');
const OLIVIA_QUEUE_PATH = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'queue.json');

const app = express();
const PORT = process.env.PORT || 3000;

let redis = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
    password: process.env.REDIS_PASSWORD || 'vistamations-redis-2026',
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 200, 3000),
  });
} catch (e) {
  console.warn('Redis init warning:', e.message);
}

app.use(express.json());

app.get('/health', async (_req, res) => {
  let redisOk = false;
  if (redis) {
    try { await redis.ping(); redisOk = true; } catch (e) { /* offline */ }
  }
  res.json({
    status: 'ok',
    service: 'vistamations-app',
    redis: redisOk ? 'connected' : 'offline',
    uptime: process.uptime(),
  });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', 'text/plain');
  let redisUp = 0;
  if (redis) {
    try { await redis.ping(); redisUp = 1; } catch (e) { /* offline */ }
  }
  res.end([
    '# HELP vistamations_uptime_seconds App uptime',
    '# TYPE vistamations_uptime_seconds gauge',
    'vistamations_uptime_seconds ' + process.uptime(),
    '# HELP vistamations_redis_up Redis connectivity',
    '# TYPE vistamations_redis_up gauge',
    'vistamations_redis_up ' + redisUp,
    '',
  ].join('\n'));
});

// ─── Research Inventory ───

app.post('/research/capture', (req, res) => {
  try {
    const { links } = req.body;
    if (!links || !Array.isArray(links)) {
      return res.status(400).json({ error: 'links array required' });
    }
    let existing = [];
    try { existing = JSON.parse(fs.readFileSync(RESEARCH_LINKS_PATH, 'utf8')); }
    catch (e) { /* file doesn't exist yet */ }
    for (const link of links) {
      if (!link.linkId) {
        const seq = String(existing.length + 1).padStart(4, '0');
        link.linkId = 'LINK-' + seq;
      }
    }
    existing.push(...links);
    const dir = path.dirname(RESEARCH_LINKS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RESEARCH_LINKS_PATH, JSON.stringify(existing, null, 2), 'utf8');
    res.json({ count: links.length, total: existing.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/research/links', (_req, res) => {
  try {
    const data = fs.readFileSync(RESEARCH_LINKS_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.json([]);
  }
});

// ─── Olivia Gate ───

app.post('/olivia/respond', (req, res) => {
  try {
    const { from, message, routedTo, timestamp } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const routes = routedTo && routedTo.length > 0 ? routedTo : ['olivia'];

    let responses = [];
    try { responses = JSON.parse(fs.readFileSync(OLIVIA_RESPONSES_PATH, 'utf8')); }
    catch (e) { /* file doesn't exist */ }
    const responseEntry = {
      id: 'RESP-' + String(responses.length + 1).padStart(4, '0'),
      from: from || 'Pete',
      message,
      routedTo: routes,
      timestamp: timestamp || new Date().toISOString(),
      status: 'received',
    };
    responses.push(responseEntry);
    const dir = path.dirname(OLIVIA_RESPONSES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(OLIVIA_RESPONSES_PATH, JSON.stringify(responses, null, 2), 'utf8');

    let queue = [];
    try { queue = JSON.parse(fs.readFileSync(OLIVIA_QUEUE_PATH, 'utf8')); }
    catch (e) { /* file doesn't exist */ }
    for (const agent of routes) {
      queue.push({
        taskId: 'TASK-' + String(queue.length + 1).padStart(4, '0'),
        agent,
        message,
        from: from || 'Pete',
        assignedAt: timestamp || new Date().toISOString(),
        status: 'queued',
        responseId: responseEntry.id,
      });
    }
    fs.writeFileSync(OLIVIA_QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf8');

    res.json({ taskId: 'TASK-' + String(queue.length).padStart(4, '0'), routedTo: routes, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/olivia/queue', (_req, res) => {
  try {
    const data = fs.readFileSync(OLIVIA_QUEUE_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.json([]);
  }
});

app.get('/olivia/responses', (_req, res) => {
  try {
    const data = fs.readFileSync(OLIVIA_RESPONSES_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.json([]);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Vistamations App running on port ' + PORT);
});
