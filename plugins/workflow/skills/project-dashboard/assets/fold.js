// Event fold for the live project dashboard: documents in, task state out.
// Works as require() in Node and as window.DashboardFold in a page.
//
// Input: { plans, pointers, direction, evidence, claims, events }, each an array of
// docs { id, data, version?, updatedAt?, seenAt? }. Output: see fold() below.
//
// Rules:
//  - An event is accepted only when its claim generation covers it (valid()).
//  - Order inside a task is the slot number n. The writer's clock (`at`) is never
//    used to order anything, so a wrong clock cannot reverse completion.
//  - A lease running out is "free to take over", never a failure.
(function (root) {
  'use strict';

  const KIND_MAX_MIN = { quick: 15, research: 45, long: 120 };
  const MIN = 60000;
  const STATE_BY_KIND = {
    start: 'active', progress: 'active', milestone: 'active', discovery: 'active',
    detour: 'active', handover: 'active', answered: 'active', unblocked: 'active',
    recovered: 'active', needs_you: 'waiting', blocked: 'blocked', setback: 'setback',
    reopen: 'reopened', done: 'done', release: 'released',
  };
  const CLOSING = { done: true, release: true };
  const ID_RE = /^(.+)-g(\d+)-n(\d+)$/;

  function toMs(v) {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    return Date.parse(v);
  }

  function asList(v) { return Array.isArray(v) ? v : []; }

  // Effective lease end (ms) and whether a held claim is free to take.
  function leaseOf(doc, nowMs) {
    const c = doc.data;
    const kind = c.kind;
    if (c.status !== 'held') return { leaseMs: null, free: false };
    if (kind === 'waiting') return { leaseMs: null, free: true };
    const max = (KIND_MAX_MIN[kind] || KIND_MAX_MIN.quick) * MIN;
    let base = toMs(doc.updatedAt);
    if (isNaN(base)) base = toMs(doc.seenAt);
    if (isNaN(base)) base = nowMs;
    let eff = base + max;
    const lease = toMs(c.lease_until);
    if (!isNaN(lease)) eff = Math.min(lease, eff);
    return { leaseMs: eff, free: nowMs > eff + max };
  }

  function fold(input, nowMs) {
    input = input || {};
    const claimDocs = asList(input.claims);
    const eventDocs = asList(input.events);
    const evidenceDocs = asList(input.evidence);
    const records = ['plans', 'pointers', 'direction', 'evidence', 'claims', 'events']
      .reduce((n, k) => n + asList(input[k]).length, 0);

    const claims = new Map();
    for (const d of claimDocs) claims.set((d.data && d.data.task) || d.id, d);

    const excluded = [];
    const filled = new Map(); // task -> slots that hold any event doc, valid or excluded
    const exclude = (doc, reason) => excluded.push({ event: Object.assign({ id: doc.id }, doc.data), reason });

    // Pass 1: slot, body, generation, writer.
    const candidates = new Map(); // task -> [{doc, n, gen}]
    for (const doc of eventDocs) {
      const e = doc.data || {};
      const m = ID_RE.exec(String(doc.id));
      if (!m) { exclude(doc, 'malformed'); continue; }
      const task = m[1], gen = Number(m[2]), n = Number(m[3]);
      // Canonical digits only (no leading zeros), so one slot has one doc id.
      if (String(gen) !== m[2] || String(n) !== m[3]) { exclude(doc, 'malformed'); continue; }
      if (!filled.has(task)) filled.set(task, new Set());
      filled.get(task).add(n);
      if (e.task !== task || typeof e.gen !== 'number' || typeof e.n !== 'number' || e.gen !== gen || e.n !== n) { exclude(doc, 'malformed'); continue; }
      const claimDoc = claims.get(task);
      if (!claimDoc) { exclude(doc, 'unknown_generation'); continue; }
      const c = claimDoc.data;
      const live = gen === c.gen;
      const G = live
        ? { owner: c.owner, start: c.start || 0, end: c.counter || 0 }
        : asList(c.gens).find(g => g.gen === gen);
      if (!G) { exclude(doc, 'unknown_generation'); continue; }
      let reason = null;
      if (n > G.end) reason = live ? 'unreserved' : 'stale_generation';
      if (!reason && n <= (G.start || 0)) reason = 'stale_generation';
      if (!reason && G.owner !== e.writer) reason = 'wrong_writer';
      if (reason) { exclude(doc, reason); continue; }
      if (!candidates.has(task)) candidates.set(task, []);
      candidates.get(task).push({ doc, n, gen });
    }

    // Pass 2: per task, in slot order: close rule, then duplicate reports.
    let duplicates = 0, valid = 0;
    const accepted = new Map(); // task -> [event]
    for (const [task, list] of candidates) {
      list.sort((a, b) => a.n - b.n);
      const closedAt = new Map(); // gen -> n of its done/release
      const seenRid = new Set();
      const out = [];
      for (const { doc, n, gen } of list) {
        const e = doc.data;
        if (closedAt.has(gen)) { exclude(doc, 'after_close'); continue; }
        if (e.rid != null && seenRid.has(e.rid)) { duplicates++; exclude(doc, 'duplicate'); continue; }
        if (e.rid != null) seenRid.add(e.rid);
        if (CLOSING[e.kind]) closedAt.set(gen, n);
        out.push(Object.assign({ id: doc.id }, e));
        valid++;
      }
      accepted.set(task, out);
    }

    // Build tasks and checkpoint mismatches.
    const tasks = [];
    const mismatch = [];
    for (const [task, doc] of claims) {
      const c = doc.data;
      const log = accepted.get(task) || [];
      let state = 'active';
      const milestonesDone = [];
      const evidence = [];
      let name = c.name;
      for (const e of log) {
        if (STATE_BY_KIND[e.kind]) state = STATE_BY_KIND[e.kind];
        if (e.kind === 'milestone' && e.milestone != null && !milestonesDone.includes(e.milestone)) milestonesDone.push(e.milestone);
        for (const ev of [].concat(e.evidence == null ? [] : e.evidence)) if (!evidence.includes(ev)) evidence.push(ev);
        if (!name && e.name) name = e.name;
      }
      if (!log.length) {
        if (c.status === 'done') state = 'done';
        else if (c.status === 'released') state = 'released';
        else if (c.kind === 'waiting') state = 'waiting';
      }
      for (const d of evidenceDocs) {
        if (d.data && d.data.task === task && !evidence.includes(d.id)) evidence.push(d.id);
      }
      const lease = leaseOf(doc, nowMs);
      tasks.push({
        id: task, phase: c.phase, chunk: c.chunk == null ? null : c.chunk, name: name || task, kind: c.kind, owner: c.owner, gen: c.gen,
        state, claimStatus: c.status,
        leaseUntil: lease.leaseMs == null ? null : new Date(lease.leaseMs).toISOString(),
        freeToTake: lease.free,
        lastValid: log.length ? log[log.length - 1] : null,
        log, milestonesDone, evidence,
      });
      const have = filled.get(task) || new Set();
      const missing = [];
      for (let n = 1; n <= (c.counter || 0); n++) if (!have.has(n)) missing.push(n);
      if (missing.length) mismatch.push({ task, missing });
    }

    return {
      tasks, excluded, mismatch,
      stats: { received: eventDocs.length, valid, excluded: excluded.length, duplicates, records },
    };
  }

  const api = { fold, leaseOf, KIND_MAX_MIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DashboardFold = api;
})(typeof window !== 'undefined' ? window : this);
