import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, bootstrapAdmin, makeUser, seedMaster, uploadAll, uploadRow, startBatch } from './harness.mjs';

const err = (r) => [r.error.code, r.error.message];
const step = (env, tok, p) => env.call('closeMonthStep', tok, { section: 'downtime', year: 2026, month: 3, ...p });

test('closing: review, sign-off by another person, the lock, reopen with a reason', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  seedMaster(env, admin.token);
  uploadAll(env, admin.token, [uploadRow(), uploadRow({ code_raw: 'ZZ.99' })]);
  const eng = makeUser(env, admin.token, 'ROLE-REL', 'rel@example.com');
  const mgr = makeUser(env, admin.token, 'ROLE-PROD', 'mgr@example.com');
  env.ok('saveResponsibilities', admin.token, { userId: eng.user_id, rows: [{ duty: 'month_review', section: 'downtime', scope_type: 'plant' }, { duty: 'month_signoff', section: 'downtime', scope_type: 'plant' }] });
  env.ok('saveResponsibilities', admin.token, { userId: mgr.user_id, rows: [{ duty: 'month_signoff', section: 'downtime', scope_type: 'plant' }] });

  // duties and order
  assert.match(err(step(env, mgr.token, { step: 'review' }))[1], /duty "Month review" for Downtime and reliability/);
  assert.match(err(step(env, mgr.token, { step: 'signoff' }))[1], /section engineer reviews March 2026 first/);
  assert.match(err(step(env, eng.token, { step: 'review', month: 12 }))[1], /has not ended yet/);
  // one record still has a problem (unknown code): a comment is needed
  assert.match(err(step(env, eng.token, { step: 'review' }))[1], /1 records of March 2026 still need checking/);
  let c = env.ok('closeMonthStep', eng.token, { section: 'downtime', year: 2026, month: 3, step: 'review', comment: 'ZZ.99 is a new fan, master data follows' });
  assert.deepEqual([c.status, c.open_checks, c.reviewed_by], ['reviewed', 1, eng.user_id]);
  assert.match(err(step(env, eng.token, { step: 'signoff' }))[1], /another person/);
  c = env.ok('closeMonthStep', mgr.token, { section: 'downtime', year: 2026, month: 3, step: 'signoff' });
  assert.deepEqual([c.status, c.signed_off_by], ['signed_off', mgr.user_id]);
  assert.equal(env.ok('getStartup', admin.token).month_closings.length, 1);

  // the lock
  const ev = env.rows('events').find((e) => e.code_raw === '100.AA01');
  const locked = /downtime of March 2026 is signed off and locked/;
  assert.deepEqual(err(env.call('editEvent', admin.token, { eventId: ev.event_id, changes: { reason_raw: 'Other' }, note: 'test' }))[0], 'conflict');
  assert.match(err(env.call('editEvent', admin.token, { eventId: ev.event_id, changes: { reason_raw: 'Other' }, note: 'test' }))[1], locked);
  assert.match(err(env.call('voidEvent', admin.token, { eventId: ev.event_id, isVoid: true, note: 'test' }))[1], locked);
  const warn = env.rows('events').find((e) => e.code_raw === 'ZZ.99');
  assert.match(err(env.call('acceptEventFlags', admin.token, { eventId: warn.event_id, flags: ['unknown_code'], note: 'checked and fine' }))[1], locked);
  const bulk = env.ok('acceptEventFlagsBulk', admin.token, { items: [{ eventId: warn.event_id, flags: ['unknown_code'] }], note: 'checked and fine' });
  assert.match(bulk.failed[0].message, locked);
  // an April record may not be moved into March either
  uploadAll(env, admin.token, [uploadRow({ event_date: '2026-04-02', stop_ts: '2026-04-02 08:00:00.000', start_ts: '2026-04-02 09:00:00.000' })], 'april.xlsx');
  const apr = env.rows('events').find((e) => e.event_date === '2026-04-02');
  assert.match(err(env.call('editEvent', admin.token, { eventId: apr.event_id, changes: { stop_ts: '2026-03-31 08:00:00.000' }, note: 'move' }))[1], locked);
  // upload rows dated in March are refused row by row; April goes in
  const batchId = startBatch(env, admin.token, 'late.xlsx');
  const res = env.ok('uploadChunk', admin.token, { batchId, rows: [uploadRow(), uploadRow({ event_date: '2026-04-03', stop_ts: '2026-04-03 08:00:00.000', start_ts: '2026-04-03 09:00:00.000' })] });
  assert.equal(res.added, 1);
  assert.match(res.rejected[0].reason, locked);
  // Re-check leaves the month alone
  const before = env.rows('events').filter((e) => e.event_date.startsWith('2026-03')).length;
  const rc = env.ok('revalidateEvents', admin.token, {});
  assert.equal(rc.checked, env.rows('events').filter((e) => !e.is_void).length - before);

  // reopen: the manager, with a reason; then it can change again and must be reviewed and signed off again
  assert.match(err(step(env, eng.token, { step: 'reopen', comment: 'x' }))[1], /at least 10 characters/);
  assert.match(err(step(env, admin.token, { step: 'review', comment: 'again please' }))[1], /already signed off/);
  c = env.ok('closeMonthStep', mgr.token, { section: 'downtime', year: 2026, month: 3, step: 'reopen', comment: 'Wrong classification on K.1' });
  assert.deepEqual([c.status, c.reviewed_by, c.signed_off_by, c.reopened_by], ['reopened', '', '', mgr.user_id]);
  env.ok('editEvent', admin.token, { eventId: ev.event_id, changes: { reason_raw: 'Other' }, note: 'fixed after reopen' });
  assert.match(err(step(env, mgr.token, { step: 'signoff' }))[1], /reviews March 2026 first/);
  const audit = env.rows('audit_log').map((a) => a.action);
  for (const a of ['month_review', 'month_signoff', 'month_reopen']) assert.ok(audit.includes(a), a);
});

test('closing: the plant report needs the three sections; checks in plain words', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  assert.match(err(step(env, admin.token, { section: 'plant', step: 'review' }))[1], /no review step/);
  assert.match(err(step(env, admin.token, { section: 'plant', step: 'signoff' }))[1], /Sign off Downtime and reliability, Production, Quality of March 2026 first/);
  for (const s of ['downtime', 'production', 'quality']) {
    env.ok('closeMonthStep', admin.token, { section: s, year: 2026, month: 3, step: 'review' });
    env.ok('closeMonthStep', admin.token, { section: s, year: 2026, month: 3, step: 'signoff' });
  }
  assert.equal(env.ok('closeMonthStep', admin.token, { section: 'plant', year: 2026, month: 3, step: 'signoff' }).status, 'signed_off');
  assert.match(err(step(env, admin.token, { section: 'nope', step: 'review' }))[1], /Section must be/);
  assert.match(err(step(env, admin.token, { month: 13, step: 'review' }))[1], /Choose a month/);
  assert.match(err(step(env, admin.token, { step: 'close' }))[1], /Step must be/);
  assert.match(err(step(env, admin.token, { step: 'reopen', month: 4, comment: 'a long enough reason' }))[1], /Only a signed-off month/);
});
