// Shift reports › All reports (backend 2.1.0): every report of a date range with its step, for anyone with the page.
import { useMemo, useState } from 'react';
import { useStartup } from '../data/useStartup';
import { useLiveSearchParams } from '../hooks/useLiveSearchParams';
import { t } from '../i18n/t';
import { DEFAULT_SHIFTS, STATUS_ORDER, addDays, localNowTs, statusText, statusTone, type ShiftStatus } from './shift';
import ShiftHistoryView from './ShiftHistoryView';
import ShellModal, { FormSection } from '../components/ShellModal';
import { tsShortText, useShiftData } from './useShiftData';

export default function ShiftAll() {
  const today = localNowTs().slice(0, 10);
  const [sp, setSp] = useLiveSearchParams();
  const from = sp.get('from') || addDays(today, -6);
  const to = sp.get('to') || today;
  const status = (sp.get('status') || '') as ShiftStatus | '';
  const areaF = sp.get('area') || '';
  const { data, error, loading, reload } = useShiftData(from, to);
  const { startup } = useStartup();
  const [openId, setOpenId] = useState<string | null>(null);
  const set = (k: string, v: string) => setSp((c) => { const n = new URLSearchParams(c); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const rows = useMemo(() => (data?.reports ?? []).filter((r) => r.report_date >= from && r.report_date <= to && (!status || r.status === status) && (!areaF || r.area_id === areaF))
    .sort((a, b) => b.report_date.localeCompare(a.report_date) || a.shift_id.localeCompare(b.shift_id) || a.area_id.localeCompare(b.area_id)), [data, from, to, status, areaF]);
  const counts = useMemo(() => {
    const m = new Map<ShiftStatus, number>();
    for (const r of data?.reports ?? []) if (r.report_date >= from && r.report_date <= to) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, [data, from, to]);
  const name = (id: string) => data?.people[id] ?? id;
  const open = rows.find((r) => r.report_id === openId) ?? null;
  const stopsOf = (id: string) => (data?.stoppages ?? []).filter((s) => s.report_id === id).sort((a, b) => a.stop_ts.localeCompare(b.stop_ts));

  return (
    <div data-testid="shift-all">
      <div className="card shift-pick">
        <div className="field"><label htmlFor="sa-from">{t('From')}</label><input id="sa-from" className="input mono" type="date" value={from} max={to} onChange={(e) => e.target.value && set('from', e.target.value)} data-testid="sa-from" /></div>
        <div className="field"><label htmlFor="sa-to">{t('To')}</label><input id="sa-to" className="input mono" type="date" value={to} min={from} onChange={(e) => e.target.value && set('to', e.target.value)} data-testid="sa-to" /></div>
        <div className="field">
          <label htmlFor="sa-area">{t('Area')}</label>
          <select id="sa-area" className="input" value={areaF} onChange={(e) => set('area', e.target.value)} data-testid="sa-area">
            <option value="">{t('All')}</option>
            {(startup?.areas ?? []).filter((a) => a.active !== false).map((a) => <option key={a.area_id} value={a.area_id}>{a.area_id}</option>)}
          </select>
        </div>
      </div>
      <div className="chip-row" style={{ margin: '10px 0' }} role="group" aria-label={t('Step')}>
        <button type="button" className={!status ? 'chip chip--on' : 'chip'} aria-pressed={!status} onClick={() => set('status', '')}>{t('All')} {[...counts.values()].reduce((a, b) => a + b, 0)}</button>
        {STATUS_ORDER.map((s) => <button key={s} type="button" className={status === s ? 'chip chip--on' : 'chip'} aria-pressed={status === s} onClick={() => set('status', s)} data-testid={`sa-status-${s}`}>{statusText(s)} {counts.get(s) ?? 0}</button>)}
      </div>
      {error && <div className="callout callout--danger" role="alert"><span>{error}</span><button type="button" className="btn btn-sm" onClick={reload}>{t('Try again')}</button></div>}
      {loading && !data ? <p className="muted">{t('Loading…')}</p> : rows.length === 0 ? <p className="adm-muted-sm" data-testid="sa-none">{t('No reports in this range.')}</p> : (
        <div className="table-wrap" data-testid="sa-table">
          <table className="data-table">
            <thead><tr><th scope="col">{t('Date')}</th><th scope="col">{t('Shift')}</th><th scope="col">{t('Area')}</th><th scope="col">{t('Step')}</th><th scope="col">{t('Stoppages')}</th><th scope="col">{t('Entered by')}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.report_id} data-testid="sa-row" data-report={r.report_id}>
                  <td className="mono nowrap"><button type="button" className="row-link" onClick={() => setOpenId(r.report_id)}>{r.report_date}</button></td>
                  <td>{t(DEFAULT_SHIFTS.find((s) => s.shift_id === r.shift_id)?.name ?? r.shift_id)}</td>
                  <td className="mono">{r.area_id}</td>
                  <td><span className={`badge badge--${statusTone(r.status)}`}>{statusText(r.status)}</span></td>
                  <td className="mono">{stopsOf(r.report_id).length}</td>
                  <td>{name(r.entered_by)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <ShellModal icon="clock" title={`${open.area_id} · ${open.report_date} · ${t(DEFAULT_SHIFTS.find((s) => s.shift_id === open.shift_id)?.name ?? open.shift_id)}`} onClose={() => setOpenId(null)} width={760} testid="sa-detail"
          badge={<span className={`badge badge--${statusTone(open.status)}`}>{statusText(open.status)}</span>} footer={<button type="button" className="btn" onClick={() => setOpenId(null)}>{t('Close')}</button>}>
          <FormSection icon="list" title={t('Stoppages')}>
            {stopsOf(open.report_id).length === 0 ? <p className="adm-muted-sm">{t('No stoppages.')}</p> : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th scope="col">{t('Stopped')}</th><th scope="col">{t('Restarted')}</th><th scope="col">{t('Code')}</th><th scope="col">{t('Class')}</th><th scope="col">{t('Reason')}</th><th scope="col">{t('In analysis')}</th></tr></thead>
                  <tbody>
                    {stopsOf(open.report_id).map((s) => (
                      <tr key={s.stop_id}>
                        <td className="mono">{tsShortText(s.stop_ts, open.report_date)}</td>
                        <td className="mono">{s.start_ts ? tsShortText(s.start_ts, open.report_date) : <span className="badge badge--warning">{t('Still stopped')}</span>}</td>
                        <td className="mono">{s.code_raw || '—'}</td><td>{s.classification || '—'}</td><td>{s.reason_raw || '—'}</td>
                        <td>{s.posted_event_id ? <span className="badge badge--success">{t('Yes')}</span> : t('Not yet')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {open.notes && <p className="adm-note"><b>{t('Shift notes:')}</b> {open.notes}</p>}
          </FormSection>
          <FormSection icon="history" title={t('History')}><ShiftHistoryView reportId={open.report_id} people={data?.people ?? {}} /></FormSection>
        </ShellModal>
      )}
    </div>
  );
}
