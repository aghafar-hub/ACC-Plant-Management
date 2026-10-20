import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, bootstrapAdmin, makeUser } from './harness.mjs';

const err = (r) => [r.error.code, r.error.message];

test('getStartup carries the KPI definitions and the stored targets (2.3.0)', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  const s = env.ok('getStartup', admin.token);
  assert.ok(s.kpi_definitions.length >= 24);
  const ea = s.kpi_definitions.find((d) => d.kpi_id === 'EA');
  assert.deepEqual([ea.better, ea.unit, ea.status], ['higher', '%', 'approved']);
  assert.deepEqual(s.kpi_targets, []);
});

test('saveKpiTargets: replaces the set of one scope and year, keeps the others, audits the change', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  let out = env.ok('saveKpiTargets', admin.token, { year: 2026, scope_type: 'plant', scope_id: 'ignored', rows: [
    { kpi_id: 'RF', month: 0, target_value: 95, source: 'Budget 2026' },
    { kpi_id: 'RF', month: 6, target_value: 93 },
    { kpi_id: 'MTTR', month: 0, target_value: null, lower_limit: null },
  ] });
  assert.deepEqual(out.map((r) => [r.scope_id, r.kpi_id, r.month, r.target_value]).sort(), [['', 'RF', 0, 95], ['', 'RF', 6, 93]]);
  env.ok('saveKpiTargets', admin.token, { year: 2026, scope_type: 'area', scope_id: 'K.1', rows: [{ kpi_id: 'RF', month: 0, target_value: 97 }] });
  env.ok('saveKpiTargets', admin.token, { year: 2025, scope_type: 'plant', rows: [{ kpi_id: 'RF', month: 0, target_value: 90 }] });
  // the plant 2026 set again without June: June is removed, the area and 2025 stay
  out = env.ok('saveKpiTargets', admin.token, { year: 2026, scope_type: 'plant', rows: [{ kpi_id: 'RF', month: 0, target_value: 96, source: 'Budget 2026' }] });
  assert.deepEqual(out.map((r) => [r.month, r.target_value]), [[0, 96]]);
  const all = env.ok('getStartup', admin.token).kpi_targets;
  assert.deepEqual(all.map((r) => [r.scope_type, r.scope_id, r.year, r.month, r.target_value]).sort(),
    [['area', 'K.1', 2026, 0, 97], ['plant', '', 2025, 0, 90], ['plant', '', 2026, 0, 96]]);
  const audit = env.rows('audit_log').filter((a) => a.action === 'save_kpi_targets');
  assert.equal(audit.length, 4);
  assert.match(audit[3].detail, /Reliability factor \(RF\) \(2026\) 95 -> 96; - Reliability factor \(RF\) \(2026-6\)/);
  // the same set again changes nothing and is not logged
  env.ok('saveKpiTargets', admin.token, { year: 2026, scope_type: 'plant', rows: [{ kpi_id: 'RF', month: 0, target_value: 96, source: 'Budget 2026' }] });
  assert.equal(env.rows('audit_log').filter((a) => a.action === 'save_kpi_targets').length, 4);
});

test('saveKpiTargets: plain-word checks and the targets duty', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  const save = (tok, p) => env.call('saveKpiTargets', tok, { year: 2026, scope_type: 'plant', rows: [], ...p });
  assert.match(err(save(admin.token, { year: 1999 }))[1], /between 2000 and 2100/);
  assert.match(err(save(admin.token, { scope_type: 'area', scope_id: 'XX' }))[1], /no area XX/);
  assert.match(err(save(admin.token, { rows: [{ kpi_id: 'NOPE', month: 0, target_value: 1 }] }))[1], /Unknown KPI/);
  assert.match(err(save(admin.token, { rows: [{ kpi_id: 'RF', month: 0, target_value: 'x' }] }))[1], /must be a number/);
  assert.match(err(save(admin.token, { rows: [{ kpi_id: 'RF', month: 0, lower_limit: 9, upper_limit: 1 }] }))[1], /lower limit is above/);

  const eng = makeUser(env, admin.token, 'ROLE-REL', 'rel@example.com');
  assert.deepEqual(err(save(eng.token, { rows: [{ kpi_id: 'RF', month: 0, target_value: 95 }] })), ['forbidden', err(save(eng.token, {}))[1]]);
  assert.match(err(save(eng.token, {}))[1], /duty "Targets" for the plant/);
  // a line duty covers that line and its areas, not the plant or another line
  env.ok('saveResponsibilities', admin.token, { userId: eng.user_id, rows: [{ duty: 'targets', scope_type: 'line', scope_id: 'L.1' }] });
  const k1Line = env.ok('getStartup', admin.token).areas.find((a) => a.area_id === 'K.1').line_id;
  assert.equal(k1Line, 'L.1');
  env.ok('saveKpiTargets', eng.token, { year: 2026, scope_type: 'line', scope_id: 'L.1', rows: [{ kpi_id: 'RF', month: 0, target_value: 96 }] });
  env.ok('saveKpiTargets', eng.token, { year: 2026, scope_type: 'area', scope_id: 'K.1', rows: [{ kpi_id: 'RF', month: 0, target_value: 97 }] });
  assert.match(err(save(eng.token, { scope_type: 'line', scope_id: 'L.2' }))[1], /duty "Targets" for L\.2/);
  assert.match(err(save(eng.token, {}))[1], /for the plant/);
});
