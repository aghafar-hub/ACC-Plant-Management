// One editable stoppage (Shift reports, backend 2.1.0): stop and restart time, equipment code, classification, failure,
// reason and description. Used by the shift leader's entry and by the reviewers (who see what they changed).
// Times are typed as HH:MM inside the shift; the date follows from the shift (a night-shift time after midnight is the
// next day). A blank restart means the equipment is still stopped at the end of the shift.
import { useMemo } from 'react';
import type { ClassificationCode } from '../api/types';
import { useStartup } from '../data/useStartup';
import { t } from '../i18n/t';
import { Icon } from '../icons';
import { flagText } from './flagText';

export interface StopDraft {
  key: string; stop_id?: string; stopHm: string; startHm: string; code: string; cls: string; failure: boolean; reason: string; description: string;
  /** server results of the saved row: data-check flags, and whether a later shift entered the restart */
  flags?: string; lockedRestart?: boolean; restartText?: string;
}

const CLASSES: ClassificationCode[] = ['PRO', 'MEC', 'ELE', 'AUT', 'PL', 'CIR'];
export const isIncidentClass = (c: string): boolean => ['PRO', 'MEC', 'ELE', 'AUT'].includes(c);

export function useAreaLists(areaId: string) {
  const { startup } = useStartup();
  return useMemo(() => {
    const ids = new Set((startup?.equipment_areas ?? []).filter((x) => x.area_id === areaId).map((x) => x.equipment_id));
    const equipment = (startup?.equipment ?? []).filter((e) => ids.has(e.equipment_id) && e.status !== 'Retired')
      .map((e) => ({ id: e.equipment_id, text: e.description ?? '' })).sort((a, b) => a.id.localeCompare(b.id));
    const reasons = new Map<string, string[]>();
    for (const r of startup?.reasons ?? []) {
      if (!r.active) continue;
      const list = reasons.get(r.classification) ?? [];
      list.push(r.text_as_listed);
      reasons.set(r.classification, list);
    }
    return { equipment, reasons, classes: startup?.classifications ?? [] };
  }, [startup, areaId]);
}

