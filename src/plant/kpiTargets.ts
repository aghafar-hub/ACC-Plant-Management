// KPI targets (plant system, backend 2.3.0): the one place targets live (rule 4 of docs/plant-system/01-kpi-definitions.md).
// A target belongs to a scope (plant, line or area), a KPI, a year and a month (0 = the whole year). Pure: no React.
//
// Which target applies (resolveKpiTarget): the most specific one. For an area: the area's own, then its line's, then the
// plant's; within each scope, the month's target when the period is one month, else the year's. Nothing found = no target.

export type TargetScope = 'plant' | 'line' | 'area';

export interface KpiDefinition {
  kpi_id: string; name: string; category: string; unit: string;
  better: 'higher' | 'lower' | 'none'; decimals: number; aggregation: string; status: 'draft' | 'approved';
}

export interface KpiTarget {
  scope_type: TargetScope; scope_id: string; kpi_id: string; year: number;
  /** 1-12, or 0 for the whole year */
  month: number;
  target_value: number | null; lower_limit: number | null; upper_limit: number | null;
  source: string; updated_by: string; updated_at: string;
}

/** What the Settings page sends for one KPI and month of a scope and year. */
export interface KpiTargetInput {
  kpi_id: string; month: number;
  target_value: number | null; lower_limit?: number | null; upper_limit?: number | null; source?: string;
}

export interface KpiTargetSave { year: number; scope_type: TargetScope; scope_id: string; rows: KpiTargetInput[] }

/** The downtime KPIs the dashboard judges against a target, and the kpi_id each one uses. */
export const DASH_KPI = { reliability: 'RF', utilization: 'UF', ea: 'EA', mtbf: 'MTBF', mttr: 'MTTR' } as const;

/**
 * The target that applies to a scope for a period, or null. `month` is 1-12 for a one-month period, else null (the year's
 * target). `lineOf` gives an area's line.
 */
export function resolveKpiTarget(
  targets: readonly KpiTarget[], kpiId: string, scope: { type: TargetScope; id: string }, year: number, month: number | null,
  lineOf?: (areaId: string) => string | undefined,
): KpiTarget | null {
  const chain: { type: TargetScope; id: string }[] = [];
  if (scope.type === 'area') {
    chain.push(scope);
    const line = lineOf?.(scope.id);
    if (line) chain.push({ type: 'line', id: line });
  } else if (scope.type === 'line') chain.push(scope);
  chain.push({ type: 'plant', id: '' });
  for (const s of chain) {
    const mine = targets.filter((t) => t.kpi_id === kpiId && t.year === year && t.scope_type === s.type && (s.type === 'plant' || t.scope_id === s.id) && t.target_value !== null);
    const hit = (month !== null ? mine.find((t) => t.month === month) : undefined) ?? mine.find((t) => t.month === 0);
    if (hit) return hit;
  }
  return null;
}

/** The single month a period covers ('YYYY-MM-DD' to 'YYYY-MM-DD'), or null when it spans more than one month. */
export function periodMonth(from: string, to: string): { year: number; month: number | null } {
  const year = Number(to.slice(0, 4));
  return from.slice(0, 7) === to.slice(0, 7) ? { year, month: Number(to.slice(5, 7)) } : { year, month: null };
}

/**
 * Checks one save the way the server does; returns the rows to store (rows with no target and no limits are dropped) or
 * a plain-English problem.
 */
export function cleanTargetSave(p: KpiTargetSave, defs: readonly KpiDefinition[], lines: ReadonlySet<string>, areas: ReadonlySet<string>): { rows: KpiTargetInput[] } | { problem: string } {
  if (!Number.isInteger(p.year) || p.year < 2000 || p.year > 2100) return { problem: 'Choose a year between 2000 and 2100.' };
  if (!['plant', 'line', 'area'].includes(p.scope_type)) return { problem: 'Scope must be plant, line or area.' };
  if (p.scope_type === 'line' && !lines.has(p.scope_id)) return { problem: `There is no line ${p.scope_id}.` };
  if (p.scope_type === 'area' && !areas.has(p.scope_id)) return { problem: `There is no area ${p.scope_id}.` };
  if (!Array.isArray(p.rows)) return { problem: 'Targets must be a list.' };
  const byId = new Map(defs.map((d) => [d.kpi_id, d]));
  const seen = new Set<string>();
  const out: KpiTargetInput[] = [];
  for (const r of p.rows) {
    const def = byId.get(r.kpi_id);
    if (!def) return { problem: `Unknown KPI: ${r.kpi_id}.` };
    const month = Number(r.month ?? 0);
    if (!Number.isInteger(month) || month < 0 || month > 12) return { problem: 'Month must be 1 to 12, or 0 for the whole year.' };
    const label = `${def.name} (${p.year}${month ? `-${String(month).padStart(2, '0')}` : ''})`;
    const num = (v: number | null | undefined, what: string): number | null | string => {
      if (v === null || v === undefined || (v as unknown) === '') return null;
      return Number.isFinite(Number(v)) ? Number(v) : `${label}: ${what} must be a number.`;
    };
    const tv = num(r.target_value, 'target');
    const lo = num(r.lower_limit, 'lower limit');
    const hi = num(r.upper_limit, 'upper limit');
    for (const x of [tv, lo, hi]) if (typeof x === 'string') return { problem: x };
    if (typeof lo === 'number' && typeof hi === 'number' && lo > hi) return { problem: `${label}: the lower limit is above the upper limit.` };
    if (tv === null && lo === null && hi === null) continue;
    const key = `${r.kpi_id}|${month}`;
    if (seen.has(key)) return { problem: `${label} is listed twice.` };
    seen.add(key);
    out.push({ kpi_id: r.kpi_id, month, target_value: tv as number | null, lower_limit: lo as number | null, upper_limit: hi as number | null, source: (r.source ?? '').trim().slice(0, 100) });
  }
  return { rows: out };
}

/**
 * The RF and UF targets single areas get from an area or line target of Settings › KPI targets (the plant target is the
 * plant-wide fallback and is left out here). `areaLines`: area id -> line id.
 */
export function areaKpiTargets(targets: readonly KpiTarget[], areaLines: ReadonlyMap<string, string>, year: number, month: number | null): Map<string, { reliability?: number; utilization?: number }> {
  const out = new Map<string, { reliability?: number; utilization?: number }>();
  if (!targets.some((t) => t.scope_type !== 'plant')) return out;
  for (const [area, line] of areaLines) {
    const o: { reliability?: number; utilization?: number } = {};
    for (const [kpi, key] of [['RF', 'reliability'], ['UF', 'utilization']] as const) {
      const hit = resolveKpiTarget(targets, kpi, { type: 'area', id: area }, year, month, () => line);
      if (hit && hit.scope_type !== 'plant' && hit.target_value !== null) o[key] = hit.target_value;
    }
    if (Object.keys(o).length) out.set(area, o);
  }
  return out;
}
