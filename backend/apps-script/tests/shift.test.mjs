import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, bootstrapAdmin, makeUser, seedMaster } from './harness.mjs';

// Plant system step B/C (backend 2.1.0): shift reports, restarts entered by a later shift, the two reviews and posting.
// The test clock is 2026-10-12 11:00 plant time, so the shifts of 2026-10-11 are over.

const err = (r) => [r.error.code, r.error.message];
const stop = (over = {}) => ({ code_raw: '100.AA01', stop_ts: '2026-10-11 09:00', start_ts: '2026-10-11 10:30', classification: 'MEC', is_failure: true, reason_raw: 'Bearing failure', description: '', ...over });

function setup() {
  const env = createEnv();
  const admin = bootstrapAdmin(env);
  seedMaster(env, admin.token);
  const people = {};
  for (const [key, role, duty] of [['leader', 'ROLE-SHIFT', 'shift_entry'], ['leader2', 'ROLE-SHIFT', 'shift_entry'], ['prod', 'ROLE-PROD', 'production_review'], ['rel', 'ROLE-REL', 'reliability_validation']]) {
    people[key] = makeUser(env, admin.token, role, `${key}@example.com`);
    env.ok('saveResponsibilities', admin.token, { userId: people[key].user_id, rows: [{ duty, scope_type: 'line', scope_id: 'L.1' }] });
  }
  const save = (who, report) => env.call('saveShiftReport', people[who].token, { report: { report_date: '2026-10-11', shift_id: 'D', area_id: 'K.1', notes: '', submit: false, stoppages: [], ...report } });
  const review = (who, review) => env.call('reviewShiftReport', people[who].token, { review: { report_id: 'SR-20261011-D-K.1', comment: '', edits: [], ...review } });
  return { env, admin, people, save, review };
}

test('entry: duties, the shift window, open stoppages, blocking problems and submit', () => {
  const { env, admin, people, save } = setup();
  const view = makeUser(env, admin.token, 'ROLE-VIEW', 'v@example.com');
  assert.equal(env.call('saveShiftReport', view.token, { report: {} }).error.code, 'forbidden'); // no Shift reports Edit
  // a shift leader of line 1 only
  assert.match(err(save('leader', { area_id: 'RM.2' }))[1], /no area RM\.2|does not hold|duty/);
  assert.match(err(save('leader', { stoppages: [stop({ stop_ts: '2026-10-11 07:30' })] }))[1], /outside this shift/);
  assert.match(err(save('leader', { stoppages: [stop({ start_ts: '2026-10-11 21:00' })] }))[1], /after this shift ends/);
  assert.match(err(save('leader', { report_date: '2026-10-13' }))[1], /not started yet/);
  // a draft may hold an unfinished row; submit refuses it
  let b = env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-11', shift_id: 'D', area_id: 'K.1', notes: 'Kiln feed low', submit: false,
    stoppages: [stop(), stop({ stop_ts: '2026-10-11 18:40', start_ts: '', classification: '' })] } });
  assert.equal(b.report.status, 'draft');
  assert.equal(b.report.report_id, 'SR-20261011-D-K.1');
  const open = b.stoppages.find((s) => s.stop_state === 'open');
  assert.equal(open.start_ts, '');
  assert.equal(open.duration_s, null);
  assert.match(open.flags, /missing_classification/);
  const done = b.stoppages.find((s) => s.stop_state === 'closed');
  assert.equal(done.duration_s, 5400);
  assert.equal(done.criticality, 'INC');
  assert.equal(done.equipment_id, '100.AA01');
  assert.match(err(save('leader', { stoppages: b.stoppages.map(keep), submit: true }))[1], /must be fixed first/);
  // fix it and submit
  b = env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-11', shift_id: 'D', area_id: 'K.1', notes: '', submit: true,
    stoppages: b.stoppages.map((s) => keep(s.stop_state === 'open' ? { ...s, classification: 'ELE', reason_raw: 'Motor trip' } : s)) } });
  assert.equal(b.report.status, 'submitted');
  assert.equal(b.report.submitted_by, people.leader.user_id);
  // after submit the shift leader cannot change it
  assert.equal(save('leader', { stoppages: [] }).error.code, 'conflict');
  // PL / CIR are never failures
  const p = env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-11', shift_id: 'D', area_id: 'RM.1', notes: '', submit: false, stoppages: [stop({ classification: 'PL', is_failure: true })] } });
  assert.equal(p.stoppages[0].is_failure, false);
  assert.equal(p.stoppages[0].criticality, 'NO_INC');
});

function keep(s) { return { stop_id: s.stop_id, code_raw: s.code_raw, stop_ts: s.stop_ts, start_ts: s.start_ts, classification: s.classification, is_failure: s.is_failure, reason_raw: s.reason_raw, description: s.description }; }

