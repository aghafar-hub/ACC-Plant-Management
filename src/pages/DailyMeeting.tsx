// Daily meeting (plant system, backend 2.1.0): one production day (08:00 to 08:00) per area from the shift reports,
// at whatever review step they are: stop hours, failures, reliability and utilization factors, stops still open and
// late reports. Figures are provisional until both shift reports of the area are validated.
import { useMemo } from 'react';
import { useLiveSearchParams } from '../hooks/useLiveSearchParams';
import { useAuth } from '../auth/AuthContext';
import { SERVER_2_1, versionAtLeast } from '../auth/serverVersion';
import { PageHeader, Tile } from '../components/Tile';
import { useStartup } from '../data/useStartup';
import { t } from '../i18n/t';
import { Icon } from '../icons';
import { DEFAULT_SHIFTS, addDays, dayFigures, localNowTs, shiftWindow, statusText, statusTone, type DayAreaFigures } from '../plant/shift';
import { currentShift, hoursText, tsShortText, useShiftData } from '../plant/useShiftData';
import '../components/ui.css';
import '../admin/admin.css';
import '../plant/plant.css';

const pct = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(1)}%`);

export default function DailyMeeting() {
  const { serverVersion } = useAuth();
  const { startup } = useStartup();
  const [sp, setSp] = useLiveSearchParams();
  const nowTs = localNowTs();
  const today = currentShift(DEFAULT_SHIFTS, nowTs).day;
  const day = sp.get('date') || today;
  // a week back: an area is 'in use' (expected to report) once it has a shift report in the last 7 days
  const { data, error, loading, reload } = useShiftData(addDays(day, -6), day > today ? today : day);
  const deadlineH = Number(startup?.settings.find((s) => s.key === 'shift_submit_deadline_h')?.value) || 2;
  const areas = useMemo(() => (startup?.areas ?? []).filter((a) => a.active !== false).slice().sort((a, b) => a.sort_order - b.sort_order), [startup]);
  const inUse = useMemo(() => new Set((data?.reports ?? []).map((r) => r.area_id)), [data]);
  const figs = useMemo<DayAreaFigures[]>(() => (data ? areas.map((a) => dayFigures(a.area_id, day, DEFAULT_SHIFTS, data.reports, data.stoppages, nowTs, deadlineH)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, areas, day, deadlineH]);
  const used = figs.filter((f) => inUse.has(f.area_id));
  const total = used.reduce((m, f) => ({ stopH: m.stopH + f.stopH, failures: m.failures + f.failures, open: m.open + f.open, late: m.late + f.reports.filter((r) => r.late).length }), { stopH: 0, failures: 0, open: 0, late: 0 });
  const provisional = used.some((f) => f.provisional && (f.stops > 0 || f.reports.some((r) => r.status !== 'missing')));
  const dayStart = shiftWindow(DEFAULT_SHIFTS[0]!, day).start;
  const dayEnd = shiftWindow(DEFAULT_SHIFTS[0]!, addDays(day, 1)).start;
  const longest = useMemo(() => (data?.stoppages ?? []).filter((s) => s.stop_ts < dayEnd && (s.start_ts === '' || s.start_ts > dayStart))
    .map((s) => ({ s, h: ((Date.parse((s.start_ts || nowTs).replace(' ', 'T')) - Date.parse((s.stop_ts < dayStart ? dayStart : s.stop_ts).replace(' ', 'T'))) / 3_600_000) }))
    .sort((a, b) => b.h - a.h).slice(0, 10), [data, dayStart, dayEnd, nowTs]);
  const set = (d: string) => setSp((c) => { const n = new URLSearchParams(c); n.set('date', d); return n; }, { replace: true });

  return (
    <div className="page" data-testid="page-daily">
      <PageHeader title={t('Daily meeting')} subtitle={t('Production day {from} to {to}, from the shift reports.', { from: dayStart.slice(0, 16), to: dayEnd.slice(0, 16) })}
        right={(
          <div className="chip-row">
            <button type="button" className={day === addDays(today, -1) ? 'chip chip--on' : 'chip'} onClick={() => set(addDays(today, -1))} data-testid="dm-yesterday">{t('Yesterday')}</button>
            <button type="button" className={day === today ? 'chip chip--on' : 'chip'} onClick={() => set(today)} data-testid="dm-today">{t('Today')}</button>
            <input className="input mono" type="date" aria-label={t('Production day')} value={day} max={today} onChange={(e) => e.target.value && set(e.target.value)} data-testid="dm-date" />
          </div>
        )} />
      {!versionAtLeast(serverVersion, SERVER_2_1) ? (
        <div className="callout callout--warning"><Icon name="info" size={16} /><span>{t('The server is not updated yet. The daily meeting needs backend 2.1.0 (deploy/plant-apps-script).')}</span></div>
      ) : (
        <>
          {error && <div className="callout callout--danger" role="alert"><span>{error}</span><button type="button" className="btn btn-sm" onClick={reload}>{t('Try again')}</button></div>}
          {provisional && <div className="callout callout--warning" data-testid="dm-provisional"><Icon name="info" size={16} /><span>{t('Provisional: some reports of this day are not validated yet. The downtime analysis uses validated stoppages only.')}</span></div>}
          <div className="tiles">
            <Tile icon="clock" label={t('Stop hours (all areas)')} value={hoursText(total.stopH)} sub={day === today ? t('so far today') : undefined} testid="dm-stop-h" />
            <Tile icon="alert" label={t('Failures')} value={String(total.failures)} testid="dm-failures" />
            <Tile icon="flag" label={t('Still stopped')} value={String(total.open)} sub={t('stops without a restart time')} testid="dm-open" />
            <Tile icon="history" label={t('Reports late')} value={String(total.late)} sub={t('{h} h after the shift', { h: deadlineH })} testid="dm-late" />
          </div>
          {loading && !data ? <p className="muted">{t('Loading…')}</p> : (
            <div className="table-wrap" data-testid="dm-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t('Area')}</th><th scope="col">{t('Stop h')}</th><th scope="col">{t('Incident h')}</th><th scope="col">{t('Failures')}</th>
                    <th scope="col">{t('RF')}</th><th scope="col">{t('UF')}</th><th scope="col">{t('Still stopped')}</th>
                    {DEFAULT_SHIFTS.map((s) => <th key={s.shift_id} scope="col">{t('{name} report', { name: t(s.name) })}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {figs.map((f) => !inUse.has(f.area_id) ? (
                    <tr key={f.area_id} data-testid="dm-row" data-area={f.area_id} data-state="unused" className="dm-unused">
                      <th scope="row" className="mono">{f.area_id}</th>
                      <td colSpan={6 + DEFAULT_SHIFTS.length} className="adm-muted-sm">{t('No shift reports in the last 7 days')}</td>
                    </tr>
                  ) : (
                    <tr key={f.area_id} data-testid="dm-row" data-area={f.area_id}>
                      <th scope="row" className="mono">{f.area_id}{f.provisional && f.stops > 0 && <span className="dm-prov" title={t('Provisional')} aria-label={t('Provisional')}> *</span>}</th>
                      <td className="mono">{hoursText(f.stopH)}</td>
                      <td className="mono">{hoursText(f.incH)}</td>
                      <td className="mono">{f.failures}</td>
                      <td className="mono">{pct(f.rf)}</td>
                      <td className="mono">{pct(f.uf)}</td>
                      <td>{f.open > 0 ? <span className="badge badge--warning" data-testid="dm-open-badge">{f.open}</span> : <span className="adm-muted-sm">0</span>}</td>
                      {f.reports.map((r) => (
                        <td key={r.shift_id} data-testid={`dm-${f.area_id}-${r.shift_id}`}>
                          {r.status === 'missing'
                            ? <span className={r.late ? 'badge badge--danger' : 'adm-muted-sm'}>{r.late ? t('Late · not started') : t('Not started')}</span>
                            : <span className={`badge badge--${r.late ? 'danger' : statusTone(r.status)}`}>{r.late ? t('Late · {s}', { s: statusText(r.status) }) : statusText(r.status)}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <section className="card" style={{ marginTop: 14 }} data-testid="dm-longest">
            <h3 className="shift-h">{t('Longest stoppages of the day')}</h3>
            {longest.length === 0 ? <p className="adm-muted-sm">{t('No stoppages entered for this day.')}</p> : (
              <ul className="shift-open-list">
                {longest.map(({ s, h }) => (
                  <li key={s.stop_id} className="shift-open-item">
                    <div className="shift-open-text">
                      <b className="mono">{s.area_id}</b> · <span className="mono">{s.code_raw || t('No code')}</span> · {s.classification || '—'} · {s.reason_raw || t('no reason')}
                      <span className="adm-muted-sm"> · {tsShortText(s.stop_ts, day)} → {s.start_ts ? tsShortText(s.start_ts, day) : t('still stopped')}</span>
                    </div>
                    <span className="mono"><b>{hoursText(h)} h</b>{!s.start_ts && <span className="badge badge--warning"> {t('open')}</span>}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {used.length === 0 && data && <p className="adm-muted-sm" data-testid="dm-empty">{t('No area has entered a shift report in the last 7 days.')}</p>}
          <p className="adm-muted-sm" style={{ marginTop: 10 }}>{t('RF = running ÷ (running + incident hours); UF = running ÷ hours of the day so far. Overlapping stops count once.')}</p>
        </>
      )}
    </div>
  );
}
