// Shift reports (plant system, backend 2.1.0; docs/plant-system/02-shift-workflow-and-roles.md): the types the API
// returns, the shift window of a report, the status words and the daily-meeting figures. The same rules as
// backend/apps-script/ShiftReports.js where both need them (the window, the blocking flags, readiness to post).
import { t } from '../i18n/t';

export type ShiftStatus = 'draft' | 'submitted' | 'returned' | 'prod_approved' | 'validated' | 'posted';
export type ShiftStage = 'entry' | 'production' | 'reliability';

export interface ShiftDef { shift_id: string; name: string; start_time: string; end_time: string; sort_order: number }

export interface ShiftReport {
  report_id: string; report_date: string; shift_id: string; area_id: string; line_id: string; status: ShiftStatus; source: string;
  entered_by: string; entered_at: string; submitted_by: string; submitted_at: string;
  prod_reviewed_by: string; prod_reviewed_at: string; rel_validated_by: string; rel_validated_at: string; posted_at: string;
  returned_by: string; returned_at: string; return_stage: '' | 'production' | 'reliability'; return_comment: string;
  notes: string; updated_by: string; updated_at: string;
}

export interface ShiftStoppage {
  stop_id: string; report_id: string; area_id: string; line_id: string; code_raw: string; equipment_id: string;
  stop_ts: string; start_ts: string; duration_s: number | null; freq: number; classification: string; criticality: string; is_failure: boolean;
  reason_raw: string; reason_id: string; description: string; flags: string; stop_state: 'open' | 'closed';
  closed_report_id: string; closed_by: string; closed_at: string; row_state: 'active' | 'deleted'; posted_event_id: string;
  created_by: string; created_at: string; updated_by: string; updated_at: string;
}

/** What the shift leader sends for one stoppage (stop_id for a stoppage already saved). */
export interface ShiftStoppageInput {
  stop_id?: string; code_raw: string; stop_ts: string; start_ts: string; classification: string; is_failure: boolean; reason_raw: string; description: string;
}

export interface ShiftReportInput { report_date: string; shift_id: string; area_id: string; notes: string; stoppages: ShiftStoppageInput[]; submit: boolean }
export interface ShiftRestartInput { stop_id: string; report_date: string; shift_id: string; start_ts: string }
export type ShiftStopField = 'code_raw' | 'stop_ts' | 'start_ts' | 'classification' | 'is_failure' | 'reason_raw' | 'description';
export interface ShiftReviewInput {
  report_id: string; decision: 'approve' | 'return' | 'validate'; comment: string;
  edits: { stop_id: string; changes: Partial<Pick<ShiftStoppageInput, ShiftStopField>> }[];
}
export interface ShiftList { shifts: ShiftDef[]; reports: ShiftReport[]; stoppages: ShiftStoppage[] }
export interface ShiftBundle { report: ShiftReport; stoppages: ShiftStoppage[] }
export interface ShiftHistory {
  log: { log_id: string; action: string; from_status: string; to_status: string; stage: string; by_user: string; at: string; comment: string }[];
  edits: { edit_id: string; stop_id: string; stage: ShiftStage; field: string; old_value: string; new_value: string; comment: string; edited_by: string; edited_at: string }[];
}

export const SHIFT_STOP_FIELDS: ShiftStopField[] = ['code_raw', 'stop_ts', 'start_ts', 'classification', 'is_failure', 'reason_raw', 'description'];
export const SHIFT_BLOCKING = ['missing_classification', 'invalid_classification', 'end_before_start'];
export const blockingFlags = (s: Pick<ShiftStoppage, 'flags'>): string[] => (s.flags || '').split(',').filter((f) => SHIFT_BLOCKING.includes(f));

export const DEFAULT_SHIFTS: ShiftDef[] = [
  { shift_id: 'D', name: 'Day', start_time: '08:00', end_time: '20:00', sort_order: 1 },
  { shift_id: 'N', name: 'Night', start_time: '20:00', end_time: '08:00', sort_order: 2 },
];

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

/** Start and end of a shift on a report date ('YYYY-MM-DD HH:MM:SS.000'); a shift ending at or before its start ends the next day. */
export function shiftWindow(def: Pick<ShiftDef, 'start_time' | 'end_time'>, day: string): { start: string; end: string } {
  const endDay = def.end_time <= def.start_time ? addDays(day, 1) : day;
  return { start: `${day} ${def.start_time}:00.000`, end: `${endDay} ${def.end_time}:00.000` };
}

/** The shift (and its report date) a plant-local time falls in. */
export function shiftAt(defs: ShiftDef[], ts: string): { day: string; shift: ShiftDef } | null {
  const day = ts.slice(0, 10);
  for (const d of [day, addDays(day, -1)]) {
    for (const s of defs) {
      const w = shiftWindow(s, d);
      if (ts >= w.start && ts < w.end) return { day: d, shift: s };
    }
  }
  return null;
}

export const reportIdOf = (day: string, shiftId: string, areaId: string): string => `SR-${day.replace(/-/g, '')}-${shiftId}-${areaId}`;