test('a later shift enters the restart; the stoppage is posted only when both reports are validated', () => {
  const { env, admin, people, save, review } = setup();
  let b = env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-11', shift_id: 'D', area_id: 'K.1', notes: '', submit: true,
    stoppages: [stop(), stop({ stop_ts: '2026-10-11 18:40', start_ts: '', classification: 'ELE', reason_raw: 'Motor trip' })] } });
  const open = b.stoppages.find((s) => s.stop_state === 'open');
  // the night shift (another leader) enters the restart
  assert.match(err(env.call('closeShiftStoppage', people.leader2.token, { restart: { stop_id: open.stop_id, report_date: '2026-10-11', shift_id: 'N', start_ts: '2026-10-12 09:00' } }))[1], /outside your shift/);
  assert.match(err(env.call('closeShiftStoppage', people.leader2.token, { restart: { stop_id: open.stop_id, report_date: '2026-10-11', shift_id: 'D', start_ts: '2026-10-11 19:00' } }))[1], /belongs to this shift/);
  const night = env.ok('closeShiftStoppage', people.leader2.token, { restart: { stop_id: open.stop_id, report_date: '2026-10-11', shift_id: 'N', start_ts: '2026-10-11 23:10' } });
  assert.equal(night.report.report_id, 'SR-20261011-N-K.1');
  assert.equal(night.report.status, 'draft');
  const closed = night.stoppages.find((s) => s.stop_id === open.stop_id);
  assert.equal(closed.stop_state, 'closed');
  assert.equal(closed.closed_report_id, 'SR-20261011-N-K.1');
  assert.equal(closed.duration_s, (4 * 60 + 30) * 60);
  // the day leader can no longer remove it from the day report... (it is submitted anyway); the night leader submits
  env.ok('saveShiftReport', people.leader2.token, { report: { report_date: '2026-10-11', shift_id: 'N', area_id: 'K.1', notes: '', submit: true, stoppages: [] } });

  // the entering person may not review their own report
  env.ok('saveResponsibilities', admin.token, { userId: people.leader.user_id, rows: [{ duty: 'shift_entry', scope_type: 'line', scope_id: 'L.1' }, { duty: 'production_review', scope_type: 'plant' }] });
  assert.match(err(review('leader', { decision: 'approve' }))[1], /someone else must review/);
  // only the right duty acts at each step
  assert.match(err(review('rel', { decision: 'validate' }))[1], /production review first/);
  assert.equal(review('leader2', { decision: 'approve' }).error.code, 'forbidden');
  assert.equal(review('prod', { decision: 'approve' }).status, 'ok');
  assert.match(err(review('prod', { decision: 'approve' }))[1], /validate or return/);
  // reliability corrects the reason, then validates: the day stoppage that is closed is posted at once;
  // the open one waits for the night report
  b = env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-10', shift_id: 'D', area_id: 'K.1', notes: '', submit: false, stoppages: [] } }); // unrelated
  const day = env.rows('shift_stoppages').find((s) => s.stop_ts === '2026-10-11 09:00:00.000');
  const v = review('rel', { decision: 'validate', comment: 'Reason checked', edits: [{ stop_id: day.stop_id, changes: { reason_raw: 'Motor trip', classification: 'ELE' } }] });
  assert.equal(v.status, 'ok');
  assert.equal(v.data.report.status, 'validated', 'the long stop is not posted yet, so the report stays validated');
  let events = env.rows('events').filter((e) => e.origin === 'shift');
  assert.equal(events.length, 1);
  assert.equal(events[0].classification, 'ELE');
  assert.equal(events[0].shift_stop_id, day.stop_id);
  assert.equal(events[0].time_precision, 'exact');
  const edits = env.ok('getShiftReportHistory', people.rel.token, { reportId: 'SR-20261011-D-K.1' });
  assert.deepEqual(edits.edits.filter((e) => e.stage === 'reliability').map((e) => e.field).sort(), ['classification', 'reason_raw']);
  assert.deepEqual(edits.log.map((l) => l.action), ['create', 'submit', 'approve', 'validate']);

  // the night report goes through both steps; then the long stop is posted and both reports are Posted
  env.call('reviewShiftReport', people.prod.token, { review: { report_id: 'SR-20261011-N-K.1', decision: 'approve', comment: '', edits: [] } });
  const n = env.ok('reviewShiftReport', people.rel.token, { review: { report_id: 'SR-20261011-N-K.1', decision: 'validate', comment: '', edits: [] } });
  assert.equal(n.report.status, 'posted');
  events = env.rows('events').filter((e) => e.origin === 'shift');
  assert.equal(events.length, 2);
  const long = events.find((e) => e.shift_stop_id === open.stop_id);
  assert.equal(long.start_ts, '2026-10-11 23:10:00.000');
  assert.equal(long.batch_id, 'SR-20261011-N-K.1');
  assert.equal(env.rows('shift_reports').find((r) => r.report_id === 'SR-20261011-D-K.1').status, 'posted');
  // the events are in the downtime analysis
  assert.equal(env.ok('getEvents', admin.token, { year: 2026 }).filter((e) => e.origin === 'shift').length, 2);
});

