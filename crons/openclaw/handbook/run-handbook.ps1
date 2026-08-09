$env:GOOGLE_CLOUD_PROJECT = 'vists-498322'
$env:GOOGLE_CLOUD_LOCATION = 'global'
$env:GOOGLE_GENAI_USE_VERTEXAI = 'true'
$env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
$env:GEMINI_CLI_TRUST_WORKSPACE = 'true'
& "C:\Program Files\nodejs\node.exe" "C:\vistamations-music\scripts\generate-handbook.js" 2>&1 >> "C:\vistamations-music\crons\openclaw\handbook\handbook.log"
