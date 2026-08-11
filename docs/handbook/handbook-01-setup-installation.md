 Vistamations User Handbook
 Section 1: Setup & Installation
Generated 2026-08-09T01:49:15.533Z | 1651 words

 Vistamations User Handbook
 Section 1: Setup & Installation

 System Requirements
Vistamations operates as a heavily integrated hybrid environment relying on both containerized services and host-level Windows automation. To ensure seamless operation between the Olivia Command Portal and the underlying agent workflows, your host machine must meet strict baseline requirements. 

Operating system compatibility is restricted; Windows 11 Pro or Windows Server 2022 is mandatory. The framework relies heavily on native Windows COM objects, registry manipulations, and UI Automation libraries that are fundamentally unsupported on Linux or macOS hosts. Additionally, Hyper-V and WSL2 (Windows Subsystem for Linux) must be enabled in the Windows Features dialog prior to proceeding.

Docker Desktop for Windows (version 4.20 or higher) must be installed and configured to use the WSL2 backend. Allocate a minimum of 8GB RAM and 4 CPU cores to the Docker engine within the Docker Desktop settings panel to prevent container throttling during heavy parallel agent execution. 

Node.js (LTS version 20.x or higher) is required on the host for local script compilation and utility execution outside the container stack. Ensure `npm` is added to your system PATH. Furthermore, PowerShell 7.3 or newer must be installed to handle advanced host-level scheduled tasks. Legacy Windows PowerShell 5.1 lacks the necessary cross-platform cmdlets and JSON parsing capabilities required by the Vistamations core engine. Ensure you run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` to allow the execution of local automation scripts without encountering security blocks.

 Docker Compose Stack
The core infrastructure of Vistamations is orchestrated via a modular four-container Docker Compose stack. This architecture securely isolates the frontend interface, the backend routing engine, the database, and the background worker queue. Navigate to `C:\Vistamations\Core` and inspect the `docker-compose.yml` file to understand the deployment topology.

The stack consists of the following containers:
1. `vista-portal`: This container runs the Next.js frontend for the Olivia Command Portal on port 3000. It handles user interactions, agent monitoring, and real-time WebSocket connections.
2. `vista-router`: Running on a Node.js and Express framework, this backend service exposes port 8080. It processes incoming webhooks, translates natural language commands via the Gemini API, and dispatches precise instructions to the appropriate Windows host tasks.
3. `vista-redis`: A standard Redis 7.2 Alpine image operating on port 6379. This serves as the primary message broker and state store, ensuring that inter-process communication between the router and the host machine remains perfectly synchronized.
4. `vista-worker`: A headless Node.js instance dedicated to executing long-running asynchronous tasks, such as generating daily reports, parsing large PDF datasets, and compiling agent execution logs.

To initialize the environment, open PowerShell 7 as an Administrator, navigate to the core directory, and execute `docker compose up -d --build`. This command pulls the necessary base images, compiles the local Dockerfiles, and launches the stack in detached mode. Verify the health of the stack by running `docker compose ps`. All four containers must report a status of "Up" and "Healthy". If configuration changes are made to the environment later, you must execute `docker compose restart` to apply them.

 Environment Configuration
Proper environment configuration is critical for securely bridging the Docker stack, the Windows host, and external cloud services. All sensitive credentials, database connection strings, and environment variables are managed within a centralized `.env` file located at `C:\Vistamations\Core\.env`. Under no circumstances should you commit this file to version control.

You must define your primary API keys and network parameters immediately after installation. Open the `.env` file and populate the `GEMINI_API_KEY` variable with your active credential from Google AI Studio or the Google Cloud Console. Next, define the `REDIS_URL=redis://vista-redis:6379` parameter to ensure internal container routing functions correctly across the Docker bridge network.

For interactions requiring Google Cloud Platform resources, Application Default Credentials (ADC) must be configured on the Windows host. Open PowerShell and execute `gcloud auth application-default login`. This command opens a browser window prompting you to authenticate with your Google Workspace account. Upon successful login, the ADC JSON file is generated at `%APPDATA%\gcloud\application_default_credentials.json`. 

