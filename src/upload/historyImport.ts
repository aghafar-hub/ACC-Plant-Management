// History import (backend 2.2.0, Admin role): the date-only stoppages of the NRS reporting workbook (sheet MS.Downtime:
// DATE, LINE, EQUIPMENT, EQUIPMENT CODE, TOTAL STOPPAGE DURATION (h), STOPPAGE CLASSIFICATION, CRITICALITY, REASON,
// Failure, DESCRIPTION) into the downtime analysis.
//
// The sheet has no stop or restart times. The stops of one area and one date are laid end to end from 00:00 in the
// order of the sheet, so the hours of each day, month and year come out exactly as the sheet adds them up, and the
// stops never overlap. A day whose stops add up to more than 24 h (an entry error) carries over into the next day,
// keeping the total; those days are listed. The server stores these events with origin 'history' and
// time_precision 'day': charts that need real clock times (when failures start, the timeline) leave them out, and
// they are not records to validate.
import type { Criticality, UploadRow } from '../api/types';
import { assignOccurrences, codeKey, fingerprint } from '../calc';
import { t } from '../i18n/t';
import { sha256Hex } from '../util/sha256';
import { readCriticality, readDate, readNumber, textOf } from './parseWorkbook';
import { readXlsxSheet } from './xlsxReader';

export const HISTORY_SHEET = 'MS.Downtime';
/** The NRS workbook itself can be large; only the one sheet is unpacked. */
export const MAX_HISTORY_BYTES = 150 * 1024 * 1024;

export interface HistoryRaw {
  source_row: number; date: string; line: string; area: string; code: string; hours: number;
  classification: string; criticality: Criticality; failure: boolean; reason: string; description: string;
}

export interface HistoryPlan {
  rows: UploadRow[];
  /** rows read from the sheet */
  rowsRead: number;
  /** rows left out, with why (no hours, unreadable date or value) */
  skipped: { source_row: number; why: string }[];
  /** area-days whose stops add up to more than 24 h (kept, carried over) */
  overDays: { area: string; date: string; hours: number }[];
  /** rows identical to an earlier row of the sheet (kept: without times they may be two real stops) */
  duplicates: number;
  /** spelling put right: classification case, failure YES/Yes/yes, spaces around texts */
  fixes: { classification: number; failure: number; trimmed: number };
  months: string[];
  areas: string[];
  hours: number;
  dateFrom: string; dateTo: string;
}

const H = {
  date: ['date'], line: ['line'], area: ['equipment'], code: ['equipment code'], hours: ['total stoppage duration (h)'],
  classification: ['stoppage classification', 'stoppage clasification'], criticality: ['criticality'], reason: ['reason'], failure: ['failure'], description: ['description'],
} as const;
type HKey = keyof typeof H;
const norm = (v: unknown): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').toLowerCase() : '');

