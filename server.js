const express = require('express');
const Redis = require('ioredis');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');

// ─── Vistamations Unified Vault ───
// Resolves secrets from: Credential Manager (local) → process.env (Docker) → defaults
const VAULT_PATH = path.join(
  __dirname,
  '.vscode', 'pete', 'vista-localsub-root', 'vista-localenv-env-root',
  'vista-sec-water', 'api-key-env-link', 'vault.js'
);
let getSecret = null;
try {
  if (fs.existsSync(VAULT_PATH)) {
    getSecret = require(VAULT_PATH).getSecret;
    console.log('[vault] Unified vault loaded');
  }
} catch (e) {
  console.warn('[vault] Not available:', e.message);
}

async function resolveSecret(name, fallback) {
  if (getSecret) {
    try {
      const val = await getSecret(name);
      if (val) return val;
    } catch (_) {}
  }
  return process.env[name] || fallback;
}

const RESEARCH_LINKS_PATH = path.join(__dirname, 'crons', 'openclaw', 'research', 'inventory', 'links.json');
const OLIVIA_RESPONSES_PATH = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'responses.json');
const OLIVIA_QUEUE_PATH = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'queue.json');
const PUBLICATIONS_PATH = path.join(__dirname, 'crons', 'openclaw', 'publications');

let OLIVIA_NORESP_PATH = null;

const app = express();
const PORT = process.env.PORT || 3000;

let redis = null;

async function initRedis() {
  const redisUrl = await resolveSecret('REDIS_URL', 'redis://redis:6379');
  const redisPassword = await resolveSecret('REDIS_PASSWORD', '');
  try {
    redis = new Redis(redisUrl, {
      password: redisPassword,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 200, 3000),
    });
    console.log('[redis] Initialized');
  } catch (e) {
    console.warn('[redis] Init warning:', e.message);
  }
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

// ─── Email Hub — IMAP inboxes for 3 Gmail accounts ───

const EMAIL_ACCOUNTS = {
  hops:  { label: 'Hops',  user: 'hops1010@gmail.com',                 color: '#4285F4' },
  pete:  { label: 'Pete',  user: 'petehops89@gmail.com',               color: '#E8A33D' },
  james: { label: 'James', user: 'james.hooper@vistamations.com',      color: '#C44536' },
};

function fetchInbox(accountKey, limit) {
  return new Promise((resolve, reject) => {
    const acct = EMAIL_ACCOUNTS[accountKey];
    if (!acct) return reject(new Error('Unknown account: ' + accountKey));

    const password = process.env['EMAIL_PASSWORD_' + accountKey.toUpperCase()];
    if (!password) return reject(new Error('No app password for ' + accountKey + '. Set EMAIL_PASSWORD_' + accountKey.toUpperCase() + ' in .env'));
    if (password === 'your-app-password') return resolve([]);

    const imap = new Imap({
      user: acct.user,
      password: password,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    const messages = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        imap.search(['ALL'], (err, results) => {
          if (err || !results.length) { imap.end(); return resolve([]); }

          const ids = results.slice(-limit);
          if (ids.length === 0) { imap.end(); return resolve([]); }

          const fetch = imap.fetch(ids, { bodies: '', struct: true });
          let fetched = 0;

          fetch.on('message', (msg) => {
            let body = '';
            msg.on('body', (stream) => { stream.on('data', (chunk) => { body += chunk.toString('utf8'); }); });
            msg.once('attributes', (attrs) => {
              messages.push({ uid: attrs.uid, date: attrs.date, raw: body });
            });
            msg.once('end', () => {
              fetched++;
              if (fetched === ids.length) processMessages();
            });
          });

          fetch.once('error', (err) => { imap.end(); reject(err); });
          fetch.once('end', () => { if (fetched === 0) { imap.end(); resolve([]); } });

          function processMessages() {
            Promise.all(messages.map(async (m) => {
              try {
                const parsed = await simpleParser(m.raw);
                return {
                  uid: m.uid,
                  date: parsed.date || m.date,
                  from: parsed.from ? parsed.from.text : 'Unknown',
                  subject: parsed.subject || '(no subject)',
                  snippet: (parsed.text || '').substring(0, 150),
                };
              } catch (_) {
                return { uid: m.uid, date: m.date, from: 'Unknown', subject: '(parse error)', snippet: '' };
              }
            })).then((processed) => {
              imap.end();
              resolve(processed.sort((a, b) => new Date(b.date) - new Date(a.date)));
            }).catch(() => { imap.end(); resolve([]); });
          }
        });
      });
    });

    imap.once('error', (err) => { reject(err); });
    imap.connect();
  });
}

app.get('/email/accounts', (_req, res) => {
  const accounts = Object.entries(EMAIL_ACCOUNTS).map(([key, acct]) => ({
    key, label: acct.label, user: acct.user, color: acct.color,
    configured: !!(process.env['EMAIL_PASSWORD_' + key.toUpperCase()]),
  }));
  res.json(accounts);
});

app.get('/email/inbox/:account', async (req, res) => {
  const accountKey = req.params.account;
  const limit = parseInt(req.query.limit) || 20;
  try {
    const messages = await fetchInbox(accountKey, limit);
    res.json({ account: accountKey, count: messages.length, messages });
  } catch (e) {
    res.status(500).json({ error: e.message, account: accountKey });
  }
});

