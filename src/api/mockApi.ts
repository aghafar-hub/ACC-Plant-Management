// In-memory implementation of the whole Api interface. It behaves like the
// server (docs/wire-protocol.md): same access rules per action, same
// normalisation, edit and void semantics, user administration and temporary
// passwords. Data lives in memory only: a page reload starts again.
import type {
  Access, AccessLevel, ActiveUser, AdminUser, Api, Area, AuditEntry, AuditGroup, DeviceKind, ClassificationCode, Equipment, EquipmentAlias, EventChanges,
  EventRow, NewTask, Notification, NotificationCheckResult, NotificationPrefs, NotificationState, Reason, Session, SessionUser, TaskStatus,
  TabId, UploadBatch, UploadRow, DispatchApi,
} from './types';
import {
  cleanSavedReports, notificationCandidates, oneLine, parseNotifSettings, uploadDoneCandidate, userEventCandidate, type Candidate,
} from './mockNotifications';
import { buildIndex, canonicalFlags, deriveEventFields, findArea, isKnownFlag, pruneAcceptedFlags, splitFlags, DERIVED_FLAGS, type MasterIndex } from '../calc';
import { ApiError, AUDIT_GROUPS, NOTIFICATION_CATEGORY_OF, NOTIFICATION_TYPES, TAB_IDS } from './types';
import { AUDIT_GROUP_ACTIONS, auditGroupOf } from './auditGroups';
import { createActionStore } from './mockActions';
import { buildSyntheticDb, fmtTs, type MockUser, type SyntheticDb } from '../mock/synthetic';
import { codeKey, eventIdOf, fingerprintOf, isValidDate, matchKey, parseTs } from '../util/normalize';
import { THEME_NAMES } from '../theme/themes';
import { store } from '../storagePrefix';
import { respKey, validateSet, type Responsibility } from '../plant/responsibilities';
import { cleanTargetSave, type KpiDefinition, type KpiTarget } from '../plant/kpiTargets';
import { changedLimitFields, limitProblem, type QualityParameter } from '../plant/quality';
import { CLOSING_REASON_MIN, CLOSING_SECTION_TEXT, CLOSING_SECTIONS, closingOf, lockedMonthOf, lockedMonths, lockedText, monthKey, type MonthClosing } from '../plant/closing';
import schemaTables from '../../schema/tables.json';
import { emptySettings, N_PACKERS, type DispatchDay, type DispatchSettings } from '../dispatch/model';
import { syntheticDispatchDays } from '../dispatch/synthetic';
import {
  DEFAULT_SHIFTS, SHIFT_STOP_FIELDS, blockingFlags, reportIdOf, shiftWindow,
  type ShiftHistory, type ShiftReport, type ShiftStage, type ShiftStoppage, type ShiftStopField,
} from '../plant/shift';

const LEVEL_RANK: Record<AccessLevel, number> = { Hidden: 0, View: 1, Edit: 2 };
const CLASS_CODES: ClassificationCode[] = ['PRO', 'MEC', 'ELE', 'AUT', 'PL', 'CIR'];
const TEXT_MAX = 1000;
/** the server's EMAIL_PATTERN_ (backend/apps-script/Users.js) */
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCEPT_NOTE_MIN = 3;
const PRUNE_NOTE = 'Removed automatically: the record no longer has this problem.';
const SAVED_VIEW_PAGES = ['overview', 'pareto', 'repeats', 'reliability', 'events'];
const FINGERPRINT_HINT_MAX = 20;
const EDITABLE: string[] = [
  'event_date', 'line_id', 'area_id', 'code_raw', 'stop_ts', 'start_ts', 'freq', 'classification', 'criticality', 'is_failure', 'reason_raw', 'description',
];
const DASHBOARD_TABS: TabId[] = ['overview', 'pareto', 'repeats', 'reliability', 'reports', 'events'];

const BAD_LOGIN = 'Email or password is not correct.';

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

function randomTempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

/** Same rules as cleanSavedViews_ in backend/apps-script/Notifications.js. */
function cleanSavedViews(text: string): string {
  const bad = (m: string) => new ApiError(m, 'bad_request');
  if (text === '') return '';
  if (text.length > 20000) throw bad('Saved views are too long.');
  let list: unknown;
  try { list = JSON.parse(text); } catch { throw bad('Saved views are not readable.'); }
  if (!Array.isArray(list)) throw bad('Saved views must be a list.');
  if (list.length > 20) throw bad('You can save at most 20 views.');
  const seen = new Set<string>();
  for (const v of list) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw bad('Each saved view must be an object.');
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) if (!['id', 'name', 'page', 'query'].includes(k)) throw bad(`A saved view has an unknown field: ${oneLine(k, 40)}.`);
    if (typeof o.id !== 'string' || !o.id || o.id.length > 40) throw bad('A saved view needs an id of 1 to 40 characters.');
    if (typeof o.name !== 'string' || !o.name.trim() || o.name.length > 60) throw bad('A saved view needs a name of 1 to 60 characters.');
    if (typeof o.page !== 'string' || !SAVED_VIEW_PAGES.includes(o.page)) throw bad(`A saved view page must be one of: ${SAVED_VIEW_PAGES.join(', ')}.`);
    if (typeof o.query !== 'string' || o.query.length > 1500) throw bad('A saved view query must be text of at most 1500 characters.');
    if (seen.has(o.id)) throw bad('Two saved views have the same id.');
    seen.add(o.id);
  }
  return text;
}

// demo mode only: the saved theme of each demo account, kept in this browser (see createMockApi)
const KEPT_THEMES_KEY = 'mock_account_themes';
function readKeptThemes(): Record<string, string> {
  try {
    const v = JSON.parse(store.get(KEPT_THEMES_KEY) ?? '{}') as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && THEME_NAMES.includes(e[1])));
  } catch {
    return {};
  }
}
function writeKeptTheme(userId: string, theme: string): void {
  const all = readKeptThemes();
  if (theme) all[userId] = theme; else delete all[userId];
  store.set(KEPT_THEMES_KEY, JSON.stringify(all));
}

export interface MockApi extends Api, DispatchApi {
  /** Test helpers: the live data and a clock override. Not part of Api. */
  __db(): SyntheticDb;
  /** The emails 'sent' by sendReport / sendTestEmail (backend 1.9.0), newest last. */
  __sentMail(): SentMockMail[];
  __setNow(fn: () => number): void;
}

export interface SentMockMail { from: string; to: string[]; cc: string[]; subject: string; html: string; attachments: { name: string; mimeType: string; bytes: number; base64: string }[]; by: string }

/**
 * `demoActions` (the app's demo mode) fills the Actions page on first use: area targets, auto drafts moved along the board,
 * a manual action and comments. Tests leave it off so their scenarios start from an empty action list, like the server.
 */
/**
 * `keepAccountThemes` (the app's demo mode) keeps each demo account's saved theme in this browser's storage, so it
 * outlives a reload and a fresh sign-in like on a real server (everything else in the mock starts again on a reload).
 */
/** The backend version the demo behaves like. */
export const MOCK_SERVER_VERSION = '2.4.0';

