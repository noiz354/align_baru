/* ===========================================================================
   Yomi prototype — shared behaviours
   ---------------------------------------------------------------------------
   Small, dependency-free, and deliberately boring. Three things live here that
   more than one page needs: the theme toggle, the relative-time formatter, and
   the reader-preference store.

   The preference store is here rather than on the settings page because the
   reader reads and writes the same record (reader-behavior.md §16: "changes in
   the reader are persisted (debounced 500 ms) and take effect immediately").
   One store, two callers, no second source of truth.
   =========================================================================== */

(function () {
  'use strict';

  /* --- theme ------------------------------------------------------------
     Three states, not two: system, light, dark. "Follow the system" is a real
     preference, and silently overriding it is the kind of thing a reader has
     to go and find in their operating system to undo. Every colour in
     tokens.css is a light-dark() pair, so this is the only theme code. */

  var THEME_KEY = 'yomi-theme';
  var THEME_ORDER = ['', 'light', 'dark'];
  var THEME_LABEL = {
    '': 'Theme: system',
    'light': 'Theme: light',
    'dark': 'Theme: dark'
  };

  function readTheme() {
    try { return localStorage.getItem(THEME_KEY) || ''; } catch (e) { return ''; }
  }

  function applyTheme(value) {
    var root = document.documentElement;
    if (value) { root.setAttribute('data-theme', value); }
    else { root.removeAttribute('data-theme'); }
    try {
      if (value) { localStorage.setItem(THEME_KEY, value); }
      else { localStorage.removeItem(THEME_KEY); }
    } catch (e) { /* private mode: the toggle still works for this page view */ }
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      b.setAttribute('data-state', value || 'system');
      var label = b.querySelector('.theme-toggle__label');
      if (label) { label.textContent = THEME_LABEL[value || '']; }
      b.setAttribute('aria-label', 'Colour theme: ' +
        (value === 'light' ? 'light' : value === 'dark' ? 'dark' : 'following the system') +
        '. Activate to change.');
    }
  }

  function cycleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || '';
    applyTheme(THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]);
  }

  window.yomiTheme = { apply: applyTheme, cycle: cycleTheme };

  /* --- reader preferences (reader-behavior.md §16) ---------------------- */

  var PREFS_KEY = 'yomi-prefs';

  var DEFAULT_PREFS = {
    defaultMode: 'vertical',        // vertical | single | double
    directionOverride: 'none',      // none | rtl | ltr
    zoomDefault: 100,               // 100..400
    autoNextChapter: true
  };

  function readPrefs() {
    var out = {};
    for (var k in DEFAULT_PREFS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_PREFS, k)) { out[k] = DEFAULT_PREFS[k]; }
    }
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var j in out) {
          if (Object.prototype.hasOwnProperty.call(saved, j) &&
              typeof saved[j] === typeof out[j]) {
            out[j] = saved[j];
          }
        }
      }
    } catch (e) { /* fall back to the defaults */ }
    return out;
  }

  function writePrefs(patch) {
    var next = readPrefs();
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) { next[k] = patch[k]; }
    }
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch (e) {}
    window.dispatchEvent(new CustomEvent('yomi:prefs', { detail: next }));
    return next;
  }

  window.yomiPrefs = { read: readPrefs, write: writePrefs, defaults: DEFAULT_PREFS };

  /* --- relative time ----------------------------------------------------
     A prototype that hard-codes "2 days ago" cannot show a reader what the
     label will actually say. This computes it. */

  function relTime(iso) {
    var then = new Date(iso).getTime();
    var mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) { return 'just now'; }
    if (mins < 60) { return mins + ' min ago'; }
    var hrs = Math.round(mins / 60);
    if (hrs < 24) { return hrs + (hrs === 1 ? ' hour ago' : ' hours ago'); }
    var days = Math.round(hrs / 24);
    if (days < 31) { return days + (days === 1 ? ' day ago' : ' days ago'); }
    var months = Math.round(days / 30);
    if (months < 12) { return months + (months === 1 ? ' month ago' : ' months ago'); }
    var years = Math.round(months / 12);
    return years + (years === 1 ? ' year ago' : ' years ago');
  }

  function paintRelTimes(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-iso]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = relTime(nodes[i].getAttribute('data-iso'));
    }
  }

  window.yomiRelTime = { format: relTime, paint: paintRelTimes };

  /* --- boot -------------------------------------------------------------- */

  function init() {
    var saved = readTheme();
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
    applyTheme(document.documentElement.getAttribute('data-theme') || '');

    var toggles = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', cycleTheme);
    }
    paintRelTimes(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