export default function StopEditor({ d, idx, areaId, readOnly, changed, onChange, onRemove, testid = 'stop-row' }: {
  d: StopDraft; idx: number; areaId: string; readOnly?: boolean;
  /** fields a reviewer changed (highlighted) */
  changed?: Set<string>;
  onChange: (next: StopDraft) => void; onRemove?: () => void; testid?: string;
}) {
  const lists = useAreaLists(areaId);
  const set = <K extends keyof StopDraft>(k: K, v: StopDraft[K]) => onChange({ ...d, [k]: v });
  const incident = isIncidentClass(d.cls);
  const cls = (name: string) => (changed?.has(name) ? 'field stop-field stop-field--changed' : 'field stop-field');
  const flags = (d.flags ?? '').split(',').filter(Boolean);
  const reasonList = lists.reasons.get(d.cls) ?? [];
  const id = `${testid}-${idx}`;
  return (
    <div className="stop-card" data-testid={testid} data-stop={d.stop_id ?? ''}>
      <div className="stop-card-head">
        <span className="stop-card-n">{idx + 1}</span>
        <span className="stop-card-title">{d.code || t('No equipment code')}{d.cls && <> · {d.cls}</>}</span>
        {d.stopHm && !d.startHm && !d.lockedRestart && <span className="badge badge--warning" data-testid="stop-open"><span aria-hidden="true">● </span>{t('Still stopped')}</span>}
        {onRemove && !readOnly && <button type="button" className="btn btn-sm" onClick={onRemove} aria-label={t('Remove stoppage {n}', { n: idx + 1 })} data-testid="stop-remove"><Icon name="trash" size={14} /></button>}
      </div>
      <div className="stop-grid">
        <div className={cls('stop_ts')}>
          <label htmlFor={`${id}-stop`}>{t('Stopped at')}</label>
          <input id={`${id}-stop`} className="input mono" type="time" value={d.stopHm} disabled={readOnly} onChange={(e) => set('stopHm', e.target.value)} data-testid="stop-time" />
        </div>
        <div className={cls('start_ts')}>
          <label htmlFor={`${id}-start`}>{t('Restarted at')}</label>
          {d.lockedRestart
            ? <div className="adm-readbox mono" data-testid="stop-restart-later">{d.restartText} <span className="adm-muted-sm">{t('(entered by a later shift)')}</span></div>
            : <input id={`${id}-start`} className="input mono" type="time" value={d.startHm} disabled={readOnly} onChange={(e) => set('startHm', e.target.value)} data-testid="start-time" />}
          {!d.lockedRestart && !readOnly && <span className="field-hint">{t('Blank = still stopped at the end of the shift')}</span>}
        </div>
        <div className={cls('code_raw')}>
          <label htmlFor={`${id}-code`}>{t('Equipment code')}</label>
          <input id={`${id}-code`} className="input mono" list={`eq-${areaId}`} value={d.code} disabled={readOnly} onChange={(e) => set('code', e.target.value)} placeholder="e.g. 351.KF200" autoComplete="off" data-testid="stop-code" />
        </div>
        <div className={cls('classification')}>
          <label htmlFor={`${id}-cls`}>{t('Classification')}</label>
          <select id={`${id}-cls`} className="input" value={d.cls} disabled={readOnly} onChange={(e) => onChange({ ...d, cls: e.target.value, failure: isIncidentClass(e.target.value) ? d.failure : false })} data-testid="stop-class">
            <option value="">{t('Choose…')}</option>
            {CLASSES.map((c) => <option key={c} value={c}>{c} · {lists.classes.find((x) => x.code === c)?.name ?? c}</option>)}
          </select>
        </div>
        <div className={cls('is_failure')}>
          <span className="field-label">{t('Failure')}</span>
          <label className="stop-check">
            <input type="checkbox" checked={d.failure && incident} disabled={readOnly || !incident} onChange={(e) => set('failure', e.target.checked)} data-testid="stop-failure" />
            <span>{incident ? t('Yes, a failure') : t('Not for planned or circumstantial stops')}</span>
          </label>
        </div>
        <div className={cls('reason_raw')}>
          <label htmlFor={`${id}-reason`}>{t('Reason')}</label>
          <input id={`${id}-reason`} className="input" list={`rs-${areaId}-${d.cls || 'none'}-${idx}`} value={d.reason} disabled={readOnly} onChange={(e) => set('reason', e.target.value)} autoComplete="off" data-testid="stop-reason" />
          <datalist id={`rs-${areaId}-${d.cls || 'none'}-${idx}`}>{reasonList.map((r) => <option key={r} value={r} />)}</datalist>
        </div>
        <div className={`${cls('description')} stop-wide`}>
          <label htmlFor={`${id}-desc`}>{t('What happened')}</label>
          <input id={`${id}-desc`} className="input" value={d.description} disabled={readOnly} onChange={(e) => set('description', e.target.value)} data-testid="stop-desc" />
        </div>
      </div>
      {flags.length > 0 && (
        <ul className="stop-flags" data-testid="stop-flags">
          {flags.map((f) => <li key={f} className={['missing_classification', 'invalid_classification', 'end_before_start'].includes(f) ? 'stop-flag stop-flag--block' : 'stop-flag'}>{flagText(f)}</li>)}
        </ul>
      )}
    </div>
  );
}

/** The equipment list of an area for the code boxes (one per page). */
export function EquipmentDatalist({ areaId }: { areaId: string }) {
  const { equipment } = useAreaLists(areaId);
  return <datalist id={`eq-${areaId}`}>{equipment.map((e) => <option key={e.id} value={e.id}>{e.text}</option>)}</datalist>;
}
