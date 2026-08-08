/* Vistamations Media Player — Video Module */
(function () {
  var video = null;
  var hls = null;
  var iptvChannels = [];
  var videoFilters = { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0 };

  var DEFAULT_IPTV = [
    { name: 'Big Buck Bunny (HLS)', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', group: 'Test' },
    { name: 'Tears of Steel (HLS)', url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', group: 'Test' },
    { name: 'Sintel Trailer (HLS)', url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', group: 'Test' },
    { name: 'Live: NASA TV', url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8', group: 'Live' },
    { name: 'Live: Al Jazeera', url: 'https://live-hls-web-aje.getaj.net/AJE/01.m3u8', group: 'Live' },
  ];

  function getVideo() {
    if (!video) video = document.getElementById('videoPlayer');
    return video;
  }

  function applyFilters() {
    var v = getVideo();
    if (!v) return;
    var f = videoFilters;
    v.style.filter = 'brightness(' + (f.brightness / 100) + ') ' +
      'contrast(' + (f.contrast / 100) + ') ' +
      'saturate(' + (f.saturation / 100) + ') ' +
      'hue-rotate(' + f.hue + 'deg) ' +
      'blur(' + f.blur + 'px)';
  }

  function setFilter(name, val) {
    videoFilters[name] = val;
    applyFilters();
    document.getElementById('vid_' + name + '_val').textContent = val + (name === 'hue' ? '°' : name === 'blur' ? 'px' : '%');
  }

  function loadSource(url, useHLS) {
    var v = getVideo();
    if (!v) return;
    destroyHLS();
    if (useHLS && window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(v);
      hls.on(window.Hls.Events.MANIFEST_PARSED, function () { v.play().catch(function () {}); });
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url;
      v.play().catch(function () {});
    } else {
      v.src = url;
      v.play().catch(function () {});
    }
    applyFilters();
    MP.toast('Loading: ' + url.substring(0, 50) + '...');
    updateStreamStatus(url);
  }

  function destroyHLS() {
    if (hls) { hls.destroy(); hls = null; }
  }

  function loadLocalFile(file) {
    var url = URL.createObjectURL(file);
    loadSource(url, false);
  }

  function parseM3U(content) {
    var lines = content.split('\n');
    var channels = [];
    var current = null;
    lines.forEach(function (line) {
      line = line.trim();
      if (line.startsWith('#EXTINF:')) {
        var nameMatch = line.match(/,(.+)/);
        var groupMatch = line.match(/group-title="([^"]+)"/);
        current = { name: nameMatch ? nameMatch[1].trim() : 'Unknown', group: groupMatch ? groupMatch[1] : 'General' };
      } else if (line && !line.startsWith('#') && current) {
        current.url = line;
        channels.push(current);
        current = null;
      }
    });
    return channels;
  }

  function loadIPTV(source) {
    if (source === 'default') {
      iptvChannels = DEFAULT_IPTV;
      renderChannels();
      return;
    }
    fetch(source).then(function (r) { return r.text(); }).then(function (text) {
      iptvChannels = parseM3U(text);
      if (iptvChannels.length === 0) { iptvChannels = DEFAULT_IPTV; MP.toast('Empty playlist, using defaults'); }
      renderChannels();
      MP.toast('Loaded ' + iptvChannels.length + ' channels');
    }).catch(function () {
      iptvChannels = DEFAULT_IPTV;
      renderChannels();
      MP.toast('Failed to load playlist, using defaults');
    });
  }

  function renderChannels() {
    var el = document.getElementById('streamList');
    if (!el) return;
    el.innerHTML = iptvChannels.map(function (ch, i) {
      return '<div class="stream-item" data-idx="' + i + '">' +
        '<span class="stream-name">' + ch.name + '</span>' +
        '<span class="stream-meta">' + (ch.group || '') + '</span>' +
        '</div>';
    }).join('');
  }

  function resetFilters() {
    videoFilters = { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0 };
    applyFilters();
    ['brightness','contrast','saturation','hue','blur'].forEach(function (f) {
      var sl = document.getElementById('vid_' + f);
      if (sl) {
        sl.value = videoFilters[f];
        var valEl = document.getElementById('vid_' + f + '_val');
        if (valEl) valEl.textContent = videoFilters[f] + (f === 'hue' ? '°' : f === 'blur' ? 'px' : '%');
      }
    });
  }

  function updateStreamStatus(url) {
    var el = document.getElementById('streamStatus');
    if (!el) return;
    var ch = iptvChannels.find(function (c) { return c.url === url; });
    el.textContent = ch ? 'Playing: ' + ch.name : 'Playing: ' + url.substring(0, 60);
  }

  function onActivate() {
    var v = getVideo();
    if (!v) return;
    applyFilters();
    if (!iptvChannels.length) loadIPTV('default');
  }

  // FFmpeg conversion
  async function convertVideo(inputFile, outputFormat) {
    var ffmpeg = await window.MP.loadFFmpeg();
    if (!ffmpeg) return;
    var inputName = 'input.' + (inputFile.name.split('.').pop() || 'mp4');
    var outputName = 'output.' + outputFormat;
    try {
      var data = await inputFile.arrayBuffer();
      await ffmpeg.writeFile(inputName, new Uint8Array(data));
      MP.toast('Converting to ' + outputFormat + '...');
      await ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', outputName]);
      var outputData = await ffmpeg.readFile(outputName);
      var blob = new Blob([outputData.buffer], { type: 'video/' + outputFormat });
      var url = URL.createObjectURL(blob);
      loadSource(url, false);
      MP.toast('Conversion complete');
    } catch (e) {
      MP.toast('Conversion error: ' + e.message);
    }
  }

  // ─── BIND ───
  function bind() {
    // Video file input
    var fi = document.getElementById('videoFileInput');
    if (fi) fi.addEventListener('change', function () {
      Array.from(this.files).forEach(loadLocalFile);
      this.value = '';
    });

    // Stream URL input
    var streamUrl = document.getElementById('streamUrl');
    var streamBtn = document.getElementById('streamLoadBtn');
    if (streamBtn) streamBtn.addEventListener('click', function () {
      var url = streamUrl.value.trim();
      if (!url) return;
      var isHLS = url.endsWith('.m3u8') || url.endsWith('.m3u');
      loadSource(url, isHLS);
    });
    if (streamUrl) streamUrl.addEventListener('keydown', function (e) { if (e.key === 'Enter') streamBtn.click(); });

    // M3U playlist load
    var m3uUrl = document.getElementById('m3uUrl');
    var m3uBtn = document.getElementById('m3uLoadBtn');
    if (m3uBtn) m3uBtn.addEventListener('click', function () {
      var url = m3uUrl.value.trim();
      if (url) loadIPTV(url);
      else loadIPTV('default');
    });
    if (m3uUrl) m3uUrl.addEventListener('keydown', function (e) { if (e.key === 'Enter') m3uBtn.click(); });

    // Stream list click
    var sl = document.getElementById('streamList');
    if (sl) sl.addEventListener('click', function (e) {
      var item = e.target.closest('.stream-item');
      if (item) {
        var ch = iptvChannels[parseInt(item.dataset.idx)];
        if (ch) {
          var isHLS = ch.url.endsWith('.m3u8') || ch.url.endsWith('.m3u');
          loadSource(ch.url, isHLS);
        }
      }
    });

    // FFmpeg convert
    var convBtn = document.getElementById('convertBtn');
    var convFormat = document.getElementById('convertFormat');
    var convFile = document.getElementById('convertFile');
    if (convBtn) convBtn.addEventListener('click', function () {
      if (convFile.files.length === 0) { MP.toast('Select a file first'); return; }
      convertVideo(convFile.files[0], convFormat.value);
    });

    // Filter sliders
    ['brightness', 'contrast', 'saturation', 'hue', 'blur'].forEach(function (f) {
      var sl = document.getElementById('vid_' + f);
      if (sl) sl.addEventListener('input', function () { setFilter(f, parseFloat(this.value)); });
    });

    // Reset filters
    var resetBtn = document.getElementById('vidFiltersReset');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  window.VideoModule = {
    onActivate: onActivate,
    loadSource: loadSource,
    loadIPTV: loadIPTV,
    loadLocalFile: loadLocalFile,
    destroyHLS: destroyHLS,
    getVideo: getVideo,
    applyFilters: applyFilters,
  };
})();
