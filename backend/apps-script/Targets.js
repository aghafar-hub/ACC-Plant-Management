/**
 * KPI targets (schema v7, plant system 2.3.0): the one place targets live (rule 4 of docs/plant-system/01-kpi-definitions.md).
 * A target belongs to a scope (the plant, one line or one area), a KPI of kpi_definitions, a year and a month (0 = the
 * whole year). Saving replaces the complete set of one scope and year; every change is in the audit log.
 * Who may save: the Admin role, or a person holding the duty "targets" for that scope today (a plant duty covers every
 * line and area, a line duty its line and the areas of that line).
 */

var TARGETS_MAX_ROWS = 600;

function kpiDefinitionOut_(d) {
  return {
    kpi_id: d.kpi_id, name: d.name, category: d.category, unit: d.unit || '', better: d.better || 'none',
    decimals: toIntOr_(d.decimals, 1), aggregation: d.aggregation || '', status: d.status || 'draft'
  };
}

function kpiTargetOut_(r) {
  var num = function (v) { return v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v); };
  return {
    scope_type: r.scope_type, scope_id: r.scope_id || '', kpi_id: r.kpi_id, year: toIntOr_(r.year, 0), month: toIntOr_(r.month, 0),
    target_value: num(r.target_value), lower_limit: num(r.lower_limit), upper_limit: num(r.upper_limit), source: r.source || '',
    updated_by: r.updated_by || '', updated_at: r.updated_at || ''
  };
}

/** For the start-up data: the definitions and every stored target (both empty on a database without the v7 tables). */
function kpiStartup_() {
  return {
    kpi_definitions: optionalTable_(T.KPI_DEFINITIONS).map(kpiDefinitionOut_),
    kpi_targets: optionalTable_(T.KPI_TARGETS).map(kpiTargetOut_)
  };
}

/** May the person save targets for this scope today? */
function canSetTargets_(session, scopeType, scopeId, areas) {
  if (isAdmin_(session)) return true;
  var day = Utilities.formatDate(new Date(nowMs_()), TIMEZONE, 'yyyy-MM-dd');
  var lineOfArea = scopeType === 'area' && areas[scopeId] ? areas[scopeId].line_id : '';
  return readTable_(T.RESPONSIBILITIES).some(function (r) {
    if (r.user_id !== session.user.user_id || !toBool_(r.active) || r.duty !== 'targets') return false;
    if ((r.valid_from && day < r.valid_from) || (r.valid_to && day > r.valid_to)) return false;
    if (r.scope_type === 'plant') return true;
    if (r.scope_type === 'line') return (scopeType === 'line' && r.scope_id === scopeId) || (scopeType === 'area' && r.scope_id === lineOfArea);
    return scopeType === 'area' && r.scope_type === 'area' && r.scope_id === scopeId;
  });
}

function optNumber_(v, label) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  if (!isFinite(n)) throw apiError_(ERR.BAD_REQUEST, label + ' must be a number.');
  return n;
}

/**
 * Replaces the targets of one scope and year. `rows`: [{kpi_id, month (0-12), target_value, lower_limit, upper_limit, source}].
 * A row with no target and no limits is left out (= no target). Returns the stored targets of that scope and year.
 */
