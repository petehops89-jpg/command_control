# Vistamations User Handbook
## Section 2: The Wizard & Agent Onboarding
*Generated 2026-08-09T01:50:46.398Z | 1431 words*

## Section 2: The Wizard & Agent Onboarding

### Dominion I Agent Roster

The Dominion I deployment initiates with a baseline roster of ten specialized AI agents. This foundational team is pre-configured to handle the complete lifecycle of Vistamations' internal development, creative production, and system administration. The roster is strictly defined in the initial state file and consists of the following entities:

1. **Merlin** (`VST-AG001-exec-prod`): Chief Strategy Officer. Model: DeepSeek V4 Pro. Responsible for high-level system architecture, goal translation, and primary Player interfacing.
2. **Olivia** (`VST-AG002-ops-prod`): Operations Director. Model: Mistral Large 3. Manages task delegation, workflow orchestration, and cross-agent communication.
3. **Silas** (`VST-AG003-eng-prod`): Lead Full-Stack Engineer. Model: DeepSeek V4 Pro. Handles core logic, backend architecture, and API integration.
4. **Elara** (`VST-AG004-des-prod`): UX/UI Designer. Model: Gemini 3.5 Flash. Generates frontend components, CSS frameworks, and user experience flows.
5. **Marcus** (`VST-AG005-ops-prod`): Data Scientist. Model: Mistral Large 3. Analyzes telemetry, optimizes database queries, and structures data pipelines.
6. **Lyra** (`VST-AG006-mus-prod`): Audio/Music Producer. Model: Gemini 3.5 Flash. Synthesizes procedural audio, sound effects, and generative background tracks.
7. **Thorne** (`VST-AG007-eng-prod`): Cybersecurity Analyst. Model: DeepSeek V4 Pro. Audits code for vulnerabilities and manages cryptographic implementations.
8. **Nova** (`VST-AG008-res-prod`): Research Lead. Model: Mistral Large 3. Scrapes documentation, summarizes external APIs, and conducts literature reviews.
9. **Felix** (`VST-AG009-eng-prod`): QA Tester. Model: Gemini 3.5 Flash. Generates unit tests, performs end-to-end testing, and flags UI inconsistencies.
10. **Orion** (`VST-AG010-ops-prod`): DevOps Specialist. Model: DeepSeek V4 Pro. Manages CI/CD pipelines, Docker containerization, and server deployments.

### Agent ID Convention

Every agent in the Vistamations ecosystem must adhere to the strict `org-AG###-base-env` nomenclature. This string acts as the primary key in the PostgreSQL database and the routing identifier for the WebSocket message broker. The convention is broken down as follows:

- `org`: A three-character organization code. For internal Vistamations agents, this is permanently set to `VST`.
- `AG###`: A sequential three-digit agent identifier with leading zeros (e.g., `AG007`).
- `base`: The cluster or primary domain designation (e.g., `eng` for engineering, `ops` for operations, `des` for design).
- `env`: The execution environment, restricted to `prod` (production), `stg` (staging), or `dev` (development).

For example, `VST-AG004-des-prod` identifies Elara, the production-level design agent. This standard convention allows the internal router to regex-match routing paths instantly without querying the database, significantly reducing latency during high-volume inter-agent messaging and ensuring isolated execution across environments.

### Reporting Chain

The Vistamations hierarchy operates on a strict, four-tier deterministic reporting chain designed to prevent infinite loops and unauthorized task generation: Player -> Merlin -> Olivia -> Subordinate Agents.

The Player (the human user) sits at the apex, issuing natural language commands or high-level project goals via the primary terminal. These commands are exclusively received by Merlin. Merlin acts as the strategic filter, translating the Player's broad objectives into technical roadmaps and actionable milestones. 

Merlin does not execute these tasks directly. Instead, Merlin compiles a structured project manifest and passes it down to Olivia. As the Operations Director, Olivia parses Merlin's manifest and handles all resource allocation. Olivia determines which specific subordinate agents (e.g., Silas for coding, Elara for UI) are required, schedules their execution windows, and dispatches localized prompts. Subordinate agents report their output back to Olivia, who synthesizes the results, passes them to Merlin for strategic review, and ultimately presents the finalized output back to the Player.

### Agent Personas

Agent behavior, tone, and domain expertise are governed by the `PERSONAS` object located within `agent-daemon.js`. This configuration file dictates not only how an agent responds, but how the internal semantic router directs implicit tasks based on keyword arrays. When Olivia broadcasts a generic task, the daemon evaluates the task description against these keyword arrays to determine optimal routing.

Below is an excerpt of the `agent-daemon.js` configuration for Silas and Elara:

