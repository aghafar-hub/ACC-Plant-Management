import type { Access, AccessLevel, TabId } from '../../api/types';

// The standard access of each role (docs/architecture-and-build-plan.md section 7.3, schema/tables.json).
// The API has no call that reads the role table, so the editor shows these as "role default".
// A test checks that this copy matches schema/tables.json.
const H: AccessLevel = 'Hidden', V: AccessLevel = 'View', E: AccessLevel = 'Edit';
export const ROLE_DEFAULTS: Record<string, Access> = {
  'ROLE-ADMIN': { overview: E, pareto: E, repeats: E, reliability: E, reports: E, actions: E, events: E, upload: E, master: E, settings: E, users: E, shift: E, daily: E },
  'ROLE-MGR': { overview: V, pareto: V, repeats: V, reliability: V, reports: E, actions: E, events: V, upload: H, master: V, settings: H, users: H, shift: V, daily: V },
  'ROLE-ENG': { overview: V, pareto: V, repeats: V, reliability: V, reports: V, actions: E, events: E, upload: E, master: E, settings: H, users: H, shift: V, daily: V },
  'ROLE-VIEW': { overview: V, pareto: V, repeats: V, reliability: V, reports: V, actions: V, events: V, upload: H, master: H, settings: H, users: H, shift: H, daily: V },
  // Schema v7 (plant system): the shift report roles. Their Shift reports and Daily meeting tabs come with Stage 1.
  'ROLE-SHIFT': { overview: V, pareto: V, repeats: V, reliability: V, reports: V, actions: V, events: V, upload: H, master: H, settings: H, users: H, shift: E, daily: V },
  'ROLE-PROD': { overview: V, pareto: V, repeats: V, reliability: V, reports: E, actions: E, events: V, upload: H, master: H, settings: H, users: H, shift: E, daily: V },
  'ROLE-QC': { overview: V, pareto: V, repeats: V, reliability: V, reports: V, actions: V, events: V, upload: H, master: H, settings: H, users: H, shift: H, daily: V },
  'ROLE-REL': { overview: V, pareto: V, repeats: V, reliability: V, reports: V, actions: E, events: E, upload: E, master: E, settings: H, users: H, shift: E, daily: V },
};
export const ROLE_IDS = Object.keys(ROLE_DEFAULTS);

export const roleDefault = (roleId: string, tab: TabId): AccessLevel => ROLE_DEFAULTS[roleId]?.[tab] ?? 'Hidden';
