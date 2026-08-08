/* Vistamations Media Player — Torrent Module */
(function () {
  var client = null;
  var torrents = [];
  var clientId = null;

  function initClient() {
    if (client) return client;
    if (!window.WebTorrent) {
      MP.toast('WebTorrent not loaded');
      return null;
    }
    client = new window.WebTorrent();
    client.on('error', function (err) { MP.toast('Torrent error: ' + err.message); });
    client.on('warning', function (warn) { console.warn('WT:', warn); });
    return client;
  }

  function addMagnet(magnetURI) {
    var wt = initClient();
    if (!wt) return;
    var existing = torrents.find(function (t) { return t.magnetURI === magnetURI; });
    if (existing) { MP.toast('Torrent already added'); return; }
    var id = 't_' + Date.now();
    torrents.push({ id: id, magnetURI: magnetURI, name: 'Connecting...', progress: 0, torrent: null });
    renderTorrents();
    wt.add(magnetURI, { announce: ['wss://tracker.openwebtorrent.com', 'wss://tracker.btorrent.xyz'] }, function (torrent) {
      var entry = torrents.find(function (t) { return t.id === id; });
      if (!entry) return;
      entry.name = torrent.name;
      entry.torrent = torrent;
      entry.progress = 1;
      torrent.on('download', function () { entry.progress = torrent.progress; renderTorrents(); });
      torrent.on('done', function () {
        entry.progress = 1;
        renderTorrents();
        MP.toast('Download complete: ' + torrent.name);
      });
      renderTorrents();
      MP.toast('Torrent ready: ' + torrent.name);

      // Stream to video if it's a playable file
      var file = torrent.files.find(function (f) {
        return f.name.endsWith('.mp4') || f.name.endsWith('.webm') || f.name.endsWith('.mkv') || f.name.endsWith('.m3u8');
      });
      if (file) {
        file.renderTo('#torrentVideo', { autoplay: false, controls: true }, function (err) {
          if (err) MP.toast('Render error: ' + err.message);
        });
        // Switch to video tab
        var torrentVideo = document.getElementById('torrentVideoContainer');
        if (torrentVideo) torrentVideo.style.display = 'block';
      }
    });
  }

  function addTorrentFile(file) {
    var wt = initClient();
    if (!wt) return;
    wt.add(file, function (torrent) {
      var id = 't_' + Date.now();
      torrents.push({ id: id, name: torrent.name, progress: 1, torrent: torrent, magnetURI: '' });
      torrent.on('download', function () {
        var entry = torrents.find(function (t) { return t.id === id; });
        if (entry) entry.progress = torrent.progress;
        renderTorrents();
      });
      torrent.on('done', function () { MP.toast('Download complete: ' + torrent.name); renderTorrents(); });
      renderTorrents();
      var file = torrent.files.find(function (f) {
        return f.name.endsWith('.mp4') || f.name.endsWith('.webm') || f.name.endsWith('.mkv');
      });
      if (file) {
        file.renderTo('#torrentVideo', { autoplay: false, controls: true }, function (err) {
          if (err) MP.toast('Render error: ' + err.message);
        });
        var torrentVideo = document.getElementById('torrentVideoContainer');
        if (torrentVideo) torrentVideo.style.display = 'block';
      }
    });
  }

  function removeTorrent(id) {
    var idx = torrents.findIndex(function (t) { return t.id === id; });
    if (idx !== -1) {
      var t = torrents[idx];
      if (t.torrent) t.torrent.destroy();
      torrents.splice(idx, 1);
      renderTorrents();
    }
  }

  function renderTorrents() {
    var el = document.getElementById('torrentList');
    if (!el) return;
    if (torrents.length === 0) { el.innerHTML = '<div class="torrent-item"><span class="torrent-name" style="opacity:0.4">No active torrents</span></div>'; return; }
    el.innerHTML = torrents.map(function (t) {
      return '<div class="torrent-item">' +
        '<div style="flex:1;min-width:0">' +
        '<div class="torrent-name">' + (t.name || 'Connecting...') + '</div>' +
        '<div style="height:3px;background:#1a1a28;border-radius:2px;margin-top:4px"><div style="height:100%;width:' + (t.progress * 100) + '%;background:var(--accent2);border-radius:2px;transition:width 0.5s"></div></div>' +
        '</div>' +
        '<span style="font-size:11px;color:var(--accent);margin-left:12px;white-space:nowrap">' + Math.round(t.progress * 100) + '%</span>' +
        '<button class="btn" style="margin-left:8px;padding:4px 10px;font-size:10px" data-remove="' + t.id + '">X</button>' +
        '</div>';
    }).join('');
  }

  function onActivate() {
    initClient();
  }

  function bind() {
    var magnetInput = document.getElementById('magnetInput');
    var magnetBtn = document.getElementById('magnetBtn');
    if (magnetBtn) magnetBtn.addEventListener('click', function () {
      var uri = magnetInput.value.trim();
      if (!uri) { MP.toast('Enter a magnet link'); return; }
      addMagnet(uri);
      magnetInput.value = '';
    });
    if (magnetInput) magnetInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') magnetBtn.click(); });

    var torrentFile = document.getElementById('torrentFileInput');
    if (torrentFile) torrentFile.addEventListener('change', function () {
      Array.from(this.files).forEach(addTorrentFile);
      this.value = '';
    });

    var torrentList = document.getElementById('torrentList');
    if (torrentList) torrentList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove]');
      if (btn) removeTorrent(btn.dataset.remove);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  window.TorrentModule = {
    onActivate: onActivate,
    addMagnet: addMagnet,
    addTorrentFile: addTorrentFile,
  };
})();