/** Reads the sheet (as arrays, row 1 = index 0) into clean rows; refuses when the headings are not the NRS ones. */
export function extractHistory(data: unknown[][], date1904 = false): { ok: true; raw: HistoryRaw[]; skipped: HistoryPlan['skipped']; fixes: HistoryPlan['fixes'] } | { ok: false; message: string } {
  let headIdx = -1;
  const cols: Partial<Record<HKey, number>> = {};
  for (let i = 0; i < Math.min(data.length, 10) && headIdx < 0; i++) {
    const row = data[i] ?? [];
    const found: Partial<Record<HKey, number>> = {};
    row.forEach((cell, c) => {
      const h = norm(cell);
      for (const k of Object.keys(H) as HKey[]) if (found[k] === undefined && (H[k] as readonly string[]).includes(h)) found[k] = c;
    });
    if (found.date !== undefined && found.hours !== undefined && found.area !== undefined) { headIdx = i; Object.assign(cols, found); }
  }
  const missing = (Object.keys(H) as HKey[]).filter((k) => k !== 'description' && cols[k] === undefined);
  if (headIdx < 0 || missing.length) {
    return { ok: false, message: t('The sheet does not have the history columns (DATE, LINE, EQUIPMENT, EQUIPMENT CODE, TOTAL STOPPAGE DURATION (h), STOPPAGE CLASSIFICATION, CRITICALITY, REASON, Failure). Missing: {list}.', { list: missing.join(', ') || t('the heading row') }) };
  }
  const cell = (row: unknown[], k: HKey) => (cols[k] === undefined ? undefined : row[cols[k] as number]);
  const raw: HistoryRaw[] = [];
  const skipped: HistoryPlan['skipped'] = [];
  const fixes = { classification: 0, failure: 0, trimmed: 0 };
  for (let i = headIdx + 1; i < data.length; i++) {
    const row = data[i] ?? [];
    const n = i + 1;
    if ((Object.keys(H) as HKey[]).every((k) => textOf(cell(row, k)) === '')) continue;
    const date = readDate(cell(row, 'date'), date1904);
    if (!date) { skipped.push({ source_row: n, why: t('date cannot be read') }); continue; }
    const hours = readNumber(cell(row, 'hours'));
    if (hours === null) { skipped.push({ source_row: n, why: t('no stoppage hours') }); continue; }
    if (hours < 0 || hours > 24 * 31) { skipped.push({ source_row: n, why: t('stoppage hours {h} out of range', { h: hours }) }); continue; }
    const clsRaw = textOf(cell(row, 'classification'));
    const cls = clsRaw.toUpperCase();
    if (clsRaw !== cls) fixes.classification++;
    const critRaw = textOf(cell(row, 'criticality'));
    const crit = readCriticality(critRaw) ?? (cls === 'PL' || cls === 'CIR' ? 'NO_INC' : 'INC');
    const failRaw = textOf(cell(row, 'failure'));
    const failure = ['YES', 'Y', 'TRUE', '1'].includes(failRaw.toUpperCase());
    if (failRaw && failRaw !== 'YES' && failRaw !== 'NO') fixes.failure++;
    const rawReason = typeof cell(row, 'reason') === 'string' ? (cell(row, 'reason') as string) : textOf(cell(row, 'reason'));
    const reason = textOf(cell(row, 'reason'));
    if (rawReason !== reason) fixes.trimmed++;
    raw.push({
      source_row: n, date, line: textOf(cell(row, 'line')), area: textOf(cell(row, 'area')), code: textOf(cell(row, 'code')), hours,
      classification: cls, criticality: crit, failure: failure && (cls !== 'PL' && cls !== 'CIR'), reason, description: textOf(cell(row, 'description')),
    });
  }
  return { ok: true, raw, skipped, fixes };
}

