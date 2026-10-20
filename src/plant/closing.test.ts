import { describe, expect, it } from 'vitest';
import { closingOf, lockedMonthOf, lockedMonths, periodClosing, type MonthClosing } from './closing';

const c = (section: MonthClosing['section'], year: number, month: number, status: MonthClosing['status']): MonthClosing => ({
  ...closingOf([], section, year, month), status,
});
const ALL = [c('downtime', 2026, 1, 'signed_off'), c('downtime', 2026, 2, 'signed_off'), c('downtime', 2026, 3, 'reviewed'), c('quality', 2026, 3, 'signed_off')];

describe('month closing', () => {
  it('locks only signed-off months of the section', () => {
    expect([...lockedMonths(ALL)].sort()).toEqual(['2026-01', '2026-02']);
    expect([...lockedMonths(ALL, 'quality')]).toEqual(['2026-03']);
    expect(closingOf(ALL, 'production', 2026, 1).status).toBe('open');
  });
  it('a period is final only when every month it touches is signed off', () => {
    expect(periodClosing(ALL, 'downtime', '2026-01-01', '2026-02-28')).toEqual({ final: true, months: ['2026-01', '2026-02'], open: [] });
    expect(periodClosing(ALL, 'downtime', '2026-02-10', '2026-03-05')).toEqual({ final: false, months: ['2026-02', '2026-03'], open: ['2026-03'] });
    expect(periodClosing(ALL, 'downtime', '2025-12-01', '2026-01-31').open).toEqual(['2025-12']);
    expect(periodClosing(undefined, 'downtime', '2026-01-01', '2026-01-31').final).toBe(false);
  });
  it('a record is locked by its date or its stop time', () => {
    const locked = lockedMonths(ALL);
    expect(lockedMonthOf({ event_date: '2026-02-03', stop_ts: '2026-02-03 08:00' }, locked)).toBe('2026-02');
    expect(lockedMonthOf({ event_date: '2026-03-01', stop_ts: '2026-02-28 23:00' }, locked)).toBe('2026-02');
    expect(lockedMonthOf({ event_date: '2026-03-02', stop_ts: '2026-03-02 08:00' }, locked)).toBe('');
  });
});
