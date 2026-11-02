import { describe, expect, it } from 'vitest';
import { dayStats, excelWeek, fleetTime, lineStats, monthly, packerStats, productTotals, topDays, totals, weekday, weekdayProfile, weekly } from './calc';
import { DEFAULT_LIMITS, RULES, runChecks, summarise } from './checks';
import { emptyDay, emptySettings, N_PACKERS, type DispatchDay } from './model';
import { insights } from './insights';
import { colIndex, DISPATCH_SHEET, parseDispatchWorkbook, parseSheetRows, serialToDate } from './parseWorkbook';
import { buildXlsx, type RawCell } from '../../tests/helpers/xlsxWriter';
import { DEMO_STOP_DATES, syntheticDispatchDays } from './synthetic';

const day = (date: string, f?: (d: DispatchDay) => void): DispatchDay => { const d = emptyDay(date); f?.(d); return d; };
const find = (days: DispatchDay[], rule: string) => runChecks(days).filter((f) => f.rule === rule);

describe('calc: totals follow the workbook formulas', () => {
  it('adds sling to CEM IV/A and jumbo to CEM I 52.5 on top of bagged and bulk', () => {
    const d = day('2025-03-01', (x) => { x.bagged[4] = 100; x.bulk[4] = 50; x.bagged[1] = 10; x.bulk[1] = 20; x.slingManual = 5; x.slingPalletizer = 15; x.jumbo = 7; });
    const p = productTotals(d);
    expect(p[4]).toBe(170);
    expect(p[1]).toBe(37);
    const tt = totals([d]);
    expect(tt.total).toBe(207);
    expect(tt.byMode).toEqual([110, 70, 20, 7]);
    // the product x mode matrix has the same grand total as the products and the modes
    expect(tt.matrix.flat().reduce((a, b) => a + b, 0)).toBe(207);
    expect(tt.matrix[4]).toEqual([100, 50, 20, 0]);
    expect(tt.matrix[1]).toEqual([10, 20, 0, 7]);
  });
  it('the demo year ties: products, modes and months give one total', () => {
    const days = syntheticDispatchDays();
    const tt = totals(days);
    expect(days).toHaveLength(365);
    expect(tt.byProduct.reduce((a, b) => a + b, 0)).toBeCloseTo(tt.total, 6);
    expect(tt.byMode.reduce((a, b) => a + b, 0)).toBeCloseTo(tt.total, 6);
    expect(monthly(days).reduce((a, m) => a + m.total, 0)).toBeCloseTo(tt.total, 6);
    expect(monthly(days)).toHaveLength(12);
  });
  it('a month with no rows is left out instead of shown as zero', () => {
    const days = [day('2025-01-05'), day('2025-03-05')];
    expect(monthly(days).map((m) => m.label)).toEqual(['Jan', 'Mar']);
  });
  it('packer figures: rate, availability and the four time shares add up to the calendar', () => {
    const days = syntheticDispatchDays();
    const ps = packerStats(days);
    expect(ps).toHaveLength(N_PACKERS);
    for (const p of ps) {
      expect(p.runShare + p.noTruckShare + p.unplannedShare + p.otherShare).toBeCloseTo(1, 1);
      expect(p.rate).toBeCloseTo(p.tons / p.runH, 6);
      expect(p.availability).toBeCloseTo(p.runH / (days.length * 24), 6);
    }
    expect(ps.reduce((a, p) => a + p.share, 0)).toBeCloseTo(1, 6);
    const fl = fleetTime(days);
    expect(fl.runH).toBeCloseTo(ps.reduce((a, p) => a + p.runH, 0), 6);
    const ls = lineStats(ps);
    expect(ls[0]!.tons + ls[1]!.tons).toBeCloseTo(ps.reduce((a, p) => a + p.tons, 0), 6);
  });
  it('utilisation needs a rated capacity and is a share of it', () => {
    const days = syntheticDispatchDays();
    expect(packerStats(days)[0]!.utilisation).toBeNull();
    const s = emptySettings(); s.ratedTph[0] = 100;
    expect(packerStats(days, s)[0]!.utilisation).toBeCloseTo(packerStats(days)[0]!.rate / 100, 9);
  });
  it('weekdays, weeks and day statistics', () => {
    expect(weekday('2025-06-18')).toBe(2); // Wednesday
    expect(weekday('2025-06-22')).toBe(6); // Sunday
    // week numbers as Excel WEEKNUM (Sunday start): 1 Jan 2025 is a Wednesday, so 5 Jan starts week 2
    expect(excelWeek('2025-01-01')).toBe(1); expect(excelWeek('2025-01-04')).toBe(1); expect(excelWeek('2025-01-05')).toBe(2); expect(excelWeek('2025-12-31')).toBe(53);
    const days = syntheticDispatchDays();
    expect(weekdayProfile(days).reduce((a, w) => a + w.days, 0)).toBe(365);
    expect(weekly(days).reduce((a, w) => a + w.days, 0)).toBe(365);
    const st = dayStats(days);
    expect(st.zeroDays).toEqual(DEMO_STOP_DATES);
    expect(st.peak!.total).toBe(topDays(days, 1)[0]!.total);
    expect(st.meanDispatchDay).toBeGreaterThan(st.mean);
  });
});

