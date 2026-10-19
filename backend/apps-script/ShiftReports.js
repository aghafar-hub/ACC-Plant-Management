/**
 * Shift reports (plant system, backend 2.1.0; docs/plant-system/02-shift-workflow-and-roles.md).
 *
 * One report per date x shift x area. The shift leader enters the stoppages (Draft), submits (Submitted); the
 * production manager approves (Production approved) or returns it to the shift leader (Returned); the reliability
 * engineer validates (Validated) or returns it to the production manager (Submitted again). Validated stoppages that
 * are closed become downtime events (origin shift); when all its stoppages are posted the report is Posted.
 *
 * A stop that lasts beyond its shift stays open (no restart time). A later shift of the area enters the restart time
 * (closeShiftStoppage); that change belongs to the later shift's report, so it passes the same two reviews before the
 * stoppage is posted.
 *
 * Who may act is decided by the person's responsibilities for the area on the report date (Responsibilities.js):
 * shift_entry, production_review, reliability_validation. The Admin role may do every step (for set-up and tests);
 * otherwise the person who entered or submitted a report may not approve it.
 */

var SHIFT_STATUSES = ['draft', 'submitted', 'returned', 'prod_approved', 'validated', 'posted'];
var SHIFT_STOP_FIELDS = ['code_raw', 'stop_ts', 'start_ts', 'classification', 'is_failure', 'reason_raw', 'description'];
var SHIFT_LIST_MAX_DAYS = 62;
var SHIFT_MAX_STOPPAGES = 200;
var SHIFT_COMMENT_MIN = 3;

function shiftDefs_() {
  var rows = readTable_(T.SHIFTS).filter(function (s) { return toBool_(s.active); });
  if (!rows.length) rows = (SCHEMA.seeds.shifts || []).slice();
  return rows.sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
}

function addDays_(day, n) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  function p(x) { return (x < 10 ? '0' : '') + x; }
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

/** Start and end ('YYYY-MM-DD HH:MM:SS.000') of a shift on a report date; a shift that ends at or before it starts ends the next day. */
function shiftWindow_(def, day) {
  var start = day + ' ' + def.start_time + ':00.000';
  var endDay = def.end_time <= def.start_time ? addDays_(day, 1) : day;
  return { start: start, end: endDay + ' ' + def.end_time + ':00.000' };
}

function shiftDefOrThrow_(shiftId) {
  var def = shiftDefs_().filter(function (s) { return s.shift_id === shiftId; })[0];
  if (!def) throw apiError_(ERR.BAD_REQUEST, 'There is no shift ' + String(shiftId).slice(0, 20) + '.');
  return def;
}

function reportIdOf_(day, shiftId, areaId) { return 'SR-' + day.replace(/-/g, '') + '-' + shiftId + '-' + areaId; }

/** Does the person hold `duty` for `area` on `day`? The Admin role always may. */
function hasDuty_(session, duty, area, day) {
  if (isAdmin_(session)) return true;
  return readTable_(T.RESPONSIBILITIES).some(function (r) {
    return r.user_id === session.user.user_id && toBool_(r.active) && r.duty === duty &&
      (!r.valid_from || r.valid_from <= day) && (!r.valid_to || day <= r.valid_to) &&
      (r.scope_type === 'plant' || (r.scope_type === 'line' && r.scope_id === area.line_id) || (r.scope_type === 'area' && r.scope_id === area.area_id));
  });
}

var DUTY_TEXT_ = { shift_entry: 'Shift report entry', production_review: 'Production review', reliability_validation: 'Reliability validation' };

function requireDuty_(session, duty, area, day) {
  if (!hasDuty_(session, duty, area, day)) {
    throw apiError_(ERR.FORBIDDEN, 'You do not hold the duty "' + DUTY_TEXT_[duty] + '" for ' + area.area_id + ' on ' + day +
      '. An Admin can add it in Settings > Users > Responsibilities.');
  }
}

