/* Vistamations Media Player — Audio Module */
(function () {
  var audio = new Audio();
  var audioCtx = null;
  var sourceNode = null;
  var analyser = null;
  var eqFilters = [];
  var playlist = [];
  var playlistIndex = -1;
  var animFrame = null;
  var eqPreset = 'flat';

  var EQ_BANDS = [
    { name: '32', freq: 32, type: 'lowshelf' },
    { name: '64', freq: 64, type: 'peaking' },
    { name: '125', freq: 125, type: 'peaking' },
    { name: '250', freq: 250, type: 'peaking' },
    { name: '500', freq: 500, type: 'peaking' },
    { name: '1K', freq: 1000, type: 'peaking' },
    { name: '2K', freq: 2000, type: 'peaking' },
    { name: '4K', freq: 4000, type: 'peaking' },
    { name: '8K', freq: 8000, type: 'peaking' },
    { name: '16K', freq: 16000, type: 'highshelf' },
  ];

  var EQ_PRESETS = {
    flat:    [0,0,0,0,0,0,0,0,0,0],
    bass:    [8,6,4,2,0,0,0,0,0,0],
    pop:     [-2,1,3,4,2,0,-1,-1,0,0],
    rock:    [5,4,2,0,-1,-1,0,1,2,3],
    jazz:    [4,3,1,0,0,-1,-1,0,1,1],
    classical:[4,3,1,0,-1,-1,0,1,2,3],
    vocal:   [-3,-2,0,2,4,3,1,0,0,0],
    electronic:[6,5,3,0,-2,-1,0,1,2,3],
  };

  function initAudioCtx() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    var lastNode = sourceNode;
    eqFilters = EQ_BANDS.map(function (band) {
      var f = audioCtx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      f.gain.value = 0;
      f.Q.value = band.type === 'peaking' ? 1.0 : 0.7;
      lastNode.connect(f);
      lastNode = f;
      return f;
    });
    lastNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function ensureContext() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    initAudioCtx();
  }

  function loadFile(file) {
    var url = URL.createObjectURL(file);
    var exists = playlist.some(function (item) { return item.name === file.name; });
    if (!exists) { playlist.push({ name: file.name, url: url, file: file }); }
    playlistIndex = playlist.length - 1;
    playIndex(playlistIndex);
    renderPlaylist();
  }

  function playIndex(idx) {
    if (idx < 0 || idx >= playlist.length) return;
    playlistIndex = idx;
    var item = playlist[idx];
    ensureContext();
    audio.src = item.url;
    audio.play().catch(function () {});
    updateNowPlaying(item.name);
    renderPlaylist();
    startVisualizer();
  }

  function updateNowPlaying(name) {
    document.getElementById('trackTitle').textContent = name || 'No track';
    document.getElementById('trackArtist').textContent = 'Vistamations Audio';
  }

  function renderPlaylist() {
    var el = document.getElementById('playlist');
    if (!el) return;
    el.innerHTML = playlist.map(function (item, i) {
      var cls = i === playlistIndex ? 'playlist-item playing' : 'playlist-item';
      return '<div class="' + cls + '" data-idx="' + i + '">' +
        '<span>' + item.name + '</span>' +
        '<span style="font-size:10px;opacity:0.4">' + (item.duration ? MP.formatTime(item.duration) : '') + '</span>' +
        '</div>';
    }).join('');
  }

  function startVisualizer() {
    if (animFrame) cancelAnimationFrame(animFrame);
    var canvas = document.getElementById('vizCanvas');
    var ctx = canvas ? canvas.getContext('2d') : null;
    if (!ctx || !analyser) return;
    var bufLen = analyser.frequencyBinCount;
    var dataArr = new Uint8Array(bufLen);

    function draw() {
      animFrame = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArr);
      var W = canvas.width, H = canvas.height;
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);
      var barW = W / bufLen * 2.5;
      var x = 0;
      for (var i = 0; i < bufLen; i++) {
        var h = (dataArr[i] / 255) * H;
        var grad = ctx.createLinearGradient(0, H, 0, H - h);
        grad.addColorStop(0, '#7c4dff');
        grad.addColorStop(1, '#00e5ff');
        ctx.fillStyle = grad;
        ctx.fillRect(x, H - h, barW - 1, h);
        x += barW;
      }
    }
    draw();
  }

  function stopVisualizer() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    var canvas = document.getElementById('vizCanvas');
    if (canvas) { var ctx = canvas.getContext('2d'); ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  }

  function setEQGains(gains) {
    eqFilters.forEach(function (f, i) { if (gains[i] !== undefined) f.gain.value = gains[i]; });
    document.querySelectorAll('.eq-band input[type="range"]').forEach(function (slider, i) {
      if (gains[i] !== undefined) { slider.value = gains[i]; }
    });
    document.querySelectorAll('.eq-band .value').forEach(function (v, i) {
      if (gains[i] !== undefined) { v.textContent = (gains[i] > 0 ? '+' : '') + gains[i].toFixed(1) + 'dB'; }
    });
    var presetEl = document.getElementById('eqPreset');
    if (presetEl) presetEl.value = eqPreset;
  }

  function getEQGains() {
    return eqFilters.map(function (f) { return f.gain.value; });
  }

  // ─── INIT ───
  window.AudioModule = {
    onActivate: function () {
      var canvas = document.getElementById('vizCanvas');
      if (canvas) { canvas.width = canvas.parentElement.clientWidth; canvas.height = 120; }
    },
    getAudio: function () { return audio; },
    getCtx: function () { return audioCtx; },
    getAnalyser: function () { return analyser; },
    initCtx: ensureContext,
  };

  // ─── EVENT BINDING (deferred until DOM ready) ───
  function bind() {
    // Play/Pause
    var btnPlay = document.getElementById('btnPlay');
    if (btnPlay) btnPlay.addEventListener('click', function () {
      ensureContext();
      if (audio.paused) { audio.play().catch(function () {}); btnPlay.textContent = '\u25B6'; }
      else { audio.pause(); btnPlay.textContent = '\u23F8'; }
    });

    // Prev/Next
    var btnPrev = document.getElementById('btnPrev');
    if (btnPrev) btnPrev.addEventListener('click', function () {
      if (playlist.length === 0) return;
      playIndex((playlistIndex - 1 + playlist.length) % playlist.length);
    });
    var btnNext = document.getElementById('btnNext');
    if (btnNext) btnNext.addEventListener('click', function () {
      if (playlist.length === 0) return;
      playIndex((playlistIndex + 1) % playlist.length);
    });

    // Stop
    var btnStop = document.getElementById('btnStop');
    if (btnStop) btnStop.addEventListener('click', function () {
      audio.pause(); audio.currentTime = 0; stopVisualizer();
      var bp = document.getElementById('btnPlay'); if (bp) bp.textContent = '\u25B6';
    });

    // Volume
    var volSlider = document.getElementById('volSlider');
    if (volSlider) volSlider.addEventListener('input', function () {
      audio.volume = this.value / 100;
    });

    // Progress bar
    var progBar = document.getElementById('progBar');
    if (progBar) progBar.addEventListener('click', function (e) {
      var rect = this.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pct * (audio.duration || 0);
    });

    audio.addEventListener('timeupdate', function () {
      var fill = document.getElementById('progFill');
      var cur = document.getElementById('timeCur');
      var dur = document.getElementById('timeDur');
      if (fill) fill.style.width = (audio.duration ? (audio.currentTime / audio.duration * 100) : 0) + '%';
      if (cur) cur.textContent = MP.formatTime(audio.currentTime);
      if (dur) dur.textContent = MP.formatTime(audio.duration || 0);
    });

    audio.addEventListener('ended', function () {
      if (playlist.length > 0 && playlistIndex < playlist.length - 1) {
        playIndex(playlistIndex + 1);
      } else {
        stopVisualizer();
        var bp = document.getElementById('btnPlay'); if (bp) bp.textContent = '\u25B6';
      }
    });

    audio.addEventListener('play', function () {
      var bp = document.getElementById('btnPlay'); if (bp) bp.textContent = '\u23F8';
      startVisualizer();
    });
    audio.addEventListener('pause', function () {
      var bp = document.getElementById('btnPlay'); if (bp) bp.textContent = '\u25B6';
      stopVisualizer();
    });

    // File input
    var fileInput = document.getElementById('audioFileInput');
    if (fileInput) fileInput.addEventListener('change', function () {
      Array.from(this.files).forEach(loadFile);
      this.value = '';
    });

    // Playlist click
    var pl = document.getElementById('playlist');
    if (pl) pl.addEventListener('click', function (e) {
      var item = e.target.closest('.playlist-item');
      if (item) { playIndex(parseInt(item.dataset.idx)); }
    });

    // EQ sliders
    document.querySelectorAll('.eq-band input[type="range"]').forEach(function (slider, i) {
      slider.addEventListener('input', function () {
        var v = parseFloat(this.value);
        if (eqFilters[i]) { eqFilters[i].gain.value = v; eqPreset = 'custom'; }
        var valEl = this.parentElement.querySelector('.value');
        if (valEl) valEl.textContent = (v > 0 ? '+' : '') + v.toFixed(1) + 'dB';
        var presetEl = document.getElementById('eqPreset');
        if (presetEl) presetEl.value = 'custom';
      });
    });

    // EQ Preset
    var presetEl = document.getElementById('eqPreset');
    if (presetEl) presetEl.addEventListener('change', function () {
      eqPreset = this.value;
      if (EQ_PRESETS[eqPreset]) setEQGains(EQ_PRESETS[eqPreset]);
    });

    // Canvas resize
    window.addEventListener('resize', function () {
      var canvas = document.getElementById('vizCanvas');
      if (canvas) { canvas.width = canvas.parentElement.clientWidth; }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  // Expose
  window.AudioModule.loadFile = loadFile;
  window.AudioModule.playIndex = playIndex;
  window.AudioModule.setEQGains = setEQGains;
  window.AudioModule.getEQGains = getEQGains;
})();
