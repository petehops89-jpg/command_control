/**
 * Gemini Auth Test — Express Mode (API Key)
 * 
 * Usage:
 *   set GOOGLE_API_KEY=your-key-from-https://aistudio.google.com/apikey
 *   set GOOGLE_GENAI_USE_ENTERPRISE=true
 *   node scripts/test-gemini-auth.js
 */
const { GoogleGenAI } = require('@google/genai');

async function main() {
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
        console.log('[BLOCKED] GOOGLE_API_KEY environment variable not set.');
        console.log('');
        console.log('Fastest path to working auth:');
        console.log('  1. Go to https://aistudio.google.com/apikey');
        console.log('  2. Copy your API key');
        console.log('  3. Run: set GOOGLE_API_KEY=your-key-here');
        console.log('  4. Run: set GOOGLE_GENAI_USE_ENTERPRISE=true');
        console.log('  5. Re-run: node scripts/test-gemini-auth.js');
        console.log('');
        console.log('ADC path (requires gcloud GUI installer):');
        console.log('  1. Run the downloaded installer at:');
        console.log('     %LOCALAPPDATA%\\Google\\Cloud SDK\\google-cloud-sdk\\install.bat');
        console.log('     OR download fresh: https://cloud.google.com/sdk/docs/install');
        console.log('  2. Complete the GUI wizard');
        console.log('  3. Run: gcloud auth application-default login');
        process.exit(1);
    }
    
    console.log(`[OK] GOOGLE_API_KEY found (${apiKey.length} chars)`);
    console.log('[TEST] Connecting to Gemini 3.5 Flash...');
    
    const ai = new GoogleGenAI({ 
        enterprise: true,
        apiKey: apiKey,
    });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: 'Reply with exactly: "Gemini auth verified. gem reporting for duty."',
        });
        
        console.log('[OK] Auth successful!');
        console.log('[RESPONSE] ' + response.text);
        console.log('');
        console.log('gem daemon ready for build.');
    } catch (err) {
        console.error('[FAIL] ' + err.message);
        if (err.message.includes('API key')) {
            console.error('[HINT] Check your API key at https://aistudio.google.com/apikey');
        }
        process.exit(1);
    }
}

main();
