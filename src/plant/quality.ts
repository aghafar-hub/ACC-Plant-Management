// Quality limits (plant system, backend 2.3.0): the specification and valid range of each laboratory parameter
// (quality_parameters, 52 seeded from the QCX list). Entered by the quality department in Settings › Quality limits;
// later used to judge laboratory results (in specification, outside the valid range = a typing error). Pure: no React.

export interface QualityParameter {
  param_id: string; area_id: string; material: string; name: string; unit: string;
  spec_min: number | null; spec_max: number | null; target: number | null;
  valid_min: number | null; valid_max: number | null; samples_per_day: number | null;
  qcx_column: string; sort_order: number; active: boolean; notes: string; updated_by: string; updated_at: string;
}

/** What can be changed on a parameter (its identity, name and QCX column stay as seeded). */
export type QualityLimitInput = Pick<QualityParameter, 'param_id' | 'spec_min' | 'spec_max' | 'target' | 'valid_min' | 'valid_max' | 'samples_per_day' | 'active' | 'notes'>;

export const QUALITY_LIMIT_FIELDS = ['spec_min', 'spec_max', 'target', 'valid_min', 'valid_max', 'samples_per_day', 'active', 'notes'] as const;

export const MATERIAL_TEXT: Record<string, string> = {
  raw_meal: 'Raw meal', kiln_feed: 'Kiln feed', hot_meal: 'Hot meal', clinker: 'Clinker', cement: 'Cement', coal: 'Coal', petcoke: 'Petcoke',
};

/** The problem with one parameter's limits in plain words, or null. Same rules as the server (Quality.js). */
export function limitProblem(p: Pick<QualityParameter, 'name' | 'area_id' | 'spec_min' | 'spec_max' | 'target' | 'valid_min' | 'valid_max' | 'samples_per_day'>): string | null {
  const label = `${p.area_id} ${p.name}`;
  const nums: [string, number | null][] = [['specification minimum', p.spec_min], ['specification maximum', p.spec_max], ['target', p.target], ['valid minimum', p.valid_min], ['valid maximum', p.valid_max]];
  for (const [what, v] of nums) if (v !== null && !Number.isFinite(v)) return `${label}: the ${what} must be a number.`;
  if (p.samples_per_day !== null && (!Number.isInteger(p.samples_per_day) || p.samples_per_day < 0 || p.samples_per_day > 96)) return `${label}: samples per day must be a whole number from 0 to 96.`;
  if (p.spec_min !== null && p.spec_max !== null && p.spec_min > p.spec_max) return `${label}: the specification minimum is above the maximum.`;
  if (p.valid_min !== null && p.valid_max !== null && p.valid_min >= p.valid_max) return `${label}: the valid minimum must be below the valid maximum.`;
  if (p.target !== null && ((p.spec_min !== null && p.target < p.spec_min) || (p.spec_max !== null && p.target > p.spec_max))) return `${label}: the target is outside the specification.`;
  for (const [what, v] of [['specification minimum', p.spec_min], ['specification maximum', p.spec_max], ['target', p.target]] as const) {
    if (v === null) continue;
    if ((p.valid_min !== null && v < p.valid_min) || (p.valid_max !== null && v > p.valid_max)) return `${label}: the ${what} is outside the valid range (${p.valid_min ?? '…'} to ${p.valid_max ?? '…'}).`;
  }
  return null;
}

/** The fields of a stored parameter that differ from an input (for the audit text and to skip unchanged rows). */
export function changedLimitFields(stored: QualityParameter, next: QualityLimitInput): string[] {
  return QUALITY_LIMIT_FIELDS.filter((f) => (stored[f] ?? null) !== (next[f] ?? null));
}
