// Shift reports › Review (backend 2.1.0): the reports waiting for my step. Production reviewers approve or return to
// the shift leader; reliability engineers validate (the stoppages go into the downtime analysis) or return to production.
// A reviewer may correct the stoppages first: every change is kept with the step and the comment.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAction } from '../admin/useAction';
import ShellModal, { FormSection } from '../components/ShellModal';
import { useStartup } from '../data/useStartup';
import { useLiveSearchParams } from '../hooks/useLiveSearchParams';
import { t } from '../i18n/t';
import { Icon } from '../icons';
import ShiftHistoryView from './ShiftHistoryView';
import {
  DEFAULT_SHIFTS, addDays, localNowTs, nextStep, shiftWindow, statusText, statusTone,
  type ShiftList, type ShiftReport, type ShiftReviewInput, type ShiftStoppage,
} from './shift';
import StopEditor, { EquipmentDatalist, type StopDraft } from './StopEditor';
import { hmToTs, tsShortText, tsToHm, useMyDuties, useShiftData } from './useShiftData';

const shiftName = (id: string) => DEFAULT_SHIFTS.find((s) => s.shift_id === id)?.name ?? id;

/** Who may act on this report now (mirrors the server; the server checks again). */
export function canActOn(r: ShiftReport, holds: (duty: string, area: { area_id: string; line_id: string }, day: string) => boolean, me: string, admin: boolean): boolean {
  const step = nextStep(r);
  if (!step || step.stage === 'entry') return false;
  if (!holds(step.duty, { area_id: r.area_id, line_id: r.line_id }, r.report_date)) return false;
  if (step.stage === 'production' && !admin && (r.entered_by === me || r.submitted_by === me)) return false;
  return true;
}

