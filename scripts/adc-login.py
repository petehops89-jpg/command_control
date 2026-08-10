"""
Vistamations Gemini Auth — Direct OAuth ADC Login
No gcloud CLI required. Opens browser, you log in as petehops89@gmail.com,
token saved to the standard ADC location that all Google SDKs auto-detect.

Usage: python scripts/adc-login.py
"""
import os
import json
import pathlib
import webbrowser
import sys

# Standard ADC location that google-genai, google-auth, gcloud all look for
ADC_DIR = os.path.join(os.environ["APPDATA"], "gcloud")
ADC_PATH = os.path.join(ADC_DIR, "application_default_credentials.json")
TOKEN_PATH = os.path.join(ADC_DIR, "access_tokens.db")

# OAuth scopes for Google Cloud Platform
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
]

# Default gcloud OAuth client (public, embedded in all Google CLI tools)
CLIENT_ID = "32555940559.apps.googleusercontent.com"
CLIENT_SECRET = "ZmssLNjJy2998hD4CTg2ejr2"

print("=== Vistamations ADC Direct Login ===")
print("Using default Google Cloud OAuth client")
print()

# Check if already authenticated
if os.path.exists(ADC_PATH):
    with open(ADC_PATH) as f:
        existing = json.load(f)
    print(f"[OK] ADC credentials exist!")
    print(f"     Type: {existing.get('type')}")
    print(f"     Email: {existing.get('client_email', 'N/A')}")
    print(f"     Project: {existing.get('quota_project_id', 'N/A')}")
    print()
    
    # Try using them
    try:
        from google import genai
        client = genai.Client(enterprise=True)
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents="Say: ADC is working",
        )
        print(f"[TEST] Gemini API: {response.text.strip()}")
        print("[READY] Gemini is authenticated and working!")
        sys.exit(0)
    except Exception as e:
        print(f"[WARN] Existing ADC token may be expired: {e}")
        print("       Will re-authenticate...")
        print()

# Start OAuth flow
print("Starting OAuth login flow...")
print(f"Credential location: {ADC_PATH}")
print()

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
    
    # Create the flow manually (we have the client_id/secret)
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    import socket
    
    # Find a free port for the callback server
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('localhost', 0))
    port = sock.getsockname()[1]
    sock.close()
    
    redirect_uri = f"http://localhost:{port}"
    
    # Build OAuth client config
    client_config = {
        "installed": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uris": [redirect_uri],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    
    # Write temp config
    temp_config_path = os.path.join(os.environ["TEMP"], "vistamations_oauth_client.json")
    with open(temp_config_path, "w") as f:
        json.dump(client_config, f)
    
    flow = InstalledAppFlow.from_client_secrets_file(
        temp_config_path,
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )
    
    # Run local server for OAuth callback
    print(f"[AUTH] Starting local server on port {port}...")
    print(f"[AUTH] Opening browser — log in as petehops89@gmail.com")
    print()
    
    credentials = flow.run_local_server(
        port=port,
        authorization_prompt_message="Please visit this URL to authorize: {url}",
        success_message="Authorization complete! You may close this window.",
        open_browser=True,
    )
    
    # Save to standard ADC location
    os.makedirs(ADC_DIR, exist_ok=True)
    
    adc_data = {
        "type": "authorized_user",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": credentials.refresh_token,
        "access_token": credentials.token,
        "token_uri": "https://oauth2.googleapis.com/token",
        "scopes": SCOPES,
    }
    
    with open(ADC_PATH, "w") as f:
        json.dump(adc_data, f, indent=2)
    
    # Clean up temp config
    os.remove(temp_config_path)
    
    print()
    print(f"[SAVED] ADC credentials → {ADC_PATH}")
    print("[READY] All Google SDKs can now authenticate automatically.")
    print()
    print("Testing Gemini API...")
    
    try:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = ADC_PATH
        from google import genai
        client = genai.Client(enterprise=True)
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents="Say: ADC login successful. gem ready.",
        )
        print(f"[TEST] {response.text.strip()}")
        print("[SUCCESS] Gemini authenticated. gem daemon ready for build.")
    except Exception as e:
        print(f"[WARN] Token saved but API test failed: {e}")
        print("       Token may need a project set. Try: gcloud config set project PROJECT_ID")
    
except ImportError as e:
    print(f"[BLOCKED] Missing: {e}")
    print("Run: pip install google-auth-oauthlib google-genai")
    sys.exit(1)
except Exception as e:
    print(f"[FAILED] {e}")
    sys.exit(1)