function shiftReportOut_(r) {
  var out = {};
  tableDef_(T.SHIFT_REPORTS).columns.forEach(function (c) { out[c.name] = r[c.name] === undefined || r[c.name] === null ? '' : r[c.name]; });
  return out;
}

function shiftStopOut_(s) {
  var out = {};
  tableDef_(T.SHIFT_STOPPAGES).columns.forEach(function (c) { out[c.name] = s[c.name] === undefined || s[c.name] === null ? '' : s[c.name]; });
  out.is_failure = toBool_(s.is_failure);
  out.duration_s = s.duration_s === '' || s.duration_s === null || s.duration_s === undefined ? null : Number(s.duration_s);
  return out;
}

// ---------- reads ----------

/** Reports with a date in [from, to], their stoppages, every open stoppage, and the stoppages those reports closed. */
function listShiftReports_(from, to) {
  if (!isValidDate_(from) || !isValidDate_(to) || to < from) throw apiError_(ERR.BAD_REQUEST, 'Choose a valid date range.');
  if ((parseTs_(to + ' 00:00:00') - parseTs_(from + ' 00:00:00')) / 86400000 > SHIFT_LIST_MAX_DAYS) {
    throw apiError_(ERR.BAD_REQUEST, 'Choose at most ' + SHIFT_LIST_MAX_DAYS + ' days.');
  }
  var reports = readTable_(T.SHIFT_REPORTS).filter(function (r) { return r.report_date >= from && r.report_date <= to; });
  var ids = {};
  reports.forEach(function (r) { ids[r.report_id] = true; });
  var stops = readTable_(T.SHIFT_STOPPAGES).filter(function (s) {
    return s.row_state === 'active' && (ids[s.report_id] || ids[s.closed_report_id] || s.stop_state === 'open');
  });
  // the reports of open stoppages from before the range, so the screen can name them
  var extra = {};
  stops.forEach(function (s) { if (!ids[s.report_id]) extra[s.report_id] = true; });
  if (Object.keys(extra).length) {
    readTable_(T.SHIFT_REPORTS).forEach(function (r) { if (extra[r.report_id]) reports.push(r); });
  }
  return { shifts: shiftDefs_().map(function (s) { return { shift_id: s.shift_id, name: s.name, start_time: s.start_time, end_time: s.end_time, sort_order: s.sort_order }; }),
    reports: reports.map(shiftReportOut_), stoppages: stops.map(shiftStopOut_) };
}

function getShiftReportHistory_(reportId) {
  var id = cleanText_(reportId, 'Report', true, 80);
  if (!findBy_(T.SHIFT_REPORTS, 'report_id', id)) throw apiError_(ERR.NOT_FOUND, 'That shift report was not found.');
  var log = readTable_(T.WORKFLOW_LOG).filter(function (l) { return l.report_id === id; }).map(function (l) {
    return { log_id: l.log_id, action: l.action, from_status: l.from_status || '', to_status: l.to_status || '', stage: l.stage || '', by_user: l.by_user, at: l.at, comment: l.comment || '' };
  });
  var edits = readTable_(T.SHIFT_STOPPAGE_EDITS).filter(function (e) { return e.report_id === id; }).map(function (e) {
    return { edit_id: e.edit_id, stop_id: e.stop_id, stage: e.stage, field: e.field, old_value: e.old_value === undefined ? '' : String(e.old_value),
      new_value: e.new_value === undefined ? '' : String(e.new_value), comment: e.comment || '', edited_by: e.edited_by, edited_at: e.edited_at };
  });
  return { log: log, edits: edits };
}

// ---------- one stoppage: input -> stored fields ----------

function shiftTs_(v, label) {
  if (v === null || v === undefined || v === '') return '';
  var s = typeof v === 'string' ? v.trim().replace('T', ' ') : '';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) s += ':00';
  var n = normTs_(s);
  if (!n) throw apiError_(ERR.BAD_REQUEST, label + ' must be a date and time like 2026-10-20 14:30.');
  return n;
}

/**
 * Cleans one stoppage of `area` and works out the derived fields with the same rules as an uploaded event
 * (normalizeEvent_): equipment, reason, criticality from the classification, and the data-check flags.
 */