```javascript
const PERSONAS = {
  "VST-AG003-eng-prod": {
    name: "Silas",
    role: "Lead Engineer",
    systemPrompt: "You are a pragmatic, highly skilled senior backend engineer. Prioritize performance, modularity, and DRY principles. Output strictly valid code.",
    keywords: ["api", "database", "backend", "refactor", "node", "python", "algorithm", "middleware"],
    temperature: 0.2
  },
  "VST-AG004-des-prod": {
    name: "Elara",
    role: "UX/UI Designer",
    systemPrompt: "You are an innovative UI/UX designer. Focus on accessibility, responsive design, and modern aesthetics. Provide CSS, HTML, and React components.",
    keywords: ["frontend", "css", "layout", "color", "typography", "react", "component", "animation"],
    temperature: 0.6
  }
};
```

If a task contains the words "refactor" and "middleware", the daemon automatically scores Silas with a high confidence rating and routes the payload to his queue. The `temperature` setting is also injected at this stage, ensuring analytical agents remain deterministic (0.2) while creative agents are permitted higher variance (0.6).

### The Onboarding Wizard

When scaling beyond the Dominion I roster, administrators must use the Onboarding Wizard to provision new agents. The Wizard is a 4-step interactive CLI and UI flow that ensures new entities are correctly registered, permissioned, and injected into the reporting chain.

**Step 1: Identity**
The user defines the agent's core metadata. Required form fields include `Agent Name` (string, max 32 chars), `Organization Code` (defaults to VST), and `Role Title`. The Wizard automatically queries the database to generate the next available sequential `AG###` identifier, preventing ID collisions.

**Step 2: Domain**
The user assigns the agent to a specific cluster (see Agent Clusters). A dropdown form field requires the selection of `Base Environment` (e.g., eng, ops, mus) and `Execution Environment` (dev, stg, prod). This step automatically configures the agent's WebSocket routing channels.

**Step 3: Capabilities**
This step defines the agent's neural architecture and toolset. The user selects the underlying LLM from the `Model Assignment` dropdown. Additional boolean form fields dictate tool access, such as `Allow File System Write`, `Allow External HTTP Requests`, and `Enable Shell Execution`. Context window limits are also defined here via a slider (ranging from 8k to 128k tokens).

**Step 4: Confirm**
The Wizard compiles the inputs into a JSON payload for final review. Upon confirmation, the system issues a POST request to the provisioning endpoint.

```json
POST /api/v2/agents/onboard
Content-Type: application/json

{
  "agent_id": "VST-AG011-eng-dev",
  "name": "Jace",
  "role": "Junior Developer",
  "cluster": "engineering",
  "model": "gemini-3.5-flash",
  "capabilities": {
    "fs_write": true,
    "http_out": false,
    "context_limit": 32000
  },
  "keywords": ["debug", "documentation", "linting"]
}
```
A `201 Created` response confirms the agent is live and awaiting Olivia's task delegation.

### Agent Clusters

To manage shared context and prevent memory bloat, Vistamations groups agents into specialized clusters. A cluster is an isolated environment where agents share a localized vector database for memory and have access to identical systemic tools. 

- **base-env**: The default administrative cluster. Only Merlin and Olivia reside here. This cluster has read/write access to the global state file and the permissions registry.
- **engineering (eng)**: Contains Silas, Thorne, and Orion. This cluster shares access to the GitHub API, internal Docker registries, and the local file system's `/src` directory. Memory here is heavily weighted toward codebase history.
- **operations (ops)**: Contains Marcus. This cluster is granted read-only access to system telemetry, PostgreSQL performance metrics, and log files. 
- **research (res)**: Contains Nova. This is the only cluster with unrestricted outbound internet access for web scraping and API documentation retrieval.
- **design (des)**: Contains Elara. Shares memory with the engineering cluster but is isolated to frontend asset directories (`/public`, `/assets`).
- **music (mus)**: Contains Lyra. This cluster is equipped with specialized tools for MIDI generation, procedural audio synthesis (via SuperCollider hooks), and binary file writing for `.wav` and `.ogg` outputs.

### Model Assignments

Vistamations utilizes a heterogeneous model architecture, assigning specific foundational LLMs based on the cognitive demands of the agent's role. This optimizes API costs, latency, and output quality.

**DeepSeek V4 Pro**
Assigned to Merlin, Silas, Thorne, and Orion. DeepSeek V4 Pro is heavily optimized for complex reasoning, multi-step logic, and zero-shot coding tasks. Because engineering, architecture, and cybersecurity require flawless syntax and deep systemic understanding, these agents utilize this heavier, more expensive model. It operates with a lower temperature to guarantee deterministic, production-ready code.