const p2 = (n: number) => String(n).padStart(2, '0');
function tsOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}.000`;
}
const dayMs = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));

/** Lays the stops of each area and date end to end from 00:00 (carrying over into the next day when a day is over 24 h). */
export function packHistory(raw: HistoryRaw[]): { rows: Omit<UploadRow, 'fingerprint'>[]; overDays: HistoryPlan['overDays'] } {
  const byArea = new Map<string, HistoryRaw[]>();
  for (const r of raw) {
    const list = byArea.get(r.area) ?? [];
    list.push(r);
    byArea.set(r.area, list);
  }
  const rows: Omit<UploadRow, 'fingerprint'>[] = [];
  const overDays: HistoryPlan['overDays'] = [];
  for (const [area, list] of byArea) {
    // dates in order, rows of a date in sheet order
    const sorted = list.slice().sort((a, b) => a.date.localeCompare(b.date) || a.source_row - b.source_row);
    let cursor = -Infinity;
    let curDate = '';
    let dayTotal = 0;
    const closeDay = () => { if (curDate && dayTotal > 24 + 1e-9) overDays.push({ area, date: curDate, hours: Math.round(dayTotal * 100) / 100 }); };
    for (const r of sorted) {
      if (r.date !== curDate) { closeDay(); curDate = r.date; dayTotal = 0; }
      const start = Math.max(dayMs(r.date), cursor);
      const secs = Math.round(r.hours * 3600);
      const end = start + secs * 1000;
      cursor = end;
      dayTotal += r.hours;
      rows.push({
        source_row: r.source_row, event_date: r.date, line_id: r.line, area_id: area, code_raw: r.code, stop_ts: tsOf(start), start_ts: tsOf(end), freq: 1,
        classification: r.classification, criticality: r.criticality, is_failure: r.failure, reason_raw: r.reason || undefined, description: r.description || undefined,
      });
    }
    closeDay();
  }
  rows.sort((a, b) => a.source_row - b.source_row);
  return { rows, overDays };
}

async function printOf(p: { area_id: string; code: string; stop_ts: string; start_ts: string; occurrence: number }): Promise<string> {
  if (globalThis.crypto?.subtle) return fingerprint(p);
  return sha256Hex(`${p.area_id}|${codeKey(p.code)}|${p.stop_ts}|${p.start_ts}|${p.occurrence}`);
}

/** The whole plan from the sheet arrays: clean, pack, fingerprint, and the figures for the summary. */
export async function planHistory(data: unknown[][], date1904 = false): Promise<{ ok: true; plan: HistoryPlan } | { ok: false; message: string }> {
  const ex = extractHistory(data, date1904);
  if (!ex.ok) return ex;
  if (!ex.raw.length) return { ok: false, message: t('The sheet has no stoppage rows.') };
  const seen = new Map<string, number>();
  let duplicates = 0;
  for (const r of ex.raw) {
    const k = [r.date, r.line, r.area, r.code, r.hours, r.classification, r.criticality, r.reason, r.failure, r.description].join('|');
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n > 1) duplicates++;
  }
  const packed = packHistory(ex.raw);
  const occ = assignOccurrences(packed.rows.map((r) => ({ area_id: r.area_id, code_raw: r.code_raw, stop_ts: r.stop_ts, start_ts: r.start_ts })));
  const prints = await Promise.all(packed.rows.map((r, i) => printOf({ area_id: r.area_id, code: r.code_raw, stop_ts: r.stop_ts, start_ts: r.start_ts, occurrence: occ[i] as number })));
  const rows: UploadRow[] = packed.rows.map((r, i) => ({ ...r, fingerprint: prints[i] as string }));
  const dates = ex.raw.map((r) => r.date).sort();
  return {
    ok: true,
    plan: {
      rows, rowsRead: ex.raw.length + ex.skipped.length, skipped: ex.skipped, overDays: packed.overDays.sort((a, b) => b.hours - a.hours), duplicates, fixes: ex.fixes,
      months: [...new Set(ex.raw.map((r) => r.date.slice(0, 7)))].sort(), areas: [...new Set(ex.raw.map((r) => r.area))].sort(),
      hours: ex.raw.reduce((s, r) => s + r.hours, 0), dateFrom: dates[0] ?? '', dateTo: dates[dates.length - 1] ?? '',
    },
  };
}

/** Reads the history sheet of a workbook (the NRS workbook itself, or a copy holding only that sheet). */
export async function readHistoryFile(file: File | Blob | ArrayBuffer | Uint8Array): Promise<{ ok: true; plan: HistoryPlan } | { ok: false; message: string }> {
  const size = file instanceof ArrayBuffer || file instanceof Uint8Array ? file.byteLength : file.size;
  if (size > MAX_HISTORY_BYTES) return { ok: false, message: t('This file is larger than {mb} MB.', { mb: MAX_HISTORY_BYTES / 1024 / 1024 }) };
  let res = await readXlsxSheet(file, HISTORY_SHEET);
  if (!res.ok && res.reason === 'no_sheet' && res.sheets.length === 1) res = await readXlsxSheet(file, res.sheets[0] as string);
  if (!res.ok) {
    return { ok: false, message: res.reason === 'no_sheet'
      ? t('This workbook has no sheet called "{name}". The sheets in it are: {list}.', { name: HISTORY_SHEET, list: res.sheets.join(', ') || t('(none)') })
      : t('This file cannot be read as an Excel workbook (.xlsx or .xlsm).') };
  }
  return planHistory(res.data, res.date1904);
}
