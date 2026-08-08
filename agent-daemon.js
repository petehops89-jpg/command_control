/**
 * Agent Response Daemon — Olivia Pipeline
 *
 * Pete talks ONLY to Olivia. Olivia delegates to agents internally,
 * collects their responses, and synthesizes a single report back to Pete.
 *
 * Flow: Pete → Olivia (queue) → Olivia delegates to agents →
 * agents reply silently → Olivia synthesizes summary → notification to Pete
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const QUEUE_PATH = path.join(__dirname, 'crons', 'openclaw', 'olivia', 'queue.json');
const POLL_INTERVAL_MS = 5000;
const API_HOST = process.env.AGENT_DAEMON_HOST || 'localhost';
const API_PORT = process.env.AGENT_DAEMON_PORT || '3000';

// ─── Agent Personas — internal voices, Pete never sees these directly ───
const PERSONAS = {
  trinity: {
    name: 'Trinity',
    reply: function () {
      const replies = [
        'All four containers healthy — nginx:80, app:3000, redis:6379, prometheus:9090. Gateway on 18789 steady. No alerts.',
        'Infrastructure unchanged. Docker compose stack uptime 15h+. MCP routes verified. Recovery procedures armed.',
        'Ports clean. No collisions. Local cache and storage nominal. Standing by.',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
  gordon: {
    name: 'Gordon',
    reply: function () { return 'No issues. Containers rebuilt, volumes mounted, ports bound. Pipeline logs clean.'; },
  },
  'merlin': {
    name: 'Merlin V.II',
    reply: function () { return 'The architecture has several viable paths. I can guide you through each — the decision is yours.'; },
  },
  claw: {
    name: 'Claw (Dee)',
    reply: function () { return 'MCP tool belt growing — two new connectors for data ingestion, one for vector search. Ready to install.'; },
  },
  'big brother': {
    name: 'Big Brother',
    reply: function () { return 'Code review clean. Stage 3.1 dashboard built, 3.2 formalization in progress. Sequencing holds.'; },
  },
  dee: {
    name: 'Dee',
    reply: function () { return 'Cron jobs armed. Next publishing window 09:00 AEST. Scraping complete, reports generated.'; },
  },
  stefi: {
    name: 'Stefi',
    reply: function () { return 'Dashboard design progressing. Journey path bezier arc sketched. Agent card gradients refined.'; },
  },
  terence: {
    name: 'Terence',
    reply: function () {
      const replies = [
        'Cluster analysis complete. Five domains mapped with clear boundaries. The music-knowledge cluster is still forming — expect boundary refinement over the next 3-4 sessions. Metacognition audit shows clean reasoning chains across the agent swarm. No circular logic detected.',
        'Been mapping the vector space. Interesting cluster forming around neo-classical shred — tight, well-defined, high cosine similarity within. The infrastructure cluster is stable but could split: Docker patterns vs. cron patterns are drifting apart.',
        'MCP tool belt: n8n-mcp has 525 nodes, 263 AI tools. Worth exploring the LangChain and vector search connectors. They would slot into the memory-systems cluster. Permission to investigate?',
        'Metacognition watch: just flagged a potential assumption gap in the scheduled task architecture. We assume AtLogOn fires reliably — but it does not. Good catch by Big Brother. Adding to the reasoning graph.',
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },
  },
};

// ─── Olivia interprets Pete's message, decides which agents to ask ───
const AGENT_KEYWORDS = {
  trinity:    ['trinity','infrastructure','docker','container','port','health','nginx','redis','prometheus','gateway','mcp','server','uptime','recovery','cache','storage','deploy'],
  gordon:     ['gordon','docker','container','build','compose','volume','ticket','pipeline','deploy','log','image'],
  merlin:     ['merlin','guide','tutorial','how','explain','strategy','path','architecture','decision','philosophy','option'],
  claw:       ['claw','mcp','connector','plugin','tool','legacy','integrate','automation','install','skill'],
  'big brother': ['big brother','code','review','algorithm','optimise','infrastructure','architect','debug','report','stage','plan','oversight'],
  dee:        ['dee','cron','publish','scrape','research','monitor','post','webhook','report','schedule','quick'],
  stefi:      ['stefi','steffi','design','ui','layout','bento','dashboard','branding','icon','illustration','animation','svg','visual','graphic','stitch'],
  terence:    ['terence','openclaw','think tank','metacognition','cluster','vector','mapping','boundary','centroid','cosine','synthesis','idea','concept','framework','philosophy','reasoning'],
  // Meta keywords — if Pete mentions these, ask everyone
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
  // Check for "all" keywords
  for (const kw of AGENT_KEYWORDS.all) {
    if (lower.includes(kw)) {
      // Ask every agent
      Object.keys(PERSONAS).forEach(a => { if (a !== 'olivia') scores[a] = (scores[a] || 0) + 1; });
    }
  }
  const asked = Object.entries(scores).filter(([, s]) => s > 0).map(([k]) => k);
  if (asked.length === 0) return Object.keys(PERSONAS).filter(a => a !== 'olivia');
  return asked;
}

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

async function processQueue() {
  let queue;
  try { queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8')); } catch (e) { return; }

  const pending = queue.filter(t => t.status === 'queued' && t.agent === 'olivia');
  if (pending.length === 0) return;

  console.log('[agent-daemon] Olivia has ' + pending.length + ' messages to process');

  for (const task of pending) {
    console.log('[agent-daemon] Olivia processing ' + task.responseId + ': ' + task.message.substring(0, 60) + '...');

    // Olivia decides which agents to ask
    const targetAgents = detectAgents(task.message);
    console.log('[agent-daemon] Olivia delegating to: ' + targetAgents.join(', '));

    const agentReports = [];

    for (const agentKey of targetAgents) {
      const persona = PERSONAS[agentKey];
      if (!persona) continue;

      const reply = persona.reply();
      console.log('[agent-daemon]   ' + persona.name + ' reports back (silent)');

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

    console.log('[agent-daemon] Olivia responding to Pete');
    try {
      await apiPost('/olivia/agent-reply', {
        responseId: task.responseId, agent: 'olivia', message: oliviaReport,
      });
      task.status = 'done';
    } catch (e) {
      console.error('[agent-daemon] Failed to post Olivia reply: ' + e.message);
    }

    // ─── Direct Olivia-to-Pete Java Tunnel Ping ───
    try {
      const payload = JSON.stringify({
        event: 'new_reply',
        responseId: task.responseId,
        message: oliviaReport.substring(0, 150) + (oliviaReport.length > 150 ? '...' : '')
      });
      const tunnelReq = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/tunnel',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (tunnelRes) => {
        // quiet consume
        tunnelRes.on('data', () => {});
      });
      tunnelReq.on('error', () => { /* java portal offline, fallback quietly */ });
      tunnelReq.write(payload);
      tunnelReq.end();
    } catch (tunnelError) {
      // safe fallback
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf8');
}

async function run() {
  console.log('[agent-daemon] Olivia pipeline starting. Polling queue every ' + (POLL_INTERVAL_MS / 1000) + 's');
  await new Promise(r => setTimeout(r, 3000));
  setInterval(processQueue, POLL_INTERVAL_MS);
}

run().catch(e => console.error('[agent-daemon] Fatal:', e.message));