export function statusText(s: ShiftStatus): string {
  return ({ draft: t('Draft'), submitted: t('Waiting for production'), returned: t('Returned to shift leader'), prod_approved: t('Waiting for reliability'),
    validated: t('Validated'), posted: t('In the downtime analysis') } as Record<ShiftStatus, string>)[s];
}
export function statusTone(s: ShiftStatus): 'neutral' | 'warning' | 'accent' | 'success' | 'danger' {
  return ({ draft: 'neutral', submitted: 'accent', returned: 'danger', prod_approved: 'accent', validated: 'success', posted: 'success' } as const)[s];
}
export const STATUS_ORDER: ShiftStatus[] = ['draft', 'returned', 'submitted', 'prod_approved', 'validated', 'posted'];

/** The step a report waits for, and the duty that acts on it. */
export function nextStep(r: Pick<ShiftReport, 'status'>): { stage: ShiftStage; duty: 'shift_entry' | 'production_review' | 'reliability_validation' } | null {
  if (r.status === 'draft' || r.status === 'returned') return { stage: 'entry', duty: 'shift_entry' };
  if (r.status === 'submitted') return { stage: 'production', duty: 'production_review' };
  if (r.status === 'prod_approved') return { stage: 'reliability', duty: 'reliability_validation' };
  return null;
}

/** Plant-local now as 'YYYY-MM-DD HH:MM:SS.000' (the device clock; the server checks again with its own). */
export function localNowTs(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}.000`;
}

const tsMs = (ts: string): number => Date.UTC(+ts.slice(0, 4), +ts.slice(5, 7) - 1, +ts.slice(8, 10), +ts.slice(11, 13), +ts.slice(14, 16), +ts.slice(17, 19));

/** Hours of the union of [start, end) intervals clipped to [from, to). */
export function unionHours(spans: [string, string][], from: string, to: string): number {
  const a = tsMs(from), b = tsMs(to);
  const xs = spans.map(([s, e]) => [Math.max(tsMs(s), a), Math.min(tsMs(e), b)] as [number, number]).filter(([s, e]) => e > s).sort((x, y) => x[0] - y[0]);
  let total = 0, cs = -1, ce = -1;
  for (const [s, e] of xs) {
    if (s > ce) { if (ce > cs) total += ce - cs; cs = s; ce = e; } else if (e > ce) ce = e;
  }
  if (ce > cs) total += ce - cs;
  return total / 3_600_000;
}

export interface DayAreaFigures {
  area_id: string; stopH: number; incH: number; plH: number; cirH: number; failures: number; runH: number; rf: number | null; uf: number | null;
  open: number; stops: number; reports: { shift_id: string; status: ShiftStatus | 'missing'; late: boolean }[]; provisional: boolean;
}

/**
 * Daily meeting figures for one area and one production day (first shift start to the same time the next day),
 * from the shift stoppages entered so far, whatever their review step (marked provisional until all are validated).
 * Overlapping stops count once; an open stop counts up to `nowTs`. RF = run / (run + incident); UF = run / hours of the day so far.
 */
export function dayFigures(areaId: string, day: string, defs: ShiftDef[], reports: ShiftReport[], stops: ShiftStoppage[], nowTs: string, submitDeadlineH = 2): DayAreaFigures {
  const sorted = defs.slice().sort((a, b) => a.sort_order - b.sort_order);
  const first = sorted[0] ?? DEFAULT_SHIFTS[0]!;
  const from = shiftWindow(first, day).start;
  const dayEnd = shiftWindow(first, addDays(day, 1)).start;
  const to = nowTs < dayEnd ? (nowTs > from ? nowTs : from) : dayEnd;
  const mine = stops.filter((s) => s.area_id === areaId && s.row_state === 'active');
  const span = (s: ShiftStoppage): [string, string] => [s.stop_ts, s.start_ts || nowTs];
  const by = (pred: (s: ShiftStoppage) => boolean) => unionHours(mine.filter(pred).map(span), from, to);
  const stopH = by(() => true);
  const incH = by((s) => s.criticality === 'INC');
  const plH = by((s) => s.classification === 'PL');
  const cirH = by((s) => s.classification === 'CIR');
  const inDay = mine.filter((s) => s.stop_ts >= from && s.stop_ts < dayEnd);
  const totalH = (tsMs(to) - tsMs(from)) / 3_600_000;
  const runH = Math.max(0, totalH - stopH);
  const rep = sorted.map((def) => {
    const r = reports.find((x) => x.area_id === areaId && x.report_date === day && x.shift_id === def.shift_id);
    const end = shiftWindow(def, day).end;
    const deadline = new Date(tsMs(end) + submitDeadlineH * 3_600_000).toISOString().replace('T', ' ').slice(0, 19) + '.000';
    const status: ShiftStatus | 'missing' = r ? r.status : 'missing';
    const late = (status === 'missing' || status === 'draft' || status === 'returned') && nowTs > deadline;
    return { shift_id: def.shift_id, status, late };
  });
  const relevant = reports.filter((x) => x.area_id === areaId && x.report_date === day);
  return {
    area_id: areaId, stopH, incH, plH, cirH, runH, failures: inDay.filter((s) => s.is_failure).length,
    rf: runH + incH > 0 ? runH / (runH + incH) : null, uf: totalH > 0 ? runH / totalH : null,
    open: mine.filter((s) => s.stop_state === 'open').length, stops: inDay.length, reports: rep,
    provisional: relevant.length === 0 || relevant.some((x) => x.status !== 'validated' && x.status !== 'posted'),
  };
}
