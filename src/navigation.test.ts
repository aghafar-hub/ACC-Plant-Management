import { describe, expect, it } from 'vitest';
import { TAB_IDS } from './api/types';
import { ICON_NAMES } from './icons';
import { BOTTOM_BAR_ORDER, bottomBarPages, landingPath, pageById, pageForPath, pagesInSection, PAGES, SECTIONS, type PageId } from './navigation';

const only = (ids: PageId[]) => PAGES.filter((p) => ids.includes(p.id));
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

describe('navigation sections', () => {
  it('groups every page into Analyze, Reports, Act, Data or Setup in the agreed order', () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(['Operate', 'Downtime analysis', 'Dispatch & Packing', 'Setup']);
    expect(ids(pagesInSection(PAGES, 'operate'))).toEqual(['shift', 'daily']);
    expect(ids(pagesInSection(PAGES, 'downtime'))).toEqual(['overview', 'pareto', 'repeats', 'reliability', 'reports', 'actions', 'events', 'validate', 'upload']);
    expect(ids(pagesInSection(PAGES, 'dispatch'))).toEqual(['dispatch', 'dispatch-analysis', 'dispatch-packers', 'dispatch-bags', 'dispatch-validate', 'dispatch-data']);
    expect(ids(pagesInSection(PAGES, 'setup'))).toEqual(['master']);
    expect(pageById('pareto')).toMatchObject({ label: 'Pareto', tab: 'Pareto', short: 'Pareto' });
  });
  it('Reports is one page of its own section: path, access tab, labels and icon', () => {
    const p = pageById('reports');
    expect(p).toMatchObject({ path: '/reports', access: 'reports', label: 'Reports', tab: 'Reports', short: 'Reports', group: 'downtime' });
    expect(pageForPath('/reports')?.id).toBe('reports');
    expect(pageForPath('/reports/anything')?.id).toBe('reports');
    expect(ICON_NAMES).toContain(p.icon);
    // it is a tab of Downtime analysis, and it is not on the phone bottom bar
    expect(BOTTOM_BAR_ORDER).not.toContain('reports');
    expect(ids(bottomBarPages(PAGES))).not.toContain('reports');
  });
  it('every tab id has a page, so the Users screen can label it', () => {
    for (const tab of TAB_IDS) expect(() => pageById(tab)).not.toThrow();
    expect(pageById('reports').label).toBe('Reports');
  });
  it('the phone bar is Dashboard, Pareto, Actions, Events; the shift roles get Shift reports first (plant system)', () => {
    expect(ids(bottomBarPages(PAGES))).toEqual(['overview', 'pareto', 'actions', 'events']);
    expect(ids(bottomBarPages(PAGES, 'ROLE-SHIFT'))).toEqual(['shift', 'overview', 'pareto', 'actions']);
    expect(landingPath(PAGES, 'ROLE-ADMIN')).toBe('/dashboard');
    expect(landingPath(PAGES, 'ROLE-PROD')).toBe('/shift');
    expect(landingPath(only(['daily']), 'ROLE-PROD')).toBe('/daily');
  });
  it('takes the next visible page when one of the four is hidden', () => {
    expect(ids(bottomBarPages(only(['overview', 'events', 'reliability', 'repeats', 'upload'])))).toEqual(['overview', 'events', 'reliability', 'repeats']);
    expect(ids(bottomBarPages(only(['overview', 'validate', 'upload'])))).toEqual(['overview', 'validate', 'upload']);
    expect(ids(bottomBarPages(only(['pareto', 'repeats', 'upload', 'validate', 'master'])))).toEqual(['pareto', 'repeats', 'validate', 'upload']);
  });
  it('Actions is a page of its own Act section; the Notifications inbox has no tab id', () => {
    expect(pageById('actions')).toMatchObject({ path: '/actions', access: 'actions', group: 'downtime' });
    expect(pageForPath('/actions')?.id).toBe('actions');
    expect(pageForPath('/notifications')).toBeUndefined();
    expect(ICON_NAMES).toContain(pageById('actions').icon);
  });
  it('Dispatch & Packing is its own section behind ONE access tab; it does not change the start page or the phone bar', () => {
    for (const p of pagesInSection(PAGES, 'dispatch')) {
      expect(p.access).toBe('dispatch');
      expect(p.path.startsWith('/dispatch/')).toBe(true);
      expect(ICON_NAMES).toContain(p.icon);
      expect(pageForPath(p.path)?.id).toBe(p.id);
    }
    expect(pageById('dispatch')).toMatchObject({ path: '/dispatch/dashboard', label: 'Dispatch & Packing', tab: 'Dashboard' });
    expect(pageForPath('/dispatch')).toBeUndefined();
    expect(landingPath(PAGES, 'ROLE-ADMIN')).toBe('/dashboard');
    expect(ids(bottomBarPages(PAGES))).toEqual(['overview', 'pareto', 'actions', 'events']);
    // no downtime page is in the section, and no dispatch page is a downtime tab
    expect(pagesInSection(PAGES, 'downtime').some((p) => p.access === 'dispatch')).toBe(false);
  });
});