function cleanStoppage_(ctx, area, s, win, opts) {
  requireObject_(s, 'A stoppage');
  var stop = shiftTs_(s.stop_ts, 'Stop time');
  if (!stop) throw apiError_(ERR.BAD_REQUEST, 'Every stoppage needs its stop time.');
  if (opts.checkWindow && (stop < win.start || stop >= win.end)) {
    throw apiError_(ERR.BAD_REQUEST, 'Stop time ' + stop.slice(0, 16) + ' is outside this shift (' + win.start.slice(0, 16) + ' to ' + win.end.slice(0, 16) + '). Enter it in the report of the shift it started in.');
  }
  var start = shiftTs_(s.start_ts, 'Restart time');
  if (start && opts.checkWindow && start > win.end) {
    throw apiError_(ERR.BAD_REQUEST, 'Restart time ' + start.slice(0, 16) + ' is after this shift ends. Leave it blank: the shift that sees the restart enters it.');
  }
  if (start && start > nowTs_()) throw apiError_(ERR.BAD_REQUEST, 'Restart time ' + start.slice(0, 16) + ' is in the future.');
  if (stop > nowTs_()) throw apiError_(ERR.BAD_REQUEST, 'Stop time ' + stop.slice(0, 16) + ' is in the future.');
  var cls = typeof s.classification === 'string' ? s.classification.trim().toUpperCase() : '';
  var klass = ctx.classes[cls];
  var incident = klass ? toBool_(klass.is_incident) : false;
  var failure = s.is_failure === true && !!klass && incident;
  var norm = normalizeEvent_(ctx, {
    event_date: stop.slice(0, 10), line_id: area.line_id, area_id: area.area_id, code_raw: s.code_raw === undefined || s.code_raw === null ? '' : s.code_raw,
    stop_ts: stop, start_ts: start || stop, freq: 1, classification: cls, criticality: incident ? 'INC' : 'NO_INC',
    is_failure: failure, reason_raw: s.reason_raw, description: s.description
  });
  if (norm.error) throw apiError_(ERR.BAD_REQUEST, norm.error);
  var rec = norm.rec;
  return {
    area_id: area.area_id, line_id: area.line_id, code_raw: rec.code_raw, equipment_id: rec.equipment_id, stop_ts: stop, start_ts: start,
    duration_s: start ? rec.duration_s : '', freq: 1, classification: cls, criticality: incident ? 'INC' : 'NO_INC', is_failure: failure,
    reason_raw: rec.reason_raw, reason_id: rec.reason_id, description: rec.description, flags: rec.flags,
    stop_state: start ? 'closed' : 'open'
  };
}

var SHIFT_BLOCKING_ = ['missing_classification', 'invalid_classification', 'end_before_start'];

function blockingOf_(s) {
  return String(s.flags || '').split(',').filter(function (f) { return SHIFT_BLOCKING_.indexOf(f) >= 0; });
}

function requireNoBlocking_(stops) {
  var bad = stops.filter(function (s) { return blockingOf_(s).length; });
  if (bad.length) {
    throw apiError_(ERR.BAD_REQUEST, bad.length + ' stoppage(s) must be fixed first: ' + bad.slice(0, 3).map(function (s) {
      return s.stop_ts.slice(11, 16) + ' ' + (s.code_raw || '(no code)') + ' (' + blockingOf_(s).join(', ').replace(/_/g, ' ') + ')';
    }).join('; ') + '.');
  }
}

function logWorkflow_(reportId, action, from, to, stage, by, comment) {
  appendRow_(T.WORKFLOW_LOG, { log_id: newId_('WL-', 10), report_id: reportId, action: action, from_status: from, to_status: to, stage: stage, by_user: by, at: nowTs_(), comment: comment || '' });
}

