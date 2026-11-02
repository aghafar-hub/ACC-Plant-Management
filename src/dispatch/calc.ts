// Dispatch & Packing: every figure of the section, worked out from the daily rows. Pure functions, no I/O.
// The formulas are the ones of the workbook sheet "Packing & Dispatch" (totals by product, by mode, packer averages).
import { LINE_OF_PACKER, MODES, N_PACKERS, PRODUCTS, type DispatchDay, type DispatchSettings } from './model';

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const div = (a: number, b: number): number => (b > 0 ? a / b : 0);

/** Tons per product for one day: bagged + bulk, plus sling (CEM IV/A) and jumbo (CEM I 52.5). */
export function productTotals(d: DispatchDay): number[] {
  const out = PRODUCTS.map((_, i) => (d.bagged[i] ?? 0) + (d.bulk[i] ?? 0));
  out[4] = (out[4] ?? 0) + d.slingManual + d.slingPalletizer;
  out[1] = (out[1] ?? 0) + d.jumbo;
  return out;
}
export const dayModes = (d: DispatchDay): [number, number, number, number] => [sum(d.bagged), sum(d.bulk), d.slingManual + d.slingPalletizer, d.jumbo];
export const dayTotal = (d: DispatchDay): number => sum(productTotals(d));
export const packerTons = (d: DispatchDay): number => sum(d.packers.map((p) => p.tons));
export const dayClinker = (d: DispatchDay): number => d.clinker.opc + d.clinker.src + d.clinker.over60 + d.clinker.lowAlk;
export const dayPowerMWh = (d: DispatchDay): number => d.power[0] + d.power[1];

export const monthKey = (date: string): string => date.slice(0, 7);
export const monthIndex = (date: string): number => Number(date.slice(5, 7)) - 1;
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export interface Totals {
  days: number;
  dispatchDays: number;
  total: number;
  byProduct: number[];
  byMode: number[];
  /** product x mode in tons: rows PRODUCTS, columns MODES */
  matrix: number[][];
  clinker: { opc: number; src: number; over60: number; lowAlk: number; total: number };
  powerMWh: number;
  packed: number;
  bagsUsed: number;
  broken: number;
  wcnBags: number;
  wcnBroken: number;
  slingProduction: number;
  jumboProduction: number;
}

export function totals(days: readonly DispatchDay[]): Totals {
  const byProduct = PRODUCTS.map(() => 0);
  const matrix = PRODUCTS.map(() => MODES.map(() => 0));
  const t: Totals = {
    days: days.length, dispatchDays: 0, total: 0, byProduct, byMode: MODES.map(() => 0), matrix,
    clinker: { opc: 0, src: 0, over60: 0, lowAlk: 0, total: 0 }, powerMWh: 0, packed: 0, bagsUsed: 0, broken: 0,
    wcnBags: 0, wcnBroken: 0, slingProduction: 0, jumboProduction: 0,
  };
  for (const d of days) {
    const dt = dayTotal(d);
    if (dt > 0) t.dispatchDays++;
    t.total += dt;
    PRODUCTS.forEach((_, i) => {
      matrix[i]![0]! += d.bagged[i] ?? 0;
      matrix[i]![1]! += d.bulk[i] ?? 0;
    });
    matrix[4]![2]! += d.slingManual + d.slingPalletizer;
    matrix[1]![3]! += d.jumbo;
    productTotals(d).forEach((v, i) => { byProduct[i]! += v; });
    dayModes(d).forEach((v, i) => { t.byMode[i]! += v; });
    t.clinker.opc += d.clinker.opc; t.clinker.src += d.clinker.src; t.clinker.over60 += d.clinker.over60; t.clinker.lowAlk += d.clinker.lowAlk;
    t.powerMWh += dayPowerMWh(d);
    for (const p of d.packers) { t.packed += p.tons; t.bagsUsed += p.bags; t.broken += p.broken; }
    t.wcnBags += d.wcnBags; t.wcnBroken += d.wcnBroken; t.slingProduction += d.slingProduction; t.jumboProduction += d.jumboProduction;
  }
  t.clinker.total = t.clinker.opc + t.clinker.src + t.clinker.over60 + t.clinker.lowAlk;
  return t;
}

export interface MonthRow {
  /** 0-11 */
  month: number;
  key: string;
  label: string;
  days: number;
  dispatchDays: number;
  total: number;
  byProduct: number[];
  byMode: number[];
  avgPerDispatchDay: number;
  bulkShare: number;
  clinker: number;
  powerMWh: number;
  packed: number;
  runH: number;
  noTruckH: number;
  unplannedH: number;
  otherStopH: number;
  /** fleet packing rate while running, t/h */
  rate: number;
  kwhPerTonne: number;
  broken: number;
  bagsUsed: number;
  slingProduction: number;
  target: number;
}

