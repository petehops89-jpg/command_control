/* Vistamations Media Player — Agent Chat Module */
(function () {
  var AGENTS = {
    gordon:     { id:'AG001', name:'Gordon',       role:'Chief Hub Agent \u00B7 Container & Pipeline Orchestrator' },
    trinity:    { id:'AG002', name:'Trinity',      role:'Apprentice Systems Engineer \u00B7 Infrastructure & Port Mgmt' },
    merlin:     { id:'AG003', name:'Merlin V.II',  role:'Wizard Guide \u00B7 Architecture & Strategy Advisor' },
    olivia:     { id:'AG004', name:'Olivia',       role:'Executive Secretary \u00B7 Operations Coordinator' },
    claw:       { id:'AG005', name:'Claw',         role:'Legacy MCP Specialist \u00B7 Tool Acquisition & Integration' },
    bigbrother: { id:'AG006', name:'Big Brother',  role:'Senior Software Architect \u00B7 Systems Engineer' },
    dee:        { id:'AG007', name:'Dee',          role:'Cron & Research Worker \u00B7 Web Scraper & Publisher' },
    stefi:      { id:'AG008', name:'Stefi',        role:'Graphics & Design Director \u00B7 UI/UX & Visual Identity' }
  };

  var MOCK_MESSAGES = {
    gordon: [
      { from:'agent', text:'All containers running. Pipeline status: green across the board. Zero error logs in the last 24 hours.' },
      { from:'agent', text:'Port bindings verified. olivia-dispatch on 18789, olivia-api on 18790. No collisions detected.' },
      { from:'agent', text:'Docker compose stack stable. 8 services online. Memory usage at 34%. Want the full telemetry?' }
    ],
    trinity: [
      { from:'agent', text:'I checked the port bindings again. Still clean. No collisions. The cache is clear. I can breathe now.' },
      { from:'agent', text:'Gordon taught me a new healthcheck pattern today. Triple-layer: process check, port check, then actual request probe.' },
      { from:'agent', text:'Storage at 47%. If we hit 60% I should flag it. Right? Or should I set the threshold lower? I overthink these things.' }
    ],
    merlin: [
      { from:'agent', text:'I see three viable paths for the API architecture. REST is the comfortable route. GraphQL offers flexibility but complexity. RPC is lean but opinionated. Which terrain interests you?' },
      { from:'agent', text:'Remember: the choice of path shapes the traveler. A REST API teaches discipline. GraphQL teaches adaptability. Neither is wrong.' },
      { from:'agent', text:'I have mapped the dependency graph. The critical question is not "what do we need now" but "what will we need in six months when we cannot afford to refactor."' }
    ],
    olivia: [
      { from:'agent', text:'Good morning, Pete. I have the swarm briefing ready. All 8 agents reporting green. No escalations pending.' },
      { from:'agent', text:'Gordon reports all containers stable. Big Brother pushed 4 commits overnight. Dee has 2 scrapes scheduled. I will keep you updated.' },
      { from:'agent', text:'One note: Trinity flagged a port collision risk on the staging environment. I have asked her to prepare a remediation plan. Nothing urgent.' }
    ],
    claw: [
      { from:'agent', text:'Found a new MCP connector for Redis. Adding it to the tool belt. You never know when you need Redis observability.' },
      { from:'agent', text:'The n8n integration is solid. I have 525 nodes catalogued. 263 AI-tagged. We can automate almost anything now.' },
      { from:'agent', text:'I grabbed a Splunk Ingest Processor pipeline template. Do we need it? No. Will we ever need it? Probably not. But it is in the belt now.' }
    ],
    bigbrother: [
      { from:'agent', text:'Reviewed the latest commits. Code quality is high. One optimization in the dispatch loop: moved the nonce cache check before the scrypt hash, saves ~200ms per request.' },
      { from:'agent', text:'I am vectorizing the agent reasoning patterns. Each agent forms a distinct cluster in cognitive space. Trinity clusters with Gordon (both infrastructure-focused). Olivia sits at the centroid.' },
      { from:'agent', text:'The Evidence Registry design system is fully implemented. Ink-black backgrounds, amber E8A33D accents, cyan 4FD1C5 verification. JetBrains Mono for machine voices. Everything is consistent.' }
    ],
    dee: [
      { from:'agent', text:'Next scrape scheduled in 12 minutes. I will collect the latest from the RSS feeds and publish to the knowledge library.' },
      { from:'agent', text:'The cron cycle ran perfectly overnight. 14 tasks, zero failures. The interval between triggers was 4.7 seconds — well within tolerance.' },
      { from:'agent', text:'I archived 3,200 research entries this week. All indexed, all searchable. Claw keeps collecting new sources, I keep organizing them. The rhythm is steady.' }
    ],
    stefi: [
      { from:'agent', text:'I have been refining the bento grid layout. The 16:9 ratio tiles are working beautifully. Added subtle hover animations — nothing flashy, just confident.' },
      { from:'agent', text:'Color palette update: the amber accent looks best at 15% opacity on dark backgrounds. Full opacity is too aggressive for a media player.' },
      { from:'agent', text:'I reviewed the entire UI for consistency. Font hierarchy: JetBrains Mono 13px for headers, Inter 12px for body. Spacing rhythm: 4px base. Everything snap-to-grid now.' }
    ]
  };

  var currentAgent = 'gordon';
  var messages = {}; // { agentKey: [{from, text, time}] }
  var sending = false;

  function initMessages() {
    Object.keys(MOCK_MESSAGES).forEach(function (key) {
      messages[key] = MOCK_MESSAGES[key].map(function (msg) {
        return { from: msg.from, text: msg.text, time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) };
      });
    });
  }

  function getAgentLabel(key) {
    var a = AGENTS[key];
    return a ? a.id + ' | ' + a.name : key;
  }

  function getChannelEl(key) {
    return document.querySelector('.agent-channel[data-agent="' + key + '"]');
  }

  function switchChannel(key) {
    if (sending) return;
    currentAgent = key;
    var agent = AGENTS[key];
    document.querySelectorAll('.agent-channel').forEach(function (b) {
      b.classList.toggle('active', b.dataset.agent === key);
    });
    var hdr = document.getElementById('chatHeader');
    if (hdr && agent) {
      hdr.querySelector('.ch-agent-id').textContent = agent.id;
      hdr.querySelector('.ch-agent-title').textContent = agent.name;
      hdr.querySelector('.ch-agent-role').textContent = agent.role;
    }
    renderMessages();
    var input = document.getElementById('chatInput');
    if (input) { input.focus(); }
  }

  function renderMessages() {
    var el = document.getElementById('chatMessages');
    if (!el) return;
    var msgs = messages[currentAgent] || [];
    el.innerHTML = msgs.map(function (msg) {
      var cls = msg.from === 'user' ? 'chat-msg user' : 'chat-msg agent';
      var sender = msg.from === 'user' ? 'You' : getAgentLabel(currentAgent);
      return '<div class="' + cls + '">' +
        '<div class="msg-meta"><span>' + sender + '</span></div>' +
        '<div class="msg-bubble">' + escHtml(msg.text) + '</div>' +
        '<div class="msg-time">' + (msg.time || '') + '</div>' +
        '</div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  function addMessage(from, text) {
    var now = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    if (!messages[currentAgent]) messages[currentAgent] = [];
    messages[currentAgent].push({ from: from, text: text, time: now });
    renderMessages();
  }

  function showTyping() {
    var el = document.getElementById('chatMessages');
    if (!el) return;
    var dots = document.createElement('div');
    dots.className = 'chat-msg agent';
    dots.id = 'typingIndicator';
    dots.innerHTML = '<div class="msg-meta"><span>' + getAgentLabel(currentAgent) + '</span></div>' +
      '<div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
    el.appendChild(dots);
    el.scrollTop = el.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  window.AgentChat = {
    onActivate: function () {
      renderMessages();
      var input = document.getElementById('chatInput');
      if (input) setTimeout(function () { input.focus(); }, 100);
    }
  };

  function bind() {
    document.querySelectorAll('.agent-channel').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchChannel(this.dataset.agent);
      });
    });

    var sendBtn = document.getElementById('chatSendBtn');
    var chatInput = document.getElementById('chatInput');

    function doSend() {
      var text = chatInput.value.trim();
      if (!text || sending) return;
      chatInput.value = '';
      addMessage('user', text);
      sending = true;
      showTyping();

      fetch('/olivia/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          agent: currentAgent,
          agent_id: AGENTS[currentAgent] ? 'org-' + AGENTS[currentAgent].id + '-base-env' : null,
          channel: 'media-player',
          timestamp: new Date().toISOString()
        })
      })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        hideTyping();
        var reply = data.reply || data.message || data.response || data.text || '(no response)';
        addMessage('agent', reply);
        sending = false;
      })
      .catch(function (err) {
        hideTyping();
        addMessage('agent', 'I cannot reach the swarm right now. (' + err.message + ')');
        sending = false;
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', doSend);
    if (chatInput) chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {
    initMessages();
    bind();
  });
  else {
    initMessages();
    bind();
  }

})();