You must explicitly map this ADC file into the Docker containers so the `vista-router` can inherit your host's IAM permissions. Ensure your `docker-compose.yml` includes a volume mount binding the host's `%APPDATA%\gcloud` directory to `/root/.config/gcloud` inside the containers. Finally, set `VISTA_ENVIRONMENT=production` in your `.env` file to disable verbose debugging logs and optimize runtime performance.

 Git Setup & Branch Strategy
Vistamations utilizes a strict Git-based workflow to manage automation scripts, configuration states, and audit logs. The primary repository, known internally as the `evidence-registry`, acts as the single source of truth for all agent activities and procedural updates. 

To begin, initialize your local workspace by opening PowerShell and executing `git clone git@github.com:YourOrg/evidence-registry.git C:\Vistamations\Registry`. Ensure you have configured your SSH keys properly, as HTTPS cloning is disabled for security compliance. Ensure your `.gitignore` file is properly configured to exclude local `.env` files and compiled binaries from being accidentally committed.

The repository enforces a rigid branching strategy to prevent unverified code from disrupting production automations. The `main` branch is locked and strictly reserved for stable, production-ready agent configurations. You cannot push directly to the `main` branch. 

When introducing a new automation script or modifying an existing agent's behavior, you must create a feature branch using the nomenclature `feature/AGXXX-description`, where `AGXXX` corresponds to the specific agent ID. For example, execute `git checkout -b feature/AG004-invoice-parser`. 

Once your local testing is complete, commit your changes using conventional commit messages, such as `feat(AG004): add regex for vendor ID extraction`. Push the branch to the remote repository and open a Pull Request. Merging into `main` requires approval from at least one senior administrator and a successful automated test run via GitHub Actions.

 Windows Task Scheduler
While the Docker stack handles cognitive routing and intelligence, the actual execution of desktop automation occurs via the native Windows Task Scheduler. You must import seven critical tasks into the host environment to enable full Vistamations functionality. Navigate to `C:\Vistamations\Scripts\Tasks` and run the `Install-Tasks.ps1` script to automatically register these XML definitions.

1. Vista-Agent-Heartbeat: Runs every 5 minutes. This task pings the `vista-redis` container to confirm the host machine is awake, authenticated, and ready to accept automation commands from the router.
2. Vista-Daily-Cleanup: Triggered daily at 02:00 AM. Purges temporary files in `C:\Vistamations\Temp`, clears legacy Chrome driver caches, and archives old execution logs into compressed zip formats to conserve disk space.
3. Vista-Queue-Processor-High: Runs continuously on system startup. This is a persistent PowerShell loop that polls the Redis high-priority queue every two seconds for immediate, user-initiated Olivia commands.
4. Vista-Queue-Processor-Low: Triggered every 15 minutes. Processes background batch jobs, such as bulk email parsing and CRM data synchronization, ensuring these heavy workloads do not interrupt high-priority user tasks.
5. Vista-Git-Sync: Triggered daily at 06:00 AM and 06:00 PM. Automatically pulls the latest approved configurations from the `evidence-registry` main branch and pushes generated audit logs back to the remote repository.
6. Vista-Docker-Watchdog: Runs every hour. Monitors the Docker engine's RAM and CPU consumption. If memory exceeds 6GB, it safely flushes the cache and restarts the `vista-worker` container to prevent host degradation.
7. Vista-Report-Generator: Triggered weekly on Fridays at 17:00. Compiles the week's agent success and failure metrics into a PDF dashboard and automatically emails it to the administrative team.

 Olivia Command Portal
The Olivia Command Portal is the primary graphical interface for interacting with the Vistamations ecosystem. Once the Docker Compose stack is fully initialized and healthy, open your preferred web browser and navigate to `http://localhost:3000`. You will be greeted by the secure login screen; authenticate using your assigned administrative credentials.

