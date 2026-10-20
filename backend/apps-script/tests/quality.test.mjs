import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, bootstrapAdmin, makeUser } from './harness.mjs';

const err = (r) => [r.error.code, r.error.message];
const FL = 'K.1.CLINKER.FL';

test('listQualityParameters returns the 52 seeded parameters in order, any signed-in user', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  const viewer = makeUser(env, admin.token, 'ROLE-VIEW', 'v@example.com');
  const list = env.ok('listQualityParameters', viewer.token);
  assert.equal(list.length, 52);
  assert.deepEqual(list.map((p) => p.sort_order), [...list.map((p) => p.sort_order)].sort((a, b) => a - b));
  const fl = list.find((p) => p.param_id === FL);
  assert.deepEqual([fl.spec_min, fl.spec_max, fl.valid_min, fl.valid_max, fl.active], [null, null, 0, 6, true]);
});

test('saveQualityLimits: changes only what differs, audits it, checks the limits in plain words', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  const base = env.ok('listQualityParameters', admin.token).find((p) => p.param_id === FL);
  const row = (over) => ({ param_id: FL, spec_min: base.spec_min, spec_max: base.spec_max, target: base.target, valid_min: base.valid_min, valid_max: base.valid_max,
    samples_per_day: base.samples_per_day, active: true, notes: base.notes, ...over });
  const out = env.ok('saveQualityLimits', admin.token, { rows: [row({ spec_min: 0.5, target: 1.2, spec_max: 2, samples_per_day: 12 })] });
  const fl = out.find((p) => p.param_id === FL);
  assert.deepEqual([fl.spec_min, fl.target, fl.spec_max, fl.samples_per_day], [0.5, 1.2, 2, 12]);
  const audit = env.rows('audit_log').filter((a) => a.action === 'save_quality_limits');
  assert.equal(audit.length, 1);
  assert.match(audit[0].detail, /^K\.1\.CLINKER\.FL spec_min: \(blank\) -> 0\.5, spec_max: \(blank\) -> 2, target: \(blank\) -> 1\.2, samples_per_day: \(blank\) -> 12$/);
  // the same again: nothing changes, nothing logged
  env.ok('saveQualityLimits', admin.token, { rows: [row({ spec_min: 0.5, target: 1.2, spec_max: 2, samples_per_day: 12 })] });
  assert.equal(env.rows('audit_log').filter((a) => a.action === 'save_quality_limits').length, 1);

  const save = (over) => env.call('saveQualityLimits', admin.token, { rows: [row(over)] });
  assert.match(err(save({ spec_min: 3, spec_max: 2 }))[1], /specification minimum is above the maximum/);
  assert.match(err(save({ valid_min: 6, valid_max: 6 }))[1], /valid minimum must be below/);
  assert.match(err(save({ spec_min: 1, spec_max: 2, target: 3 }))[1], /target is outside the specification/);
  assert.match(err(save({ spec_max: 9 }))[1], /specification maximum is outside the valid range \(0 to 6\)/);
  assert.match(err(save({ samples_per_day: 1.5 }))[1], /whole number from 0 to 96/);
  assert.match(err(save({ target: 'x' }))[1], /must be a number/);
  assert.match(err(env.call('saveQualityLimits', admin.token, { rows: [{ param_id: 'NOPE' }] }))[1], /no quality parameter NOPE/);
  assert.match(err(env.call('saveQualityLimits', admin.token, { rows: [] }))[1], /at least one/);
});

test('saveQualityLimits: needs the quality validation duty for the area (a line duty covers its areas)', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  const qc = makeUser(env, admin.token, 'ROLE-QC', 'qc@example.com');
  const save = (param) => env.call('saveQualityLimits', qc.token, { rows: [{ param_id: param, valid_min: 0, valid_max: 6, active: true, notes: 'x' }] });
  assert.deepEqual(err(save(FL))[0], 'forbidden');
  assert.match(err(save(FL))[1], /duty "Quality validation" for K\.1/);
  env.ok('saveResponsibilities', admin.token, { userId: qc.user_id, rows: [{ duty: 'quality_validation', scope_type: 'line', scope_id: 'L.1' }] });
  env.ok('saveQualityLimits', qc.token, { rows: [{ param_id: FL, valid_min: 0, valid_max: 6, active: true, notes: 'x' }] });
  assert.match(err(save('K.2.CLINKER.FL'))[1], /for K\.2/);
});
