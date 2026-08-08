const express = require('express');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const RESEARCH_LINKS_PATH = path.join(__dirname, 'crons', 'openclaw', 'research', 'inventory', 'links.json');
const OLIVIA_RESPONSES_PATH = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'responses.json');
const OLIVIA_QUEUE_PATH = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'queue.json');
const PUBLICATIONS_PATH = path.join(__dirname, 'crons', 'openclaw', 'publications');

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
    const { from, message, timestamp } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    // Everything routes through Olivia — she delegates internally
    const routes = ['olivia'];

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

    // Mark pending notifications as responded since Pete just sent a message
    try {
      let noresp = JSON.parse(fs.readFileSync(OLIVIA_NORESP_PATH, 'utf8'));
      let changed = false;
      for (const nr of noresp) {
        if (!nr.responded && nr.status !== 'expired') {
          nr.responded = true;
          nr.responseId = responseEntry.id;
          nr.respondedAt = new Date().toISOString();
          changed = true;
          break;
        }
      }
      if (changed) fs.writeFileSync(OLIVIA_NORESP_PATH, JSON.stringify(noresp, null, 2), 'utf8');
    } catch (e) { /* no no-responses file */ }

    res.json({ taskId: 'TASK-' + String(queue.length).padStart(4, '0'), status: 'queued' });
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

// Log a notification sent to Pete — starts the 1-hour response window
app.post('/olivia/notified', (req, res) => {
  try {
    const { subject, message, sentAt } = req.body;
    let noresp = [];
    try { noresp = JSON.parse(fs.readFileSync(OLIVIA_NORESP_PATH, 'utf8')); }
    catch (e) { /* file doesn't exist */ }
    noresp.push({
      id: 'NR-' + String(noresp.length + 1).padStart(4, '0'),
      subject: subject || '',
      message: (message || '').substring(0, 200),
      notifiedAt: sentAt || new Date().toISOString(),
      responded: false,
      responseId: null,
    });
    const dir = path.dirname(OLIVIA_NORESP_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(OLIVIA_NORESP_PATH, JSON.stringify(noresp, null, 2), 'utf8');
    res.json({ tracked: true, id: noresp[noresp.length-1].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get no-response items (unresponded after 1 hour)
app.get('/olivia/no-responses', (_req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(OLIVIA_NORESP_PATH, 'utf8'));
    const now = new Date();

    let changed = false;
    for (const nr of data) {
      if (nr.responded || nr.status === 'expired') continue;
      const sent = new Date(nr.notifiedAt);
      const hours = (now - sent) / (1000 * 60 * 60);
      if (hours >= 1) {
        nr.status = 'expired';
        nr.expiredAt = now.toISOString();
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(OLIVIA_NORESP_PATH, JSON.stringify(data, null, 2), 'utf8');
    }

    const expired = data.filter(nr => nr.status === 'expired');
    res.json(expired);
  } catch (e) {
    res.json([]);
  }
});

// Mark the most recent unresponded notification as responded
app.post('/olivia/responded', (req, res) => {
  try {
    const { responseId } = req.body;
    let data = [];
    try { data = JSON.parse(fs.readFileSync(OLIVIA_NORESP_PATH, 'utf8')); }
    catch (e) { return res.json({ ok: true }); }

    let updated = false;
    for (const nr of data) {
      if (!nr.responded && nr.status !== 'expired') {
        nr.responded = true;
        nr.responseId = responseId || null;
        nr.respondedAt = new Date().toISOString();
        updated = true;
        break;
      }
    }

    if (updated) {
      fs.writeFileSync(OLIVIA_NORESP_PATH, JSON.stringify(data, null, 2), 'utf8');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agent Reply — daemon posts replies here ───
app.post('/olivia/agent-reply', (req, res) => {
  try {
    const { responseId, agent, message } = req.body;
    if (!responseId || !agent || !message) {
      return res.status(400).json({ error: 'responseId, agent, and message required' });
    }

    let responses = [];
    try { responses = JSON.parse(fs.readFileSync(OLIVIA_RESPONSES_PATH, 'utf8')); }
    catch (e) { return res.status(404).json({ error: 'no responses found' }); }

    const entry = responses.find(r => r.id === responseId);
    if (!entry) return res.status(404).json({ error: 'response not found' });

    entry.agentReply = {
      from: agent,
      message: message,
      timestamp: new Date().toISOString(),
    };
    entry.status = 'replied';

    // Mark corresponding queue tasks as done
    let queue = [];
    try { queue = JSON.parse(fs.readFileSync(OLIVIA_QUEUE_PATH, 'utf8')); }
    catch (e) { /* no queue */ }
    queue.forEach(t => {
      if (t.responseId === responseId && t.agent === agent) {
        t.status = 'done';
      }
    });
    fs.writeFileSync(OLIVIA_QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf8');

    fs.writeFileSync(OLIVIA_RESPONSES_PATH, JSON.stringify(responses, null, 2), 'utf8');
    res.json({ ok: true, responseId, agent, repliedAt: entry.agentReply.timestamp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get pending replies for command portal ───
app.get('/olivia/pending-replies', (_req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(OLIVIA_RESPONSES_PATH, 'utf8'));
    const replied = data.filter(r => r.agentReply).slice(-10);
    res.json(replied);
  } catch (e) {
    res.json([]);
  }
});

// ─── Publications — auto-discover RUN reports from folder ───
app.get('/publications', (_req, res) => {
  try {
    const files = fs.readdirSync(PUBLICATIONS_PATH)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const fullPath = path.join(PUBLICATIONS_PATH, f);
        const stat = fs.statSync(fullPath);
        let runId = f.replace(/\.html$/i, '');
        let displayName = runId;
        let runDate = stat.mtime.toISOString();
        return { name: f, displayName, runId, runDate, size: stat.size, path: 'crons/openclaw/publications/' + f };
      })
      .sort((a, b) => new Date(b.runDate) - new Date(a.runDate));
    res.json(files);
  } catch (e) {
    res.json([]);
  }
});

// ─── Clear messages — keeps last 5, saves cleared to pete folder ───
app.post('/olivia/clear-messages', (req, res) => {
  try {
    let responses = JSON.parse(fs.readFileSync(OLIVIA_RESPONSES_PATH, 'utf8'));
    if (responses.length <= 5) return res.json({ cleared: 0, remaining: responses.length });

    const toKeep = responses.slice(-5);
    const toClear = responses.slice(0, -5);

    const saveDir = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'command-portal-messages');
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(saveDir, `cleared-${timestamp}.txt`);

    const lines = toClear.map(r => {
      const reply = r.agentReply ? `[${r.agentReply.from}] ${r.agentReply.message}` : '[no reply]';
      return `--- ${r.id} | ${r.timestamp} ---\nPete: ${r.message}\n${reply}\n`;
    });
    fs.writeFileSync(filename, lines.join('\n'), 'utf8');

    fs.writeFileSync(OLIVIA_RESPONSES_PATH, JSON.stringify(toKeep, null, 2), 'utf8');
    res.json({ cleared: toClear.length, remaining: toKeep.length, savedTo: filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Vistamations App running on port ' + PORT);
});