// ─── GAccounts — PIN-protected vault for Google Account secrets ───

const crypto = require('crypto');
const VAULT_DATA_PATH = path.join(__dirname, '.vault-data.json');
const VAULT_PIN_PATH = path.join(__dirname, '.vault-pin.hash');

let vaultTokens = {};       // active session tokens
let vaultPinHash = null;    // scrypt hash of the PIN
let vaultSecrets = {};      // { target: { key, value, notes, storedAt, iv, tag } }

function loadVaultData() {
  try {
    if (fs.existsSync(VAULT_DATA_PATH)) {
      const raw = fs.readFileSync(VAULT_DATA_PATH, 'utf8');
      vaultSecrets = JSON.parse(raw);
    }
  } catch (_) { vaultSecrets = {}; }
  try {
    if (fs.existsSync(VAULT_PIN_PATH)) {
      vaultPinHash = fs.readFileSync(VAULT_PIN_PATH, 'utf8').trim();
    }
  } catch (_) { vaultPinHash = null; }
}

function saveVaultData() {
  fs.writeFileSync(VAULT_DATA_PATH, JSON.stringify(vaultSecrets, null, 2), 'utf8');
}

function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve) => {
    crypto.scrypt(pin, salt, 64, (err, derivedKey) => {
      if (err) resolve(null);
      resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
    });
  });
}

function verifyPinHash(pin, storedHash) {
  return new Promise((resolve) => {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return resolve(false);
    const salt = Buffer.from(parts[0], 'hex');
    crypto.scrypt(pin, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false);
      resolve(derivedKey.toString('hex') === parts[1]);
    });
  });
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function encrypt(value, pin) {
  const key = crypto.scryptSync(pin, 'vault-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), tag };
}

function decrypt(encrypted, iv, tag, pin) {
  const key = crypto.scryptSync(pin, 'vault-salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

loadVaultData();

app.get('/accounts/vault-status', (_req, res) => {
  res.json({ enrolled: !!vaultPinHash, configured: Object.keys(vaultSecrets).length > 0 });
});

app.post('/accounts/vault-enroll', async (req, res) => {
  const { pin } = req.body || {};
  if (!pin || !/^\d{4}$/.test(pin)) return res.json({ ok: false, error: 'PIN must be exactly 4 digits' });
  if (vaultPinHash) return res.json({ ok: false, error: 'PIN already enrolled. Reset not supported via web.' });
  vaultPinHash = await hashPin(pin);
  fs.writeFileSync(VAULT_PIN_PATH, vaultPinHash, 'utf8');
  res.json({ ok: true });
});

app.post('/accounts/vault-unlock', async (req, res) => {
  const { pin } = req.body || {};
  if (!pin || !/^\d{4}$/.test(pin)) return res.json({ ok: false, reason: 'PIN must be 4 digits' });
  if (!vaultPinHash) return res.json({ ok: false, reason: 'PIN not enrolled' });
  const valid = await verifyPinHash(pin, vaultPinHash);
  if (!valid) return res.json({ ok: false, reason: 'Wrong PIN' });
  const token = generateToken();
  vaultTokens[token] = { pin, createdAt: Date.now() };
  // Auto-expire token after 3 minutes
  setTimeout(() => { delete vaultTokens[token]; }, 180000);
  res.json({ ok: true, token });
});

app.post('/accounts/vault-store', (req, res) => {
  const { token, target, key, value, notes } = req.body || {};
  const authToken = req.headers['x-vault-token'] || token;
  if (!authToken || !vaultTokens[authToken]) return res.json({ ok: false, error: 'Vault locked. Enter PIN first.' });
  if (!target || !key || !value) return res.json({ ok: false, error: 'Target, key, and value are required' });

  const session = vaultTokens[authToken];
  const { encrypted, iv, tag } = encrypt(value, session.pin);

  vaultSecrets[key] = {
    target, key, value: encrypted, iv, tag,
    notes: notes || '', storedAt: new Date().toISOString()
  };
  saveVaultData();
  res.json({ ok: true, stored: key });
});

app.get('/accounts/vault-list', (req, res) => {
  const authToken = req.headers['x-vault-token'];
  if (!authToken || !vaultTokens[authToken]) return res.status(403).json({ error: 'Vault locked' });
  const items = Object.values(vaultSecrets).map(s => ({
    key: s.key, target: s.target, notes: s.notes, storedAt: s.storedAt
  }));
  items.sort((a, b) => new Date(b.storedAt) - new Date(a.storedAt));
  res.json({ items });
});

app.post('/accounts/vault-reveal', (req, res) => {
  const authToken = req.headers['x-vault-token'];
  if (!authToken || !vaultTokens[authToken]) return res.status(403).json({ error: 'Vault locked' });
  const { key } = req.body || {};
  if (!key || !vaultSecrets[key]) return res.json({ error: 'Not found' });
  const s = vaultSecrets[key];
  try {
    const decrypted = decrypt(s.value, s.iv, s.tag, vaultTokens[authToken].pin);
    res.json({ value: decrypted });
  } catch (_) {
    res.json({ error: 'Decrypt failed' });
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  OLIVIA_NORESP_PATH = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'no-response.json');
  await initRedis();
  console.log('Vistamations App running on port ' + PORT);
});
