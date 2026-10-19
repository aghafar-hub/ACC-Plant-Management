import { useMemo, useState } from 'react';
import { api } from '../../api';
import { FormSection } from '../../components/ShellModal';
import { useStartup } from '../../data/useStartup';
import { t } from '../../i18n/t';
import { Icon } from '../../icons';
import {
  DUTIES, SECTION_DUTIES, SECTIONS, cleanResponsibility, dutyHelp, dutyName, respKey, sectionName, validateSet,
  type Duty, type Responsibility, type ResponsibilityInput, type Section,
} from '../../plant/responsibilities';
import { useAction } from '../useAction';

type Row = Required<ResponsibilityInput>;
const toRow = (r: Responsibility): Row => ({ duty: r.duty, section: r.section, scope_type: r.scope_type, scope_id: r.scope_id, is_backup: r.is_backup, valid_from: r.valid_from, valid_to: r.valid_to });
const rowId = (r: Row) => `${respKey(r)}|${r.valid_from}|${r.valid_to}`;

/**
 * Users › person › Responsibilities (backend 2.0.0): the duties this person holds, where, as main or backup, and for
 * how long. Edits stay on the screen until Save, which replaces the person's whole set (the server logs what changed).
 */
export default function ResponsibilitiesSection({ userId, rows, canEdit, onSaved, toast }: {
  userId: string; rows: Responsibility[]; canEdit: boolean; onSaved: (rows: Responsibility[]) => void; toast: (s: string) => void;
}) {
  const { startup } = useStartup();
  const lines = useMemo(() => (startup?.lines ?? []).slice().sort((a, b) => a.sort_order - b.sort_order), [startup]);
  const areas = useMemo(() => (startup?.areas ?? []).filter((a) => a.active !== false).slice().sort((a, b) => a.sort_order - b.sort_order), [startup]);
  const lineIds = useMemo(() => new Set(lines.map((l) => l.line_id)), [lines]);
  const areaIds = useMemo(() => new Set((startup?.areas ?? []).map((a) => a.area_id)), [startup]);
  const stored = useMemo(() => rows.map(toRow), [rows]);
  const [draft, setDraft] = useState<Row[]>(stored);
  const [duty, setDuty] = useState<Duty>('shift_entry');
  const [section, setSection] = useState<Section | ''>('');
  const [scope, setScope] = useState('plant');
  const [backup, setBackup] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [problem, setProblem] = useState('');
  const save = useAction();

  const changed = JSON.stringify(draft.map(rowId).sort()) !== JSON.stringify(stored.map(rowId).sort());
  const needsSection = SECTION_DUTIES.includes(duty);
  const scopeText = (r: Row) => (r.scope_type === 'plant' ? t('Whole plant') : r.scope_type === 'line' ? (lines.find((l) => l.line_id === r.scope_id)?.name ?? r.scope_id) : r.scope_id);

  function add() {
    const [type, id] = scope === 'plant' ? ['plant', ''] : scope.split(':') as [string, string];
    const c = cleanResponsibility({ duty, section: needsSection ? section : '', scope_type: type as Row['scope_type'], scope_id: id, is_backup: backup, valid_from: from, valid_to: to }, lineIds, areaIds);
    if ('error' in c) return setProblem(c.error);
    if (draft.some((r) => respKey(r) === respKey(c.row))) return setProblem(t('This person already holds that duty there. Remove it first to change its dates.'));
    setProblem('');
    setDraft((cur) => [...cur, c.row]);
    setFrom(''); setTo(''); setBackup(false);
  }

  async function doSave() {
    const bad = validateSet(draft, lineIds, areaIds);
    if (bad) return setProblem(bad);
    const res = await save.run((tok) => api.saveResponsibilities(tok, userId, draft));
    if (res.ok) { onSaved(res.value); setDraft(res.value.map(toRow)); toast(t('Responsibilities saved.')); }
  }

  const order = (r: Row) => DUTIES.indexOf(r.duty) * 1000 + (r.scope_type === 'plant' ? 0 : r.scope_type === 'line' ? 100 : 200) + (r.is_backup ? 1 : 0);
  const sorted = draft.slice().sort((a, b) => order(a) - order(b) || a.scope_id.localeCompare(b.scope_id));

  return (
    <FormSection icon="compliance" title={t('Responsibilities')} hint={t('Who does what, where')} right={<span className="badge" data-testid="resp-count">{t('{n} duties', { n: draft.length })}</span>} testid="resp-section">
      <p className="adm-note">{t('Duties decide who enters, reviews and validates shift reports and who closes each month. A duty is held for the whole plant, a line or one area, as the main person or as a backup, and can have dates (holidays, rotation).')}</p>
      {(problem || save.error) && <div className="callout callout--danger" role="alert" data-testid="resp-error"><Icon name="alert" size={16} /><span>{problem || save.error}</span></div>}
      {sorted.length === 0 ? <p className="adm-muted-sm" data-testid="resp-empty">{t('No duties yet.')}</p> : (
        <ul className="resp-list" data-testid="resp-list">
          {sorted.map((r) => (
            <li key={rowId(r)} className="resp-item" data-testid="resp-item" data-duty={r.duty} data-scope={r.scope_id || 'plant'}>
              <div className="resp-text">
                <b>{dutyName(r.duty)}</b>{r.section && <> · {sectionName(r.section as Section)}</>}
                <span className="adm-muted-sm"> · {scopeText(r)}{(r.valid_from || r.valid_to) && <> · {r.valid_from || '…'} → {r.valid_to || '…'}</>}</span>
                {r.is_backup && <> <span className="badge" data-testid="resp-backup">{t('Backup')}</span></>}
              </div>
              {canEdit && <button type="button" className="btn btn-sm" onClick={() => setDraft((cur) => cur.filter((x) => rowId(x) !== rowId(r)))} aria-label={t('Remove {duty}', { duty: dutyName(r.duty) })} data-testid="resp-remove"><Icon name="close" size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <>
          <div className="form-grid resp-add" data-testid="resp-add">
            <div className="field">
              <label htmlFor="resp-duty">{t('Duty')}</label>
              <select id="resp-duty" className="input" value={duty} onChange={(e) => { setDuty(e.target.value as Duty); setProblem(''); }} data-testid="resp-duty">
                {DUTIES.map((d) => <option key={d} value={d}>{dutyName(d)}</option>)}
              </select>
              <span className="field-hint">{dutyHelp(duty)}</span>
            </div>
            {needsSection && (
              <div className="field">
                <label htmlFor="resp-section-pick">{t('Section')}</label>
                <select id="resp-section-pick" className="input" value={section} onChange={(e) => setSection(e.target.value as Section)} data-testid="resp-section-pick">
                  <option value="">{t('Choose…')}</option>
                  {SECTIONS.map((s) => <option key={s} value={s}>{sectionName(s)}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="resp-scope">{t('Where')}</label>
              <select id="resp-scope" className="input" value={scope} onChange={(e) => setScope(e.target.value)} data-testid="resp-scope">
                <option value="plant">{t('Whole plant')}</option>
                <optgroup label={t('Lines')}>{lines.map((l) => <option key={l.line_id} value={`line:${l.line_id}`}>{l.name}</option>)}</optgroup>
                <optgroup label={t('Areas')}>{areas.map((a) => <option key={a.area_id} value={`area:${a.area_id}`}>{a.area_id} · {a.name}</option>)}</optgroup>
              </select>
            </div>
            <div className="field">
              <span className="field-label">{t('Held as')}</span>
              <div className="chip-row">
                <button type="button" className={!backup ? 'chip chip--on' : 'chip'} aria-pressed={!backup} onClick={() => setBackup(false)} data-testid="resp-main">{t('Main')}</button>
                <button type="button" className={backup ? 'chip chip--on' : 'chip'} aria-pressed={backup} onClick={() => setBackup(true)} data-testid="resp-is-backup">{t('Backup')}</button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="resp-from">{t('From (optional)')}</label>
              <input id="resp-from" className="input mono" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="resp-from" />
            </div>
            <div className="field">
              <label htmlFor="resp-to">{t('To (optional)')}</label>
              <input id="resp-to" className="input mono" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="resp-to" />
            </div>
          </div>
          <div className="chip-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={add} data-testid="resp-add-btn"><Icon name="plus" size={15} /> {t('Add duty')}</button>
            <button type="button" className="btn-primary" onClick={() => void doSave()} disabled={!changed || save.busy} data-testid="resp-save">{save.busy ? t('Saving…') : t('Save responsibilities')}</button>
            {changed && <span className="adm-muted-sm" data-testid="resp-unsaved">{t('Not saved yet')}</span>}
          </div>
        </>
      )}
    </FormSection>
  );
}
