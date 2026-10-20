import { useMemo } from 'react';
import { useAreaTargets } from '../actions/ActionsContext';
import { areaOwnTargets, areaTargetMap } from '../actions/targets';
import { areaKpiTargets } from '../plant/kpiTargets';
import type { OwnTargets } from './targets';
import type { DashCtx } from './scope';

/** The year the Dashboard figures are about: the year of the end of the period shown. */
export const ctxYear = (ctx: DashCtx | null): number | null => {
  const end = ctx?.win.effective?.to ?? ctx?.win.range.to;
  return end ? Number(end.slice(0, 4)) : null;
};

/**
 * Availability targets of single areas for the year of the period (Settings › Actions & targets), or null when no area has
 * one: the plant-wide target then applies everywhere, exactly as before.
 */
export function useAreaTargetMap(ctx: DashCtx | null): ReadonlyMap<string, number> | null {
  const { targets } = useAreaTargets();
  const year = ctxYear(ctx);
  return useMemo(() => {
    if (year === null) return null;
    const m = areaTargetMap(targets, year);
    return m.size ? m : null;
  }, [targets, year]);
}

/**
 * All own targets of single areas (availability, RF, UF) for the year of the period, or null when no area has one.
 * An area or line target of Settings › KPI targets (backend 2.3.0) wins over the older per-area target of the year.
 */
export function useAreaOwnTargets(ctx: DashCtx | null): ReadonlyMap<string, OwnTargets> | null {
  const { targets } = useAreaTargets();
  const year = ctxYear(ctx);
  const master = ctx?.master;
  return useMemo(() => {
    if (year === null) return null;
    const m = areaOwnTargets(targets, year);
    const kpi = master?.kpiTargets ?? [];
    if (kpi.length && master) {
      const lines = new Map([...master.index.areaById.values()].map((a) => [a.area_id, a.line_id]));
      const p = master.targetPeriod ?? { year, month: null };
      for (const [area, o] of areaKpiTargets(kpi, lines, p.year, p.month)) m.set(area, { ...m.get(area), ...o });
    }
    return m.size ? m : null;
  }, [targets, year, master]);
}
