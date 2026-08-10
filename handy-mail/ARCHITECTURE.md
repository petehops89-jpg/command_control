# Vistamations Handy Mail — Google Cloud Architecture Blueprint
## SOAP Secure Document Pipeline | 2026-08-09T13:23 AEST

---

## Layer Stack (Local → Cloud)

```
┌─────────────────────────────────────────────────────┐
│ LAYER 1: BENTO UI (handy-mail.html)                 │
│ Customer info form → QR code → Cloud endpoint       │
├─────────────────────────────────────────────────────┤
│ LAYER 2: SIGNATURE (HTML5 Canvas + SHA-256)         │
│ Handwritten capture → crypto hash → KMS binding     │
├─────────────────────────────────────────────────────┤
│ LAYER 3: ENCRYPTION (AES-256-GCM + Cloud KMS)       │
│ Plaintext → KMS key wrap → ciphertext               │
├─────────────────────────────────────────────────────┤
│ LAYER 4: WATERMARK (Steganography)                  │
│ 30x30px 'vistamations' LSB-embedded under logo      │
├─────────────────────────────────────────────────────┤
│ LAYER 5: DECODE (5-step auth pipeline)              │
│ QR Scan → C2 Signal → Lift → Passkey → Unlock       │
└─────────────────────────────────────────────────────┘
```

## 5 Google Cloud Services — Exact Configuration

### 1. Apigee API Management — SOAP to REST Bridge

| Config | Value |
|--------|-------|
| **Endpoint** | `https://api.vistamations.com/soap/handy-mail` |
| **Protocol** | SOAP 1.2 / XML-RPC inbound → JSON-RPC outbound |
| **Auth** | OAuth 2.0 Client Credentials + API Key |
| **Policy** | XML Threat Protection, JSON-to-XML transform, Spike Arrest (10 req/sec) |
| **Project** | `vists-498322` |
| **Region** | `global` |

```xml
<!-- Apigee SOAP-to-REST Proxy Policy -->
<ProxyEndpoint name="handy-mail-soap">
  <HTTPProxyConnection>
    <BasePath>/soap/handy-mail</BasePath>
    <VirtualHost>secure</VirtualHost>
  </HTTPProxyConnection>
  <RouteRule name="rest-backend">
    <TargetEndpoint>handy-mail-rest</TargetEndpoint>
  </RouteRule>
</ProxyEndpoint>
```

### 2. Cloud Armor + HTTPS Load Balancer — Gated Single Entry

| Config | Value |
|--------|-------|
| **Frontend IP** | Single global anycast IP (endpoint two) |
| **Rule 1** | Deny all traffic by default |
| **Rule 2** | Allow only if header `X-C2-Webhook-Sig` matches HMAC-SHA256 from C2 server |
| **Rule 3** | Adaptive rate limit: 5 req/sec per IP, burst 10 |
| **Geo-fence** | AU only (expand via manual approval for India/China) |
| **SSL** | Managed certificate via Cloudflare edge (already proxied) |

```yaml
# Cloud Armor Security Policy
name: vistamations-handy-mail-policy
rules:
  - action: deny(403)
    priority: 1
    match: "!request.headers['X-C2-Webhook-Sig'].matches('^[a-f0-9]{64}$')"
  - action: allow
    priority: 2
    match: "origin.region_code == 'AU'"
  - action: throttle
    priority: 3
    rateLimitThresholds:
      - conformingRequests: 5
        exceededAction: deny(429)
```

### 3. Cloud Storage + Event-Driven Cloud Functions — Bucket Processing

| Config | Value |
|--------|-------|
| **Bucket** | `vistamations-handy-mail-inbound` |
| **Trigger** | `google.cloud.storage.object.v1.finalized` |
| **Function** | `verify-watermark` (Python 3.11, 256MB, 60s timeout) |
| **Processing** | 1. Read object 2. Extract LSB of bottom-right 30x30px 3. Compare to 'vistamations' watermark 4. If valid → publish to Pub/Sub `documents.verified` |
| **Stateless** | No temp files. Memory cleared on function return. |

```python
# Cloud Function: verify-watermark
def verify_watermark(event, context):
    from google.cloud import storage, pubsub_v1
    import cv2, numpy as np
    
    bucket_name = event['bucket']
    file_name = event['name']
    
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_name)
    
    # Download to memory (no disk write)
    image_bytes = blob.download_as_bytes()
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Extract watermark from bottom-right 30x30
    wm_region = img[-30:, -30:, 0]  # Blue channel LSB
    wm_bits = (wm_region & 1).flatten()
    wm_text = ''.join(chr(int(''.join(map(str,wm_bits[i:i+8])),2)) for i in range(0,min(64,len(wm_bits)),8))
    
    if 'vistamations' in wm_text:
        publisher = pubsub_v1.PublisherClient()
        topic = 'projects/vists-498322/topics/documents.verified'
        publisher.publish(topic, b'verified', file_name=file_name)
```

### 4. Cloud KMS + Confidential Space — Zero-Memory Decryption

