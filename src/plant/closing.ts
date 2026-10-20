// Month-end closing (plant system, backend 2.3.0): the section engineer reviews a month, the section manager (another
// person) signs it off and it is locked; reopening needs a reason. The plant report is signed off once the three sections
// are. Mirrors backend/apps-script/Closing.js. Pure: no React.

export type ClosingSection = 'downtime' | 'production' | 'quality' | 'plant';
export type ClosingStatus = 'open' | 'reviewed' | 'signed_off' | 'reopened';
export const CLOSING_SECTIONS: ClosingSection[] = ['downtime', 'production', 'quality', 'plant'];
export const CLOSING_SECTION_TEXT: Record<ClosingSection, string> = {
  downtime: 'Downtime and reliability', production: 'Production', quality: 'Quality', plant: 'Plant report',
};
export const CLOSING_REASON_MIN = 10;

export interface MonthClosing {
  section: ClosingSection; year: number; month: number; status: ClosingStatus;
  /** data checks still open when it was reviewed (downtime: records to check) */
  open_checks: number | null;
  reviewed_by: string; reviewed_at: string; review_comment: string;
  signed_off_by: string; signed_off_at: string; signoff_comment: string;
  reopened_by: string; reopened_at: string; reopen_reason: string; updated_at: string;
}

export interface MonthClosingStep { section: ClosingSection; year: number; month: number; step: 'review' | 'signoff' | 'reopen'; comment?: string }

export const monthKey = (year: number, month: number): string => `${year}-${String(month).padStart(2, '0')}`;

/** 'YYYY-MM' of every signed-off month of a section. */
export function lockedMonths(closings: readonly MonthClosing[] | undefined, section: ClosingSection = 'downtime'): Set<string> {
  return new Set((closings ?? []).filter((c) => c.section === section && c.status === 'signed_off').map((c) => monthKey(c.year, c.month)));
}

/** The closing of a section and month (an untouched month is 'open'). */
export function closingOf(closings: readonly MonthClosing[] | undefined, section: ClosingSection, year: number, month: number): MonthClosing {
  return (closings ?? []).find((c) => c.section === section && c.year === year && c.month === month) ?? {
    section, year, month, status: 'open', open_checks: null, reviewed_by: '', reviewed_at: '', review_comment: '',
    signed_off_by: '', signed_off_at: '', signoff_comment: '', reopened_by: '', reopened_at: '', reopen_reason: '', updated_at: '',
  };
}

/**
 * Final or provisional: a period is final when every month it touches is signed off for the section. Months are
 * 'YYYY-MM' from `from` to `to` (dates 'YYYY-MM-DD').
 */
export function periodClosing(closings: readonly MonthClosing[] | undefined, section: ClosingSection, from: string, to: string): { final: boolean; months: string[]; open: string[] } {
  const months: string[] = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4)), endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    months.push(monthKey(y, m));
    m++;
    if (m > 12) { m = 1; y++; }
    if (months.length > 600) break;
  }
  const locked = lockedMonths(closings, section);
  const open = months.filter((x) => !locked.has(x));
  return { final: months.length > 0 && open.length === 0, months, open };
}

/** The text the server uses when a change touches a signed-off month. */
export const lockedText = (ym: string): string => {
  const d = new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `The downtime of ${d} is signed off and locked. The section manager reopens it (with a reason) in Month closing before anything changes.`;
};

/** The signed-off month a record touches (its date or its stop time), or ''. Same rule as the server. */
export function lockedMonthOf(rec: { event_date?: string; stop_ts?: string }, locked: ReadonlySet<string>): string {
  const a = String(rec.event_date ?? '').slice(0, 7), b = String(rec.stop_ts ?? '').slice(0, 7);
  return locked.has(a) ? a : locked.has(b) ? b : '';
}
