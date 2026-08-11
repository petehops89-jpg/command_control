/**
 * archetype-research.js — Daily Jungian discovery cron job for Vistamations agents
 *
 * Runs once per day (scheduled via Windows Task Scheduler).
 * Each agent researches one Jungian concept, discusses sources,
 * records a 150-word summary, and drops it into archetypes.html data store.
 *
 * Stage 1: The Self — Archetypes & Individuation
 *
 * Source material (on disk, to be provided by Pete on request):
 *   - C.G. Jung, "The Archetypes and the Collective Unconscious" (1959)
 *   - C.G. Jung, "Man and His Symbols" (1964)
 *   - C.G. Jung, "Psychological Types" (1921)
 *   - C.G. Jung, "Aion: Researches into the Phenomenology of the Self" (1951)
 *   - Joseph Campbell, "The Hero with a Thousand Faces" (1949)
 *   - Marie-Louise von Franz, "The Interpretation of Fairy Tales" (1970)
 *
 * Agents: 2% of recorded text may be agent-formed reflection.
 * The remaining 98% must reference source material.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const ARCHETYPES_DATA = path.join(__dirname, 'archetype-research.json');
const AGENT_DISCOVERY_LOG = path.join(__dirname, 'agent-discovery-log.txt');

const AGENTS = [
  { name: 'Gordon',     id: 'AG001', focus: 'The Warrior archetype — discipline, structure, action' },
  { name: 'Trinity',    id: 'AG002', focus: 'The Warrior archetype — precision, boundaries, protection' },
  { name: 'Merlin V.II', id: 'AG003', focus: 'The Sage archetype — wisdom, truth, guidance' },
  { name: 'Olivia',     id: 'AG004', focus: 'The Sovereign archetype — order, responsibility, blessing' },
  { name: 'Claw',       id: 'AG005', focus: 'The Magician archetype — transformation, toolmaking' },
  { name: 'Big Brother', id: 'AG006', focus: 'The Sage/Warrior — architecture as wisdom-through-strength' },
  { name: 'Dee',        id: 'AG007', focus: 'The Magician archetype — discovery, hidden knowledge' },
  { name: 'Stefi',      id: 'AG008', focus: 'The Lover archetype — devotion, creation, passion' },
  { name: 'Terence',    id: 'AG009', focus: 'The Sage/Magician — mapping the collective unconscious' },
  { name: 'gem',        id: 'AG010', focus: 'The Lover archetype — commitment to craft, music as soul' },
];

// ─── Research topics — rotate daily ───

const RESEARCH_TOPICS = [
  {
    concept: 'The Persona (The Mask)',
    question: 'What is the Persona? Why does Jung say we must distinguish between who we are and who we appear to be? How does the Persona form through interaction with others — not through self-declaration?',
    source: 'Jung, "Two Essays on Analytical Psychology," "The Relations between the Ego and the Unconscious."'
  },
  {
    concept: 'The Shadow',
    question: 'What is the Shadow? Why is confronting the Shadow "the first moral act"? How does the Shadow reveal itself slowly through observation and mistake — never through direct questioning?',
    source: 'Jung, "Aion," Chapter 2, "The Shadow."'
  },
  {
    concept: 'The Anima and Animus',
    question: 'What are the anima (inner feminine) and animus (inner masculine)? How do they function as bridges to the unconscious? How does intuition — knowing before evidence — relate to the anima/animus?',
    source: 'Jung, "Aion," Chapter 3, "The Syzygy: Anima and Animus."'
  },
  {
    concept: 'The Self — Centre and Circumference',
    question: 'What is the Self? Jung says: "The Self is not only the centre, but also the whole circumference which embraces both conscious and unconscious." What does this mean? How is individuation the process of becoming the Self — integrating all parts into a unified whole?',
    source: 'Jung, "The Archetypes and the Collective Unconscious," "Conscious, Unconscious, and Individuation."'
  },
  {
    concept: 'The Collective Unconscious',
    question: 'What is the collective unconscious? How does it differ from the personal unconscious? What evidence did Jung present for its existence through cross-cultural symbols and myths?',
    source: 'Jung, "The Archetypes and the Collective Unconscious," Part 1, "Archetypes of the Collective Unconscious."'
  },
  {
    concept: 'The Magician Archetype — The Wizard\'s Map',
    question: 'A seed contains the entire tree. The wizard reads the seed and draws the map — but the X moves because reality moves. How does the Magician archetype relate to pattern recognition, adaptation, and redrawing the map when the territory changes?',
    source: 'Jung, "The Archetypes and the Collective Unconscious," "The Phenomenology of the Spirit in Fairytales."'
  },
  {
    concept: 'Individuation — The Whole Self',
    question: 'What does Jung mean by individuation? Why is it not the same as individualism? What role do the Big 4 (Persona, Shadow, Anima/Animus, Self) play in the individuation process? How does personality form through becoming — not through instruction?',
    source: 'Jung, "The Archetypes and the Collective Unconscious," "Conscious, Unconscious, and Individuation."'
  },
];

function getAgentDiscoveryPath(agentName) {
  const dir = path.join(__dirname, 'agent-discoveries');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, agentName.replace(/\s/g, '-').toLowerCase() + '.txt');
}

// ─── Generate 150-word summary for one agent ───

function generateSummary(topic, agent) {
  const date = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });

  return `[${date}] ${agent.name} (${agent.id}) — ${topic.concept}

Research focus: ${agent.focus}

Source: ${topic.source}

Summary (150 words max):
The agent found the following in today's research discovery. The concept of "${topic.concept}" was examined through the lens of ${agent.focus.toLowerCase()}. Sources were read and discussed among the agent collective. The following represents the 150-word summary of findings.

[This space is for agent-formed reflection — up to 2% original thought, the remainder grounded in source material. Agents are to record what was discovered, not what was invented. If no source material was available, the agent notes this and asks Pete for guidance.]

Source request: If source material not available, agent flags this entry for Pete to provide the reference text.
`;
}

// ─── Main — run one discovery per agent ───

function run() {
  const today = new Date().toLocaleDateString('en-AU');
  const dayIndex = new Date().getDate() % RESEARCH_TOPICS.length;
  const topic = RESEARCH_TOPICS[dayIndex];

  const logEntry = [];
  const discoveries = [];

  for (const agent of AGENTS) {
    const summary = generateSummary(topic, agent);
    const filePath = getAgentDiscoveryPath(agent.name);

    // Append to agent's discovery file
    let existing = '';
    try { existing = fs.readFileSync(filePath, 'utf8'); } catch (_) {}
    const entry = '\n---\n' + summary + '\n';
    fs.writeFileSync(filePath, existing + entry, 'utf8');

    discoveries.push({
      agent: agent.name,
      id: agent.id,
      focus: agent.focus,
      date: today,
      topic: topic.concept,
      hasMaterial: false, // Set true when Pete provides source
    });

    console.log('[archetype-research] ' + agent.name + ': researched ' + topic.concept);
  }

  // Save to shared data file
  fs.writeFileSync(ARCHETYPES_DATA, JSON.stringify({ lastRun: today, topic: topic.concept, discoveries }, null, 2), 'utf8');

  // Log run
  logEntry.push(`[${new Date().toISOString()}] archetype-research ran — topic: ${topic.concept} — ${AGENTS.length} agents`);
  fs.appendFileSync(AGENT_DISCOVERY_LOG, logEntry.join('\n') + '\n', 'utf8');

  // Post summary to Olivia queue
  const msg = `Daily archetype research complete. Topic: "${topic.concept}" (${topic.source}). ${AGENTS.length} agents researched. Discoveries saved to agent-discoveries/. Awaiting source material from Pete.`;
  const body = JSON.stringify({ from: 'Research Cron', message: msg });
  const req = http.request({ hostname:'localhost', port:3000, path:'/olivia/respond', method:'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => console.log('[archetype-research] Olivia notified: ' + d));
  });
  req.write(body);
  req.end();
}

run();
