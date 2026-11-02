// Dispatch & Packing: the data checks behind the Data validation page. A check never changes a value: it is a
// finding for a person to look at (same idea as the plant system's data checks, rules/04-rules-all-sections.md).
// Four groups: totals tie-out, time balance, range and gaps, bag and product checks. Pure functions.
import { BAGS_PER_TONNE, N_PACKERS, type DispatchDay, type DispatchSettings } from './model';
import { dayTotal, packerTons, brokenRate } from './calc';

export type CheckLevel = 'block' | 'warn' | 'info';
export type CheckGroup = 'tie' | 'time' | 'range' | 'bags';

export interface CheckRule { id: string; group: CheckGroup; level: CheckLevel; name: string; what: string }
export interface Finding { rule: string; level: CheckLevel; group: CheckGroup; date: string; packer?: number; message: string }

export const GROUP_LABELS: Record<CheckGroup, string> = {
  tie: 'Totals tie-out', time: 'Time balance', range: 'Range and gaps', bags: 'Bags and products',
};

export const RULES: CheckRule[] = [
  { id: 'DP-TIE', group: 'tie', level: 'info', name: 'Packers differ from dispatch (day)', what: 'Tons packed by the six packers differ from bagged + sling dispatch of the day by more than the limit. Packing and trucks are never exactly in step in one day, so this is information only.' },
  { id: 'DP-TIEM', group: 'tie', level: 'warn', name: 'Packers do not match dispatch (month)', what: 'Over a whole month, tons packed differ from bagged + sling dispatch by more than the limit.' },
  { id: 'DP-NEG', group: 'time', level: 'block', name: 'Negative value', what: 'A tonnage, hour, bag or power value is below zero.' },
  { id: 'DP-RH24', group: 'time', level: 'block', name: 'Running hours above the day', what: 'A packer ran more than 24 hours in one day.' },
  { id: 'DP-TIME', group: 'time', level: 'warn', name: 'Running + stopped is not 24 h', what: 'Running hours plus stoppage hours of a packer differ from 24 by more than the limit.' },
  { id: 'DP-STOP', group: 'time', level: 'warn', name: 'No-trucks + unplanned above stoppage', what: 'No-trucks time plus unplanned time is more than the packer\'s stoppage time.' },
  { id: 'DP-GAP', group: 'range', level: 'block', name: 'Missing day', what: 'A date between the first and last day of the data has no row.' },
  { id: 'DP-ZERO', group: 'range', level: 'warn', name: 'No dispatch all day', what: 'Total dispatch is zero for the day. Add the reason (for example a holiday) when the review is done.' },
  { id: 'DP-JUMP', group: 'range', level: 'info', name: 'Sudden change', what: 'Total dispatch changed by more than the limit against the day before.' },
  { id: 'DP-RATE', group: 'range', level: 'warn', name: 'Packing rate far from normal', what: 'A packer\'s tons per running hour is far from its own typical rate, or above its rated capacity.' },
  { id: 'DP-NORH', group: 'range', level: 'warn', name: 'Tons without running, or the opposite', what: 'A packer has tons but no running hours, or running hours but no tons.' },
  { id: 'DP-BAGS', group: 'bags', level: 'warn', name: 'Bags do not match tons', what: 'Bags used differ from tons x 20 by more than the limit.' },
  { id: 'DP-BRK', group: 'bags', level: 'warn', name: 'Broken-bag rate high', what: 'Broken bags above the limit as a share of used bags (the workbook\'s own rates are 0.35 % to 2.1 %).' },
  { id: 'DP-CLK', group: 'bags', level: 'info', name: 'Sling dispatch without sling production', what: 'Sling bags were dispatched on a day but sling production for the month is zero.' },
];
export const ruleById = (id: string): CheckRule | undefined => RULES.find((r) => r.id === id);

