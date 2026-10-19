// Shift reports › My shift (backend 2.1.0): the shift leader picks the date, shift and area, enters the stoppages and
// submits. Stoppages still open from an earlier shift of the area are listed first, to enter their restart time.
// The choice lives in the address (?date=&shift=&area=) so a link or Back brings the same report.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useLiveSearchParams } from '../hooks/useLiveSearchParams';
import { useStartup } from '../data/useStartup';
import { useAction } from '../admin/useAction';
import { t } from '../i18n/t';
import { Icon } from '../icons';
import { DEFAULT_SHIFTS, blockingFlags, localNowTs, reportIdOf, shiftWindow, statusText, statusTone, type ShiftStoppage } from './shift';
import StopEditor, { EquipmentDatalist, type StopDraft } from './StopEditor';
import { currentShift, hmToTs, tsShortText, tsToHm, useMyDuties, useShiftData } from './useShiftData';

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function toDraft(s: ShiftStoppage, reportId: string, day: string): StopDraft {
  const later = !!s.closed_report_id && s.closed_report_id !== reportId;
  return {
    key: s.stop_id, stop_id: s.stop_id, stopHm: tsToHm(s.stop_ts), startHm: later ? '' : tsToHm(s.start_ts), code: s.code_raw, cls: s.classification,
    failure: s.is_failure, reason: s.reason_raw, description: s.description, flags: s.flags, lockedRestart: later, restartText: later ? tsShortText(s.start_ts, day) : '',
  };
}
const blank = (): StopDraft => ({ key: newKey(), stopHm: '', startHm: '', code: '', cls: '', failure: false, reason: '', description: '' });