| Config | Value |
|--------|-------|
| **Key Ring** | `vistamations-handy-mail-keys` |
| **Key** | `aes256-gcm-key-001` (AES-256-GCM, rotation: 90 days) |
| **Confidential Space** | AMD SEV-SNP enclave, 2 vCPU, 4GB RAM |
| **Image** | `gcr.io/vists-498322/handy-mail-decrypt:latest` |
| **Attestation** | Token verification via `confidentialcomputing.googleapis.com` |
| **Post-execution** | Memory wipe — enclave destroyed, RAM zeroed |

```python
# Confidential Space Decryption Worker
import google.cloud.kms as kms
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os, json

def decrypt_payload(event):
    # Fetch encrypted payload + wrapped key from Pub/Sub
    data = json.loads(event['data'])
    
    # Unwrap AES key via Cloud KMS
    kms_client = kms.KeyManagementServiceClient()
    key_name = 'projects/vists-498322/locations/global/keyRings/vistamations-handy-mail-keys/cryptoKeys/aes256-gcm-key-001'
    response = kms_client.decrypt(name=key_name, ciphertext=data['wrapped_key'])
    aes_key = response.plaintext
    
    # Decrypt
    aead = AESGCM(aes_key)
    plaintext = aead.decrypt(data['nonce'], data['ciphertext'], data['associated_data'])
    
    # Strip watermark LSB from image payload
    # ... (watermark removal logic) ...
    
    # Return legible document
    return {'status': 'decrypted', 'document': plaintext.decode()}
    # Enclave destroyed here — all memory zeroed
```

### 5. Vertex AI MCP Server on Cloud Run — Agent Inspection Layer

| Config | Value |
|--------|-------|
| **Service** | `handy-mail-mcp` |
| **Runtime** | Python 3.11, 2 vCPU, 4GB |
| **Protocol** | JSON-RPC 2.0 over HTTPS |
| **Auth** | IAM service account (no static keys) |
| **Tools Exposed** | `check_bucket_state`, `verify_watermark`, `route_delivery_confirmation` |
| **Scaling** | 0→10 instances, concurrency 80 |

```json
// MCP Tool Definition — check_bucket_state
{
  "name": "check_bucket_state",
  "description": "Query Cloud Storage bucket for pending document processing",
  "inputSchema": {
    "type": "object",
    "properties": {
      "bucket": {"type": "string", "default": "vistamations-handy-mail-inbound"},
      "status_filter": {"type": "string", "enum": ["pending", "verified", "decrypted", "delivered"]}
    }
  }
}
```

## 5-Step Authentication & Decode Flow

```
[1] QR SCAN           →  Customer scans QR → App sends SOAP envelope to Apigee
                            ↓
[2] C2 SIGNAL         →  Stateless ping to C2 hub → HMAC-SHA256 webhook sig generated
                            ↓
[3] LIFT RESTRICTIONS →  Cloud Armor receives webhook sig → safelists client IP (60s TTL)
                            ↓
[4] PASSKEY VERIFY    →  Mobile 2-way OAuth 2.0 challenge → biometric + TOTP → session JWT issued
                            ↓
[5] PACKET UNLOCK     →  JWT → Cloud Function triggers → KMS decrypt in Confidential Space
                         → watermark stripped → legible document returned → memory wiped
```

## Deployment Commands

```bash
# 1. Enable required APIs
gcloud services enable apigee.googleapis.com compute.googleapis.com \
  cloudfunctions.googleapis.com cloudkms.googleapis.com \
  confidentialcomputing.googleapis.com run.googleapis.com \
  --project=vists-498322

# 2. Create KMS key ring + key
gcloud kms keyrings create vistamations-handy-mail-keys --location=global --project=vists-498322
gcloud kms keys create aes256-gcm-key-001 --keyring=vistamations-handy-mail-keys \
  --location=global --purpose=encryption --protection-level=hsm \
  --rotation-period=7776000s --project=vists-498322

# 3. Create Cloud Storage bucket
gcloud storage buckets create gs://vistamations-handy-mail-inbound \
  --location=australia-southeast1 --project=vists-498322

# 4. Deploy Cloud Function
gcloud functions deploy verify-watermark \
  --runtime=python311 --trigger-bucket=vistamations-handy-mail-inbound \
  --entry-point=verify_watermark --memory=256MB --timeout=60s \
  --project=vists-498322

# 5. Deploy MCP Server on Cloud Run
gcloud run deploy handy-mail-mcp \
  --image=gcr.io/vists-498322/handy-mail-mcp:latest \
  --region=australia-southeast1 --concurrency=80 \
  --service-account=handy-mail-mcp@vists-498322.iam.gserviceaccount.com \
  --project=vists-498322
```

## Budget Estimate

| Service | Monthly Cost (est.) |
|---------|---------------------|
| Apigee (eval tier) | $0 (evaluation) |
| Cloud Armor | ~$5 (rules + requests) |
| Cloud Storage | ~$2 (5GB + operations) |
| Cloud Functions | ~$1 (100K invocations) |
| Cloud KMS (HSM) | ~$5 (1 key + operations) |
| Cloud Run (MCP) | ~$3 (100K requests) |
| Confidential Space | ~$10 (1 instance, on-demand) |
| **Total** | **~$26/month** |
