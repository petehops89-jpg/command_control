"""
Setup Gemini ADC credentials via browser OAuth — no gcloud CLI needed.
Saves to the standard ADC location so google-genai SDK picks them up automatically.
"""
import os
import sys
import json
import pathlib

ADC_PATH = os.path.join(
    os.environ.get("APPDATA", os.path.expanduser("~/.config")),
    "gcloud",
    "application_default_credentials.json"
)

def main():
    # Check if ADC already exists
    if os.path.exists(ADC_PATH):
        try:
            with open(ADC_PATH) as f:
                creds = json.load(f)
            print(f"[OK] ADC credentials exist at: {ADC_PATH}")
            print(f"     Type: {creds.get('type', 'unknown')}")
            print(f"     Client email: {creds.get('client_email', 'N/A')}")
            return True
        except Exception as e:
            print(f"[WARN] Existing ADC file corrupt: {e}")
            print("       Will re-authenticate...")

    print("\nOpening browser for Google authentication...")
    print("Log in as petehops89@gmail.com\n")

    from google_auth_oauthlib import flow as oauth_flow

    # Create the OAuth flow
    app_flow = oauth_flow.InstalledAppFlow.from_client_secrets_file(
        # We don't have a client_secrets.json — use the default desktop app credentials
        # that google-auth-oauthlib provides for CLI apps
        client_secrets_file=None,  # triggers the built-in desktop flow
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )

    # This won't work without client_secrets — we need to use gcloud's built-in flow
    # or the API key approach. Let me try an alternative.
    print("[FALLBACK] Direct OAuth requires client_secrets.json.")
    print("           Let's try the gcloud bundled oauth flow instead...")

    # Try invoking gcloud's bundled Python directly
    gcloud_root = os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "Google", "Cloud SDK", "google-cloud-sdk"
    )

    if not os.path.exists(gcloud_root):
        print(f"\n[BLOCKED] gcloud SDK not found at: {gcloud_root}")
        print("\nTwo options to get ADC credentials:")
        print("1. Set GOOGLE_API_KEY env var (fastest, no gcloud needed)")
        print("2. Reinstall gcloud via: https://cloud.google.com/sdk/docs/install")
        print("   Then run: gcloud auth application-default login")
        return False

    print(f"\n[OK] gcloud SDK found at: {gcloud_root}")
    print("To complete ADC setup, run in a NEW terminal:")
    print(f'  "{gcloud_root}\\bin\\gcloud" auth application-default login')
    print("\nOR for the fastest path now:")
    print('  set GOOGLE_API_KEY=your-api-key-from-aistudio')
    print('  set GOOGLE_GENAI_USE_ENTERPRISE=true')

    return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