function logStopEdits_(stop, reportId, stage, before, after, by, comment) {
  var rows = [];
  SHIFT_STOP_FIELDS.forEach(function (f) {
    var a = before[f] === undefined || before[f] === null ? '' : String(before[f]);
    var b = after[f] === undefined || after[f] === null ? '' : String(after[f]);
    if (a !== b) rows.push({ edit_id: newId_('SE-', 10), stop_id: stop, report_id: reportId, stage: stage, field: f, old_value: a, new_value: b, comment: comment || '', edited_by: by, edited_at: nowTs_() });
  });
  appendRows_(T.SHIFT_STOPPAGE_EDITS, rows);
  return rows.length;
}

// ---------- entry ----------

/**
 * Creates or updates the shift leader's report. `stoppages` is the complete list of the report's own stoppages:
 * rows with a stop_id are updated, new rows are added, rows left out are removed. With `submit` the report goes to
 * production review (blocking data problems must be fixed first).
 */
function saveShiftReport_(session, p) {
  requireObject_(p, 'The report');
  var day = String(p.report_date || '');
  if (!isValidDate_(day)) throw apiError_(ERR.BAD_REQUEST, 'Choose the report date.');
  var def = shiftDefOrThrow_(String(p.shift_id || ''));
  var win = shiftWindow_(def, day);
  if (win.start > nowTs_()) throw apiError_(ERR.BAD_REQUEST, 'This shift has not started yet.');
  var list = p.stoppages === undefined ? [] : p.stoppages;
  if (!Array.isArray(list)) throw apiError_(ERR.BAD_REQUEST, 'Stoppages must be a list.');
  if (list.length > SHIFT_MAX_STOPPAGES) throw apiError_(ERR.BAD_REQUEST, 'At most ' + SHIFT_MAX_STOPPAGES + ' stoppages in one report.');
  var notes = cleanText_(p.notes === undefined ? '' : p.notes, 'Notes', false, TEXT_MAX);
  var ctx = eventContext_();
  var area = findArea_(ctx, String(p.area_id || ''));
  if (!area) throw apiError_(ERR.BAD_REQUEST, 'There is no area ' + String(p.area_id).slice(0, 40) + '.');
  if (area.active === false) throw apiError_(ERR.BAD_REQUEST, 'Area ' + area.area_id + ' is switched off.');
  requireDuty_(session, 'shift_entry', area, day);
  var by = session.user.user_id;
  return withLock_(function () {
    var id = reportIdOf_(day, def.shift_id, area.area_id);
    var rep = findBy_(T.SHIFT_REPORTS, 'report_id', id);
    var now = nowTs_();
    if (rep && rep.status !== 'draft' && rep.status !== 'returned') {
      throw apiError_(ERR.CONFLICT, 'This report is ' + rep.status.replace('_', ' ') + ' and can no longer be changed by the shift leader.');
    }
    if (!rep) {
      appendRow_(T.SHIFT_REPORTS, { report_id: id, report_date: day, shift_id: def.shift_id, area_id: area.area_id, line_id: area.line_id,
        status: 'draft', source: 'app', entered_by: by, entered_at: now, notes: notes, updated_by: by, updated_at: now });
      logWorkflow_(id, 'create', '', 'draft', 'entry', by, '');
      rep = findBy_(T.SHIFT_REPORTS, 'report_id', id);
    }
    var all = readTable_(T.SHIFT_STOPPAGES);
    var mine = all.filter(function (s) { return s.report_id === id && s.row_state === 'active'; });
    var byId = {};
    mine.forEach(function (s) { byId[s.stop_id] = s; });
    var keep = {};
    var added = 0, changed = 0, removed = 0;
    var fresh = [];
    list.forEach(function (s) {
      var clean = cleanStoppage_(ctx, area, s, win, { checkWindow: true });
      var sid = s && typeof s.stop_id === 'string' ? s.stop_id : '';
      if (sid) {
        var old = byId[sid];
        if (!old) throw apiError_(ERR.BAD_REQUEST, 'Stoppage ' + sid.slice(0, 30) + ' is not in this report.');
        if (keep[sid]) throw apiError_(ERR.BAD_REQUEST, 'Stoppage ' + sid.slice(0, 30) + ' is listed twice.');
        keep[sid] = true;
        // a restart entered by a later shift stays with that shift: the shift leader of this report does not change it
        if (old.closed_report_id && old.closed_report_id !== id) { clean.start_ts = old.start_ts; clean.duration_s = old.duration_s; clean.stop_state = old.stop_state; }
        var diff = SHIFT_STOP_FIELDS.some(function (f) { return String(old[f] === undefined || old[f] === null ? '' : old[f]) !== String(clean[f]); });
        if (diff) {
          if (rep.status === 'returned') logStopEdits_(sid, id, 'entry', old, clean, by, 'Changed after return');
          clean.updated_by = by; clean.updated_at = now;
          updateRow_(T.SHIFT_STOPPAGES, old._row, clean);
          changed++;
        }
      } else {
        clean.stop_id = newId_('SS-', 10);
        clean.report_id = id;
        clean.row_state = 'active';
        clean.created_by = by; clean.created_at = now;
        fresh.push(clean);
        added++;
      }
    });
    mine.forEach(function (s) {
      if (keep[s.stop_id]) return;
      if (s.closed_report_id && s.closed_report_id !== id) throw apiError_(ERR.CONFLICT, 'The stoppage at ' + String(s.stop_ts).slice(0, 16) + ' was closed by a later shift and cannot be removed here.');
      updateRow_(T.SHIFT_STOPPAGES, s._row, { row_state: 'deleted', updated_by: by, updated_at: now });
      removed++;
    });
    appendRows_(T.SHIFT_STOPPAGES, fresh);
    var patch = { notes: notes, updated_by: by, updated_at: now };
    var detail = 'Added ' + added + ', changed ' + changed + ', removed ' + removed;
    if (p.submit === true) {
      var active = readTable_(T.SHIFT_STOPPAGES).filter(function (s) { return s.row_state === 'active' && (s.report_id === id || s.closed_report_id === id); });
      requireNoBlocking_(active);
      patch.status = 'submitted';
      patch.submitted_by = by;
      patch.submitted_at = now;
      logWorkflow_(id, 'submit', rep.status, 'submitted', 'entry', by, '');
      auditLog_(by, 'shift_report_submit', T.SHIFT_REPORTS, id, detail);
    } else {
      auditLog_(by, 'shift_report_save', T.SHIFT_REPORTS, id, detail);
    }
    updateRow_(T.SHIFT_REPORTS, rep._row, patch);
    return shiftReportBundle_(id);
  });
}

