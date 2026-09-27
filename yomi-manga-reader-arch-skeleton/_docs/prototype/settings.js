/* ===========================================================================
   Yomi prototype — reader preferences
   ---------------------------------------------------------------------------
   The settings page and the reader share one preference record, so this file
   has exactly one job: keep the form and the record in step, in both
   directions.

   reader-behavior.md §16 sets out the rules this implements:

   - Every input has a visible label, radio groups sit in a fieldset with a
     legend, and errors would be announced rather than coloured in.
   - Changes persist with a 500ms debounce, because a slider dragged across its
     whole range should be one write, not forty.
   - Mode and direction take effect immediately; the defaults take effect the
     next time a chapter opens. The summary line says which is which, so the
     difference is not a surprise.
   - Preferences never leak between users. Here they are device-local and
     namespaced to this browser profile, which is the documented behaviour for
     an anonymous reader.
   =========================================================================== */

(function () {
  'use strict';

  var form = document.getElementById('prefs-form');
  if (!form) { return; }

  var zoom = document.getElementById('zoom');
  var zoomOut = document.getElementById('zoom-out');
  var summary = document.getElementById('prefs-summary');
  var saved = document.getElementById('prefs-saved');
  var reset = document.getElementById('prefs-reset');
  var zoomChips = Array.prototype.slice.call(
    document.querySelectorAll('[data-zoom-set]'));

  var MODE_LABEL = {
    vertical: 'vertical, so pages form one continuous column',
    single: 'single, so one page fills the view',
    double: 'double, so a spread fills the view, and the reader widens the page to 640px'
  };

  var DIR_LABEL = {
    none: 'each title\'s own direction, which is right to left for most of this catalog',
    rtl: 'right to left, whatever the title says',
    ltr: 'left to right, whatever the title says'
  };

  function paintZoomChips(value) {
    for (var i = 0; i < zoomChips.length; i += 1) {
      var on = parseInt(zoomChips[i].getAttribute('data-zoom-set'), 10) === value;
      zoomChips[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function paintSummary() {
    var p = window.yomiPrefs.read();
    summary.textContent =
      'A chapter will open in ' + (MODE_LABEL[p.defaultMode] || p.defaultMode) +
      ', reading ' + (DIR_LABEL[p.directionOverride] || p.directionOverride) +
      ', at ' + p.zoomDefault + '% zoom, with auto-advance ' +
      (p.autoNextChapter ? 'on' : 'off') + '.';
  }

  function load() {
    var p = window.yomiPrefs.read();
    var mode = form.querySelector('input[name="defaultMode"][value="' +
      p.defaultMode + '"]');
    if (mode) { mode.checked = true; }
    var dir = form.querySelector('input[name="directionOverride"][value="' +
      p.directionOverride + '"]');
    if (dir) { dir.checked = true; }
    var auto = form.querySelector('input[name="autoNextChapter"]');
    if (auto) { auto.checked = !!p.autoNextChapter; }
    zoom.value = String(p.zoomDefault);
    zoomOut.textContent = p.zoomDefault + '%';
    paintZoomChips(p.zoomDefault);
    paintSummary();
  }

  function collect() {
    var mode = form.querySelector('input[name="defaultMode"]:checked');
    var dir = form.querySelector('input[name="directionOverride"]:checked');
    var auto = form.querySelector('input[name="autoNextChapter"]');
    return {
      defaultMode: mode ? mode.value : 'vertical',
      directionOverride: dir ? dir.value : 'none',
      zoomDefault: parseInt(zoom.value, 10),
      autoNextChapter: !!(auto && auto.checked)
    };
  }

  var timer = null;
  function commit() {
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(function () {
      timer = null;
      var next = window.yomiPrefs.write(collect());
      paintSummary();
      saved.textContent = 'Saved on this device.';
    }, 500);
  }

  form.addEventListener('change', commit);
  zoom.addEventListener('input', function () {
    zoomOut.textContent = zoom.value + '%';
    paintZoomChips(parseInt(zoom.value, 10));
  });

  for (var i = 0; i < zoomChips.length; i += 1) {
    zoomChips[i].addEventListener('click', function (ev) {
      var v = parseInt(ev.currentTarget.getAttribute('data-zoom-set'), 10);
      zoom.value = String(v);
      zoomOut.textContent = v + '%';
      paintZoomChips(v);
      commit();
    });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
  });

  if (reset) {
    reset.addEventListener('click', function () {
      window.yomiPrefs.write(window.yomiPrefs.defaults);
      load();
      saved.textContent = 'Reset to the product defaults.';
    });
  }

  /* If the reader changes a preference in another tab, or on this device while
     this page is open, the form follows. */
  window.addEventListener('storage', function (ev) {
    if (ev.key === 'yomi-prefs') { load(); }
  });
  window.addEventListener('yomi:prefs', function () { paintSummary(); });

  load();
})();
