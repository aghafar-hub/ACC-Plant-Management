import { describe, expect, it } from 'vitest';
import { extractHistory, packHistory, planHistory } from './historyImport';

const HEAD = ['DATE ', 'LINE', 'EQUIPMENT', 'EQUIPMENT CODE', 'TOTAL STOPPAGE DURATION (h)', 'STOPPAGE CLASSIFICATION', 'CRITICALITY', 'REASON', 'Failure', 'DESCRIPTION'];
// Excel serial 45292 = 2024-01-01
const row = (serial: number, area: string, h: number | null, cls = 'MEC', fail: string | null = 'YES', reason = 'Bearing', code = '111.FY030') =>
  [serial, 'L.1', area, code, h, cls, cls === 'PL' || cls === 'CIR' ? 'NO_INC' : 'INC', reason, fail, null];

describe('history import (NRS MS.Downtime, date only)', () => {
  it('cleans the values and refuses a sheet without the history headings', () => {
    expect(extractHistory([['DATE', 'Stop Time']]).ok).toBe(false);
    const ex = extractHistory([HEAD, row(45292, 'CR', 1.5, 'Mec', 'Yes', ' Full Silos'), row(45292, 'CR', null), row(45292, 'CR', 2, 'PL', 'YES')]);
    if (!ex.ok) throw new Error('refused');
    expect(ex.raw).toHaveLength(2);
    expect(ex.raw[0]).toMatchObject({ date: '2024-01-01', classification: 'MEC', failure: true, reason: 'Full Silos', criticality: 'INC', hours: 1.5 });
    expect(ex.raw[1]).toMatchObject({ classification: 'PL', failure: false }); // PL is never a failure
    expect(ex.skipped).toEqual([{ source_row: 3, why: 'no stoppage hours' }]);
    expect(ex.fixes).toEqual({ classification: 1, failure: 1, trimmed: 1 });
  });

  it('lays the stops of a day end to end from 00:00; a day over 24 h carries over and is listed', () => {
    const ex = extractHistory([HEAD, row(45292, 'K.1', 2), row(45292, 'K.1', 0.5), row(45292, 'CR', 23), row(45292, 'CR', 3), row(45293, 'CR', 1), row(45293, 'K.1', 1)]);
    if (!ex.ok) throw new Error('refused');
    const p = packHistory(ex.raw);
    const k1 = p.rows.filter((r) => r.area_id === 'K.1');
    expect(k1.map((r) => [r.stop_ts, r.start_ts])).toEqual([
      ['2024-01-01 00:00:00.000', '2024-01-01 02:00:00.000'],
      ['2024-01-01 02:00:00.000', '2024-01-01 02:30:00.000'],
      ['2024-01-02 00:00:00.000', '2024-01-02 01:00:00.000'],
    ]);
    const cr = p.rows.filter((r) => r.area_id === 'CR');
    expect(cr.map((r) => [r.event_date, r.stop_ts, r.start_ts])).toEqual([
      ['2024-01-01', '2024-01-01 00:00:00.000', '2024-01-01 23:00:00.000'],
      ['2024-01-01', '2024-01-01 23:00:00.000', '2024-01-02 02:00:00.000'],
      ['2024-01-02', '2024-01-02 02:00:00.000', '2024-01-02 03:00:00.000'], // carried over: no overlap, total kept
    ]);
    expect(p.overDays).toEqual([{ area: 'CR', date: '2024-01-01', hours: 26 }]);
  });

  it('the plan: fingerprints, duplicates kept and counted, months and hours', async () => {
    const r = await planHistory([HEAD, row(45292, 'CR', 1), row(45292, 'CR', 1), row(45324, 'RM.1', 2.25)]);
    if (!r.ok) throw new Error(r.message);
    expect(r.plan.rows).toHaveLength(3);
    expect(new Set(r.plan.rows.map((x) => x.fingerprint)).size).toBe(3);
    expect(r.plan.duplicates).toBe(1);
    expect(r.plan.months).toEqual(['2024-01', '2024-02']);
    expect(r.plan.hours).toBeCloseTo(4.25);
    expect(r.plan.rows.every((x) => x.freq === 1)).toBe(true);
  });
});
