import { describe, expect, it } from 'vitest';
import { areaKpiTargets, cleanTargetSave, periodMonth, resolveKpiTarget, type KpiDefinition, type KpiTarget } from './kpiTargets';

const tg = (scope_type: KpiTarget['scope_type'], scope_id: string, kpi_id: string, year: number, month: number, target_value: number | null): KpiTarget => ({
  scope_type, scope_id, kpi_id, year, month, target_value, lower_limit: null, upper_limit: null, source: '', updated_by: '', updated_at: '',
});
const TARGETS: KpiTarget[] = [
  tg('plant', '', 'RF', 2026, 0, 95),
  tg('plant', '', 'RF', 2026, 6, 93),
  tg('line', 'L.1', 'RF', 2026, 0, 96),
  tg('area', 'K.1', 'RF', 2026, 0, 97),
  tg('area', 'K.1', 'UF', 2026, 0, null),
  tg('plant', '', 'RF', 2025, 0, 90),
];
const lineOf = (a: string) => ({ 'K.1': 'L.1', 'CR': 'L.1', 'K.2': 'L.2' } as Record<string, string>)[a];

describe('resolveKpiTarget', () => {
  it('uses the most specific scope: area, then line, then plant', () => {
    expect(resolveKpiTarget(TARGETS, 'RF', { type: 'area', id: 'K.1' }, 2026, null, lineOf)?.target_value).toBe(97);
    expect(resolveKpiTarget(TARGETS, 'RF', { type: 'area', id: 'CR' }, 2026, null, lineOf)?.target_value).toBe(96);
    expect(resolveKpiTarget(TARGETS, 'RF', { type: 'area', id: 'K.2' }, 2026, null, lineOf)?.target_value).toBe(95);
    expect(resolveKpiTarget(TARGETS, 'RF', { type: 'plant', id: '' }, 2025, null)?.target_value).toBe(90);
  });
  it('a month target replaces the year target of the same scope for a one-month period', () => {
    expect(resolveKpiTarget(TARGETS, 'RF', { type: 'plant', id: '' }, 2026, 6)?.target_value).toBe(93);
    expect(resolveKpiTarget(TARGETS, 'RF', { type: 'plant', id: '' }, 2026, 7)?.target_value).toBe(95);
    // the area's own year target is more specific than the plant's month target
    expect(resolveKpiTarget(TARGETS, 'RF', { type: 'area', id: 'K.1' }, 2026, 6, lineOf)?.target_value).toBe(97);
  });
  it('a row with only limits (no target value) is not a target; another year or KPI is nothing', () => {
    expect(resolveKpiTarget(TARGETS, 'UF', { type: 'area', id: 'K.1' }, 2026, null, lineOf)).toBeNull();
    expect(resolveKpiTarget(TARGETS, 'MTBF', { type: 'plant', id: '' }, 2026, null)).toBeNull();
    expect(resolveKpiTarget(TARGETS, 'RF', { type: 'plant', id: '' }, 2024, null)).toBeNull();
  });
});

describe('periodMonth', () => {
  it('names the month of a one-month period, else only the year (of the end)', () => {
    expect(periodMonth('2026-06-01', '2026-06-30')).toEqual({ year: 2026, month: 6 });
    expect(periodMonth('2026-06-10', '2026-06-12')).toEqual({ year: 2026, month: 6 });
    expect(periodMonth('2026-01-01', '2026-12-31')).toEqual({ year: 2026, month: null });
    expect(periodMonth('2025-12-01', '2026-01-31')).toEqual({ year: 2026, month: null });
  });
});

describe('areaKpiTargets', () => {
  it('gives each area its own or its line RF / UF target, never the plant one', () => {
    const m = areaKpiTargets(TARGETS, new Map([['K.1', 'L.1'], ['CR', 'L.1'], ['K.2', 'L.2']]), 2026, null);
    expect(m.get('K.1')).toEqual({ reliability: 97 });
    expect(m.get('CR')).toEqual({ reliability: 96 });
    expect(m.has('K.2')).toBe(false);
  });
});

describe('cleanTargetSave', () => {
  const defs = [{ kpi_id: 'RF', name: 'Reliability factor (RF)' }, { kpi_id: 'MTTR', name: 'MTTR' }] as KpiDefinition[];
  const lines = new Set(['L.1']);
  const areas = new Set(['K.1']);
  const save = (p: Partial<Parameters<typeof cleanTargetSave>[0]>) => cleanTargetSave({ year: 2026, scope_type: 'plant', scope_id: '', rows: [], ...p }, defs, lines, areas);
  it('keeps rows with a target or a limit, drops empty ones', () => {
    expect(save({ rows: [{ kpi_id: 'RF', month: 0, target_value: 95 }, { kpi_id: 'MTTR', month: 0, target_value: null }] })).toEqual({
      rows: [{ kpi_id: 'RF', month: 0, target_value: 95, lower_limit: null, upper_limit: null, source: '' }],
    });
  });
  it('refuses plain mistakes in plain words', () => {
    const problem = (p: Partial<Parameters<typeof cleanTargetSave>[0]>) => (save(p) as { problem?: string }).problem;
    expect(problem({ year: 1999 })).toMatch(/between 2000 and 2100/);
    expect(problem({ scope_type: 'area', scope_id: 'XX' })).toMatch(/no area XX/);
    expect(problem({ scope_type: 'line', scope_id: 'L.9' })).toMatch(/no line L\.9/);
    expect(problem({ rows: [{ kpi_id: 'OEE', month: 0, target_value: 1 }] })).toMatch(/Unknown KPI: OEE/);
    expect(problem({ rows: [{ kpi_id: 'RF', month: 13, target_value: 1 }] })).toMatch(/Month must be 1 to 12/);
    expect(problem({ rows: [{ kpi_id: 'RF', month: 0, target_value: 95, lower_limit: 99, upper_limit: 90 }] })).toMatch(/lower limit is above/);
    expect(problem({ rows: [{ kpi_id: 'RF', month: 2, target_value: 95 }, { kpi_id: 'RF', month: 2, target_value: 96 }] })).toMatch(/\(2026-02\) is listed twice/);
  });
});
