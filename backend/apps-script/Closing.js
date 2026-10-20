/**
 * Month-end closing (schema v7, plant system 2.3.0; docs/plant-system/04-rules-all-sections.md). Each section (downtime,
 * production, quality) is closed in two steps: the section engineer reviews the month (duty month_review), then the
 * section manager signs it off (duty month_signoff, not the person who reviewed). The plant report is signed off once the
 * three sections are. A signed-off month is locked: nothing that changes its figures is accepted until the manager
 * reopens it with a reason, and then it is reviewed and signed off again.
 *
 * What the lock covers today (downtime): editing, voiding or "keeping as entered" a record of the month, upload and
 * history rows dated in the month (refused row by row), shift stoppages posted into the month (they wait), and the
 * Re-check of every record (the month is skipped). Production and quality have no entry screens yet.
 */

var CLOSING_SECTIONS = ['downtime', 'production', 'quality', 'plant'];
var CLOSING_SECTION_TEXT = { downtime: 'Downtime and reliability', production: 'Production', quality: 'Quality', plant: 'Plant report' };
var CLOSING_REASON_MIN = 10;

function closingOut_(r) {
  return {
    section: r.section, year: toIntOr_(r.year, 0), month: toIntOr_(r.month, 0), status: r.status || 'open',
    open_checks: r.open_checks === '' || r.open_checks === null || r.open_checks === undefined ? null : toIntOr_(r.open_checks, 0),
    reviewed_by: r.reviewed_by || '', reviewed_at: r.reviewed_at || '', review_comment: r.review_comment || '',
    signed_off_by: r.signed_off_by || '', signed_off_at: r.signed_off_at || '', signoff_comment: r.signoff_comment || '',
    reopened_by: r.reopened_by || '', reopened_at: r.reopened_at || '', reopen_reason: r.reopen_reason || '', updated_at: r.updated_at || ''
  };
}

/** Every closing row (small: at most four per month); for the start-up data. */
function listMonthClosings_() {
  return optionalTable_(T.MONTH_CLOSINGS).map(closingOut_);
}

function monthKey_(year, month) { return year + '-' + (month < 10 ? '0' : '') + month; }

/** 'YYYY-MM' of every signed-off month of a section. */
function lockedMonths_(section) {
  var out = {};
  optionalTable_(T.MONTH_CLOSINGS).forEach(function (r) {
    if (r.section === section && r.status === 'signed_off') out[monthKey_(toIntOr_(r.year, 0), toIntOr_(r.month, 0))] = true;
  });
  return out;
}

