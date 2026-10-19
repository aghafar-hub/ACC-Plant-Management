// Responsibilities (plant system, backend 2.0.0): who holds which duty for which part of the plant.
// The same checks as backend/apps-script/Responsibilities.js, so the Users page can show a problem before saving,
// and the coverage grid (areas × duties: who is main, who is backup, where nobody is).
import { t } from '../i18n/t';

export const DUTIES = ['shift_entry', 'production_review', 'reliability_validation', 'production_data', 'quality_validation',
  'month_review', 'month_signoff', 'targets', 'master_data', 'daily_meeting'] as const;
export type Duty = typeof DUTIES[number];
export const SECTIONS = ['downtime', 'production', 'quality', 'plant'] as const;
export type Section = typeof SECTIONS[number];
export type ScopeType = 'plant' | 'line' | 'area';

/** Duties that are held for a section of the month-end closing. */
export const SECTION_DUTIES: readonly Duty[] = ['month_review', 'month_signoff'];

export interface ResponsibilityInput {
  duty: Duty; section?: Section | ''; scope_type: ScopeType; scope_id?: string; is_backup?: boolean; valid_from?: string; valid_to?: string;
}
export interface Responsibility extends Required<Omit<ResponsibilityInput, 'section'>> {
  resp_id: string; user_id: string; section: Section | ''; updated_by: string; updated_at: string;
}

export function dutyName(d: Duty): string {
  const names: Record<Duty, string> = {
    shift_entry: t('Shift report entry'), production_review: t('Production review'), reliability_validation: t('Reliability validation'),
    production_data: t('Production data'), quality_validation: t('Quality validation'), month_review: t('Month review'),
    month_signoff: t('Month sign-off'), targets: t('Targets'), master_data: t('Master data'), daily_meeting: t('Daily meeting'),
  };
  return names[d];
}

export function dutyHelp(d: Duty): string {
  const help: Record<Duty, string> = {
    shift_entry: t('Enters the shift reports (stoppages) of the scope.'),
    production_review: t('Reviews shift reports and approves or returns them.'),
    reliability_validation: t('Validates approved shift reports; validated stoppages go into the downtime analysis.'),
    production_data: t('Enters and corrects production, power, fuel, water and stock values.'),
    quality_validation: t('Enters and validates laboratory results and quality limits.'),
    month_review: t('Section engineer: reviews the month of a section.'),
    month_signoff: t('Section manager: signs off and locks the month of a section.'),
    targets: t('Edits KPI targets.'), master_data: t('Edits equipment, reasons and measured values.'),
    daily_meeting: t('Sees the daily meeting view and its alerts.'),
  };
  return help[d];
}

export function sectionName(s: Section): string {
  return ({ downtime: t('Downtime and reliability'), production: t('Production'), quality: t('Quality'), plant: t('Plant report') } as Record<Section, string>)[s];
}

const isDate = (s: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]!;
};

/** The row as the server stores it, or a plain-English problem. `lines` and `areas` are the known ids. */
export function cleanResponsibility(r: ResponsibilityInput, lines: Set<string>, areas: Set<string>): { row: Required<ResponsibilityInput> } | { error: string } {
  if (!DUTIES.includes(r.duty)) return { error: t('Unknown duty: {d}.', { d: String(r.duty).slice(0, 40) }) };
  const section = r.section ?? '';
  if (SECTION_DUTIES.includes(r.duty)) {
    if (!SECTIONS.includes(section as Section)) return { error: t('Choose the section (downtime, production, quality or plant) for {d}.', { d: r.duty }) };
  } else if (section) return { error: t('Only month review and month sign-off have a section.') };
  if (!['plant', 'line', 'area'].includes(r.scope_type)) return { error: t('Scope must be plant, line or area.') };
  let scopeId = (r.scope_id ?? '').trim();
  if (r.scope_type === 'plant') scopeId = '';
  else if (r.scope_type === 'line' && !lines.has(scopeId)) return { error: t('There is no line {id}.', { id: scopeId.slice(0, 40) }) };
  else if (r.scope_type === 'area' && !areas.has(scopeId)) return { error: t('There is no area {id}.', { id: scopeId.slice(0, 40) }) };
  const from = r.valid_from ?? '', to = r.valid_to ?? '';
  if (from && !isDate(from)) return { error: t('Valid from must be a date like 2026-10-01.') };
  if (to && !isDate(to)) return { error: t('Valid to must be a date like 2026-10-31.') };
  if (from && to && to < from) return { error: t('Valid to is before valid from.') };
  return { row: { duty: r.duty, section, scope_type: r.scope_type, scope_id: scopeId, is_backup: r.is_backup === true, valid_from: from, valid_to: to } };
}

