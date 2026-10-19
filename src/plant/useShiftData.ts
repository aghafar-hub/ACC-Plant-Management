// Loading for the Shift reports and Daily meeting pages (backend 2.1.0): the reports of a date range (with every open
// stoppage) and the signed-in person's own duties. Writes return the changed report; the pages simply reload after one.
import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { Responsibility } from './responsibilities';
import { covers, inForce } from './responsibilities';
import { addDays, shiftWindow, type ShiftDef, type ShiftList } from './shift';

export function useShiftData(from: string, to: string) {
  const { token } = useAuth();
  const [data, setData] = useState<ShiftList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    api.listShiftReports(token, from, to).then(
      (d) => { if (live) { setData(d); setError(null); setLoading(false); } },
      (e) => { if (live) { setError(describeError(e)); setLoading(false); } },
    );
    return () => { live = false; };
  }, [token, from, to, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { data, error, loading, reload };
}

export function useMyDuties() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<Responsibility[] | null>(null);
  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    api.listMyResponsibilities(token).then((r) => { if (live) setRows(r); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, [token]);
  const admin = user?.role_id === 'ROLE-ADMIN';
  /** Does the person hold the duty for the area on the day (the Admin role always may, as on the server)? */
  const holds = useCallback((duty: string, area: { area_id: string; line_id: string }, day: string) =>
    admin || (rows ?? []).some((r) => r.duty === duty && inForce(r, day) && covers(r, area)), [admin, rows]);
  return { rows, admin, holds, loaded: rows !== null };
}

/** 'HH:MM' inside a shift -> the full time stamp: a time before the shift start belongs to the next day (night shift). */
export function hmToTs(win: { start: string; end: string }, hm: string): string {
  if (!/^\d{2}:\d{2}$/.test(hm)) return '';
  const same = `${win.start.slice(0, 10)} ${hm}:00.000`;
  return same >= win.start ? same : `${win.end.slice(0, 10)} ${hm}:00.000`;
}

export const tsToHm = (ts: string): string => (ts ? ts.slice(11, 16) : '');

/** '14:30' or '14:30 (21 Oct)' when the day differs from `day`. */
export function tsShortText(ts: string, day: string): string {
  if (!ts) return '';
  if (ts.slice(0, 10) === day) return ts.slice(11, 16);
  const d = new Date(`${ts.slice(0, 10)}T00:00:00Z`);
  return `${ts.slice(11, 16)} (${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })})`;
}

export const hoursText = (h: number): string => (h >= 10 ? h.toFixed(0) : h.toFixed(1));

/** The current shift (and its report date) on the device clock. */
export function currentShift(defs: ShiftDef[], nowTs: string): { day: string; shift: ShiftDef } {
  const day = nowTs.slice(0, 10);
  for (const d of [day, addDays(day, -1)]) {
    for (const s of defs) {
      const w = shiftWindow(s, d);
      if (nowTs >= w.start && nowTs < w.end) return { day: d, shift: s };
    }
  }
  return { day, shift: defs[0]! };
}
