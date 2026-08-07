const express = require('express');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const RESEARCH_LINKS_PATH = path.join(__dirname, 'crons', 'openclaw', 'research', 'inventory', 'links.json');

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

// Research Inventory — capture links
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

// Research Inventory — get links
app.get('/research/links', (_req, res) => {
  try {
    const data = fs.readFileSync(RESEARCH_LINKS_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.json([]);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Vistamations App running on port ' + PORT);
});