/** One row per calendar month that has data (months with no rows are left out, never shown as zero). */
export function monthly(days: readonly DispatchDay[], settings?: DispatchSettings): MonthRow[] {
  const by = new Map<string, DispatchDay[]>();
  for (const d of days) {
    const k = monthKey(d.date);
    const list = by.get(k);
    if (list) list.push(d); else by.set(k, [d]);
  }
  return [...by.keys()].sort().map((key) => {
    const ds = by.get(key)!;
    const tt = totals(ds);
    const fleet = fleetTime(ds);
    const month = monthIndex(ds[0]!.date);
    return {
      month, key, label: MONTH_NAMES[month]!, days: ds.length, dispatchDays: tt.dispatchDays, total: tt.total, byProduct: tt.byProduct, byMode: tt.byMode,
      avgPerDispatchDay: div(tt.total, tt.dispatchDays), bulkShare: div(tt.byMode[1]!, tt.total), clinker: tt.clinker.total, powerMWh: tt.powerMWh,
      packed: tt.packed, runH: fleet.runH, noTruckH: fleet.noTruckH, unplannedH: fleet.unplannedH, otherStopH: fleet.otherStopH, rate: div(tt.packed, fleet.runH),
      kwhPerTonne: div(tt.powerMWh * 1000, tt.total), broken: tt.broken, bagsUsed: tt.bagsUsed, slingProduction: tt.slingProduction, target: settings?.monthlyTargetT[month] ?? 0,
    };
  });
}

export interface TimeSplit { runH: number; noTruckH: number; unplannedH: number; otherStopH: number }
export function fleetTime(days: readonly DispatchDay[]): TimeSplit {
  const s: TimeSplit = { runH: 0, noTruckH: 0, unplannedH: 0, otherStopH: 0 };
  for (const d of days) for (const p of d.packers) {
    s.runH += p.runH; s.noTruckH += p.noTruckH; s.unplannedH += p.unplannedH;
    s.otherStopH += Math.max(0, p.stopH - p.noTruckH - p.unplannedH);
  }
  return s;
}

export interface PackerStat {
  packer: number;
  line: number;
  tons: number;
  share: number;
  runH: number;
  /** tons per running hour */
  rate: number;
  calendarH: number;
  availability: number;
  noTruckH: number;
  unplannedH: number;
  otherStopH: number;
  /** each as a share of calendar hours (the four add up to 1) */
  runShare: number;
  noTruckShare: number;
  unplannedShare: number;
  otherShare: number;
  daysOperated: number;
  bestDay: number;
  avgPerOperatingDay: number;
  bagsUsed: number;
  broken: number;
  /** rate against the rated capacity; null when no capacity is set */
  utilisation: number | null;
}

export function packerStats(days: readonly DispatchDay[], settings?: DispatchSettings): PackerStat[] {
  const calendarH = days.length * 24;
  const all = days.reduce((a, d) => a + packerTons(d), 0);
  return Array.from({ length: N_PACKERS }, (_, i) => {
    let tons = 0, runH = 0, noTruckH = 0, unplannedH = 0, stopH = 0, daysOperated = 0, bestDay = 0, bagsUsed = 0, broken = 0;
    for (const d of days) {
      const p = d.packers[i]!;
      tons += p.tons; runH += p.runH; noTruckH += p.noTruckH; unplannedH += p.unplannedH; stopH += p.stopH; bagsUsed += p.bags; broken += p.broken;
      if (p.tons > 0) daysOperated++;
      if (p.tons > bestDay) bestDay = p.tons;
    }
    const otherStopH = Math.max(0, stopH - noTruckH - unplannedH);
    const rate = div(tons, runH);
    const rated = settings?.ratedTph[i] ?? 0;
    return {
      packer: i + 1, line: LINE_OF_PACKER[i]!, tons, share: div(tons, all), runH, rate, calendarH, availability: div(runH, calendarH), noTruckH, unplannedH, otherStopH,
      runShare: div(runH, calendarH), noTruckShare: div(noTruckH, calendarH), unplannedShare: div(unplannedH, calendarH), otherShare: div(otherStopH, calendarH),
      daysOperated, bestDay, avgPerOperatingDay: div(tons, daysOperated), bagsUsed, broken, utilisation: rated > 0 ? rate / rated : null,
    };
  });
}

