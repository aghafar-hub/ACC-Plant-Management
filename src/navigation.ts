import type { TabId } from './api/types';
import { t } from './i18n/t';

// The app's pages. Each page id is also its tab id in the access model, so
// "which pages does this person see" is decided by the levels the server
// returns (Hidden pages never appear).
/** A page of the app. Every id is a tab id, except Validate: it is part of the events tab (View to see, Edit to fix). */
export type PageId = TabId | 'validate';

/** The navigation sections: the left rail headings, the page tabs' scope, the More sheet groups. */
// Plant system: Operate (Shift reports, Daily meeting), Downtime analysis (every downtime page, one rail item whose
// pages are the tabs under the top bar), Setup. Production and Quality become sections of their own later.
export type SectionId = 'operate' | 'downtime' | 'setup';
export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'operate', label: 'Operate' },
  { id: 'downtime', label: 'Downtime analysis' },
  { id: 'setup', label: 'Setup' },
];
/** Sections drawn as ONE rail item (their pages are the tabs under the top bar), with its icon. */
export const ONE_ITEM_SECTIONS: Partial<Record<SectionId, string>> = { downtime: 'dashboard' };
export const sectionLabel = (id: SectionId): string => t(SECTIONS.find((s) => s.id === id)!.label);

export interface PageDef {
  id: PageId;
  /** The tab whose View or Edit level decides who sees the page and who may change things on it. */
  access: TabId;
  path: string;
  /** Full name: page header, breadcrumb, left rail. */
  label: string;
  /** Name on the desktop page tabs. */
  tab: string;
  /** Short name for the phone chips and bottom bar. */
  short: string;
  icon: string;
  group: SectionId;
}

export const PAGES: PageDef[] = [
  // The Dashboard keeps the id (and access tab) `overview`; its address is /dashboard (/overview redirects there).
  { id: 'overview', access: 'overview', path: '/dashboard', label: 'Dashboard', tab: 'Dashboard', short: 'Dashboard', icon: 'dashboard', group: 'downtime' },
  { id: 'pareto', access: 'pareto', path: '/pareto', label: 'Pareto', tab: 'Pareto', short: 'Pareto', icon: 'limits', group: 'downtime' },
  { id: 'repeats', access: 'repeats', path: '/repeats', label: 'Repeated failures', tab: 'Repeated failures', short: 'Repeats', icon: 'repeat', group: 'downtime' },
  { id: 'reliability', access: 'reliability', path: '/reliability', label: 'Reliability', tab: 'Reliability', short: 'Reliability', icon: 'trend', group: 'downtime' },
  { id: 'reports', access: 'reports', path: '/reports', label: 'Reports', tab: 'Reports', short: 'Reports', icon: 'registry', group: 'downtime' },
  { id: 'actions', access: 'actions', path: '/actions', label: 'Actions', tab: 'Actions', short: 'Actions', icon: 'target', group: 'downtime' },
  { id: 'events', access: 'events', path: '/events', label: 'Events', tab: 'Events', short: 'Events', icon: 'list', group: 'downtime' },
  { id: 'validate', access: 'events', path: '/validate', label: 'Validate', tab: 'Validate', short: 'Validate', icon: 'compliance', group: 'downtime' },
  { id: 'upload', access: 'upload', path: '/upload', label: 'Upload', tab: 'Upload', short: 'Upload', icon: 'upload', group: 'downtime' },
  { id: 'master', access: 'master', path: '/master', label: 'Master Data', tab: 'Master Data', short: 'Master data', icon: 'database', group: 'setup' },
  // plant system (backend 2.1.0): last in the list, so the start page and the phone bar stay as they were for everyone
  // but the shift roles (see landingPath and bottomBarPages); the rail shows them first, in their Operate section.
  { id: 'shift', access: 'shift', path: '/shift', label: 'Shift reports', tab: 'Shift reports', short: 'Shift', icon: 'clock', group: 'operate' },
  { id: 'daily', access: 'daily', path: '/daily', label: 'Daily meeting', tab: 'Daily meeting', short: 'Daily', icon: 'calendar', group: 'operate' },
];

// Settings and Users are not in the main navigation: they are reached from the
// gear in the top bar. Their tab ids still control who sees which Settings subtab.
const GEAR_TABS: PageDef[] = [
  { id: 'settings', access: 'settings', path: '/settings', label: 'Settings', tab: 'Settings', short: 'Settings', icon: 'settings', group: 'setup' },
  { id: 'users', access: 'users', path: '/settings/users', label: 'Users', tab: 'Users', short: 'Users', icon: 'users', group: 'setup' },
];

export const pageById = (id: PageId): PageDef => PAGES.find((p) => p.id === id) ?? GEAR_TABS.find((p) => p.id === id)!;

/**
 * The Notifications page (the bell's inbox): every signed-in person may open it, so it has no tab id and is not one of
 * PAGES; the rail and the More sheet list it in the Act section after the pages.
 */
export const NOTIFICATIONS_PATH = '/notifications';
export const isNotificationsPath = (pathname: string): boolean => pathname === NOTIFICATIONS_PATH || pathname.startsWith(`${NOTIFICATIONS_PATH}/`);
export const pageForPath = (pathname: string): PageDef | undefined => {
  const path = pathname === '/overview' || pathname.startsWith('/overview/') ? pathname.replace(/^\/overview/, '/dashboard') : pathname;
  return PAGES.find((p) => path === p.path || path.startsWith(`${p.path}/`));
};
export const pageLabel = (p: PageDef): string => t(p.label);
export const pageTab = (p: PageDef): string => t(p.tab);
export const pageShort = (p: PageDef): string => t(p.short);

