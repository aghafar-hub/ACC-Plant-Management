import { describe, expect, it } from 'vitest';
import { createMockApi } from '../api/mockApi';
import { DEMO_PASSWORD } from '../mock/demoAccounts';
import { DEFAULT_SHIFTS, addDays, dayFigures, shiftAt, shiftWindow, unionHours, type ShiftReport, type ShiftStoppage } from './shift';
import { hmToTs } from './useShiftData';

const [DAY, NIGHT] = DEFAULT_SHIFTS as [typeof DEFAULT_SHIFTS[0], typeof DEFAULT_SHIFTS[0]];

describe('shift windows', () => {
  it('day 08-20, night 20-08 belongs to the date it starts', () => {
    expect(shiftWindow(DAY, '2026-10-20')).toEqual({ start: '2026-10-20 08:00:00.000', end: '2026-10-20 20:00:00.000' });
    expect(shiftWindow(NIGHT, '2026-10-20')).toEqual({ start: '2026-10-20 20:00:00.000', end: '2026-10-21 08:00:00.000' });
    expect(shiftAt(DEFAULT_SHIFTS, '2026-10-21 03:15:00.000')).toMatchObject({ day: '2026-10-20', shift: { shift_id: 'N' } });
    expect(shiftAt(DEFAULT_SHIFTS, '2026-10-21 08:00:00.000')).toMatchObject({ day: '2026-10-21', shift: { shift_id: 'D' } });
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('a typed time after midnight in a night shift is the next day', () => {
    const w = shiftWindow(NIGHT, '2026-10-20');
    expect(hmToTs(w, '22:30')).toBe('2026-10-20 22:30:00.000');
    expect(hmToTs(w, '03:05')).toBe('2026-10-21 03:05:00.000');
    expect(hmToTs(shiftWindow(DAY, '2026-10-20'), '09:00')).toBe('2026-10-20 09:00:00.000');
  });
  it('overlapping stops count once and are clipped to the window', () => {
    expect(unionHours([['2026-10-20 07:00:00.000', '2026-10-20 10:00:00.000'], ['2026-10-20 09:00:00.000', '2026-10-20 11:00:00.000']], '2026-10-20 08:00:00.000', '2026-10-21 08:00:00.000')).toBe(3);
  });
});

const rep = (over: Partial<ShiftReport>): ShiftReport => ({
  report_id: 'R', report_date: '2026-10-20', shift_id: 'D', area_id: 'K.1', line_id: 'L.1', status: 'submitted', source: 'app', entered_by: '', entered_at: '', submitted_by: '', submitted_at: '',
  prod_reviewed_by: '', prod_reviewed_at: '', rel_validated_by: '', rel_validated_at: '', posted_at: '', returned_by: '', returned_at: '', return_stage: '', return_comment: '', notes: '', updated_by: '', updated_at: '', ...over,
});
const stop = (over: Partial<ShiftStoppage>): ShiftStoppage => ({
  stop_id: 'S', report_id: 'R', area_id: 'K.1', line_id: 'L.1', code_raw: 'X', equipment_id: '', stop_ts: '', start_ts: '', duration_s: null, freq: 1, classification: 'MEC', criticality: 'INC',
  is_failure: true, reason_raw: '', reason_id: '', description: '', flags: '', stop_state: 'closed', closed_report_id: '', closed_by: '', closed_at: '', row_state: 'active', posted_event_id: '',
  created_by: '', created_at: '', updated_by: '', updated_at: '', ...over,
});

describe('daily meeting figures', () => {
  it('a full past day: stop hours, incident hours, RF, UF, failures, open stops and late reports', () => {
    const stops = [
      stop({ stop_id: 'a', stop_ts: '2026-10-20 10:00:00.000', start_ts: '2026-10-20 12:00:00.000' }), // 2 h MEC failure
      stop({ stop_id: 'b', stop_ts: '2026-10-20 11:00:00.000', start_ts: '2026-10-20 13:00:00.000', classification: 'PL', criticality: 'NO_INC', is_failure: false }), // overlaps 1 h
      stop({ stop_id: 'c', stop_ts: '2026-10-21 06:00:00.000', start_ts: '', stop_state: 'open' }), // still stopped at 08:00 next day: 2 h in this day
      stop({ stop_id: 'd', area_id: 'K.2', stop_ts: '2026-10-20 10:00:00.000', start_ts: '2026-10-20 11:00:00.000' }),
    ];
    const reports = [rep({ report_id: 'R', status: 'validated' })];
    const f = dayFigures('K.1', '2026-10-20', DEFAULT_SHIFTS, reports, stops, '2026-10-22 12:00:00.000');
    expect(f.stopH).toBeCloseTo(5); // 10-13 merged (3 h) + 06-08 (2 h)
    expect(f.incH).toBeCloseTo(4); // a (2 h) + c (2 h)
    expect(f.plH).toBeCloseTo(2);
    expect(f.runH).toBeCloseTo(19);
    expect(f.rf).toBeCloseTo(19 / 23);
    expect(f.uf).toBeCloseTo(19 / 24);
    expect(f.failures).toBe(2);
    expect(f.open).toBe(1);
    expect(f.reports).toEqual([{ shift_id: 'D', status: 'validated', late: false }, { shift_id: 'N', status: 'missing', late: true }]);
    expect(f.provisional).toBe(false);
  });
  it('today so far: hours up to now, not-yet-late reports, provisional until validated', () => {
    const f = dayFigures('K.1', '2026-10-20', DEFAULT_SHIFTS, [rep({ status: 'draft' })], [stop({ stop_ts: '2026-10-20 09:00:00.000', start_ts: '', stop_state: 'open' })], '2026-10-20 12:00:00.000');
    expect(f.stopH).toBeCloseTo(3);
    expect(f.uf).toBeCloseTo(1 / 4);
    expect(f.reports.map((r) => r.late)).toEqual([false, false]);
    expect(f.provisional).toBe(true);
  });
});

describe('mock api: shift reports (mirrors ShiftReports.js)', () => {
  it('entry, restart by a later shift, production approval, reliability validation and posting to events', async () => {
    const a = createMockApi({ seed: 3 });
    const now = new Date();
    const y = addDays(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, -2);
    const admin = await a.login('admin@demo.test', DEMO_PASSWORD, false);
    const before = (await a.getEvents(admin.token, Number(y.slice(0, 4)))).length;
    const b = await a.saveShiftReport(admin.token, { report_date: y, shift_id: 'D', area_id: 'K.1', notes: 'n', submit: true, stoppages: [
      { code_raw: '', stop_ts: `${y} 09:00`, start_ts: `${y} 10:00`, classification: 'MEC', is_failure: true, reason_raw: 'x', description: '' },
      { code_raw: '', stop_ts: `${y} 19:00`, start_ts: '', classification: 'ELE', is_failure: true, reason_raw: 'y', description: '' },
    ] });
    expect(b.report.status).toBe('submitted');
    const open = b.stoppages.find((s) => s.stop_state === 'open')!;
    await expect(a.closeShiftStoppage(admin.token, { stop_id: open.stop_id, report_date: y, shift_id: 'D', start_ts: `${y} 19:30` })).rejects.toMatchObject({ code: 'bad_request' });
    const n = await a.closeShiftStoppage(admin.token, { stop_id: open.stop_id, report_date: y, shift_id: 'N', start_ts: `${y} 23:00` });
    expect(n.report.report_id).toBe(`SR-${y.replace(/-/g, '')}-N-K.1`);
    await a.reviewShiftReport(admin.token, { report_id: b.report.report_id, decision: 'approve', comment: '', edits: [] });
    const v = await a.reviewShiftReport(admin.token, { report_id: b.report.report_id, decision: 'validate', comment: '', edits: [] });
    expect(v.report.status).toBe('validated'); // the long stop waits for the night report
    await a.saveShiftReport(admin.token, { report_date: y, shift_id: 'N', area_id: 'K.1', notes: '', submit: true, stoppages: [] });
    await a.reviewShiftReport(admin.token, { report_id: n.report.report_id, decision: 'approve', comment: '', edits: [] });
    const nv = await a.reviewShiftReport(admin.token, { report_id: n.report.report_id, decision: 'validate', comment: '', edits: [] });
    expect(nv.report.status).toBe('posted');
    const events = (await a.getEvents(admin.token, Number(y.slice(0, 4)))).filter((e) => e.origin === 'shift');
    expect(events).toHaveLength(2);
    expect((await a.getEvents(admin.token, Number(y.slice(0, 4)))).length).toBe(before + 2);
    const list = await a.listShiftReports(admin.token, y, y);
    expect(list.reports.map((r) => r.status).sort()).toEqual(['posted', 'posted']);
    const h = await a.getShiftReportHistory(admin.token, b.report.report_id);
    expect(h.log.map((l) => l.action)).toEqual(['create', 'submit', 'approve', 'validate', 'post']);
  });
  it('duties are needed (Admin aside) and the viewer cannot enter', async () => {
    const a = createMockApi({ seed: 4 });
    const viewer = await a.login('viewer@demo.test', DEMO_PASSWORD, false);
    await expect(a.saveShiftReport(viewer.token, { report_date: '2026-10-01', shift_id: 'D', area_id: 'K.1', notes: '', submit: false, stoppages: [] })).rejects.toMatchObject({ code: 'forbidden' });
    const eng = await a.login('engineer@demo.test', DEMO_PASSWORD, false);
    expect((await a.listShiftReports(eng.token, '2026-10-01', '2026-10-02')).reports).toEqual([]);
  });
});
