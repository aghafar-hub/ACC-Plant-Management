import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, bootstrapAdmin, makeUser, seedMaster, uploadRow } from './harness.mjs';

// 2.2.0: a history import (date-only NRS stops) is an upload of kind 'history', for the Admin role only.
test('history upload: Admin only, events stored as origin history / time_precision day, kind kept on the batch', () => {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  seedMaster(env, admin.token);
  const eng = makeUser(env, admin.token, 'ROLE-ENG', 'e@example.com');
  assert.equal(env.call('uploadStart', eng.token, { fileName: 'h', fileHash: 'h', kind: 'history' }).error.code, 'forbidden');
  assert.equal(env.call('uploadStart', admin.token, { fileName: 'h', fileHash: 'h', kind: 'yearly' }).error.code, 'bad_request');
  const b = env.ok('uploadStart', admin.token, { fileName: 'History NRS.xlsm', fileHash: 'h', kind: 'history' }).batch_id;
  env.ok('uploadChunk', admin.token, { batchId: b, rows: [
    uploadRow({ event_date: '2024-03-05', stop_ts: '2024-03-05 00:00:00.000', start_ts: '2024-03-05 02:00:00.000', code_raw: 'ZZ.99' }),
  ] });
  env.ok('uploadFinish', admin.token, { batchId: b, summary: { rows_read: 1, rows_skipped: 0 }, warnings: [] });
  const ev = env.rows('events')[0];
  assert.equal(ev.origin, 'history');
  assert.equal(ev.time_precision, 'day');
  assert.equal(env.rows('upload_batches').find((x) => x.batch_id === b).kind, 'history');
  // a normal upload is unchanged
  const m = env.ok('uploadStart', eng.token, { fileName: 'oct.xlsx', fileHash: 'm' }).batch_id;
  env.ok('uploadChunk', eng.token, { batchId: m, rows: [uploadRow()] });
  const mon = env.rows('events').find((e) => e.batch_id === m);
  assert.equal(mon.origin || '', '');
  assert.equal(env.rows('upload_batches').find((x) => x.batch_id === m).kind, 'monthly');
  // the digest does not count history rows as records to validate (ZZ.99 is an unknown code)
  const ctx = env.json(env.run('digestContext_().counts'));
  assert.equal(ctx.validate, 0);
});