export interface CheckLimits {
  /** DP-TIE: packers vs bagged + sling in one day, share of the larger of the two */
  tiePct: number;
  /** DP-TIEM: the same over a month */
  tieMonthPct: number;
  /** DP-TIME / DP-STOP: hours */
  timeTolH: number;
  /** DP-JUMP: share of the day before */
  jumpPct: number;
  /** DP-RATE: share away from the packer's median rate */
  ratePct: number;
  /** DP-BAGS: share of tons x 20 */
  bagsPct: number;
  /** DP-BRK: share of used bags */
  brokenPct: number;
}
export const DEFAULT_LIMITS: CheckLimits = { tiePct: 10, tieMonthPct: 1, timeTolH: 0.05, jumpPct: 50, ratePct: 25, bagsPct: 2, brokenPct: 2.5 };

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
const dayBefore = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};
const nextDay = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};
const f1 = (n: number): string => n.toFixed(1);

/** Runs every rule on the given days. Findings are ordered by date, then level (block first). */
export function runChecks(daysIn: readonly DispatchDay[], settings?: DispatchSettings, limits: CheckLimits = DEFAULT_LIMITS): Finding[] {
  const days = [...daysIn].sort((a, b) => a.date.localeCompare(b.date));
  const out: Finding[] = [];
  const add = (rule: string, date: string, message: string, packer?: number) => {
    const r = ruleById(rule)!;
    out.push({ rule, level: r.level, group: r.group, date, packer, message });
  };
  // typical rate of each packer: the median of its days with tons and running hours
  const typical = Array.from({ length: N_PACKERS }, (_, i) => median(days.filter((d) => d.packers[i]!.runH > 0 && d.packers[i]!.tons > 0).map((d) => d.packers[i]!.tons / d.packers[i]!.runH)));
  const monthSling = new Map<string, number>();
  for (const d of days) monthSling.set(d.date.slice(0, 7), (monthSling.get(d.date.slice(0, 7)) ?? 0) + d.slingProduction);

  let prev: DispatchDay | undefined;
  for (const d of days) {
    const total = dayTotal(d);
    // gaps: every date from the day after `prev` up to the day before `d`
    if (prev) for (let g = nextDay(prev.date); g < d.date; g = nextDay(g)) add('DP-GAP', g, `No row for ${g}.`);
    // negatives
    const neg: string[] = [];
    const chk = (v: number, what: string) => { if (v < 0) neg.push(what); };
    d.bagged.forEach((v, i) => chk(v, `bagged product ${i + 1}`)); d.bulk.forEach((v, i) => chk(v, `bulk product ${i + 1}`));
    chk(d.slingManual, 'sling (manual)'); chk(d.slingPalletizer, 'sling (palletizer)'); chk(d.jumbo, 'jumbo');
    d.packers.forEach((p, i) => { for (const [k, v] of Object.entries(p)) if (v < 0) add('DP-NEG', d.date, `Packer ${i + 1}: ${k} is negative (${f1(v)}).`, i + 1); });
    chk(d.power[0], 'power 691'); chk(d.power[1], 'power 692');
    chk(d.clinker.opc, 'OPC clinker'); chk(d.clinker.src, 'SRC clinker'); chk(d.clinker.over60, 'OPC clinker over 60'); chk(d.clinker.lowAlk, 'low alkaline clinker');
    if (neg.length) add('DP-NEG', d.date, `Negative: ${neg.join(', ')}.`);
    // tie-out: packers against bagged + sling
    const packed = packerTons(d);
    const expected = d.bagged.reduce((a, b) => a + b, 0) + d.slingManual + d.slingPalletizer;
    const base = Math.max(expected, packed);
    if (base > 0 && Math.abs(packed - expected) > (base * limits.tiePct) / 100) add('DP-TIE', d.date, `Packers ${f1(packed)} t, bagged + sling ${f1(expected)} t (difference ${f1(packed - expected)} t).`);
    // gaps / zero / jump
    if (total === 0) add('DP-ZERO', d.date, 'Total dispatch is zero.');
    const pt = prev ? dayTotal(prev) : 0;
    if (prev && prev.date === dayBefore(d.date) && pt > 0 && total > 0 && Math.abs(total - pt) > (pt * limits.jumpPct) / 100) add('DP-JUMP', d.date, `Dispatch ${f1(total)} t against ${f1(pt)} t the day before.`);
    d.packers.forEach((p, i) => {
      const n = i + 1;
      if (p.runH > 24) add('DP-RH24', d.date, `Running ${f1(p.runH)} h is above 24 h.`, n);
      if (Math.abs(p.runH + p.stopH - 24) > limits.timeTolH) add('DP-TIME', d.date, `Running ${f1(p.runH)} h + stopped ${f1(p.stopH)} h = ${f1(p.runH + p.stopH)} h.`, n);
      if (p.noTruckH + p.unplannedH > p.stopH + limits.timeTolH) add('DP-STOP', d.date, `No-trucks ${f1(p.noTruckH)} h + unplanned ${f1(p.unplannedH)} h is above stoppage ${f1(p.stopH)} h.`, n);
      if ((p.tons > 0) !== (p.runH > 0)) add('DP-NORH', d.date, p.tons > 0 ? `${f1(p.tons)} t packed with no running hours.` : `${f1(p.runH)} running hours with no tons.`, n);
      if (p.runH > 0 && p.tons > 0) {
        const rate = p.tons / p.runH, typ = typical[i]!, rated = settings?.ratedTph[i] ?? 0;
        if (typ > 0 && Math.abs(rate - typ) > (typ * limits.ratePct) / 100) add('DP-RATE', d.date, `${f1(rate)} t/h against a typical ${f1(typ)} t/h.`, n);
        else if (rated > 0 && rate > rated * 1.05) add('DP-RATE', d.date, `${f1(rate)} t/h is above the rated ${f1(rated)} t/h.`, n);
      }
      const expectedBags = p.tons * BAGS_PER_TONNE;
      if (p.tons > 0 && Math.abs(p.bags - expectedBags) > (expectedBags * limits.bagsPct) / 100) add('DP-BAGS', d.date, `${p.bags} bags for ${f1(p.tons)} t (expected ${Math.round(expectedBags)}).`, n);
      if (brokenRate(p.bags, p.broken) * 100 > limits.brokenPct) add('DP-BRK', d.date, `${f1(brokenRate(p.bags, p.broken) * 100)} % broken (${p.broken} of ${p.bags + p.broken}).`, n);
    });
    if (d.slingPalletizer + d.slingManual > 0 && (monthSling.get(d.date.slice(0, 7)) ?? 0) === 0) add('DP-CLK', d.date, 'Sling bags dispatched but no sling production in the month.');
    prev = d;
  }
  // month tie-out: packers against bagged + sling over the whole month, reported on the month's last day
  const monthTie = new Map<string, { packed: number; expected: number; last: string }>();
  for (const d of days) {
    const k = d.date.slice(0, 7);
    const m = monthTie.get(k) ?? { packed: 0, expected: 0, last: d.date };
    m.packed += packerTons(d); m.expected += d.bagged.reduce((a, b) => a + b, 0) + d.slingManual + d.slingPalletizer; m.last = d.date;
    monthTie.set(k, m);
  }
  for (const [k, m] of monthTie) {
    const base = Math.max(m.packed, m.expected);
    if (base > 0 && Math.abs(m.packed - m.expected) > (base * limits.tieMonthPct) / 100) add('DP-TIEM', m.last, `${k}: packers ${f1(m.packed)} t, bagged + sling ${f1(m.expected)} t (difference ${f1(m.packed - m.expected)} t).`);
  }
  const rank = { block: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => a.date.localeCompare(b.date) || rank[a.level] - rank[b.level] || a.rule.localeCompare(b.rule) || (a.packer ?? 0) - (b.packer ?? 0));
}

export interface CheckSummary { block: number; warn: number; info: number; byRule: Record<string, number>; days: number }
export function summarise(findings: readonly Finding[]): CheckSummary {
  const s: CheckSummary = { block: 0, warn: 0, info: 0, byRule: {}, days: new Set(findings.map((f) => f.date)).size };
  for (const f of findings) { s[f.level]++; s.byRule[f.rule] = (s.byRule[f.rule] ?? 0) + 1; }
  return s;
}