function saveKpiTargets_(session, p) {
  requireObject_(p, 'Targets');
  var year = Number(p.year);
  if (!(year >= 2000 && year <= 2100) || Math.floor(year) !== year) throw apiError_(ERR.BAD_REQUEST, 'Choose a year between 2000 and 2100.');
  var scopeType = String(p.scope_type || '');
  if (['plant', 'line', 'area'].indexOf(scopeType) < 0) throw apiError_(ERR.BAD_REQUEST, 'Scope must be plant, line or area.');
  var scopeId = scopeType === 'plant' ? '' : String(p.scope_id || '').trim();
  var lines = {}, areas = {};
  readTable_(T.LINES).forEach(function (l) { lines[l.line_id] = l; });
  readTable_(T.AREAS).forEach(function (a) { areas[a.area_id] = a; });
  if (scopeType === 'line' && !lines[scopeId]) throw apiError_(ERR.BAD_REQUEST, 'There is no line ' + scopeId.slice(0, 40) + '.');
  if (scopeType === 'area' && !areas[scopeId]) throw apiError_(ERR.BAD_REQUEST, 'There is no area ' + scopeId.slice(0, 40) + '.');
  if (!canSetTargets_(session, scopeType, scopeId, areas)) {
    throw apiError_(ERR.FORBIDDEN, 'You do not hold the duty "Targets" for ' + (scopeType === 'plant' ? 'the plant' : scopeId) +
      '. An Admin can add it in Settings > Users > Responsibilities.');
  }
  if (!Array.isArray(p.rows)) throw apiError_(ERR.BAD_REQUEST, 'Targets must be a list.');
  if (p.rows.length > TARGETS_MAX_ROWS) throw apiError_(ERR.BAD_REQUEST, 'At most ' + TARGETS_MAX_ROWS + ' targets at a time.');
  var defs = {};
  optionalTable_(T.KPI_DEFINITIONS).forEach(function (d) { defs[d.kpi_id] = d; });
  var seen = {};
  var clean = [];
  p.rows.forEach(function (r) {
    requireObject_(r, 'A target');
    var kpi = String(r.kpi_id || '');
    if (!defs[kpi]) throw apiError_(ERR.BAD_REQUEST, 'Unknown KPI: ' + kpi.slice(0, 40) + '.');
    var month = Number(r.month || 0);
    if (!(month >= 0 && month <= 12) || Math.floor(month) !== month) throw apiError_(ERR.BAD_REQUEST, 'Month must be 1 to 12, or 0 for the whole year.');
    var label = defs[kpi].name + (month ? ' (' + year + '-' + (month < 10 ? '0' : '') + month + ')' : ' (' + year + ')');
    var tv = optNumber_(r.target_value, label + ': target');
    var lo = optNumber_(r.lower_limit, label + ': lower limit');
    var hi = optNumber_(r.upper_limit, label + ': upper limit');
    if (lo !== null && hi !== null && lo > hi) throw apiError_(ERR.BAD_REQUEST, label + ': the lower limit is above the upper limit.');
    if (tv === null && lo === null && hi === null) return;
    var key = kpi + '|' + month;
    if (seen[key]) throw apiError_(ERR.BAD_REQUEST, label + ' is listed twice.');
    seen[key] = true;
    clean.push({ kpi_id: kpi, month: month, target_value: tv, lower_limit: lo, upper_limit: hi, source: cleanText_(r.source, 'Source', false, 100), label: label });
  });
  var same = function (r) { return r.scope_type === scopeType && String(r.scope_id || '') === scopeId && toIntOr_(r.year, 0) === year; };
  withLock_(function () {
    var existing = readTable_(T.KPI_TARGETS).filter(same);
    var before = {};
    existing.forEach(function (r) { before[r.kpi_id + '|' + toIntOr_(r.month, 0)] = kpiTargetOut_(r); });
    var now = nowTs_(), by = session.user.user_id;
    var said = [];
    clean.forEach(function (c) {
      var b = before[c.kpi_id + '|' + c.month];
      if (!b) said.push('+ ' + c.label + ' ' + targetText_(c));
      else if (b.target_value !== c.target_value || b.lower_limit !== c.lower_limit || b.upper_limit !== c.upper_limit || b.source !== c.source) {
        said.push(c.label + ' ' + targetText_(b) + ' -> ' + targetText_(c));
      }
    });
    existing.forEach(function (r) {
      if (!seen[r.kpi_id + '|' + toIntOr_(r.month, 0)]) said.push('- ' + (defs[r.kpi_id] ? defs[r.kpi_id].name : r.kpi_id) + ' (' + year + (toIntOr_(r.month, 0) ? '-' + r.month : '') + ')');
    });
    if (!said.length) return;
    deleteRows_(T.KPI_TARGETS, existing.map(function (r) { return r._row; }));
    appendRows_(T.KPI_TARGETS, clean.map(function (c) {
      return {
        scope_type: scopeType, scope_id: scopeId, kpi_id: c.kpi_id, year: year, month: c.month, target_value: c.target_value === null ? '' : c.target_value,
        lower_limit: c.lower_limit === null ? '' : c.lower_limit, upper_limit: c.upper_limit === null ? '' : c.upper_limit, source: c.source,
        updated_by: by, updated_at: now
      };
    }));
    auditLog_(by, 'save_kpi_targets', T.KPI_TARGETS, (scopeType === 'plant' ? 'plant' : scopeId) + ' ' + year, said.join('; '));
  });
  return readTable_(T.KPI_TARGETS).filter(same).map(kpiTargetOut_);
}

function targetText_(c) {
  var parts = [];
  if (c.target_value !== null) parts.push(String(c.target_value));
  if (c.lower_limit !== null || c.upper_limit !== null) parts.push('[' + (c.lower_limit === null ? '' : c.lower_limit) + '..' + (c.upper_limit === null ? '' : c.upper_limit) + ']');
  return parts.join(' ') || '(none)';
}