export interface LineStat { line: number; tons: number; runH: number; noTruckH: number; rate: number; noTruckShare: number }
export function lineStats(stats: readonly PackerStat[]): LineStat[] {
  return [1, 2].map((line) => {
    const ps = stats.filter((p) => p.line === line);
    const tons = sum(ps.map((p) => p.tons)), runH = sum(ps.map((p) => p.runH)), noTruckH = sum(ps.map((p) => p.noTruckH)), cal = sum(ps.map((p) => p.calendarH));
    return { line, tons, runH, noTruckH, rate: div(tons, runH), noTruckShare: div(noTruckH, cal) };
  });
}

/** Per-packer tons by month: rows = months (same order as `monthly`), columns = packers. */
export function packerMonthly(days: readonly DispatchDay[]): { key: string; label: string; tons: number[] }[] {
  const by = new Map<string, number[]>();
  for (const d of days) {
    const k = monthKey(d.date);
    const row = by.get(k) ?? Array.from({ length: N_PACKERS }, () => 0);
    d.packers.forEach((p, i) => { row[i]! += p.tons; });
    by.set(k, row);
  }
  return [...by.keys()].sort().map((key) => ({ key, label: MONTH_NAMES[Number(key.slice(5)) - 1]!, tons: by.get(key)! }));
}

/** Weekday (0 = Monday ... 6 = Sunday) of a YYYY-MM-DD date. */
export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export interface WeekdayRow { weekday: number; label: string; days: number; total: number; avg: number }
export function weekdayProfile(days: readonly DispatchDay[]): WeekdayRow[] {
  const rows = WEEKDAY_NAMES.map((label, weekdayIdx) => ({ weekday: weekdayIdx, label, days: 0, total: 0, avg: 0 }));
  for (const d of days) { const r = rows[weekday(d.date)]!; r.days++; r.total += dayTotal(d); }
  rows.forEach((r) => { r.avg = div(r.total, r.days); });
  return rows;
}

export interface DayStats { mean: number; meanDispatchDay: number; median: number; stdev: number; cv: number; zeroDays: string[]; peak: { date: string; total: number } | null; over: number }
export function dayStats(days: readonly DispatchDay[], overThreshold = 12000): DayStats {
  const totalsList = days.map(dayTotal);
  const n = totalsList.length;
  const total = sum(totalsList);
  const mean = div(total, n);
  const sorted = [...totalsList].sort((a, b) => a - b);
  const median = n === 0 ? 0 : n % 2 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  const stdev = n > 1 ? Math.sqrt(sum(totalsList.map((v) => (v - mean) ** 2)) / (n - 1)) : 0;
  const nonZero = totalsList.filter((v) => v > 0);
  let peak: DayStats['peak'] = null;
  days.forEach((d, i) => { if (!peak || totalsList[i]! > peak.total) peak = { date: d.date, total: totalsList[i]! }; });
  return {
    mean, meanDispatchDay: div(sum(nonZero), nonZero.length), median, stdev, cv: div(stdev, mean),
    zeroDays: days.filter((d) => dayTotal(d) === 0).map((d) => d.date), peak, over: totalsList.filter((v) => v > overThreshold).length,
  };
}

export function topDays(days: readonly DispatchDay[], n = 10): { date: string; total: number; bagged: number; bulk: number }[] {
  return [...days].map((d) => ({ date: d.date, total: dayTotal(d), bagged: dayModes(d)[0], bulk: dayModes(d)[1] })).sort((a, b) => b.total - a.total).slice(0, n);
}

/** Week number as the workbook shows it: Excel WEEKNUM, weeks start on Sunday, week 1 holds 1 January. */
export function excelWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const jan1 = Date.UTC(y, 0, 1);
  const jan1Dow = new Date(jan1).getUTCDay();
  const day = (Date.UTC(y, m - 1, d) - jan1) / 86_400_000;
  return Math.floor((day + jan1Dow) / 7) + 1;
}

export interface WeekRow { week: number; days: number; total: number; avg: number }
export function weekly(days: readonly DispatchDay[]): WeekRow[] {
  const by = new Map<number, WeekRow>();
  for (const d of days) {
    const w = excelWeek(d.date);
    const r = by.get(w) ?? { week: w, days: 0, total: 0, avg: 0 };
    r.days++; r.total += dayTotal(d);
    by.set(w, r);
  }
  return [...by.values()].sort((a, b) => a.week - b.week).map((r) => ({ ...r, avg: div(r.total, r.days) }));
}

/** Estimated broken-bag rate: broken / (used + broken). The workbook's own column multiplies this by 10 (audit finding). */
export const brokenRate = (used: number, broken: number): number => div(broken, used + broken);
