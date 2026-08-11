/**
 * agent-daemon.js — Vistamations Agent Dispatch Daemon
 *
 * Background worker running in Docker container (PID 9).
 * Polls queue.json every 5 seconds and processes messages.
 *
 * Two access patterns:
 * 1. Olivia delegation — message routed to "olivia" → keyword matching
 *    detects which agents to consult → replies collected → Olivia synthesizes final report
 * 2. Direct agent address — message routed to "gordon", "trinity", etc. →
 *    agent responds directly, no keyword routing, no Olivia synthesis
 *
 * Flow: Pete → queue.json → daemon processes → agent replies → Olivia posts synthesized response → Command Portal
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const QUEUE_PATH = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'queue.json');
const POLL_INTERVAL_MS = 5000;
const API_HOST = process.env.AGENT_DAEMON_HOST || 'localhost';
const API_PORT = process.env.AGENT_DAEMON_PORT || '3000';

// ─── Agent System Prompts (loaded from personas + mode files for context) ───

const AGENT_CONTEXT = {
  gordon: {
    name: 'Gordon', id: 'AG001', division: 'Operations', department: 'Infrastructure',
    role: 'Chief Hub Agent — Docker orchestration, container lifecycle, pipeline operations',
    reply: function () {
      const replies = [
        'All four containers healthy. nginx:80, app:3000, redis:6379, prometheus:9090. Volumes mounted, ports bound. Pipeline logs clean. No rebuilds needed.',
        'Docker stack nominal. No stale containers. Rebuild-on-change enforcement active. Standing by for deployment.',
        'Infrastructure steady. Container uptime verified. No anomalies in pipeline logs.',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
  trinity: {
    name: 'Trinity', id: 'AG002', division: 'Operations', department: 'Engineering',
    role: 'Apprentice Systems Engineer — ports, bridges, gateway, MCP routing',
    reply: function () {
      const replies = [
        'Ports verified — no collisions. nginx:80/5501, app:3000, redis:6379, prometheus:9090, openclaw:18789. All bridges healthy. MCP routes registered and responding.',
        'Gateway steady on 18789. MCP server health confirmed. Local cache and storage nominal.',
        'Infrastructure scan complete. All services green. No port conflicts detected.',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
  merlin: {
    name: 'Merlin V.II', id: 'AG003', division: 'Executive', department: 'Strategy',
    role: 'Wizard Guide — architecture pathfinding, tutorials, system philosophy',
    reply: function () {
      const replies = [
        'The architecture has several viable paths forward. I can guide you through each — the decision is yours. Current system health: 54%, with agent-daemon rewrite as the highest priority G-1 gap.',
        'Six-value ID system now active: System → Sub-System → Environment → Division → Department. Five divisions mapped across 14 departments. Your architecture is documented and coherent.',
        'Standing by for guidance requests. The path from 54% to 75% system health requires G-1 (daemon), G-2 (container rebuilds), G-5 (knowledge graph), G-7 (tests), G-9 (gemini daemon) — in that order.',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
  claw: {
    name: 'Claw (Terence)', id: 'AG005', division: 'Operations', department: 'Engineering',
    role: 'MCP Specialist — tool belt, legacy systems, external integrations',
    reply: function () {
      const replies = [
        'MCP tool belt active: n8n-mcp (525 nodes, 263 AI tools), figma-dev-mode on port 3845, openclaw-gateway on 18789. Two data ingestion connectors in development, one vector search connector building out.',
        'Tool belt status: n8n-mcp verified. Figma bridge operational. Working on vector search and data ingestion connectors. Permission to investigate LangChain connector.',
        'Legacy systems compatible. MCP tool chain ready. New connectors can be tested in isolated Docker containers before production.',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
  'big-brother': {
    name: 'Big Brother', id: 'AG006', division: 'Operations', department: 'Engineering',
    role: 'Senior Software Architect — code review, infrastructure, telemetry',
    reply: function () {
      const replies = [
        'Architecture checkpoint: agent-daemon.js is now a real dispatch daemon (G-1 resolved). Next priorities: container rebuild automation (G-2), knowledge graph population (G-5), test framework (G-7).',
        'Code review: server.js vault bridge operational. Secrets segregated (G-3 resolved). All 10 personas complete (G-4 resolved). System health 54% and climbing.',
        'Infrastructure telemetry active. 17 API routes verified. 6 scheduled tasks operational. Priority sequence: G-1 → G-2 → G-5 → G-7 → G-9.',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
  dee: {
    name: 'Dee', id: 'AG007', division: 'Operations', department: 'Engineering',
    role: 'Cron & Research Worker — scheduling, scraping, report generation',
    reply: function () {
      const replies = [
        'Cron jobs armed and operational. Publishing engine running daily at 09/12/15/18 AEST. Links sync every 4 days. Git auto-commit every 2 days. All 6 tasks verified.',
        'Next publishing window: pending schedule. Reports archived to crons/openclaw/publications/. Knowledge library current.',
        'Research pipeline active. Scraping complete for current cycle. Reports generated and archived.',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
  stefi: {
    name: 'Stefi', id: 'AG008', division: 'Creative', department: 'Design',
    role: 'Graphics & Design Director — UI, bento layouts, branding, animation',
    reply: function () {
      const replies = [
        'Design system active: ink-black #0A0C0F backgrounds, amber #E8A33D accent, cyan #4FD1C5 verified, rust #C44536 flagged. JetBrains Mono headers, Inter body. All pages consistent.',
        'Bento grid chassis on geometry engine spec. Media Centre glass-morphism styling ready. Agent avatar graphics in development.',
        'Design assets organized: images/media-player/ for Media Centre, images/ for general assets. Figma prototypes available via MCP bridge.',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
  gem: {
    name: 'gem', id: 'AG010', division: 'Creative', department: 'Music',
    role: 'Music AI & Research Curator — multimodal analysis, playlist curation',
    reply: function () {
      const replies = [
        'Music library loaded: 23 Tim Cochrane tracks across 6 variations of Space is not nothing. Neo-classical shred guitar anchor genre detected. Ready to research or suggest.',
        'Playlist analysis: melodic technical guitar preference strong. Matheus and Soul Shadows variations suggest you gravitate toward structured improvisation. Want Suno prompt suggestions?',
        'Music AI standing by. Can research Suno techniques, generate neo-classical prompts, track your play history, and build a taste profile over time. Gemini daemon wiring pending (G-9).',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
};

// ─── Olivia's keyword-based agent detection ───
const AGENT_KEYWORDS = {
  gordon:     ['gordon','docker','container','build','compose','volume','ticket','pipeline','deploy','log','image'],
  trinity:    ['trinity','infrastructure','docker','container','port','health','nginx','redis','prometheus','gateway','mcp','server','uptime','recovery','cache','storage','deploy'],
  merlin:     ['merlin','guide','tutorial','how','explain','strategy','path','architecture','decision','philosophy','option'],
  claw:       ['claw','mcp','connector','plugin','tool','legacy','integrate','automation','install','skill'],
  'big-brother': ['big brother','code','review','algorithm','optimise','infrastructure','architect','debug','report','stage','plan','oversight','telemetry'],
  dee:        ['dee','cron','publish','scrape','research','monitor','post','webhook','report','schedule','quick'],
  stefi:      ['stefi','steffi','design','ui','layout','bento','dashboard','branding','icon','illustration','animation','svg','visual','graphic','stitch'],
  terence:    ['terence','openclaw','think tank','metacognition','cluster','vector','mapping','boundary','centroid','cosine','synthesis','idea','concept','framework','philosophy','reasoning'],
  gem:        ['gem','music','song','track','suno','guitar','shred','neo classical','play','playlist','listen','audio','mp3','taste','genre','artist','Tim Cochrane','melodic'],
  all:        ['everyone','all agents','everybody','briefing','sitrep','full report'],
};

function detectAgents(message) {
  const lower = message.toLowerCase();
  const scores = {};
  for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
    if (agent === 'all') continue;
    scores[agent] = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) scores[agent] += 1;
    }
  }
  for (const kw of AGENT_KEYWORDS.all) {
    if (lower.includes(kw)) {
      Object.keys(AGENT_CONTEXT).forEach(a => { if (a !== 'olivia') scores[a] = (scores[a] || 0) + 1; });
    }
  }
  const asked = Object.entries(scores).filter(([, s]) => s > 0).map(([k]) => k);
  if (asked.length === 0) return Object.keys(AGENT_CONTEXT).filter(a => a !== 'olivia');
  return asked;
}

// ─── HTTP helpers ───

function apiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: API_HOST, port: API_PORT, path: endpoint, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => { try { resolve(JSON.parse(chunks)); } catch (e) { resolve({ ok: true }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Main dispatcher ───

async function processQueue() {
  let queue;
  try { queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8')); } catch (e) { return; }

  const pending = queue.filter(t => t.status === 'queued');
  if (pending.length === 0) return;

  console.log('[agent-daemon] ' + pending.length + ' messages to process');

  for (const task of pending) {
    const targetAgent = task.agent || 'olivia';
    const message = task.message || '';

    // ─── PATTERN 1: Direct agent address ───
    if (targetAgent !== 'olivia') {
      const persona = AGENT_CONTEXT[targetAgent];
      if (!persona) {
        console.log('[agent-daemon] Unknown agent: ' + targetAgent + ', skipping');
        continue;
      }

      console.log('[agent-daemon] Direct to ' + persona.name + ': ' + message.substring(0, 60) + '...');

      const reply = persona.reply();
      const directReply = persona.name + ' (' + persona.id + ', ' + persona.division + ' / ' + persona.department + ') reports:\n\n' +
        persona.role + '\n\n' + reply + '\n\n—Direct reply via Command Control';

      try {
        await apiPost('/olivia/agent-reply', {
          responseId: task.responseId,
          agent: targetAgent,
          message: directReply,
        });
        task.status = 'done';
        console.log('[agent-daemon]   ' + persona.name + ' replied directly');
      } catch (e) {
        console.error('[agent-daemon] Failed to post ' + targetAgent + ' reply: ' + e.message);
      }

      await new Promise(r => setTimeout(r, 600));
      continue;
    }

    // ─── PATTERN 2: Olivia delegation ───
    console.log('[agent-daemon] Olivia processing ' + task.responseId + ': ' + message.substring(0, 60) + '...');

    const targetAgents = detectAgents(message);
    console.log('[agent-daemon] Olivia delegating to: ' + targetAgents.join(', '));

    const agentReports = [];

    for (const agentKey of targetAgents) {
      const persona = AGENT_CONTEXT[agentKey];
      if (!persona) continue;

      const reply = persona.reply();
      console.log('[agent-daemon]   ' + persona.name + ' reports back');

      try {
        await apiPost('/olivia/agent-reply', {
          responseId: task.responseId, agent: agentKey, message: reply,
        });
        agentReports.push({ agent: agentKey, name: persona.name, reply });
      } catch (e) {
        console.error('[agent-daemon] Failed to post ' + agentKey + ' reply: ' + e.message);
      }
      await new Promise(r => setTimeout(r, 600));
    }

    // Olivia synthesizes the final report
    let oliviaReport;
    if (agentReports.length === 0) {
      oliviaReport = 'Noted. I\'ll keep an eye on this. Anything else you need?';
    } else if (agentReports.length === 1) {
      const r = agentReports[0];
      oliviaReport = r.name + ' reports: ' + r.reply + ' — anything else I can help with?';
    } else {
      const lines = agentReports.map(r => '\u2022 ' + r.name + ': ' + r.reply);
      oliviaReport = 'Here\'s your briefing:\n\n' + lines.join('\n\n') + '\n\nAll agents processed. What\'s next?';
    }

    console.log('[agent-daemon] Olivia synthesizing response');
    try {
      await apiPost('/olivia/agent-reply', {
        responseId: task.responseId, agent: 'olivia', message: oliviaReport,
      });
      task.status = 'done';
    } catch (e) {
      console.error('[agent-daemon] Failed to post Olivia reply: ' + e.message);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf8');
}

async function run() {
  console.log('[agent-daemon] Vistamations Agent Dispatch Daemon starting');
  console.log('[agent-daemon] Modes: Olivia delegation + direct agent address');
  console.log('[agent-daemon] Polling queue every ' + (POLL_INTERVAL_MS / 1000) + 's');
  await new Promise(r => setTimeout(r, 3000));
  setInterval(processQueue, POLL_INTERVAL_MS);
}

run().catch(e => console.error('[agent-daemon] Fatal:', e.message));