describe('checks', () => {
  it('has the four groups the owner asked for', () => {
    expect(new Set(RULES.map((r) => r.group))).toEqual(new Set(['tie', 'time', 'range', 'bags']));
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });
  it('the demo year only raises the checks we expect (no blocking findings)', () => {
    const s = summarise(runChecks(syntheticDispatchDays()));
    expect(s.block).toBe(0);
    expect(s.byRule['DP-ZERO']).toBe(DEMO_STOP_DATES.length);
  });
  it('time balance: running above 24 h blocks, running + stopped not 24 h warns', () => {
    const base = (f: (d: DispatchDay) => void) => [day('2025-05-01', f)];
    expect(find(base((d) => { d.packers[2]!.runH = 25; d.packers[2]!.stopH = 0; }), 'DP-RH24')[0]).toMatchObject({ level: 'block', packer: 3 });
    expect(find(base((d) => { d.packers[0]!.runH = 10; d.packers[0]!.stopH = 10; }), 'DP-TIME')[0]).toMatchObject({ level: 'warn', packer: 1 });
    expect(find(base((d) => { d.packers[0]!.runH = 10; d.packers[0]!.stopH = 14; d.packers[0]!.noTruckH = 10; d.packers[0]!.unplannedH = 8; }), 'DP-STOP')).toHaveLength(1);
    expect(find(base((d) => { d.packers[0]!.tons = -5; }), 'DP-NEG')).toHaveLength(1);
    expect(find(base((d) => { d.packers[0]!.tons = 100; }), 'DP-NORH')).toHaveLength(1);
  });
  it('gaps and zero days', () => {
    const days = [day('2025-05-01'), day('2025-05-04')];
    expect(find(days, 'DP-GAP').map((f) => f.date)).toEqual(['2025-05-02', '2025-05-03']);
    expect(find(days, 'DP-ZERO')).toHaveLength(2);
  });
  it('tie-out: a day inside the limit is quiet, a month outside it warns', () => {
    const mk = (date: string, packed: number, bagged: number) => day(date, (d) => { d.packers[0]!.tons = packed; d.packers[0]!.runH = 10; d.packers[0]!.stopH = 14; d.packers[0]!.bags = packed * 20; d.bagged[4] = bagged; });
    expect(find([mk('2025-05-01', 1000, 1000)], 'DP-TIE')).toHaveLength(0);
    expect(find([mk('2025-05-01', 1000, 800)], 'DP-TIE')).toHaveLength(1);
    const month = [mk('2025-05-01', 1000, 1050), mk('2025-05-02', 1000, 1050)];
    expect(find(month, 'DP-TIEM')).toHaveLength(1);
    expect(find([mk('2025-05-01', 1000, 1000), mk('2025-05-02', 1000, 1005)], 'DP-TIEM')).toHaveLength(0);
    expect(DEFAULT_LIMITS.tieMonthPct).toBeLessThan(DEFAULT_LIMITS.tiePct);
  });
  it('bags and rate', () => {
    const d = day('2025-05-01', (x) => { const p = x.packers[0]!; p.tons = 1000; p.runH = 10; p.stopH = 14; p.bags = 15000; p.broken = 1000; });
    expect(runChecks([d]).map((f) => f.rule)).toEqual(expect.arrayContaining(['DP-BAGS', 'DP-BRK']));
    const s = emptySettings(); s.ratedTph[0] = 80;
    expect(runChecks([d], s).some((f) => f.rule === 'DP-RATE')).toBe(true);
  });
  it('findings are ordered by date, then block before warn before info', () => {
    const f = runChecks([day('2025-05-02', (d) => { d.packers[0]!.runH = 30; }), day('2025-05-01')]);
    expect(f.map((x) => x.date)).toEqual([...f.map((x) => x.date)].sort());
    const first = f.filter((x) => x.date === '2025-05-02').map((x) => x.level);
    expect(first[0]).toBe('block');
  });
});