export default function ShiftEntry({ toast }: { toast: (s: string) => void }) {
  const [sp, setSp] = useLiveSearchParams();
  const { startup } = useStartup();
  const duties = useMyDuties();
  const nowTs = localNowTs();
  const cur = currentShift(DEFAULT_SHIFTS, nowTs);
  const day = sp.get('date') || cur.day;
  const shiftId = sp.get('shift') || cur.shift.shift_id;
  const def = DEFAULT_SHIFTS.find((s) => s.shift_id === shiftId) ?? DEFAULT_SHIFTS[0]!;
  const win = shiftWindow(def, day);
  const areas = useMemo(() => (startup?.areas ?? []).filter((a) => a.active !== false).slice().sort((a, b) => a.sort_order - b.sort_order), [startup]);
  const mine = areas.filter((a) => duties.holds('shift_entry', a, day));
  const areaId = sp.get('area') || (mine[0] ?? areas[0])?.area_id || '';
  const area = areas.find((a) => a.area_id === areaId);
  const { data, error, loading, reload } = useShiftData(day, day);
  const rid = reportIdOf(day, def.shift_id, areaId);
  const report = data?.reports.find((r) => r.report_id === rid) ?? null;
  const own = useMemo(() => (data?.stoppages ?? []).filter((s) => s.report_id === rid).sort((a, b) => a.stop_ts.localeCompare(b.stop_ts)), [data, rid]);
  const earlierOpen = useMemo(() => (data?.stoppages ?? []).filter((s) => s.area_id === areaId && s.report_id !== rid && s.stop_ts < win.start &&
    (s.stop_state === 'open' || s.closed_report_id === rid)).sort((a, b) => a.stop_ts.localeCompare(b.stop_ts)), [data, areaId, rid, win.start]);
  const stamp = `${rid}|${report?.updated_at ?? ''}|${own.map((s) => s.updated_at || s.created_at).join(',')}`;
  const [drafts, setDrafts] = useState<StopDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [problem, setProblem] = useState('');
  const [restart, setRestart] = useState<Record<string, string>>({});
  useEffect(() => {
    setDrafts(own.map((s) => toDraft(s, rid, day)));
    setNotes(report?.notes ?? '');
    setProblem('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
  const save = useAction();
  const close = useAction();

  const editable = !report || report.status === 'draft' || report.status === 'returned';
  const allowed = !!area && duties.holds('shift_entry', area, day);
  const started = win.start <= nowTs;
  const canEdit = editable && allowed && started;
  const pick = (k: string, v: string) => setSp((c) => { const n = new URLSearchParams(c); n.set(k, v); return n; }, { replace: true });

  function inputs(): { ok: true; rows: Parameters<typeof api.saveShiftReport>[1]['stoppages'] } | { ok: false; error: string } {
    const rows = [];
    for (const [i, d] of drafts.entries()) {
      if (!d.stopHm) return { ok: false, error: t('Stoppage {n}: enter the time it stopped.', { n: i + 1 }) };
      const stop = hmToTs(win, d.stopHm);
      const start = d.startHm ? hmToTs(win, d.startHm) : '';
      if (start && start < stop) return { ok: false, error: t('Stoppage {n}: the restart is before the stop.', { n: i + 1 }) };
      rows.push({ stop_id: d.stop_id, code_raw: d.code.trim(), stop_ts: stop, start_ts: start, classification: d.cls, is_failure: d.failure, reason_raw: d.reason.trim(), description: d.description.trim() });
    }
    return { ok: true, rows };
  }

  async function doSave(submit: boolean) {
    const r = inputs();
    if (!r.ok) return setProblem(r.error);
    if (submit) {
      const missing = drafts.findIndex((d) => !d.cls);
      if (missing >= 0) return setProblem(t('Stoppage {n}: choose the classification before submitting.', { n: missing + 1 }));
    }
    setProblem('');
    const res = await save.run((tok) => api.saveShiftReport(tok, { report_date: day, shift_id: def.shift_id, area_id: areaId, notes, stoppages: r.rows, submit }));
    if (res.ok) {
      toast(submit ? t('Report submitted to production review.') : t('Draft saved.'));
      reload();
    }
  }

  async function doRestart(s: ShiftStoppage) {
    const hm = restart[s.stop_id] ?? '';
    if (!hm) return setProblem(t('Enter the restart time first.'));
    setProblem('');
    const res = await close.run((tok) => api.closeShiftStoppage(tok, { stop_id: s.stop_id, report_date: day, shift_id: def.shift_id, start_ts: hmToTs(win, hm) }));
    if (res.ok) { toast(t('Restart saved in your shift report.')); setRestart((c) => ({ ...c, [s.stop_id]: '' })); reload(); }
  }

  const blockingCount = own.filter((s) => blockingFlags(s).length).length;

  return (
    <div data-testid="shift-entry">
      <div className="card shift-pick" data-testid="shift-pick">
        <div className="field">
          <label htmlFor="se-date">{t('Date')}</label>
          <input id="se-date" className="input mono" type="date" value={day} max={cur.day} onChange={(e) => e.target.value && pick('date', e.target.value)} data-testid="se-date" />
        </div>
        <div className="field">
          <span className="field-label">{t('Shift')}</span>
          <div className="chip-row" role="group" aria-label={t('Shift')}>
            {DEFAULT_SHIFTS.map((s) => (
              <button key={s.shift_id} type="button" className={s.shift_id === def.shift_id ? 'chip chip--on' : 'chip'} aria-pressed={s.shift_id === def.shift_id} onClick={() => pick('shift', s.shift_id)} data-testid={`se-shift-${s.shift_id}`}>
                {t(s.name)} {s.start_time}–{s.end_time}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="se-area">{t('Area')}</label>
          <select id="se-area" className="input" value={areaId} onChange={(e) => pick('area', e.target.value)} data-testid="se-area">
            {(duties.admin || mine.length === 0 ? areas : mine).map((a) => <option key={a.area_id} value={a.area_id}>{a.area_id} · {a.name}</option>)}
          </select>
        </div>
        <div className="shift-pick-status">
          <span className={`badge badge--${report ? statusTone(report.status) : 'info'}`} data-testid="se-status">{report ? statusText(report.status) : t('Not started')}</span>
          <span className="adm-muted-sm mono">{win.start.slice(0, 16)} → {win.end.slice(0, 16)}</span>
        </div>
      </div>

      {duties.loaded && !duties.admin && mine.length === 0 && (
        <div className="callout callout--warning" data-testid="se-no-duty"><Icon name="info" size={16} /><span>{t('You do not hold the duty "Shift report entry" for any area. An Admin can add it in Settings › Users › Responsibilities.')}</span></div>
      )}
      {area && duties.loaded && !allowed && mine.length > 0 && (
        <div className="callout callout--warning"><Icon name="info" size={16} /><span>{t('You do not enter reports for {area}. You can read it only.', { area: area.area_id })}</span></div>
      )}
      {!started && <div className="callout callout--warning"><Icon name="clock" size={16} /><span>{t('This shift has not started yet.')}</span></div>}
      {report?.status === 'returned' && (
        <div className="callout callout--danger" data-testid="se-returned"><Icon name="alert" size={16} /><span><b>{t('Returned by {stage}:', { stage: report.return_stage === 'reliability' ? t('reliability') : t('production') })}</b> {report.return_comment}</span></div>
      )}
      {report && !editable && (
        <div className="callout" data-testid="se-locked"><Icon name="check" size={16} /><span>{t('This report is {status}. Corrections now go through the reviewers.', { status: statusText(report.status).toLowerCase() })}</span></div>
      )}
      {error && <div className="callout callout--danger" role="alert"><span>{error}</span><button type="button" className="btn btn-sm" onClick={reload}>{t('Try again')}</button></div>}
      {(problem || save.error || close.error) && <div className="callout callout--danger" role="alert" data-testid="se-error"><Icon name="alert" size={16} /><span>{problem || save.error || close.error}</span></div>}

      {earlierOpen.length > 0 && (
        <section className="card" data-testid="se-open">
          <h3 className="shift-h">{t('Still stopped from an earlier shift')}</h3>
          <p className="adm-muted-sm">{t('Enter the restart time when the equipment started again during your shift. Leave it while it is still stopped.')}</p>
          <ul className="shift-open-list">
            {earlierOpen.map((s) => (
              <li key={s.stop_id} className="shift-open-item" data-testid="se-open-item">
                <div className="shift-open-text">
                  <b className="mono">{s.code_raw || t('No code')}</b> · {s.classification || '—'} · {s.reason_raw || t('no reason')}
                  <span className="adm-muted-sm"> · {t('stopped {when}', { when: tsShortText(s.stop_ts, day) })}</span>
                  {s.closed_report_id === rid && <span className="badge badge--success"> {t('Restarted {when}', { when: tsShortText(s.start_ts, day) })}</span>}
                </div>
                {canEdit && (
                  <div className="chip-row">
                    <label className="sr-only" htmlFor={`rs-${s.stop_id}`}>{t('Restart time')}</label>
                    <input id={`rs-${s.stop_id}`} className="input mono" type="time" value={restart[s.stop_id] ?? (s.closed_report_id === rid ? tsToHm(s.start_ts) : '')} onChange={(e) => setRestart((c) => ({ ...c, [s.stop_id]: e.target.value }))} data-testid="se-restart-time" />
                    <button type="button" className="btn" onClick={() => void doRestart(s)} disabled={close.busy} data-testid="se-restart-save">{t('Save restart')}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" data-testid="se-stops">
        <div className="shift-h-row">
          <h3 className="shift-h">{t('Stoppages in this shift')} <span className="badge">{drafts.length}</span></h3>
          {canEdit && <button type="button" className="btn" onClick={() => setDrafts((c) => [...c, blank()])} data-testid="se-add"><Icon name="plus" size={15} /> {t('Add stoppage')}</button>}
        </div>
        {loading && !data ? <p className="muted">{t('Loading…')}</p> : drafts.length === 0 ? (
          <p className="adm-muted-sm" data-testid="se-none">{canEdit ? t('No stoppages yet. Add one for every stop in this shift, or submit an empty report when the area ran the whole shift.') : t('No stoppages in this report.')}</p>
        ) : (
          <div className="stop-list">
            <EquipmentDatalist areaId={areaId} />
            {drafts.map((d, i) => (
              <StopEditor key={d.key} d={d} idx={i} areaId={areaId} readOnly={!canEdit}
                onChange={(n) => setDrafts((c) => c.map((x) => (x.key === d.key ? n : x)))}
                onRemove={canEdit && !d.lockedRestart ? () => setDrafts((c) => c.filter((x) => x.key !== d.key)) : undefined} />
            ))}
          </div>
        )}
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="se-notes">{t('Shift notes (optional)')}</label>
          <textarea id="se-notes" className="textarea" rows={2} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} data-testid="se-notes" />
        </div>
        {blockingCount > 0 && canEdit && <p className="field-hint" data-testid="se-blocking">{t('{n} stoppage(s) must be fixed before submitting.', { n: blockingCount })}</p>}
        {canEdit && (
          <div className="chip-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => void doSave(false)} disabled={save.busy} data-testid="se-save">{save.busy ? t('Saving…') : t('Save draft')}</button>
            <button type="button" className="btn-primary" onClick={() => void doSave(true)} disabled={save.busy} data-testid="se-submit"><Icon name="send" size={15} /> {t('Submit to production')}</button>
          </div>
        )}
      </section>
    </div>
  );
}