/** The first four of these that the person may see go on the phone bottom bar, left to right; More is the fifth slot (mobile-actions.png). */
export const BOTTOM_BAR_ORDER: PageId[] = ['overview', 'pareto', 'actions', 'events', 'reliability', 'repeats', 'validate', 'upload', 'shift', 'daily'];
/** The roles whose work starts on Shift reports: their start page and the first slot of their phone bar. */
export const SHIFT_FIRST_ROLES = ['ROLE-SHIFT', 'ROLE-PROD', 'ROLE-REL'];
export const BOTTOM_BAR_SLOTS = 4;
/** The pages on the phone bottom bar (before More), given the pages the person may see. */
export const bottomBarPages = (visible: PageDef[], roleId = ''): PageDef[] => {
  const order = SHIFT_FIRST_ROLES.includes(roleId) ? ['shift' as PageId, ...BOTTOM_BAR_ORDER.filter((id) => id !== 'shift')] : BOTTOM_BAR_ORDER;
  return order.map((id) => visible.find((p) => p.id === id)).filter((p): p is PageDef => !!p).slice(0, BOTTOM_BAR_SLOTS);
};
/** Where '/' leads: Shift reports for the shift roles, otherwise the first page the person may see. */
export const landingPath = (visible: PageDef[], roleId = ''): string | null => {
  if (SHIFT_FIRST_ROLES.includes(roleId) && visible.some((p) => p.id === 'shift')) return '/shift';
  return visible[0]?.path ?? null;
};
/** The visible pages of one section, in navigation order. */
export const pagesInSection = (visible: PageDef[], section: SectionId): PageDef[] => visible.filter((p) => p.group === section);

export const ROLE_LABELS: Record<string, string> = {
  'ROLE-ADMIN': 'Admin',
  'ROLE-MGR': 'Manager',
  'ROLE-ENG': 'Engineer',
  'ROLE-VIEW': 'Viewer',
  'ROLE-SHIFT': 'Shift leader',
  'ROLE-PROD': 'Production manager',
  'ROLE-REL': 'Reliability engineer',
  'ROLE-QC': 'Quality engineer',
};

// The Settings page's subtabs. To add one (for example Validate), add a line here, a
// component in src/admin/settings/ and a case in src/pages/Settings.tsx.
export interface SettingsSub {
  id: string;
  label: string;
  /** Needs View on this tab; null means everyone sees it. */
  tab: TabId | null;
  /** Only the Admin role (ROLE-ADMIN) sees it, whatever the tab access says (backend 1.5.0: Areas; 1.6.0: Active users, Activity log). */
  adminOnly?: boolean;
  icon: string;
  blurb: string;
}

export const SETTINGS_SUBS: SettingsSub[] = [
  { id: 'appearance', label: 'Appearance', tab: null, icon: 'palette', blurb: 'Theme and install. The theme is kept with your account.' },
  { id: 'notifications', label: 'Notifications', tab: null, icon: 'bell', blurb: 'Which alerts you get, the areas you follow and the digest email.' },
  { id: 'calculations', label: 'Calculations', tab: 'settings', icon: 'trend', blurb: 'How availability, repeated failures and durations are worked out.' },
  { id: 'actions', label: 'Actions & targets', tab: 'settings', icon: 'target', blurb: 'Who can close actions, the contractors and their areas, task templates, the draft rules and the targets per area.' },
  { id: 'kpi-targets', label: 'KPI targets', tab: null, icon: 'target', blurb: 'Targets per KPI for the plant, each line and each area, by year and month. The one place targets are kept.' },
  { id: 'quality', label: 'Quality limits', tab: null, icon: 'compliance', blurb: 'The specification and valid range of each laboratory parameter, by area and material.' },
  { id: 'closing', label: 'Month closing', tab: null, icon: 'check', blurb: 'Review and sign off each section month by month. A signed-off month is locked until it is reopened with a reason.' },
  { id: 'areas', label: 'Areas', tab: null, adminOnly: true, icon: 'database', blurb: 'Switch areas on or off for the whole plant. An inactive area and its records are left out everywhere.' },
  { id: 'security', label: 'Security', tab: 'settings', icon: 'shield', blurb: 'Sign-in limits, sessions and passwords.' },
  { id: 'users', label: 'Users and access', tab: 'users', icon: 'users', blurb: 'Who can sign in and which pages they can open.' },
  { id: 'active-users', label: 'Active users', tab: null, adminOnly: true, icon: 'clock', blurb: 'Who is using the app now, who was here today and when each person was last seen.' },
  { id: 'activity-log', label: 'Activity log', tab: null, adminOnly: true, icon: 'history', blurb: 'Every change made in the app: who did what, and when. Newest first.' },
];

export const settingsSubById = (id: string | undefined): SettingsSub | undefined => SETTINGS_SUBS.find((s) => s.id === id);
export const settingsSubLabel = (s: SettingsSub): string => t(s.label);
/** The subtab named by a path such as /settings/security (undefined for /settings). */
export const settingsSubFromPath = (pathname: string): SettingsSub | undefined => settingsSubById(/^\/settings\/([^/]+)/.exec(pathname)?.[1]);
export const isSettingsPath = (pathname: string): boolean => pathname === '/settings' || pathname.startsWith('/settings/');
