/**
 * Big Brother — Google Docs Daily Reader
 * 
 * Reads 10,000 words/day from Google Docs, discerns relevance for Vistamations,
 * and reports findings to Olivia via the command portal.
 * 
 * Scheduled: daily via Windows Task Scheduler
 * Usage: node scripts/google-docs-reader.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

const TOKEN_PATH = path.join(__dirname, '..', 'credentials', 'google-docs-token.json');
const STATE_PATH = path.join(__dirname, '..', 'crons', 'openclaw', 'big-brother', 'docs-reader-state.json');
const OLIVIA_API = 'http://localhost/api/olivia/respond';
const TARGET_WORDS = 10000;

// ─── Vistamations relevance keywords for discernment ───
const DISCERNMENT_KEYWORDS = {
    high: [
        'agent development kit', 'adk', 'vertex ai agent',
        'retrieval augmented generation', 'rag', 'vector database', 'embedding',
        'gemini', 'gemini api', 'gemini 3', 'google genai',
        'suno', 'suno ai', 'music generation', 'ai music',
        'neo classical', 'shred guitar', 'guitar theory',
        'prompt engineering', 'chain of thought', 'few shot',
        'agent orchestration', 'multi agent', 'agent memory',
        'docker', 'container', 'kubernetes', 'microservice',
        'node.js', 'express', 'redis', 'nginx',
    ],
    medium: [
        'python', 'javascript', 'typescript',
        'api design', 'rest', 'graphql',
        'ci/cd', 'github actions', 'devops',
        'machine learning', 'deep learning', 'neural network',
        'web scraping', 'data pipeline', 'etl',
        'cloud', 'google cloud', 'aws',
        'security', 'authentication', 'oauth',
    ],
};

const DISCERNMENT_CATEGORIES = {
    'ADK & Agent Architecture': ['agent development kit', 'adk', 'vertex ai agent', 'agent orchestration', 'multi agent'],
    'RAG & Vector Systems': ['retrieval augmented generation', 'rag', 'vector database', 'embedding'],
    'Gemini & Vertex AI': ['gemini', 'gemini api', 'gemini 3', 'google genai', 'vertex ai'],
    'Music AI & Suno': ['suno', 'suno ai', 'music generation', 'ai music', 'neo classical', 'shred guitar'],
    'Prompt Engineering': ['prompt engineering', 'chain of thought', 'few shot'],
    'Infrastructure & DevOps': ['docker', 'container', 'kubernetes', 'nginx', 'redis', 'ci/cd', 'github actions'],
    'API & Backend': ['api design', 'rest', 'graphql', 'node.js', 'express', 'python', 'typescript'],
    'Data & ML': ['machine learning', 'deep learning', 'data pipeline', 'etl', 'web scraping'],
};

function wordCount(text) {
    return text.split(/\s+/).filter(w => w.length > 0).length;
}

function discernRelevance(text) {
    const lower = text.toLowerCase();
    const hits = { high: [], medium: [] };
    const categoryHits = {};

    for (const kw of DISCERNMENT_KEYWORDS.high) {
        if (lower.includes(kw)) hits.high.push(kw);
    }
    for (const kw of DISCERNMENT_KEYWORDS.medium) {
        if (lower.includes(kw)) hits.medium.push(kw);
    }

    for (const [category, keywords] of Object.entries(DISCERNMENT_CATEGORIES)) {
        const matched = keywords.filter(kw => lower.includes(kw));
        if (matched.length > 0) {
            categoryHits[category] = matched;
        }
    }

    const score = hits.high.length * 3 + hits.medium.length * 1;
    return { score, hits, categoryHits, relevant: score >= 5 };
}

function loadState() {
    try {
        if (fs.existsSync(STATE_PATH)) {
            return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
        }
    } catch (e) { /* first run */ }
    return { lastReadDocId: null, totalWordsRead: 0, runs: [] };
}

