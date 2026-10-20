// Settings › Month closing (plant system, backend 2.3.0): each section's month is reviewed by the section engineer,
// then signed off by the section manager (another person) and locked; the plant report is signed off once the three
// sections are. A signed-off downtime month takes no edits, uploads or postings until the manager reopens it with a
// reason. Reports of a month that is not signed off are marked provisional.
import { useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { SERVER_2_3, versionAtLeast } from '../../auth/serverVersion';
import { t } from '../../i18n/t';
import { Icon } from '../../icons';
import { CLOSING_REASON_MIN, CLOSING_SECTION_TEXT, CLOSING_SECTIONS, closingOf, monthKey, type ClosingSection, type MonthClosing, type MonthClosingStep } from '../../plant/closing';
import { useMyDuties } from '../../plant/useShiftData';
import { MONTHS } from '../../util/dates';
import { useValidationOptional } from '../../validate/ValidationContext';
import { useUserNames } from '../../validate/useKeepInfo';
import { useAction } from '../useAction';
import { useSettingsData } from './useSettingsData';
import '../../components/ui.css';
import '../admin.css';
import './kpiTargets.css';

const STATUS_TEXT: Record<MonthClosing['status'], string> = { open: 'Open', reviewed: 'Reviewed', signed_off: 'Signed off', reopened: 'Reopened' };
const STATUS_TONE: Record<MonthClosing['status'], string> = { open: '', reviewed: 'badge--warning', signed_off: 'badge--success', reopened: 'badge--danger' };

export default function MonthClosingPage() {
  const { st, toastNode, toast } = useSettingsData();
  const { serverVersion, user } = useAuth();
  const duties = useMyDuties();
  const v = useValidationOptional();
  const userName = useUserNames();
  const now = new Date();
  const thisYm = monthKey(now.getFullYear(), now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [pick, setPick] = useState<{ section: ClosingSection; month: number } | null>(null);
  const [comment, setComment] = useState('');
  const { run, busy, error, setError } = useAction();
  const closings = st.startup?.month_closings ?? [];
  const years = useMemo(() => [...new Set([now.getFullYear(), now.getFullYear() - 1, ...(st.startup?.years ?? [])])].sort((a, b) => b - a), [st.startup]); // eslint-disable-line react-hooks/exhaustive-deps
  // months that have ended, newest first
  const months = Array.from({ length: 12 }, (_, i) => 12 - i).filter((m) => monthKey(year, m) < thisYm);
  const today = now.toISOString().slice(0, 10);
  const holds = (duty: string, section: ClosingSection) => duties.admin || (duties.rows ?? []).some((r) => r.duty === duty && r.section === section &&
    (!r.valid_from || r.valid_from <= today) && (!r.valid_to || today <= r.valid_to));
  // records still to check in a month (the Validate list; the server counts again when the month is reviewed)
  const openOf = (ym: string): number | null => (v?.ready ? v.list.records.filter((r) => r.month === ym).length : null);

  async function act(step: MonthClosingStep['step']) {
    if (!pick) return;
    const res = await run((tok) => api.closeMonthStep(tok, { section: pick.section, year, month: pick.month, step, comment: comment.trim() }));
    if (res.ok) {
      st.reload();
      setComment('');
      toast(t('{s} {m}: {what}.', { s: t(CLOSING_SECTION_TEXT[pick.section]), m: `${t(MONTHS[pick.month - 1]!)} ${year}`, what: t(STATUS_TEXT[res.value.status]).toLowerCase() }));
    }
  }

  if (!versionAtLeast(serverVersion, SERVER_2_3)) {
    return <div className="callout callout--warning" data-testid="mc-old-server"><Icon name="info" size={16} /><span>{t('The server is not updated yet. Month closing needs backend 2.3.0 (deploy/plant-apps-script).')}</span></div>;
  }
  const sel = pick ? closingOf(closings, pick.section, year, pick.month) : null;
  const selYm = pick ? monthKey(year, pick.month) : '';
  const open = pick?.section === 'downtime' ? openOf(selYm) : null;
  const canReview = !!pick && pick.section !== 'plant' && holds('month_review', pick.section) && (sel!.status === 'open' || sel!.status === 'reopened');
  const plantReady = !!pick && pick.section === 'plant' && (['downtime', 'production', 'quality'] as const).every((s) => closingOf(closings, s, year, pick.month).status === 'signed_off');
  const canSign = !!pick && holds('month_signoff', pick.section) && (pick.section === 'plant' ? plantReady && sel!.status !== 'signed_off' : sel!.status === 'reviewed');
  const selfReview = !!sel && sel.reviewed_by === user?.user_id && user?.role_id !== 'ROLE-ADMIN';
  const canReopen = !!pick && holds('month_signoff', pick.section) && sel!.status === 'signed_off';
  const needComment = (canReview && (open ?? 0) > 0) || canReopen;

  return (
    <section className="card kt" data-testid="month-closing">
      {toastNode}
      <header className="kt-head">
        <div>
          <h2>{t('Month closing')}</h2>
          <p className="adm-note">{t('After a month ends, the section engineer reviews it and the section manager (another person) signs it off. A signed-off downtime month is locked: no edits, uploads, history rows or shift postings until the manager reopens it with a reason. The plant report is signed off once the three sections are.')}</p>
        </div>
        <div className="kt-pick">
          <label className="field"><span>{t('Year')}</span>
            <select className="select" value={year} onChange={(e) => { setYear(Number(e.target.value)); setPick(null); }} data-testid="mc-year">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
      </header>
      <div className="table-wrap">
        <table className="data-table mc-table" data-testid="mc-table">
          <thead><tr><th scope="col">{t('Month')}</th>{CLOSING_SECTIONS.map((s) => <th key={s} scope="col">{t(CLOSING_SECTION_TEXT[s])}</th>)}</tr></thead>
          <tbody>
            {months.length === 0 && <tr><td colSpan={5} className="adm-muted-sm">{t('No month of {y} has ended yet.', { y: year })}</td></tr>}
            {months.map((m) => (
              <tr key={m} data-testid="mc-row" data-month={monthKey(year, m)}>
                <th scope="row">{t(MONTHS[m - 1]!)} {year}</th>
                {CLOSING_SECTIONS.map((s) => {
                  const c = closingOf(closings, s, year, m);
                  const on = pick?.section === s && pick.month === m;
                  return (
                    <td key={s}>
                      <button type="button" className={`mc-cell${on ? ' mc-cell--on' : ''}`} aria-pressed={on} onClick={() => { setPick({ section: s, month: m }); setComment(''); setError(null); }}
                        data-testid={`mc-${s}-${monthKey(year, m)}`} data-status={c.status}>
                        <span className={`badge ${STATUS_TONE[c.status]}`}>{c.status === 'signed_off' && <Icon name="check" size={12} />} {t(STATUS_TEXT[c.status])}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pick && sel && (
        <div className="mc-panel" data-testid="mc-panel">
          <h3 className="shift-h">{t(CLOSING_SECTION_TEXT[pick.section])} · {t(MONTHS[pick.month - 1]!)} {year}: <span data-testid="mc-status">{t(STATUS_TEXT[sel.status])}</span></h3>
          <ul className="adm-note mc-trail">
            {sel.reviewed_by && <li>{t('Reviewed by {n} on {d}', { n: userName(sel.reviewed_by), d: sel.reviewed_at.slice(0, 16) })}{sel.open_checks ? ` · ${t('{n} records still to check', { n: sel.open_checks })}` : ''}{sel.review_comment ? `: “${sel.review_comment}”` : ''}</li>}
            {sel.signed_off_by && <li>{t('Signed off by {n} on {d}', { n: userName(sel.signed_off_by), d: sel.signed_off_at.slice(0, 16) })}{sel.signoff_comment ? `: “${sel.signoff_comment}”` : ''}</li>}
            {sel.reopened_by && <li>{t('Reopened by {n} on {d}', { n: userName(sel.reopened_by), d: sel.reopened_at.slice(0, 16) })}: “{sel.reopen_reason}”</li>}
            {pick.section === 'downtime' && open !== null && sel.status !== 'signed_off' && <li data-testid="mc-open-checks">{open ? t('{n} records of this month still need checking in Validate.', { n: open }) : t('No record of this month needs checking.')}</li>}
            {pick.section !== 'downtime' && pick.section !== 'plant' && <li>{t('This section has no data in the app yet; its closing records the sign-off only.')}</li>}
            {pick.section === 'plant' && !plantReady && sel.status !== 'signed_off' && <li>{t('Signed off once Downtime, Production and Quality of the month are.')}</li>}
          </ul>
          {(canReview || canSign || canReopen) && (
            <>
              <label className="field"><span>{canReopen ? t('Why is it reopened? (required)') : needComment ? t('Comment (required while records still need checking)') : t('Comment (optional)')}</span>
                <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} data-testid="mc-comment" />
              </label>
              <div className="kt-actions">
                {canReview && <button type="button" className="btn-primary" disabled={busy || (needComment && comment.trim().length < CLOSING_REASON_MIN)} onClick={() => void act('review')} data-testid="mc-review">{t('Mark reviewed')}</button>}
                {canSign && <button type="button" className="btn-primary" disabled={busy || selfReview} title={selfReview ? t('You reviewed this month: another person signs it off.') : undefined} onClick={() => void act('signoff')} data-testid="mc-signoff">{t('Sign off and lock')}</button>}
                {canReopen && <button type="button" className="btn-danger" disabled={busy || comment.trim().length < CLOSING_REASON_MIN} onClick={() => void act('reopen')} data-testid="mc-reopen">{t('Reopen')}</button>}
              </div>
            </>
          )}
          {!canReview && !canSign && !canReopen && duties.loaded && (
            <p className="adm-muted-sm" data-testid="mc-no-action">{sel.status === 'signed_off' && !holds('month_signoff', pick.section) ? t('Locked. Only the section manager can reopen it.') : t('Nothing for you to do here: the duties Month review and Month sign-off of the section are set in Settings › Users › Responsibilities.')}</p>
          )}
          {error && <div className="callout callout--danger" role="alert" data-testid="mc-error"><Icon name="alert" size={16} /><span>{error}</span></div>}
        </div>
      )}
    </section>
  );
}
