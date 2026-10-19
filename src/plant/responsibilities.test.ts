import { describe, expect, it } from 'vitest';
import { createMockApi } from '../api/mockApi';
import { DEMO_PASSWORD } from '../mock/demoAccounts';
import { cleanResponsibility, coverage, sectionCoverage, validateSet, type Responsibility } from './responsibilities';

const lines = new Set(['L.1', 'L.2']);
const areas = new Set(['K.1', 'K.2', 'CM.1']);
const row = (p: Partial<Responsibility>): Responsibility => ({
  resp_id: 'RS-1', user_id: 'U-1', duty: 'shift_entry', section: '', scope_type: 'plant', scope_id: '', is_backup: false,
  valid_from: '', valid_to: '', updated_by: '', updated_at: '', ...p,
});

describe('responsibility checks (same as the server)', () => {
  it('needs a section only for the month duties, and known lines and areas', () => {
    expect(cleanResponsibility({ duty: 'month_review', scope_type: 'plant' }, lines, areas)).toMatchObject({ error: expect.stringMatching(/Choose the section/) });
    expect(cleanResponsibility({ duty: 'shift_entry', section: 'quality', scope_type: 'plant' }, lines, areas)).toMatchObject({ error: expect.stringMatching(/Only month review/) });
    expect(cleanResponsibility({ duty: 'shift_entry', scope_type: 'area', scope_id: 'XX' }, lines, areas)).toMatchObject({ error: expect.stringMatching(/no area XX/) });
    expect(cleanResponsibility({ duty: 'targets', scope_type: 'plant', valid_from: '2026-11-01', valid_to: '2026-10-01' }, lines, areas)).toMatchObject({ error: expect.stringMatching(/before/) });
    expect(cleanResponsibility({ duty: 'targets', scope_type: 'plant', scope_id: 'x' }, lines, areas)).toEqual({ row: { duty: 'targets', section: '', scope_type: 'plant', scope_id: '', is_backup: false, valid_from: '', valid_to: '' } });
    expect(validateSet([{ duty: 'targets', scope_type: 'plant' }, { duty: 'targets', scope_type: 'plant' }], lines, areas)).toMatch(/twice/);
    expect(validateSet([{ duty: 'targets', scope_type: 'plant' }, { duty: 'targets', scope_type: 'plant', is_backup: true }], lines, areas)).toBeNull();
  });
});

describe('coverage', () => {
  const users = [{ user_id: 'U-1', active: true }, { user_id: 'U-2', active: true }, { user_id: 'U-3', active: false }];
  const plantAreas = [{ area_id: 'K.1', line_id: 'L.1' }, { area_id: 'K.2', line_id: 'L.2' }];
  it('counts plant, line and area scopes, main and backup, dates and active people only', () => {
    const rows = [
      row({ user_id: 'U-1', scope_type: 'line', scope_id: 'L.1' }),
      row({ user_id: 'U-2', scope_type: 'plant', is_backup: true }),
      row({ user_id: 'U-3', scope_type: 'area', scope_id: 'K.2' }),
      row({ user_id: 'U-2', scope_type: 'area', scope_id: 'K.2', valid_to: '2026-09-30' }),
    ];
    const g = coverage(rows, users, plantAreas, '2026-10-19');
    expect(g.get('K.1|shift_entry')).toEqual({ main: ['U-1'], backup: ['U-2'] });
    expect(g.get('K.2|shift_entry')).toEqual({ main: [], backup: ['U-2'] });
    expect(g.get('K.1|production_review')).toEqual({ main: [], backup: [] });
  });
  it('lists the month closing by section', () => {
    const s = sectionCoverage([row({ duty: 'month_signoff', section: 'quality' })], users, '2026-10-19');
    expect(s.get('quality|month_signoff')).toEqual({ main: ['U-1'], backup: [] });
    expect(s.get('downtime|month_signoff')).toEqual({ main: [], backup: [] });
  });
});

describe('mock api: responsibilities', () => {
  it('saves, replaces and lists a person\'s set, and refuses viewers', async () => {
    const a = createMockApi({ seed: 1 });
    const admin = await a.login('admin@demo.test', DEMO_PASSWORD, false);
    const users = await a.listUsers(admin.token);
    const eng = users.find((u) => u.role_id === 'ROLE-ENG')!;
    let out = await a.saveResponsibilities(admin.token, eng.user_id, [{ duty: 'shift_entry', scope_type: 'area', scope_id: 'K.1' }, { duty: 'month_review', section: 'downtime', scope_type: 'plant' }]);
    expect(out).toHaveLength(2);
    out = await a.saveResponsibilities(admin.token, eng.user_id, [{ duty: 'shift_entry', scope_type: 'area', scope_id: 'K.1' }]);
    expect(out).toHaveLength(1);
    expect(await a.listResponsibilities(admin.token)).toHaveLength(1);
    await expect(a.saveResponsibilities(admin.token, eng.user_id, [{ duty: 'month_review', scope_type: 'plant' }])).rejects.toMatchObject({ code: 'bad_request' });
    const viewer = await a.login('viewer@demo.test', DEMO_PASSWORD, false);
    await expect(a.listResponsibilities(viewer.token)).rejects.toMatchObject({ code: 'forbidden' });
  });
});
