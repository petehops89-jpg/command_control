/* Vistamations Media Player — Settings Module */
(function () {
  var settings = {
    volume: 75,
    playbackSpeed: 1.0,
    defaultQuality: 'auto',
    eqPreset: 'flat',
    autoplay: false,
    preloadBuffer: 30,
    themeVariant: 'dark',
    crossfade: 0,
  };

  function load() {
    try {
      var saved = localStorage.getItem('vistamations-media-settings');
      if (saved) Object.assign(settings, JSON.parse(saved));
    } catch (e) {}
  }

  function save() {
    try {
      localStorage.setItem('vistamations-media-settings', JSON.stringify(settings));
    } catch (e) {}
  }

  function applyAll() {
    // Volume
    var audio = window.AudioModule && window.AudioModule.getAudio ? window.AudioModule.getAudio() : null;
    if (audio) audio.volume = settings.volume / 100;
    var volSlider = document.getElementById('volSlider');
    if (volSlider) volSlider.value = settings.volume;

    // Playback speed
    if (audio) audio.playbackRate = settings.playbackSpeed;
    var video = window.VideoModule && window.VideoModule.getVideo ? window.VideoModule.getVideo() : null;
    if (video) video.playbackRate = settings.playbackSpeed;

    // EQ preset
    if (window.AudioModule && window.AudioModule.setEQGains && settings.eqPreset !== 'flat') {
      // EQ presets handled by audio module
    }
  }

  function setSetting(key, val) {
    settings[key] = val;
    save();
    applyAll();
  }

  function bind() {
    // Volume
    var volSlider = document.getElementById('volSlider');
    if (volSlider) volSlider.addEventListener('input', function () {
      setSetting('volume', parseInt(this.value));
      var vEl = document.getElementById('volValue');
      if (vEl) vEl.textContent = this.value + '%';
    });

    // Playback speed
    var speedSelect = document.getElementById('speedSelect');
    if (speedSelect) speedSelect.addEventListener('change', function () {
      setSetting('playbackSpeed', parseFloat(this.value));
    });

    // Autoplay
    var autoplayCb = document.getElementById('autoplayCb');
    if (autoplayCb) autoplayCb.addEventListener('change', function () {
      setSetting('autoplay', this.checked);
    });

    // Preload buffer
    var bufferSlider = document.getElementById('bufferSlider');
    if (bufferSlider) bufferSlider.addEventListener('input', function () {
      setSetting('preloadBuffer', parseInt(this.value));
      var bEl = document.getElementById('bufferValue');
      if (bEl) bEl.textContent = this.value + 's';
    });

    // Crossfade
    var crossfadeSlider = document.getElementById('crossfadeSlider');
    if (crossfadeSlider) crossfadeSlider.addEventListener('input', function () {
      setSetting('crossfade', parseInt(this.value));
      var cEl = document.getElementById('crossfadeValue');
      if (cEl) cEl.textContent = this.value + 's';
    });

    // Reset settings
    var resetBtn = document.getElementById('resetSettingsBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      settings = {
        volume: 75, playbackSpeed: 1.0, defaultQuality: 'auto',
        eqPreset: 'flat', autoplay: false, preloadBuffer: 30,
        themeVariant: 'dark', crossfade: 0,
      };
      save();
      applyAll();
      refreshUI();
      MP.toast('Settings reset to defaults');
    });
  }

  function refreshUI() {
    var volSlider = document.getElementById('volSlider');
    if (volSlider) volSlider.value = settings.volume;
    var vEl = document.getElementById('volValue');
    if (vEl) vEl.textContent = settings.volume + '%';

    var speedSelect = document.getElementById('speedSelect');
    if (speedSelect) speedSelect.value = settings.playbackSpeed;

    var autoplayCb = document.getElementById('autoplayCb');
    if (autoplayCb) autoplayCb.checked = settings.autoplay;

    var bufferSlider = document.getElementById('bufferSlider');
    if (bufferSlider) bufferSlider.value = settings.preloadBuffer;
    var bEl = document.getElementById('bufferValue');
    if (bEl) bEl.textContent = settings.preloadBuffer + 's';

    var crossfadeSlider = document.getElementById('crossfadeSlider');
    if (crossfadeSlider) crossfadeSlider.value = settings.crossfade;
    var cEl = document.getElementById('crossfadeValue');
    if (cEl) cEl.textContent = settings.crossfade + 's';
  }

  load();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { bind(); refreshUI(); applyAll(); });
  else { bind(); refreshUI(); applyAll(); }

  window.SettingsModule = {
    get: function (key) { return settings[key]; },
    set: setSetting,
  };
})();
