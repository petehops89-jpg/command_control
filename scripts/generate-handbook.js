/**
 * Vistamations User Handbook — Cron Generator
 * 3 runs, 1500 words each. Uses Gemini API.
 * Run via: node scripts/generate-handbook.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { GoogleGenAI } = require('@google/genai');

const STATE_PATH = path.join(__dirname, '..', 'crons', 'openclaw', 'handbook', 'handbook-state.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'handbook');
const OLIVIA_API = 'http://localhost/api/olivia/respond';

const RUNS = [
  {
    id: 1,
    title: 'Setup & Installation',
    topic: 'Vistamations setup guide',
    prompt: `You are writing the official Vistamations User Handbook. Write Section 1: Setup & Installation. Write 1500 words of actual technical documentation content. Do NOT write meta-commentary about word counts. Do NOT describe what you will write. Just write the handbook content directly.

Start immediately with:

# Vistamations User Handbook
## Section 1: Setup & Installation

### System Requirements
(Write 200 words on Windows/Docker/Node/PowerShell requirements)

### Docker Compose Stack
(Write 250 words on the 4-container stack with docker-compose.yml reference)

### Environment Configuration
(Write 200 words on .env, ADC auth, API key setup)

### Git Setup & Branch Strategy
(Write 200 words on evidence-registry workflow, cloning, branching)

### Windows Task Scheduler
(Write 250 words on the 7 scheduled tasks with actual task names and schedules)

### Olivia Command Portal
(Write 150 words on accessing http://localhost, agent messaging)

### Agent Registration
(Write 150 words on AG001-AG010 roster, ID convention)

### Gemini API Integration
(Write 150 words on Vertex AI vs Express Mode, project setup)

Write each section as complete prose. Include actual commands, file paths, and task names. Target exactly 1500 words of real content.`
  },
  {
    id: 2,
    title: 'The Wizard & Agent Onboarding',
    topic: 'Agent onboarding wizard guide',
    prompt: `You are writing the official Vistamations User Handbook. Write Section 2: The Wizard & Agent Onboarding. Write 1500 words of actual technical documentation content. Do NOT write meta-commentary. Just write the handbook directly.

Start immediately with:

## Section 2: The Wizard & Agent Onboarding

### Dominion I Agent Roster
(Write 250 words listing all 10 agents with their IDs, roles, and models)

### Agent ID Convention
(Write 150 words on the org-AG###-base-env format)

### Reporting Chain
(Write 150 words on Player -> Merlin -> Olivia -> agents hierarchy)

### Agent Personas
(Write 250 words on agent-daemon.js PERSONAS object, keyword routing, example code)

### The Onboarding Wizard
(Write 300 words on the 4-step wizard: Identity, Domain, Capabilities, Confirm — with form field descriptions)

### Agent Clusters
(Write 200 words on base-env, engineering, operations, research, design, music clusters)

### Model Assignments
(Write 200 words on DeepSeek V4 Pro vs Mistral Large 3 vs Gemini 3.5 Flash assignments)

Include actual JSON examples, keyword arrays, and REST endpoints. Target exactly 1500 words of real content.`
  },
  {
    id: 3,
    title: 'Deploy to Cloud & Expand',
    topic: 'Cloud deployment and expansion',
    prompt: `You are writing the official Vistamations User Handbook. Write Section 3: Deploy to Cloud & Expand. Write 1500 words of actual technical documentation content. Do NOT write meta-commentary. Just write the handbook directly.

Start immediately with:

## Section 3: Deploy to Cloud & Expand

### Domain Setup
(Write 200 words on www.vistamations.com, Cloudflare DNS, nameservers, A records, SSL)

### Cloudflare D1 Database
(Write 250 words on wrangler CLI setup, schema migration, REST API worker, D1 schema tables)

### Cloudflare Pages
(Write 150 words on static site hosting, syncing local HTML to production)

### Gemini API Cloud Integration
(Write 200 words on Vertex AI project vists-498322, ADC auth, SDK verification)

### Google Cloud Projects
(Write 150 words on the 7-project structure, gen-lang-client-0847771392 default)

### Agents CLI Toolchain
(Write 200 words on ADK v2.6.3, 7 skills, 13 platforms, 56 agents)

### Google Docs Daily Reader
(Write 150 words on OAuth setup, 10K words/day cron, keyword discernment)

### Music AI (gem) Cloud
(Write 150 words on Suno research, play tracking, taste profiling, Gemini integration)

### Scaling Roadmap
(Write 200 words on local -> cloud -> multi-region strategy, Cloudflare Cron vs Task Scheduler)

Include actual wrangler commands, API endpoints, deployment checklists. Target exactly 1500 words of real content.`
  }
];

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (e) {}
  return { currentRun: 0, completed: [], totalWords: 0, startedAt: new Date().toISOString() };
}

function saveState(state) {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function postToOlivia(message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ from: 'Big Brother', message, timestamp: new Date().toISOString() });
    const req = http.request(OLIVIA_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function wordCount(text) {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

async function generateSection(run) {
  const ai = new GoogleGenAI({
    enterprise: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || 'vists-498322',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
  });

  console.log(`[HANDBOOK] Generating Section ${run.id}: ${run.title}...`);

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: run.prompt,
    config: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  });

  const text = response.text;
  const wc = wordCount(text);
  console.log(`[HANDBOOK] Generated ${wc} words`);

  return { text, wordCount: wc };
}

async function main() {
  console.log('[HANDBOOK] Vistamations User Handbook Generator');
  console.log('[HANDBOOK] ====================================');

  const state = loadState();

  if (state.currentRun >= 3) {
    console.log('[HANDBOOK] All 3 runs already completed.');
    console.log(`[HANDBOOK] Total: ${state.totalWords} words across ${state.completed.length} sections.`);
    return;
  }

  const run = RUNS[state.currentRun];

  // Ensure output directory
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    const { text, wordCount: wc } = await generateSection(run);

    // Save section
    const filename = `handbook-${String(run.id).padStart(2,'0')}-${run.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.md`;
    const filePath = path.join(OUTPUT_DIR, filename);

    const header = `# Vistamations User Handbook\n## Section ${run.id}: ${run.title}\n*Generated ${new Date().toISOString()} | ${wc} words*\n\n`;
    fs.writeFileSync(filePath, header + text, 'utf8');

    // Update state
    state.currentRun++;
    state.completed.push({ id: run.id, title: run.title, words: wc, savedTo: filename, at: new Date().toISOString() });
    state.totalWords += wc;
    saveState(state);

    console.log(`[HANDBOOK] Saved: ${filePath}`);
    console.log(`[HANDBOOK] Progress: ${state.currentRun}/3 sections (${state.totalWords} words total)`);

    // Report to Olivia
    const remaining = 3 - state.currentRun;
    const report = `Vistamations User Handbook — Section ${run.id} Complete\n\n` +
      `Section: ${run.title}\nWords: ${wc}\nSaved: ${filename}\n\n` +
      `Progress: ${state.currentRun}/3 sections\n` +
      `Total words: ${state.totalWords}\n` +
      `Remaining: ${remaining} section(s)\n\n` +
      (remaining > 0
        ? `Next run in ~2 minutes. Sections remaining: ${RUNS.slice(state.currentRun).map(r => r.title).join(', ')}.`
        : 'All 3 sections complete. Handbook ready at docs/handbook/.');

    await postToOlivia(report);
    console.log('[HANDBOOK] Reported to Olivia.');

  } catch (err) {
    console.error('[HANDBOOK] Generation failed:', err.message);
    await postToOlivia(`Handbook generation failed on Section ${run.id}: ${err.message}`);
  }

  if (state.currentRun < 3) {
    console.log(`[HANDBOOK] Next run: Section ${state.currentRun + 1} — ${RUNS[state.currentRun].title}`);
  } else {
    console.log('[HANDBOOK] COMPLETE. All 3 sections generated.');
    console.log(`[HANDBOOK] Output: ${OUTPUT_DIR}`);
    console.log(`[HANDBOOK] Total: ${state.totalWords} words`);
  }
}

main();
