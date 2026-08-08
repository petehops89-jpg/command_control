/**
 * Big Brother — Google Docs OAuth Setup
 * 
 * One-time setup: opens browser, authorizes Google Docs read access,
 * saves credentials for daily cron use.
 * 
 * Usage: node scripts/setup-google-docs-auth.js
 */
const fs = require('fs');
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials', 'google-docs-oauth.json');
const TOKEN_PATH = path.join(__dirname, '..', 'credentials', 'google-docs-token.json');
const SCOPES = [
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
];

async function main() {
    // Check for client secrets
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        console.log('[BLOCKED] OAuth client secrets not found.');
        console.log('');
        console.log('To get credentials:');
        console.log('1. Go to https://console.cloud.google.com/apis/credentials');
        console.log('2. Create an OAuth 2.0 Client ID (Desktop application)');
        console.log('3. Download the JSON file');
        console.log('4. Save it as: credentials/google-docs-oauth.json');
        console.log('');
        console.log('The file should look like:');
        console.log('{');
        console.log('  "installed": {');
        console.log('    "client_id": "...",');
        console.log('    "client_secret": "...",');
        console.log('    "redirect_uris": ["http://localhost"]');
        console.log('  }');
        console.log('}');
        process.exit(1);
    }

    console.log('[OK] Client secrets found.');
    console.log('[AUTH] Opening browser for Google Docs authorization...');
    console.log('       Log in as petehops89@gmail.com');

    try {
        const client = await authenticate({
            scopes: SCOPES,
            keyfilePath: CREDENTIALS_PATH,
        });

        // Verify access
        const docs = google.docs({ version: 'v1', auth: client });
        const drive = google.drive({ version: 'v3', auth: client });

        // Test: list recent docs
        const res = await drive.files.list({
            pageSize: 5,
            fields: 'files(id, name, modifiedTime)',
            orderBy: 'modifiedTime desc',
        });

        console.log('[OK] Authentication successful!');
        console.log('[TEST] Recent documents:');
        for (const file of res.data.files || []) {
            console.log(`  - ${file.name} (${file.id}) — modified ${file.modifiedTime}`);
        }

        // Save token
        const tokenDir = path.dirname(TOKEN_PATH);
        if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { recursive: true });
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(client.credentials, null, 2));
        console.log(`[SAVED] Token saved to ${TOKEN_PATH}`);
        console.log('[READY] Google Docs daily reader can now run.');

    } catch (err) {
        console.error('[FAIL] ' + err.message);
        process.exit(1);
    }
}

main();
