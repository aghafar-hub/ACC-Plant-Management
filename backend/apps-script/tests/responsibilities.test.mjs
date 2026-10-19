import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, bootstrapAdmin, makeUser } from './harness.mjs';

const err = (r) => [r.error.code, r.error.message];

test('saveResponsibilities: replaces the set, keeps removed rows switched off, audits the change', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  const s = makeUser(env, admin.token, 'ROLE-SHIFT', 'shift@example.com');
  let out = env.ok('saveResponsibilities', admin.token, { userId: s.user_id, rows: [
    { duty: 'shift_entry', scope_type: 'area', scope_id: 'K.1' },
    { duty: 'shift_entry', scope_type: 'area', scope_id: 'K.2', is_backup: true, valid_from: '2026-10-01', valid_to: '2026-10-31' },
  ] });
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((r) => [r.duty, r.scope_id, r.is_backup]).sort(), [['shift_entry', 'K.1', false], ['shift_entry', 'K.2', true]]);
  out = env.ok('saveResponsibilities', admin.token, { userId: s.user_id, rows: [{ duty: 'shift_entry', scope_type: 'area', scope_id: 'K.1' }] });
  assert.equal(out.length, 1);
  const rows = env.rows('responsibilities');
  assert.equal(rows.length, 2, 'the K.1 row is kept as it was, the K.2 row is switched off');
  assert.equal(rows.find((r) => r.scope_id === 'K.2').active, false);
  const audit = env.rows('audit_log').filter((a) => a.action === 'set_responsibilities');
  assert.equal(audit.length, 2);
  assert.match(audit[1].detail, /^- shift_entry @ K\.2 backup 2026-10-01\.\.2026-10-31$/);
  assert.equal(env.ok('listResponsibilities', admin.token).length, 1);
});

test('saveResponsibilities: sections, scopes, dates and duplicates are checked in plain words', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  const u = makeUser(env, admin.token, 'ROLE-REL', 'rel@example.com');
  const save = (rows) => env.call('saveResponsibilities', admin.token, { userId: u.user_id, rows });
  assert.match(err(save([{ duty: 'boss', scope_type: 'plant' }]))[1], /Unknown duty/);
  assert.match(err(save([{ duty: 'month_review', scope_type: 'plant' }]))[1], /Choose the section/);
  assert.match(err(save([{ duty: 'shift_entry', section: 'quality', scope_type: 'plant' }]))[1], /Only month review/);
  assert.match(err(save([{ duty: 'shift_entry', scope_type: 'area', scope_id: 'XX' }]))[1], /no area XX/);
  assert.match(err(save([{ duty: 'shift_entry', scope_type: 'line', scope_id: 'L.9' }]))[1], /no line L\.9/);
  assert.match(err(save([{ duty: 'targets', scope_type: 'plant', valid_from: '2026-11-01', valid_to: '2026-10-01' }]))[1], /before valid from/);
  assert.match(err(save([{ duty: 'targets', scope_type: 'plant', valid_from: '2026-02-30' }]))[1], /date like/);
  assert.match(err(save([{ duty: 'targets', scope_type: 'plant' }, { duty: 'targets', scope_type: 'plant', scope_id: 'ignored' }]))[1], /listed twice/);
  assert.equal(err(env.call('saveResponsibilities', admin.token, { userId: 'U-missing', rows: [] }))[0], 'not_found');
  const ok = env.ok('saveResponsibilities', admin.token, { userId: u.user_id, rows: [
    { duty: 'month_review', section: 'downtime', scope_type: 'plant' },
    { duty: 'reliability_validation', scope_type: 'line', scope_id: 'L.2' },
  ] });
  assert.deepEqual(ok.map((r) => r.section).sort(), ['', 'downtime']);
});

test('saveResponsibilities: Users Edit needed; only an Admin changes an Admin', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  const v = makeUser(env, admin.token, 'ROLE-VIEW', 'v@example.com');
  assert.equal(env.call('saveResponsibilities', v.token, { userId: v.user_id, rows: [] }).error.code, 'forbidden');
  assert.equal(env.call('listResponsibilities', v.token).error.code, 'forbidden');
  const mgr = makeUser(env, admin.token, 'ROLE-MGR', 'm@example.com');
  env.ok('setUserTabAccess', admin.token, { userId: mgr.user_id, overrides: { users: 'Edit' } });
  assert.equal(env.call('saveResponsibilities', mgr.token, { userId: admin.user_id, rows: [] }).error.code, 'forbidden');
  env.ok('saveResponsibilities', mgr.token, { userId: v.user_id, rows: [{ duty: 'daily_meeting', scope_type: 'plant' }] });
});
