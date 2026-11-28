// View model for the live project dashboard: fold state plus raw documents in,
// the sections the page shows out. Works as require() in Node and as
// window.DashboardView in a page.
//
// view(state, input, nowMs) -> {header, needsYou, activity, roadmap, direction, history, technical}
//
// Rules:
//  - Needs you holds only owner-category decisions that no later event closed.
//  - The plan and direction are read from their documents. A discovery, setback or
//    detour is shown beside the work; it never rewrites the plan.
//  - Evidence is not fenced by claim generation (setup may write it); the view
//    lists it under the task or phase it names.
//  - Order of events across tasks is for display only, never for state.
(function (root) {
  'use strict';

  const BUDGET = 25000;
  const OWNER_CATEGORIES = ['direction', 'scope', 'roadmap', 'creative', 'approval'];
  const SHOWN_EVIDENCE = ['approved', 'exploratory'];
  const MEANINGFUL = ['start', 'milestone', 'needs_you', 'answered', 'blocked', 'unblocked',
    'setback', 'recovered', 'detour', 'discovery', 'reopen', 'done', 'release'];
  const COLLECTIONS = ['meta', 'plans', 'pointers', 'direction', 'evidence', 'claims', 'events', 'checks', 'archive', 'subplans'];
  const ARCHIVE_KINDS = ['needs_you', 'blocker', 'setback', 'discovery'];

  function list(v) { return Array.isArray(v) ? v : []; }
  function ms(v) { if (v == null) return NaN; return typeof v === 'number' ? v : Date.parse(v); }
  function iso(v) { const t = ms(v); return isNaN(t) ? null : new Date(t).toISOString(); }
  function byId(docs, id) { return list(docs).find(d => d && d.id === id); }
  // Entries a hand-written doc may leave null or as a bare value are skipped, never read.
  function objs(v) { return list(v).filter(x => x && typeof x === 'object'); }
  function items(v) { return list(v).filter(x => x != null); }

  function currentVersioned(docs, pointerDocs, pointerId) {
    const ptr = byId(pointerDocs, pointerId);
    const k = ptr && ptr.data && ptr.data.version;
    let doc = k != null ? byId(docs, 'v' + k) || list(docs).find(d => d.data && d.data.version === k) : null;
    if (!doc) {
      doc = list(docs).reduce((best, d) => (!best || ((d.data && d.data.version) || 0) > best.data.version ? d : best), null);
    }
    return doc;
  }

  // A phase's sub-plan: `pointers/subplan-<phase>` names the version, doc `<phase>-v<k>`.
  // With no pointer (or a pointer to a missing doc) the newest version of that phase is used.
  function currentSubplan(docs, pointerDocs, phaseId) {
    const mine = list(docs).filter(d => d && d.data && d.data.phase === phaseId);
    if (!mine.length) return null;
    const ptr = byId(pointerDocs, 'subplan-' + phaseId);
    const k = ptr && ptr.data && ptr.data.version;
    let doc = k != null ? byId(mine, phaseId + '-v' + k) || mine.find(d => d.data.version === k) : null;
    if (!doc) doc = mine.reduce((best, d) => (!best || (d.data.version || 0) > (best.data.version || 0) ? d : best), null);
    return doc;
  }

  // One display status per task, used by activity rows and plan cards alike.
  // A lease running out wins over blocked or setback: the work is free to take over.
  function displayStatus(t, ownerWaiting) {
    if (t.state === 'done' || t.claimStatus === 'done') return 'finished';
    if (t.state === 'released' || t.claimStatus === 'released') return 'free to take over';
    // An open owner question wins over every later report and over the claim looking free.
    if (ownerWaiting) return 'waiting on you';
    if (t.freeToTake) return 'free to take over';
    if (t.state === 'blocked') return 'blocked';
    if (t.state === 'setback') return 'setback';
    if (t.state === 'reopened') return 'reopened';
    return 'working';
  }

  // The archive doc id for an item: `<kind>-<item id>`, cut to the db id charset.
  function archiveId(kind, item) {
    return (kind + '-' + String(item)).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 200);
  }

  function evidenceRecord(d) {
    return Object.assign({ id: d.id }, d.data);
  }

  function view(state, input, nowMs) {
    state = state || { tasks: [], excluded: [], mismatch: [], stats: {} };
    input = input || {};
    const evidenceDocs = list(input.evidence);
    const eventDocById = new Map(list(input.events).map(d => [d.id, d]));
    const planDoc = currentVersioned(input.plans, input.pointers, 'plan');
    const plan = planDoc ? planDoc.data : { version: null, phases: [] };
    const dirDoc = currentVersioned(input.direction, input.pointers, 'direction');
    const dir = dirDoc ? dirDoc.data : null;
    const metaDoc = byId(input.meta, 'project');
    const meta = (metaDoc && metaDoc.data) || {};
    // Archive is the owner's view choice: it hides an item from Progress and keeps it in
    // History. It never changes task state, ownership or completion.
    const archiveDocs = new Map(); // archive id -> body
    for (const d of list(input.archive)) {
      const a = (d && d.data) || {};
      if (d && d.id) archiveDocs.set(d.id, a);
      if (ARCHIVE_KINDS.includes(a.kind) && a.item != null) archiveDocs.set(archiveId(a.kind, a.item), a);
    }
    // A blocker or setback can recur under the same id. Its archive covers only the reports it
    // saw: `through` maps each task to the newest covered report's doc id (slot order within a
    // task). A newer report shows the item again. An archive with no `through` covers all.
    const itemReports = new Map(); // archive id -> [{task, n, id}] of blocked or setback reports
    for (const t of state.tasks) {
      for (const e of t.log) {
        let key = null;
        if (e.kind === 'blocked') key = archiveId('blocker', e.blocker_id != null ? e.blocker_id : e.id);
        else if (e.kind === 'setback') key = archiveId('setback', e.setback_id != null ? e.setback_id : e.id);
        if (!key) continue;
        if (!itemReports.has(key)) itemReports.set(key, []);
        itemReports.get(key).push({ task: t.id, n: e.n, id: e.id });
      }
    }
    const slotN = id => { const m = /-n(\d+)$/.exec(String(id)); return m ? Number(m[1]) : NaN; };
    const covers = (a, task, n) => {
      if (!a.through || typeof a.through !== 'object') return true;
      const c = a.through[task];
      if (c == null) return false;
      const cn = typeof c === 'number' ? c : slotN(c);
      return !isNaN(cn) && n <= cn;
    };
    const recurs = kind => kind === 'blocker' || kind === 'setback';
    const isArchived = (kind, item) => {
      const id = archiveId(kind, item);
      const a = archiveDocs.get(id);
      if (!a) return false;
      return !recurs(kind) || (itemReports.get(id) || []).every(r => covers(a, r.task, r.n));
    };
    const coversReport = (kind, item, task, n) => {
      const a = archiveDocs.get(archiveId(kind, item));
      return !!a && (!recurs(kind) || covers(a, task, n));
    };
    const archiveRef = (kind, item) => {
      const ref = { kind, item, id: archiveId(kind, item) };
      if (recurs(kind)) {
        ref.through = {};
        for (const r of itemReports.get(ref.id) || []) {
          if (ref.through[r.task] == null || r.n > slotN(ref.through[r.task])) ref.through[r.task] = r.id;
        }
      }
      return ref;
    };

    // Per-task detail.
    const taskView = new Map();
    const needsYou = [];
    const routineNeeds = [];
    const setbackMap = new Map(); // setback id -> setback
    const blockerMap = new Map(); // blocker id -> one blocker for the whole project
    const firstBlocked = new Set(); // event ids that are a blocker's first report
    const seenBlocker = new Set();
    for (const t of state.tasks) {
      let open = null;
      let reopened = null;
      const myBlockers = [];
      const discoveries = [];
      for (const e of t.log) {
        if (e.kind === 'needs_you') {
          const cat = e.decision && e.decision.category;
          if (OWNER_CATEGORIES.includes(cat)) open = e;
          else routineNeeds.push({ task: t.id, id: e.id, category: cat == null ? null : cat, text: e.text || null });
        } else if (e.kind === 'answered' || e.kind === 'done' || e.kind === 'release') open = null;
        if (e.kind === 'reopen') reopened = { reason: e.text || null, at: e.at, n: e.n };
        if (e.kind === 'blocked') {
          const bid = e.blocker_id != null ? e.blocker_id : e.id;
          if (!seenBlocker.has(bid)) { seenBlocker.add(bid); firstBlocked.add(e.id); }
          let b = blockerMap.get(bid);
          if (!b) { b = { id: bid, text: e.text || null, since: e.at, latest: e.at, affects: [] }; blockerMap.set(bid, b); }
          if (ms(e.at) > ms(b.latest)) b.latest = e.at;
          if (!b.affects.includes(t.id)) b.affects.push(t.id);
          if (!myBlockers.includes(bid)) myBlockers.push(bid);
        }
        if (e.kind === 'unblocked' && e.blocker_id != null) {
          const b = blockerMap.get(e.blocker_id);
          if (b) { b.affects = b.affects.filter(x => x !== t.id); if (!b.affects.length) blockerMap.delete(e.blocker_id); }
          const i = myBlockers.indexOf(e.blocker_id);
          if (i >= 0) myBlockers.splice(i, 1);
        }
        // A finished or released task no longer holds any problem open: it leaves every
        // blocker's and setback's affected list, and a blocker with none left leaves the page.
        if (e.kind === 'done' || e.kind === 'release') {
          for (const bid of myBlockers.splice(0)) {
            const b = blockerMap.get(bid);
            if (b) { b.affects = b.affects.filter(x => x !== t.id); if (!b.affects.length) blockerMap.delete(bid); }
          }
          for (const sb of setbackMap.values()) sb.affects = sb.affects.filter(x => x !== t.id);
        }
        if (e.kind === 'discovery') discoveries.push({ id: e.id, text: e.text || null, at: e.at });
        if (e.kind === 'setback') {
          const id = e.setback_id != null ? e.setback_id : e.id;
          if (!setbackMap.has(id)) setbackMap.set(id, { id, text: e.text || null, cause: e.cause || null, affects: [], phase: e.phase || t.phase, detourTasks: [], resolved: false });
          const sb = setbackMap.get(id);
          if (!sb.affects.includes(t.id)) sb.affects.push(t.id);
        }
      }
      // An owner question stays open until `answered`, `done` or `release`; a later progress
      // report does not close it. Archive hides it from Needs you but leaves the task waiting.
      const ownerWaiting = !!open;
      if (ownerWaiting && !isArchived('needs_you', open.id)) {
        const d = open.decision || {};
        needsYou.push({
          id: open.id, archive: archiveRef('needs_you', open.id), task: t.id, taskName: t.name, phase: t.phase, writer: open.writer, at: open.at,
          question: d.question || open.text || null, holdsUp: d.holds_up == null ? null : d.holds_up,
          options: list(d.options), category: d.category,
        });
      }
      const mine = evidenceDocs.filter(d => d.data && d.data.task === t.id).map(evidenceRecord);
      taskView.set(t.id, {
        id: t.id, name: t.name, phase: t.phase, chunk: t.chunk == null ? null : t.chunk, kind: t.kind, owner: t.owner, state: t.state,
        status: displayStatus(t, ownerWaiting), freeToTake: t.freeToTake, leaseUntil: t.leaseUntil,
        milestonesDone: t.milestonesDone.slice(),
        last: t.lastValid ? { text: t.lastValid.text || null, at: t.lastValid.at } : null,
        reopened: t.state === 'reopened' ? reopened : null,
        blockers: myBlockers.filter(id => blockerMap.has(id) && !isArchived('blocker', id)),
        discoveries: discoveries.filter(x => !isArchived('discovery', x.id)).map(x => Object.assign(x, { archive: archiveRef('discovery', x.id) })),
        evidence: mine.filter(r => SHOWN_EVIDENCE.includes(r.status)),
        otherEvidence: mine.filter(r => !SHOWN_EVIDENCE.includes(r.status)),
      });
    }
    // Detours and recoveries link by setback_id.
    for (const t of state.tasks) {
      for (const e of t.log) {
        if (e.setback_id == null) continue;
        const sb = setbackMap.get(e.setback_id);
        if (!sb) continue;
        if (e.kind === 'detour' && !sb.detourTasks.includes(t.id)) sb.detourTasks.push(t.id);
        if (e.kind === 'recovered') sb.resolved = true;
      }
    }
    // A setback whose affected tasks have all finished or been released is over.
    for (const sb of setbackMap.values()) if (!sb.affects.length) sb.resolved = true;
    const setbackOut = sb => ({
      id: sb.id, archive: archiveRef('setback', sb.id), text: sb.text, cause: sb.cause, resolved: sb.resolved,
      affects: sb.affects.map(id => ({ id, name: taskView.get(id).name })),
      detours: sb.detourTasks.map(id => taskView.get(id)),
    });

    // Roadmap.
    const planPhases = objs(plan.phases);
    const phaseIds = new Set(planPhases.map(p => p.id));
    const doneMilestones = new Set();
    for (const tv of taskView.values()) for (const m of tv.milestonesDone) doneMilestones.add(m);
    let currentFound = false;
    const subplanDocs = new Map(); // phase id -> current sub-plan doc
    const phases = planPhases.map(p => {
      const allWork = Array.from(taskView.values()).filter(t => t.phase === p.id);
      const milestones = objs(p.milestones).map(m => ({ id: m.id, name: m.name, done: doneMilestones.has(m.id) }));
      // A phase is done by its own rule: all its work finished and its milestones done. A
      // sub-plan never changes that, so adding one cannot reopen finished work.
      const done = allWork.length > 0 && allWork.every(t => t.state === 'done') && milestones.every(m => m.done);
      let status = 'planned';
      if (done) status = 'done';
      else if (!currentFound) { status = 'current'; currentFound = true; }
      // A sub-plan groups the phase's work by chunk. Work with no chunk, or a chunk the sub-plan
      // does not name, stays under the phase. Chunk status follows the phase:
      //  - done phase: every chunk is done;
      //  - current phase: a chunk is done when its work is all finished and its milestones are
      //    done (a chunk with milestones but no work: when its milestones are done); the first
      //    chunk not done is current, the only "Now" on the page;
      //  - planned phase: no chunk is current; each reads not started or parallel work.
      const spDoc = currentSubplan(input.subplans, input.pointers, p.id);
      let subplan = null;
      let work = allWork;
      if (spDoc) {
        subplanDocs.set(p.id, spDoc);
        const defs = list(spDoc.data.chunks).filter(c => c && c.id != null);
        const ids = new Set(defs.map(c => c.id));
        let chunkFound = false;
        const chunks = defs.map(c => {
          const cw = allWork.filter(t => t.chunk === c.id);
          const cms = list(c.milestones).map(m => {
            const id = typeof m === 'string' ? m : m && m.id;
            const def = objs(p.milestones).find(x => x.id === id);
            return { id, name: (m && m.name) || (def && def.name) || id, done: doneMilestones.has(id) };
          });
          const ownDone = cw.length > 0 ? cw.every(t => t.state === 'done') && cms.every(m => m.done)
            : cms.length > 0 && cms.every(m => m.done);
          let cs = 'planned';
          if (status === 'done') cs = 'done';
          else if (status === 'current') {
            if (ownDone) cs = 'done';
            else if (!chunkFound) { cs = 'current'; chunkFound = true; }
          }
          return { id: c.id, name: c.name || c.id, outcome: c.outcome || null, status: cs, work: cw, milestones: cms };
        });
        subplan = { version: spDoc.data.version, chunks };
        work = allWork.filter(t => !ids.has(t.chunk));
      }
      return {
        id: p.id, name: p.name, status, outcome: p.outcome || null, milestones, work, subplan,
        setbacks: Array.from(setbackMap.values()).filter(sb => sb.phase === p.id && !isArchived('setback', sb.id)).map(setbackOut),
        evidence: evidenceDocs.filter(d => d.data && d.data.phase === p.id && SHOWN_EVIDENCE.includes(d.data.status)).map(evidenceRecord),
      };
    });
    const outside = Array.from(taskView.values()).filter(t => !phaseIds.has(t.phase));
    const phaseOrder = new Map(planPhases.map((p, i) => [p.id, i]));
    const subplanVersions = list(input.subplans).filter(d => d && d.data && d.data.phase != null).map(d => {
      const ph = planPhases.find(p => p.id === d.data.phase);
      const cur = subplanDocs.get(d.data.phase) || currentSubplan(input.subplans, input.pointers, d.data.phase);
      return {
        phase: d.data.phase, phaseName: (ph && ph.name) || null, version: d.data.version,
        reason: d.data.reason || null, approvedAt: d.data.approved_at || null,
        approvedBy: d.data.approved_by || null, source: d.data.source || null,
        current: !!cur && d.id === cur.id,
      };
    }).sort((a, b) => ((phaseOrder.has(a.phase) ? phaseOrder.get(a.phase) : 1e9) - (phaseOrder.has(b.phase) ? phaseOrder.get(b.phase) : 1e9)) || (b.version - a.version));
    const outsideSetbacks = Array.from(setbackMap.values()).filter(sb => !phaseIds.has(sb.phase) && !isArchived('setback', sb.id)).map(setbackOut);
    const planVersions = list(input.plans).map(d => ({
      version: d.data.version, reason: d.data.reason || null, approvedAt: d.data.approved_at || null,
      approvedBy: d.data.approved_by || null, source: d.data.source || null,
      current: !!planDoc && d.id === planDoc.id,
    })).sort((a, b) => b.version - a.version);

    // Activity: counts and rows read the same per-task status the plan shows.
    const counts = { working: 0, waiting: 0, blocked: 0, finished: 0, freeToTake: 0 };
    const COUNT_OF = { working: 'working', 'waiting on you': 'waiting', blocked: 'blocked', setback: 'blocked', reopened: 'working', finished: 'finished', 'free to take over': 'freeToTake' };
    const agents = [];
    for (const t of state.tasks) {
      const tv = taskView.get(t.id);
      counts[COUNT_OF[tv.status]]++;
      agents.push({ writer: t.owner, task: t.id, phase: t.phase, status: tv.status, last: tv.last });
    }

    // Direction.
    const dirVersions = list(input.direction).map(d => ({
      version: d.data.version, reason: d.data.reason || null, approvedAt: d.data.approved_at || null,
      approvedBy: d.data.approved_by || null, source: d.data.source || null,
      current: !!dirDoc && d.id === dirDoc.id,
    })).sort((a, b) => b.version - a.version);
    const direction = dir ? {
      version: dir.version, objective: dir.objective || null, decisions: items(dir.decisions),
      constraints: items(dir.constraints), rejected: items(dir.rejected), openQuestions: items(dir.open_questions),
      references: list(dir.references).map(id => byId(evidenceDocs, id)).filter(d => d && d.data.status === 'approved').map(evidenceRecord),
      versions: dirVersions,
    } : null;

    // History.
    const events = [];
    for (const t of state.tasks) {
      let bound = Infinity;
      for (const e of t.log.slice().sort((a, b) => b.n - a.n)) {
        if (!MEANINGFUL.includes(e.kind)) continue;
        if (e.kind === 'blocked' && !firstBlocked.has(e.id) && e.blocker_id != null) continue;
        const doc = eventDocById.get(e.id);
        let at = doc ? ms(doc.updatedAt) : NaN;
        if (isNaN(at)) at = ms(e.at);
        if (isNaN(at)) at = 0;
        bound = Math.min(bound, at);
        let ref = null;
        if (e.kind === 'needs_you') ref = archiveRef('needs_you', e.id);
        else if (e.kind === 'blocked') ref = archiveRef('blocker', e.blocker_id != null ? e.blocker_id : e.id);
        else if (e.kind === 'setback') ref = archiveRef('setback', e.setback_id != null ? e.setback_id : e.id);
        else if (e.kind === 'discovery') ref = archiveRef('discovery', e.id);
        const archived = ref && coversReport(ref.kind, ref.item, t.id, e.n) ? ref : null;
        events.push({ type: 'event', id: e.id, kind: e.kind, task: t.id, taskName: t.name, n: e.n, at: e.at, text: e.text || null, reason: e.kind === 'reopen' ? e.text || null : null, archived, key: bound });
      }
    }
    const revisions = [];
    for (const v of planVersions) revisions.push({ type: 'plan', version: v.version, at: v.approvedAt, reason: v.reason, current: v.current, key: ms(v.approvedAt) || 0 });
    for (const v of subplanVersions) revisions.push({ type: 'subplan', phase: v.phase, phaseName: v.phaseName, version: v.version, at: v.approvedAt, reason: v.reason, current: v.current, key: ms(v.approvedAt) || 0 });
    for (const v of dirVersions) revisions.push({ type: 'direction', version: v.version, at: v.approvedAt, reason: v.reason, current: v.current, key: ms(v.approvedAt) || 0 });
    const history = events.concat(revisions).sort((a, b) => (b.key - a.key) || (a.task && a.task === b.task ? b.n - a.n : 0))
      .map(h => { const o = Object.assign({}, h); delete o.key; return o; });

    // Technical details.
    let records = 0;
    for (const c of COLLECTIONS) records += list(input[c]).length;
    const blockers = Array.from(blockerMap.values()).filter(b => !isArchived('blocker', b.id))
      .map(b => ({ id: b.id, archive: archiveRef('blocker', b.id), text: b.text, since: b.since, affects: b.affects.slice(), latest: b.latest }));
    const obstacle = blockers.slice().sort((a, b) => ms(b.latest) - ms(a.latest))[0] || null;
    blockers.forEach(b => { delete b.latest; });
    const technical = {
      excluded: state.excluded.map(x => ({ id: x.event.id, reason: x.reason, task: x.event.task || null, kind: x.event.kind || null, writer: x.event.writer || null })),
      mismatches: state.mismatch.slice(),
      routineNeedsYou: routineNeeds,
      records, budget: records / BUDGET, limit: BUDGET,
      stats: state.stats,
    };

    return {
      header: {
        project: meta.project || null, purpose: meta.purpose || null,
        planVersion: plan.version, directionVersion: dir ? dir.version : null, now: iso(nowMs),
      },
      needsYou, blockers, obstacle: obstacle ? { id: obstacle.id, archive: obstacle.archive, text: obstacle.text, since: obstacle.since, affects: obstacle.affects } : null, activity: { counts, agents },
      roadmap: { phases, outside, outsideSetbacks, versions: planVersions, subplanVersions },
      direction, history, technical,
    };
  }

  const api = { view, archiveId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DashboardView = api;
})(typeof window !== 'undefined' ? window : this);
