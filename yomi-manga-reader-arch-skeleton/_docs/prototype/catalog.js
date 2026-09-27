/* ===========================================================================
   Yomi prototype — the catalog
   ---------------------------------------------------------------------------
   The catalog is the one screen outside the reader where an interaction is
   worth building rather than drawing: a search field that must not drop rapid
   typing, a set of filters that compose, a sort, and a result count that is
   announced rather than merely redrawn.

   Three details here are specified rather than incidental:

   - The debounce never drops an input. Every keystroke schedules a new pass,
     and the last one always wins (ACCESSIBILITY.md §5).
   - The result count is a live region, so a screen-reader user hears the
     catalog narrow instead of watching it happen silently.
   - Hiding items uses the `hidden` attribute rather than a class, so they leave
     the accessibility tree as well as the layout. A filtered-out title that
     still reads out is worse than no filter at all.
   =========================================================================== */

(function () {
  'use strict';

  var q = document.getElementById('q');
  if (!q) { return; }

  var statusSel = document.getElementById('f-status');
  var dirSel = document.getElementById('f-dir');
  var sortSel = document.getElementById('f-sort');
  var line = document.getElementById('result-line');
  var chips = Array.prototype.slice.call(
    document.querySelectorAll('[data-genre]'));
  var gridView = document.getElementById('grid-view');
  var listView = document.getElementById('list-view');
  var gridEmpty = document.getElementById('grid-empty');
  var listEmpty = document.getElementById('list-empty');
  var gridBtn = document.getElementById('view-grid');
  var listBtn = document.getElementById('view-list');

  var activeGenres = [];

  function items() {
    return Array.prototype.slice.call(
      document.querySelectorAll('.title-card-item, #title-list > li'));
  }

  function matches(el) {
    var title = (el.getAttribute('data-title') || '').toLowerCase();
    var status = (el.getAttribute('data-status') || '').toLowerCase();
    var genres = (el.getAttribute('data-genres') || '').toLowerCase().split('|');
    var dir = el.getAttribute('data-dir') || '';

    var term = q.value.trim().toLowerCase();
    if (term && title.indexOf(term) === -1) { return false; }

    if (statusSel.value !== 'any' && status !== statusSel.value.toLowerCase()) {
      return false;
    }
    if (dirSel.value !== 'any' && dir !== dirSel.value) { return false; }
    for (var i = 0; i < activeGenres.length; i += 1) {
      if (genres.indexOf(activeGenres[i].toLowerCase()) === -1) { return false; }
    }
    return true;
  }

  function sortValue(el) {
    if (sortSel.value === 'title') {
      return (el.getAttribute('data-title') || '').toLowerCase();
    }
    if (sortSel.value === 'chapters') {
      return -parseInt(el.getAttribute('data-chapters') || '0', 10);
    }
    return -(new Date(el.getAttribute('data-updated') || 0).getTime() / 1000);
  }

  function apply() {
    var all = items();
    var shown = 0;
    var lists = [document.getElementById('cover-grid'),
                 document.getElementById('title-list')];

    for (var i = 0; i < all.length; i += 1) {
      var ok = matches(all[i]);
      all[i].hidden = !ok;
      if (ok) { shown += 1; }
    }

    /* Sort inside each list separately: the two views are different elements
       holding parallel data, and moving a node between them would break the
       correspondence the two views are supposed to share. */
    for (var L = 0; L < lists.length; L += 1) {
      var list = lists[L];
      if (!list) { continue; }
      var kids = Array.prototype.slice.call(list.children);
      kids.sort(function (a, b) {
        var av = sortValue(a), bv = sortValue(b);
        if (av < bv) { return -1; }
        if (av > bv) { return 1; }
        return 0;
      });
      for (var k = 0; k < kids.length; k += 1) { list.appendChild(kids[k]); }
    }

    line.textContent = shown === 1
      ? '1 title'
      : shown + ' of ' + all.length + ' titles';

    gridEmpty.hidden = shown !== 0;
    listEmpty.hidden = shown !== 0;

    var why = [];
    if (q.value.trim()) { why.push('the text "' + q.value.trim() + '"'); }
    if (statusSel.value !== 'any') { why.push('status ' + statusSel.value); }
    if (dirSel.value !== 'any') {
      why.push('direction ' + (dirSel.value === 'rtl' ? 'right to left' : 'left to right'));
    }
    if (activeGenres.length) { why.push('genre ' + activeGenres.join(' or ')); }
    var text = document.getElementById('grid-empty-text');
    if (text) {
      text.textContent = why.length
        ? 'Nothing matches ' + why.join(', ') + '. Loosen a filter and try again.'
        : 'The catalog is empty. Content is added by the curator.';
    }
  }

  /* Debounced, but the last input always wins: a newer keystroke replaces the
     pending pass rather than queueing behind it. */
  var timer = null;
  function schedule() {
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(function () { timer = null; apply(); }, 120);
  }

  q.addEventListener('input', schedule);
  q.addEventListener('search', schedule);
  statusSel.addEventListener('change', apply);
  dirSel.addEventListener('change', apply);
  sortSel.addEventListener('change', apply);

  /* Enter forces an immediate pass, so a keyboard user is never waiting on a
     timer they cannot see. */
  document.getElementById('q').form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (timer) { clearTimeout(timer); timer = null; }
    apply();
  });

  for (var i = 0; i < chips.length; i += 1) {
    chips[i].addEventListener('click', function (ev) {
      var b = ev.currentTarget;
      var g = b.getAttribute('data-genre');
      var at = activeGenres.indexOf(g);
      if (at === -1) { activeGenres.push(g); } else { activeGenres.splice(at, 1); }
      b.setAttribute('aria-pressed', at === -1 ? 'true' : 'false');
      apply();
    });
  }

  function clearFilters() {
    q.value = '';
    statusSel.value = 'any';
    dirSel.value = 'any';
    activeGenres = [];
    for (var i = 0; i < chips.length; i += 1) {
      chips[i].setAttribute('aria-pressed', 'false');
    }
    apply();
    q.focus();
  }

  var c1 = document.getElementById('clear-filters');
  var c2 = document.getElementById('clear-filters-2');
  if (c1) { c1.addEventListener('click', clearFilters); }
  if (c2) { c2.addEventListener('click', clearFilters); }

  function setView(which) {
    var grid = which === 'grid';
    gridView.hidden = !grid;
    listView.hidden = grid;
    gridBtn.setAttribute('aria-pressed', grid ? 'true' : 'false');
    listBtn.setAttribute('aria-pressed', grid ? 'false' : 'true');
  }
  gridBtn.addEventListener('click', function () { setView('grid'); });
  listBtn.addEventListener('click', function () { setView('list'); });

  apply();
})();