/** The report, its stoppages and the stoppages it closed (what the screens need after a write). */
function shiftReportBundle_(id) {
  var rep = findBy_(T.SHIFT_REPORTS, 'report_id', id);
  var stops = readTable_(T.SHIFT_STOPPAGES).filter(function (s) { return s.row_state === 'active' && (s.report_id === id || s.closed_report_id === id); });
  return { report: shiftReportOut_(rep), stoppages: stops.map(shiftStopOut_) };
}

/**
 * A later shift enters the restart time of a stoppage that is still open (or corrects the restart time it entered
 * itself while its report can still be changed). The later shift's report is created as a draft when needed.
 */
function closeShiftStoppage_(session, p) {
  requireObject_(p, 'The restart');
  var stopId = cleanText_(p.stop_id, 'Stoppage', true, 40);
  var day = String(p.report_date || '');
  if (!isValidDate_(day)) throw apiError_(ERR.BAD_REQUEST, 'Choose the date of your shift.');
  var def = shiftDefOrThrow_(String(p.shift_id || ''));
  var win = shiftWindow_(def, day);
  var start = shiftTs_(p.start_ts, 'Restart time');
  if (!start) throw apiError_(ERR.BAD_REQUEST, 'Enter the restart time.');
  if (start > nowTs_()) throw apiError_(ERR.BAD_REQUEST, 'Restart time ' + start.slice(0, 16) + ' is in the future.');
  if (start < win.start || start > win.end) {
    throw apiError_(ERR.BAD_REQUEST, 'Restart time ' + start.slice(0, 16) + ' is outside your shift (' + win.start.slice(0, 16) + ' to ' + win.end.slice(0, 16) + ').');
  }
  var ctx = eventContext_();
  var by = session.user.user_id;
  return withLock_(function () {
    var s = findBy_(T.SHIFT_STOPPAGES, 'stop_id', stopId);
    if (!s || s.row_state !== 'active') throw apiError_(ERR.NOT_FOUND, 'That stoppage was not found.');
    var area = findArea_(ctx, s.area_id);
    requireDuty_(session, 'shift_entry', area, day);
    var id = reportIdOf_(day, def.shift_id, area.area_id);
    if (id === s.report_id) throw apiError_(ERR.BAD_REQUEST, 'This stoppage belongs to this shift: enter its restart time in the report itself.');
    if (s.stop_state !== 'open' && s.closed_report_id !== id) throw apiError_(ERR.CONFLICT, 'This stoppage already has its restart time.');
    if (start < s.stop_ts) throw apiError_(ERR.BAD_REQUEST, 'The restart time is before the stop time (' + String(s.stop_ts).slice(0, 16) + ').');
    var rep = findBy_(T.SHIFT_REPORTS, 'report_id', id);
    var now = nowTs_();
    if (rep && rep.status !== 'draft' && rep.status !== 'returned') throw apiError_(ERR.CONFLICT, 'Your report for this shift is already ' + rep.status.replace('_', ' ') + '.');
    if (!rep) {
      appendRow_(T.SHIFT_REPORTS, { report_id: id, report_date: day, shift_id: def.shift_id, area_id: area.area_id, line_id: area.line_id,
        status: 'draft', source: 'app', entered_by: by, entered_at: now, updated_by: by, updated_at: now });
      logWorkflow_(id, 'create', '', 'draft', 'entry', by, '');
    }
    var duration = (parseTs_(start) - parseTs_(s.stop_ts)) / 1000;
    logStopEdits_(s.stop_id, id, 'entry', { start_ts: s.start_ts }, { start_ts: start }, by, 'Restart entered by a later shift');
    updateRow_(T.SHIFT_STOPPAGES, s._row, { start_ts: start, duration_s: duration, stop_state: 'closed', closed_report_id: id, closed_by: by, closed_at: now, updated_by: by, updated_at: now });
    auditLog_(by, 'shift_stoppage_close', T.SHIFT_STOPPAGES, s.stop_id, 'Restart ' + start.slice(0, 16) + ' in ' + id);
    return shiftReportBundle_(id);
  });
}

