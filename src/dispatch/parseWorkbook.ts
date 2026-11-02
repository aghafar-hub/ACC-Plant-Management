// Reads the sheet "Packing & Dispatch" of the plant's monthly / yearly production workbook into DispatchDay rows.
// Uses the exact cell values Excel stored (xlsxReader), so formula cells give their cached result.
// The sheet has three header rows and one row per day from row 4; column positions are fixed by the plant's layout and
// a few header cells are checked first so another sheet is refused instead of being read as nonsense.
import { readXlsxSheet, type XlsxInput } from '../upload/xlsxReader';
import { emptyDay, N_PACKERS, type DispatchDay } from './model';

export const DISPATCH_SHEET = 'Packing & Dispatch';

/** Column letters to 0-based index. */
export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
const C = (l: string): number => colIndex(l);
const plus = (l: string, k: number): number => colIndex(l) + k;

/** Header cells that must read like this (text, case and spacing ignored), as [column, row 1-3, text]. */
const ANCHORS: [string, 1 | 2 | 3, string][] = [
  ['C', 1, 'date'], ['D', 1, 'packer 1'], ['K', 1, 'packer 2'], ['AM', 1, 'packer 6'], ['D', 2, 'dispatch'], ['D', 3, 'tons'],
  ['CD', 1, 'dispatch'], ['CK', 2, 'bulk'], ['BZ', 1, 'opc clinker dispatch'], ['GY', 2, 'stoppage time'], ['GZ', 2, 'unplanned time'],
];

const PACKER_FIRST = ['D', 'K', 'R', 'Y', 'AF', 'AM'] as const;
const STOP = ['GY', 'HA', 'HC', 'HE', 'HG', 'HI'] as const;

export type ParseFailure = 'unreadable' | 'no_sheet' | 'wrong_layout' | 'no_rows' | 'duplicate_dates';
export type ParseResult =
  | { ok: true; days: DispatchDay[]; warnings: string[]; from: string; to: string }
  | { ok: false; reason: ParseFailure; message: string; sheets: string[] };

const norm = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const numOf = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Excel serial (whole days since 1899-12-30) to YYYY-MM-DD. */
export function serialToDate(serial: number, date1904 = false): string {
  const days = Math.round(serial) + (date1904 ? 1462 : 0);
  return new Date(Date.UTC(1899, 11, 30) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Columns that exist in the sheet but that this section does not use: a value there is reported, not silently dropped. */
const UNUSED: [string, string][] = [
  ['CR', 'palletized manual CEM I 42.5'], ['CS', 'palletized manual CEM I 52.5'], ['CT', 'palletized manual CEM II'], ['CU', 'palletized manual SRC'],
  ['GT', 'jumbo palletized CEM I 42.5'], ['GV', 'jumbo palletized CEM II'], ['GW', 'jumbo palletized SRC'],
  ['GD', 'sling from palletizer CEM I 42.5'], ['GE', 'sling from palletizer CEM I 52.5'], ['GG', 'sling from palletizer SRC'],
];

/** Pure part: the rows of the sheet (row 1 = index 0) to days. */
export function parseSheetRows(rows: unknown[][], date1904 = false): ParseResult {
  const sheets: string[] = [DISPATCH_SHEET];
  for (const [col, r, want] of ANCHORS) {
    const got = norm(rows[r - 1]?.[C(col)]);
    if (!got.includes(want)) {
      return { ok: false, reason: 'wrong_layout', sheets, message: `This does not look like the "${DISPATCH_SHEET}" sheet: cell ${col}${r} should read "${want}" but reads "${got || 'nothing'}".` };
    }
  }
  const days: DispatchDay[] = [];
  const seen = new Set<string>();
  const warnings: string[] = [];
  const unusedHit = new Map<string, number>();
  const dateCol = C('C');
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const dv = row[dateCol];
    // a day row has a date in column C; the total / average rows under the data have text there
    if (typeof dv !== 'number' || dv < 20_000) continue;
    const date = serialToDate(dv, date1904);
    if (seen.has(date)) return { ok: false, reason: 'duplicate_dates', sheets, message: `The date ${date} appears twice in the sheet (row ${r + 1}).` };
    seen.add(date);
    const d = emptyDay(date);
    PACKER_FIRST.forEach((first, i) => {
      const p = d.packers[i]!;
      p.tons = numOf(row[C(first)]); p.bags = numOf(row[plus(first, 1)]); p.broken = numOf(row[plus(first, 2)]);
      p.runH = numOf(row[plus(first, 5)]); p.noTruckH = numOf(row[plus(first, 6)]);
      p.stopH = numOf(row[C(STOP[i]!)]); p.unplannedH = numOf(row[plus(STOP[i]!, 1)]);
    });
    for (let j = 0; j < 6; j++) { d.bagged[j] = numOf(row[plus('CD', j)]); d.bulk[j] = numOf(row[plus('CK', j)]); }
    d.slingManual = numOf(row[C('CV')]); d.slingPalletizer = numOf(row[C('GF')]); d.jumbo = numOf(row[C('GU')]);
    d.clinker = { opc: numOf(row[C('BZ')]), src: numOf(row[C('CA')]), over60: numOf(row[C('CB')]), lowAlk: numOf(row[C('CC')]) };
    d.power = [numOf(row[C('BX')]), numOf(row[C('BY')])];
    d.wcnBags = numOf(row[C('EW')]); d.wcnBroken = numOf(row[C('EX')]);
    d.slingProduction = numOf(row[C('FI')]); d.jumboProduction = numOf(row[C('GR')]);
    for (const [col, label] of UNUSED) if (numOf(row[C(col)]) !== 0) unusedHit.set(label, (unusedHit.get(label) ?? 0) + 1);
    days.push(d);
  }
  if (days.length === 0) return { ok: false, reason: 'no_rows', sheets, message: 'The sheet has no day rows (dates in column C from row 4).' };
  days.sort((a, b) => a.date.localeCompare(b.date));
  for (const [label, n] of unusedHit) warnings.push(`${n} day(s) have a value in "${label}", which this section does not import.`);
  if (days.length !== 365 && days.length !== 366 && days.length < 28) warnings.push(`Only ${days.length} day(s) found.`);
  return { ok: true, days, warnings, from: days[0]!.date, to: days[days.length - 1]!.date };
}

/** Reads an .xlsx file (the browser's File or bytes). */
export async function parseDispatchWorkbook(file: XlsxInput): Promise<ParseResult> {
  const res = await readXlsxSheet(file, DISPATCH_SHEET);
  if (!res.ok) {
    return res.reason === 'no_sheet'
      ? { ok: false, reason: 'no_sheet', sheets: res.sheets, message: `The workbook has no sheet called "${DISPATCH_SHEET}". Its sheets are: ${res.sheets.join(', ') || 'none'}.` }
      : { ok: false, reason: 'unreadable', sheets: res.sheets, message: 'This file could not be read as an .xlsx workbook.' };
  }
  return parseSheetRows(res.data, res.date1904);
}

export const PACKER_COUNT = N_PACKERS;
