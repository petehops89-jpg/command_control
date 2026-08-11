"""
Vistamations ADC Login - Simple Manual Flow
No complex OAuth server. Just opens browser, you authorize, paste nothing.
Uses the standard gcloud auth application-default login.
"""
import os
import sys

print("=== Vistamations ADC Login ===")
print("")

# Use gcloud CLI which handles the OAuth flow properly
gcloud_bin = r"C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

# Check if already logged in with gcloud
import subprocess
result = subprocess.run([gcloud_bin, "auth", "application-default", "print-access-token"], 
                       capture_output=True, text=True, timeout=10)
if result.returncode == 0:
    print("[OK] ADC is already authenticated")
    print(f"     Token: {result.stdout.strip()[:20]}...")
    
    # Verify email
    import requests
    info = requests.get(f"https://www.googleapis.com/oauth2/v3/tokeninfo?access_token={result.stdout.strip()}").json()
    print(f"     Email: {info.get('email', 'unknown')}")
    print("[READY] ADC working")
    sys.exit(0)

# Not authenticated - use gcloud login
print("ADC not found. Running gcloud auth application-default login...")
print("A browser will open. Select petehops89@gmail.com and authorize.")
print("")

result = subprocess.run([gcloud_bin, "auth", "application-default", "login", 
                        "--scopes=https://www.googleapis.com/auth/cloud-platform,openid,https://www.googleapis.com/auth/userinfo.email"],
                       timeout=300)
if result.returncode == 0:
    print("")
    print("[SAVED] ADC credentials stored")
    print("[READY] Google SDKs can now authenticate")
else:
    print(f"[FAILED] gcloud returned code {result.returncode}")
    sys.exit(1)