test('returns: production to the shift leader, reliability to production; changes after a return are logged', () => {
  const { env, people, save, review } = setup();
  const b = env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-11', shift_id: 'D', area_id: 'K.1', notes: '', submit: true, stoppages: [stop()] } });
  assert.match(err(review('prod', { decision: 'return' }))[1], /Say why/);
  let r = env.ok('reviewShiftReport', people.prod.token, { review: { report_id: b.report.report_id, decision: 'return', comment: 'Code is wrong', edits: [] } });
  assert.equal(r.report.status, 'returned');
  assert.equal(r.report.return_stage, 'production');
  r = env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-11', shift_id: 'D', area_id: 'K.1', notes: '', submit: true, stoppages: [keep({ ...b.stoppages[0], code_raw: '100.AB02' })] } });
  assert.equal(r.report.status, 'submitted');
  const hist = env.ok('getShiftReportHistory', people.prod.token, { reportId: b.report.report_id });
  assert.deepEqual(hist.edits.map((e) => [e.stage, e.field, e.old_value, e.new_value]), [['entry', 'code_raw', '100.AA01', '100.AB02']]);
  env.ok('reviewShiftReport', people.prod.token, { review: { report_id: b.report.report_id, decision: 'approve', comment: '', edits: [] } });
  r = env.ok('reviewShiftReport', people.rel.token, { review: { report_id: b.report.report_id, decision: 'return', comment: 'Check the classification', edits: [] } });
  assert.equal(r.report.status, 'submitted', 'a reliability return goes back to production');
  assert.equal(r.report.return_stage, 'reliability');
  assert.equal(env.rows('events').filter((e) => e.origin === 'shift').length, 0);
  // reviewers cannot touch fields that are not stoppage fields
  assert.match(err(review('prod', { decision: 'approve', edits: [{ stop_id: b.stoppages[0].stop_id, changes: { area_id: 'K.2' } }] }))[1], /cannot be changed/);
  assert.ok(save); // keeps the helper used
});

test('a validated stoppage that is already stored (uploaded workbook) is linked, never added twice', () => {
  const { env, admin, people } = setup();
  const up = env.ok('uploadStart', admin.token, { fileName: 'oct.xlsx', fileHash: 'h' }).batch_id;
  env.ok('uploadChunk', admin.token, { batchId: up, rows: [{ source_row: 2, event_date: '2026-10-11', line_id: 'L.1', area_id: 'K.1', code_raw: '100.AA01', stop_ts: '2026-10-11 09:00:00.000', start_ts: '2026-10-11 10:30:00.000', freq: 1, classification: 'MEC', criticality: 'INC', is_failure: true, reason_raw: 'Bearing failure', description: '', fingerprint: '' }] });
  const before = env.rows('events').length;
  const b = env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-11', shift_id: 'D', area_id: 'K.1', notes: '', submit: true, stoppages: [stop()] } });
  env.ok('reviewShiftReport', people.prod.token, { review: { report_id: b.report.report_id, decision: 'approve', comment: '', edits: [] } });
  const v = env.ok('reviewShiftReport', people.rel.token, { review: { report_id: b.report.report_id, decision: 'validate', comment: '', edits: [] } });
  assert.equal(v.report.status, 'posted');
  assert.equal(env.rows('events').length, before);
  assert.equal(v.stoppages[0].posted_event_id, env.rows('events')[0].event_id);
});

test('listShiftReports: a date range, open stoppages from earlier days, at most 62 days', () => {
  const { env, people } = setup();
  env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-09', shift_id: 'N', area_id: 'K.1', notes: '', submit: false, stoppages: [stop({ stop_ts: '2026-10-09 23:00', start_ts: '' })] } });
  env.ok('saveShiftReport', people.leader.token, { report: { report_date: '2026-10-11', shift_id: 'D', area_id: 'K.1', notes: '', submit: false, stoppages: [stop()] } });
  const l = env.ok('listShiftReports', people.prod.token, { from: '2026-10-11', to: '2026-10-11' });
  assert.deepEqual(l.reports.map((r) => r.report_id).sort(), ['SR-20261009-N-K.1', 'SR-20261011-D-K.1']);
  assert.equal(l.stoppages.length, 2);
  assert.deepEqual(l.shifts.map((s) => [s.shift_id, s.start_time, s.end_time]), [['D', '08:00', '20:00'], ['N', '20:00', '08:00']]);
  assert.match(err(env.call('listShiftReports', people.prod.token, { from: '2026-01-01', to: '2026-10-11' }))[1], /at most 62 days/);
});