function saveState(state) {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function postToOlivia(message) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            from: 'Big Brother',
            message: message,
            timestamp: new Date().toISOString(),
        });
        const req = http.request(OLIVIA_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    console.log('[BB-READER] Big Brother Google Docs Daily Reader starting...');
    console.log(`[BB-READER] Target: ${TARGET_WORDS.toLocaleString()} words`);

    // Check auth
    if (!fs.existsSync(TOKEN_PATH)) {
        console.log('[BB-READER] No OAuth token. Run setup first: node scripts/setup-google-docs-auth.js');
        const msg = 'Big Brother reporting: Google Docs reader is not yet authenticated. '
            + 'Pete, please run the OAuth setup at your convenience. '
            + 'Command: node scripts/setup-google-docs-auth.js';
        await postToOlivia(msg);
        return;
    }

    const state = loadState();
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

    const auth = new google.auth.OAuth2();
    auth.setCredentials(token);

    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Get recent documents
    let files;
    try {
        const res = await drive.files.list({
            pageSize: 20,
            fields: 'files(id, name, modifiedTime, mimeType)',
            orderBy: 'modifiedTime desc',
            q: "mimeType='application/vnd.google-apps.document'",
        });
        files = res.data.files || [];
    } catch (err) {
        console.error('[BB-READER] Drive API error:', err.message);
        await postToOlivia('Big Brother: Google Docs reader failed — Drive API error: ' + err.message);
        return;
    }

    if (files.length === 0) {
        console.log('[BB-READER] No Google Docs found.');
        return;
    }

    console.log(`[BB-READER] Found ${files.length} recent documents`);

    let wordsRead = 0;
    const findings = [];
    const newFindings = [];

    for (const file of files) {
        if (wordsRead >= TARGET_WORDS) break;
        if (file.id === state.lastReadDocId) continue;

        try {
            const doc = await docs.documents.get({ documentId: file.id });
            const content = doc.data.body.content || [];

            // Extract text
            let text = '';
            for (const element of content) {
                if (element.paragraph) {
                    for (const paraElement of element.paragraph.elements || []) {
                        if (paraElement.textRun) {
                            text += paraElement.textRun.content;
                        }
                    }
                }
            }

            const wc = wordCount(text);
            wordsRead += wc;

            const discernment = discernRelevance(text);

            console.log(`[BB-READER] "${file.name}" — ${wc} words, relevance: ${discernment.score}`);

            if (discernment.relevant) {
                const finding = {
                    docName: file.name,
                    docId: file.id,
                    wordCount: wc,
                    relevanceScore: discernment.score,
                    categories: Object.keys(discernment.categoryHits),
                    categoryDetails: discernment.categoryHits,
                    keywords: discernment.hits.high.slice(0, 5),
                };
                findings.push(finding);
                if (!state.runs.some(r => r.docId === file.id)) {
                    newFindings.push(finding);
                }
            }

        } catch (err) {
            console.error(`[BB-READER] Error reading "${file.name}":`, err.message);
        }
    }

    // Update state
    state.lastReadDocId = files[0]?.id || state.lastReadDocId;
    state.totalWordsRead += wordsRead;
    state.runs.push({
        date: new Date().toISOString(),
        wordsRead,
        documentsScanned: files.length,
        findingsCount: findings.length,
        newFindingsCount: newFindings.length,
    });
    // Keep last 30 runs
    if (state.runs.length > 30) state.runs = state.runs.slice(-30);
    saveState(state);

    // Report to Olivia
    let report = `Big Brother — Google Docs Daily Reader Report\n\n`;
    report += `Words read: ${wordsRead.toLocaleString()} / ${TARGET_WORDS.toLocaleString()}\n`;
    report += `Documents scanned: ${files.length}\n`;
    report += `Relevant findings: ${findings.length} (${newFindings.length} new)\n\n`;

    if (findings.length > 0) {
        report += `Relevance by category:\n`;
        const catCounts = {};
        for (const f of findings) {
            for (const cat of f.categories) {
                catCounts[cat] = (catCounts[cat] || 0) + 1;
            }
        }
        for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
            report += `  - ${cat}: ${count} doc(s)\n`;
        }
        report += `\nTop documents:\n`;
        for (const f of findings.slice(0, 5)) {
            report += `  - "${f.docName}" (score: ${f.relevanceScore}, ${f.wordCount} words)\n`;
            report += `    Categories: ${f.categories.join(', ')}\n`;
        }
    } else {
        report += `No Vistamations-relevant content found in today's scan.\n`;
    }

    report += `\nTotal words read (all time): ${state.totalWordsRead.toLocaleString()}`;
    report += `\nNext scan: tomorrow`;

    console.log('[BB-READER] Posting report to Olivia...');
    await postToOlivia(report);
    console.log('[BB-READER] Done.');
}

main().catch(err => {
    console.error('[BB-READER] Fatal:', err.message);
    postToOlivia('Big Brother: Google Docs reader encountered a fatal error: ' + err.message);
});
