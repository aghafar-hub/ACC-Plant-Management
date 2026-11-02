import { beforeAll, describe, expect, it } from 'vitest';
import { createMockApi, type MockApi } from './mockApi';
import { ApiError, type Session } from './types';
import { DEMO_PASSWORD } from '../mock/synthetic';
import { emptyDay, emptySettings } from '../dispatch/model';
import { ROLE_DEFAULTS } from '../admin/users/roleDefaults';
import tables from '../../schema/tables.json';

let api: MockApi;
const s: Record<string, Session> = {};
async function code(p: Promise<unknown>): Promise<string> {
  try { await p; return 'ok'; } catch (e) { return e instanceof ApiError ? e.code : `other:${String(e)}`; }
}
beforeAll(async () => {
  api = createMockApi();
  for (const r of ['admin', 'manager', 'engineer', 'viewer']) s[r] = await api.login(`${r}@demo.test`, DEMO_PASSWORD, true);
});

describe('Dispatch & Packing access tab', () => {
  it('Admin and Manager edit it; Engineer and Viewer only read it (the owner\'s choice)', () => {
    expect(s.admin!.access.dispatch).toBe('Edit');
    expect(s.manager!.access.dispatch).toBe('Edit');
    expect(s.engineer!.access.dispatch).toBe('View');
    expect(s.viewer!.access.dispatch).toBe('View');
  });
  it('the role defaults of the Users screen match the schema, role by role', () => {
    const fromSchema = (tables as unknown as { tabAccessDefaults: Record<string, Record<string, string>> }).tabAccessDefaults;
    for (const role of Object.keys(fromSchema)) expect(ROLE_DEFAULTS[role]!.dispatch, role).toBe(fromSchema[role]!.dispatch);
  });
  it('the backend knows the tab (Config.js TAB_IDS)', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('backend/apps-script/Config.js', 'utf8')).toMatch(/var TAB_IDS = \[[^\]]*'dispatch'\]/);
  });
});

describe('Dispatch & Packing API (demo mode)', () => {
  it('reads days and settings with View, and nothing without a session', async () => {
    const days = await api.getDispatchDays(s.viewer!.token);
    expect(days).toHaveLength(365);
    expect(await api.getDispatchSettings(s.viewer!.token)).toEqual(emptySettings());
    expect(await code(api.getDispatchDays('nope'))).not.toBe('ok');
  });
  it('uploading needs Edit', async () => {
    expect(await code(api.uploadDispatchDays(s.viewer!.token, [emptyDay('2027-01-01')], 'f.xlsx'))).toBe('forbidden');
    expect(await code(api.saveDispatchSettings(s.engineer!.token, emptySettings()))).toBe('forbidden');
  });
  it('adds new dates and refuses any date that is already stored, replacing nothing', async () => {
    const before = await api.getDispatchDays(s.admin!.token);
    const dup = await api.uploadDispatchDays(s.admin!.token, [emptyDay('2027-01-01'), emptyDay('2025-03-03')], 'f.xlsx').catch((e: ApiError) => e);
    expect(dup).toBeInstanceOf(ApiError);
    expect((dup as ApiError).code).toBe('duplicate_dates');
    expect((dup as ApiError).message).toContain('2025-03-03');
    // nothing at all was added, not even the new date
    expect(await api.getDispatchDays(s.admin!.token)).toEqual(before);
    // the same date twice inside one file is refused too
    expect(await code(api.uploadDispatchDays(s.admin!.token, [emptyDay('2027-01-02'), emptyDay('2027-01-02')], 'f.xlsx'))).toBe('duplicate_dates');
    const ok = await api.uploadDispatchDays(s.admin!.token, [emptyDay('2027-01-02'), emptyDay('2027-01-01')], 'f.xlsx');
    expect(ok).toMatchObject({ days_added: 2, from: '2027-01-01', to: '2027-01-02' });
    const after = await api.getDispatchDays(s.viewer!.token);
    expect(after).toHaveLength(367);
    expect(after.map((d) => d.date)).toEqual([...after.map((d) => d.date)].sort());
    // uploading again is now a duplicate
    expect(await code(api.uploadDispatchDays(s.admin!.token, [emptyDay('2027-01-01')], 'f.xlsx'))).toBe('duplicate_dates');
  });
  it('refuses malformed rows and an empty upload', async () => {
    expect(await code(api.uploadDispatchDays(s.admin!.token, [], 'f.xlsx'))).toBe('bad_request');
    expect(await code(api.uploadDispatchDays(s.admin!.token, [{ ...emptyDay('2028-01-01'), packers: [] }], 'f.xlsx'))).toBe('bad_request');
    expect(await code(api.uploadDispatchDays(s.admin!.token, [emptyDay('not-a-date')], 'f.xlsx'))).toBe('bad_request');
  });
  it('saves targets, checks them, and writes the activity log', async () => {
    const good = { ...emptySettings(), ratedTph: [100, 100, 100, 100, 100, 100], monthlyTargetT: Array(12).fill(300000), availabilityTargetPct: 55, noTrucksMaxPct: 20 };
    expect(await api.saveDispatchSettings(s.manager!.token, good)).toEqual(good);
    expect(await api.getDispatchSettings(s.viewer!.token)).toEqual(good);
    expect(await code(api.saveDispatchSettings(s.admin!.token, { ...good, ratedTph: [1, 2] }))).toBe('bad_request');
    expect(await code(api.saveDispatchSettings(s.admin!.token, { ...good, monthlyTargetT: Array(12).fill(-1) }))).toBe('bad_request');
    expect(await code(api.saveDispatchSettings(s.admin!.token, { ...good, availabilityTargetPct: 120 }))).toBe('bad_request');
    // the returned copy is not the stored one
    const got = await api.getDispatchSettings(s.viewer!.token);
    got.ratedTph[0] = 1;
    expect((await api.getDispatchSettings(s.viewer!.token)).ratedTph[0]).toBe(100);
  });
});