export const respKey = (r: Pick<ResponsibilityInput, 'duty' | 'section' | 'scope_type' | 'scope_id' | 'is_backup'>): string =>
  [r.duty, r.section ?? '', r.scope_type, r.scope_type === 'plant' ? '' : r.scope_id ?? '', r.is_backup ? 'backup' : 'main'].join('|');

/** Checks a whole set as saveResponsibilities does: every row, then duplicates. */
export function validateSet(rows: ResponsibilityInput[], lines: Set<string>, areas: Set<string>): string | null {
  const seen = new Set<string>();
  for (const r of rows) {
    const c = cleanResponsibility(r, lines, areas);
    if ('error' in c) return c.error;
    const k = respKey(c.row);
    if (seen.has(k)) return t('The same responsibility is listed twice.');
    seen.add(k);
  }
  return null;
}

/** True on `day` (YYYY-MM-DD) when the row has no dates or the day is inside them. */
export const inForce = (r: Pick<Responsibility, 'valid_from' | 'valid_to'>, day: string): boolean =>
  (!r.valid_from || r.valid_from <= day) && (!r.valid_to || day <= r.valid_to);

/** Does the row cover this area (directly, through its line, or the whole plant)? */
export const covers = (r: Pick<Responsibility, 'scope_type' | 'scope_id'>, area: { area_id: string; line_id: string }): boolean =>
  r.scope_type === 'plant' || (r.scope_type === 'line' && r.scope_id === area.line_id) || (r.scope_type === 'area' && r.scope_id === area.area_id);

/** Duties checked area by area in the coverage grid (the month and plant-wide duties are listed by section instead). */
export const AREA_DUTIES: readonly Duty[] = ['shift_entry', 'production_review', 'reliability_validation', 'production_data', 'quality_validation', 'daily_meeting'];

export interface CoverageCell { main: string[]; backup: string[] }

/**
 * Who holds each area duty on `day`: active users only, rows in force only. A cell with no main person is a gap
 * (a report of that area could not move on); a cell with a main person but no backup is covered while that person is in.
 */
export function coverage(rows: Responsibility[], users: { user_id: string; active: boolean }[], areas: { area_id: string; line_id: string }[], day: string): Map<string, CoverageCell> {
  const activeUsers = new Set(users.filter((u) => u.active).map((u) => u.user_id));
  const out = new Map<string, CoverageCell>();
  for (const a of areas) {
    for (const d of AREA_DUTIES) {
      const cell: CoverageCell = { main: [], backup: [] };
      for (const r of rows) {
        if (r.duty !== d || !activeUsers.has(r.user_id) || !inForce(r, day) || !covers(r, a)) continue;
        const list = r.is_backup ? cell.backup : cell.main;
        if (!list.includes(r.user_id)) list.push(r.user_id);
      }
      out.set(`${a.area_id}|${d}`, cell);
    }
  }
  return out;
}

/** Who holds month review and sign-off of each section on `day`. */
export function sectionCoverage(rows: Responsibility[], users: { user_id: string; active: boolean }[], day: string): Map<string, CoverageCell> {
  const activeUsers = new Set(users.filter((u) => u.active).map((u) => u.user_id));
  const out = new Map<string, CoverageCell>();
  for (const s of SECTIONS) {
    for (const d of SECTION_DUTIES) {
      const cell: CoverageCell = { main: [], backup: [] };
      for (const r of rows) {
        if (r.duty !== d || r.section !== s || !activeUsers.has(r.user_id) || !inForce(r, day)) continue;
        const list = r.is_backup ? cell.backup : cell.main;
        if (!list.includes(r.user_id)) list.push(r.user_id);
      }
      out.set(`${s}|${d}`, cell);
    }
  }
  return out;
}