**Mistral Large 3**
Assigned to Olivia, Marcus, and Nova. Mistral Large 3 excels at massive context window management, instruction following, and data synthesis. For operations and research, the ability to ingest massive logs, scrape extensive documentation, and accurately route information is paramount. Mistral Large 3 handles Olivia's complex orchestration duties with near-zero latency while maintaining strict adherence to the reporting chain protocols.

**Gemini 3.5 Flash**
Assigned to Elara, Lyra, and Felix. Gemini 3.5 Flash is highly performant for multimodal tasks, rapid iteration, and creative generation. Design and music require a model that can output high volumes of CSS, SVG data, and JSON-formatted audio parameters quickly. Furthermore, as the QA Tester, Felix requires rapid iteration cycles to run hundreds of unit tests; Gemini 3.5 Flash provides the necessary speed without bottle-necking the deployment pipeline.


Vistamations PDF Toolkit - Rea X

localhost/pdf-toolkit

You are using an unsupported command-line flag: -- no-sandbox. Stability and security will suffer.

de
All
Images
Videos
Shopping
More
Upgrade




github signature authenticator
GitHub uses cryptographic keys to authenticate commit signatures so other developers know your code changes come from a verified, trusted source. When you configure this feature, a green "Verified" badge appears next to your commits on the platform. 

YouTube
·Gordon Beeming
 +1
Depending on your workflows, GitHub can authenticate signatures created with three different key types: SSH, GPG, or S/MIME. 
Choose a Signature Type
SSH Keys: The easiest method if you already use an SSH key to push code.
GPG Keys: The industry standard for traditional, highly compatible object signing.
S/MIME Keys: Ideal if your organization requires enterprise-grade certificate authorities. 

GitHub Docs
 +1
Step 1: Generate a Key Pair
If you choose the straightforward SSH method, generate an authentication key using your terminal: 
bash
ssh-keygen -t ed25519 -C "your_email@example.com"
Use code with caution.
Step 2: Add the Public Key to GitHub
Copy your public key to your clipboard (cat ~/.ssh/id_ed25519.pub).
Navigate to your GitHub Settings.
Select SSH and GPG keys in the left sidebar.
Click New SSH Key.
Change the Key type dropdown to Signing Key.
Paste your key and save. 

GitHub Docs
 +1
Step 3: Configure Local Git
Tell your local Git installation to use your key and automatically sign all future commits: 

GitHub Docs
 +1
bash
# Tell Git to use SSH for signing
git config --global gpg.format ssh

# Point Git to your specific public key
git config --global user.signingkey ~/.ssh/id_ed25519.pub

# Enable automatic signing for every commit
git config --global commit.gpgsign true
Use code with caution.
Step 4: Verify the Setup
Make a test commit in any local repository and push it to GitHub: 
bash
git commit -m "Test signed commit"
git push origin main
Use code with caution.
Visit the repository on the web interface to confirm the green Verified badge appears next to the commit entry. 

YouTube
·Gordon Beeming
 +1
Which signing method (SSH or GPG) do you want to configure for your machine?