describe('parseSheetRows', () => {
  const header = (): unknown[][] => {
    const w = 260;
    const rows: unknown[][] = [Array(w).fill(null), Array(w).fill(null), Array(w).fill(null)];
    const set = (r: number, col: string, v: string) => { rows[r - 1]![colIndex(col)] = v; };
    set(1, 'C', 'Date'); set(1, 'D', 'Packer 1'); set(1, 'K', 'Packer 2'); set(1, 'AM', 'Packer 6'); set(2, 'D', 'Dispatch'); set(3, 'D', 'tons');
    set(1, 'CD', 'Dispatch'); set(2, 'CK', 'Bulk'); set(1, 'BZ', 'OPC Clinker Dispatch'); set(2, 'GY', 'Stoppage Time'); set(2, 'GZ', 'Unplanned Time');
    return rows;
  };
  const row = (serial: number, f?: (r: unknown[]) => void): unknown[] => { const r: unknown[] = Array(260).fill(0); r[colIndex('C')] = serial; f?.(r); return r; };
  it('reads the columns of one day', () => {
    const rows = header();
    rows.push(row(45658, (r) => {
      r[colIndex('D')] = 960; r[colIndex('E')] = 19200; r[colIndex('F')] = 67; r[colIndex('I')] = 10.75; r[colIndex('J')] = 8.5; r[colIndex('GY')] = 13.25; r[colIndex('GZ')] = 2.75;
      r[colIndex('CH')] = 400; r[colIndex('CO')] = 1471.26; r[colIndex('CV')] = 12; r[colIndex('GF')] = 8; r[colIndex('GU')] = 3; r[colIndex('BZ')] = 5; r[colIndex('BX')] = 5.5;
    }));
    rows.push([null, null, 'Total', 123]);
    const res = parseSheetRows(rows);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.days).toHaveLength(1);
    const d = res.days[0]!;
    expect(d.date).toBe('2025-01-01');
    expect(d.packers[0]).toMatchObject({ tons: 960, bags: 19200, broken: 67, runH: 10.75, noTruckH: 8.5, stopH: 13.25, unplannedH: 2.75 });
    expect(d.bagged[4]).toBe(400); expect(d.bulk[4]).toBe(1471.26); expect(d.slingManual).toBe(12); expect(d.slingPalletizer).toBe(8); expect(d.jumbo).toBe(3);
    expect(d.clinker.opc).toBe(5); expect(d.power[0]).toBe(5.5);
  });
  it('serial dates, including the 1904 system', () => {
    expect(serialToDate(45658)).toBe('2025-01-01');
    expect(serialToDate(45658 - 1462, true)).toBe('2025-01-01');
  });
  it('refuses another sheet, a repeated date and an empty sheet', () => {
    const wrong = header(); wrong[0]![colIndex('C')] = 'Day';
    expect(parseSheetRows(wrong)).toMatchObject({ ok: false, reason: 'wrong_layout' });
    expect(parseSheetRows([...header(), row(45658), row(45658)])).toMatchObject({ ok: false, reason: 'duplicate_dates' });
    expect(parseSheetRows(header())).toMatchObject({ ok: false, reason: 'no_rows' });
  });
  it('reports a value in a column this section does not import', () => {
    const res = parseSheetRows([...header(), row(45658, (r) => { r[colIndex('GV')] = 50; })]);
    expect(res.ok && res.warnings.join(' ')).toContain('jumbo palletized CEM II');
  });
});

describe('insights', () => {
  it('are worked out from the data and name what they rest on', () => {
    const lines = insights(syntheticDispatchDays());
    expect(lines.length).toBeGreaterThan(6);
    expect(lines.join(' ')).toContain('estimates');
    expect(lines.join(' ')).toMatch(/waiting for trucks|unplanned stops|other stoppages/);
    expect(insights([])).toEqual([]);
  });
});

describe('parseDispatchWorkbook (a real .xlsx file)', () => {
  const cells = (cols: Record<string, RawCell>): RawCell[] => { const r: RawCell[] = Array(260).fill(0); for (const [c, v] of Object.entries(cols)) r[colIndex(c)] = v; return r; };
  const head = (): RawCell[][] => [
    cells({ C: 'Date', D: 'Packer 1', K: 'Packer 2', AM: 'Packer 6', CD: 'Dispatch', BZ: 'OPC Clinker Dispatch' }),
    cells({ D: 'Dispatch', CK: 'Bulk', GY: 'Stoppage Time', GZ: 'Unplanned Time' }),
    cells({ D: 'tons' }),
  ];
  it('reads cached formula results, so a formula that is 0 stays 0', async () => {
    const rows = [...head(), cells({ C: 45658, D: 100, E: { f: 'D4*20', v: 2000 }, I: 5, GY: { f: '24-I4', v: 19 }, CJ: { f: 'SUM(CD4:CI4)', v: 0 }, CH: 400, CV: { f: 'DF4+DL4', v: 0 } })];
    const res = await parseDispatchWorkbook(buildXlsx([{ name: DISPATCH_SHEET, rows }]));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.days[0]).toMatchObject({ date: '2025-01-01', slingManual: 0 });
    expect(res.days[0]!.packers[0]).toMatchObject({ tons: 100, bags: 2000, runH: 5, stopH: 19 });
    expect(res.days[0]!.bagged[4]).toBe(400);
  });
  it('says what is wrong when the sheet is missing or the file is not a workbook', async () => {
    const other = await parseDispatchWorkbook(buildXlsx([{ name: 'Downtime', rows: [['x']] }]));
    expect(other).toMatchObject({ ok: false, reason: 'no_sheet' });
    expect(!other.ok && other.message).toContain('Downtime');
    expect(await parseDispatchWorkbook(new Uint8Array([1, 2, 3]))).toMatchObject({ ok: false, reason: 'unreadable' });
  });
});
