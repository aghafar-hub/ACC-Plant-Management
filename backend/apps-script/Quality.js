/**
 * Quality limits (schema v7, plant system 2.3.0): the specification and the valid range of each laboratory parameter
 * (quality_parameters, seeded from the QCX list). The quality department enters them in Settings > Quality limits.
 * Who may save a parameter: the Admin role, or a person holding the duty "quality_validation" today for its area (a plant
 * duty covers every area, a line duty the areas of that line). The same checks as src/plant/quality.ts.
 */

var QUALITY_FIELDS = ['spec_min', 'spec_max', 'target', 'valid_min', 'valid_max', 'samples_per_day', 'active', 'notes'];

function qualityParamOut_(p) {
  var num = function (v) { return v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v); };
  return {
    param_id: p.param_id, area_id: p.area_id, material: p.material, name: p.name, unit: p.unit || '',
    spec_min: num(p.spec_min), spec_max: num(p.spec_max), target: num(p.target), valid_min: num(p.valid_min), valid_max: num(p.valid_max),
    samples_per_day: num(p.samples_per_day), qcx_column: p.qcx_column || '', sort_order: toIntOr_(p.sort_order, 0), active: toBool_(p.active),
    notes: p.notes || '', updated_by: p.updated_by || '', updated_at: p.updated_at || ''
  };
}

function listQualityParameters_() {
  return optionalTable_(T.QUALITY_PARAMETERS).map(qualityParamOut_).sort(function (a, b) { return a.sort_order - b.sort_order; });
}

function qualityLimitProblem_(p) {
  var label = p.area_id + ' ' + p.name;
  if (p.samples_per_day !== null && (Math.floor(p.samples_per_day) !== p.samples_per_day || p.samples_per_day < 0 || p.samples_per_day > 96)) {
    return label + ': samples per day must be a whole number from 0 to 96.';
  }
  if (p.spec_min !== null && p.spec_max !== null && p.spec_min > p.spec_max) return label + ': the specification minimum is above the maximum.';
  if (p.valid_min !== null && p.valid_max !== null && p.valid_min >= p.valid_max) return label + ': the valid minimum must be below the valid maximum.';
  if (p.target !== null && ((p.spec_min !== null && p.target < p.spec_min) || (p.spec_max !== null && p.target > p.spec_max))) return label + ': the target is outside the specification.';
  var checks = [['specification minimum', p.spec_min], ['specification maximum', p.spec_max], ['target', p.target]];
  for (var i = 0; i < checks.length; i++) {
    var v = checks[i][1];
    if (v === null) continue;
    if ((p.valid_min !== null && v < p.valid_min) || (p.valid_max !== null && v > p.valid_max)) {
      return label + ': the ' + checks[i][0] + ' is outside the valid range (' + (p.valid_min === null ? '…' : p.valid_min) + ' to ' + (p.valid_max === null ? '…' : p.valid_max) + ').';
    }
  }
  return null;
}

function canValidateQuality_(session, area, day) {
  if (isAdmin_(session)) return true;
  return readTable_(T.RESPONSIBILITIES).some(function (r) {
    return r.user_id === session.user.user_id && toBool_(r.active) && r.duty === 'quality_validation' &&
      (!r.valid_from || r.valid_from <= day) && (!r.valid_to || day <= r.valid_to) &&
      (r.scope_type === 'plant' || (r.scope_type === 'line' && r.scope_id === area.line_id) || (r.scope_type === 'area' && r.scope_id === area.area_id));
  });
}

/** `rows`: the parameters to change, each {param_id, spec_min, spec_max, target, valid_min, valid_max, samples_per_day, active, notes}. */
function saveQualityLimits_(session, rows) {
  if (!Array.isArray(rows) || !rows.length) throw apiError_(ERR.BAD_REQUEST, 'Send at least one parameter.');
  if (rows.length > 200) throw apiError_(ERR.BAD_REQUEST, 'At most 200 parameters at a time.');
  var day = Utilities.formatDate(new Date(nowMs_()), TIMEZONE, 'yyyy-MM-dd');
  var areas = {};
  readTable_(T.AREAS).forEach(function (a) { areas[a.area_id] = a; });
  var seen = {};
  withLock_(function () {
    var stored = {};
    readTable_(T.QUALITY_PARAMETERS).forEach(function (p) { stored[p.param_id] = p; });
    var plan = rows.map(function (r) {
      requireObject_(r, 'A parameter');
      var cur = stored[String(r.param_id || '')];
      if (!cur) throw apiError_(ERR.BAD_REQUEST, 'There is no quality parameter ' + String(r.param_id || '').slice(0, 60) + '.');
      if (seen[cur.param_id]) throw apiError_(ERR.BAD_REQUEST, cur.param_id + ' is listed twice.');
      seen[cur.param_id] = true;
      var area = areas[cur.area_id] || { area_id: cur.area_id, line_id: '' };
      if (!canValidateQuality_(session, area, day)) {
        throw apiError_(ERR.FORBIDDEN, 'You do not hold the duty "Quality validation" for ' + cur.area_id + '. An Admin can add it in Settings > Users > Responsibilities.');
      }
      var before = qualityParamOut_(cur);
      var next = {
        area_id: cur.area_id, name: cur.name,
        spec_min: optNumber_(r.spec_min, cur.name + ': specification minimum'), spec_max: optNumber_(r.spec_max, cur.name + ': specification maximum'),
        target: optNumber_(r.target, cur.name + ': target'), valid_min: optNumber_(r.valid_min, cur.name + ': valid minimum'),
        valid_max: optNumber_(r.valid_max, cur.name + ': valid maximum'), samples_per_day: optNumber_(r.samples_per_day, cur.name + ': samples per day'),
        active: r.active !== false, notes: cleanText_(r.notes, 'Notes', false, 300)
      };
      var problem = qualityLimitProblem_(next);
      if (problem) throw apiError_(ERR.BAD_REQUEST, problem);
      var changed = QUALITY_FIELDS.filter(function (f) { return (before[f] === undefined ? null : before[f]) !== next[f]; });
      return { cur: cur, before: before, next: next, changed: changed };
    }).filter(function (x) { return x.changed.length; });
    var now = nowTs_(), by = session.user.user_id;
    plan.forEach(function (x) {
      var patch = { updated_by: by, updated_at: now };
      x.changed.forEach(function (f) { patch[f] = x.next[f] === null ? '' : x.next[f]; });
      updateRow_(T.QUALITY_PARAMETERS, x.cur._row, patch);
    });
    if (plan.length) {
      auditLog_(by, 'save_quality_limits', T.QUALITY_PARAMETERS, plan.map(function (x) { return x.cur.param_id; }).join(','),
        plan.map(function (x) {
          return x.cur.param_id + ' ' + x.changed.map(function (f) {
            var show = function (v) { return v === null || v === '' ? '(blank)' : String(v); };
            return f + ': ' + show(x.before[f]) + ' -> ' + show(x.next[f]);
          }).join(', ');
        }).join('; '));
    }
  });
  return listQualityParameters_();
}