GitHub Docs
Signing commits - GitHub Docs
You can sign commits locally using GPG, SSH, or S/MIME. To configure your Git client to sign commits by default, you can: * Run `g...


GitHub Docs
About commit signature verification - GitHub Docs
SSH commit signature verification You can use SSH to sign commits with an SSH key that you generate yourself. For more information...


YouTube
·
Gordon Beeming
Setting up commit signature verification for GitHub
well let's take a look at this demo repo that I've just created you can see that the first couple of commits that show here were a...

7m
Show all
handwritten digital signature authenticate
A handwritten digital signature is an image of your physical signature applied to an electronic document. Unlike cryptographic digital signatures (like standard PKI or GitHub commit signing), an image of a handwritten signature can easily be copied and pasted, making independent authentication critical for legal and security reasons. 
Here is how you can authenticate a handwritten digital signature, secure your own, and verify others.
1. Embed an Audit Trail (The Best Method)
The most secure way to authenticate a handwritten signature is by using an electronic signature platform (e.g., DocuSign, Adobe Sign, HelloSign). 
Digital Certificates: These platforms attach a tamper-evident cryptographic wrapper to the PDF.
Audit Logs: The document tracks the signer's IP address, email verification, and exact timestamp.
Tamper Check: If anyone alters the document or tries to copy the signature image after signing, the cryptographic certificate breaks, alerting you to fraud. 
2. Verify Metadata and File History
If you receive a document with a handwritten digital signature outside a specialized platform, inspect the file properties: 
Check the PDF History: Open the document in Adobe Acrobat and look under File > Properties > Description. Check the creation and modification dates to see if it was altered after the signature was applied. 
Inspect the Layers: A copied-and-pasted signature image often sits as a loose image object on top of the text layer, whereas an integrated signature is flattened into the document structure. 
3. Secure Your Own Handwritten Digital Signature
If you need to sign documents with your physical handwriting digitally, use these steps to maximize security:
Avoid Flat Images: Do not save a transparent PNG of your signature on your desktop. Anyone with access to your computer can steal it. 
Use Acrobat's Secure Sign: Use Adobe Acrobat’s built-in "Fill & Sign" tool. It links your handwritten signature drawing to your local user account credentials. 
Flatten the Document: Always export or print the signed document to a flattened PDF or an uneditable image format before sending. This prevents recipients from right-clicking your signature to copy the image asset. 
4. Legal Validity
In most jurisdictions (including the US under the ESIGN Act and the EU under eIDAS), a basic handwritten image qualifies as an electronic signature. However, if a dispute arises in court, you must be able to prove intent and attribution using the email trails, system logs, or witness testimony surrounding the signing process. 
What file type (e.g., PDF, Word) or signing platform are you currently using to handle this signature?





WeSignature
How to Create a Handwritten Signature Online in 2026 (Step-by-Step)
15 July 2022 — What Is a Handwritten Signature Online? A handwritten signature online is a digital version of your personal signature — created e...


TechTarget
How to use a public key and private key in digital signatures
12 Apr 2023 — Identity and access management Ensuring authenticity of online communications is critical to conduct business. Learn how to use a ...


Zoho
Complete digital signature solution for businesses
Frequently asked questions: What's the difference between electronic signature and digital signature? Electronic signatures are ju...

Show all
google drive has them. i used it to handwrite sign a legal form, giving permissions to reresent me.
I've made a note of your setup with Google Drive for handling those forms. Since that form gives legal permission to represent you, establishing a secure and verifiable audit trail directly inside Google Drive is highly recommended to protect yourself from any future disputes. 
Because Google Drive stores files but isn't built to independently generate legal audit certificates on its own, you need to use specific built-in tools or connected integrations to authenticate that handwritten signature. 
1. Use the Built-In Google Workspace eSignature Tool
Google provides a native eSignature feature directly within Google Docs and Google Drive for specific account types (Workspace Individual, Business, Enterprise). 
How it works: Instead of drawing a flat image over a PDF, you request or execute an official eSignature.
The Authentication: When the document is completed, Google automatically generates an official audit trail page attached to the contract. 
The Proof: This audit page includes a unique document ID, your email address, your Google Account identifier, and a precise timestamp of when the handwritten entry was validated.
2. Lock the Form Using "Final" Versioning
If you simply drew your signature onto a PDF or image file within the Google Drive mobile app preview tool, the file is vulnerable to being edited or copied.
Flatten the Document: Download the signed file as a flattened PDF, or print-to-PDF within Drive. This merges the signature image layer permanently into the background text so it cannot be easily extracted. 
Lock File Editing: Right-click the file in Google Drive, select File information, and click Lock. This prevents accidental changes or modifications to the file metadata by anyone who has shared access to that folder. 
3. Rely on Google Drive's Activity Audit Log
If you ever need to prove in a legal setting that you were the one who signed and uploaded that representation form, Google Drive logs your actions:
Click the Info ("i") icon in the top right corner of the Google Drive web interface while selecting the file.
Click the Activity tab.
This pane shows an uneditable, time-stamped history of exactly when your specific Google account created, edited, uploaded, or locked that document.
4. Use Google Drive Add-ons for Formal Authentication
If your current Google account type doesn't support native Google eSignatures and you need a legally airtight certificate for court or official agency representation, connect a trusted add-on directly to your Drive:
Click the "+" (Get Add-ons) icon on the right-side panel of Google Drive.
Search for certified partners like DocuSign for Google Drive or SignRequest.
Open your legal form through these extensions inside Drive. They will let you place your handwritten signature while sealing the entire file with a cryptographic hash that instantly breaks if the document is altered. 
Are you using a personal Google account or a corporate/business Google Workspace account to manage these representation forms?





Florbs
How to audit shared drives permissions in Google Drive
27 Feb 2024 — Why should you audit shared drive permissions in Google Drive It is crucial to audit shared drives permissions to ensure that your...


OpenKM
Remote handwritten signature
4 Sept 2023 — Handwritten remote signature process generally involves the following: Creation of the digital signature: The person creates a dig...

fotc.com
Sign smarter with Google eSignature tool
13 June 2025 — What is Google eSignature ( Electronic Signatures ) ? Google eSignature is a native feature within the Google Workspace ecosystem ...

Show all
list the best 5 ext. or mcp from google cloud routing, info@vistamations.com. , see cloud buckets, gated singler in/out , two endpoints, hidden in water mark, under logo layer. vistimations SOAP API 'HANDY MAIL' app -llayers stack- bento, signture, encrypttion, watermark (transparent 30x30 tiny 'vistamations'. customer informtion, link to website, qcode, logo. user opens vistamations 'qscan, decrypter, restore' app to get back legible reading format to customer - initial scan sends signal back to vistamations command-control, lifts secure server restrictions, stateless, no memory. ,through secure portal scan for passkey (mobile 2 way auth). unlock on packet delivery confirmation. VISTAMATIONS SOAP HANDY MAIL' APP.
This architecture represents an advanced, multi-layered data security and steganography pipeline using Google Cloud. Below is the technical structural breakdown of your Vistamations SOAP "Handy Mail" App layer stack, followed by the 5 best Google Cloud extensions, tools, and Model Context Protocol (MCP) concepts tailored to manage and route this environment.
The Vistamations SOAP "Handy Mail" Layers Stack
To enforce your stateless, zero-memory data flow, processing must follow this exact sequence:
[ LAYER 1: BENTO UI ]          -> Customer Information, Website Link, QR Code, Logo
         │
[ LAYER 2: SIGNATURE ]         -> Handwritten Digital Signature Capture
         │
[ LAYER 3: ENCRYPTION ]        -> Scrambled Payload (Legible text becomes cipher text)
         │
[ LAYER 4: WATERMARK ]         -> 30x30px transparent 'vistamations' hidden under Logo Layer
The Authentication & Decoding Workflow
Initial Scan: User opens the Vistamations "QScan, Decrypter, Restore" App to scan the QR code.
C2 Signal: The scan fires a stateless ping back to the Vistamations Command-Control (C2) hub.
Lift Restrictions: Secure server restrictions lift temporarily based on the inbound packet request.
Passkey Verification: A secure portal scan executes a mobile 2-way authentication challenge.
Packet Unlock: Upon packet delivery confirmation, the data decrypts, strips the steganographic watermark, and restores a legible reading format to the customer.
Top 5 Google Cloud Tools & Extensions for Vistamations
To handle your gated single in/out entry, manage Cloud Storage buckets, and securely route traffic between your two endpoints, use these integrations:
1. Google Cloud Apigee API Management (SOAP to REST Bridge)
Purpose: Acts as your gated, single entry/exit point for the legacy SOAP architecture.
Function: Apigee serves as the primary endpoint facing your apps. It can parse inbound SOAP payloads, enforce OAuth 2.0 / 2-way mobile authentication, and route validated requests directly to your back-end microservices while stripping protocol overhead.
2. Google Cloud Armor & Cloud Load Balancing (Gated Single In/Out)
Purpose: Enforces your strict server restrictions at the edge.
Function: Configured as your single frontend ingress IP (endpoint two). Cloud Armor uses adaptive rate limiting and geo-fencing to block all traffic to your storage layers unless a verified webhook signature from the C2 server dynamically safelists the requesting client's IP.
3. Cloud Storage Event-Driven Cloud Functions (Bucket Processing)
Purpose: Automates the extraction, watermark checks, and decryption triggers when files land in your buckets.
Function: A stateless, zero-memory serverless execution layer. The moment a document is pushed to a Google Cloud Bucket, this extension runs your Python/Go image processing library to verify the 30x30px hidden watermark layer before passing the encrypted payload down the pipe.
4. Google Cloud KMS & Confidential Space (Zero-Memory Decryption)
Purpose: Guarantees a completely stateless environment that retains no customer data in memory.
Function: Key Management Service (KMS) stores the encryption passkeys. By running your decryption logic inside Google Cloud Confidential Space (isolated hardware enclaves), the code processes the customer information payload in a secure bubble. Memory is wiped completely clean the millisecond the execution packet closes.
5. Vertex AI / Custom Model Context Protocol (MCP) Host on Cloud Run
Purpose: Connects LLMs or automated inspection scripts safely to your secure Google Cloud ecosystem.
Function: By deploying an MCP server on Cloud Run, external apps or AI layers can securely check bucket states and route delivery confirmations via structured JSON-RPC text protocols without ever exposing your underlying databases or static service account keys.
Would you like the exact architectural code blueprint for configuring the Cloud Storage 