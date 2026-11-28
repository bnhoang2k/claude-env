// Renderer for the live project dashboard page. Runs in the browser after fold.js and view.js
// (window.DashboardFold, window.DashboardView).
//
// Two modes:
//  - publish: no data in the page. Subscribes once to each collection through the `db`
//    capability and re-renders on every snapshot.
//  - snapshot: data baked into <script type="application/json" id="dashboard-data">,
//    labelled as a saved copy.
//
// Rules this file keeps:
//  - Connection state (loading, live, saved, disconnected) is computed apart from report age.
//  - Loading lasts until the first snapshot of BOTH claims and events (10 s timer).
//  - A newly excluded or mismatch entry is held until the next claims snapshot, so a valid
//    report that arrives before its claim update never shows as excluded.
//  - A claim body that first appears or changes gets seenAt = viewer clock (lease clamp base).
//  - Every data-derived string goes in through textContent.
//  - A re-render keeps scroll, open disclosures, focus and the selected view, and reuses
//    image elements so pictures never reload.
(function (root) {
  'use strict';

  const COLLECTIONS = ['meta', 'claims', 'events', 'plans', 'pointers', 'direction', 'evidence', 'checks', 'archive', 'subplans'];
  const LOAD_TIMEOUT_MS = 10000;
  const HOLD_MS = 10000;
  const TICK_MS = 30000;
  const AGENTS_SHOWN = 5;
  const HISTORY_PAGE = 40;
  const SINCE_SHOWN = 6;
  const VIEWS = [['progress', 'Progress'], ['direction', 'Direction'], ['history', 'History']];
  const LAST_VISIT_KEY = 'project-dashboard:last-visit';
  const SETTLED = ['approved', 'confirmed'];
  const STATUS_ORDER = { working: 0, blocked: 1, setback: 1, waiting: 2, free: 3, finished: 4 };
  const KIND_LABEL = {
    start: 'Started', milestone: 'Milestone reached', needs_you: 'Asked you', answered: 'Answered',
    blocked: 'Blocked', unblocked: 'Unblocked', setback: 'Setback', recovered: 'Recovered',
    detour: 'Detour', discovery: 'Discovery', reopen: 'Reopened', done: 'Finished', release: 'Released',
  };
  const REASON_LABEL = {
    unreserved: 'Reported past its claim', stale_generation: 'From an earlier owner',
    after_close: 'After the task closed', unknown_generation: 'No matching claim',
    wrong_writer: 'From a writer the claim does not name', duplicate: 'Repeat of an earlier report',
    malformed: 'Unreadable report id',
  };

  const S = {
    mode: 'publish',
    fixedNow: null,
    docs: {},
    cache: {},
    arrived: {},
    errored: false,
    timedOut: false,
    conn: 'loading',
    lastLiveAt: null,
    claimsSeq: 0,
    techSeen: new Map(),
    techBaseline: false,
    holdTimer: null,
    seen: new Map(),
    view: 'progress',
    showAllAgents: false,
    historyCount: HISTORY_PAGE,
    prevVisit: null,
    db: null,
    canEdit: false,
    userId: null,
    archiveBusy: new Set(),
    archiveErrors: new Map(),
    tipSeq: 0,
    infoOpen: null,
    visitStored: false,
    pending: false,
  };
  COLLECTIONS.forEach(c => { S.docs[c] = []; });
  const imgCache = new Map();

  // ---------- helpers ----------
  function list(v) { return Array.isArray(v) ? v : []; }
  function ms(v) { if (v == null) return NaN; return typeof v === 'number' ? v : Date.parse(v); }
  function nowMs() { return S.mode === 'snapshot' ? S.fixedNow : Date.now(); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function h(tag, props) {
    const el = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = String(v);
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'open' || k === 'hidden') el[k] = true;
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    const kids = Array.prototype.slice.call(arguments, 2).flat(Infinity);
    for (const kid of kids) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const WHEN = (function () {
    try { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return null; }
  })();
  function when(v) {
    const t = ms(v);
    if (isNaN(t)) return '';
    return WHEN ? WHEN.format(new Date(t)) : new Date(t).toISOString().slice(0, 16).replace('T', ' ');
  }
  function ago(v, now) {
    const t = ms(v);
    if (isNaN(t)) return '';
    const d = now - t;
    if (d < 60000) return 'just now';
    const m = Math.floor(d / 60000);
    if (m < 60) return m + ' min ago';
    const hr = Math.floor(m / 60);
    if (hr < 24) return hr + ' h ago';
    const days = Math.floor(hr / 24);
    return days === 1 ? '1 day ago' : days + ' days ago';
  }
  function safeUrl(u) {
    return typeof u === 'string' && (/^https:\/\//.test(u) || /^\/_blob\//.test(u)) ? u : null;
  }
  function storage(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }

  // ---------- data in ----------
  function fromSnapshotDoc(c, d) {
    const body = d.data();
    const key = c + '/' + d.id;
    let rec = S.seen.get(key);
    if (!rec || rec.body !== body) { rec = { body, seenAt: Date.now() }; S.seen.set(key, rec); }
    return { id: d.id, data: body, seenAt: rec.seenAt };
  }

  function haveData() {
    return COLLECTIONS.some(c => S.docs[c].length) || S.arrived.claims || S.arrived.events;
  }

  function updateConn() {
    if (S.mode === 'snapshot') { S.conn = 'saved'; return; }
    const both = S.arrived.claims && S.arrived.events;
    if (S.errored || S.dbMissing) { S.conn = haveData() ? 'saved' : 'disconnected'; return; }
    if (both) {
      const cached = COLLECTIONS.some(c => S.cache[c] === true);
      if (!cached) { S.conn = 'live'; S.lastLiveAt = Date.now(); return; }
    }
    if (S.timedOut) { S.conn = haveData() ? 'saved' : 'disconnected'; return; }
    S.conn = 'loading';
  }

  function onSnapshot(c, snap) {
    S.docs[c] = list(snap && snap.docs).filter(d => d && d.exists !== false).map(d => fromSnapshotDoc(c, d));
    S.cache[c] = !!(snap && snap.metadata && snap.metadata.fromCache);
    S.arrived[c] = true;
    if (c === 'claims') S.claimsSeq++;
    updateConn();
    schedule();
  }

  function onError(c) {
    S.errored = true;
    updateConn();
    schedule();
  }

  function subscribe(db) {
    for (const c of COLLECTIONS) {
      try {
        db.collection(c).onSnapshot(snap => onSnapshot(c, snap), () => onError(c));
      } catch (e) { onError(c); }
    }
  }

  function loadSnapshot(el) {
    let payload = {};
    try { payload = JSON.parse(el.textContent || '{}'); } catch (e) { payload = {}; }
    S.mode = 'snapshot';
    S.fixedNow = ms(payload.now);
    if (isNaN(S.fixedNow)) S.fixedNow = Date.now();
    const cols = payload.collections || {};
    for (const c of COLLECTIONS) S.docs[c] = list(cols[c]);
    S.arrived.claims = S.arrived.events = true;
    S.conn = 'saved';
  }

  // ---------- model ----------
  function computeFrom(input, now) {
    const st = root.DashboardFold.fold(input, now);
    const v = root.DashboardView.view(st, input, now);
    return { now, st, v, input };
  }

  // One malformed record must not freeze the page under a Connected label. When the model
  // cannot be computed, find the one record whose removal lets it compute, show the rest, and
  // list that record in Technical details. When no single record explains it, the page says
  // it could not read the data. The search runs on every render, so it stays cheap: the last
  // culprit is re-tested first, a new one is found by halving each collection (about log N
  // computes, not N), the search stops after PROBE_BUDGET_MS, and an input that already
  // failed the search is not searched again until a snapshot replaces one of its lists.
  const PROBE_BUDGET_MS = 150;
  let lastCulprit = null; // 'collection/id' set aside by the last search
  let lastFailed = null;  // the S.docs lists of the last input no search could explain
  function probe(input, now) {
    const without = (c, drop) => {
      const out = new Set(drop);
      try { return computeFrom(Object.assign({}, input, { [c]: input[c].filter(x => !out.has(x)) }), now); } catch (e) { return null; }
    };
    const found = (m, c, d) => Object.assign(m, { unreadable: [c + '/' + d.id] });
    if (lastCulprit) {
      const c = lastCulprit.slice(0, lastCulprit.indexOf('/')), id = lastCulprit.slice(c.length + 1);
      const d = list(input[c]).find(x => x.id === id);
      const m = d && without(c, [d]);
      if (m) return found(m, c, d);
    }
    const deadline = Date.now() + PROBE_BUDGET_MS;
    for (const c of COLLECTIONS) {
      if (Date.now() > deadline) return null;
      if (!input[c].length || !without(c, input[c])) continue;
      let cand = input[c];
      while (cand.length > 1) {
        if (Date.now() > deadline) return null;
        const half = cand.slice(0, cand.length >> 1);
        cand = without(c, half) ? half : cand.slice(half.length);
      }
      const m = without(c, cand);
      if (m) return found(m, c, cand[0]);
    }
    return null;
  }
  function compute() {
    const now = nowMs();
    const input = {};
    for (const c of COLLECTIONS) input[c] = S.docs[c];
    try { return Object.assign(computeFrom(input, now), { unreadable: [] }); } catch (first) {
      if (lastFailed && COLLECTIONS.every(c => lastFailed[c] === input[c])) throw first;
      const m = probe(input, now);
      if (!m) { lastFailed = input; throw first; }
      lastCulprit = m.unreadable[0];
      lastFailed = null;
      return m;
    }
  }

  // Excluded and mismatch entries. Everything present at the first complete render (claims
  // and events both arrived) shows at once. A later new entry waits for the next claims
  // snapshot or HOLD_MS, whichever comes first, so a valid report that lands before its
  // claim update never shows as excluded, and a real exclusion never stays hidden.
  function held(items, keyOf, baseline) {
    if (S.mode === 'snapshot') return items;
    if (!(S.arrived.claims && S.arrived.events)) return [];
    const now = Date.now();
    let wait = null;
    const out = items.filter(x => {
      const k = keyOf(x);
      if (!S.techSeen.has(k)) S.techSeen.set(k, baseline ? null : { seq: S.claimsSeq, at: now });
      const rec = S.techSeen.get(k);
      if (!rec || S.claimsSeq > rec.seq || now - rec.at >= HOLD_MS) return true;
      const left = HOLD_MS - (now - rec.at);
      wait = wait == null ? left : Math.min(wait, left);
      return false;
    });
    if (wait != null && !S.holdTimer) {
      S.holdTimer = setTimeout(() => { S.holdTimer = null; schedule(); }, wait + 20);
    }
    return out;
  }

  // One status per task, from the view model; activity rows and plan cards both use it.
  const STATUS_UI = {
    working: ['working', 'Working'], 'waiting on you': ['waiting', 'Waiting on you'],
    blocked: ['blocked', 'Blocked'], setback: ['setback', 'Setback'], reopened: ['working', 'Reopened'],
    finished: ['finished', 'Finished'], 'free to take over': ['free', 'Free to take over'],
  };
  function taskStatus(t) { return STATUS_UI[t.status] || STATUS_UI.working; }

  // ---------- archive (owner and editors only; one click, undone from History) ----------
  async function writeArchive(ref, restore) {
    const key = (restore ? 'restore:' : '') + ref.id;
    if (!S.db || S.archiveBusy.has(key)) return;
    S.archiveBusy.add(key);
    S.archiveErrors.delete(key);
    schedule();
    try {
      const doc = S.db.collection('archive').doc(ref.id);
      if (restore) await doc.delete();
      else {
        const body = { kind: ref.kind, item: String(ref.item), at: new Date().toISOString(), by: S.userId || null };
        if (ref.through) body.through = ref.through;
        await doc.set(body);
      }
    } catch (e) {
      const refused = e && e.code === 'invalid_argument';
      S.archiveErrors.set(key, restore
        ? (refused ? 'Not restored: only editors can restore.' : 'Not restored. Try again.')
        : (refused ? 'Not archived: only editors can archive.' : 'Not archived. Try again.'));
    } finally {
      S.archiveBusy.delete(key);
      schedule();
    }
  }

  function archiveIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    const parts = [['rect', { x: 2, y: 3, width: 12, height: 3, rx: 1 }], ['path', { d: 'M3 6v6.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6' }], ['path', { d: 'M6.5 8.5h3' }]];
    for (const [tag, attrs] of parts) {
      const el = document.createElementNS(ns, tag);
      for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
      el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor'); el.setAttribute('stroke-width', '1.3');
      el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
      svg.append(el);
    }
    return svg;
  }

  // The control sits at the far end of its card's text, shown on hover and focus.
  function archiveControl(ref) {
    if (!S.canEdit || !S.db || !ref) return null;
    const tip = 'archive-tip-' + (++S.tipSeq);
    return h('span', { class: 'arch-slot' },
      h('button', {
        type: 'button', class: 'arch', 'aria-label': 'Archive', 'aria-describedby': tip,
        'data-archive': ref.id, 'data-key': 'arch:' + ref.id + ':' + S.tipSeq,
        disabled: S.archiveBusy.has(ref.id), onclick: () => writeArchive(ref, false),
      }, archiveIcon()),
      h('span', { class: 'tip', role: 'tooltip', id: tip, text: 'Archive' }));
  }

  function archiveError(ref, restore) {
    const msg = ref && S.archiveErrors.get((restore ? 'restore:' : '') + ref.id);
    return msg ? h('p', { class: 'arch-error', role: 'status', 'data-archive-error': ref.id, text: msg }) : null;
  }

  function archivable(ref) { return S.canEdit && S.db && ref ? ' has-arch' : ''; }

  // ---------- details card: provenance waits behind a row-end (i) ----------
  // Source, provenance and relevance strings hold hashes, paths and raw ids, so the page
  // never prints them in a row. Hovering or focusing the (i) shows them in a themed card;
  // a tap opens it on touch.
  function infoIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    const c = document.createElementNS(ns, 'circle');
    [['cx', 8], ['cy', 8], ['r', 6.25]].forEach(([k, v]) => c.setAttribute(k, v));
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M8 7.25v4');
    const d = document.createElementNS(ns, 'circle');
    [['cx', 8], ['cy', 4.9], ['r', 0.6]].forEach(([k, v]) => d.setAttribute(k, v));
    for (const el of [c, p]) { el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor'); el.setAttribute('stroke-width', '1.3'); el.setAttribute('stroke-linecap', 'round'); svg.append(el); }
    d.setAttribute('fill', 'currentColor');
    svg.append(d);
    return svg;
  }

  function provenanceRows(x, extra) {
    const rows = [['Source', x && x.source], ['How it was made', x && x.provenance], ['Why it matters', x && x.relevance]].concat(extra || []);
    return rows.filter(([, v]) => v != null && String(v).trim() !== '').map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
  }

  // key: stable per row, so an open card stays open across re-renders.
  function infoControl(key, rows, title) {
    if (!rows.length && !title) return null;
    const id = 'info-' + (++S.tipSeq);
    return h('span', { class: 'info-slot' + (S.infoOpen === key ? ' is-open' : ''), 'data-info': key },
      h('button', {
        type: 'button', class: 'info', 'aria-label': 'Details', 'aria-describedby': id,
        'aria-expanded': S.infoOpen === key ? 'true' : 'false', 'data-key': 'info:' + key,
      }, infoIcon()),
      h('span', { class: 'info-card', role: 'tooltip', id },
        title ? h('span', { class: 'info-title', text: title }) : null,
        rows.length ? h('span', { class: 'info-rows' }, rows.map(([k, v]) => h('span', { class: 'info-row' },
          h('span', { class: 'info-k', text: k }), h('span', { class: 'info-v', text: v })))) : null));
  }

  function placeCard(slot) {
    const card = slot && slot.querySelector('.info-card');
    if (!card) return;
    card.style.setProperty('--dx', '0px');
    const r = card.getBoundingClientRect();
    if (!r.width) return;
    const vw = document.documentElement.clientWidth;
    let dx = 0;
    if (r.left < 16) dx = 16 - r.left;
    else if (r.right > vw - 16) dx = vw - 16 - r.right;
    card.style.setProperty('--dx', dx + 'px');
  }

  // A caption is one line. A title too long for it is cut at a character
  // with an ellipsis, measured in the browser, so no text is ever painted past its box; the
  // whole title waits in the details card. Re-fit whenever a caption's width changes.
  function fitTitle(el) {
    const full = el.getAttribute('data-full') || '';
    const cap = el.closest('.ev-cap');
    if (!el.clientWidth) return;
    el.textContent = full;
    let cut = false;
    if (el.scrollWidth > el.clientWidth + 0.5) {
      let lo = 0, hi = full.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        el.textContent = full.slice(0, mid).trimEnd() + '\u2026';
        if (el.scrollWidth > el.clientWidth + 0.5) hi = mid - 1; else lo = mid;
      }
      el.textContent = full.slice(0, lo).trimEnd() + '\u2026';
      cut = true;
    }
    if (cap) cap.classList.toggle('is-cut', cut);
  }
  const titleFit = typeof ResizeObserver === 'function'
    ? new ResizeObserver(entries => entries.forEach(e => fitTitle(e.target))) : null;
  // Fit at once (closed disclosures still lay out their text), then on every width change.
  function fitTitles(app) {
    const titles = app.querySelectorAll('.ev-title');
    titles.forEach(fitTitle);
    if (!titleFit) return;
    titleFit.disconnect();
    titles.forEach(el => titleFit.observe(el));
  }

  function setInfoOpen(key) {
    S.infoOpen = key;
    document.querySelectorAll('.info-slot').forEach(s => {
      const on = key != null && s.getAttribute('data-info') === key;
      s.classList.toggle('is-open', on);
      const b = s.querySelector('.info');
      if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) placeCard(s);
    });
  }

  function wireInfo(app) {
    app.addEventListener('pointerover', e => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      const title = t.closest('.ev-title');
      if (title) placeCard(title.closest('.ev-cap') && title.closest('.ev-cap').querySelector('.info-slot'));
      const slot = t.closest('.info-slot');
      if (slot) placeCard(slot);
    });
    app.addEventListener('focusin', e => {
      const slot = e.target instanceof Element && e.target.closest('.info-slot');
      if (slot) { slot.classList.remove('is-dismissed'); placeCard(slot); }
    });
    app.addEventListener('pointerout', e => {
      const slot = e.target instanceof Element && e.target.closest('.info-slot');
      if (slot && !(e.relatedTarget instanceof Node && slot.contains(e.relatedTarget))) slot.classList.remove('is-dismissed');
    });
    app.addEventListener('click', e => {
      const btn = e.target instanceof Element && e.target.closest('.info');
      if (!btn) return;
      const key = btn.closest('.info-slot').getAttribute('data-info');
      setInfoOpen(S.infoOpen === key ? null : key);
    });
    document.addEventListener('click', e => {
      if (S.infoOpen == null) return;
      if (e.target instanceof Element && e.target.closest('.info-slot')) return;
      setInfoOpen(null);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const slot = document.activeElement && document.activeElement.closest && document.activeElement.closest('.info-slot');
      if (slot) slot.classList.add('is-dismissed');
      if (S.infoOpen != null) setInfoOpen(null);
    });
  }

  // ---------- pieces ----------
  function evidenceFigure(r, seenSrc) {
    const src = safeUrl(r.asset_url);
    let frame;
    if (src) {
      const n = (seenSrc.get(src) || 0) + 1;
      seenSrc.set(src, n);
      const key = src + '#' + n;
      let img = imgCache.get(key);
      if (!img) {
        img = h('img', { src, decoding: 'async' });
        // A picture that cannot load shows the empty frame, never its alt text spilling out.
        img.addEventListener('error', () => img.classList.add('is-broken'));
        imgCache.set(key, img);
      }
      img.alt = r.title || '';
      const fallback = pictureIcon();
      fallback.classList.add('ev-fallback');
      frame = h('div', { class: 'ev-frame' }, img, fallback);
    } else {
      frame = h('div', { class: 'ev-frame ev-empty', 'aria-hidden': 'true' }, pictureIcon());
    }
    // The caption is the title only, on one line; the whole title and the provenance wait in
    // the details card. A raw id never stands in for a missing title.
    const title = r.title ? String(r.title) : (!r.kind || r.kind === 'image' ? 'Untitled picture' : 'Untitled file');
    const status = r.status && r.status !== 'approved' ? EVIDENCE_STATUS[r.status] || 'Not approved' : null;
    const seq = (seenSrc.get('#' + r.id) || 0) + 1;
    seenSrc.set('#' + r.id, seq);
    return h('figure', { class: 'ev', 'data-evidence': r.id },
      frame,
      h('figcaption', { class: 'ev-cap' },
        h('span', { class: 'ev-line' },
          h('span', { class: 'ev-title', 'data-full': title, text: title }),
          infoControl('ev:' + r.id + ':' + seq, provenanceRows(r), title)),
        status ? h('span', { class: 'ev-status', text: status }) : null));
  }
  const EVIDENCE_STATUS = { exploratory: 'Exploratory', rejected: 'Rejected', superseded: 'Replaced', withdrawn: 'Withdrawn' };

  function pictureIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'ev-icon');
    const r = document.createElementNS(ns, 'rect');
    [['x', 3], ['y', 4], ['width', 18], ['height', 16], ['rx', 2]].forEach(([k, v]) => r.setAttribute(k, v));
    const c = document.createElementNS(ns, 'circle');
    [['cx', 9], ['cy', 10], ['r', 2]].forEach(([k, v]) => c.setAttribute(k, v));
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M3 17l5-5 4 4 3-3 6 6');
    for (const el of [r, c, p]) { el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor'); el.setAttribute('stroke-width', '1.5'); svg.append(el); }
    return svg;
  }

  function evidenceGrid(records, seenSrc, cls) {
    if (!records.length) return null;
    return h('div', { class: 'ev-grid' + (cls ? ' ' + cls : '') }, records.map(r => evidenceFigure(r, seenSrc)));
  }

  function evidenceCountLabel(records) {
    const allImages = records.every(r => !r.kind || r.kind === 'image');
    return allImages ? plural(records.length, 'picture', 'pictures') : plural(records.length, 'file', 'files');
  }

  function taskItem(t, ctx) {
    const [cls, label] = taskStatus(t);
    // The current obstacle is shown once, in its own card; a task that reported it keeps its state.
    const lastText = t.last && t.last.text && t.last.text !== ctx.obstacleText ? t.last.text : null;
    const lastAt = t.last ? 'Last report ' + ago(t.last.at, ctx.now) : 'No report yet';
    const ev = list(t.evidence);
    if (cls === 'finished') {
      return h('li', { class: 'task is-finished', 'data-task': t.id },
        h('details', { 'data-key': 'task:' + t.id },
          h('summary', null,
            h('span', { class: 'mark', 'aria-hidden': 'true' }),
            h('span', { class: 'task-name', text: t.name }),
            ev.length ? h('span', { class: 'ev-link', 'data-evidence-link': '', text: evidenceCountLabel(ev) }) : null,
            h('span', { class: 'state', text: label })),
          h('div', { class: 'task-body' },
            lastText ? h('p', { class: 'task-text', text: lastText }) : null,
            h('p', { class: 'meta', text: lastAt }),
            evidenceGrid(ev, ctx.seenSrc))));
    }
    const blockers = list(t.blockers)
      .filter(id => !(ctx.obstacle && ctx.obstacle.id === id))
      .map(id => ctx.blockers.get(id)).filter(Boolean);
    return h('li', { class: 'task is-' + cls, 'data-task': t.id },
      h('div', { class: 'task-line' },
        h('span', { class: 'mark', 'aria-hidden': 'true' }),
        h('span', { class: 'task-name', text: t.name }),
        h('span', { class: 'state', text: label })),
      h('p', { class: 'meta', text: lastAt }),
      lastText ? h('p', { class: 'task-text', text: lastText }) : null,
      t.reopened && t.reopened.reason ? h('p', { class: 'task-note', text: 'Reopened: ' + t.reopened.reason }) : null,
      blockers.map(b => h('div', { class: 'task-note is-blocked' + archivable(b.archive), 'data-blocker': b.id },
        h('p', { text: b.text || 'Blocked' }), archiveControl(b.archive), archiveError(b.archive))),
      list(t.discoveries).slice(-1).map(d => h('div', { class: 'task-note' + archivable(d.archive), 'data-discovery': d.id },
        h('p', { text: 'Found: ' + (d.text || '') }), archiveControl(d.archive), archiveError(d.archive))),
      evidenceGrid(ev, ctx.seenSrc));
  }

  function setbackBlock(sb, ctx) {
    const detours = list(sb.detours).filter(Boolean);
    const body = [
      sb.cause && sb.cause !== sb.text ? h('p', { class: 'meta', text: 'Cause: ' + sb.cause }) : null,
      sb.affects.length ? h('p', { class: 'meta', text: 'Holds up ' + sb.affects.map(a => a.name).join(', ') }) : null,
      detours.length ? h('div', { class: 'detour' },
        h('p', { class: 'label', text: 'Recovery detour' }),
        h('ul', { class: 'detour-list' }, detours.map(d => h('li', null,
          h('span', { class: 'task-name', text: d.name }),
          d.last && d.last.text ? h('span', { class: 'meta', text: d.last.text }) : null)))) : null,
    ];
    if (sb.resolved) {
      return h('details', { class: 'setback is-resolved', 'data-key': 'setback:' + sb.id, 'data-setback': sb.id },
        h('summary', null, h('span', { class: 'label', text: 'Setback resolved' }), h('span', { class: 'sb-text', text: sb.text || '' })),
        h('div', { class: 'setback-body' + archivable(sb.archive) }, body, archiveControl(sb.archive), archiveError(sb.archive)));
    }
    return h('div', { class: 'setback' + archivable(sb.archive), 'data-setback': sb.id },
      h('p', { class: 'label', text: 'Setback' }),
      h('p', { class: 'sb-text', text: sb.text || '' }),
      body, archiveControl(sb.archive), archiveError(sb.archive));
  }

  function milestonesBlock(p) {
    const ms_ = list(p.milestones);
    if (!ms_.length) return null;
    const done = ms_.filter(m => m.done).length;
    // A milestone a chunk names is listed under that chunk, not twice.
    const inChunk = new Set(p.subplan ? p.subplan.chunks.flatMap(c => c.milestones.map(m => m.id)) : []);
    const rest = ms_.filter(m => !inChunk.has(m.id));
    return h('div', { class: 'milestones' },
      h('p', { class: 'count' }, h('span', { class: 'big', text: done + ' of ' + ms_.length }), h('span', { class: 'meta', text: 'milestones done' })),
      rest.length ? h('ul', { class: 'milestone-list' }, rest.map(m => h('li', { class: m.done ? 'is-done' : '', 'data-milestone': m.id },
        h('span', { class: 'mark', 'aria-hidden': 'true' }),
        h('span', { class: 'ms-name', text: m.name || m.id }),
        h('span', { class: 'state', text: m.done ? 'Done' : '' })))) : null);
  }

  // Work outside any chunk sits under its own label once a phase has a sub-plan.
  function looseWork(p, work, ctx) {
    if (!work.length) return null;
    const ul = h('ul', { class: 'work' }, work.map(t => taskItem(t, ctx)));
    return p.subplan ? h('div', { class: 'loose', 'data-loose': '' }, h('p', { class: 'label', text: 'Other work in this phase' }), ul) : ul;
  }

  // Every task of a phase: work with no chunk plus the work of each chunk.
  function phaseTasks(p) {
    return p.work.concat(p.subplan ? p.subplan.chunks.flatMap(c => c.work) : []);
  }

  function chunkLabel(p) {
    const chunks = p.subplan.chunks;
    const i = chunks.findIndex(c => c.status === 'current');
    return 'Chunk ' + (i < 0 ? chunks.length : i + 1) + ' of ' + chunks.length;
  }

  function chunkMilestones(c) {
    if (!c.milestones.length) return null;
    return h('ul', { class: 'milestone-list' }, c.milestones.map(m => h('li', { class: m.done ? 'is-done' : '', 'data-milestone': m.id },
      h('span', { class: 'mark', 'aria-hidden': 'true' }),
      h('span', { class: 'ms-name', text: m.name || m.id }),
      h('span', { class: 'state', text: m.done ? 'Done' : '' }))));
  }

  // A phase's sub-plan, in the plan's row style: the current chunk open with its tasks, done
  // chunks dimmed and closed, later chunks one line each.
  function chunkItem(p, c, i, ctx) {
    const title = (i + 1) + '. ' + c.name;
    const work = c.work.slice().sort((a, b) => STATUS_ORDER[taskStatus(a)[0]] - STATUS_ORDER[taskStatus(b)[0]]);
    const body = (empty) => h('div', { class: 'chunk-body' },
      c.outcome ? h('p', { class: 'outcome', text: c.outcome }) : null,
      chunkMilestones(c),
      work.length ? h('ul', { class: 'work' }, work.map(t => taskItem(t, ctx))) : empty ? h('p', { class: 'meta', text: empty }) : null);
    const head = (tag, state) => [
      h('span', { class: 'mark', 'aria-hidden': 'true' }),
      h(tag, { class: 'chunk-name', text: title }),
      h('span', { class: 'state', text: state })];
    if (c.status === 'current') {
      return h('li', { class: 'chunk is-current', 'data-chunk': c.id },
        h('div', { class: 'chunk-head' }, head('span', 'Now')), body('No agent has reported in this chunk yet'));
    }
    if (c.status === 'done' || work.length) {
      return h('li', { class: 'chunk ' + (c.status === 'done' ? 'is-done' : 'is-planned has-work'), 'data-chunk': c.id },
        h('details', { 'data-key': 'chunk:' + p.id + ':' + c.id },
          h('summary', null, head('span', c.status === 'done' ? 'Done' : 'Parallel work')), body(null)));
    }
    return h('li', { class: 'chunk is-planned', 'data-chunk': c.id },
      h('div', { class: 'chunk-head' }, head('span', 'Not started')));
  }

  function chunksBlock(p, ctx) {
    if (!p.subplan || !p.subplan.chunks.length) return null;
    return h('ol', { class: 'chunks', 'data-subplan': String(p.subplan.version) }, p.subplan.chunks.map((c, i) => chunkItem(p, c, i, ctx)));
  }

  function phaseEvidence(p) {
    const workIds = new Set(phaseTasks(p).map(t => t.id));
    return list(p.evidence).filter(r => !r.task || !workIds.has(r.task));
  }

  function phaseItem(p, i, ctx) {
    const title = (i + 1) + '. ' + (p.name || p.id);
    const work = p.work.slice().sort((a, b) => STATUS_ORDER[taskStatus(a)[0]] - STATUS_ORDER[taskStatus(b)[0]]);
    const pev = phaseEvidence(p);
    const open = p.setbacks.filter(s => !s.resolved);
    const resolved = p.setbacks.filter(s => s.resolved);
    if (p.status === 'done') {
      return h('li', { class: 'phase is-done', 'data-phase': p.id },
        h('details', { 'data-key': 'phase:' + p.id },
          h('summary', null,
            h('span', { class: 'mark', 'aria-hidden': 'true' }),
            h('span', { class: 'phase-name', text: title }),
            h('span', { class: 'state', text: 'Done' })),
          h('div', { class: 'phase-body' },
            p.outcome ? h('p', { class: 'outcome', text: p.outcome }) : null,
            evidenceGrid(pev, ctx.seenSrc),
            milestonesBlock(p),
            chunksBlock(p, ctx),
            looseWork(p, work, ctx),
            p.setbacks.map(sb => setbackBlock(sb, ctx)))));
    }
    if (p.status === 'current') {
      return h('li', { class: 'phase is-current', 'data-phase': p.id },
        h('div', { class: 'phase-head' },
          h('span', { class: 'mark', 'aria-hidden': 'true' }),
          h('h3', { class: 'phase-name', text: title }),
          h('span', { class: 'state', text: p.subplan ? chunkLabel(p) : 'Now' })),
        h('div', { class: 'phase-body' },
          p.outcome ? h('p', { class: 'outcome', text: p.outcome }) : null,
          pev.length ? h('p', { class: 'label', text: 'Working from' }) : null,
          evidenceGrid(pev, ctx.seenSrc),
          milestonesBlock(p),
          open.map(sb => setbackBlock(sb, ctx)),
          chunksBlock(p, ctx),
          work.length ? looseWork(p, work, ctx)
            : p.subplan ? null : h('p', { class: 'meta', text: 'No agent has reported in this phase yet' }),
          resolved.map(sb => setbackBlock(sb, ctx))));
    }
    // planned
    const hasChunkWork = !!p.subplan && p.subplan.chunks.some(c => c.work.length);
    if (!work.length && !p.setbacks.length && !hasChunkWork) {
      return h('li', { class: 'phase is-planned', 'data-phase': p.id },
        h('div', { class: 'phase-head' },
          h('span', { class: 'mark', 'aria-hidden': 'true' }),
          h('span', { class: 'phase-name', text: title }),
          h('span', { class: 'state', text: 'Not started' })));
    }
    return h('li', { class: 'phase is-planned has-work', 'data-phase': p.id },
      h('div', { class: 'phase-head' },
        h('span', { class: 'mark', 'aria-hidden': 'true' }),
        h('span', { class: 'phase-name', text: title }),
        h('span', { class: 'state', text: 'Parallel work' })),
      h('div', { class: 'phase-body' },
        evidenceGrid(pev, ctx.seenSrc),
        p.setbacks.map(sb => setbackBlock(sb, ctx)),
        chunksBlock(p, ctx),
        looseWork(p, work, ctx)));
  }

  function planCard(v, ctx) {
    const phases = v.roadmap.phases;
    const outside = v.roadmap.outside;
    let body;
    if (!phases.length && !outside.length) {
      body = h('p', { class: 'empty', text: S.conn === 'loading' ? 'Loading' : 'No plan recorded yet' });
    } else {
      body = [
        h('ol', { class: 'phases' }, phases.map((p, i) => phaseItem(p, i, ctx))),
        outside.length ? h('div', { class: 'outside', 'data-outside': '' },
          h('p', { class: 'label', text: 'Outside the current plan' }),
          h('ul', { class: 'work' }, outside.map(t => taskItem(t, ctx))),
          list(v.roadmap.outsideSetbacks).map(sb => setbackBlock(sb, ctx))) : null,
      ];
    }
    return h('section', { class: 'card plan', 'data-area': 'plan', 'aria-label': 'The plan' },
      h('p', { class: 'card-title', text: 'The plan' }), body);
  }

  function needsCard(v, ctx) {
    const items = v.needsYou;
    return h('section', { class: 'card needs' + (items.length ? ' has-items' : ''), 'data-area': 'needs', 'aria-label': 'Needs you' },
      h('p', { class: 'card-title', text: 'Needs you' }),
      items.length ? h('ul', { class: 'needs-list' }, items.map(n => h('li', { 'data-needs': n.task, class: archivable(n.archive).trim() || null },
        archiveControl(n.archive),
        h('p', { class: 'question', text: n.question || 'A decision is waiting' }),
        h('p', { class: 'meta', text: [n.taskName, ctx.phaseName(n.phase), n.at ? ago(n.at, ctx.now) : null].filter(Boolean).join(' · ') }),
        list(n.options).length ? h('ul', { class: 'options' }, list(n.options).map(o => typeof o === 'string' ? o : (o && (o.text || o.label)) || null).filter(Boolean).map(o => h('li', { text: o }))) : null,
        n.holdsUp ? h('p', { class: 'meta', text: 'If it waits: holds up ' + n.holdsUp }) : null,
        archiveError(n.archive))))
        : h('p', { class: 'empty', text: 'Nothing is waiting on you' }));
  }

  function obstacleCard(v, ctx) {
    const o = v.obstacle;
    if (!o) return null;
    const names = list(o.affects).map(id => ctx.taskName(id));
    return h('section', { class: 'card obstacle', 'data-area': 'obstacle', 'aria-label': 'Current obstacle', 'data-blocker': o.id },
      h('p', { class: 'card-title', text: 'Current obstacle' }),
      h('div', { class: 'obstacle-main' + archivable(o.archive) },
        h('p', { class: 'obstacle-text', text: o.text || 'Blocked' }),
        h('p', { class: 'meta', text: ['Since ' + ago(o.since, ctx.now), names.length ? 'holds up ' + names.join(', ') : null].filter(Boolean).join(' · ') }),
        archiveControl(o.archive)),
      archiveError(o.archive));
  }

  function activityCard(v, ctx) {
    const c = v.activity.counts;
    const agents = v.activity.agents.map(a => {
      const t = ctx.tasks.get(a.task) || { id: a.task, name: a.task };
      return { a, t, st: taskStatus(a) };
    }).sort((x, y) => (STATUS_ORDER[x.st[0]] - STATUS_ORDER[y.st[0]]) ||
      ((ms(y.a.last && y.a.last.at) || 0) - (ms(x.a.last && x.a.last.at) || 0)));
    const shown = S.showAllAgents ? agents : agents.slice(0, AGENTS_SHOWN);
    const stat = (n, label, cls) => h('span', { class: 'stat ' + cls }, h('span', { class: 'num', text: String(n) }), h('span', { class: 'stat-label', text: label }));
    return h('details', { class: 'card activity', 'data-area': 'activity', 'data-key': 'activity', open: true },
      h('summary', null,
        h('p', { class: 'card-title', text: 'Agent activity' }),
        h('span', { class: 'stats' },
          stat(c.working, 'Working', 'is-working'),
          stat(c.waiting, 'Waiting on you', 'is-waiting'),
          c.blocked ? stat(c.blocked, 'Blocked', 'is-blocked') : null,
          stat(c.finished, 'Finished', 'is-finished'),
          stat(c.freeToTake, 'Free to take over', 'is-free'))),
      agents.length ? h('ul', { class: 'agents' }, shown.map(({ a, t, st }) => h('li', { class: 'agent is-' + st[0], 'data-agent': a.task },
        h('span', { class: 'mark', 'aria-hidden': 'true' }),
        h('div', { class: 'agent-main' },
          h('p', { class: 'agent-line' }, h('span', { class: 'task-name', text: t.name }), h('span', { class: 'state', text: st[1] })),
          h('p', { class: 'meta', text: [ctx.phaseLabel(a.phase), a.last ? 'Last report ' + ago(a.last.at, ctx.now) : 'No report yet'].filter(Boolean).join(' · ') }),
          a.last && a.last.text && a.last.text !== ctx.obstacleText ? h('p', { class: 'agent-text', text: a.last.text }) : null))))
        : h('p', { class: 'empty', text: 'No agent has reported yet' }),
      agents.length > AGENTS_SHOWN ? h('button', {
        type: 'button', class: 'more', 'data-key': 'agents-more',
        text: S.showAllAgents ? 'Show fewer' : 'Show all ' + agents.length,
        onclick: () => { S.showAllAgents = !S.showAllAgents; render(); },
      }) : null);
  }

  function historyTitle(e, ctx) {
    if (e.type === 'plan') return 'Plan version ' + e.version + ' approved';
    if (e.type === 'direction') return 'Direction version ' + e.version + ' approved';
    if (e.type === 'subplan') return 'Sub-plan version ' + e.version + ' approved' + (e.phaseName ? ' for ' + e.phaseName : '');
    return (KIND_LABEL[e.kind] || 'Report') + ': ' + (e.taskName || e.task);
  }

  function sinceCard(v, ctx) {
    const live = S.mode === 'publish' && S.prevVisit != null;
    const items = v.history.filter(e => !e.archived && (!live || ms(e.at) > S.prevVisit)).slice(0, SINCE_SHOWN);
    return h('section', { class: 'card since', 'data-area': 'since', 'aria-label': live ? 'Since your last visit' : 'Recent changes' },
      h('p', { class: 'card-title', text: live ? 'Since your last visit' : 'Recent changes' }),
      items.length ? h('ul', { class: 'since-list' }, items.map(e => h('li', null,
        h('p', { class: 'since-title', text: historyTitle(e, ctx) }),
        (e.text || e.reason) && (e.text || e.reason) !== ctx.obstacleText ? h('p', { class: 'since-text', text: e.text || e.reason }) : null,
        h('p', { class: 'meta', text: ago(e.at, ctx.now) }))))
        : h('p', { class: 'empty', text: live ? 'Nothing new since your last visit' : 'No changes yet' }));
  }

  function techCard(v, st, ctx) {
    const t = v.technical;
    // The baseline is taken once, from excluded and mismatch entries together.
    const complete = !!(S.arrived.claims && S.arrived.events);
    const baseline = complete && !S.techBaseline;
    const excluded = held(t.excluded, x => 'x:' + x.id + ':' + x.reason, baseline);
    const mismatches = held(list(t.mismatches), m => 'm:' + m.task + ':' + list(m.missing).join(','), baseline);
    if (complete) S.techBaseline = true;
    const s = t.stats || {};
    const row = (k, val) => h('div', { class: 'kv' }, h('dt', { text: k }), h('dd', { text: val }));
    return h('details', { class: 'card tech', 'data-area': 'tech', 'data-key': 'tech' },
      h('summary', null, h('p', { class: 'card-title', text: 'Technical details' }),
        excluded.length || ctx.unreadable.length ? h('span', { class: 'meta' },
          excluded.length ? h('span', { 'data-excluded-count': excluded.length, text: plural(excluded.length, 'report kept out', 'reports kept out') }) : null,
          excluded.length && ctx.unreadable.length ? ' · ' : null,
          ctx.unreadable.length ? h('span', { 'data-unreadable-count': ctx.unreadable.length, text: plural(ctx.unreadable.length, 'record not read', 'records not read') }) : null) : null),
      h('div', { class: 'tech-body' },
        h('dl', { class: 'kvs' },
          row('Records', t.records.toLocaleString('en-US') + ' of ' + t.limit.toLocaleString('en-US')),
          row('Reports received', String(s.received || 0)),
          row('Reports accepted', String(s.valid || 0))),
        excluded.length ? h('div', null, h('p', { class: 'label', text: 'Kept out of the real state' }),
          h('ul', { class: 'tech-list', 'data-excluded': '' }, excluded.map(x => h('li', { 'data-excluded-id': x.id },
            h('span', { class: 'mono', text: x.id }),
            h('span', { class: 'meta', text: [REASON_LABEL[x.reason] || x.reason, x.writer ? 'writer ' + x.writer : null].filter(Boolean).join(' · ') }))))) : null,
        ctx.unreadable.length ? h('div', null, h('p', { class: 'label', text: 'Records the page could not read' }),
          h('ul', { class: 'tech-list', 'data-unreadable': '' }, ctx.unreadable.map(id => h('li', null, h('span', { class: 'mono', text: id }))))) : null,
        mismatches.length ? h('div', null, h('p', { class: 'label', text: 'Report slots with no report' }),
          h('ul', { class: 'tech-list', 'data-mismatch': '' }, mismatches.map(m => h('li', { 'data-mismatch-task': m.task },
            h('span', { class: 'mono', text: m.task }),
            h('span', { class: 'meta', text: 'slot ' + list(m.missing).join(', ') }))))) : null,
        list(t.routineNeedsYou).length ? h('div', null, h('p', { class: 'label', text: 'Routine questions agents asked' }),
          h('ul', { class: 'tech-list' }, t.routineNeedsYou.map(r => h('li', null,
            h('span', { text: r.text || r.id }),
            h('span', { class: 'meta', text: ctx.taskName(r.task) + (r.category ? ' · ' + r.category : '') }))))) : null));
  }

  function progressView(v, st, ctx) {
    return h('div', { class: 'progress-grid' },
      h('div', { class: 'side side-top' }, needsCard(v, ctx), obstacleCard(v, ctx)),
      planCard(v, ctx),
      activityCard(v, ctx),
      h('div', { class: 'side side-bottom' }, sinceCard(v, ctx), techCard(v, st, ctx)));
  }

  function directionView(v, ctx) {
    const d = v.direction;
    // Plan and sub-plan versions show even before a direction is recorded.
    const lists = [
      versionsList('dir', list(d && d.versions), x => 'Direction version ' + x.version),
      versionsList('plan', list(v.roadmap.versions), x => 'Plan version ' + x.version),
      versionsList('subplan', list(v.roadmap.subplanVersions), x => 'Sub-plan version ' + x.version + (x.phaseName ? ' for ' + x.phaseName : '')),
    ].filter(Boolean);
    const versions = lists.length ? h('section', { class: 'card versions', 'aria-label': 'Versions' },
      h('p', { class: 'card-title', text: 'Versions' }), lists) : null;
    if (!d) {
      const empty = h('section', { class: 'card direction' }, h('p', { class: 'card-title', text: 'Direction' }),
        h('p', { class: 'empty', text: 'No direction recorded yet' }));
      return versions ? h('div', { class: 'direction-grid' }, empty, h('div', { class: 'side' }, versions)) : empty;
    }
    const group = (title, items, render_) => items.length ? h('div', { class: 'dir-group' },
      h('p', { class: 'label', text: title }),
      h('ul', { class: 'dir-list' }, items.map(render_))) : null;
    const text = x => typeof x === 'string' ? x : (x && (x.text || x.question)) || '';
    // A decision the owner settled carries no status line; an open one says so in gray.
    const settled = x => !x.status || SETTLED.includes(x.status);
    const row = (key, x, cls, extra) => {
      const info = typeof x === 'object' && x ? infoControl(key, provenanceRows(x)) : null;
      const c = [cls, info ? 'has-info' : null].filter(Boolean).join(' ');
      return h('li', { class: c || null }, h('span', { text: text(x) }), extra || null, info);
    };
    return h('div', { class: 'direction-grid' },
      h('section', { class: 'card direction', 'aria-label': 'Direction' },
        h('p', { class: 'card-title', text: 'Direction' }),
        d.objective ? h('p', { class: 'objective', text: d.objective }) : null,
        group('Decided', d.decisions, (x, i) => row('dec:' + i, x, settled(x) ? null : 'is-open',
          settled(x) ? null : h('span', { class: 'meta', text: String(x.status) }))),
        group('Constraints', d.constraints, (x, i) => row('con:' + i, x)),
        group('Open questions', d.openQuestions, (x, i) => row('oq:' + i, x)),
        group('Ruled out', d.rejected, (x, i) => row('rej:' + i, x))),
      h('div', { class: 'side' },
        d.references.length ? h('section', { class: 'card refs', 'aria-label': 'References' },
          h('p', { class: 'card-title', text: 'References' }), evidenceGrid(d.references, ctx.seenSrc, 'ev-grid-2')) : null,
        versions));
  }

  function versionsList(kind, items, label) {
    if (!items.length) return null;
    return h('ul', { class: 'versions-list', 'data-versions': kind }, items.map(x => {
      const info = infoControl('ver:' + kind + ':' + (x.phase || '') + ':' + x.version, provenanceRows(x, [['Approved by', x.approvedBy]]));
      return h('li', { class: info ? 'has-info' : null },
        h('span', { text: label(x) + (x.current ? ', current' : '') }),
        h('span', { class: 'meta', text: [x.reason, x.approvedAt ? when(x.approvedAt) : null].filter(Boolean).join(' · ') }),
        info);
    }));
  }

  function historyView(v, ctx) {
    const all = v.history;
    const shown = all.slice(0, S.historyCount);
    return h('section', { class: 'card history', 'aria-label': 'History' },
      h('p', { class: 'card-title', text: 'History' }),
      all.length ? h('ol', { class: 'history-list' }, shown.map(e => h('li', { class: 'h-' + (e.type === 'event' ? e.kind : e.type) + (e.archived ? ' is-archived' : ''), 'data-history': e.id || null },
        h('time', { class: 'h-time', text: when(e.at) }),
        h('div', { class: 'h-main' },
          h('p', { class: 'h-title', text: historyTitle(e, ctx) }),
          e.text || e.reason ? h('p', { class: 'h-text', text: e.text || e.reason }) : null,
          e.archived ? h('p', { class: 'h-archived' },
            h('span', { class: 'meta', text: 'Archived' }),
            S.canEdit && S.db ? h('button', {
              type: 'button', class: 'restore', 'data-restore': e.archived.id, 'data-key': 'restore:' + e.archived.id,
              disabled: S.archiveBusy.has('restore:' + e.archived.id), text: 'Restore',
              onclick: () => writeArchive(e.archived, true),
            }) : null) : null,
          e.archived ? archiveError(e.archived, true) : null))))
        : h('p', { class: 'empty', text: 'Nothing has happened yet' }),
      all.length > shown.length ? h('button', {
        type: 'button', class: 'more', 'data-key': 'history-more',
        text: 'Show ' + Math.min(HISTORY_PAGE, all.length - shown.length) + ' more',
        onclick: () => { S.historyCount += HISTORY_PAGE; render(); },
      }) : null);
  }

  function connLabel(ctx) {
    if (S.mode === 'snapshot') return 'Saved copy from ' + when(S.fixedNow);
    if (S.conn === 'loading') return 'Loading';
    if (S.conn === 'live') return 'Connected';
    if (S.conn === 'saved') return 'Not connected, saved copy from ' + when(S.lastLiveAt || ctx.newestReport || Date.now());
    return 'Not connected';
  }

  function header(v, st, ctx) {
    const checks = S.docs.checks.slice().sort((a, b) => (ms(b.data && b.data.at) || 0) - (ms(a.data && a.data.at) || 0));
    const check = checks[0] && checks[0].data;
    const row = (k, val, attrs) => h('div', Object.assign({ class: 'kv' }, attrs || {}), h('dt', { text: k }), h('dd', { text: val }));
    const reportAge = ctx.newestReport != null ? 'Last report ' + ago(ctx.newestReport, ctx.now) : 'No agent has reported yet';
    return h('header', { class: 'top' },
      h('div', { class: 'top-row' },
        h('div', { class: 'top-titles' },
          h('h1', { class: 'project', text: v.header.project || 'Project dashboard' }),
          v.header.purpose ? h('p', { class: 'purpose', text: v.header.purpose }) : null),
        h('div', { class: 'top-status' },
          h('details', { class: 'conn', 'data-key': 'conn' },
            h('summary', null, h('span', { class: 'conn-dot', 'aria-hidden': 'true' }), h('span', { id: 'conn-label', class: 'conn-label', text: connLabel(ctx) })),
            h('div', { class: 'conn-body' },
              h('dl', { class: 'kvs' },
                S.mode === 'publish' && S.lastLiveAt ? row('Last update received', when(S.lastLiveAt)) : null,
                row('Last check', check ? [check.note || 'Check recorded', when(check.at)].filter(Boolean).join(', ') : 'No check recorded', { 'data-check': '' }),
                row('Plan version', v.header.planVersion != null ? String(v.header.planVersion) : 'none')))),
          h('p', { id: 'report-age', class: 'report-age', text: reportAge }))),
      h('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'Views' }, VIEWS.map(([id, label]) => h('button', {
        type: 'button', role: 'tab', id: 'tab-' + id, 'data-key': 'tab:' + id, 'aria-controls': 'view-' + id,
        'aria-selected': S.view === id ? 'true' : 'false', class: 'tab', text: label,
        onclick: () => setView(id, true),
      }))));
  }

  // ---------- render ----------
  function schedule() {
    if (S.pending) return;
    S.pending = true;
    Promise.resolve().then(() => { S.pending = false; render(); });
  }

  function render() {
    const app = document.getElementById('app');
    if (!app) return;
    let model;
    try { model = compute(); } catch (e) { model = null; if (root.console) console.error(e); }
    if (!model) {
      // Say so instead of keeping stale data under a Connected label.
      app.setAttribute('data-conn', 'unreadable');
      const label = document.getElementById('conn-label');
      if (label) label.textContent = 'Could not read the data';
      else app.replaceChildren(h('p', { class: 'empty', 'data-unreadable': '', text: 'Could not read the data' }));
      return;
    }
    const { now, st, v, unreadable } = model;
    S.tipSeq = 0;
    const tasks = new Map();
    for (const p of v.roadmap.phases) for (const t of phaseTasks(p)) tasks.set(t.id, t);
    for (const t of v.roadmap.outside) tasks.set(t.id, t);
    const phaseIdx = new Map(v.roadmap.phases.map((p, i) => [p.id, i]));
    let newestReport = null;
    for (const t of st.tasks) {
      const at = t.lastValid ? ms(t.lastValid.at) : NaN;
      if (!isNaN(at) && (newestReport == null || at > newestReport)) newestReport = at;
    }
    const ctx = {
      now, tasks, newestReport, unreadable,
      seenSrc: new Map(),
      blockers: new Map(list(v.blockers).map(b => [b.id, b])),
      obstacle: v.obstacle,
      obstacleText: v.obstacle && v.obstacle.text ? v.obstacle.text : null,
      taskName: id => (tasks.get(id) && tasks.get(id).name) || id,
      phaseName: id => { const i = phaseIdx.get(id); return i == null ? (id ? 'Outside the current plan' : null) : v.roadmap.phases[i].name; },
      phaseLabel: id => { const i = phaseIdx.get(id); return i == null ? 'Outside the current plan' : 'Phase ' + (i + 1) + ', ' + v.roadmap.phases[i].name; },
    };
    if (v.header.project) document.title = v.header.project;

    // Keep what the viewer changed: open disclosures, scroll, focus.
    const openState = new Map();
    app.querySelectorAll('details[data-key]').forEach(d => openState.set(d.getAttribute('data-key'), d.open));
    const scrollY = window.scrollY;
    const active = document.activeElement;
    const focusKey = active && app.contains(active) ? (active.closest('[data-key]') || active).getAttribute('data-key') : null;
    const focusSummary = !!(active && active.tagName === 'SUMMARY');

    const frag = document.createDocumentFragment();
    frag.append(
      header(v, st, ctx),
      h('main', { class: 'views' },
        h('section', { id: 'view-progress', class: 'view', role: 'tabpanel', 'aria-labelledby': 'tab-progress', hidden: S.view !== 'progress' }, progressView(v, st, ctx)),
        h('section', { id: 'view-direction', class: 'view', role: 'tabpanel', 'aria-labelledby': 'tab-direction', hidden: S.view !== 'direction' }, directionView(v, ctx)),
        h('section', { id: 'view-history', class: 'view', role: 'tabpanel', 'aria-labelledby': 'tab-history', hidden: S.view !== 'history' }, historyView(v, ctx))));
    frag.querySelectorAll('details[data-key]').forEach(d => {
      const k = d.getAttribute('data-key');
      if (openState.has(k)) d.open = openState.get(k);
    });
    app.setAttribute('data-conn', S.conn);
    app.setAttribute('data-mode', S.mode);
    app.replaceChildren(frag);
    fitTitles(app);
    if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
    if (focusKey) {
      const el = app.querySelector('[data-key="' + focusKey.replace(/"/g, '\\"') + '"]');
      const target = el && (focusSummary && el.tagName === 'DETAILS' ? el.querySelector('summary') : el);
      if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
    }
    if (S.conn === 'live' && !S.visitStored) {
      S.visitStored = true;
      storage(ls => ls.setItem(LAST_VISIT_KEY, String(Date.now())));
    }
  }

  function setView(id, push) {
    if (!VIEWS.some(([v]) => v === id)) id = 'progress';
    S.view = id;
    if (push) { try { if (location.hash !== '#' + id) location.hash = id; } catch (e) { /* frame may refuse */ } }
    const app = document.getElementById('app');
    if (!app) return;
    for (const [v] of VIEWS) {
      const panel = document.getElementById('view-' + v);
      const tab = document.getElementById('tab-' + v);
      if (panel) panel.hidden = v !== id;
      if (tab) tab.setAttribute('aria-selected', v === id ? 'true' : 'false');
    }
  }

  // ---------- boot ----------
  function boot() {
    document.documentElement.setAttribute('data-rung', '1');
    document.documentElement.setAttribute('data-look', 'quiet');
    const hash = (location.hash || '').replace(/^#/, '');
    if (VIEWS.some(([v]) => v === hash)) S.view = hash;
    window.addEventListener('hashchange', () => setView((location.hash || '').replace(/^#/, ''), false));

    const appEl = document.getElementById('app');
    if (appEl) wireInfo(appEl);
    const dataEl = document.getElementById('dashboard-data');
    if (dataEl) { loadSnapshot(dataEl); render(); return; }

    const prev = storage(ls => ls.getItem(LAST_VISIT_KEY));
    if (prev != null && !isNaN(Number(prev))) S.prevVisit = Number(prev);
    render();
    setTimeout(() => { S.timedOut = true; updateConn(); schedule(); }, LOAD_TIMEOUT_MS);
    setInterval(() => schedule(), TICK_MS);
    const c = window.claude;
    if (!c || typeof c.use !== 'function') { S.dbMissing = true; updateConn(); schedule(); return; }
    let p;
    try { p = c.use('db'); } catch (e) { p = Promise.resolve(null); }
    Promise.resolve(p).then(db => {
      if (!db) { S.dbMissing = true; updateConn(); schedule(); return; }
      S.db = db;
      subscribe(db);
    }, () => { S.dbMissing = true; updateConn(); schedule(); });
    // Archive controls show only to viewers who can edit (owner and editors).
    let u;
    try { u = c.use('user'); } catch (e) { u = Promise.resolve(null); }
    Promise.resolve(u).then(user => {
      if (!user) return;
      return Promise.all([
        Promise.resolve(user.canEdit()).catch(() => false),
        typeof user.id === 'function' ? Promise.resolve(user.id()).catch(() => null) : null,
      ]).then(([canEdit, id]) => { S.canEdit = canEdit === true; S.userId = id || null; schedule(); });
    }, () => {});
  }

  root.DashboardRender = { boot };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : this);