// ---------- review ----------

/**
 * Production review (status Submitted: approve or return to the shift leader) and reliability validation (status
 * Production approved: validate or return to production). `edits` are corrections made by the reviewer first:
 * [{ stop_id, changes: { field: value } }] on this report's stoppages (and the restart times this report entered);
 * each change is logged with the step. A return needs a comment.
 */
function reviewShiftReport_(session, p) {
  requireObject_(p, 'The review');
  var id = cleanText_(p.report_id, 'Report', true, 80);
  var decision = String(p.decision || '');
  if (['approve', 'return', 'validate'].indexOf(decision) < 0) throw apiError_(ERR.BAD_REQUEST, 'Decision must be approve, return or validate.');
  var comment = cleanText_(p.comment === undefined ? '' : p.comment, 'Comment', false, TEXT_MAX);
  if (decision === 'return' && comment.length < SHIFT_COMMENT_MIN) throw apiError_(ERR.BAD_REQUEST, 'Say why the report is returned (at least ' + SHIFT_COMMENT_MIN + ' characters).');
  var edits = p.edits === undefined ? [] : p.edits;
  if (!Array.isArray(edits)) throw apiError_(ERR.BAD_REQUEST, 'Edits must be a list.');
  var ctx = eventContext_();
  var by = session.user.user_id;
  return withLock_(function () {
    var rep = findBy_(T.SHIFT_REPORTS, 'report_id', id);
    if (!rep) throw apiError_(ERR.NOT_FOUND, 'That shift report was not found.');
    var area = findArea_(ctx, rep.area_id);
    var stage;
    if (rep.status === 'submitted') {
      stage = 'production';
      if (decision === 'validate') throw apiError_(ERR.CONFLICT, 'This report waits for production review first.');
      requireDuty_(session, 'production_review', area, rep.report_date);
      if (!isAdmin_(session) && (rep.entered_by === by || rep.submitted_by === by)) {
        throw apiError_(ERR.FORBIDDEN, 'You entered this report, so someone else must review it.');
      }
    } else if (rep.status === 'prod_approved') {
      stage = 'reliability';
      if (decision === 'approve') throw apiError_(ERR.CONFLICT, 'This report is already approved by production; validate or return it.');
      requireDuty_(session, 'reliability_validation', area, rep.report_date);
    } else {
      throw apiError_(ERR.CONFLICT, 'This report is ' + String(rep.status).replace('_', ' ') + ' and is not waiting for a review.');
    }
    var stops = readTable_(T.SHIFT_STOPPAGES).filter(function (s) { return s.row_state === 'active' && (s.report_id === id || s.closed_report_id === id); });
    var byId = {};
    stops.forEach(function (s) { byId[s.stop_id] = s; });
    var now = nowTs_();
    var nEdits = 0;
    edits.forEach(function (e) {
      requireObject_(e, 'An edit');
      var s = byId[e.stop_id];
      if (!s) throw apiError_(ERR.BAD_REQUEST, 'Stoppage ' + String(e.stop_id).slice(0, 30) + ' is not part of this report.');
      requireObject_(e.changes, 'The changes');
      Object.keys(e.changes).forEach(function (f) { if (SHIFT_STOP_FIELDS.indexOf(f) < 0) throw apiError_(ERR.BAD_REQUEST, 'Field ' + f.slice(0, 30) + ' cannot be changed.'); });
      // the restart time of a stoppage closed by this report belongs to this report; the rest stays with its own report
      if (s.report_id !== id && Object.keys(e.changes).some(function (f) { return f !== 'start_ts'; })) {
        throw apiError_(ERR.BAD_REQUEST, 'Only the restart time of a stoppage from an earlier shift can be changed here.');
      }
      var merged = {};
      SHIFT_STOP_FIELDS.forEach(function (f) { merged[f] = Object.prototype.hasOwnProperty.call(e.changes, f) ? e.changes[f] : s[f]; });
      merged.is_failure = merged.is_failure === true || merged.is_failure === 'TRUE' || merged.is_failure === 'true';
      var clean = cleanStoppage_(ctx, area, merged, null, { checkWindow: false });
      if (s.closed_report_id && s.closed_report_id !== s.report_id && !clean.start_ts) throw apiError_(ERR.BAD_REQUEST, 'A restart entered by a later shift cannot be removed; correct it instead.');
      nEdits += logStopEdits_(s.stop_id, id, stage, s, clean, by, comment);
      clean.updated_by = by; clean.updated_at = now;
      if (clean.stop_state === 'open') { clean.closed_report_id = ''; clean.closed_by = ''; clean.closed_at = ''; }
      updateRow_(T.SHIFT_STOPPAGES, s._row, clean);
      byId[s.stop_id] = Object.assign({}, s, clean);
    });
    var after = Object.keys(byId).map(function (k) { return byId[k]; });
    var patch = { updated_by: by, updated_at: now };
    var to;
    if (decision === 'return') {
      to = stage === 'production' ? 'returned' : 'submitted';
      patch.status = to; patch.returned_by = by; patch.returned_at = now; patch.return_stage = stage; patch.return_comment = comment;
    } else if (decision === 'approve') {
      requireNoBlocking_(after);
      to = 'prod_approved';
      patch.status = to; patch.prod_reviewed_by = by; patch.prod_reviewed_at = now;
    } else {
      requireNoBlocking_(after);
      to = 'validated';
      patch.status = to; patch.rel_validated_by = by; patch.rel_validated_at = now;
    }
    updateRow_(T.SHIFT_REPORTS, rep._row, patch);
    logWorkflow_(id, decision, rep.status, to, stage, by, comment);
    var posted = decision === 'validate' ? postReadyStoppages_(by) : 0;
    auditLog_(by, 'shift_report_' + decision, T.SHIFT_REPORTS, id, (nEdits ? nEdits + ' change(s). ' : '') + (decision === 'validate' ? posted + ' stoppage(s) posted. ' : '') + comment);
    return shiftReportBundle_(id);
  });
}

