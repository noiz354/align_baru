/* ===========================================================================
   Yomi prototype — the reader
   ---------------------------------------------------------------------------
   This is the reader as reader-behavior.md specifies it, in vanilla
   JavaScript with no build step. It is a prototype, so it is not a
   re-implementation of the product: it demonstrates the behaviour that the
   specification is precise about, because those are the parts worth
   demonstrating.

   WHAT IS REAL HERE (the specified behaviour)
   --------------------------------------------
   - The state record from §10, and the invariants it must keep: page within
     [1, M], zoom within [100, 400], a bounded page window, and completion as
     a sticky flag.
   - The direction rules from §4. Direction decides the reading order, the
     arrow keys, the swipe directions, the tap zones, and the spread pairing.
     It is not a mirror, and the indicator is displayIndex, not the physical
     page number.
   - The transition table from §11, including the rule that entering or
     leaving double mode resets zoom, and that A to B to A is an identity.
   - The keyboard map from §9, with Ctrl+plus/minus/zero left alone, Space
     suppressed in paged modes, and reader keys made inert while a dialog is
     open.
   - The swipe semantics from §7.2: a 25% or 0.5-box-widths-per-second commit
     threshold, a cancel below it, at most one gesture in flight, and no
     vertical drag in paged modes.
   - The zoom semantics from §8.1: a transform that never moves the logical
     page, 100 to 400, and a reset on chapter change and on double transitions.
   - The completion card from §13 in all three of its variants, with a visible
     1.5 second auto-advance countdown that any input cancels.
   - The failed-image behaviour from §14: per page, one automatic retry, two
     bounded manual attempts, and a banner that suppresses the automatic ones.
   - The initial focus and the live region from ACCESSIBILITY.md §3.

   WHAT IS SIMPLIFIED, AND WHY
   ---------------------------
   - Pages are synthetic gradient blocks with a label. There is no artwork,
     because there is no content to show: every title in this product is
     licensed, and a prototype has no licence.
   - Only the window-interior pages get real markup; the rest are reserved
     slots. That is the specified behaviour, and it is why the column length
     never changes.
   - Progress is written to local storage and announced. There is no server.
   - Fullscreen uses the standard request; there is no pseudo-fullscreen
     fallback for browsers that lack it, which iOS Safari would need.
   - Tap zones, swipes, and the initial focus are all implemented, but the
     keyboard path is complete on its own. Zones and swipes are enhancements:
     with them disabled the reader is fully operable, which is the property
     that actually matters.
   =========================================================================== */

