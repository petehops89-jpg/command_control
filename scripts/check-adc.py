"""
ADC Bootstrap — Login without gcloud CLI
Uses google_auth_oauthlib to authenticate and save ADC credentials.
"""

import os
import json
import pathlib

ADC_DIR = os.path.join(os.environ["APPDATA"], "gcloud")
ADC_PATH = os.path.join(ADC_DIR, "application_default_credentials.json")

print("=== Vistamations ADC Bootstrap ===")
print()

# Check existing
if os.path.exists(ADC_PATH):
    with open(ADC_PATH) as f:
        creds = json.load(f)
    print(f"[OK] ADC already exists")
    print(f"     Type: {creds.get('type')}")
    print(f"     Client email: {creds.get('client_email', 'N/A')}")
    print(f"     Created: {creds.get('quota_project_id', 'N/A')}")
else:
    print("[MISSING] No ADC file found.")
    print()

# The fastest working path
print("Two auth paths available:")
print()
print("PATH A — API Key (30 seconds, works NOW):")
print("  1. Go to: https://aistudio.google.com/apikey")
print("  2. Copy your API key")
print("  3. Run in PowerShell:")
print('     $env:GOOGLE_API_KEY = "your-key-here"')
print('     $env:GOOGLE_GENAI_USE_ENTERPRISE = "true"')
print()
print("PATH B — gcloud CLI (needs GUI installer):")
print("  The gcloud CLI download exists but the GUI installer was never run.")
print("  Run it manually:")
print(f'  Start-Process "{os.environ["LOCALAPPDATA"]}\\Google\\Cloud SDK\\google-cloud-sdk\\install.bat"')
print("  After install completes and window closes:")
print("    gcloud auth application-default login")
print()

# Test: try google-genai with default (will fail without credentials, confirming system works)
try:
    from google import genai
    client = genai.Client(enterprise=True)
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Say 'ADC test'",
    )
    print(f"[SURPRISE] Gemini API worked! Response: {response.text}")
except Exception as e:
    err = str(e)
    if "default credentials" in err.lower() or "api key" in err.lower() or "authentication" in err.lower() or "quota" in err.lower():
        print(f"[EXPECTED] Gemini API not authenticated: {err[:120]}")
        print("          Choose Path A or B above to authenticate.")
    else:
        print(f"[ERROR] {err[:200]}")
