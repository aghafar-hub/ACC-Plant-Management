import { useEffect, useState } from 'react';
import { api, describeError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { t } from '../i18n/t';
import type { ShiftHistory } from './shift';

const ACTION_TEXT: Record<string, string> = {
  create: 'Started the report', submit: 'Submitted', approve: 'Approved (production)', return: 'Returned', validate: 'Validated (reliability)', post: 'Added to the downtime analysis',
};
const FIELD_TEXT: Record<string, string> = {
  code_raw: 'equipment code', stop_ts: 'stop time', start_ts: 'restart time', classification: 'classification', is_failure: 'failure', reason_raw: 'reason', description: 'description',
};
const STAGE_TEXT: Record<string, string> = { entry: 'shift leader', production: 'production', reliability: 'reliability' };

/** The status trail and every stoppage change of one shift report. */
export default function ShiftHistoryView({ reportId, people }: { reportId: string; people: Record<string, string> }) {
  const { token } = useAuth();
  const [h, setH] = useState<ShiftHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    api.getShiftReportHistory(token, reportId).then(setH, (e) => setError(describeError(e)));
  }, [token, reportId]);
  const who = (id: string) => people[id] ?? id;
  if (error) return <p className="field-error">{error}</p>;
  if (!h) return <p className="muted">{t('Loading…')}</p>;
  const rows = [
    ...h.log.map((l) => ({ at: l.at, text: `${t(ACTION_TEXT[l.action] ?? l.action)} · ${who(l.by_user)}${l.comment ? ` · “${l.comment}”` : ''}`, kind: 'log' })),
    ...h.edits.map((e) => ({ at: e.edited_at, text: `${t('Changed {field}', { field: t(FIELD_TEXT[e.field] ?? e.field) })}: ${e.old_value || '—'} → ${e.new_value || '—'} · ${t(STAGE_TEXT[e.stage] ?? e.stage)} · ${who(e.edited_by)}${e.comment ? ` · “${e.comment}”` : ''}`, kind: 'edit' })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="shift-history" data-testid="shift-history">
      {rows.map((r, i) => <li key={i} className={`shift-history-${r.kind}`}><span className="mono adm-muted-sm">{r.at.slice(0, 16)}</span> {r.text}</li>)}
    </ol>
  );
}