function monthName_(ym) {
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return names[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
}

function lockedText_(ym) {
  return 'The downtime of ' + monthName_(ym) + ' is signed off and locked. The section manager reopens it (with a reason) in Month closing before anything changes.';
}

/** The signed-off month a record touches (its date or its stop time), or ''. */
function lockedMonthOf_(rec, locked) {
  var a = String(rec.event_date || '').slice(0, 7), b = String(rec.stop_ts || '').slice(0, 7);
  return locked[a] ? a : locked[b] ? b : '';
}

/** Throws when the record (its date or its stop time) falls in a signed-off downtime month. */
function requireDowntimeOpen_(rec, locked) {
  var ym = lockedMonthOf_(rec, locked || lockedMonths_('downtime'));
  if (ym) throw apiError_(ERR.CONFLICT, lockedText_(ym));
}

/** Data checks of the month still open (downtime: records with a problem not kept as entered). */
function openChecksOf_(section, ym) {
  if (section !== 'downtime') return null;
  var n = 0;
  readTable_(T.EVENTS).forEach(function (e) {
    if (toBool_(e.is_void) || String(e.event_date).slice(0, 7) !== ym) return;
    var kept = canonFlags_(e.accepted_flags);
    var open = canonFlags_(e.flags).filter(function (f) { return f !== 'code_not_in_area' && kept.indexOf(f) < 0; });
    if (open.length) n++;
  });
  return n;
}

function holdsSectionDuty_(session, duty, section, day) {
  if (isAdmin_(session)) return true;
  return readTable_(T.RESPONSIBILITIES).some(function (r) {
    return r.user_id === session.user.user_id && toBool_(r.active) && r.duty === duty && r.section === section &&
      (!r.valid_from || r.valid_from <= day) && (!r.valid_to || day <= r.valid_to);
  });
}

/**
 * One step of the closing. p: {section, year, month, step: 'review' | 'signoff' | 'reopen', comment}.
 * Returns the closing row as it now stands.
 */
function closeMonthStep_(session, p) {
  requireObject_(p, 'The closing step');
  var section = String(p.section || '');
  if (CLOSING_SECTIONS.indexOf(section) < 0) throw apiError_(ERR.BAD_REQUEST, 'Section must be downtime, production, quality or plant.');
  var year = Number(p.year), month = Number(p.month);
  if (!(year >= 2000 && year <= 2100) || Math.floor(year) !== year || !(month >= 1 && month <= 12) || Math.floor(month) !== month) {
    throw apiError_(ERR.BAD_REQUEST, 'Choose a month.');
  }
  var step = String(p.step || '');
  if (['review', 'signoff', 'reopen'].indexOf(step) < 0) throw apiError_(ERR.BAD_REQUEST, 'Step must be review, signoff or reopen.');
  var comment = cleanText_(p.comment === undefined ? '' : p.comment, 'Comment', false, 1000);
  var ym = monthKey_(year, month);
  var today = Utilities.formatDate(new Date(nowMs_()), TIMEZONE, 'yyyy-MM-dd');
  if (ym >= today.slice(0, 7)) throw apiError_(ERR.BAD_REQUEST, monthName_(ym) + ' has not ended yet. A month is closed after its last day.');
  var by = session.user.user_id;
  var sectionText = CLOSING_SECTION_TEXT[section];
  return withLock_(function () {
    var rows = readTable_(T.MONTH_CLOSINGS);
    var cur = rows.filter(function (r) { return r.section === section && toIntOr_(r.year, 0) === year && toIntOr_(r.month, 0) === month; })[0];
    var status = cur ? cur.status : 'open';
    var now = nowTs_();
    var patch;
    if (step === 'review') {
      if (section === 'plant') throw apiError_(ERR.BAD_REQUEST, 'The plant report has no review step: the plant manager signs it off once the three sections are signed off.');
      if (!holdsSectionDuty_(session, 'month_review', section, today)) {
        throw apiError_(ERR.FORBIDDEN, 'You do not hold the duty "Month review" for ' + sectionText + '. An Admin can add it in Settings > Users > Responsibilities.');
      }
      if (status !== 'open' && status !== 'reopened') throw apiError_(ERR.CONFLICT, sectionText + ' ' + monthName_(ym) + ' is already ' + (status === 'reviewed' ? 'reviewed' : 'signed off') + '.');
      var openChecks = openChecksOf_(section, ym);
      if (openChecks && comment.length < CLOSING_REASON_MIN) {
        throw apiError_(ERR.BAD_REQUEST, openChecks + ' records of ' + monthName_(ym) + ' still need checking (Validate). Fix them, or say in the comment why the month can close (at least ' + CLOSING_REASON_MIN + ' characters).');
      }
      patch = { status: 'reviewed', open_checks: openChecks === null ? '' : openChecks, reviewed_by: by, reviewed_at: now, review_comment: comment,
        signed_off_by: '', signed_off_at: '', signoff_comment: '' };
    } else if (step === 'signoff') {
      if (!holdsSectionDuty_(session, 'month_signoff', section, today)) {
        throw apiError_(ERR.FORBIDDEN, 'You do not hold the duty "Month sign-off" for ' + sectionText + '. An Admin can add it in Settings > Users > Responsibilities.');
      }
      if (section === 'plant') {
        if (status === 'signed_off') throw apiError_(ERR.CONFLICT, 'The plant report of ' + monthName_(ym) + ' is already signed off.');
        var missing = ['downtime', 'production', 'quality'].filter(function (s) {
          return !rows.some(function (r) { return r.section === s && toIntOr_(r.year, 0) === year && toIntOr_(r.month, 0) === month && r.status === 'signed_off'; });
        });
        if (missing.length) throw apiError_(ERR.CONFLICT, 'Sign off ' + missing.map(function (s) { return CLOSING_SECTION_TEXT[s]; }).join(', ') + ' of ' + monthName_(ym) + ' first.');
      } else {
        if (status !== 'reviewed') throw apiError_(ERR.CONFLICT, status === 'signed_off' ? sectionText + ' ' + monthName_(ym) + ' is already signed off.' : 'The section engineer reviews ' + monthName_(ym) + ' first.');
        if (cur.reviewed_by === by && !isAdmin_(session)) throw apiError_(ERR.FORBIDDEN, 'You reviewed this month: another person (the section manager) signs it off.');
      }
      patch = { status: 'signed_off', signed_off_by: by, signed_off_at: now, signoff_comment: comment };
    } else {
      if (!holdsSectionDuty_(session, 'month_signoff', section, today)) {
        throw apiError_(ERR.FORBIDDEN, 'You do not hold the duty "Month sign-off" for ' + sectionText + '. An Admin can add it in Settings > Users > Responsibilities.');
      }
      if (status !== 'signed_off') throw apiError_(ERR.CONFLICT, 'Only a signed-off month can be reopened.');
      if (comment.length < CLOSING_REASON_MIN) throw apiError_(ERR.BAD_REQUEST, 'Say why the month is reopened (at least ' + CLOSING_REASON_MIN + ' characters).');
      patch = { status: 'reopened', reopened_by: by, reopened_at: now, reopen_reason: comment, reviewed_by: '', reviewed_at: '', review_comment: '',
        signed_off_by: '', signed_off_at: '', signoff_comment: '' };
    }
    patch.updated_at = now;
    if (cur) updateRow_(T.MONTH_CLOSINGS, cur._row, patch);
    else {
      var row = { section: section, year: year, month: month, status: 'open', open_checks: '', reviewed_by: '', reviewed_at: '', review_comment: '',
        signed_off_by: '', signed_off_at: '', signoff_comment: '', reopened_by: '', reopened_at: '', reopen_reason: '', updated_at: now };
      Object.keys(patch).forEach(function (k) { row[k] = patch[k]; });
      appendRow_(T.MONTH_CLOSINGS, row);
    }
    auditLog_(by, 'month_' + step, T.MONTH_CLOSINGS, section + ' ' + ym, comment ? 'Comment: ' + comment : '');
    return closingOut_(readTable_(T.MONTH_CLOSINGS).filter(function (r) { return r.section === section && toIntOr_(r.year, 0) === year && toIntOr_(r.month, 0) === month; })[0]);
  });
}