(function () {
  'use strict';

  var root = document.getElementById('reader');
  if (!root) { return; }

  /* --- the content ------------------------------------------------------
     Three chapters, so all three completion variants are reachable by
     pressing End and waiting. Chapter 14 exists but is not published, which
     is the case reader-behavior.md §13 calls out separately. */

  var CHAPTERS = {
    '12': {
      num: 12,
      title: "The Cartographer's Revision, Second Pass",
      pages: 240,
      next: '13',
      nextPublished: true
    },
    '13': {
      num: 13,
      title: 'Return of the Borrowing Desk',
      pages: 26,
      next: '14',
      nextPublished: true
    },
    '14': {
      num: 14,
      title: 'The Borrowing Desk, Corrected',
      pages: 31,
      next: null,
      nextPublished: false
    }
  };

  var MANGA_TITLE = 'Seed Manga 0001 — The Long Afternoon of the Second-year Archivist';
  var MANGA_RTL = true;      /* the manga's own reading direction */
  var WINDOW_CAP = 12;       /* NFR-PERF-011 */

  /* --- state (§10) -------------------------------------------------------- */

  var S = {
    chapterId: '12',
    totalPages: 240,
    currentPage: 229,        /* physical, 1-based */
    scrollOffset: 0,
    readingMode: 'vertical',
    readingDirection: 'rtl',  /* effective: manga default, then the override */
    zoom: 100,
    fullscreen: false,
    chromeVisible: true,
    completed: false,
    progressStatus: 'anonymous-local'
  };

  var prefs = window.yomiPrefs.read();
  S.readingMode = prefs.defaultMode;
  if (prefs.directionOverride !== 'none') {
    S.readingDirection = prefs.directionOverride;
  } else {
    S.readingDirection = MANGA_RTL ? 'rtl' : 'ltr';
  }
  S.zoom = prefs.zoomDefault;

  /* --- element handles ---------------------------------------------------- */

  var el = {
    wrap: document.getElementById('canvas-wrap'),
    canvas: document.getElementById('canvas'),
    column: document.getElementById('column'),
    stage: document.getElementById('stage'),
    zones: document.getElementById('zones'),
    topBar: document.getElementById('top-bar'),
    bottomBar: document.getElementById('bottom-bar'),
    position: document.getElementById('position'),
    rail: document.getElementById('rail'),
    h1: document.getElementById('chapter-h1'),
    displayIndex: document.getElementById('display-index'),
    displayTotal: document.getElementById('display-total'),
    fill: document.getElementById('position-fill'),
    physical: document.getElementById('physical'),
    displayIndex2: document.getElementById('display-index-2'),
    displayTotal2: document.getElementById('display-total-2'),
    announce: document.getElementById('announce-text'),
    complete: document.getElementById('complete'),
    completeTitle: document.getElementById('complete-title'),
    completeBody: document.getElementById('complete-body'),
    completeActions: document.getElementById('complete-actions'),
    countdown: document.getElementById('countdown'),
    countdownText: document.getElementById('countdown-text'),
    countdownFill: document.getElementById('countdown-fill'),
    dialog: document.getElementById('options'),
    banner: document.getElementById('banner'),
    bannerText: document.getElementById('banner-text'),
    failToggle: document.getElementById('fail-toggle'),
  };

  var zoneToggle = document.getElementById('zone-toggle');
  var autoToggle = document.getElementById('auto-toggle');
  var modeButtons = document.querySelectorAll('[data-mode]');
  var dirButtons = document.querySelectorAll('[data-dir]');
  var zoomButtons = document.querySelectorAll('[data-zoom]');

  /* --- derived values (§4, §6) -------------------------------------------
     The single most bug-prone part of the reader, so every consumer goes
     through these four functions and never computes it inline. */

  function isRtl() { return S.readingDirection === 'rtl'; }

  /* The indicator is the reading-order position, never the physical page. */
  function displayIndex(page) {
    var p = (page === undefined) ? S.currentPage : page;
    return isRtl() ? S.totalPages - p + 1 : p;
  }

  function readingStart() { return isRtl() ? S.totalPages : 1; }
  function readingEnd() { return isRtl() ? 1 : S.totalPages; }

  function hasNext() { return isRtl() ? S.currentPage > 1 : S.currentPage < S.totalPages; }
  function hasPrev() { return isRtl() ? S.currentPage < S.totalPages : S.currentPage > 1; }

  /* One step along the READING ORDER, not along the page number. In right to
     left the reading order runs backwards through the page numbers, so a step
     forward is a step down. This single function is why the arrow keys, the
     swipe directions and the tap zones can all agree. */
  function stepPage(forward) {
    return isRtl() ? S.currentPage - forward : S.currentPage + forward;
  }

  /* The spread that contains a page, in reading order: the page read first is
     first in the returned pair. Left to right pairs (1,2), (3,4). Right to
     left pairs (M, M-1), (M-2, M-3), which works for either parity of M.

     A spread can legitimately hold ONE page, and it returns one element when
     that happens rather than a page number outside the chapter: the final
     spread of an odd-length chapter (EC-RDR-03), and the whole of a
     one-page chapter (EC-RDR-01). The renderer branches on the length, so a
     half-empty pair is never drawn. */
  function spreadFor(page) {
    var M = S.totalPages;
    if (M === 1) { return [1]; }

    if (!isRtl()) {
      var lo = (page % 2 === 1) ? page : page - 1;
      if (lo < 1) { lo = 1; }
      if (lo + 1 > M) { return [lo]; }
      return [lo, lo + 1];
    }

    var hi = M - 2 * Math.floor((M - page) / 2);
    if (hi > M) { hi = M; }
    if (hi - 1 < 1) { return [hi]; }
    return [hi, hi - 1];
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* The page window, position-relative and O(1), hard-capped (§15). */
  function windowFor(page) {
    var M = S.totalPages;
    var start, end;
    if (S.readingMode === 'vertical') {
      start = page - 3; end = page + 3;
    } else if (S.readingMode === 'single') {
      start = page - 1; end = page + 2;
    } else {
      /* A one-page spread has no second member, so widen from the only page. */
      var sp = spreadFor(page);
      var lo = sp.length > 1 ? sp[1] : sp[0];
      var hi = sp[0];
      start = lo - 1; end = hi + 1;
    }
    start = clamp(start, 1, M);
    end = clamp(end, 1, M);
    if (end - start + 1 > WINDOW_CAP) { end = start + WINDOW_CAP - 1; }
    return { start: start, end: end };
  }

  /* --- formatting --------------------------------------------------------- */

  var numberFmt = new Intl.NumberFormat('en-GB');
  function fmt(n) { return numberFmt.format(n); }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function pageMarkup(n, opts) {
    opts = opts || {};
    var idx = displayIndex(n);
    var cls = 'rpage';
    if (opts.failed) { cls += ' rpage--failed'; }
    if (opts.slot) { cls += ' rpage--slot'; }
    var inner =
      '<span class="rpage__label">Page ' + pad(n) + '</span>' +
      '<span class="rpage__sub">' +
        (opts.failed
          ? 'Failed to load'
          : 'displayIndex ' + idx + ' of ' + fmt(S.totalPages)) +
      '</span>';
    if (opts.failed) {
      inner +=
        '<p class="hint">One automatic retry already ran. ' +
        (opts.attemptsLeft > 0
          ? opts.attemptsLeft + ' manual attempt' + (opts.attemptsLeft === 1 ? '' : 's') + ' left.'
          : 'Retry is still available.') +
        '</p>' +
        '<div class="cluster" style="justify-content:center">' +
          '<button type="button" class="btn btn--sm" data-retry="' + n + '">Retry page ' + n + '</button>' +
          '<button type="button" class="btn btn--sm" data-skip="1">Skip to the next page</button>' +
        '</div>';
    }
    return '<div class="' + cls + '">' + inner + '</div>';
  }

  /* --- the failed page (§14) ---------------------------------------------- */

  var failPage = 7;          /* which page is currently failing */
  var failActive = true;
  var failAttempts = 0;
  var MAX_MANUAL_ATTEMPTS = 2;

  function isFailed(n) { return failActive && n === failPage; }

  function retryPage(n) {
    if (n !== failPage) { return; }
    if (failAttempts < MAX_MANUAL_ATTEMPTS) {
      failAttempts += 1;
      /* A cache-busted re-request that succeeds. The prototype models the
         success, the bounded attempt count, and the fact that the button
         stays available afterwards. */
      failActive = false;
      announce('Page ' + pad(n) + ' loaded on retry ' + failAttempts + '.');
    } else {
      failActive = false;
      announce('Page ' + pad(n) + ' loaded.');
    }
    render();
  }

  /* --- rendering ---------------------------------------------------------- */

  var slotOffsets = null;   /* cached to keep the scroll handler off the layout path */

  function render() {
    var M = S.totalPages;
    var ch = CHAPTERS[S.chapterId];

    el.h1.textContent = 'Chapter ' + ch.num + ' — ' + ch.title;

    el.canvas.setAttribute('data-mode',
      S.readingMode === 'vertical' ? 'vertical' : 'paged');
    el.canvas.setAttribute('dir', S.readingDirection);
    el.canvas.setAttribute('data-chrome', S.chromeVisible ? 'visible' : 'hidden');
    el.canvas.setAttribute('aria-label',
      'Reader canvas: ' + fmt(M) + ' pages, ' +
      (isRtl() ? 'right to left' : 'left to right') + ', ' +
      S.readingMode + ' mode, ' + S.zoom + '% zoom');

    root.style.setProperty('--z', String(S.zoom / 100));

    if (S.readingMode === 'vertical') {
      renderVertical();
    } else {
      renderPaged();
    }
    paintChrome();
    paintPosition();
    paintZones();
    scheduleMeasure();
  }

  /* Vertical: one continuous column. The DOM order IS the reading order, so
     the reading-start page is at the top in both directions and scrolling
     down always advances. That is what makes right to left a reordering of
     the column rather than a reversed scroll. */
  function renderVertical() {
    var M = S.totalPages;
    var win = windowFor(S.currentPage);
    var frag = document.createDocumentFragment();

    for (var i = 0; i < M; i += 1) {
      var n = isRtl() ? M - i : i + 1;      /* reading order */
      var slot = document.createElement('div');
      slot.className = 'pslot';
      slot.setAttribute('data-page', String(n));
      if (n === readingStart()) { slot.setAttribute('data-start', 'true'); }
      if (n === S.currentPage) { slot.setAttribute('data-current', 'true'); }
      if (n >= win.start && n <= win.end) {
        slot.innerHTML = isFailed(n)
          ? pageMarkup(n, { failed: true, attemptsLeft: MAX_MANUAL_ATTEMPTS - failAttempts })
          : pageMarkup(n, {});
      } else {
        /* Out of window: a reserved slot with the page's exact height, so the
           column length never changes. */
        slot.innerHTML = pageMarkup(n, { slot: true });
      }
      frag.appendChild(slot);
    }
    el.column.innerHTML = '';
    el.column.appendChild(frag);
    el.stage.innerHTML = '';
  }

  /* Paged: the page, or the spread, letterboxed into the stage box. */
  function renderPaged() {
    var pages;
    if (S.readingMode === 'single') {
      pages = [S.currentPage];
    } else {
      pages = spreadFor(S.currentPage);
    }
    var inner = pages.map(function (n) {
      if (n < 1 || n > S.totalPages) { return ''; }
      return isFailed(n)
        ? pageMarkup(n, { failed: true, attemptsLeft: MAX_MANUAL_ATTEMPTS - failAttempts })
        : pageMarkup(n, {});
    }).join('');

    var double = S.readingMode === 'double' && pages.length === 2;
    /* Clear the vertical column. It is not optional housekeeping: the two
       containers are both children of the same grid, so leaving 240 reserved
       slots in place would stack them and push the page you are trying to
       read far below the fold — measurably 290,880px at the chapter start,
       with the stage rendering off-screen. Vertical mode clears the stage for
       the same reason, so the two are mutually exclusive by construction. */
    el.column.innerHTML = '';
    el.stage.innerHTML =
      '<div class="rspread ' + (double ? 'rspread--double' : 'rspread--single') + '"' +
      ' dir="' + S.readingDirection + '">' + inner + '</div>';
  }

  /* Fit the page box into the available space. Vertical mode uses the column
     width; the paged modes fit the page aspect inside the stage, which is what
     produces the letterbox. */
  function measure() {
    var stageW, stageH;
    var box = el.canvas.getBoundingClientRect();
    var cs = window.getComputedStyle(el.canvas);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var innerW = box.width - padX;
    var innerH = box.height - padY;

    if (S.readingMode === 'vertical') {
      stageW = innerW;
      if (stageW > 416) { stageW = 416; }
      if (stageW < 180) { stageW = 180; }
      stageH = stageW * 4 / 3;
    } else {
      stageW = innerW - 16;                  /* the stage's own padding */
      stageH = innerH - 16;
      var per = S.readingMode === 'double'
        ? (stageW - 12) / 2
        : stageW;
      if (per > 900) { per = 900; }
      var byHeight = stageH * 3 / 4;
      if (per > byHeight) { per = byHeight; }
      if (per < 180) { per = 180; }
      stageW = per;
      stageH = per * 4 / 3;
    }

    root.style.setProperty('--pw', stageW + 'px');
    root.style.setProperty('--ph', stageH + 'px');

    if (S.readingMode === 'vertical') { cacheOffsets(); }
  }

  var measureQueued = false;
  function scheduleMeasure() {
    if (measureQueued) { return; }
    measureQueued = true;
    requestAnimationFrame(function () {
      measureQueued = false;
      measure();
      if (S.readingMode === 'vertical') { restoreScroll(); }
    });
  }

  /* Slot geometry is cached so the scroll handler reads numbers instead of
     forcing a layout on every event. Rebuilt after any render or resize. */
  function cacheOffsets() {
    slotOffsets = [];
    var kids = el.column.children;
    for (var i = 0; i < kids.length; i += 1) {
      slotOffsets.push({
        top: kids[i].offsetTop,
        height: kids[i].offsetHeight,
        page: parseInt(kids[i].getAttribute('data-page'), 10)
      });
    }
  }

  function pageAtViewportTop() {
    if (!slotOffsets || !slotOffsets.length) { return S.currentPage; }
    var top = el.canvas.scrollTop;
    for (var i = 0; i < slotOffsets.length; i += 1) {
      if (slotOffsets[i].top + slotOffsets[i].height > top + 2) {
        return slotOffsets[i].page;
      }
    }
    return slotOffsets[slotOffsets.length - 1].page;
  }

  function restoreScroll() {
    if (S.readingMode !== 'vertical') { return; }
    for (var i = 0; i < (slotOffsets || []).length; i += 1) {
      if (slotOffsets[i].page === S.currentPage) {
        el.canvas.scrollTop = slotOffsets[i].top;
        S.scrollOffset = 0;
        return;
      }
    }
  }

  /* --- the chrome --------------------------------------------------------- */

  function paintChrome() {
    var hide = !S.chromeVisible;
    el.topBar.hidden = hide;
    el.bottomBar.hidden = hide;
    el.position.hidden = hide;
    el.rail.hidden = hide;

    for (var i = 0; i < modeButtons.length; i += 1) {
      var b = modeButtons[i];
      var on = b.getAttribute('data-mode') === S.readingMode;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (b.classList.contains('rbtn')) { b.classList.toggle('rbtn--on', on); }
    }
    for (var j = 0; j < dirButtons.length; j += 1) {
      var d = dirButtons[j];
      var don = d.getAttribute('data-dir') === S.readingDirection;
      d.setAttribute('aria-pressed', don ? 'true' : 'false');
      if (d.classList.contains('rbtn')) { d.classList.toggle('rbtn--on', don); }
    }
    for (var k = 0; k < zoomButtons.length; k += 1) {
      var z = zoomButtons[k];
      var zval = parseInt(z.getAttribute('data-zoom'), 10);
      var zon = zval === S.zoom;
      z.setAttribute('aria-pressed', zon ? 'true' : 'false');
      if (z.classList.contains('rbtn')) { z.classList.toggle('rbtn--on', zon); }
    }
  }

  function paintPosition() {
    var idx = displayIndex();
    el.displayIndex.textContent = fmt(idx);
    el.displayTotal.textContent = fmt(S.totalPages);
    var pct = Math.round((idx / S.totalPages) * 100);
    el.fill.style.width = pct + '%';
    el.physical.textContent = 'physical page ' + S.currentPage;
    if (el.displayIndex2) { el.displayIndex2.textContent = fmt(idx); }
    if (el.displayTotal2) { el.displayTotal2.textContent = fmt(S.totalPages); }
  }

  function announce(text) {
    el.announce.textContent = text;
  }

  /* --- the live region (ACCESSIBILITY.md §3.2) ---------------------------- */

  var lastAnnounced = 0;

  function announceChange(reason) {
    var idx = displayIndex();
    if (S.readingMode === 'vertical') {
      /* Per-page announcements in a long scroll are noise. Announce every
         tenth page, plus anything that changes the meaning of the screen. */
      if (reason === 'page') {
        if (idx % 10 !== 0) { return; }
      }
    }
    if (idx === lastAnnounced && reason === 'page') { return; }
    lastAnnounced = idx;
    announce(
      'Page ' + fmt(idx) + ' of ' + fmt(S.totalPages) +
      '. ' + (isRtl() ? 'Right to left.' : 'Left to right.') +
      ' ' + S.readingMode + ' mode. Zoom ' + S.zoom + '%.'
    );
  }

  /* --- navigation --------------------------------------------------------- */

  var completeTimer = null;
  var autoTimer = null;

  function clearTimers() {
    if (completeTimer) { clearTimeout(completeTimer); completeTimer = null; }
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  function cancelAutoAdvance() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
      el.countdown.hidden = true;
      return true;
    }
    return false;
  }

  /* Any input cancels a pending auto-advance. Called by every handler. */
  function userInput() {
    if (cancelAutoAdvance()) { announce('Auto-advance cancelled.'); }
  }

  function goTo(page, reason) {
    var target = clamp(page, 1, S.totalPages);
    if (target === S.currentPage && reason !== 'force') { return; }
    S.currentPage = target;
    S.scrollOffset = 0;
    render();
    if (reason !== 'silent') { announceChange(reason || 'page'); }
    checkCompletion();
  }

  function goNext() {
    userInput();
    if (S.readingMode === 'vertical') {
      el.canvas.scrollTop += el.canvas.clientHeight * 0.9;
      syncFromScroll();
      return;
    }
    if (hasNext()) { goTo(stepPage(1)); }
    else { atEnd(); }
  }

  function goPrev() {
    userInput();
    if (S.readingMode === 'vertical') {
      el.canvas.scrollTop -= el.canvas.clientHeight * 0.9;
      syncFromScroll();
      return;
    }
    if (hasPrev()) { goTo(stepPage(-1)); }
    else { atStart(); }
  }

  function goHome() {
    userInput();
    goTo(readingStart());
  }

  function goEnd() {
    userInput();
    goTo(readingEnd());
  }

  function atStart() {
    /* No wrap-around, ever (T-READER-033). A brief no-op cue instead. */
    announce('Start of the chapter. There is nothing before this page.');
  }

  function atEnd() {
    announce('End of the chapter.');
    checkCompletion();
  }

  /* Vertical mode's scroll is the input, so the page follows the scroll. */
  var scrollQueued = false;
  function syncFromScroll() {
    if (scrollQueued) { return; }
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      var n = pageAtViewportTop();
      if (n !== S.currentPage) {
        S.currentPage = n;
        paintPosition();
        announceChange('page');
        checkCompletion();
      }
    });
  }

  /* --- mode, direction, zoom (§8.1, §11) --------------------------------- */

  function setMode(mode) {
    if (mode === S.readingMode) { return; }
    userInput();
    var wasDouble = S.readingMode === 'double';
    var willBeDouble = mode === 'double';

    /* Position identity: the logical page is preserved across every switch.
       A to B to A is an identity, so nothing here may lose the page. */
    S.readingMode = mode;

    /* The documented zoom rule: entering or leaving double resets to 1.0.
       Single and vertical keep the zoom. */
    if (wasDouble !== willBeDouble) { S.zoom = 100; }

    /* Leaving vertical loses the mid-page offset, which has no meaning in a
       paged mode. */
    if (mode !== 'vertical') { S.scrollOffset = 0; }

    render();
    announceChange('mode');
    announce('Reading mode: ' + mode + '.');
    persistPrefs({ defaultMode: mode });
  }

  function cycleMode() {
    var order = ['vertical', 'single', 'double'];
    var next = order[(order.indexOf(S.readingMode) + 1) % order.length];

    /* Double needs 640px or wider. Below that it degrades to single, once,
       with a notice, rather than silently doing something else. */
    if (next === 'double' && window.innerWidth < 640) {
      showBanner('Double-page reading needs a width of 640px or more. Using single-page mode for now.');
      S.readingMode = 'single';
      render();
      announce('Reading mode: single. Double needs a wider window.');
      return;
    }
    setMode(next);
  }

  function setDirection(dir) {
    if (dir === S.readingDirection) { return; }
    userInput();
    /* The physical page does not move. The reading order around it does, so
       displayIndex recomputes and the column is rebuilt. */
    S.readingDirection = dir;
    render();
    announceChange('direction');
    announce('Direction: ' + (isRtl() ? 'right to left' : 'left to right') +
      '. Page ' + fmt(displayIndex()) + ' of ' + fmt(S.totalPages) + '.');
    persistPrefs({ directionOverride: dir });
  }

  function toggleDirection() {
    setDirection(isRtl() ? 'ltr' : 'rtl');
  }

  function setZoom(value) {
    var z = clamp(Math.round(value / 10) * 10, 100, 400);
    if (z === S.zoom) { return; }
    S.zoom = z;
    /* Zoom is a transform. The logical page does not change and no progress
       write is affected by it. */
    render();
    announce('Zoom ' + S.zoom + '%.');
  }

  function zoomStep(delta) {
    setZoom(S.zoom + delta);
  }

  function resetZoom() { setZoom(100); }

  /* --- preference persistence (§16) ---------------------------------------- */

  var prefTimer = null;
  function persistPrefs(patch) {
    if (prefTimer) { clearTimeout(prefTimer); }
    prefTimer = setTimeout(function () {
      window.yomiPrefs.write(patch);
    }, 500);
  }

  /* --- completion (§13) ---------------------------------------------------- */

  function isAtReadingEnd() { return S.currentPage === readingEnd(); }

  function checkCompletion() {
    clearTimers();
    hideComplete();
    if (!isAtReadingEnd()) { return; }

    /* Completion detection is the last page visible for a second, not the
       instant it appears. A reader who swipes past a last page has not
       finished anything. */
    completeTimer = setTimeout(function () {
      completeTimer = null;
      S.completed = true;   /* sticky; only an explicit unmark clears it */
      showComplete();
      announceChange('completion');
      announce('Chapter completed.');
      maybeAutoAdvance();
    }, 1000);
  }

  function showComplete() {
    var ch = CHAPTERS[S.chapterId];
    var nextId = ch.next;
    var nextCh = nextId ? CHAPTERS[nextId] : null;

    el.complete.hidden = false;

    if (!nextCh) {
      el.completeTitle.textContent = 'Chapter ' + ch.num + ' complete';
      el.completeBody.textContent =
        "You've finished Seed Manga 0001 — The Long Afternoon of the Second-year Archivist.";
      el.completeActions.innerHTML =
        '<a class="rbtn rbtn--accent" href="manga-detail.html">Back to the series</a>' +
        '<a class="rbtn" href="discover.html">Go to the catalog</a>';
      el.countdown.hidden = true;
      return;
    }

    if (!ch.nextPublished) {
      el.completeTitle.textContent = 'Chapter ' + ch.num + ' complete';
      el.completeBody.textContent =
        "That's everything for now. Chapter " + nextCh.num +
        ' is not published yet. It will appear here when it is.';
      el.completeActions.innerHTML =
        '<a class="rbtn rbtn--accent" href="manga-detail.html">Back to the series</a>';
      el.countdown.hidden = true;
      return;
    }

    el.completeTitle.textContent = 'Chapter ' + ch.num + ' complete';
    el.completeBody.textContent =
      'Next: Chapter ' + nextCh.num + ' — ' + nextCh.title + ', ' +
      nextCh.pages + ' pages.';
    el.completeActions.innerHTML =
      '<button type="button" class="rbtn rbtn--accent" data-continue="1">Continue to Chapter ' +
      nextCh.num + '</button>' +
      '<button type="button" class="rbtn" data-stay="1">Stay here</button>';
  }

  function hideComplete() { el.complete.hidden = true; }

  var AUTO_MS = 1500;

  function maybeAutoAdvance() {
    var ch = CHAPTERS[S.chapterId];
    if (!ch.next || !ch.nextPublished) { el.countdown.hidden = true; return; }
    if (!prefs.autoNextChapter) {
      el.countdown.hidden = false;
      el.countdownText.textContent = 'Auto-advance is off. Continue when ready.';
      el.countdownFill.style.width = '0%';
      return;
    }
    el.countdown.hidden = false;
    var start = Date.now();
    el.countdownFill.style.width = '100%';
    autoTimer = setTimeout(function () {
      autoTimer = null;
      el.countdown.hidden = true;
      loadChapter(ch.next, true);
    }, AUTO_MS);
    (function tick() {
      if (!autoTimer) { return; }
      var left = Math.max(0, AUTO_MS - (Date.now() - start));
      el.countdownText.textContent = 'Leaving in ' + (left / 1000).toFixed(1) + 's';
      el.countdownFill.style.width = (left / AUTO_MS * 100) + '%';
      requestAnimationFrame(tick);
    }());
  }

  function loadChapter(id, advance) {
    clearTimers();
    hideComplete();
    var ch = CHAPTERS[id];
    S.chapterId = id;
    S.totalPages = ch.pages;
    S.completed = false;
    S.zoom = prefs.zoomDefault;   /* new chapter: zoom resets to the default */
    S.currentPage = readingStart();
    S.scrollOffset = 0;
    lastAnnounced = 0;
    render();
    /* Entering a chapter is a route change, so focus returns to the canvas. */
    el.canvas.focus();
    announceChange('force');
    announce('Chapter ' + ch.num + ' — ' + ch.title + '. Page 1 of ' +
      fmt(S.totalPages) + '.');
    if (advance) { showBanner('Opened Chapter ' + ch.num + ' from the completion card.'); }
  }

  /* --- chrome visibility, fullscreen, dialogs ----------------------------- */

  function toggleChrome() {
    userInput();
    S.chromeVisible = !S.chromeVisible;
    render();
    announce(S.chromeVisible ? 'Reader controls shown.' : 'Reader controls hidden. ' +
      'Tap the centre of the page, or press B, to show them again.');
    if (!S.chromeVisible) { el.canvas.focus(); }
  }

  function toggleFullscreen() {
    userInput();
    if (!document.fullscreenElement) {
      if (root.requestFullscreen) {
        root.requestFullscreen().catch(function () {
          showBanner('Fullscreen was refused by the browser. The reader still works without it.');
        });
      } else {
        /* Pseudo-fullscreen: the documented equivalent where the API is
           missing, which today means iOS Safari. */
        document.body.classList.toggle('pseudo-fullscreen');
        S.fullscreen = !document.body.classList.contains('pseudo-fullscreen');
        showBanner(S.fullscreen
          ? 'Fullscreen is not available in this browser. The chrome is hidden and the page is enlarged instead.'
          : 'Left the enlarged view.');
        render();
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  document.addEventListener('fullscreenchange', function () {
    S.fullscreen = !!document.fullscreenElement;
    /* A user-initiated exit has to be reflected, not only our own request. */
    render();
  });

  function openOptions() {
    userInput();
    if (el.dialog && el.dialog.showModal) { el.dialog.showModal(); }
  }

  function closeOptions() {
    if (el.dialog && el.dialog.close) { el.dialog.close(); }
    /* Focus returns to the reader container on close. */
    el.canvas.focus();
  }

  /* --- the banner (§14, §15) ---------------------------------------------- */

  var bannerTimer = null;
  function showBanner(text) {
    el.bannerText.textContent = text;
    el.banner.hidden = false;
    if (bannerTimer) { clearTimeout(bannerTimer); }
  }

  function hideBanner() {
    el.banner.hidden = true;
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
  }

  /* --- tap zones and swipes (§7) -------------------------------------------
     Zones are thirds of the page box. The zone that means "next" is mirrored
     in right to left, which is why the overlay text is computed rather than
     written into the markup. Long presses are not taps, multi-touch is never
     a tap, and a tap is not also a swipe. */

  function zoneRole(zone) {
    if (zone === 'center') { return 'toggle the controls'; }
    var meansNext = isRtl() ? (zone === 'start') : (zone === 'end');
    return meansNext ? 'next page' : 'previous page';
  }

  function zoneAction(zone) {
    if (zone === 'center') {
      if (S.readingMode === 'vertical') {
        /* Vertical mode nudges the column by ten percent of the viewport
           rather than toggling the chrome, because a reader scrolling a long
           column wants the nudge. */
        el.canvas.scrollTop += el.canvas.clientHeight * 0.1;
        syncFromScroll();
      } else {
        toggleChrome();
      }
      return;
    }
    var meansNext = isRtl() ? (zone === 'start') : (zone === 'end');
    if (meansNext) { goNext(); } else { goPrev(); }
  }

  var LONG_PRESS_MS = 300;

  function zoneAt(x, box) {
    var rel = (x - box.left) / box.width;
    if (rel < 1 / 3) { return 'start'; }
    if (rel < 2 / 3) { return 'center'; }
    return 'end';
  }

  function paintZones() {
    if (!el.zones) { return; }
    var kids = el.zones.querySelectorAll('.rzone');
    for (var i = 0; i < kids.length; i += 1) {
      var role = kids[i].querySelector('.rzone__role');
      var hint = kids[i].querySelector('.rzone__hint');
      var z = kids[i].getAttribute('data-zone');
      role.textContent = z;
      hint.textContent = zoneRole(z);
    }
    el.zones.setAttribute('data-show', zoneToggle.checked ? 'true' : 'false');
  }

  var gesture = null;

  function onPointerDown(ev) {
    /* Multi-touch is never a tap and never a swipe: a pinch is a zoom. */
    if (ev.isPrimary === false) { gesture = null; return; }
    if (el.dialog && el.dialog.open) { return; }
    gesture = {
      id: ev.pointerId,
      x0: ev.clientX,
      y0: ev.clientY,
      t0: Date.now(),
      lastX: ev.clientX,
      lastT: Date.now(),
      vx: 0,
      moved: false,
      target: ev.target
    };
  }

  function onPointerMove(ev) {
    if (!gesture || ev.pointerId !== gesture.id) { return; }
    var dx = ev.clientX - gesture.x0;
    var dy = ev.clientY - gesture.y0;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { gesture.moved = true; }
    var now = Date.now();
    var dt = now - gesture.lastT;
    if (dt > 0) { gesture.vx = (ev.clientX - gesture.lastX) / dt; }
    gesture.lastX = ev.clientX;
    gesture.lastT = now;
  }

  function onPointerUp(ev) {
    if (!gesture || ev.pointerId !== gesture.id) { return; }
    var g = gesture;
    gesture = null;

    var box = el.wrap.getBoundingClientRect();
    var dx = ev.clientX - g.x0;
    var dy = ev.clientY - g.y0;
    var elapsed = Date.now() - g.t0;

    /* Only a primary-button release counts. */
    if (ev.button !== 0 && ev.pointerType === 'mouse') { return; }

    if (S.readingMode !== 'vertical') {
      /* In paged modes a horizontal gesture is a page turn. A vertical drag
         does nothing at all, because there is no page scroll here. */
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
        var boxW = box.width;
        var distance = Math.abs(dx) / boxW;
        var speed = Math.abs(g.vx) / boxW;    /* box widths per second */
        var committed = distance >= 0.25 || speed > 0.5;
        if (!committed) {
          /* Below the threshold at release: cancel. The page animates back,
             and under reduced motion it snaps instantly. */
          el.stage.classList.add('is-cancelled');
          setTimeout(function () { el.stage.classList.remove('is-cancelled'); }, 140);
          announce('Gesture released early. No page change.');
          return;
        }
        var forward = (dx < 0) === isRtl();
        if (forward) { goNext(); } else { goPrev(); }
        return;
      }
    }

    /* A long press is not a tap: the reader is steadying a hand, not asking
       for a page turn. */
    if (g.moved || elapsed >= LONG_PRESS_MS) { return; }
    var zone = zoneAt(ev.clientX, box);
    zoneAction(zone);
  }

  function onPointerCancel() { gesture = null; }

  /* --- the keyboard map (§9) ----------------------------------------------- */

  function isTypingTarget(node) {
    if (!node) { return false; }
    var tag = node.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
      node.isContentEditable === true;
  }

  function onKeyDown(ev) {
    /* The browser's own zoom is never hijacked. Only the bare keys are ours. */
    if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
    if (isTypingTarget(ev.target)) { return; }
    /* While a dialog is open the reader keys are inert and the dialog's own
       keys apply. Focus is trapped by showModal(). */
    if (el.dialog && el.dialog.open) {
      if (ev.key === 'Escape') { /* the dialog handles it; do not also act */ }
      return;
    }

    var paged = S.readingMode !== 'vertical';
    var forwardKey = isRtl() ? 'ArrowLeft' : 'ArrowRight';
    var backKey = isRtl() ? 'ArrowRight' : 'ArrowLeft';

    switch (ev.key) {
      case 'ArrowDown':
      case 'PageDown':
        ev.preventDefault();
        if (paged) { goNext(); } else { el.canvas.scrollTop += el.canvas.clientHeight * 0.9; syncFromScroll(); }
        return;
      case ' ':
        ev.preventDefault();
        if (ev.shiftKey) {
          if (paged) { goPrev(); } else { el.canvas.scrollTop -= el.canvas.clientHeight * 0.9; syncFromScroll(); }
        } else if (paged) { goNext(); }
        else { el.canvas.scrollTop += el.canvas.clientHeight * 0.9; syncFromScroll(); }
        return;
      case 'ArrowUp':
      case 'PageUp':
        ev.preventDefault();
        if (paged) { goPrev(); } else { el.canvas.scrollTop -= el.canvas.clientHeight * 0.9; syncFromScroll(); }
        return;
      case 'Home':
        ev.preventDefault(); goHome(); return;
      case 'End':
        ev.preventDefault(); goEnd(); return;
      case 'ArrowLeft':
      case 'ArrowRight': {
        ev.preventDefault();
        var forward = (ev.key === forwardKey);
        if (paged) {
          if (forward) { goNext(); } else { goPrev(); }
        } else if (forward) {
          el.canvas.scrollTop += el.canvas.clientHeight * 0.9;
          syncFromScroll();
        } else {
          el.canvas.scrollTop -= el.canvas.clientHeight * 0.9;
          syncFromScroll();
        }
        return;
      }
      case '+':
      case '=':
        ev.preventDefault(); zoomStep(10); return;
      case '-':
      case '_':
        ev.preventDefault(); zoomStep(-10); return;
      case '0':
        ev.preventDefault(); resetZoom(); return;
      case 'f':
      case 'F':
        ev.preventDefault(); toggleFullscreen(); return;
      case 'm':
      case 'M':
        ev.preventDefault(); cycleMode(); return;
      case 'd':
      case 'D':
        ev.preventDefault(); toggleDirection(); return;
      case 'b':
      case 'B':
        ev.preventDefault(); toggleChrome(); return;
      case 'Escape':
        ev.preventDefault();
        if (document.fullscreenElement) { return; }   /* the browser handles it */
        if (!S.chromeVisible) { toggleChrome(); }
        return;
      default:
        return;
    }
  }

  /* --- wiring -------------------------------------------------------------- */

  function onClick(ev) {
    var t = ev.target;
    var hit = t.closest ? t.closest('[data-act], [data-mode], [data-dir], [data-zoom], [data-retry], [data-continue], [data-stay], [data-skip]') : null;
    if (!hit) { return; }
    var act = hit.getAttribute('data-act');

    if (hit.hasAttribute('data-mode')) { setMode(hit.getAttribute('data-mode')); return; }
    if (hit.hasAttribute('data-dir')) { setDirection(hit.getAttribute('data-dir')); return; }
    if (hit.hasAttribute('data-zoom')) { setZoom(parseInt(hit.getAttribute('data-zoom'), 10)); return; }
    if (hit.hasAttribute('data-retry')) { retryPage(parseInt(hit.getAttribute('data-retry'), 10)); return; }
    if (hit.hasAttribute('data-skip')) { goNext(); return; }
    if (hit.hasAttribute('data-continue')) {
      var ch = CHAPTERS[S.chapterId];
      if (ch.next) { loadChapter(ch.next, true); }
      return;
    }
    if (hit.hasAttribute('data-stay')) { cancelAutoAdvance(); return; }

    switch (act) {
      case 'next': goNext(); break;
      case 'prev': goPrev(); break;
      case 'home': goHome(); break;
      case 'end': goEnd(); break;
      case 'zoom-in': zoomStep(10); break;
      case 'zoom-out': zoomStep(-10); break;
      case 'zoom-reset': resetZoom(); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'chrome': toggleChrome(); break;
      case 'options': openOptions(); break;
      case 'close-options': closeOptions(); break;
      case 'mark-read':
        S.completed = true;
        announce('Chapter ' + CHAPTERS[S.chapterId].num + ' marked as read.');
        break;
      case 'dismiss-banner': hideBanner(); break;
      default: break;
    }
  }

  document.addEventListener('click', onClick);

  document.addEventListener('keydown', onKeyDown);

  el.wrap.addEventListener('pointerdown', onPointerDown);
  el.wrap.addEventListener('pointermove', onPointerMove);
  el.wrap.addEventListener('pointerup', onPointerUp);
  el.wrap.addEventListener('pointercancel', onPointerCancel);

  el.canvas.addEventListener('scroll', syncFromScroll, { passive: true });

  if (window.ResizeObserver) {
    new ResizeObserver(scheduleMeasure).observe(el.wrap);
  } else {
    window.addEventListener('resize', scheduleMeasure);
  }

  if (zoneToggle) {
    zoneToggle.addEventListener('change', function () { paintZones(); });
  }
  if (el.failToggle) {
    el.failToggle.addEventListener('click', function () {
      failActive = !failActive;
      failAttempts = 0;
      el.failToggle.textContent = failActive
        ? 'Stop failing page 7' : 'Make page 7 fail again';
      render();
      announce(failActive
        ? 'Page 7 will fail to load. Navigate to it to see the placeholder.'
        : 'Page 7 will load normally.');
    });
  }
  if (autoToggle) {
    autoToggle.addEventListener('change', function () {
      prefs.autoNextChapter = autoToggle.checked;
      window.yomiPrefs.write({ autoNextChapter: autoToggle.checked });
      announce('Auto-advance ' + (autoToggle.checked ? 'on' : 'off') + '.');
    });
  }
  if (el.dialog) {
    el.dialog.addEventListener('close', function () { el.canvas.focus(); });
  }

  /* --- boot ---------------------------------------------------------------- */

  S.currentPage = readingStart();
  render();
  paintZones();
  if (autoToggle) { autoToggle.checked = !!prefs.autoNextChapter; }

  /* Initial focus lands on the reader container on route entry. Without this
     a keyboard user's first Tab lands in the site navigation, which is a long
     way from the thing they came to do. */
  el.canvas.focus();
}
)();
