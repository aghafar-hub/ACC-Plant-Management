import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, describeError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { emptySettings, type DispatchDay, type DispatchSettings } from './model';

/** The days and targets of the Dispatch & Packing section, loaded once per page. */
export function useDispatchData() {
  const { token } = useAuth();
  const [days, setDays] = useState<DispatchDay[] | null>(null);
  const [settings, setSettings] = useState<DispatchSettings>(emptySettings());
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    Promise.all([api.getDispatchDays(token), api.getDispatchSettings(token)]).then(([d, s]) => { setDays(d); setSettings(s); }, (e) => setError(describeError(e)));
  }, [token]);
  useEffect(load, [load]);
  return { days, settings, setSettings, error, reload: load };
}

/** Months present in the data ('2025-01' ...), and the days inside the chosen period (all of them by default). */
export function usePeriod(days: DispatchDay[] | null) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const months = useMemo(() => [...new Set((days ?? []).map((d) => d.date.slice(0, 7)))].sort(), [days]);
  const lo = from && months.includes(from) ? from : months[0] ?? '';
  const hi = to && months.includes(to) ? to : months[months.length - 1] ?? '';
  const filtered = useMemo(() => (days ?? []).filter((d) => d.date.slice(0, 7) >= lo && d.date.slice(0, 7) <= hi), [days, lo, hi]);
  return { months, from: lo, to: hi, setFrom, setTo, days: filtered, all: lo === months[0] && hi === months[months.length - 1] };
}
