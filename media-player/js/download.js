/* Vistamations Media Player — Download Manager */
(function () {
  var downloads = [];
  var nextId = 1;

  async function startDownload(url, filename) {
    var id = 'dl_' + (nextId++);
    downloads.push({ id: id, name: filename || url.split('/').pop() || 'download', url: url, progress: 0, loaded: 0, total: 0, status: 'starting', blob: null });
    renderDownloads();
    try {
      var res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var total = parseInt(res.headers.get('content-length') || '0');
      var entry = downloads.find(function (d) { return d.id === id; });
      if (entry) { entry.total = total; entry.status = 'downloading'; }
      renderDownloads();
      var reader = res.body.getReader();
      var chunks = [];
      var loaded = 0;
      while (true) {
        var result = await reader.read();
        if (result.done) break;
        chunks.push(result.value);
        loaded += result.value.length;
        var e = downloads.find(function (d) { return d.id === id; });
        if (e) { e.loaded = loaded; e.progress = total ? loaded / total : 0; }
        renderDownloads();
      }
      var blob = new Blob(chunks);
      var e = downloads.find(function (d) { return d.id === id; });
      if (e) { e.blob = blob; e.status = 'complete'; e.progress = 1; }
      renderDownloads();
      MP.toast('Download complete: ' + filename);
    } catch (err) {
      var e = downloads.find(function (d) { return d.id === id; });
      if (e) { e.status = 'error: ' + err.message; }
      renderDownloads();
      MP.toast('Download failed: ' + err.message);
    }
  }

  function saveFile(id) {
    var entry = downloads.find(function (d) { return d.id === id; });
    if (!entry || !entry.blob) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(entry.blob);
    a.download = entry.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function removeDownload(id) {
    downloads = downloads.filter(function (d) { return d.id !== id; });
    renderDownloads();
  }

  function renderDownloads() {
    var el = document.getElementById('downloadList');
    if (!el) return;
    if (downloads.length === 0) { el.innerHTML = '<div class="torrent-item"><span class="torrent-name" style="opacity:0.4">No downloads</span></div>'; return; }
    el.innerHTML = downloads.map(function (d) {
      var pct = Math.round(d.progress * 100);
      return '<div class="download-item">' +
        '<div class="dl-name">' + d.name + '</div>' +
        '<div class="dl-bar"><div class="dl-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="dl-meta">' +
        '<span>' + d.status + '</span>' +
        '<span>' + MP.fmtSize(d.loaded) + (d.total ? ' / ' + MP.fmtSize(d.total) : '') + '</span>' +
        '</div>' +
        '<div class="btn-row" style="margin-top:4px">' +
        (d.blob ? '<button class="btn" style="padding:4px 10px;font-size:10px" data-save="' + d.id + '">Save</button>' : '') +
        '<button class="btn" style="padding:4px 10px;font-size:10px" data-remove="' + d.id + '">Remove</button>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  function bind() {
    var urlInput = document.getElementById('dlUrl');
    var nameInput = document.getElementById('dlName');
    var dlBtn = document.getElementById('dlStartBtn');
    if (dlBtn) dlBtn.addEventListener('click', function () {
      var url = urlInput.value.trim();
      if (!url) { MP.toast('Enter a URL'); return; }
      startDownload(url, nameInput.value.trim() || null);
      urlInput.value = '';
    });
    if (urlInput) urlInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') dlBtn.click(); });

    var dlList = document.getElementById('downloadList');
    if (dlList) dlList.addEventListener('click', function (e) {
      var save = e.target.closest('[data-save]');
      var remove = e.target.closest('[data-remove]');
      if (save) saveFile(save.dataset.save);
      if (remove) removeDownload(remove.dataset.remove);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