// ---------- posting ----------

var SHIFT_DONE_ = { validated: true, posted: true };

/**
 * Turns every stoppage that is ready into a downtime event: active, closed, not yet posted, its own report validated
 * and (when a later shift entered the restart) that report validated too. A stoppage that matches an event already
 * stored (same area, code, stop and restart: for example the month's workbook was also uploaded) is linked to it,
 * never added twice. Reports whose stoppages are all posted become Posted. Returns the number posted.
 */
function postReadyStoppages_(by) {
  var reports = readTable_(T.SHIFT_REPORTS);
  var repById = {};
  reports.forEach(function (r) { repById[r.report_id] = r; });
  var stops = readTable_(T.SHIFT_STOPPAGES).filter(function (s) { return s.row_state === 'active'; });
  var ready = stops.filter(function (s) {
    if (s.posted_event_id || s.stop_state !== 'closed') return false;
    var own = repById[s.report_id];
    var closer = s.closed_report_id ? repById[s.closed_report_id] : own;
    return own && closer && SHIFT_DONE_[own.status] && SHIFT_DONE_[closer.status];
  });
  var now = nowTs_();
  var ctx = ready.length ? eventContext_() : null;
  var known = {};
  if (ready.length) {
    var fps = readColumn_(T.EVENTS, 'fingerprint'), ids = readColumn_(T.EVENTS, 'event_id');
    for (var i = 0; i < fps.length; i++) known[fps[i]] = ids[i];
  }
  var fresh = [];
  ready.forEach(function (s) {
    var norm = normalizeEvent_(ctx, {
      event_date: String(s.stop_ts).slice(0, 10), line_id: s.line_id, area_id: s.area_id, code_raw: s.code_raw || '', stop_ts: s.stop_ts, start_ts: s.start_ts,
      freq: 1, classification: s.classification, criticality: s.criticality, is_failure: toBool_(s.is_failure), reason_raw: s.reason_raw || '', description: s.description || ''
    });
    if (norm.error) return; // cannot happen for a validated stoppage; it stays unposted and visible
    var rec = norm.rec;
    var fp = fingerprintOf_(rec.area_id + '|' + rec.code_key + '|' + rec.stop_ts + '|' + rec.start_ts, 1);
    var eventId = known[fp];
    if (!eventId) {
      delete rec.code_key;
      eventId = 'EV-' + fp.slice(0, 16);
      rec.event_id = eventId;
      rec.batch_id = s.closed_report_id || s.report_id;
      rec.source_file = 'Shift report ' + s.report_id;
      rec.source_row = '';
      rec.fingerprint = fp;
      rec.edited = false;
      rec.is_void = false;
      rec.created_at = now;
      rec.origin = 'shift';
      rec.time_precision = 'exact';
      rec.shift_stop_id = s.stop_id;
      fresh.push(rec);
      known[fp] = eventId;
    }
    updateRow_(T.SHIFT_STOPPAGES, s._row, { posted_event_id: eventId, updated_at: now });
    s.posted_event_id = eventId;
  });
  appendRows_(T.EVENTS, fresh);
  // reports with nothing left to post
  reports.forEach(function (r) {
    if (r.status !== 'validated') return;
    var own = stops.filter(function (s) { return s.report_id === r.report_id || s.closed_report_id === r.report_id; });
    if (own.every(function (s) { return !!s.posted_event_id; })) {
      updateRow_(T.SHIFT_REPORTS, r._row, { status: 'posted', posted_at: now, updated_at: now });
      logWorkflow_(r.report_id, 'post', 'validated', 'posted', 'reliability', by, own.length + ' stoppage(s) in the downtime analysis');
    }
  });
  return ready.length;
}