export function createMockApi(opts: { seed?: number; demoActions?: boolean; keepAccountThemes?: boolean } = {}): MockApi {
  let db: SyntheticDb | null = null;
  let now: () => number = () => Date.now();
  let counter = 0;

  const get = (): SyntheticDb => {
    if (!db) {
      db = buildSyntheticDb(opts.seed);
      seedHistory(db);
      if (opts.demoActions) seedDemoActivity(db);
      if (opts.keepAccountThemes) {
        for (const [user_id, value] of Object.entries(readKeptThemes())) notifPrefs.push({ user_id, key: 'theme', value, updated_at: '' });
      }
    }
    return db;
  };

  const p2 = (n: number, l = 2) => String(n).padStart(l, '0');
  const tsOf = (ms: number): string => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p2(d.getMilliseconds(), 3)}`;
  };
  const nowTs = (): string => tsOf(now());
  const setting = (key: string): string => get().settings.find((s) => s.key === key)?.value ?? '';
  const numSetting = (key: string, fallback: number): number => {
    const n = Number(setting(key));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const audit = (userId: string | undefined, action: string, entity: string, entityId: string, detail: string) => {
    get().audit_log.push({ at: nowTs(), user_id: userId, action, entity, entity_id: entityId, detail: String(detail ?? '').slice(0, 500) });
  };
  /** Same as auditValue_ / auditChanges_ in backend/apps-script/Audit.js: 'field: old -> new; ...' of the fields that changed. */
  const auditValue = (v: unknown, max = 60): string => {
    if (v === true) return 'yes';
    if (v === false) return 'no';
    const t = v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim();
    if (!t) return '(blank)';
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  };
  const auditChanges = (before: object | null | undefined, after: object, fields: string[], max = 60): string => {
    const b = (before ?? {}) as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    return fields
      .filter((f) => a[f] !== undefined && auditValue(b[f], 500) !== auditValue(a[f], 500))
      .map((f) => `${f}: ${auditValue(b[f], max)} -> ${auditValue(a[f], max)}`)
      .join('; ');
  };

  // ------------------------------------------------------------ access
  function roleLevel(roleId: string, tab: TabId): AccessLevel {
    const row = get().tab_access.find((r) => r.subject_type === 'role' && r.subject_id === roleId && r.tab_id === tab);
    return (row?.level as AccessLevel) ?? 'Hidden';
  }
  function accessFor(u: MockUser): Access {
    const out = {} as Access;
    for (const t of TAB_IDS) out[t] = u.overrides[t] ?? roleLevel(u.role_id, t);
    return out;
  }
  const sessionUser = (u: MockUser): SessionUser => ({ user_id: u.user_id, email: u.email, display_name: u.display_name, role_id: u.role_id });
  const adminUser = (u: MockUser): AdminUser => ({
    ...sessionUser(u), active: u.active, must_change: u.must_change, last_login_at: u.last_login_at,
    overrides: Object.keys(u.overrides).length ? { ...u.overrides } : undefined,
  });

  /** Short fingerprint of the current password: changing or resetting it ends every open session (as on the real server). */
  function pwVersion(u: MockUser): string {
    let h = 5381;
    for (let i = 0; i < u.password.length; i++) h = ((h * 33) ^ u.password.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function makeSession(u: MockUser, lifetimeMs: number): Session {
    const iat = now();
    const exp = iat + lifetimeMs;
    const payload = b64urlEncode(JSON.stringify({ uid: u.user_id, role: u.role_id, iat, exp, pv: pwVersion(u) }));
    return {
      token: `${payload}.mock`, expires_at: new Date(exp).toISOString(), user: sessionUser(u),
      must_change: u.must_change, access: accessFor(u), theme: accountTheme(u.user_id), server_version: MOCK_SERVER_VERSION,
    };
  }
  // backend 1.10.0: 'sign out of all devices' refuses tokens issued before this moment (per user)
  const signedOutAt = new Map<string, number>();
  /** 1.10.0: only an Admin manages Admins. */
  function requireAdminFor(caller: MockUser, isAdminTarget: boolean, what: string) {
    if (isAdminTarget && caller.role_id !== 'ROLE-ADMIN') throw new ApiError(`Only an Admin can ${what}.`, 'forbidden');
  }

  function auth(token: string, allowMustChange = false): { user: MockUser; access: Access; iat: number; exp: number } {
    const fail = () => new ApiError('Your session has ended. Please sign in again.', 'unauthenticated');
    if (!token) throw fail();
    const [payloadB64, sig] = String(token).split('.');
    if (!payloadB64 || sig !== 'mock') throw fail();
    let payload: { uid?: string; iat?: number; exp?: number; pv?: string };
    try { payload = JSON.parse(b64urlDecode(payloadB64)); } catch { throw fail(); }
    if (!payload.exp || payload.exp <= now()) throw fail();
    const user = get().users.find((u) => u.user_id === payload.uid);
    if (!user || !user.active) throw fail();
    if (payload.pv !== pwVersion(user)) throw new ApiError('Your password changed. Please sign in again.', 'unauthenticated');
    if ((payload.iat ?? 0) < (signedOutAt.get(user.user_id) ?? 0)) throw new ApiError('You were signed out on all devices. Please sign in again.', 'unauthenticated');
    noteActivity(user.user_id); // like the server: every signed-in call counts as activity
    if (user.must_change && !allowMustChange) {
      throw new ApiError('You must set a new password before you continue.', 'forbidden', true);
    }
    return { user, access: accessFor(user), iat: payload.iat ?? 0, exp: payload.exp };
  }

  // backend 1.9.0: the emails the mock 'sends' (never leave the browser) and the per-person daily count
  const sentMail: SentMockMail[] = [];
  const mailCount = new Map<string, { day: string; n: number }>();
  function mailFrom(): { from: string; via: 'gmail' | 'mailapp' } {
    const val = (k: string) => get().settings.find((s) => s.key === k)?.value ?? '';
    const email = val('system_email');
    const name = val('system_email_name') || 'ACC Downtime Analysis';
    return email ? { from: `"${name}" <${email}>`, via: 'gmail' } : { from: `${name} (the Google account that runs the app)`, via: 'mailapp' };
  }

  function needAdmin(token: string): { user: MockUser; access: Access } {
    const a = auth(token);
    if (a.user.role_id !== 'ROLE-ADMIN') throw new ApiError('You do not have access to do this.', 'forbidden', true);
    return a;
  }

  // ------------------------------------------------------------ who is online (backend/apps-script/Activity.js)
  const ACTIVITY_ONLINE_MS = 5 * 60_000;
  const activity = new Map<string, { s: number; p: string; d: DeviceKind | '' }>();
  /** Demo mode only: people "seen" a fixed time before now, so the Active users page always has someone online. */
  const demoSeen = new Map<string, { ago: number; p: string; d: DeviceKind }>();
  function noteActivity(userId: string, hint?: unknown): void {
    const cur = activity.get(userId) ?? { s: 0, p: '', d: '' as DeviceKind | '' };
    if (hint && typeof hint === 'object' && !Array.isArray(hint)) {
      const h = hint as Record<string, unknown>;
      if (typeof h.page === 'string' && /^\/[A-Za-z0-9/_.-]{0,79}$/.test(h.page)) cur.p = h.page;
      if (h.device === 'phone' || h.device === 'desktop') cur.d = h.device;
    }
    cur.s = now();
    activity.set(userId, cur);
  }

  /** Demo mode only: a varied activity log of the last two weeks and a few people online. */
  function seedDemoActivity(d: SyntheticDb): void {
    const MIN = 60_000, H = 60 * MIN, DAY = 24 * H;
    demoSeen.set('U-DEMO-MGR', { ago: 1 * MIN, p: '/pareto', d: 'phone' });
    demoSeen.set('U-DEMO-ENG', { ago: 3 * MIN, p: '/validate', d: 'desktop' });
    demoSeen.set('U-DEMO-VIEW', { ago: 2 * H + 10 * MIN, p: '/dashboard', d: 'phone' });
    const evs = d.events.filter((e) => !e.is_void && e.event_date >= '2026-06-01').slice(0, 400);
    const ev = (i: number) => evs[(i * 37) % Math.max(1, evs.length)]?.event_id ?? 'EV-0000000000000000';
    const eq = d.equipment.slice(0, 20);
    const code = (i: number) => eq[i % Math.max(1, eq.length)]?.equipment_id ?? '100.AA01';
    const A = 'U-DEMO-ADMIN', M = 'U-DEMO-MGR', E = 'U-DEMO-ENG', V = 'U-DEMO-VIEW';
    const rows: [number, string, string, string, string, string][] = [
      [13 * DAY + 2 * H, A, 'login', 'users', A, 'Signed in'],
      [13 * DAY + 2 * H - 5 * MIN, A, 'create_user', 'users', 'U-DEMO-VIEW', 'viewer@demo.test as ROLE-VIEW'],
      [13 * DAY + 2 * H - 9 * MIN, A, 'set_tab_access', 'users', 'U-DEMO-ENG', 'upload: role default -> Edit'],
      [12 * DAY + 5 * H, E, 'login', 'users', E, 'Signed in'],
      [12 * DAY + 5 * H - 2 * MIN, E, 'upload_start', 'upload_batches', 'B-20261002-073000-1a2b', 'July_2026.xlsx'],
      [12 * DAY + 5 * H - 3 * MIN, E, 'upload_chunk', 'upload_batches', 'B-20261002-073000-1a2b', 'Added 1000, identical 0, rejected 0'],
      [12 * DAY + 5 * H - 4 * MIN, E, 'upload_chunk', 'upload_batches', 'B-20261002-073000-1a2b', 'Added 1000, identical 0, rejected 0'],
      [12 * DAY + 5 * H - 5 * MIN, E, 'upload_chunk', 'upload_batches', 'B-20261002-073000-1a2b', 'Added 594, identical 12, rejected 0'],
      [12 * DAY + 5 * H - 6 * MIN, E, 'upload_finish', 'upload_batches', 'B-20261002-073000-1a2b', 'File July_2026.xlsx. Read 2606, added 2594, identical 12, skipped 0, warnings 31. Decisions: late_month added 18, changed_row kept_stored 4'],
      [12 * DAY + 5 * H - 6 * MIN - 2000, 'system', 'notification_check', 'notifications', '', 'Created 6, resolved 1, expired 0'],
      [11 * DAY + 3 * H, V, 'login_failed', 'users', V, 'Wrong password (1 of 5)'],
      [11 * DAY + 3 * H - 1 * MIN, V, 'login', 'users', V, 'Signed in'],
      [10 * DAY + 6 * H, M, 'login', 'users', M, 'Signed in'],
      [10 * DAY + 6 * H - 4 * MIN, M, 'save_setting', 'settings', 'availability_target_pct', '85 -> 88'],
      [10 * DAY + 6 * H - 5 * MIN, M, 'save_setting', 'settings', 'repeat_window_days', '30 -> 45'],
      [10 * DAY + 6 * H - 9 * MIN, M, 'save_area_targets', 'area_targets', '2026', 'K.1 availability_target_pct: 90 -> 92; planned_allowance_h_year: 240 -> 300'],
      [9 * DAY + 4 * H, E, 'edit_event', 'events', ev(1), 'reason_raw: Belt torn -> Belt torn at tail pulley. Note: Reason completed from the shift report'],
      [9 * DAY + 4 * H - 3 * MIN, E, 'edit_event', 'events', ev(2), 'classification: ELE -> MEC; criticality: NO_INC -> INC. Note: Wrong classification at source'],
      [9 * DAY + 4 * H - 7 * MIN, E, 'void_event', 'events', ev(3), 'Note: Duplicate of another record'],
      [9 * DAY + 4 * H - 9 * MIN, E, 'accept_event_flags', 'events', ev(4), 'Kept as entered: unlisted_reason. Note: New reason, to be added to the list'],
      [8 * DAY + 2 * H, E, 'update_equipment', 'equipment', code(1), 'description: (blank) -> Kiln main drive; criticality: (blank) -> High'],
      [8 * DAY + 2 * H - 2 * MIN, E, 'add_alias', 'equipment_aliases', `${code(2)}X`, `Points to ${code(2)}. Reason: typo in the sheet`],
      [8 * DAY + 2 * H - 4 * MIN, E, 'add_reason', 'reasons', 'R-MEC-031', 'MEC: Gearbox oil leak'],
      [8 * DAY + 2 * H - 6 * MIN, E, 'revalidate_events', 'events', '2026', 'Checked 2594, changed 37'],
      [7 * DAY + 1 * H, A, 'deactivate_area', 'areas', 'AFR', 'Area switched off: AFR on L.1'],
      [7 * DAY + 1 * H - 30 * MIN, A, 'activate_area', 'areas', 'AFR', 'Area switched on: AFR on L.1'],
      [6 * DAY + 5 * H, M, 'create_action', 'actions', 'ACT-2026-101', 'Open: Replace the kiln tail seal'],
      [6 * DAY + 5 * H - 5 * MIN, M, 'update_action', 'actions', 'ACT-2026-101', 'edit: assignee: (blank) -> Shift engineer; due_date: (blank) -> 2026-10-20'],
      [6 * DAY + 5 * H - 8 * MIN, E, 'comment_action', 'actions', 'ACT-2026-101', 'Seal ordered, delivery on Thursday'],
      [5 * DAY + 3 * H, A, 'update_user', 'users', 'U-DEMO-ENG', 'role_id: ROLE-VIEW -> ROLE-ENG'],
      [5 * DAY + 3 * H - 2 * MIN, A, 'reset_password', 'users', 'U-DEMO-VIEW', 'Temporary password issued'],
      [4 * DAY + 2 * H, M, 'save_contractors', 'contractors', 'RHI', 'RHI areas: CR, RM.1 -> CR, RM.1, RM.2'],
      [3 * DAY + 6 * H, M, 'update_action', 'actions', 'ACT-2026-101', 'status: In progress -> Closed (Seal replaced and tested)'],
      [3 * DAY + 6 * H - 1 * MIN, M, 'action_check', 'actions', '', 'Created 2, merged 1, effectiveness 0'],
      [2 * DAY + 2 * H, A, 'notification_check', 'notifications', '', 'Created 3, resolved 2, expired 1'],
      [2 * DAY + 1 * H, V, 'logout', 'users', V, 'Signed out'],
      [1 * DAY + 4 * H, E, 'login', 'users', E, 'Signed in'],
      [1 * DAY + 4 * H - 3 * MIN, E, 'edit_event', 'events', ev(5), 'start_ts: 2026-09-12 10:15:00.000 -> 2026-09-12 10:30:00.000. Note: Restart time from the control-room log'],
      [1 * DAY + 4 * H - 6 * MIN, E, 'unvoid_event', 'events', ev(3), 'Note: The stop did happen'],
      [5 * H, M, 'login', 'users', M, 'Signed in'],
      [4 * H, M, 'save_setting', 'settings', 'target_mttr_h', '(none) -> 4'],
      [2 * H + 15 * MIN, V, 'login', 'users', V, 'Signed in'],
      [50 * MIN, E, 'login', 'users', E, 'Signed in'],
      [20 * MIN, M, 'login', 'users', M, 'Signed in'],
    ];
    // the weeks before: everyone signs in on working days (so the log has more than one page)
    for (let day = 15; day <= 45; day++) {
      [A, M, E, V].forEach((u, k) => {
        if ((day + k) % 7 === 5) return;
        rows.push([day * DAY + (8 - k) * H, u, 'login', 'users', u, 'Signed in']);
        if (k === 3 && day % 4 === 0) rows.push([day * DAY + (8 - k) * H - 40 * MIN, u, 'logout', 'users', u, 'Signed out']);
      });
      if (day % 6 === 0) rows.push([day * DAY + 5 * H, E, 'edit_event', 'events', ev(day), `description: (blank) -> Checked on site. Note: Completed after the walk-round`]);
    }
    const base = now();
    rows.sort((x, y) => y[0] - x[0]).forEach(([ago, user_id, action, entity, entity_id, detail]) => {
      d.audit_log.push({ at: tsOf(base - ago), user_id, action, entity, entity_id, detail });
    });
  }

  function need(token: string, tabs: TabId[], level: 'View' | 'Edit'): { user: MockUser; access: Access } {
    const a = auth(token);
    const ok = tabs.some((t) => LEVEL_RANK[a.access[t]] >= LEVEL_RANK[level]);
    if (!ok) throw new ApiError('You do not have access to this.', 'forbidden', true);
    return a;
  }

  const clone = <T,>(x: T): T => structuredClone(x);
  const lookup = (): MasterIndex => buildIndex({ equipment: get().equipment, equipment_areas: get().equipment_areas, aliases: get().aliases, reasons: get().reasons, areas: get().areas });

  // ------------------------------------------------------------ validation shared by upload and edit (mirrors Events.js)
  interface Rec {
    event_date: string; line_id: string; area_id: string; code_raw: string; stop_ts: string; start_ts: string; freq: 0 | 1;
    classification: string; criticality: 'INC' | 'NO_INC'; is_failure: boolean; reason_raw: string; description: string;
    equipment_id?: string; is_area_level: boolean; duration_s: number; reason_id?: string; flags: string; code_key: string;
  }
  /** Only what cannot be stored at all is refused; everything else is stored as given and flagged. */
  function normalizeRecord(f: unknown, index: MasterIndex): { error: string } | { rec: Rec } {
    if (!f || typeof f !== 'object') return { error: 'Row is not readable.' };
    const x = f as Record<string, unknown>;
    if (!isValidDate(String(x.event_date ?? '')) || typeof x.event_date !== 'string') return { error: 'Unreadable date.' };
    const stopMs = typeof x.stop_ts === 'string' ? parseTs(x.stop_ts) : null;
    const startMs = typeof x.start_ts === 'string' ? parseTs(x.start_ts) : null;
    if (stopMs === null) return { error: 'Unreadable stop time.' };
    if (startMs === null) return { error: 'Unreadable start time.' };
    const freq = x.freq === 0 || x.freq === 1 ? x.freq : x.freq === '0' ? 0 : x.freq === '1' ? 1 : null;
    if (freq === null) return { error: 'Freq must be 0 or 1.' };
    if (x.criticality !== 'INC' && x.criticality !== 'NO_INC') return { error: 'Criticality must be INC or NO_INC.' };
    if (typeof x.is_failure !== 'boolean') return { error: 'Failure must be true or false.' };
    const code = x.code_raw === null || x.code_raw === undefined ? '' : x.code_raw;
    if (typeof code !== 'string' || code.length > 200) return { error: 'Equipment code is not readable.' };
    const texts: Record<string, string> = {};
    for (const [k, label, max] of [['area_id', 'Area', 40], ['line_id', 'Line', 20], ['classification', 'Classification', 20]] as const) {
      const v = x[k] === null || x[k] === undefined ? '' : x[k];
      if (typeof v !== 'string' || v.length > max) return { error: `${label} is not readable.` };
      texts[k] = v.trim();
    }
    const optional = (v: unknown, label: string): string | { error: string } => {
      if (v === null || v === undefined) return '';
      if (typeof v !== 'string') return { error: `${label} must be text.` };
      if (v.length > TEXT_MAX) return { error: `${label} is too long.` };
      return v.trim();
    };
    const reason = optional(x.reason_raw, 'Reason');
    const description = optional(x.description, 'Description');
    if (typeof reason === 'object') return reason;
    if (typeof description === 'object') return description;
    const stop = fmtTs(stopMs);
    const start = fmtTs(startMs);
    const area = findArea(index, texts.area_id);
    const cls = texts.classification.toUpperCase();
    const row = { area_id: area ? area.area_id : texts.area_id, line_id: texts.line_id, code_raw: code.trim(), classification: cls, reason_raw: reason, stop_ts: stop, start_ts: start };
    const derived = deriveEventFields(row, index);
    return {
      rec: {
        event_date: x.event_date, line_id: texts.line_id, area_id: row.area_id, code_raw: row.code_raw, stop_ts: stop, start_ts: start, freq,
        classification: cls, criticality: x.criticality, is_failure: x.is_failure, reason_raw: reason, description,
        equipment_id: derived.equipment_id, is_area_level: derived.is_area_level, duration_s: (startMs - stopMs) / 1000,
        reason_id: derived.reason_id, flags: derived.flags.join(','), code_key: codeKey(code),
      },
    };
  }
  const stored = (v: string | undefined): string | undefined => v || undefined;

  // ------------------------------------------------------------ notifications (rules: mockNotifications.ts; the server has its own port)
  const RESOLVABLE = ['long_stop', 'repeat_group', 'upload_gap', 'action_due', 'action_ready_to_close', 'task_overdue'];
  const SNOOZE_MAX_DAYS = 366;
  let responsibilities: (Responsibility & { active: boolean })[] = [];
  // KPI definitions and targets (backend 2.3.0; mirrors Targets.js)
  const kpiDefs: KpiDefinition[] = (schemaTables as unknown as { kpiDefinitionSeeds: KpiDefinition[] }).kpiDefinitionSeeds.map((d) => ({
    kpi_id: d.kpi_id, name: d.name, category: d.category, unit: d.unit ?? '', better: d.better, decimals: Number(d.decimals ?? 1), aggregation: d.aggregation, status: d.status,
  }));
  let kpiTargets: KpiTarget[] = [];
  // Dispatch & Packing (demo mode only; the backend comes later): daily rows and the section's targets
  let dispatchDays: DispatchDay[] = syntheticDispatchDays();
  let dispatchSettings: DispatchSettings = emptySettings();
  // month-end closing (backend 2.3.0; mirrors Closing.js): a signed-off downtime month is locked
  const closings: MonthClosing[] = [];
  function requireMonthOpen(rec: { event_date?: string; stop_ts?: string }, locked = lockedMonths(closings)) {
    const ym = lockedMonthOf(rec, locked);
    if (ym) throw new ApiError(lockedText(ym), 'conflict');
  }
  // quality limits (backend 2.3.0; mirrors Quality.js)
  const qualityParams: QualityParameter[] = (schemaTables as unknown as { qualityParameterSeeds: QualityParameter[] }).qualityParameterSeeds.map((p) => ({
    ...p, spec_min: p.spec_min ?? null, spec_max: p.spec_max ?? null, target: p.target ?? null, valid_min: p.valid_min ?? null, valid_max: p.valid_max ?? null,
    samples_per_day: p.samples_per_day ?? null, qcx_column: p.qcx_column ?? '', notes: p.notes ?? '', active: p.active !== false, updated_by: '', updated_at: '',
  }));
  // shift reports (backend 2.1.0; mirrors ShiftReports.js)
  const shiftReports: ShiftReport[] = [];
  const shiftStops: ShiftStoppage[] = [];
  const shiftLog: ShiftHistory['log'] = [];
  const shiftEdits: ShiftHistory['edits'] = [];
  let shiftCounter = 0;
  const shiftLogReport = new Map<string, string>();
  const shiftEditReport = new Map<string, string>();
  const msOfTs = (ts: string): number => parseTs(ts) ?? NaN;
  function shiftDef(id: string) {
    const def = DEFAULT_SHIFTS.find((s) => s.shift_id === id);
    if (!def) throw new ApiError(`There is no shift ${id.slice(0, 20)}.`, 'bad_request');
    return def;
  }
  const DUTY_TEXT: Record<string, string> = { shift_entry: 'Shift report entry', production_review: 'Production review', reliability_validation: 'Reliability validation' };
  function requireShiftDuty(user: MockUser, duty: string, area: { area_id: string; line_id: string }, day: string): void {
    if (user.role_id === 'ROLE-ADMIN') return;
    const ok = responsibilities.some((r) => r.user_id === user.user_id && r.active && r.duty === duty && (!r.valid_from || r.valid_from <= day) && (!r.valid_to || day <= r.valid_to) &&
      (r.scope_type === 'plant' || (r.scope_type === 'line' && r.scope_id === area.line_id) || (r.scope_type === 'area' && r.scope_id === area.area_id)));
    if (!ok) throw new ApiError(`You do not hold the duty "${DUTY_TEXT[duty]}" for ${area.area_id} on ${day}. An Admin can add it in Settings > Users > Responsibilities.`, 'forbidden');
  }
  function blankReport(id: string, day: string, shiftId: string, areaId: string, lineId: string, by: string, at: string): ShiftReport {
    return { report_id: id, report_date: day, shift_id: shiftId, area_id: areaId, line_id: lineId, status: 'draft', source: 'app', entered_by: by, entered_at: at,
      submitted_by: '', submitted_at: '', prod_reviewed_by: '', prod_reviewed_at: '', rel_validated_by: '', rel_validated_at: '', posted_at: '',
      returned_by: '', returned_at: '', return_stage: '', return_comment: '', notes: '', updated_by: by, updated_at: at };
  }
  function blankStop(): ShiftStoppage {
    return { stop_id: '', report_id: '', area_id: '', line_id: '', code_raw: '', equipment_id: '', stop_ts: '', start_ts: '', duration_s: null, freq: 1, classification: '',
      criticality: '', is_failure: false, reason_raw: '', reason_id: '', description: '', flags: '', stop_state: 'open', closed_report_id: '', closed_by: '', closed_at: '',
      row_state: 'active', posted_event_id: '', created_by: '', created_at: '', updated_by: '', updated_at: '' };
  }
  function logShift(reportId: string, action: string, from: string, to: string, stage: string, by: string, comment: string): void {
    const id = `WL-${(++shiftCounter).toString(16).padStart(10, '0')}`;
    shiftLogReport.set(id, reportId);
    shiftLog.push({ log_id: id, action, from_status: from, to_status: to, stage, by_user: by, at: nowTs(), comment });
  }
  function logStopEdits(before: ShiftStoppage, reportId: string, stage: ShiftStage, after: Partial<ShiftStoppage>, by: string, comment: string): void {
    for (const f of SHIFT_STOP_FIELDS) {
      const a = String(before[f] ?? ''), b = String(after[f] ?? '');
      if (a === b) continue;
      const id = `SE-${(++shiftCounter).toString(16).padStart(10, '0')}`;
      shiftEditReport.set(id, reportId);
      shiftEdits.push({ edit_id: id, stop_id: before.stop_id, stage, field: f, old_value: a, new_value: b, comment, edited_by: by, edited_at: nowTs() });
    }
  }
  function shiftTs(v: unknown, label: string): string {
    if (v === null || v === undefined || v === '') return '';
    let s = typeof v === 'string' ? v.trim().replace('T', ' ') : '';
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) s += ':00';
    const ms = parseTs(s);
    if (ms === null) throw new ApiError(`${label} must be a date and time like 2026-10-20 14:30.`, 'bad_request');
    return fmtTs(ms);
  }
  function cleanShiftStop(s: { code_raw?: unknown; stop_ts?: unknown; start_ts?: unknown; classification?: unknown; is_failure?: unknown; reason_raw?: unknown; description?: unknown },
    area: { area_id: string; line_id: string }, win: { start: string; end: string } | null, checkWindow: boolean) {
    const stop = shiftTs(s.stop_ts, 'Stop time');
    if (!stop) throw new ApiError('Every stoppage needs its stop time.', 'bad_request');
    if (checkWindow && win && (stop < win.start || stop >= win.end)) throw new ApiError(`Stop time ${stop.slice(0, 16)} is outside this shift (${win.start.slice(0, 16)} to ${win.end.slice(0, 16)}). Enter it in the report of the shift it started in.`, 'bad_request');
    const start = shiftTs(s.start_ts, 'Restart time');
    if (start && checkWindow && win && start > win.end) throw new ApiError(`Restart time ${start.slice(0, 16)} is after this shift ends. Leave it blank: the shift that sees the restart enters it.`, 'bad_request');
    if (start && start > nowTs()) throw new ApiError(`Restart time ${start.slice(0, 16)} is in the future.`, 'bad_request');
    if (stop > nowTs()) throw new ApiError(`Stop time ${stop.slice(0, 16)} is in the future.`, 'bad_request');
    const cls = typeof s.classification === 'string' ? s.classification.trim().toUpperCase() : '';
    const klass = get().classifications.find((c) => c.code === cls);
    const incident = !!klass?.is_incident;
    const failure = s.is_failure === true && incident;
    const norm = normalizeRecord({ event_date: stop.slice(0, 10), line_id: area.line_id, area_id: area.area_id, code_raw: typeof s.code_raw === 'string' ? s.code_raw : '', stop_ts: stop, start_ts: start || stop,
      freq: 1, classification: cls, criticality: incident ? 'INC' : 'NO_INC', is_failure: failure, reason_raw: s.reason_raw ?? '', description: s.description ?? '' }, lookup());
    if ('error' in norm) throw new ApiError(norm.error, 'bad_request');
    const r = norm.rec;
    return {
      area_id: area.area_id, line_id: area.line_id, code_raw: r.code_raw, equipment_id: r.equipment_id ?? '', stop_ts: stop, start_ts: start,
      duration_s: start ? r.duration_s : null, freq: 1, classification: cls, criticality: incident ? 'INC' : 'NO_INC', is_failure: failure,
      reason_raw: r.reason_raw, reason_id: r.reason_id ?? '', description: r.description, flags: r.flags, stop_state: (start ? 'closed' : 'open') as 'open' | 'closed',
    };
  }
  function requireNoBlocking(stops: ShiftStoppage[]): void {
    const bad = stops.filter((s) => blockingFlags(s).length);
    if (bad.length) throw new ApiError(`${bad.length} stoppage(s) must be fixed first: ${bad.slice(0, 3).map((s) => `${s.stop_ts.slice(11, 16)} ${s.code_raw || '(no code)'} (${blockingFlags(s).join(', ').replace(/_/g, ' ')})`).join('; ')}.`, 'bad_request');
  }
  function shiftBundle(id: string) {
    return clone({ report: shiftReports.find((r) => r.report_id === id)!, stoppages: shiftStops.filter((s) => s.row_state === 'active' && (s.report_id === id || s.closed_report_id === id)) });
  }
  function postReadyStops(by: string): number {
    const done = (st?: string) => st === 'validated' || st === 'posted';
    const rep = (id: string) => shiftReports.find((r) => r.report_id === id);
    const lockedNow = lockedMonths(closings);
    const ready = shiftStops.filter((s) => s.row_state === 'active' && !s.posted_event_id && s.stop_state === 'closed' && !lockedNow.has(s.stop_ts.slice(0, 7)) && done(rep(s.report_id)?.status) && done(rep(s.closed_report_id || s.report_id)?.status));
    const d = get();
    const stamp = nowTs();
    for (const s of ready) {
      const norm = normalizeRecord({ event_date: s.stop_ts.slice(0, 10), line_id: s.line_id, area_id: s.area_id, code_raw: s.code_raw, stop_ts: s.stop_ts, start_ts: s.start_ts, freq: 1,
        classification: s.classification, criticality: s.criticality, is_failure: s.is_failure, reason_raw: s.reason_raw, description: s.description }, lookup());
      if ('error' in norm) continue;
      const r = norm.rec;
      const fp = fingerprintOf(r.area_id, r.code_key, r.stop_ts, r.start_ts, 1);
      const existing = d.events.find((e) => e.fingerprint === fp);
      if (existing) { s.posted_event_id = existing.event_id; continue; }
      const id = eventIdOf(fp);
      d.events.push({
        event_id: id, batch_id: s.closed_report_id || s.report_id, event_date: r.event_date, line_id: r.line_id, area_id: r.area_id, code_raw: r.code_raw, equipment_id: r.equipment_id,
        is_area_level: r.is_area_level, stop_ts: r.stop_ts, start_ts: r.start_ts, duration_s: r.duration_s, freq: 1, classification: r.classification as ClassificationCode,
        criticality: r.criticality, is_failure: r.is_failure, reason_raw: stored(r.reason_raw), reason_id: r.reason_id, description: stored(r.description),
        source_file: `Shift report ${s.report_id}`, fingerprint: fp, flags: stored(r.flags), edited: false, is_void: false, created_at: stamp,
        origin: 'shift', time_precision: 'exact', shift_stop_id: s.stop_id,
      });
      s.posted_event_id = id;
    }
    for (const r of shiftReports) {
      if (r.status !== 'validated') continue;
      const own = shiftStops.filter((s) => s.row_state === 'active' && (s.report_id === r.report_id || s.closed_report_id === r.report_id));
      if (own.every((s) => !!s.posted_event_id)) {
        r.status = 'posted'; r.posted_at = stamp; r.updated_at = stamp;
        logShift(r.report_id, 'post', 'validated', 'posted', 'reliability', by, `${own.length} stoppage(s) in the downtime analysis`);
      }
    }
    return ready.length;
  }
  let notifications: Notification[] = [];
  let notifState: NotificationState[] = [];
  let notifPrefs: { user_id: string; key: string; value: string; updated_at: string }[] = [];
  let notifSeeded = false;
  let notifCounter = 0;

  const tsAt = (ms: number): string => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p2(d.getMilliseconds(), 3)}`;
  };

  function makeNotification(c: Candidate, retentionDays: number, nowMs: number): Notification {
    return {
      notification_id: `NT-${(++notifCounter).toString(16).padStart(16, '0')}`, type: c.type, severity: c.severity,
      dedupe_key: c.dedupe_key, title: c.title, detail: c.detail, area_id: c.area_id, line_id: c.line_id, source_ref: c.source_ref,
      created_at: tsAt(nowMs), expires_at: tsAt(nowMs + retentionDays * 86_400_000), status: 'open', resolved_at: '',
      recipients: c.recipients ?? '',
    };
  }

  /** Runs every rule (the "demo data" of the notification panel comes only from here), dedupes, expires and resolves. */
  function runChecks(batch?: UploadBatch): NotificationCheckResult {
    notifSeeded = true;
    const d = get();
    const st = parseNotifSettings(d.settings);
    const nowMs = now();
    const stamp = tsAt(nowMs);
    const res: NotificationCheckResult = { created: 0, resolved: 0, expired: 0 };
    for (const n of notifications) {
      if (n.status === 'open' && n.expires_at && n.expires_at <= stamp) { n.status = 'expired'; res.expired++; }
    }
    const inactive = inactiveAreas();
    const cands = notificationCandidates({
      events: d.events.filter((e) => !inactive.has(e.area_id)), areas: d.areas, index: lookup(), settings: st, today: stamp.slice(0, 10), targets: actionStore.targets(), actions: actionStore.actions(),
      tasks: actionStore.tasks(),
    });
    if (batch) cands.push(uploadDoneCandidate(batch));
    const byKey = new Map(notifications.map((n) => [n.dedupe_key, n]));
    const current = new Set<string>();
    for (const c of cands) {
      const resolvable = RESOLVABLE.includes(c.type);
      if (resolvable) current.add(c.dedupe_key);
      const ex = byKey.get(c.dedupe_key);
      if (!ex) {
        const row = makeNotification(c, st.retentionDays, nowMs);
        notifications.push(row);
        byKey.set(c.dedupe_key, row);
        res.created++;
      } else if (ex.status === 'resolved' && resolvable) {
        ex.status = 'open';
        ex.resolved_at = '';
        ex.expires_at = tsAt(nowMs + st.retentionDays * 86_400_000);
        ex.recipients = c.recipients ?? '';
        res.created++;
      } else if (ex.status === 'open' && (ex.recipients ?? '') !== (c.recipients ?? '')) {
        ex.recipients = c.recipients ?? ''; // backend 1.7.0: the alert follows a new task person or action owner
      }
    }
    for (const n of notifications) {
      if (n.status === 'open' && RESOLVABLE.includes(n.type) && !current.has(n.dedupe_key)) { n.status = 'resolved'; n.resolved_at = stamp; res.resolved++; }
    }
    return res;
  }

  /** Never throws, like the server: a notification step cannot fail the action it follows. */
  function safely(fn: () => void): void {
    try { fn(); } catch { /* best effort */ }
  }

  function userEvent(kind: 'created' | 'password_reset' | 'role_changed', actor: MockUser, target: MockUser, roleChange = ''): void {
    safely(() => {
      const st = parseNotifSettings(get().settings);
      const nowMs = now();
      notifications.push(makeNotification(userEventCandidate(kind, actor, target, roleChange, nowMs), st.retentionDays, nowMs));
    });
  }

  // ------------------------------------------------------------ actions (rules and checks: mockActions.ts; the server has its own port)
  const actionStore = createActionStore({
    db: () => get(), index: () => lookup(), nowTs: () => nowTs(), notifications: () => notifications,
    retentionDays: () => parseNotifSettings(get().settings).retentionDays,
    audit: (userId, action, entityId, detail) => audit(userId, action, 'actions', entityId, detail),
    // backend 1.7.0 (syncReadyToClose_): the ready-to-close alert follows the tasks at once
    syncReady: (actionId, al) => {
      const st = parseNotifSettings(get().settings);
      const nowMs = now();
      const stamp = tsAt(nowMs);
      const rows = notifications.filter((n) => n.type === 'action_ready_to_close' && n.source_ref === actionId);
      for (const r of rows) if (r.status === 'open' && (!al || r.dedupe_key !== al.key)) { r.status = 'resolved'; r.resolved_at = stamp; }
      if (!al) return;
      const ex = rows.find((r) => r.dedupe_key === al.key);
      if (!ex) {
        notifications.push(makeNotification({
          type: al.type, severity: 'alert', dedupe_key: al.key, title: oneLine(al.title, 200), detail: oneLine(al.detail, 500), area_id: al.area,
          line_id: al.line, source_ref: al.ref, recipients: al.recipients,
        }, st.retentionDays, nowMs));
      } else if (ex.status === 'resolved') {
        Object.assign(ex, { status: 'open', resolved_at: '', expires_at: tsAt(nowMs + st.retentionDays * 86_400_000) });
      }
    },
  });
  let demoSeeded = !opts.demoActions;

  /** Demo mode only: area targets, the checks, and a few drafts moved along the board so every column has cards. */
  function seedDemoActions(): void {
    if (demoSeeded) return;
    demoSeeded = true;
    safely(() => {
      const d = get();
      const admin = d.users.find((u) => u.role_id === 'ROLE-ADMIN')!;
      const mgr = d.users.find((u) => u.role_id === 'ROLE-MGR');
      const closers = d.settings.find((x) => x.key === 'actions_closers');
      if (closers && mgr) closers.value = mgr.user_id;
      const year = Number(nowTs().slice(0, 4));
      const contractorOf = (area: string): string => actionStore.list(admin).contractors.find((c) => c.kind === 'contractor' && c.areas.includes(area))?.contractor_id ?? '';
      actionStore.saveTargets(admin, year, [
        { area_id: 'CR', availability_target_pct: 92, planned_allowance_h_year: 240 },
        { area_id: 'RM.1', availability_target_pct: 88, planned_allowance_h_year: 300, overhaul_months: [6] },
        { area_id: 'K.1', availability_target_pct: 90, reliability_target_pct: 97, planned_allowance_h_year: 576, overhaul_months: [2],
          monthly_split: [14, 374, 14, 14, 14, 14, 14, 62, 14, 14, 14, 14] },
        { area_id: 'K.2', availability_target_pct: 90, planned_allowance_h_year: 552, overhaul_months: [11] },
        { area_id: 'CM.1', availability_target_pct: 85, planned_allowance_h_year: 120, overhaul_months: [4] },
        { area_id: 'PK.1', availability_target_pct: 80, planned_allowance_h_year: 216 },
      ]);
      runChecks();
      actionStore.runChecks();
      // the auto drafts stay in Draft with their proposed template tasks; the demo actions below fill the other columns and show
      // tasks in every state (backend 1.7.0): one action ready to close, overdue tasks, and tasks waiting for a stop in K.1, RM.1,
      // CR, AFR and CM.1 (the Shutdown list)
      const due = (days: number) => tsAt(now() + days * 86_400_000).slice(0, 10);
      const eqOf = (area: string): string => d.equipment_areas.find((r) => r.area_id === area)?.equipment_id ?? '';
      const eng = d.users.find((u) => u.role_id === 'ROLE-ENG');
      type DemoTask = NewTask & { status?: TaskStatus; note?: string };
      const demo = (area: string, problem: string, extra: Record<string, unknown>, list: DemoTask[], opts2: { template?: string; comment?: string; close?: string } = {}): string => {
        const eq = eqOf(area);
        const created = actionStore.create(admin, {
          title: `${eq || area} - ${problem} (demo)`, status: 'Open', owner: contractorOf(area), reason_key: problem,
          ...(eq ? { scope_kind: 'equipment', equipment_id: eq } : { scope_kind: 'area', area_id: area }),
          ...(opts2.template ? { template_id: opts2.template } : { tasks: list.map(({ status: _s, note: _n, ...t }) => t) }), ...extra,
        }, { merge: false });
        const id = created.action.action_id;
        (created.tasks ?? []).forEach((t, i) => {
          const want = list[i];
          if (!want) return;
          const changes: Record<string, unknown> = {};
          if (opts2.template) Object.assign(changes, Object.fromEntries(Object.entries(want).filter(([k]) => !['status', 'note', 'title', 'template_step'].includes(k))));
          if (want.status && want.status !== 'Open') Object.assign(changes, { status: want.status, note: want.note ?? '' });
          else if (want.note) changes.note = want.note;
          if (Object.keys(changes).length) actionStore.updateTask(admin, t.task_id, changes);
        });
        if (opts2.template) list.slice((created.tasks ?? []).length).forEach(({ status, note, ...t }) => {
          const added = actionStore.addTask(admin, id, t).task!;
          if (status && status !== 'Open') actionStore.updateTask(admin, added.task_id, { status, note: note ?? '' });
        });
        if (opts2.comment) actionStore.comment(admin, id, opts2.comment);
        if (opts2.close) actionStore.update(admin, id, { status: 'Closed', closure_note: opts2.close });
        return id;
      };
      const each = (fn: () => void) => safely(fn);
      each(() => demo('K.2', 'Hydraulic pressure low', { source: 'pareto', priority: 'High', assignee: mgr?.user_id ?? '' }, [], { template: 'TT-REPEAT', comment: 'Owner asked for the last three shift reports.' }));
      each(() => demo('RM.1', 'Chute blockage', { source: 'report', priority: 'High', assignee: mgr?.user_id ?? '' }, [
        { title: 'Repair', status: 'Done', note: 'Flap linkage pin replaced, actuator set to full stroke in the RM.1 stop.', est_stop_h: 4, needs_stop: true },
        { title: 'Root cause (5-why)', status: 'In progress', note: 'Wet clay build-up after rain; flap stroke too short.', due_date: due(-2), assignee: eng?.user_id ?? '' },
        { title: 'Corrective action', status: 'Waiting stoppage', note: 'Booked for the next RM.1 stop.', due_date: due(10), est_stop_h: 6 },
        { title: 'Spare parts', status: 'Done', note: 'Liner plates and air blaster delivered to store 7.' },
        { title: 'Moisture alarm at the clay feeder (8.5 % limit)', owner: 'AUT', due_date: due(5) },
      ], { template: 'TT-REPEAT', comment: 'Planning confirmed the RM.1 stop. RHI will bring 4 fitters for the liner and the air blaster.' }));
      each(() => demo('K.1', 'Inlet seal worn', { source: 'event' }, [
        { title: 'Replace inlet seal plates (8 of 24)', owner: 'RHI', needs_stop: true, est_stop_h: 8, due_date: due(6), status: 'Waiting stoppage' },
        { title: 'Burner tip inspection and swap', owner: 'MEC', needs_stop: true, est_stop_h: 3, due_date: due(16), status: 'Waiting stoppage' },
        { title: 'Clean cyclone 4 cone, check the flap valve', owner: 'RHI', needs_stop: true, est_stop_h: 2, due_date: due(5), status: 'Contractor informed', note: 'Told the RHI supervisor at the morning meeting.' },
      ]));
      each(() => demo('CR', 'Reclaimer chain break', { source: 'notification', priority: 'High' }, [
        { title: 'Replace chain links (12 pcs)', owner: 'RHI', needs_stop: true, est_stop_h: 8, due_date: due(-3), assignee: eng?.user_id ?? '', status: 'Contractor informed', note: 'RHI informed by phone.' },
        { title: 'Root cause (5-why)', owner: 'MEC', due_date: due(-1) },
      ]));
      each(() => demo('AFR', 'Rotary feeder wear', { source: 'manual', scope_kind: 'area', area_id: 'AFR', equipment_id: undefined }, [
        { title: 'Replace rotor tips', owner: 'RHI', needs_stop: true, est_stop_h: 2.5, due_date: due(-2), status: 'Waiting stoppage' },
        { title: 'Fit an inspection door on the chute', owner: 'RHI', needs_stop: true, due_date: due(18), status: 'Waiting stoppage' },
      ]));
      each(() => demo('CM.1', 'Feed belt misalignment', { source: 'report' }, [
        { title: 'Fit self-aligning idlers (3)', owner: 'ASEC', needs_stop: true, est_stop_h: 1.5, due_date: due(5), status: 'Contractor informed', note: 'ASEC site office informed.' },
        { title: 'Belt scale re-calibration after the idlers', owner: 'ELE', due_date: due(9) },
        { title: 'Order idlers', owner: 'MEC', status: 'Done', note: 'Three idlers in store 2.' },
      ]));
      each(() => demo('FM.1', 'Liner worn', { source: 'notification', root_cause: 'MEC' }, [
        { title: 'Replace the worn liner', owner: 'RHI', needs_stop: true, est_stop_h: 5, status: 'Done', note: 'Liner replaced in the FM.1 stop.' },
        { title: 'Check the alignment', owner: 'MEC', status: 'Done', note: 'Alignment within 0.05 mm.' },
        { title: 'Spare liner on stock', owner: 'MEC', status: 'Not needed', note: 'One spare liner already in store 4.' },
      ], { comment: 'All work done - waiting for a closer.' }));
      each(() => demo('CM.2', 'Belt torn', { source: 'pareto' }, [
        { title: 'Replace the belt', owner: 'ASEC', needs_stop: true, est_stop_h: 10, status: 'Done', note: 'Belt replaced.' },
        { title: 'Check the alignment', owner: 'MEC', status: 'Done', note: 'Alignment checked.' },
      ], { close: 'Belt replaced and alignment checked; watching for repeats.' }));
      each(() => {
        const id = demo('PK.1', 'Spout wear', { source: 'manual' }, [{ title: 'Inform ASEC: spout wear', owner: 'ASEC', due_date: due(-1) }]);
        actionStore.update(admin, id, { status: 'Cancelled', closure_note: 'Duplicate of an older action.' });
      });
      each(() => actionStore.create(admin, {
        title: 'Diaphragm slots clogged - inspect and clean', scope_kind: 'area', area_id: 'CM.3', status: 'Open', priority: 'Low',
        owner: 'MEC', due_date: due(7), detail: 'Seen at the last inspection round (demo).',
      }, undefined));
      runChecks();
    });
  }

  /** backend 1.7.0 (notifForUser_): blank recipients = everyone; else one of the user ids, or @closers for the closers and Admins. */
  const forUser = (n: Notification, user: MockUser): boolean => {
    const list = String(n.recipients ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!list.length) return true;
    const closer = actionStore.isCloser(user);
    return list.some((r) => (r === '@closers' ? closer : r === user.user_id));
  };
  const notifVisible = (n: Notification, access: Access, stamp: string, user: MockUser): boolean =>
    n.status === 'open' && !(n.expires_at && n.expires_at <= stamp) && !(n.type === 'user_event' && access.users === 'Hidden') && forUser(n, user);

  /** The theme saved with the account, '' when none (accountTheme_ in Notifications.js). */
  const accountTheme = (userId: string): string => {
    const v = notifPrefs.find((r) => r.user_id === userId && r.key === 'theme')?.value ?? '';
    return THEME_NAMES.includes(v) ? v : '';
  };
  /** Areas switched off (backend 1.5.0): their records are left out of every rule, as on the server. */
  const inactiveAreas = (): Set<string> => new Set(get().areas.filter((x) => !x.active).map((x) => x.area_id));
  /** An alert about an area that is switched off is not shown (overdue actions are). */
  const ofInactiveArea = (n: Notification, inactive: Set<string>): boolean => !!n.area_id && inactive.has(n.area_id) && NOTIFICATION_CATEGORY_OF[n.type] !== 'Actions';

  const prefsOf = (userId: string): NotificationPrefs => {
    const out: NotificationPrefs = {};
    for (const r of notifPrefs) if (r.user_id === userId) out[r.key] = r.value;
    return out;
  };
  const editText = (v: unknown): string => (v === true ? 'TRUE' : v === false ? 'FALSE' : v === null || v === undefined ? '' : String(v));

  // ------------------------------------------------------------ editing
  function applyEdit(userId: string, eventId: string, changes: EventChanges, note: string, at: string): EventRow {
    const d = get();
    const why = String(note ?? '').trim();
    if (!why) throw new ApiError('Please write a short note saying why you are changing this event.', 'bad_request');
    const incoming = (changes ?? {}) as Record<string, unknown>;
    const fields = Object.keys(incoming);
    if (!fields.length) throw new ApiError('No changes to save.', 'bad_request');
    for (const k of fields) {
      if (!EDITABLE.includes(k)) throw new ApiError(`The field "${k}" cannot be edited.`, 'bad_request');
    }
    const ev = d.events.find((e) => e.event_id === eventId);
    if (!ev) throw new ApiError('Event not found.', 'not_found');
    if (ev.is_void) throw new ApiError('This event is void. Restore it before editing.', 'conflict');
    requireMonthOpen(ev);
    const bad = (m: string) => new ApiError(m, 'bad_request');
    const index = lookup();
    const cand: Record<string, unknown> = {};
    for (const f of EDITABLE) cand[f] = (ev as unknown as Record<string, unknown>)[f];
    for (const f of fields) cand[f] = incoming[f];
    if ('classification' in incoming) {
      const c = typeof incoming.classification === 'string' ? incoming.classification.trim().toUpperCase() : '';
      if (!CLASS_CODES.includes(c as ClassificationCode)) throw bad(`Classification must be one of ${CLASS_CODES.join(', ')}.`);
      cand.classification = c;
    }
    if ('area_id' in incoming) {
      const a = findArea(index, typeof incoming.area_id === 'string' ? incoming.area_id : '');
      if (!a) throw bad(`Area "${String(incoming.area_id).slice(0, 40)}" is not in the list of areas.`);
      cand.area_id = a.area_id;
      if (!('line_id' in incoming)) cand.line_id = a.line_id;
    }
    if ('line_id' in incoming) {
      const ln = typeof incoming.line_id === 'string' ? incoming.line_id.trim() : '';
      if (!d.lines.some((l) => l.line_id === ln)) throw bad(`Line "${String(incoming.line_id).slice(0, 20)}" is not in the list of lines.`);
      cand.line_id = ln;
    }
    const norm = normalizeRecord(cand, index);
    if ('error' in norm) throw bad(norm.error);
    const rec = norm.rec;
    requireMonthOpen(rec);
    // criticality follows a changed classification, unless the old one was blank or unknown (then the sheet's value stays)
    if ('classification' in incoming && !('criticality' in incoming) && CLASS_CODES.includes(ev.classification) && rec.classification !== ev.classification) {
      rec.criticality = d.classifications.find((c) => c.code === rec.classification)!.is_incident ? 'INC' : 'NO_INC';
    }
    if (!('is_failure' in incoming) && (rec.criticality !== ev.criticality || rec.freq !== ev.freq)) {
      rec.is_failure = rec.criticality === 'INC' && rec.freq === 1;
    }
    const accOld = canonicalFlags(splitFlags(ev.accepted_flags));
    const accNew = pruneAcceptedFlags(ev.accepted_flags, rec.flags);
    const order = EDITABLE.filter((f) => editText((rec as unknown as Record<string, unknown>)[f]) !== editText((ev as unknown as Record<string, unknown>)[f]));
    if (!order.length) throw bad('Nothing was changed.');
    const before = { ...ev } as unknown as Record<string, unknown>;
    const pruned = accNew.length !== accOld.length;
    Object.assign(ev, {
      event_date: rec.event_date, line_id: rec.line_id, area_id: rec.area_id, code_raw: rec.code_raw, stop_ts: rec.stop_ts, start_ts: rec.start_ts,
      freq: rec.freq, classification: rec.classification, criticality: rec.criticality, is_failure: rec.is_failure,
      reason_raw: stored(rec.reason_raw), description: stored(rec.description), equipment_id: rec.equipment_id, is_area_level: rec.is_area_level,
      duration_s: rec.duration_s, reason_id: rec.reason_id, flags: stored(rec.flags), edited: true,
    });
    if (pruned) {
      // accepted flags the record no longer carries are dropped, and the history says so
      ev.accepted_flags = stored(accNew.join(','));
      if (!accNew.length) { ev.accepted_by = undefined; ev.accepted_at = undefined; }
    }
    order.forEach((f) => {
      d.event_edits.push({
        edit_id: `ED-${at.replace(/\D/g, '').slice(0, 14)}-${++counter}`, event_id: ev.event_id, edited_at: at, edited_by: userId,
        field: f, old_value: stored(editText(before[f])), new_value: stored(editText(ev[f as keyof EventRow])), note: why,
      });
    });
    if (pruned) {
      d.event_edits.push({
        edit_id: `ED-${at.replace(/\D/g, '').slice(0, 14)}-${++counter}`, event_id: ev.event_id, edited_at: at, edited_by: userId,
        field: 'accepted_flags', old_value: stored(accOld.join(',')), new_value: stored(accNew.join(',')), note: PRUNE_NOTE,
      });
    }
    const pairs = order.map((f) => `${f}: ${auditValue(before[f], 40)} -> ${auditValue(ev[f as keyof EventRow], 40)}`);
    if (pruned) pairs.push(`accepted_flags: ${auditValue(accOld.join(','), 40)} -> ${auditValue(accNew.join(','), 40)}`);
    d.audit_log.push({ at, user_id: userId, action: 'edit_event', entity: 'events', entity_id: ev.event_id, detail: `${pairs.join('; ')}. Note: ${why}`.slice(0, 500) });
    return ev;
  }

  function applyAccept(userId: string, eventId: string, flags: unknown, note: string, at: string): EventRow {
    const d = get();
    const why = typeof note === 'string' ? note.trim() : '';
    if (!why) throw new ApiError('A note explaining why is required.', 'bad_request');
    if (why.length < ACCEPT_NOTE_MIN) throw new ApiError(`The note must be at least ${ACCEPT_NOTE_MIN} characters.`, 'bad_request');
    if (why.length > 500) throw new ApiError('A note explaining why is too long.', 'bad_request');
    if (!Array.isArray(flags)) throw new ApiError('Flags must be a list.', 'bad_request');
    if (flags.length > 40) throw new ApiError('Too many flags.', 'bad_request');
    for (const f of flags) {
      if (typeof f !== 'string' || !isKnownFlag(f)) throw new ApiError(`Unknown flag: ${String(f).slice(0, 40)}.`, 'bad_request');
    }
    const wanted = canonicalFlags(flags as string[]);
    const ev = d.events.find((e) => e.event_id === eventId);
    if (!ev) throw new ApiError('Event not found.', 'not_found');
    if (ev.is_void) throw new ApiError('This event is void. Restore it before changing it.', 'conflict');
    requireMonthOpen(ev);
    const current = canonicalFlags(splitFlags(ev.accepted_flags));
    const storedFlags = canonicalFlags(splitFlags(ev.flags));
    for (const f of wanted) {
      if (!current.includes(f) && !storedFlags.includes(f) && !(DERIVED_FLAGS as readonly string[]).includes(f)) {
        throw new ApiError(`This record does not have the problem "${f}".`, 'bad_request');
      }
    }
    if (wanted.join(',') === current.join(',')) throw new ApiError('Nothing was changed.', 'bad_request');
    if (wanted.length) {
      ev.accepted_flags = wanted.join(',');
      ev.accepted_by = userId;
      ev.accepted_at = at;
    } else {
      ev.accepted_flags = undefined;
      ev.accepted_by = undefined;
      ev.accepted_at = undefined;
    }
    d.event_edits.push({
      edit_id: `ED-${at.replace(/\D/g, '').slice(0, 14)}-${++counter}`, event_id: ev.event_id, edited_at: at, edited_by: userId,
      field: 'accepted_flags', old_value: stored(current.join(',')), new_value: stored(wanted.join(',')), note: why,
    });
    d.audit_log.push({
      at, user_id: userId, action: 'accept_event_flags', entity: 'events', entity_id: ev.event_id,
      detail: `${wanted.length ? `Kept as entered: ${wanted.join(', ')}` : `Undid keep as entered (was: ${current.join(', ')})`}. Note: ${why}`,
    });
    return ev;
  }

  function applyVoid(userId: string, eventId: string, isVoid: boolean, note: string, at: string): EventRow {
    const d = get();
    const ev = d.events.find((e) => e.event_id === eventId);
    if (!ev) throw new ApiError('That event was not found.', 'not_found');
    if (!String(note ?? '').trim()) throw new ApiError('Please write a short note saying why.', 'bad_request');
    if (typeof isVoid !== 'boolean') throw new ApiError('Void must be yes or no.', 'bad_request');
    if (ev.is_void === isVoid) throw new ApiError(isVoid ? 'This event is already voided.' : 'This event is not voided.', 'conflict');
    requireMonthOpen(ev);
    ev.is_void = isVoid;
    d.event_edits.push({
      edit_id: `ED-${at.replace(/\D/g, '').slice(0, 14)}-${++counter}`, event_id: ev.event_id, edited_at: at, edited_by: userId,
      field: 'is_void', old_value: isVoid ? 'FALSE' : 'TRUE', new_value: isVoid ? 'TRUE' : 'FALSE', note: String(note).trim(),
    });
    d.audit_log.push({ at, user_id: userId, action: isVoid ? 'void_event' : 'unvoid_event', entity: 'events', entity_id: ev.event_id, detail: `Note: ${String(note).trim()}` });
    return ev;
  }

  /** A few edited and voided rows, as a long-running installation would have. */
  function seedHistory(d: SyntheticDb) {
    const eng = 'U-DEMO-ENG';
    const clean = d.events.filter((e) => e.event_date >= '2026-03-01' && !e.flags && e.freq === 1 && !e.is_area_level && e.classification !== 'PL');
    const at = (n: number) => `2026-10-0${n} 0${6 + n}:20:00.000`;
    const step = Math.floor(clean.length / 10);
    const pickAt = (i: number) => clean[step * (i + 1)];
    applyEdit(eng, pickAt(0).event_id, { description: 'Corrected after the shift report' }, 'Description corrected from the shift report (synthetic).', at(1));
    const e1 = pickAt(1);
    applyEdit(eng, e1.event_id, { classification: e1.classification === 'ELE' ? 'MEC' : 'ELE', reason_raw: e1.classification === 'ELE' ? 'Belt torn' : 'Cable fault' }, 'Wrong classification entered at source (synthetic).', at(2));
    const e2 = pickAt(2);
    applyEdit(eng, e2.event_id, { start_ts: fmtTs((parseTs(e2.start_ts) ?? 0) + 15 * 60_000) }, 'Restart time corrected from the control-room log (synthetic).', at(3));
    applyVoid(eng, pickAt(3).event_id, true, 'Duplicate of another record (synthetic).', at(4));
    applyVoid(eng, pickAt(4).event_id, true, 'Entered in the wrong area (synthetic).', at(4));
    const e5 = pickAt(5);
    applyVoid(eng, e5.event_id, true, 'Voided by mistake (synthetic).', at(5));
    applyVoid(eng, e5.event_id, false, 'Restored, the stop did happen (synthetic).', at(6));
    d.audit_log.length = 0; // history above is only for the explorer's demo
  }

  // ------------------------------------------------------------ the Api
  const api: MockApi = {
    __db: () => get(),
    __setNow: (fn) => { now = fn; },
    __sentMail: () => structuredClone(sentMail),

    // --- auth
    async login(email, password, keepSignedIn) {
      const d = get();
      const user = d.users.find((u) => u.email === String(email ?? '').trim().toLowerCase());
      if (!user || !user.active) throw new ApiError(BAD_LOGIN, 'bad_credentials');
      const waitError = (until: number) => {
        const mins = Math.max(1, Math.ceil((until - now()) / 60_000));
        return new ApiError(`Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 'locked');
      };
      // backend 1.10.0: no lock; from the limit on each further attempt waits 1, 2, 4, 8, 16 min, then lockout_minutes
      if (user.locked_until && user.locked_until > now()) throw waitError(user.locked_until);
      if (user.password !== password) {
        user.failed_attempts += 1;
        const limit = numSetting('lockout_attempts', 5);
        if (user.failed_attempts >= limit) {
          const wait = Math.min(2 ** Math.min(user.failed_attempts - limit, 20), Math.max(1, numSetting('lockout_minutes', 30)));
          user.locked_until = now() + wait * 60_000;
          audit(user.user_id, 'login_throttled', 'users', user.user_id, `Wrong password (${user.failed_attempts}); next attempt allowed in ${wait} min`);
          throw waitError(user.locked_until);
        }
        audit(user.user_id, 'login_failed', 'users', user.user_id, `Wrong password (${user.failed_attempts} of ${limit})`);
        throw new ApiError(BAD_LOGIN, 'bad_credentials');
      }
      user.failed_attempts = 0;
      user.locked_until = undefined;
      user.last_login_at = nowTs();
      audit(user.user_id, 'login', 'users', user.user_id, 'Signed in');
      noteActivity(user.user_id);
      const hours = keepSignedIn ? numSetting('session_hours_keep', 336) : numSetting('session_hours', 12);
      return clone(makeSession(user, hours * 3_600_000));
    },
    async changePassword(token, current, next) {
      const a = auth(token, true);
      if (a.user.password !== current) throw new ApiError('Your current password is not correct.', 'bad_credentials');
      const min = numSetting('min_password_length', 10);
      if (String(next ?? '').length < min) throw new ApiError(`Use at least ${min} characters.`, 'bad_request');
      if (next === current) throw new ApiError('The new password must be different from the current one.', 'bad_request');
      a.user.password = next;
      a.user.must_change = false;
      audit(a.user.user_id, 'change_password', 'users', a.user.user_id, 'Password changed by the user');
      return clone(makeSession(a.user, a.exp - a.iat));
    },
    async signOutEverywhere(token) {
      const a = auth(token, true);
      signedOutAt.set(a.user.user_id, now() + 1);
      audit(a.user.user_id, 'sign_out_everywhere', 'users', a.user.user_id, 'Signed out on all devices');
      return null;
    },
    async signOutUserEverywhere(token, userId) {
      const a = auth(token);
      if (a.user.role_id !== 'ROLE-ADMIN') throw new ApiError('You do not have access to do this.', 'forbidden');
      const user = get().users.find((x) => x.user_id === userId);
      if (!user) throw new ApiError('That user was not found.', 'not_found');
      signedOutAt.set(user.user_id, now() + 1);
      audit(a.user.user_id, 'sign_out_user_everywhere', 'users', user.user_id, `Signed ${user.email} out on all devices`);
      return null;
    },
    async logout(token) {
      const a = auth(token, true);
      audit(a.user.user_id, 'logout', 'users', a.user.user_id, 'Signed out');
    },
    async getMyAccess(token, activityHint) {
      const a = auth(token, true);
      noteActivity(a.user.user_id, activityHint);
      return clone({ user: sessionUser(a.user), access: a.access, must_change: a.user.must_change, theme: accountTheme(a.user.user_id), server_version: MOCK_SERVER_VERSION });
    },

    // --- reads
    async getStartup(token) {
      const a = auth(token);
      if (!TAB_IDS.some((t) => LEVEL_RANK[a.access[t]] > 0)) throw new ApiError('You do not have access to this.', 'forbidden', true);
      const d = get();
      const years = [...new Set(d.events.map((e) => Number(e.event_date.slice(0, 4))))].sort((x, y) => y - x);
      return clone({
        lines: d.lines, areas: d.areas, equipment: d.equipment, equipment_areas: d.equipment_areas, aliases: d.aliases,
        classifications: d.classifications, reasons: d.reasons, settings: d.settings, years,
        kpi_definitions: kpiDefs, kpi_targets: kpiTargets, month_closings: closings,
      });
    },
    async getEvents(token, year) {
      need(token, DASHBOARD_TABS, 'View');
      if (!Number.isInteger(year) || year < 1990 || year > 2200) throw new ApiError('Please give a year such as 2026.', 'bad_request');
      const prefix = `${year}-`;
      return clone(get().events.filter((e) => e.event_date.startsWith(prefix)).sort((x, y) => x.stop_ts.localeCompare(y.stop_ts) || x.area_id.localeCompare(y.area_id)));
    },
    async getEventEdits(token, eventId) {
      need(token, ['events'], 'View');
      return clone(get().event_edits.filter((e) => e.event_id === eventId).sort((x, y) => x.edited_at.localeCompare(y.edited_at)));
    },
    async getUploadHistory(token) {
      need(token, ['upload'], 'View');
      return clone([...get().upload_batches].sort((x, y) => y.uploaded_at.localeCompare(x.uploaded_at)));
    },
    async getUploadWarnings(token, batchId) {
      need(token, ['upload'], 'View');
      if (!get().upload_batches.some((b) => b.batch_id === batchId)) throw new ApiError('That upload was not found.', 'not_found');
      return clone(get().upload_warnings.filter((w) => w.batch_id === batchId));
    },

    // --- upload
    async uploadStart(token, fileName, fileHash, kind) {
      const a = need(token, ['upload'], 'Edit');
      if (kind && kind !== 'monthly' && kind !== 'history') throw new ApiError('Kind must be monthly or history.', 'bad_request');
      if (kind === 'history' && a.user.role_id !== 'ROLE-ADMIN') throw new ApiError('Only an Admin can import history.', 'forbidden');
      const t = nowTs();
      const id = `B-${t.slice(0, 10).replace(/-/g, '')}-${t.slice(11, 19).replace(/:/g, '')}-${(0x1000 + (++counter % 0xefff)).toString(16)}`;
      get().upload_batches.push({
        batch_id: id, uploaded_by: a.user.user_id, uploaded_at: t, file_name: String(fileName ?? ''), file_hash: String(fileHash ?? ''),
        rows_read: 0, rows_added: 0, rows_identical: 0, rows_skipped: 0, warning_count: 0, status: 'Started', kind: kind ?? 'monthly',
      });
      audit(a.user.user_id, 'upload_start', 'upload_batches', id, String(fileName ?? ''));
      return { batch_id: id };
    },
    async uploadChunk(token, batchId, rows) {
      const a = need(token, ['upload'], 'Edit');
      const d = get();
      const batch = d.upload_batches.find((b) => b.batch_id === batchId);
      if (!batch) throw new ApiError('That upload was not found.', 'not_found');
      if (batch.status !== 'Started') throw new ApiError('This upload is already finished.', 'conflict');
      if (!Array.isArray(rows)) throw new ApiError('No rows were sent.', 'bad_request');
      const known = new Set(d.events.map((e) => e.fingerprint));
      const inBatch = new Map<string, number | undefined>();
      for (const e of d.events) if (e.batch_id === batch.batch_id) inBatch.set(e.fingerprint, e.source_row);
      const index = lookup();
      const lockedNow = lockedMonths(closings);
      const rejected: { source_row: number; reason: string }[] = [];
      const base = new Map<string, (number | undefined)[]>();
      const extra = new Map<string, number>();
      let added = 0, identical = 0;
      for (const r of rows as UploadRow[]) {
        const norm = normalizeRecord(r, index);
        if ('error' in norm) { rejected.push({ source_row: Number((r as Partial<UploadRow> | null)?.source_row) || 0, reason: norm.error }); continue; }
        const rec = norm.rec;
        if (lockedMonthOf(rec, lockedNow)) { rejected.push({ source_row: Number(r.source_row) || 0, reason: lockedText(lockedMonthOf(rec, lockedNow)) }); continue; }
        const key = `${rec.area_id}|${rec.code_key}|${rec.stop_ts}|${rec.start_ts}`;
        const srcRow = Number.isFinite(Number(r.source_row)) && String(r.source_row ?? '') !== '' ? Math.trunc(Number(r.source_row)) : undefined;
        const fpOf = (n: number) => fingerprintOf(rec.area_id, rec.code_key, rec.stop_ts, rec.start_ts, n);
        // the occurrence number the browser used counts only when its fingerprint verifies
        let n = 0;
        if (/^[0-9a-f]{64}$/.test(String(r.fingerprint ?? ''))) {
          for (let k = 1; k <= FINGERPRINT_HINT_MAX; k++) if (fpOf(k) === r.fingerprint) { n = k; break; }
        }
        if (!n) {
          let list = base.get(key);
          if (!list) {
            list = [];
            while (inBatch.has(fpOf(list.length + 1))) list.push(inBatch.get(fpOf(list.length + 1)));
            base.set(key, list);
          }
          const at = srcRow === undefined ? -1 : list.indexOf(srcRow);
          if (at >= 0) n = at + 1; // the same file row sent again (a retry)
          else { extra.set(key, (extra.get(key) ?? 0) + 1); n = list.length + (extra.get(key) as number); }
        }
        const fp = fpOf(n);
        if (known.has(fp)) { identical++; continue; }
        known.add(fp);
        d.events.push({
          event_id: eventIdOf(fp), batch_id: batchId, event_date: rec.event_date, line_id: rec.line_id, area_id: rec.area_id,
          code_raw: rec.code_raw, equipment_id: rec.equipment_id, is_area_level: rec.is_area_level, stop_ts: rec.stop_ts, start_ts: rec.start_ts,
          duration_s: rec.duration_s, freq: rec.freq, classification: rec.classification as ClassificationCode, criticality: rec.criticality,
          is_failure: rec.is_failure, reason_raw: stored(rec.reason_raw), reason_id: rec.reason_id, description: stored(rec.description),
          source_file: batch.file_name, source_row: srcRow, fingerprint: fp, flags: stored(rec.flags), edited: false, is_void: false, created_at: nowTs(),
          ...(batch.kind === 'history' ? { origin: 'history', time_precision: 'day' } : {}),
        });
        added++;
      }
      batch.rows_added += added;
      batch.rows_identical += identical;
      audit(a.user.user_id, 'upload_chunk', 'upload_batches', batch.batch_id, `Added ${added}, identical ${identical}, rejected ${rejected.length}`);
      return { added, identical, rejected };
    },
    async uploadFinish(token, batchId, summary, warnings) {
      const a = need(token, ['upload'], 'Edit');
      const d = get();
      const batch = d.upload_batches.find((b) => b.batch_id === batchId);
      if (!batch) throw new ApiError('That upload was not found.', 'not_found');
      if (batch.status === 'Completed') return clone(batch);
      let n = 0;
      for (const w of warnings ?? []) {
        d.upload_warnings.push({ ...w, warning_id: `W-${batchId}-${++n}`, batch_id: batchId });
      }
      batch.rows_read = Number(summary?.rows_read) || 0;
      batch.rows_skipped = Number(summary?.rows_skipped) || 0;
      batch.warning_count = n;
      batch.status = 'Completed';
      const decided = new Map<string, number>();
      for (const w of warnings ?? []) if (w.resolution) decided.set(`${w.type} ${w.resolution}`, (decided.get(`${w.type} ${w.resolution}`) ?? 0) + 1);
      const decisions = [...decided.keys()].sort().map((k) => `${k} ${decided.get(k)}`).join(', ');
      audit(a.user.user_id, 'upload_finish', 'upload_batches', batchId, `File ${auditValue(batch.file_name, 120)}. Read ${batch.rows_read}, added ${batch.rows_added}, identical ${batch.rows_identical}, skipped ${batch.rows_skipped}, warnings ${n}${decisions ? `. Decisions: ${decisions}` : ''}`);
      safely(() => { runChecks(batch); });
      safely(() => { actionStore.runChecks(); }); // after the alerts, so a new long stop already has its notification
      return clone(batch);
    },

    // --- data checks
    async revalidateEvents(token, year) {
      const a = need(token, ['events'], 'Edit');
      if (year !== undefined && year !== null && (!Number.isInteger(year) || year < 1990 || year > 2200)) throw new ApiError('Year is not valid.', 'bad_request');
      const index = lookup();
      const lockedNow = lockedMonths(closings);
      const at = nowTs();
      let checked = 0, changed = 0;
      for (const ev of get().events) {
        if (ev.is_void) continue;
        if (year !== undefined && year !== null && !ev.event_date.startsWith(`${year}-`)) continue;
        if (lockedMonthOf(ev, lockedNow)) continue; // a signed-off month keeps its flags
        checked++;
        const norm = normalizeRecord(ev, index);
        if ('error' in norm) continue;
        const rec = norm.rec;
        const accOld = canonicalFlags(splitFlags(ev.accepted_flags));
        const accNew = pruneAcceptedFlags(ev.accepted_flags, rec.flags);
        const pruned = accNew.length !== accOld.length;
        if (!pruned && rec.flags === (ev.flags ?? '') && (rec.equipment_id ?? '') === (ev.equipment_id ?? '') && (rec.reason_id ?? '') === (ev.reason_id ?? '')
          && rec.is_area_level === ev.is_area_level && rec.duration_s === ev.duration_s) continue;
        if (pruned) {
          ev.accepted_flags = stored(accNew.join(','));
          if (!accNew.length) { ev.accepted_by = undefined; ev.accepted_at = undefined; }
          get().event_edits.push({
            edit_id: `ED-${at.replace(/\D/g, '').slice(0, 14)}-R${++counter}`, event_id: ev.event_id, edited_at: at, edited_by: a.user.user_id,
            field: 'accepted_flags', old_value: stored(accOld.join(',')), new_value: stored(accNew.join(',')), note: PRUNE_NOTE,
          });
        }
        ev.flags = stored(rec.flags);
        ev.equipment_id = rec.equipment_id;
        ev.reason_id = rec.reason_id;
        ev.is_area_level = rec.is_area_level;
        ev.duration_s = rec.duration_s;
        changed++;
      }
      audit(a.user.user_id, 'revalidate_events', 'events', year === undefined || year === null ? 'all' : String(year), `Checked ${checked}, changed ${changed}`);
      return { checked, changed };
    },

    // --- event correction
    async editEvent(token, eventId, changes, note) {
      const a = need(token, ['events'], 'Edit');
      return clone(applyEdit(a.user.user_id, eventId, changes, note, nowTs()));
    },
    async voidEvent(token, eventId, isVoid, note) {
      const a = need(token, ['events'], 'Edit');
      return clone(applyVoid(a.user.user_id, eventId, isVoid, note, nowTs()));
    },

    async acceptEventFlags(token, eventId, flags, note) {
      const a = need(token, ['events'], 'Edit');
      return clone(applyAccept(a.user.user_id, eventId, flags, note, nowTs()));
    },
    async acceptEventFlagsBulk(token, items, note) {
      const a = need(token, ['events'], 'Edit');
      if (!Array.isArray(items) || !items.length) throw new ApiError('Send at least one record.', 'bad_request');
      if (items.length > 200) throw new ApiError('At most 200 records at once.', 'bad_request');
      const at = nowTs();
      const saved: EventRow[] = [];
      const failed: { event_id: string; message: string }[] = [];
      for (const it of items) {
        try {
          saved.push(applyAccept(a.user.user_id, it.eventId, it.flags, note, at));
        } catch (e) {
          failed.push({ event_id: it.eventId, message: e instanceof Error ? e.message : String(e) });
        }
      }
      return clone({ saved, failed });
    },

    // --- master data
    async saveEquipment(token, row, areaIds) {
      const a = need(token, ['master'], 'Edit');
      const d = get();
      const id = codeKey(row?.equipment_id);
      if (!id) throw new ApiError('The equipment code cannot be empty.', 'bad_request');
      if (id === 'N/A' || id === 'NA') throw new ApiError('N/A is reserved for "the whole area stopped". Use a real equipment code.', 'bad_request');
      if (row.status !== 'Active' && row.status !== 'Retired') throw new ApiError('Status must be Active or Retired.', 'bad_request');
      for (const ar of areaIds ?? []) if (!d.areas.some((x) => x.area_id === ar)) throw new ApiError(`The area "${ar}" does not exist.`, 'bad_request');
      const at = d.equipment.findIndex((e) => e.equipment_id === id);
      const beforeEq = at >= 0 ? { ...d.equipment[at], areas: d.equipment_areas.filter((x) => x.equipment_id === id).map((x) => x.area_id).sort().join(', ') || '(none)' } : null;
      const description = String(row.description ?? '').trim() || undefined;
      const criticality = String(row.criticality ?? '').trim() || undefined;
      const missing: string[] = [];
      if (!description) missing.push('description');
      if (!criticality) missing.push('criticality');
      if (!(areaIds ?? []).length) missing.push('area');
      const next: Equipment = {
        ...row, equipment_id: id, description, criticality, updated_at: nowTs(), updated_by: a.user.user_id,
        needs_review: missing.length > 0, review_note: missing.length ? `Missing: ${missing.join(', ')}` : undefined,
        origin: at >= 0 ? (d.equipment[at]?.origin ?? row.origin) : 'User',
      };
      if (at >= 0) d.equipment[at] = { ...d.equipment[at], ...next };
      else d.equipment.push({ ...next, created_at: nowTs() });
      d.equipment_areas = d.equipment_areas.filter((x) => x.equipment_id !== id);
      for (const ar of new Set(areaIds ?? [])) d.equipment_areas.push({ equipment_id: id, area_id: ar });
      const areasText = [...new Set(areaIds ?? [])].sort().join(', ') || '(none)';
      audit(a.user.user_id, beforeEq ? 'update_equipment' : 'add_equipment', 'equipment', id, beforeEq
        ? auditChanges(beforeEq, { description: description ?? '', equipment_type: row.equipment_type, criticality: criticality ?? '', parent_id: row.parent_id, status: row.status, areas: areasText },
          ['description', 'equipment_type', 'criticality', 'parent_id', 'status', 'areas']) || 'No change'
        : `${description ?? '(no description)'}. Areas: ${areasText}`);
    },
    async saveArea(token, row) {
      const a = need(token, ['master'], 'Edit');
      const d = get();
      const id = String(row?.area_id ?? '').trim();
      if (!id) throw new ApiError('The area code cannot be empty.', 'bad_request');
      if (!String(row.name ?? '').trim()) throw new ApiError('The area needs a name.', 'bad_request');
      if (!d.lines.some((l) => l.line_id === row.line_id)) throw new ApiError(`The line "${row.line_id}" does not exist.`, 'bad_request');
      const next: Area = { ...row, area_id: id, name: row.name.trim(), active: row.active === true };
      const at = d.areas.findIndex((x) => x.area_id === id);
      const wasActive = at >= 0 ? d.areas[at]!.active : true;
      if (next.active !== wasActive && a.user.role_id !== 'ROLE-ADMIN') {
        throw new ApiError('Only an Admin can switch an area on or off (Settings > Areas).', 'forbidden', true);
      }
      const beforeArea = at >= 0 ? { ...d.areas[at] } : null;
      if (at >= 0) d.areas[at] = { ...d.areas[at], ...next };
      else d.areas.push(next);
      audit(a.user.user_id, beforeArea ? 'update_area' : 'add_area', 'areas', id, beforeArea
        ? auditChanges(beforeArea, next, ['name', 'line_id', 'sort_order', 'active', 'in_downtime_sheet', 'notes']) || 'No change'
        : `${next.name} on ${next.line_id}`);
    },
    async setAreaActive(token, areaId, active) {
      const a = auth(token);
      if (a.user.role_id !== 'ROLE-ADMIN') throw new ApiError('You do not have access to this.', 'forbidden', true);
      const id = typeof areaId === 'string' ? areaId.trim() : '';
      if (!id) throw new ApiError('Area code is required.', 'bad_request');
      if (typeof active !== 'boolean') throw new ApiError('Active must be true or false.', 'bad_request');
      const area = get().areas.find((x) => x.area_id === id);
      if (!area) throw new ApiError(`Unknown area: ${oneLine(id, 60)}.`, 'not_found');
      if (area.active !== active) {
        area.active = active;
        audit(a.user.user_id, active ? 'activate_area' : 'deactivate_area', 'areas', id, `${active ? 'Area switched on' : 'Area switched off'}: ${area.name} on ${area.line_id}`);
      }
      return clone(area);
    },
    async saveReason(token, row) {
      const a = need(token, ['master'], 'Edit');
      const d = get();
      if (!CLASS_CODES.includes(row?.classification)) throw new ApiError('Classification must be one of PRO, MEC, ELE, AUT, PL or CIR.', 'bad_request');
      if (!String(row.text_as_listed ?? '').trim()) throw new ApiError('The reason text cannot be empty.', 'bad_request');
      const mk = matchKey(row.text_as_listed);
      const clash = d.reasons.find((r) => r.classification === row.classification && r.match_key === mk && r.reason_id !== row.reason_id);
      if (clash) throw new ApiError(`That reason is already listed as ${clash.reason_id}.`, 'conflict');
      let id = row.reason_id;
      if (!id) {
        const order = Math.max(0, ...d.reasons.filter((r) => r.classification === row.classification).map((r) => r.order_no)) + 1;
        id = `R-${row.classification}-${String(order).padStart(3, '0')}`;
        row = { ...row, order_no: order };
      }
      const next: Reason = { ...row, reason_id: id, match_key: mk };
      const at = d.reasons.findIndex((r) => r.reason_id === id);
      const beforeReason = at >= 0 ? { ...d.reasons[at] } : null;
      if (at >= 0) d.reasons[at] = next; else d.reasons.push(next);
      audit(a.user.user_id, beforeReason ? 'update_reason' : 'add_reason', 'reasons', id, beforeReason
        ? auditChanges(beforeReason, next, ['classification', 'text_as_listed', 'order_no', 'active']) || 'No change'
        : `${next.classification}: ${auditValue(next.text_as_listed, 120)}`);
    },
    async saveAlias(token, row) {
      const a = need(token, ['master'], 'Edit');
      const d = get();
      const alias = codeKey(row?.alias);
      if (!alias) throw new ApiError('The alias cannot be empty.', 'bad_request');
      if (!d.equipment.some((e) => e.equipment_id === row.equipment_id)) throw new ApiError(`The equipment code "${row.equipment_id}" does not exist.`, 'bad_request');
      if (d.equipment.some((e) => e.equipment_id === alias)) throw new ApiError('That alias is already a real equipment code.', 'conflict');
      const next: EquipmentAlias = { alias, equipment_id: row.equipment_id, reason: row.reason };
      const at = d.aliases.findIndex((x) => codeKey(x.alias) === alias);
      const was = at >= 0 ? d.aliases[at]!.equipment_id : '';
      if (at >= 0) d.aliases[at] = next; else d.aliases.push(next);
      audit(a.user.user_id, at >= 0 ? 'update_alias' : 'add_alias', 'equipment_aliases', alias,
        `Points to ${row.equipment_id}${was && was !== row.equipment_id ? ` (was ${was})` : ''}${next.reason ? `. Reason: ${auditValue(next.reason, 80)}` : ''}`);
    },
    async deleteAlias(token, alias) {
      const a = need(token, ['master'], 'Edit');
      const d = get();
      const k = codeKey(alias);
      const at = d.aliases.findIndex((x) => codeKey(x.alias) === k);
      if (at < 0) throw new ApiError('That alias was not found.', 'not_found');
      const gone = d.aliases.splice(at, 1)[0]!;
      audit(a.user.user_id, 'delete_alias', 'equipment_aliases', k, `Was pointing to ${gone.equipment_id}`);
    },
    async saveSettings(token, changes) {
      const a = need(token, ['settings'], 'Edit');
      const d = get();
      // the same ranges as backend/apps-script/Settings.js
      const ranges: Record<string, [number, number]> = {
        scheduled_hours_per_day: [1, 24], scheduled_days_per_week: [1, 7], repeat_min_events: [2, 100], repeat_window_days: [1, 3650],
        duration_short_max_min: [1, 10000], duration_long_min_min: [1, 100000], lockout_attempts: [1, 100], lockout_minutes: [1, 1440],
        session_hours: [1, 168], session_hours_keep: [1, 8760], min_password_length: [8, 128],
        notif_long_stop_hours: [1, 720], notif_spike_pct: [1, 1000], notif_upload_gap_days: [1, 3650], notif_retention_days: [1, 3650],
        actions_repeat_n: [2, 100], actions_repeat_days: [1, 3650], actions_chronic_top: [1, 100], actions_chronic_months: [1, 24], actions_effect_days: [1, 3650],
      };
      for (const [k, v] of Object.entries(changes ?? {})) {
        if (!d.settings.some((s) => s.key === k)) throw new ApiError(`There is no setting called "${k}".`, 'bad_request');
        const val = String(v ?? '').trim();
        const range = ranges[k];
        if (range) {
          const n = Number(val);
          if (val === '' || !Number.isInteger(n) || n < range[0] || n > range[1]) {
            throw new ApiError(`"${k}" must be a whole number between ${range[0]} and ${range[1]}.`, 'bad_request');
          }
        }
        if (k === 'availability_basis' && !['A', 'B', 'C'].includes(val)) throw new ApiError('Availability basis must be A, B or C.', 'bad_request');
        if (k === 'default_comparison' && !['previous_period', 'same_period_last_year'].includes(val)) throw new ApiError('Comparison must be previous_period or same_period_last_year.', 'bad_request');
        if (k === 'notif_repeat_alert' && !['true', 'false'].includes(val)) throw new ApiError('Repeat alerts must be true or false.', 'bad_request');
        if (k === 'app_url' && val !== '' && (val.length > 300 || !/^https?:\/\/[^\s<>"']+$/i.test(val))) throw new ApiError('The app address must start with http:// or https://, or be blank.', 'bad_request');
        if ((k === 'target_mtbf_h' || k === 'target_mttr_h') && val !== '' && !(Number.isFinite(Number(val)) && Number(val) > 0 && Number(val) <= 100000)) throw new ApiError('The target must be above 0 and at most 100000 hours, or blank.', 'bad_request');
        if (k === 'utilization_target_pct' && val !== '' && !(Number.isFinite(Number(val)) && Number(val) >= 0 && Number(val) <= 100)) throw new ApiError('The utilization factor target must be between 0 and 100, or blank.', 'bad_request');
        if (k === 'reliability_target_pct' && val !== '' && !(Number.isFinite(Number(val)) && Number(val) >= 0 && Number(val) <= 100)) throw new ApiError('The reliability factor target must be between 0 and 100, or blank.', 'bad_request');
        if (k === 'availability_target_pct' && val !== '' && !(Number.isFinite(Number(val)) && Number(val) >= 0 && Number(val) <= 100)) throw new ApiError('The availability target must be between 0 and 100, or blank.', 'bad_request');
        if (k === 'system_email' && val !== '' && (val.length > 254 || !MAIL_RE.test(val))) throw new ApiError('Setting system_email must be an email address, or blank.', 'bad_request');
        if (k === 'system_email_name' && val.length > 80) throw new ApiError('Setting system_email_name is longer than 80 characters.', 'bad_request');
        if (k === 'actions_auto_draft' && !['true', 'false'].includes(val)) throw new ApiError('Auto drafts must be true or false.', 'bad_request');
        if (k === 'actions_closers') actionStore.cleanClosers(val);
      }
      for (const [k, v] of Object.entries(changes ?? {})) {
        const s = d.settings.find((x) => x.key === k)!;
        const value = k === 'actions_closers' ? actionStore.cleanClosers(String(v ?? ''))
          : k === 'system_email' ? String(v ?? '').trim().toLowerCase()
            : k === 'system_email_name' ? String(v ?? '').replace(/[\r\n<>"]+/g, ' ').replace(/\s+/g, ' ').trim()
              : String(v ?? '').trim();
        if (value === s.value) continue; // like the server: an unchanged value is not written or logged
        audit(a.user.user_id, 'save_setting', 'settings', k, `${s.value} -> ${value}`);
        s.value = value;
        s.updated_by = a.user.user_id;
        s.updated_at = nowTs();
      }
    },

    // --- users
    async listUsers(token) {
      need(token, ['users'], 'View');
      return clone(get().users.map(adminUser));
    },
    async createUser(token, u) {
      const a = need(token, ['users'], 'Edit');
      const d = get();
      requireAdminFor(a.user, u?.role_id === 'ROLE-ADMIN', 'create an Admin');
      const email = String(u?.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('Please enter a valid email address.', 'bad_request');
      if (d.users.some((x) => x.email === email)) throw new ApiError('Someone already has that email address.', 'conflict');
      if (!String(u.display_name ?? '').trim()) throw new ApiError('Please enter a name.', 'bad_request');
      if (!d.roles.some((r) => r.role_id === u.role_id)) throw new ApiError('Please choose a role.', 'bad_request');
      const temp = randomTempPassword();
      const user: MockUser = {
        user_id: `U-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, email, display_name: u.display_name.trim(), role_id: u.role_id,
        password: temp, must_change: true, active: true, failed_attempts: 0, created_at: nowTs(), overrides: {},
      };
      d.users.push(user);
      audit(a.user.user_id, 'create_user', 'users', user.user_id, `${email} as ${user.role_id}`);
      userEvent('created', a.user, user);
      return clone({ user: adminUser(user), temp_password: temp });
    },
    async updateUser(token, userId, changes) {
      const a = need(token, ['users'], 'Edit');
      const d = get();
      const user = d.users.find((x) => x.user_id === userId);
      if (!user) throw new ApiError('That user was not found.', 'not_found');
      requireAdminFor(a.user, user.role_id === 'ROLE-ADMIN', 'change an Admin');
      requireAdminFor(a.user, changes.role_id === 'ROLE-ADMIN', 'give the Admin role');
      if (user.user_id === a.user.user_id && (changes.active === false || (changes.role_id && changes.role_id !== user.role_id))) {
        throw new ApiError('You cannot deactivate yourself or change your own role.', 'conflict');
      }
      const beforeUser = { display_name: user.display_name, role_id: user.role_id, active: user.active };
      if (changes.display_name !== undefined) {
        if (!String(changes.display_name).trim()) throw new ApiError('Please enter a name.', 'bad_request');
        user.display_name = String(changes.display_name).trim();
      }
      if (changes.role_id !== undefined) {
        if (!d.roles.some((r) => r.role_id === changes.role_id)) throw new ApiError('Please choose a role.', 'bad_request');
        if (changes.role_id !== user.role_id) userEvent('role_changed', a.user, user, `from ${user.role_id} to ${changes.role_id}`);
        user.role_id = changes.role_id;
      }
      if (changes.active !== undefined) user.active = !!changes.active;
      audit(a.user.user_id, 'update_user', 'users', userId, auditChanges(beforeUser, { display_name: user.display_name, role_id: user.role_id, active: user.active }, ['display_name', 'role_id', 'active']) || 'No change');
      return clone(adminUser(user));
    },
    async resetPassword(token, userId) {
      const a = need(token, ['users'], 'Edit');
      const user = get().users.find((x) => x.user_id === userId);
      if (!user) throw new ApiError('That user was not found.', 'not_found');
      requireAdminFor(a.user, user.role_id === 'ROLE-ADMIN', 'reset the password of an Admin');
      const temp = randomTempPassword();
      user.password = temp;
      user.must_change = true;
      user.failed_attempts = 0;
      user.locked_until = undefined;
      audit(a.user.user_id, 'reset_password', 'users', userId, 'Temporary password issued');
      userEvent('password_reset', a.user, user);
      return { temp_password: temp };
    },
    async setUserTabAccess(token, userId, overrides) {
      const a = need(token, ['users'], 'Edit');
      const user = get().users.find((x) => x.user_id === userId);
      if (!user) throw new ApiError('That user was not found.', 'not_found');
      requireAdminFor(a.user, user.role_id === 'ROLE-ADMIN', 'change the page access of an Admin');
      const clean: Partial<Access> = {};
      for (const [k, v] of Object.entries(overrides ?? {})) {
        if (!TAB_IDS.includes(k as TabId)) throw new ApiError(`There is no tab called "${k}".`, 'bad_request');
        if (v !== 'Hidden' && v !== 'View' && v !== 'Edit') throw new ApiError('Access must be Hidden, View or Edit.', 'bad_request');
        clean[k as TabId] = v;
      }
      if (user.user_id === a.user.user_id && (clean.users ?? roleLevel(user.role_id, 'users')) !== 'Edit') {
        throw new ApiError('You cannot take away your own access to Users.', 'conflict');
      }
      const was = user.overrides;
      user.overrides = clean;
      audit(a.user.user_id, 'set_tab_access', 'users', userId, TAB_IDS.filter((t) => was[t] !== clean[t])
        .map((t) => `${t}: ${was[t] ?? 'role default'} -> ${clean[t] ?? 'role default'}`).join('; ') || 'No change');
      return clone(adminUser(user));
    },

    // --- responsibilities (plant system, backend 2.0.0)
    async listResponsibilities(token) {
      need(token, ['users'], 'View');
      return clone(responsibilities.filter((r) => r.active).map(({ active: _a, ...r }) => r));
    },
    async getDispatchDays(token) {
      need(token, ['dispatch'], 'View');
      return clone(dispatchDays);
    },
    async uploadDispatchDays(token, days, fileName) {
      const a = need(token, ['dispatch'], 'Edit');
      if (!Array.isArray(days) || days.length === 0) throw new ApiError('The upload has no days.', 'bad_request');
      const have = new Set(dispatchDays.map((d) => d.date));
      const seen = new Set<string>();
      const dup: string[] = [];
      for (const d of days) {
        if (!isValidDate(d.date) || !Array.isArray(d.packers) || d.packers.length !== N_PACKERS) throw new ApiError(`Row ${String(d.date)} is not a valid day.`, 'bad_request');
        if (have.has(d.date) || seen.has(d.date)) dup.push(d.date);
        seen.add(d.date);
      }
      if (dup.length) {
        const shown = dup.slice(0, 5).join(', ');
        throw new ApiError(`Nothing was added: ${dup.length} date(s) are already in the app (${shown}${dup.length > 5 ? ', ...' : ''}). Dates are never replaced by an upload.`, 'duplicate_dates');
      }
      dispatchDays = [...dispatchDays, ...clone(days)].sort((x, y) => x.date.localeCompare(y.date));
      const sorted = [...seen].sort();
      audit(a.user.user_id, 'dispatch_upload', 'dispatch', fileName || 'workbook', `${days.length} days ${sorted[0]} to ${sorted[sorted.length - 1]}`);
      return { file_name: fileName, days_added: days.length, from: sorted[0]!, to: sorted[sorted.length - 1]! };
    },
    async getDispatchSettings(token) {
      need(token, ['dispatch'], 'View');
      return clone(dispatchSettings);
    },
    async saveDispatchSettings(token, settings) {
      const a = need(token, ['dispatch'], 'Edit');
      const ok = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
      const pct = (x: unknown) => x === null || (ok(x) && (x as number) <= 100);
      if (!Array.isArray(settings?.ratedTph) || settings.ratedTph.length !== N_PACKERS || !settings.ratedTph.every(ok)) throw new ApiError('Rated capacity must be six numbers, 0 or more.', 'bad_request');
      if (!Array.isArray(settings.monthlyTargetT) || settings.monthlyTargetT.length !== 12 || !settings.monthlyTargetT.every(ok)) throw new ApiError('Monthly targets must be twelve numbers, 0 or more.', 'bad_request');
      if (!pct(settings.availabilityTargetPct) || !pct(settings.noTrucksMaxPct)) throw new ApiError('Percentages must be between 0 and 100.', 'bad_request');
      dispatchSettings = clone(settings);
      audit(a.user.user_id, 'dispatch_settings', 'dispatch', 'targets', 'Dispatch & Packing targets saved');
      return clone(dispatchSettings);
    },
    async saveKpiTargets(token, save) {
      const a = auth(token);
      const d = get();
      const res = cleanTargetSave(save, kpiDefs, new Set(d.lines.map((l) => l.line_id)), new Set(d.areas.map((x) => x.area_id)));
      if ('problem' in res) throw new ApiError(res.problem, 'bad_request');
      const scopeId = save.scope_type === 'plant' ? '' : save.scope_id;
      const day = nowTs().slice(0, 10);
      const lineOf = save.scope_type === 'area' ? d.areas.find((x) => x.area_id === scopeId)?.line_id : undefined;
      const may = a.user.role_id === 'ROLE-ADMIN' || responsibilities.some((r) => r.user_id === a.user.user_id && r.active && r.duty === 'targets' &&
        (!r.valid_from || r.valid_from <= day) && (!r.valid_to || day <= r.valid_to) &&
        (r.scope_type === 'plant' || (r.scope_type === 'line' && (r.scope_id === scopeId || r.scope_id === lineOf)) || (r.scope_type === 'area' && save.scope_type === 'area' && r.scope_id === scopeId)));
      if (!may) throw new ApiError(`You do not hold the duty "Targets" for ${save.scope_type === 'plant' ? 'the plant' : scopeId}. An Admin can add it in Settings > Users > Responsibilities.`, 'forbidden');
      const same = (t: KpiTarget) => t.scope_type === save.scope_type && t.scope_id === scopeId && t.year === save.year;
      const stamp = nowTs();
      const before = kpiTargets.filter(same);
      const next: KpiTarget[] = res.rows.map((r) => {
        const old = before.find((b) => b.kpi_id === r.kpi_id && b.month === r.month);
        const unchanged = old && old.target_value === r.target_value && old.lower_limit === (r.lower_limit ?? null) && old.upper_limit === (r.upper_limit ?? null) && old.source === (r.source ?? '');
        return unchanged ? old : {
          scope_type: save.scope_type, scope_id: scopeId, kpi_id: r.kpi_id, year: save.year, month: r.month, target_value: r.target_value,
          lower_limit: r.lower_limit ?? null, upper_limit: r.upper_limit ?? null, source: r.source ?? '', updated_by: a.user.user_id, updated_at: stamp,
        };
      });
      const changed = next.length !== before.length || next.some((n) => !before.includes(n));
      if (changed) {
        kpiTargets = [...kpiTargets.filter((t) => !same(t)), ...next];
        audit(a.user.user_id, 'save_kpi_targets', 'kpi_targets', `${save.scope_type === 'plant' ? 'plant' : scopeId} ${save.year}`, `${next.length} targets`);
      }
      return clone(kpiTargets.filter(same));
    },
    async closeMonthStep(token, p) {
      const a = auth(token);
      const section = p?.section;
      if (!CLOSING_SECTIONS.includes(section)) throw new ApiError('Section must be downtime, production, quality or plant.', 'bad_request');
      const { year, month, step } = p;
      if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) throw new ApiError('Choose a month.', 'bad_request');
      if (!['review', 'signoff', 'reopen'].includes(step)) throw new ApiError('Step must be review, signoff or reopen.', 'bad_request');
      const comment = String(p.comment ?? '').trim().slice(0, 1000);
      const ym = monthKey(year, month);
      const today = nowTs().slice(0, 10);
      const name = new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      if (ym >= today.slice(0, 7)) throw new ApiError(`${name} has not ended yet. A month is closed after its last day.`, 'bad_request');
      const text = CLOSING_SECTION_TEXT[section];
      const holds = (duty: string) => a.user.role_id === 'ROLE-ADMIN' || responsibilities.some((r) => r.user_id === a.user.user_id && r.active && r.duty === duty && r.section === section &&
        (!r.valid_from || r.valid_from <= today) && (!r.valid_to || today <= r.valid_to));
      const dutyError = (what: string) => new ApiError(`You do not hold the duty "${what}" for ${text}. An Admin can add it in Settings > Users > Responsibilities.`, 'forbidden');
      const cur = closingOf(closings, section, year, month);
      const stamp = nowTs();
      const by = a.user.user_id;
      let next: MonthClosing;
      if (step === 'review') {
        if (section === 'plant') throw new ApiError('The plant report has no review step: the plant manager signs it off once the three sections are signed off.', 'bad_request');
        if (!holds('month_review')) throw dutyError('Month review');
        if (cur.status !== 'open' && cur.status !== 'reopened') throw new ApiError(`${text} ${name} is already ${cur.status === 'reviewed' ? 'reviewed' : 'signed off'}.`, 'conflict');
        let open: number | null = null;
        if (section === 'downtime') {
          open = get().events.filter((e) => !e.is_void && e.event_date.startsWith(ym)).filter((e) => {
            const kept = splitFlags(e.accepted_flags);
            return splitFlags(e.flags).some((f) => f !== 'code_not_in_area' && !kept.includes(f));
          }).length;
        }
        if (open && comment.length < CLOSING_REASON_MIN) {
          throw new ApiError(`${open} records of ${name} still need checking (Validate). Fix them, or say in the comment why the month can close (at least ${CLOSING_REASON_MIN} characters).`, 'bad_request');
        }
        next = { ...cur, status: 'reviewed', open_checks: open, reviewed_by: by, reviewed_at: stamp, review_comment: comment, signed_off_by: '', signed_off_at: '', signoff_comment: '' };
      } else if (step === 'signoff') {
        if (!holds('month_signoff')) throw dutyError('Month sign-off');
        if (section === 'plant') {
          if (cur.status === 'signed_off') throw new ApiError(`The plant report of ${name} is already signed off.`, 'conflict');
          const missing = (['downtime', 'production', 'quality'] as const).filter((x) => closingOf(closings, x, year, month).status !== 'signed_off');
          if (missing.length) throw new ApiError(`Sign off ${missing.map((x) => CLOSING_SECTION_TEXT[x]).join(', ')} of ${name} first.`, 'conflict');
        } else {
          if (cur.status !== 'reviewed') throw new ApiError(cur.status === 'signed_off' ? `${text} ${name} is already signed off.` : `The section engineer reviews ${name} first.`, 'conflict');
          if (cur.reviewed_by === by && a.user.role_id !== 'ROLE-ADMIN') throw new ApiError('You reviewed this month: another person (the section manager) signs it off.', 'forbidden');
        }
        next = { ...cur, status: 'signed_off', signed_off_by: by, signed_off_at: stamp, signoff_comment: comment };
      } else {
        if (!holds('month_signoff')) throw dutyError('Month sign-off');
        if (cur.status !== 'signed_off') throw new ApiError('Only a signed-off month can be reopened.', 'conflict');
        if (comment.length < CLOSING_REASON_MIN) throw new ApiError(`Say why the month is reopened (at least ${CLOSING_REASON_MIN} characters).`, 'bad_request');
        next = { ...cur, status: 'reopened', reopened_by: by, reopened_at: stamp, reopen_reason: comment, reviewed_by: '', reviewed_at: '', review_comment: '', signed_off_by: '', signed_off_at: '', signoff_comment: '' };
      }
      next.updated_at = stamp;
      const at = closings.findIndex((c) => c.section === section && c.year === year && c.month === month);
      if (at >= 0) closings[at] = next; else closings.push(next);
      audit(by, `month_${step}`, 'month_closings', `${section} ${ym}`, comment ? `Comment: ${comment}` : '');
      return clone(next);
    },
    async listQualityParameters(token) {
      auth(token);
      return clone(qualityParams.slice().sort((x, y) => x.sort_order - y.sort_order));
    },
    async saveQualityLimits(token, rows) {
      const a = auth(token);
      if (!Array.isArray(rows) || !rows.length) throw new ApiError('Send at least one parameter.', 'bad_request');
      const d = get();
      const day = nowTs().slice(0, 10);
      const seen = new Set<string>();
      const plan = rows.map((r) => {
        const cur = qualityParams.find((p) => p.param_id === r.param_id);
        if (!cur) throw new ApiError(`There is no quality parameter ${String(r.param_id).slice(0, 60)}.`, 'bad_request');
        if (seen.has(cur.param_id)) throw new ApiError(`${cur.param_id} is listed twice.`, 'bad_request');
        seen.add(cur.param_id);
        const area = d.areas.find((x) => x.area_id === cur.area_id);
        const may = a.user.role_id === 'ROLE-ADMIN' || responsibilities.some((x) => x.user_id === a.user.user_id && x.active && x.duty === 'quality_validation' &&
          (!x.valid_from || x.valid_from <= day) && (!x.valid_to || day <= x.valid_to) &&
          (x.scope_type === 'plant' || (x.scope_type === 'line' && x.scope_id === area?.line_id) || (x.scope_type === 'area' && x.scope_id === cur.area_id)));
        if (!may) throw new ApiError(`You do not hold the duty "Quality validation" for ${cur.area_id}. An Admin can add it in Settings > Users > Responsibilities.`, 'forbidden');
        const next = { ...r, active: r.active !== false, notes: (r.notes ?? '').trim().slice(0, 300) };
        const problem = limitProblem({ ...cur, ...next });
        if (problem) throw new ApiError(problem, 'bad_request');
        return { cur, next, changed: changedLimitFields(cur, next) };
      }).filter((x) => x.changed.length);
      const stamp = nowTs();
      for (const x of plan) Object.assign(x.cur, x.next, { updated_by: a.user.user_id, updated_at: stamp });
      if (plan.length) audit(a.user.user_id, 'save_quality_limits', 'quality_parameters', plan.map((x) => x.cur.param_id).join(','), plan.map((x) => `${x.cur.param_id} ${x.changed.join(', ')}`).join('; '));
      return clone(qualityParams.slice().sort((x, y) => x.sort_order - y.sort_order));
    },
    async listMyResponsibilities(token) {
      const a = auth(token);
      return clone(responsibilities.filter((r) => r.active && r.user_id === a.user.user_id).map(({ active: _a, ...r }) => r));
    },
    async saveResponsibilities(token, userId, rows) {
      const a = need(token, ['users'], 'Edit');
      if (!Array.isArray(rows)) throw new ApiError('Responsibilities must be a list.', 'bad_request');
      const d = get();
      const problem = validateSet(rows, new Set(d.lines.map((l) => l.line_id)), new Set(d.areas.map((x) => x.area_id)));
      if (problem) throw new ApiError(problem, 'bad_request');
      const user = d.users.find((x) => x.user_id === userId);
      if (!user) throw new ApiError('That user was not found.', 'not_found');
      requireAdminFor(a.user, user.role_id === 'ROLE-ADMIN', 'change the responsibilities of an Admin');
      const full = (r: { valid_from?: string; valid_to?: string } & Parameters<typeof respKey>[0]) => `${respKey(r)}|${r.valid_from ?? ''}|${r.valid_to ?? ''}`;
      const clean = rows.map((r) => ({ ...r, section: r.section ?? '', scope_id: r.scope_type === 'plant' ? '' : (r.scope_id ?? '').trim(), is_backup: r.is_backup === true, valid_from: r.valid_from ?? '', valid_to: r.valid_to ?? '' }));
      const mine = responsibilities.filter((r) => r.user_id === userId && r.active);
      const after = new Set(clean.map(full));
      const before = new Set(mine.map(full));
      const stamp = nowTs();
      const removed = mine.filter((r) => !after.has(full(r)));
      removed.forEach((r) => { r.active = false; r.updated_by = a.user.user_id; r.updated_at = stamp; });
      const added = clean.filter((r) => !before.has(full(r)));
      for (const r of added) responsibilities.push({ ...r, resp_id: `RS-${String(++counter).padStart(6, '0')}`, user_id: userId, active: true, updated_by: a.user.user_id, updated_at: stamp });
      const label = (r: typeof clean[number]) => `${r.duty}${r.section ? ` (${r.section})` : ''} @ ${r.scope_type === 'plant' ? 'plant' : r.scope_id}${r.is_backup ? ' backup' : ''}${r.valid_from || r.valid_to ? ` ${r.valid_from || '...'}..${r.valid_to || '...'}` : ''}`;
      audit(a.user.user_id, 'set_responsibilities', 'users', userId, [...added.map((r) => `+ ${label(r)}`), ...removed.map((r) => `- ${label(r)}`)].join('; ') || 'No change');
      return clone(responsibilities.filter((r) => r.user_id === userId && r.active).map(({ active: _a, ...r }) => r));
    },

    // --- shift reports (plant system, backend 2.1.0; mirrors ShiftReports.js)
    async listShiftReports(token, from, to) {
      need(token, ['shift', 'daily'], 'View');
      if (!isValidDate(from) || !isValidDate(to) || to < from) throw new ApiError('Choose a valid date range.', 'bad_request');
      if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 62) throw new ApiError('Choose at most 62 days.', 'bad_request');
      const reports = shiftReports.filter((r) => r.report_date >= from && r.report_date <= to);
      const ids = new Set(reports.map((r) => r.report_id));
      const stops = shiftStops.filter((s) => s.row_state === 'active' && (ids.has(s.report_id) || ids.has(s.closed_report_id) || s.stop_state === 'open'));
      for (const s of stops) if (!ids.has(s.report_id)) { const r = shiftReports.find((x) => x.report_id === s.report_id); if (r) { reports.push(r); ids.add(r.report_id); } }
      const people: Record<string, string> = {};
      for (const u of get().users) people[u.user_id] = u.display_name;
      return clone({ shifts: DEFAULT_SHIFTS, reports, stoppages: stops, people });
    },
    async getShiftReportHistory(token, reportId) {
      need(token, ['shift', 'daily'], 'View');
      if (!shiftReports.some((r) => r.report_id === reportId)) throw new ApiError('That shift report was not found.', 'not_found');
      return clone({ log: shiftLog.filter((l) => l.at && shiftLogReport.get(l.log_id) === reportId), edits: shiftEdits.filter((e) => shiftEditReport.get(e.edit_id) === reportId) });
    },
    async saveShiftReport(token, input) {
      const a = need(token, ['shift'], 'Edit');
      if (!input || typeof input !== 'object') throw new ApiError('The report is missing.', 'bad_request');
      const day = String(input.report_date ?? '');
      if (!isValidDate(day)) throw new ApiError('Choose the report date.', 'bad_request');
      const def = shiftDef(String(input.shift_id ?? ''));
      const win = shiftWindow(def, day);
      if (win.start > nowTs()) throw new ApiError('This shift has not started yet.', 'bad_request');
      const list = Array.isArray(input.stoppages) ? input.stoppages : [];
      const area = get().areas.find((x) => x.area_id === input.area_id);
      if (!area) throw new ApiError(`There is no area ${String(input.area_id).slice(0, 40)}.`, 'bad_request');
      if (area.active === false) throw new ApiError(`Area ${area.area_id} is switched off.`, 'bad_request');
      requireShiftDuty(a.user, 'shift_entry', area, day);
      const id = reportIdOf(day, def.shift_id, area.area_id);
      let rep = shiftReports.find((r) => r.report_id === id);
      const stamp = nowTs();
      if (rep && rep.status !== 'draft' && rep.status !== 'returned') throw new ApiError(`This report is ${rep.status.replace('_', ' ')} and can no longer be changed by the shift leader.`, 'conflict');
      const cleaned = list.map((s) => ({ input: s, clean: cleanShiftStop(s, area, win, true) }));
      if (!rep) {
        rep = blankReport(id, day, def.shift_id, area.area_id, area.line_id, a.user.user_id, stamp);
        shiftReports.push(rep);
        logShift(id, 'create', '', 'draft', 'entry', a.user.user_id, '');
      }
      const mine = shiftStops.filter((s) => s.report_id === id && s.row_state === 'active');
      const keep = new Set<string>();
      let added = 0, changed = 0, removed = 0;
      for (const { input: s, clean } of cleaned) {
        if (s.stop_id) {
          const old = mine.find((x) => x.stop_id === s.stop_id);
          if (!old) throw new ApiError(`Stoppage ${s.stop_id.slice(0, 30)} is not in this report.`, 'bad_request');
          if (keep.has(s.stop_id)) throw new ApiError(`Stoppage ${s.stop_id.slice(0, 30)} is listed twice.`, 'bad_request');
          keep.add(s.stop_id);
          if (old.closed_report_id && old.closed_report_id !== id) { clean.start_ts = old.start_ts; clean.duration_s = old.duration_s; clean.stop_state = old.stop_state; }
          if (SHIFT_STOP_FIELDS.some((f) => String(old[f] ?? '') !== String(clean[f] ?? ''))) {
            if (rep.status === 'returned') logStopEdits(old, id, 'entry', clean, a.user.user_id, 'Changed after return');
            Object.assign(old, clean, { updated_by: a.user.user_id, updated_at: stamp });
            changed++;
          }
        } else {
          shiftStops.push({ ...blankStop(), ...clean, stop_id: `SS-${(++shiftCounter).toString(16).padStart(10, '0')}`, report_id: id, row_state: 'active', created_by: a.user.user_id, created_at: stamp });
          added++;
        }
      }
      for (const s of mine) {
        if (keep.has(s.stop_id)) continue;
        if (s.closed_report_id && s.closed_report_id !== id) throw new ApiError(`The stoppage at ${s.stop_ts.slice(0, 16)} was closed by a later shift and cannot be removed here.`, 'conflict');
        s.row_state = 'deleted'; s.updated_by = a.user.user_id; s.updated_at = stamp; removed++;
      }
      rep.notes = String(input.notes ?? '').trim(); rep.updated_by = a.user.user_id; rep.updated_at = stamp;
      const detail = `Added ${added}, changed ${changed}, removed ${removed}`;
      if (input.submit === true) {
        requireNoBlocking(shiftStops.filter((s) => s.row_state === 'active' && (s.report_id === id || s.closed_report_id === id)));
        logShift(id, 'submit', rep.status, 'submitted', 'entry', a.user.user_id, '');
        rep.status = 'submitted'; rep.submitted_by = a.user.user_id; rep.submitted_at = stamp;
        audit(a.user.user_id, 'shift_report_submit', 'shift_reports', id, detail);
      } else audit(a.user.user_id, 'shift_report_save', 'shift_reports', id, detail);
      return shiftBundle(id);
    },
    async closeShiftStoppage(token, input) {
      const a = need(token, ['shift'], 'Edit');
      if (!input || typeof input !== 'object') throw new ApiError('The restart is missing.', 'bad_request');
      const day = String(input.report_date ?? '');
      if (!isValidDate(day)) throw new ApiError('Choose the date of your shift.', 'bad_request');
      const def = shiftDef(String(input.shift_id ?? ''));
      const win = shiftWindow(def, day);
      const start = shiftTs(input.start_ts, 'Restart time');
      if (!start) throw new ApiError('Enter the restart time.', 'bad_request');
      if (start > nowTs()) throw new ApiError(`Restart time ${start.slice(0, 16)} is in the future.`, 'bad_request');
      if (start < win.start || start > win.end) throw new ApiError(`Restart time ${start.slice(0, 16)} is outside your shift (${win.start.slice(0, 16)} to ${win.end.slice(0, 16)}).`, 'bad_request');
      const s = shiftStops.find((x) => x.stop_id === input.stop_id && x.row_state === 'active');
      if (!s) throw new ApiError('That stoppage was not found.', 'not_found');
      const area = get().areas.find((x) => x.area_id === s.area_id)!;
      requireShiftDuty(a.user, 'shift_entry', area, day);
      const id = reportIdOf(day, def.shift_id, area.area_id);
      if (id === s.report_id) throw new ApiError('This stoppage belongs to this shift: enter its restart time in the report itself.', 'bad_request');
      if (s.stop_state !== 'open' && s.closed_report_id !== id) throw new ApiError('This stoppage already has its restart time.', 'conflict');
      if (start < s.stop_ts) throw new ApiError(`The restart time is before the stop time (${s.stop_ts.slice(0, 16)}).`, 'bad_request');
      let rep = shiftReports.find((r) => r.report_id === id);
      const stamp = nowTs();
      if (rep && rep.status !== 'draft' && rep.status !== 'returned') throw new ApiError(`Your report for this shift is already ${rep.status.replace('_', ' ')}.`, 'conflict');
      if (!rep) {
        rep = blankReport(id, day, def.shift_id, area.area_id, area.line_id, a.user.user_id, stamp);
        shiftReports.push(rep);
        logShift(id, 'create', '', 'draft', 'entry', a.user.user_id, '');
      }
      logStopEdits(s, id, 'entry', { ...s, start_ts: start }, a.user.user_id, 'Restart entered by a later shift');
      Object.assign(s, { start_ts: start, duration_s: (msOfTs(start) - msOfTs(s.stop_ts)) / 1000, stop_state: 'closed', closed_report_id: id, closed_by: a.user.user_id, closed_at: stamp, updated_by: a.user.user_id, updated_at: stamp });
      audit(a.user.user_id, 'shift_stoppage_close', 'shift_stoppages', s.stop_id, `Restart ${start.slice(0, 16)} in ${id}`);
      return shiftBundle(id);
    },
    async reviewShiftReport(token, input) {
      const a = need(token, ['shift'], 'Edit');
      if (!input || typeof input !== 'object') throw new ApiError('The review is missing.', 'bad_request');
      const decision = input.decision;
      if (!['approve', 'return', 'validate'].includes(decision)) throw new ApiError('Decision must be approve, return or validate.', 'bad_request');
      const comment = String(input.comment ?? '').trim();
      if (decision === 'return' && comment.length < 3) throw new ApiError('Say why the report is returned (at least 3 characters).', 'bad_request');
      const rep = shiftReports.find((r) => r.report_id === input.report_id);
      if (!rep) throw new ApiError('That shift report was not found.', 'not_found');
      const area = get().areas.find((x) => x.area_id === rep.area_id)!;
      let stage: ShiftStage;
      if (rep.status === 'submitted') {
        stage = 'production';
        if (decision === 'validate') throw new ApiError('This report waits for production review first.', 'conflict');
        requireShiftDuty(a.user, 'production_review', area, rep.report_date);
        if (a.user.role_id !== 'ROLE-ADMIN' && (rep.entered_by === a.user.user_id || rep.submitted_by === a.user.user_id)) throw new ApiError('You entered this report, so someone else must review it.', 'forbidden');
      } else if (rep.status === 'prod_approved') {
        stage = 'reliability';
        if (decision === 'approve') throw new ApiError('This report is already approved by production; validate or return it.', 'conflict');
        requireShiftDuty(a.user, 'reliability_validation', area, rep.report_date);
      } else throw new ApiError(`This report is ${rep.status.replace('_', ' ')} and is not waiting for a review.`, 'conflict');
      const stops = shiftStops.filter((s) => s.row_state === 'active' && (s.report_id === rep.report_id || s.closed_report_id === rep.report_id));
      const stamp = nowTs();
      const plans: { s: ShiftStoppage; clean: ReturnType<typeof cleanShiftStop> }[] = [];
      for (const e of Array.isArray(input.edits) ? input.edits : []) {
        const s = stops.find((x) => x.stop_id === e.stop_id);
        if (!s) throw new ApiError(`Stoppage ${String(e.stop_id).slice(0, 30)} is not part of this report.`, 'bad_request');
        const keys = Object.keys(e.changes ?? {});
        for (const f of keys) if (!SHIFT_STOP_FIELDS.includes(f as ShiftStopField)) throw new ApiError(`Field ${f.slice(0, 30)} cannot be changed.`, 'bad_request');
        if (s.report_id !== rep.report_id && keys.some((f) => f !== 'start_ts')) throw new ApiError('Only the restart time of a stoppage from an earlier shift can be changed here.', 'bad_request');
        const merged = Object.fromEntries(SHIFT_STOP_FIELDS.map((f) => [f, keys.includes(f) ? (e.changes as Record<string, unknown>)[f] : s[f]])) as Record<ShiftStopField, unknown>;
        const clean = cleanShiftStop({ ...merged, is_failure: merged.is_failure === true } as never, area, null, false);
        if (s.closed_report_id && s.closed_report_id !== s.report_id && !clean.start_ts) throw new ApiError('A restart entered by a later shift cannot be removed; correct it instead.', 'bad_request');
        plans.push({ s, clean });
      }
      for (const { s, clean } of plans) {
        logStopEdits(s, rep.report_id, stage, clean, a.user.user_id, comment);
        Object.assign(s, clean, { updated_by: a.user.user_id, updated_at: stamp });
        if (clean.stop_state === 'open') Object.assign(s, { closed_report_id: '', closed_by: '', closed_at: '' });
      }
      const from = rep.status;
      if (decision === 'return') {
        rep.status = stage === 'production' ? 'returned' : 'submitted';
        Object.assign(rep, { returned_by: a.user.user_id, returned_at: stamp, return_stage: stage, return_comment: comment });
      } else if (decision === 'approve') {
        requireNoBlocking(stops);
        Object.assign(rep, { status: 'prod_approved', prod_reviewed_by: a.user.user_id, prod_reviewed_at: stamp });
      } else {
        requireNoBlocking(stops);
        Object.assign(rep, { status: 'validated', rel_validated_by: a.user.user_id, rel_validated_at: stamp });
      }
      rep.updated_by = a.user.user_id; rep.updated_at = stamp;
      logShift(rep.report_id, decision, from, rep.status, stage, a.user.user_id, comment);
      const posted = decision === 'validate' ? postReadyStops(a.user.user_id) : 0;
      audit(a.user.user_id, `shift_report_${decision}`, 'shift_reports', rep.report_id, `${plans.length ? `${plans.length} change(s). ` : ''}${decision === 'validate' ? `${posted} stoppage(s) posted. ` : ''}${comment}`);
      return shiftBundle(rep.report_id);
    },

    // --- notifications
    async getNotifications(token) {
      const a = auth(token);
      seedDemoActions();
      if (!notifSeeded) runChecks();
      const stamp = nowTs();
      const inactive = inactiveAreas();
      const items = notifications.filter((n) => notifVisible(n, a.access, stamp, a.user) && !ofInactiveArea(n, inactive))
        .sort((x, y) => (x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1 : x.notification_id < y.notification_id ? -1 : 1));
      const ids = new Set(items.map((n) => n.notification_id));
      return clone({
        items: items.map((n) => ({ ...n, category: NOTIFICATION_CATEGORY_OF[n.type] })),
        state: notifState.filter((s) => s.user_id === a.user.user_id && ids.has(s.notification_id)), prefs: prefsOf(a.user.user_id),
      });
    },
    async setNotificationState(token, notificationId, state, snoozeUntil) {
      const a = auth(token);
      if (!notifSeeded) runChecks();
      const id = String(notificationId ?? '').trim();
      if (!id) throw new ApiError('Notification is required.', 'bad_request');
      if (state !== 'seen' && state !== 'snoozed' && state !== 'dismissed') throw new ApiError('State must be seen, snoozed or dismissed.', 'bad_request');
      let until = '';
      if (state === 'snoozed') {
        if (typeof snoozeUntil !== 'string' || !snoozeUntil.trim()) throw new ApiError('Choose how long to snooze.', 'bad_request');
        const raw = snoozeUntil.trim();
        const full = isValidDate(raw) ? `${raw} 00:00:00.000` : raw;
        const ms = parseTs(full);
        if (ms === null) throw new ApiError('The snooze time is not valid.', 'bad_request');
        until = fmtTs(ms);
        if (until <= tsAt(now())) throw new ApiError('The snooze time must be in the future.', 'bad_request');
        if (until > tsAt(now() + SNOOZE_MAX_DAYS * 86_400_000)) throw new ApiError('The snooze time is too far ahead.', 'bad_request');
      }
      const n = notifications.find((x) => x.notification_id === id);
      if (!n || !notifVisible(n, a.access, nowTs(), a.user)) throw new ApiError('Notification not found.', 'not_found');
      const rec: NotificationState = { user_id: a.user.user_id, notification_id: id, state, snooze_until: until, updated_at: nowTs() };
      const at = notifState.findIndex((s) => s.user_id === rec.user_id && s.notification_id === id);
      if (at >= 0) notifState[at] = rec; else notifState.push(rec);
      return clone(rec);
    },
    async saveNotificationPrefs(token, prefs) {
      const a = auth(token);
      if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) throw new ApiError('Preferences are missing.', 'bad_request');
      const keys = Object.keys(prefs);
      if (!keys.length) throw new ApiError('No changes to save.', 'bad_request');
      const csv = (v: string): string[] => v.split(',').map((x) => x.trim()).filter(Boolean);
      const clean: Record<string, string> = {};
      for (const k of keys) {
        const raw = (prefs as Record<string, unknown>)[k];
        if (!['alert_types', 'watch_areas', 'digest', 'last_seen_at', 'saved_views', 'saved_reports', 'theme'].includes(k)) throw new ApiError(`Unknown preference: ${oneLine(k, 40)}.`, 'bad_request');
        if (typeof raw !== 'string') throw new ApiError(`Preference ${k} must be text.`, 'bad_request');
        const v = raw.trim();
        if (k === 'digest') {
          if (!['none', 'daily', 'weekly'].includes(v)) throw new ApiError('Digest must be none, daily or weekly.', 'bad_request');
          clean[k] = v;
        } else if (k === 'alert_types') {
          const picked: string[] = [];
          for (const t of csv(v)) {
            if (!(NOTIFICATION_TYPES as string[]).includes(t)) throw new ApiError(`Unknown alert type: ${oneLine(t, 40)}.`, 'bad_request');
            if (!picked.includes(t)) picked.push(t);
          }
          clean[k] = picked.join(',');
        } else if (k === 'watch_areas') {
          const chosen: string[] = [];
          for (const ar of csv(v)) {
            const real = get().areas.find((x) => x.area_id.toLowerCase() === ar.toLowerCase());
            if (!real) throw new ApiError(`Area "${oneLine(ar, 40)}" is not in the list of areas.`, 'bad_request');
            if (!chosen.includes(real.area_id)) chosen.push(real.area_id);
          }
          clean[k] = chosen.join(',');
        } else if (k === 'theme') {
          if (v !== '' && !THEME_NAMES.includes(v)) throw new ApiError(`Theme must be one of: ${THEME_NAMES.join(', ')}.`, 'bad_request');
          clean[k] = v;
        } else if (k === 'saved_views') {
          clean[k] = cleanSavedViews(v);
        } else if (k === 'saved_reports') {
          clean[k] = cleanSavedReports(v);
        } else {
          const ms = parseTs(v);
          if (ms === null) throw new ApiError('Last seen must be a time like 2026-03-05 10:00:00.000.', 'bad_request');
          clean[k] = fmtTs(ms);
        }
      }
      if (opts.keepAccountThemes && clean.theme !== undefined) writeKeptTheme(a.user.user_id, clean.theme);
      for (const [k, value] of Object.entries(clean)) {
        const rec = { user_id: a.user.user_id, key: k, value, updated_at: nowTs() };
        const at = notifPrefs.findIndex((r) => r.user_id === rec.user_id && r.key === k);
        if (at >= 0) notifPrefs[at] = rec; else notifPrefs.push(rec);
      }
      return prefsOf(a.user.user_id);
    },
    async runNotificationChecks(token) {
      const a = need(token, ['settings'], 'Edit');
      const res = runChecks();
      safely(() => { actionStore.runChecks(); });
      audit(a.user.user_id, 'notification_check', 'notifications', '', `Created ${res.created}, resolved ${res.resolved}, expired ${res.expired}`);
      return res;
    },

    // --- actions
    async listActions(token) {
      const a = need(token, ['actions'], 'View');
      seedDemoActions();
      return actionStore.list(a.user);
    },
    async createAction(token, input, options) {
      const a = need(token, ['actions'], 'Edit');
      return actionStore.create(a.user, input, options);
    },
    async updateAction(token, actionId, changes) {
      const a = need(token, ['actions'], 'Edit');
      return actionStore.update(a.user, actionId, changes);
    },
    async addActionComment(token, actionId, text) {
      const a = need(token, ['actions'], 'Edit');
      return actionStore.comment(a.user, actionId, text);
    },
    async saveContractors(token, rows) {
      const a = need(token, ['settings'], 'Edit');
      return actionStore.saveContractors(a.user, rows);
    },
    async getAreaTargets(token, year) {
      auth(token);
      seedDemoActions();
      return actionStore.getTargets(year);
    },
    async saveAreaTargets(token, year, rows) {
      const a = need(token, ['settings'], 'Edit');
      return actionStore.saveTargets(a.user, year, rows);
    },
    async runActionChecks(token) {
      const a = need(token, ['settings'], 'Edit');
      const res = actionStore.runChecks();
      audit(a.user.user_id, 'action_check', 'actions', '', `Created ${res.created}, merged ${res.merged}, effectiveness ${res.effectiveness}`);
      return res;
    },
    // --- tasks inside actions (backend 1.7.0)
    async addTask(token, actionId, task) {
      const a = need(token, ['actions'], 'Edit');
      return actionStore.addTask(a.user, actionId, task);
    },
    async updateTask(token, taskId, changes) {
      const a = need(token, ['actions'], 'Edit');
      return actionStore.updateTask(a.user, taskId, changes);
    },
    async applyTemplate(token, actionId, templateId) {
      const a = need(token, ['actions'], 'Edit');
      return actionStore.applyTemplate(a.user, actionId, templateId);
    },
    async listTasks(token, filter) {
      const a = need(token, ['actions'], 'View');
      seedDemoActions();
      return actionStore.listTasks(a.user, filter ?? {});
    },
    async listTaskTemplates(token) {
      auth(token);
      return actionStore.listTemplates();
    },
    async saveTaskTemplates(token, templates) {
      const a = need(token, ['settings'], 'Edit');
      return actionStore.saveTemplates(a.user, templates);
    },

    // --- admin only (backend 1.6.0)
    async listActiveUsers(token) {
      needAdmin(token);
      const nowMs = now();
      const nowText = tsOf(nowMs);
      const pNow = parseTs(nowText) ?? 0;
      const today = nowText.slice(0, 10);
      const users: ActiveUser[] = get().users.map((u) => {
        const act = activity.get(u.user_id);
        const demo = demoSeen.get(u.user_id);
        let seenMs = act?.s ?? 0;
        let page = act?.p ?? '';
        let device: DeviceKind | '' = act?.d ?? '';
        if (demo && nowMs - demo.ago > seenMs) { seenMs = nowMs - demo.ago; page = demo.p; device = demo.d; }
        let seen = seenMs ? tsOf(seenMs) : '';
        if (u.last_login_at && u.last_login_at > seen) seen = u.last_login_at;
        const t = seen ? parseTs(seen) : null;
        return {
          user_id: u.user_id, display_name: u.display_name, role_id: u.role_id, active: u.active,
          last_seen_at: seen, last_page: page, device,
          online: u.active && t !== null && pNow - t <= ACTIVITY_ONLINE_MS && pNow - t >= -60_000,
          today: u.active && seen.slice(0, 10) === today,
        };
      }).sort((x, y) => (x.online !== y.online ? (x.online ? -1 : 1)
        : x.last_seen_at !== y.last_seen_at ? (x.last_seen_at < y.last_seen_at ? 1 : -1) : x.display_name.localeCompare(y.display_name)));
      return clone({
        now: nowText, online_minutes: ACTIVITY_ONLINE_MS / 60_000, users,
        online_count: users.filter((u) => u.online).length, today_count: users.filter((u) => u.today).length,
      });
    },
    // --- email (backend/apps-script/Mail.js): checked like the server, kept in memory, never sent
    async sendReport(token, email) {
      const a = auth(token);
      if (a.user.role_id !== 'ROLE-ADMIN' && LEVEL_RANK[a.access.reports] < LEVEL_RANK.Edit) throw new ApiError('You do not have access to do this.', 'forbidden', true);
      const bad = (m: string) => new ApiError(m, 'bad_request');
      const list = (xs: unknown, label: string, min: number) => {
        if (xs !== undefined && xs !== null && !Array.isArray(xs)) throw bad(`${label} must be a list of email addresses.`);
        const out: string[] = [];
        for (const x of (xs as unknown[] | undefined) ?? []) {
          const e = String(x ?? '').trim().toLowerCase();
          if (!e) continue;
          if (e.length > 254 || !MAIL_RE.test(e) || /[<>,;"\s]/.test(e)) throw bad(`${label}: "${e.slice(0, 60)}" is not a valid email address.`);
          if (!out.includes(e)) out.push(e);
        }
        if (out.length < min) throw bad('Add at least one recipient.');
        if (out.length > 25) throw bad(`${label}: at most 25 addresses.`);
        return out;
      };
      const picked = (email?.users ?? []).map((id) => {
        const u = get().users.find((x) => x.user_id === id);
        if (!u || !u.active || !MAIL_RE.test(u.email)) throw bad(`There is no active user ${String(id).slice(0, 40)} with an email address.`);
        return u.email.toLowerCase();
      });
      const to = list([...(email?.to ?? []), ...picked], 'To', 1);
      const cc = list(email?.cc, 'Cc', 0).filter((e) => !to.includes(e));
      const subject = String(email?.subject ?? '').trim();
      if (!subject) throw bad('The subject is required.');
      if (subject.length > 200) throw bad('The subject is too long.');
      const atts = email?.attachments ?? [];
      if (atts.length > 3) throw bad('At most 3 attachments.');
      let total = 0;
      for (const f of atts) {
        if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'].includes(f.mimeType)) throw bad('Only PDF, Excel and CSV files can be attached.');
        total += Math.floor(f.base64.length * 3 / 4);
      }
      if (total > 15 * 1024 * 1024) throw bad('The attachments are larger than 15 MB together.');
      const today = nowTs().slice(0, 10);
      const count = mailCount.get(a.user.user_id);
      const n = count && count.day === today ? count.n : 0;
      if (n >= 30) throw bad(`You have sent ${n} emails today, the most allowed in one day. Try again tomorrow.`);
      mailCount.set(a.user.user_id, { day: today, n: n + 1 });
      const from = mailFrom();
      sentMail.push({ from: from.from, to, cc, subject, html: String(email?.html ?? ''), attachments: atts.map((f) => ({ name: f.name, mimeType: f.mimeType, bytes: Math.floor(f.base64.length * 3 / 4), base64: f.base64 })), by: a.user.user_id });
      const r = to.length + cc.length;
      audit(a.user.user_id, 'send_report', '', email?.kind === 'actions' ? 'actions' : 'report',
        `${email?.kind === 'actions' ? 'Actions report' : 'Report'} to ${r} recipient${r === 1 ? '' : 's'}: ${subject}${atts.length ? ` (${atts.map((f) => f.name).join(', ')})` : ''}`);
      return { ...from, recipients: r };
    },
    async sendTestEmail(token) {
      const a = needAdmin(token);
      const from = mailFrom();
      sentMail.push({ from: from.from, to: [a.user.email], cc: [], subject: 'ACC Downtime Analysis: test email', html: '<p>This is a test email.</p>', attachments: [], by: a.user.user_id });
      audit(a.user.user_id, 'send_test_email', '', '', `Test email to ${a.user.email} (${from.via})`);
      return { ...from, to: a.user.email };
    },

    async listAuditLog(token, filter, cursor) {
      needAdmin(token);
      const bad = (m: string) => new ApiError(m, 'bad_request');
      const f = (filter ?? {}) as Record<string, unknown>;
      if (typeof f !== 'object' || Array.isArray(f)) throw bad('Filter is missing.');
      for (const k of Object.keys(f)) if (!['user_id', 'group', 'from', 'to', 'q', 'limit'].includes(k)) throw bad(`Filter has an unknown field: ${oneLine(k, 40)}.`);
      const userId = typeof f.user_id === 'string' ? f.user_id.trim() : '';
      const group = f.group === undefined || f.group === null || f.group === '' ? '' : String(f.group);
      if (group && !(AUDIT_GROUPS as readonly string[]).includes(group)) throw bad('Unknown kind of change.');
      const from = f.from ? String(f.from) : '';
      const to = f.to ? String(f.to) : '';
      if ((from && !isValidDate(from)) || (to && !isValidDate(to))) throw bad('Dates must look like 2026-10-14.');
      if (from && to && from > to) throw bad('The start date is after the end date.');
      const q = typeof f.q === 'string' ? f.q.trim().toLowerCase() : '';
      if (q.length > 100) throw bad('Search text is too long.');
      const limit = f.limit === undefined || f.limit === null ? 100 : f.limit;
      if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 200) throw bad('Page size must be a whole number from 1 to 200.');
      let start: number | null = null;
      if (cursor !== undefined && cursor !== null && cursor !== '') {
        const m = /^r(\d{1,9})$/.exec(String(cursor));
        if (!m) throw bad('The page marker is not valid. Start again from the top.');
        start = Number(m[1]) - 2;
      }
      const log = get().audit_log;
      const names = new Map(get().users.map((u) => [u.user_id, u.display_name.toLowerCase()]));
      const minAt = from ? `${from} 00:00:00.000` : '';
      const maxAt = to ? `${to} 23:59:59.999` : '';
      const actions = group && group !== 'system' ? AUDIT_GROUP_ACTIONS[group as AuditGroup] : null;
      const entries: AuditEntry[] = [];
      let i = start === null ? log.length - 1 : Math.min(start, log.length - 1);
      let scanned = 0;
      for (; i >= 0 && entries.length < limit && scanned < 20_000; i--) {
        const e = log[i]!;
        scanned++;
        if (minAt && e.at < minAt) { i = -1; break; }
        if (maxAt && e.at > maxAt) continue;
        if (userId && e.user_id !== userId) continue;
        if (group === 'system' ? auditGroupOf(e.action) !== 'system' : actions && !actions.includes(e.action)) continue;
        if (q && ![e.action, e.entity, e.entity_id, e.detail, e.user_id, names.get(e.user_id ?? '') ?? ''].join(' ').toLowerCase().includes(q)) continue;
        entries.push({
          at: e.at, user_id: e.user_id ?? '', action: e.action, entity: e.entity ?? '', entity_id: e.entity_id ?? '', detail: e.detail ?? '',
          group: auditGroupOf(e.action),
        });
      }
      return clone({
        entries, next_cursor: i >= 0 ? `r${i + 2}` : null, scanned,
        users: get().users.map((u) => ({ user_id: u.user_id, display_name: u.display_name })),
      });
    },
  };
  return api;
}

export const mockApi: MockApi = createMockApi({ demoActions: true, keepAccountThemes: true });
// demo mode only: the end-to-end tests read what the mock 'sent' (nothing leaves the browser)
if (typeof window !== 'undefined') (window as unknown as { __accSentMail?: () => SentMockMail[] }).__accSentMail = () => mockApi.__sentMail();