export default function ShiftReview({ toast, me }: { toast: (s: string) => void; me: string }) {
  const today = localNowTs().slice(0, 10);
  const from = addDays(today, -30);
  const { data, error, loading, reload } = useShiftData(from, today);
  const duties = useMyDuties();
  const [sp, setSp] = useLiveSearchParams();
  const openId = sp.get('id');
  const queue = useMemo(() => (data?.reports ?? []).filter((r) => canActOn(r, duties.holds, me, duties.admin))
    .sort((a, b) => a.report_date.localeCompare(b.report_date) || a.shift_id.localeCompare(b.shift_id) || a.area_id.localeCompare(b.area_id)), [data, duties.holds, me, duties.admin]);
  const prod = queue.filter((r) => r.status === 'submitted');
  const rel = queue.filter((r) => r.status === 'prod_approved');
  const open = (data?.reports ?? []).find((r) => r.report_id === openId) ?? null;
  const setOpen = (id: string | null) => setSp((c) => { const n = new URLSearchParams(c); if (id) n.set('id', id); else n.delete('id'); return n; });
  const name = (id: string) => data?.people[id] ?? id;

  const Group = ({ title, list, testid }: { title: string; list: ShiftReport[]; testid: string }) => (
    <section className="card" data-testid={testid}>
      <h3 className="shift-h">{title} <span className="badge">{list.length}</span></h3>
      {list.length === 0 ? <p className="adm-muted-sm">{t('Nothing waiting.')}</p> : (
        <ul className="shift-queue">
          {list.map((r) => {
            const n = (data?.stoppages ?? []).filter((s) => s.report_id === r.report_id || s.closed_report_id === r.report_id).length;
            return (
              <li key={r.report_id}>
                <button type="button" className="shift-queue-item" onClick={() => setOpen(r.report_id)} data-testid="review-item" data-report={r.report_id}>
                  <span className="mono shift-queue-area">{r.area_id}</span>
                  <span>{r.report_date} · {t(shiftName(r.shift_id))}</span>
                  <span className="adm-muted-sm">{t('{n} stoppages', { n })} · {t('by {who}', { who: name(r.submitted_by || r.entered_by) })}</span>
                  {r.return_stage === 'reliability' && <span className="badge badge--danger">{t('Returned by reliability')}</span>}
                  <Icon name="chevronRight" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <div data-testid="shift-review">
      {error && <div className="callout callout--danger" role="alert"><span>{error}</span><button type="button" className="btn btn-sm" onClick={reload}>{t('Try again')}</button></div>}
      {duties.loaded && !duties.admin && !(duties.rows ?? []).some((r) => r.duty === 'production_review' || r.duty === 'reliability_validation') && (
        <div className="callout callout--warning" data-testid="review-no-duty"><Icon name="info" size={16} /><span>{t('You do not review shift reports. Reviewers hold the duty "Production review" or "Reliability validation" (Settings › Users › Responsibilities).')}</span></div>
      )}
      {loading && !data ? <p className="muted">{t('Loading…')}</p> : (
        <div className="shift-review-grid">
          <Group title={t('Waiting for production review')} list={prod} testid="review-prod" />
          <Group title={t('Waiting for reliability validation')} list={rel} testid="review-rel" />
        </div>
      )}
      <p className="adm-muted-sm">{t('Reports of the last 30 days. Older ones are under All reports.')}</p>
      {open && data && (
        <ReviewPanel key={`${open.report_id}|${open.updated_at}`} report={open} data={data} canAct={canActOn(open, duties.holds, me, duties.admin)}
          onClose={() => setOpen(null)} onDone={(text) => { toast(text); setOpen(null); reload(); }} />
      )}
    </div>
  );
}

function draftOf(s: ShiftStoppage, rid: string, day: string): StopDraft {
  const later = !!s.closed_report_id && s.closed_report_id !== rid;
  return { key: s.stop_id, stop_id: s.stop_id, stopHm: tsToHm(s.stop_ts), startHm: later ? '' : tsToHm(s.start_ts), code: s.code_raw, cls: s.classification, failure: s.is_failure,
    reason: s.reason_raw, description: s.description, flags: s.flags, lockedRestart: later, restartText: later ? tsShortText(s.start_ts, day) : '' };
}

/** The changes a reviewer made to one stoppage (only the fields that differ). */
function changesOf(s: ShiftStoppage, d: StopDraft, win: { start: string; end: string }): ShiftReviewInput['edits'][number]['changes'] {
  const c: ShiftReviewInput['edits'][number]['changes'] = {};
  const stop = hmToTs(win, d.stopHm);
  if (stop && stop !== s.stop_ts) c.stop_ts = stop;
  if (!d.lockedRestart) {
    const start = d.startHm ? hmToTs(win, d.startHm) : '';
    if (start !== (s.start_ts || '')) c.start_ts = start;
  }
  if (d.code.trim() !== s.code_raw) c.code_raw = d.code.trim();
  if (d.cls !== s.classification) c.classification = d.cls;
  if (d.failure !== s.is_failure) c.is_failure = d.failure;
  if (d.reason.trim() !== s.reason_raw) c.reason_raw = d.reason.trim();
  if (d.description.trim() !== s.description) c.description = d.description.trim();
  return c;
}

const FIELD_OF: Record<string, string> = { stop_ts: 'stop_ts', start_ts: 'start_ts', code_raw: 'code_raw', classification: 'classification', is_failure: 'is_failure', reason_raw: 'reason_raw', description: 'description' };

function ReviewPanel({ report, data, canAct, onClose, onDone }: { report: ShiftReport; data: ShiftList; canAct: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const { startup } = useStartup();
  const def = DEFAULT_SHIFTS.find((s) => s.shift_id === report.shift_id) ?? DEFAULT_SHIFTS[0]!;
  const win = shiftWindow(def, report.report_date);
  const own = data.stoppages.filter((s) => s.report_id === report.report_id).sort((a, b) => a.stop_ts.localeCompare(b.stop_ts));
  const restarts = data.stoppages.filter((s) => s.closed_report_id === report.report_id && s.report_id !== report.report_id);
  const [drafts, setDrafts] = useState<StopDraft[]>(() => own.map((s) => draftOf(s, report.report_id, report.report_date)));
  const [restartHm, setRestartHm] = useState<Record<string, string>>(() => Object.fromEntries(restarts.map((s) => [s.stop_id, tsToHm(s.start_ts)])));
  const [comment, setComment] = useState('');
  const [problem, setProblem] = useState('');
  const [history, setHistory] = useState(false);
  useEffect(() => { setProblem(''); }, [comment]);
  const act = useAction();
  const stage = report.status === 'submitted' ? 'production' : 'reliability';
  const area = startup?.areas.find((a) => a.area_id === report.area_id);
  const name = (id: string) => data.people[id] ?? id;

  const edits = (): ShiftReviewInput['edits'] => {
    const out: ShiftReviewInput['edits'] = [];
    for (const d of drafts) {
      const s = own.find((x) => x.stop_id === d.stop_id);
      if (!s) continue;
      const c = changesOf(s, d, win);
      if (Object.keys(c).length) out.push({ stop_id: s.stop_id, changes: c });
    }
    for (const s of restarts) {
      const hm = restartHm[s.stop_id] ?? '';
      const ts = hm ? hmToTs(win, hm) : '';
      if (ts && ts !== s.start_ts) out.push({ stop_id: s.stop_id, changes: { start_ts: ts } });
    }
    return out;
  };
  const changedFields = (d: StopDraft): Set<string> => {
    const s = own.find((x) => x.stop_id === d.stop_id);
    return new Set(s ? Object.keys(changesOf(s, d, win)).map((k) => FIELD_OF[k] ?? k) : []);
  };
  const nChanges = edits().length;

  async function decide(decision: ShiftReviewInput['decision']) {
    if (decision === 'return' && comment.trim().length < 3) return setProblem(t('Say why the report is returned.'));
    const res = await act.run((tok) => api.reviewShiftReport(tok, { report_id: report.report_id, decision, comment: comment.trim(), edits: edits() }));
    if (res.ok) {
      onDone(decision === 'approve' ? t('Approved. The report goes to reliability.') : decision === 'validate'
        ? (res.value.report.status === 'posted' ? t('Validated. The stoppages are in the downtime analysis.') : t('Validated. Stoppages still open are added when their restart is validated.'))
        : stage === 'production' ? t('Returned to the shift leader.') : t('Returned to production.'));
    }
  }

  return (
    <ShellModal icon="clock" title={`${report.area_id} · ${report.report_date} · ${t(def.name)}`} subtitle={area?.name} onClose={onClose} width={900} testid="review-panel"
      badge={<span className={`badge badge--${statusTone(report.status)}`} data-testid="review-status">{statusText(report.status)}</span>}
      footer={<button type="button" className="btn" onClick={onClose} data-testid="review-close">{t('Close')}</button>}>
      <FormSection icon="users" title={t('Report')}>
        <p className="adm-note">
          {t('Entered by {who}', { who: name(report.entered_by) })}{report.submitted_at && <> · {t('submitted {when}', { when: report.submitted_at.slice(0, 16) })}</>}
          {report.prod_reviewed_by && <> · {t('approved by {who}', { who: name(report.prod_reviewed_by) })}</>}
        </p>
        {report.notes && <p className="adm-note" data-testid="review-notes"><b>{t('Shift notes:')}</b> {report.notes}</p>}
        {report.return_stage === 'reliability' && report.status === 'submitted' && <div className="callout callout--danger"><Icon name="alert" size={16} /><span><b>{t('Returned by reliability:')}</b> {report.return_comment}</span></div>}
      </FormSection>
      <FormSection icon="list" title={t('Stoppages')} hint={canAct ? t('Correct what is wrong before deciding; every change is kept') : undefined} right={nChanges ? <span className="badge badge--accent" data-testid="review-changes">{t('{n} changed', { n: nChanges })}</span> : undefined}>
        {own.length === 0 && restarts.length === 0 && <p className="adm-muted-sm">{t('No stoppages: the area ran the whole shift.')}</p>}
        <EquipmentDatalist areaId={report.area_id} />
        <div className="stop-list">
          {drafts.map((d, i) => (
            <StopEditor key={d.key} d={d} idx={i} areaId={report.area_id} readOnly={!canAct} changed={changedFields(d)} testid="review-stop"
              onChange={(n) => setDrafts((c) => c.map((x) => (x.key === d.key ? n : x)))} />
          ))}
        </div>
        {restarts.length > 0 && (
          <div className="card" style={{ marginTop: 10 }} data-testid="review-restarts">
            <h4 className="shift-h">{t('Restarts entered in this shift')}</h4>
            <ul className="shift-open-list">
              {restarts.map((s) => (
                <li key={s.stop_id} className="shift-open-item">
                  <div className="shift-open-text"><b className="mono">{s.code_raw || t('No code')}</b> · {s.classification} · {s.reason_raw} <span className="adm-muted-sm">· {t('stopped {when}', { when: tsShortText(s.stop_ts, report.report_date) })}</span></div>
                  <input className="input mono" type="time" aria-label={t('Restart time')} value={restartHm[s.stop_id] ?? ''} disabled={!canAct} onChange={(e) => setRestartHm((c) => ({ ...c, [s.stop_id]: e.target.value }))} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </FormSection>
      {canAct ? (
        <FormSection icon="check" title={stage === 'production' ? t('Production review') : t('Reliability validation')}>
          {(problem || act.error) && <div className="callout callout--danger" role="alert" data-testid="review-error"><Icon name="alert" size={16} /><span>{problem || act.error}</span></div>}
          <div className="field">
            <label htmlFor="rv-comment">{t('Comment (needed to return)')}</label>
            <textarea id="rv-comment" className="textarea" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} data-testid="review-comment" />
          </div>
          <div className="chip-row" style={{ marginTop: 10 }}>
            {stage === 'production'
              ? <button type="button" className="btn-primary" onClick={() => void decide('approve')} disabled={act.busy} data-testid="review-approve"><Icon name="check" size={15} /> {nChanges ? t('Save changes and approve') : t('Approve')}</button>
              : <button type="button" className="btn-primary" onClick={() => void decide('validate')} disabled={act.busy} data-testid="review-validate"><Icon name="check" size={15} /> {nChanges ? t('Save changes and validate') : t('Validate')}</button>}
            <button type="button" className="btn" onClick={() => void decide('return')} disabled={act.busy} data-testid="review-return"><Icon name="arrowLeft" size={15} /> {stage === 'production' ? t('Return to shift leader') : t('Return to production')}</button>
          </div>
          {stage === 'reliability' && <p className="field-hint">{t('Validated stoppages go into the downtime analysis at once; a stoppage still open goes in when its restart is validated.')}</p>}
        </FormSection>
      ) : (
        <p className="adm-note" data-testid="review-readonly">{t('You can read this report. It waits for {step}.', { step: report.status === 'submitted' ? t('production review') : report.status === 'prod_approved' ? t('reliability validation') : statusText(report.status).toLowerCase() })}</p>
      )}
      <FormSection icon="history" title={t('History')} right={<button type="button" className="btn btn-sm" onClick={() => setHistory((v) => !v)} data-testid="review-history-toggle">{history ? t('Hide') : t('Show')}</button>}>
        {history && <ShiftHistoryView reportId={report.report_id} people={data.people} />}
      </FormSection>
    </ShellModal>
  );
}
