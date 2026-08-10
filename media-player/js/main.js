/* Vistamations Media Player — Main Orchestrator */
(function () {
  const TABS = ['audio', 'video', 'torrent', 'download', 'agents', 'settings'];
  let activeTab = 'audio';

  window.MP = {
    toast: function (msg, duration) {
      duration = duration || 2500;
      var el = document.getElementById('toast');
      if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.classList.remove('show'); }, duration);
    },
    formatTime: function (sec) {
      var m = Math.floor(sec / 60);
      var s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    },
    fmtSize: function (bytes) {
      if (!bytes || bytes === 0) return '0 B';
      var u = ['B', 'KB', 'MB', 'GB'];
      var i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
    }
  };

  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll('.app-tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('.tab-content').forEach(function (t) {
      t.classList.toggle('active', t.id === 'tab-' + name);
    });
    window.location.hash = name;
    if (name === 'video' && window.VideoModule && window.VideoModule.onActivate) window.VideoModule.onActivate();
    if (name === 'torrent' && window.TorrentModule && window.TorrentModule.onActivate) window.TorrentModule.onActivate();
    if (name === 'audio' && window.AudioModule && window.AudioModule.onActivate) window.AudioModule.onActivate();
    if (name === 'agents' && window.AgentChat && window.AgentChat.onActivate) window.AgentChat.onActivate();
  }

  document.querySelectorAll('.app-tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  var hash = window.location.hash.replace('#', '');
  if (hash === 'media') hash = 'video';
  if (TABS.indexOf(hash) !== -1) switchTab(hash);
  else switchTab('audio');

  // Status update  
  function updateStatus() {
    var el = document.getElementById('statusText');
    if (el) el.textContent = new Date().toLocaleTimeString() + ' — Vistamations Media';
  }
  updateStatus();
  setInterval(updateStatus, 10000);

  // FFmpeg loader (shared)
  window.MP.loadFFmpeg = async function () {
    if (window.MP._ffmpeg) return window.MP._ffmpeg;
    if (window.MP._ffmpegLoading) return window.MP._ffmpegLoading;
    window.MP._ffmpegLoading = (async function () {
      try {
        var FFmpegWASM = window.FFmpegWASM;
        var FFmpegUtil = window.FFmpegUtil;
        if (!FFmpegWASM) { MP.toast('FFmpeg module not loaded'); return null; }
        if (!FFmpegUtil || !FFmpegUtil.toBlobURL) { MP.toast('FFmpeg util missing'); return null; }
        var ffmpeg = new FFmpegWASM.FFmpeg();
        var baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
        MP.toast('Loading FFmpeg (~31MB)...');
        await ffmpeg.load({
          coreURL: await FFmpegUtil.toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript'),
          wasmURL: await FFmpegUtil.toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm'),
        });
        window.MP._ffmpeg = ffmpeg;
        MP.toast('FFmpeg ready');
        return ffmpeg;
      } catch (e) {
        MP.toast('FFmpeg load failed: ' + e.message);
        window.MP._ffmpegLoading = null;
        return null;
      }
    })();
    return window.MP._ffmpegLoading;
  };

})();
