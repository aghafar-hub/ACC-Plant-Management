/**
 * Responsibilities (schema v7, plant system): who holds which duty, for which part of the plant.
 * A duty is held for the whole plant, one line or one area, as the main person or as a backup, optionally between
 * two dates. month_review and month_signoff also name the section (downtime, production, quality, plant).
 * Saving replaces the complete set of one user (like setUserTabAccess); every change is in the audit log.
 */

var DUTIES = ['shift_entry', 'production_review', 'reliability_validation', 'production_data', 'quality_validation',
  'month_review', 'month_signoff', 'targets', 'master_data', 'daily_meeting'];
var DUTY_SECTIONS = ['downtime', 'production', 'quality', 'plant'];
var SECTION_DUTIES = ['month_review', 'month_signoff'];
var SCOPE_TYPES = ['plant', 'line', 'area'];
var RESP_MAX_PER_USER = 200;

function respOut_(r) {
  return {
    resp_id: r.resp_id, user_id: r.user_id, duty: r.duty, section: r.section || '', scope_type: r.scope_type,
    scope_id: r.scope_id || '', is_backup: toBool_(r.is_backup), valid_from: r.valid_from || '', valid_to: r.valid_to || '',
    updated_by: r.updated_by || r.created_by || '', updated_at: r.updated_at || r.created_at || ''
  };
}

function listResponsibilities_() {
  return readTable_(T.RESPONSIBILITIES).filter(function (r) { return toBool_(r.active); }).map(respOut_);
}

/** The caller's own duties (2.1.0): the Shift reports and Daily meeting pages offer the areas the person works on. */
function listMyResponsibilities_(session) {
  return listResponsibilities_().filter(function (r) { return r.user_id === session.user.user_id; });
}

/** One row as the client sends it -> the cleaned row, or a plain-English error. */
function cleanResponsibility_(row, lines, areas) {
  requireObject_(row, 'A responsibility');
  var duty = String(row.duty || '');
  if (DUTIES.indexOf(duty) < 0) throw apiError_(ERR.BAD_REQUEST, 'Unknown duty: ' + duty.slice(0, 40) + '.');
  var section = String(row.section || '');
  if (SECTION_DUTIES.indexOf(duty) >= 0) {
    if (DUTY_SECTIONS.indexOf(section) < 0) throw apiError_(ERR.BAD_REQUEST, 'Choose the section (downtime, production, quality or plant) for ' + duty + '.');
  } else if (section) {
    throw apiError_(ERR.BAD_REQUEST, 'Only month review and month sign-off have a section.');
  }
  var scopeType = String(row.scope_type || '');
  if (SCOPE_TYPES.indexOf(scopeType) < 0) throw apiError_(ERR.BAD_REQUEST, 'Scope must be plant, line or area.');
  var scopeId = String(row.scope_id || '').trim();
  if (scopeType === 'plant') scopeId = '';
  else if (scopeType === 'line' && !lines[scopeId]) throw apiError_(ERR.BAD_REQUEST, 'There is no line ' + scopeId.slice(0, 40) + '.');
  else if (scopeType === 'area' && !areas[scopeId]) throw apiError_(ERR.BAD_REQUEST, 'There is no area ' + scopeId.slice(0, 40) + '.');
  var from = String(row.valid_from || '');
  var to = String(row.valid_to || '');
  if (from && !isValidDate_(from)) throw apiError_(ERR.BAD_REQUEST, 'Valid from must be a date like 2026-10-01.');
  if (to && !isValidDate_(to)) throw apiError_(ERR.BAD_REQUEST, 'Valid to must be a date like 2026-10-31.');
  if (from && to && to < from) throw apiError_(ERR.BAD_REQUEST, 'Valid to is before valid from.');
  return { duty: duty, section: section, scope_type: scopeType, scope_id: scopeId, is_backup: row.is_backup === true, valid_from: from, valid_to: to };
}

function respKey_(r) { return [r.duty, r.section || '', r.scope_type, r.scope_id || '', toBool_(r.is_backup) ? 'backup' : 'main'].join('|'); }

function respLabel_(r) {
  return r.duty + (r.section ? ' (' + r.section + ')' : '') + ' @ ' + (r.scope_type === 'plant' ? 'plant' : r.scope_id) +
    (toBool_(r.is_backup) ? ' backup' : '') + (r.valid_from || r.valid_to ? ' ' + (r.valid_from || '...') + '..' + (r.valid_to || '...') : '');
}

/** `rows` is the complete set of responsibilities of the user; rows left out are removed. Returns that user's set. */
function saveResponsibilities_(session, userId, rows) {
  if (!Array.isArray(rows)) throw apiError_(ERR.BAD_REQUEST, 'Responsibilities must be a list.');
  if (rows.length > RESP_MAX_PER_USER) throw apiError_(ERR.BAD_REQUEST, 'At most ' + RESP_MAX_PER_USER + ' responsibilities per person.');
  var lines = {}, areas = {};
  readTable_(T.LINES).forEach(function (l) { lines[l.line_id] = true; });
  readTable_(T.AREAS).forEach(function (a) { areas[a.area_id] = true; });
  var clean = rows.map(function (r) { return cleanResponsibility_(r, lines, areas); });
  var seen = {};
  clean.forEach(function (r) {
    var k = respKey_(r);
    if (seen[k]) throw apiError_(ERR.BAD_REQUEST, 'The same responsibility is listed twice: ' + respLabel_(r) + '.');
    seen[k] = true;
  });
  withLock_(function () {
    var u = userOrThrow_(userId);
    requireAdminFor_(session, u.role_id === 'ROLE-ADMIN', 'change the responsibilities of an Admin');
    var existing = readTable_(T.RESPONSIBILITIES).filter(function (r) { return r.user_id === u.user_id && toBool_(r.active); });
    var before = {};
    existing.forEach(function (r) { before[respKey_(r) + '|' + (r.valid_from || '') + '|' + (r.valid_to || '')] = r; });
    var after = {};
    clean.forEach(function (r) { after[respKey_(r) + '|' + r.valid_from + '|' + r.valid_to] = r; });
    var now = nowTs_(), by = session.user.user_id;
    var removed = existing.filter(function (r) { return !after[respKey_(r) + '|' + (r.valid_from || '') + '|' + (r.valid_to || '')]; });
    var added = clean.filter(function (r) { return !before[respKey_(r) + '|' + r.valid_from + '|' + r.valid_to]; });
    // A removed row is switched off, not deleted, so who held a duty when stays answerable.
    removed.forEach(function (r) { updateRow_(T.RESPONSIBILITIES, r._row, { active: false, updated_by: by, updated_at: now }); });
    appendRows_(T.RESPONSIBILITIES, added.map(function (r) {
      return {
        resp_id: newId_('RS-', 10), user_id: u.user_id, duty: r.duty, section: r.section, scope_type: r.scope_type, scope_id: r.scope_id,
        is_backup: r.is_backup, valid_from: r.valid_from, valid_to: r.valid_to, active: true, created_by: by, created_at: now
      };
    }));
    auditLog_(by, 'set_responsibilities', T.USERS, u.user_id,
      added.map(function (r) { return '+ ' + respLabel_(r); }).concat(removed.map(function (r) { return '- ' + respLabel_(r); })).join('; ') || 'No change');
  });
  return listResponsibilities_().filter(function (r) { return r.user_id === userId; });
}