The portal is designed around a unified chat interface, allowing you to issue natural language commands directly to the system. Olivia, the central routing intelligence, interprets your messages and delegates tasks to the appropriate specialized agents. For example, typing "Ask AG003 to extract data from the Q3 financial PDFs" will prompt Olivia to parse the intent, package the payload, and transmit it to the Redis queue. The portal features real-time WebSocket integration, ensuring that agent responses, task progress bars, and error notifications stream seamlessly into your chat window without requiring manual page refreshes.

 Agent Registration
Every specialized automation routine within Vistamations is encapsulated as an "Agent" and must be formally registered in the system roster. We enforce a strict identification convention using the prefix `AG` followed by a three-digit sequential number to maintain order and predictability.

The baseline installation includes a pre-configured roster from AG001 to AG010. For instance, AG001 is the System Diagnostic Agent, responsible for host health checks. AG002 handles Outlook Email Triage, while AG007 is dedicated to SAP Data Entry workflows.

To register a newly developed agent, you must create a corresponding JSON configuration file in `C:\Vistamations\Core\Agents`. If you are adding the eleventh agent, name the file `AG011.json`. This file must define the agent's capabilities, required executable paths, and expected input schemas. The JSON file must also include metadata tags such as the author, version, and timeout thresholds to ensure stable execution. Once saved, Olivia automatically parses this directory on startup, dynamically expanding her routing capabilities.

 Gemini API Integration
Vistamations leverages Google's Gemini models to provide the cognitive reasoning required for Olivia's natural language routing. You must choose between two distinct integration pathways based on your enterprise requirements: Vertex AI or Express Mode.

Express Mode connects directly to Google AI Studio using a standard API key. It is ideal for rapid development, local testing, and lightweight deployments. However, for production environments requiring strict data residency and compliance, Vertex AI is mandatory. 

To configure Vertex AI, navigate to the Google Cloud Console and create a new project named `vistamations-prod`. Enable the Vertex AI API and configure your IAM permissions to allow the host's Application Default Credentials to invoke the `gemini-1.5-pro` model. In your `.env` file, set `GEMINI_MODE=vertex`, define your `GCP_PROJECT_ID`, and specify the deployment `GCP_REGION` (e.g., `us-central1`). This ensures all prompts and agent reasoning logs remain securely within your private cloud perimeter. Monitor your quota in the GCP console to prevent rate 
limiting during peak automation hours.

We have mapped out the architecture to turn the homepage bento tile into a high-powered Vistamations PDF/OCR Reader & Editor Toolkit.
Pete's $5 budget is safe: the chosen Model Context Protocol (MCP) ecosystem and development engines rely entirely on premium open-source infrastructure, avoiding ongoing licensing costs. [1, 2] 
------------------------------
## 1. The Dynamic Bento Tile (Micro UI)
To match the original file upload component, a secondary twin tile sits side-by-side on the homepage homepage to handle incoming documents.
## The "Open PDF" Tile Interface (20x10px)

<div class="bento-tile btn-open" style="width: 20px; height: 10px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #1a1a1a; border: 1px solid #333; border-radius: 2px; cursor: pointer;" onclick="triggerVistamationsToolkit()">
  <!-- Vector Lottie/SVG Animation Trigger Hidden Behind Text -->
  <svg class="vector-anim" style="position: absolute; width: 100%; height: 100%; top:0; left:0; opacity:0.1; pointer-events:none;" viewBox="0 0 20 10">
    <path d="M2,5 Q10,1 18,5" stroke="#007acc" stroke-width="0.5" fill="none" class="pulse-line"/>
  </svg>
  <span style="font-size: 6px; color: #007acc; font-family: sans-serif; pointer-events: none; scale: 0.85; font-weight: bold; white-space: nowrap;">Open PDF</span>
</div>

------------------------------
## 2. Verified AI Tools & Verified MCP Infrastructure
The backend agents integrate directly with these robust, secure open-source servers to read and edit the assets stored in Pete's ecosystem:

* PDF Extraction Core: Connected to the open-source [pdf-mcp Server](https://github.com/jztan/pdf-mcp) or [pietermyb/mcp-pdf-reader](https://github.com/pietermyb/mcp-pdf-reader). This setup allows the system to effortlessly index, search, and parse heavy PDF presentations without overflowing the agent's context window. [3, 4] 
* OCR Parsing Engine: Uses the open-source [mcp-ocr via Tesseract](https://pypi.org/project/mcp-ocr/), running natively on local compute. It intercepts scanned pages automatically, transforming flat images into raw, editable text layers. [5, 6] 
* File Path Monitor: Employs the native @modelcontextprotocol/server-filesystem. This permits the AI agent to instantly list, grab, and sync everything inside \\pete\presentations\. [1] 

------------------------------
## 3. Vistamations Core PDF App Features
When a user clicks the Open PDF bento tile, it scales up via a smooth CSS vector animation into a comprehensive full-screen overlay dashboard:

[ Wizard Steps: 1. Template ➔ 2. Colour Scheme ➔ 3. Assets ➔ 4. Secure Sign ]
┌────────────────────────────────────────────────────────────────────────────┐
│  TOOLS PANEL     │               VISTAMATIONS DESIGN STAGE                 │
│  ───────────     │                                                         │
│  [⚙️ Edit Text]  │  ┌───────────────────────────────────────────────────┐  │
│  [🔍 Run OCR]   │  │                                                   │  │
│  [⎇ Split PDF]  │  │   Template: Modern Slate                          │  │
│  [🔗 Merge ]    │  │   Font: Inter (Google Fonts via VS Code)          │  │
│  🎨 Colour Scheme│  │                                                   │  │
│  [  ■ ■ ■ ■  ]   │  │   ─────────────────────────────────────────────   │  │
│                  │  │   ✍️ Digital Handwritten Signature: Verified ✓   │  │
│                  │  └───────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘

## Step-by-Step Wizard Form

* Step 1: 20 Production-Ready Design Templates – Loads modular presets built with Tailwind CSS/Inline styles optimized specifically for conversion engines like puppeteer or pdfkit.
* Step 2: Typography & Colour Palettes – Pulls web-safe font weights directly using the Google Fonts VS Code Extension engine to keep styling sharp, paired with a global accent colour switcher.
* Step 3: Document Toolkit Actions – Features UI triggers to run quick operations: Merge Multiple PDFs, Split Pages, or append text directly to files located in the target server repository.

## Digital Handwritten Signature Authenticator

* Canvas Input: An interactive HTML5 <canvas> field captures smooth, anti-aliased cursor or touch drawing pathways for handwritten signatures.
* Secure Validation Layer: The engine binds cryptographic validation metadata to the drawing matrix. It uses a standalone client-side hash verification technique (similar to Vercel/GitHub signature patterns like noble-crypto or signature-pad packages) to securely stamp the signature directly into the PDF structure as an unalterable vector layer.

------------------------------
## 4. Agent Financial & Execution Guardrails

* Budget Ceiling: The AI agents have a strict, hardcoded $5 execution limit. [7] 
* Manual Spend Verification: If processing requires paid API blocks, multi-language translation translation APIs, or infrastructure hosted in international nodes (e.g., specific regional cloud setups in China or India), the process pauses automatically.
* Pete's Billing Portal: The agent logs a billing quote file inside \\pete\presentations\sys_logs\ for manual approval, so Pete can audit spending patterns and authorize payment manually.

Would you like the full JavaScript code snippet to handle the cryptographic canvas signature verification layer?

[1] [https://modelcontextprotocol.io](https://modelcontextprotocol.io/examples)
[2] [https://www.anthropic.com](https://www.anthropic.com/news/model-context-protocol)
[3] [https://github.com](https://github.com/pietermyb/mcp-pdf-reader)
[4] [https://github.com](https://github.com/jztan/pdf-mcp)
[5] [https://pypi.org](https://pypi.org/project/mcp-ocr/)
[6] [https://mcpmarket.com](https://mcpmarket.com/server/tesseract-1)
[7] [https://play.google.com](https://play.google.com/store/apps/details?id=com.yourname.pdftoolkit)



