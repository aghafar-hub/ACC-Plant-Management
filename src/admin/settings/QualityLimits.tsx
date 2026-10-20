// Settings › Quality limits (plant system, backend 2.3.0): the specification (min, target, max) and the valid range of
// each laboratory parameter, by area and material. A result outside the specification is off-spec; outside the valid
// range it is treated as a typing error. Saving needs the Admin role or the duty "quality_validation" for the area.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { SERVER_2_3, versionAtLeast } from '../../auth/serverVersion';
import { t } from '../../i18n/t';
import { Icon } from '../../icons';
import { limitProblem, MATERIAL_TEXT, type QualityLimitInput, type QualityParameter } from '../../plant/quality';
import { useMyDuties } from '../../plant/useShiftData';
import { useStartup } from '../../data/useStartup';
import { useAction } from '../useAction';
import { useToast } from '../useToast';
import '../../components/ui.css';
import '../admin.css';
import './kpiTargets.css';

type NumField = 'spec_min' | 'target' | 'spec_max' | 'valid_min' | 'valid_max' | 'samples_per_day';
type Draft = Record<NumField, string> & { active: boolean; notes: string };
const NUM_FIELDS: NumField[] = ['spec_min', 'target', 'spec_max', 'valid_min', 'valid_max', 'samples_per_day'];
const FIELD_TEXT: Record<NumField, string> = { spec_min: 'Spec min', target: 'Target', spec_max: 'Spec max', valid_min: 'Valid min', valid_max: 'Valid max', samples_per_day: 'Samples / day' };
const txt = (n: number | null): string => (n === null ? '' : String(n));
const numOf = (s: string): number | null => (s.trim() === '' ? null : Number(s.trim().replace(',', '.')));
const draftOf = (p: QualityParameter): Draft => ({
  spec_min: txt(p.spec_min), target: txt(p.target), spec_max: txt(p.spec_max), valid_min: txt(p.valid_min), valid_max: txt(p.valid_max),
  samples_per_day: txt(p.samples_per_day), active: p.active, notes: p.notes,
});
const inputOf = (p: QualityParameter, d: Draft): QualityLimitInput => ({
  param_id: p.param_id, spec_min: numOf(d.spec_min), target: numOf(d.target), spec_max: numOf(d.spec_max), valid_min: numOf(d.valid_min),
  valid_max: numOf(d.valid_max), samples_per_day: numOf(d.samples_per_day), active: d.active, notes: d.notes.trim(),
});

export default function QualityLimits() {
  const { token, serverVersion } = useAuth();
  const duties = useMyDuties();
  const { startup } = useStartup();
  const [toastNode, toast] = useToast();
  const [params, setParams] = useState<QualityParameter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [area, setArea] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [onlyMissing, setOnlyMissing] = useState(false);
  const { run, busy, error } = useAction();
  const fresh = versionAtLeast(serverVersion, SERVER_2_3);

  const load = useCallback(() => {
    if (!token || !fresh) return;
    setLoadError(null);
    api.listQualityParameters(token).then(setParams, (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [token, fresh]);
  useEffect(load, [load]);

  const areas = useMemo(() => [...new Set((params ?? []).map((p) => p.area_id))], [params]);
  const today = new Date().toISOString().slice(0, 10);
  const lineOf = useMemo(() => new Map((startup?.areas ?? []).map((a) => [a.area_id, a.line_id])), [startup]);
  // the same rule as the server: a plant duty covers every area, a line duty the areas of that line
  const canEditArea = (areaId: string): boolean => duties.admin || (duties.rows ?? []).some((r) => r.duty === 'quality_validation' &&
    (!r.valid_from || r.valid_from <= today) && (!r.valid_to || today <= r.valid_to) &&
    (r.scope_type === 'plant' || (r.scope_type === 'line' && r.scope_id === lineOf.get(areaId)) || (r.scope_type === 'area' && r.scope_id === areaId)));
  const shown = (params ?? []).filter((p) => (!area || p.area_id === area) && (!onlyMissing || (p.spec_min === null && p.spec_max === null)));
  const draftFor = (p: QualityParameter): Draft => drafts[p.param_id] ?? draftOf(p);
  const set = (p: QualityParameter, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [p.param_id]: { ...(d[p.param_id] ?? draftOf(p)), ...patch } }));
  const byId = useMemo(() => new Map((params ?? []).map((p) => [p.param_id, p])), [params]);
  const dirty = Object.keys(drafts).filter((id) => { const p = byId.get(id); return p && JSON.stringify(drafts[id]) !== JSON.stringify(draftOf(p)); });
  const problems = new Map(dirty.map((id) => {
    const p = byId.get(id)!;
    const d = drafts[id]!;
    const bad = NUM_FIELDS.find((f) => d[f].trim() !== '' && !Number.isFinite(Number(d[f].trim().replace(',', '.'))));
    return [id, bad ? `${p.area_id} ${p.name}: ${t(FIELD_TEXT[bad])} ${t('must be a number.')}` : limitProblem({ ...p, ...inputOf(p, d) })];
  }).filter(([, v]) => v !== null) as [string, string][]);
  const missing = (params ?? []).filter((p) => p.active && p.spec_min === null && p.spec_max === null).length;

  async function save() {
    if (problems.size || !dirty.length) return;
    const rows = dirty.map((id) => inputOf(byId.get(id)!, drafts[id]!));
    const res = await run((tok) => api.saveQualityLimits(tok, rows));
    if (res.ok) {
      setParams(res.value);
      setDrafts({});
      toast(t('Quality limits saved ({n} parameters).', { n: rows.length }));
    }
  }

  if (!fresh) {
    return <div className="callout callout--warning" data-testid="ql-old-server"><Icon name="info" size={16} /><span>{t('The server is not updated yet. Quality limits need backend 2.3.0 (deploy/plant-apps-script).')}</span></div>;
  }
  const groups = [...new Set(shown.map((p) => `${p.area_id}|${p.material}`))];
  const anyEditable = (params ?? []).some((p) => canEditArea(p.area_id));
  return (
    <section className="card kt" data-testid="quality-limits">
      {toastNode}
      <header className="kt-head">
        <div>
          <h2>{t('Quality limits')}</h2>
          <p className="adm-note">{t('Specification (minimum, target, maximum) and the valid range of each laboratory parameter. A result outside the specification is off-spec; a result outside the valid range is treated as a typing error and checked before it counts.')}</p>
          {params && <p className="adm-note" data-testid="ql-missing">{missing ? t('{n} active parameters have no specification yet.', { n: missing }) : t('Every active parameter has a specification.')}</p>}
        </div>
        <div className="kt-pick">
          <label className="field"><span>{t('Area')}</span>
            <select className="select" value={area} onChange={(e) => setArea(e.target.value)} data-testid="ql-area">
              <option value="">{t('All areas')}</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="kt-check"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} data-testid="ql-only-missing" /> {t('Only without a specification')}</label>
        </div>
      </header>
      {loadError && <div className="callout callout--danger" role="alert"><Icon name="alert" size={16} /><span>{loadError}</span><button type="button" className="btn btn-sm" onClick={load}>{t('Try again')}</button></div>}
      {!params && !loadError && <p className="muted">{t('Loading…')}</p>}
      {params && duties.loaded && !anyEditable && (
        <p className="callout" data-testid="ql-readonly"><Icon name="info" size={16} /><span>{t('Read only: changing quality limits needs the duty “Quality validation” (Settings › Users › Responsibilities).')}</span></p>
      )}
      {params && (
        <div className="table-wrap">
          <table className="data-table kt-table" data-testid="ql-table">
            <thead>
              <tr>
                <th scope="col">{t('Parameter')}</th>
                {NUM_FIELDS.map((f) => <th key={f} scope="col">{t(FIELD_TEXT[f])}</th>)}
                <th scope="col">{t('In use')}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const [a, m] = g.split('|') as [string, string];
                return (
                  <Fragment key={g}>
                    <tr className="kt-group"><th scope="rowgroup" colSpan={NUM_FIELDS.length + 2}>{a} · {t(MATERIAL_TEXT[m] ?? m)}</th></tr>
                    {shown.filter((p) => p.area_id === a && p.material === m).map((p) => {
                      const d = draftFor(p);
                      const edit = canEditArea(p.area_id);
                      const problem = problems.get(p.param_id);
                      return (
                        <tr key={p.param_id} data-testid="ql-row" data-param={p.param_id} className={problem ? 'ql-row--bad' : undefined}>
                          <th scope="row"><span className="kt-name">{p.name}</span> <span className="adm-muted-sm">{p.unit !== '-' ? p.unit : ''}{p.qcx_column ? ` · ${p.qcx_column}` : ''}</span></th>
                          {NUM_FIELDS.map((f) => (
                            <td key={f}>
                              <input className="input kt-num" inputMode="decimal" value={d[f]} disabled={!edit} aria-label={`${p.area_id} ${p.name} ${t(FIELD_TEXT[f])}`}
                                aria-invalid={!!problem || undefined} onChange={(e) => set(p, { [f]: e.target.value } as Partial<Draft>)} data-testid={`ql-${f}-${p.param_id}`} />
                            </td>
                          ))}
                          <td><input type="checkbox" checked={d.active} disabled={!edit} aria-label={`${p.area_id} ${p.name} ${t('in use')}`} onChange={(e) => set(p, { active: e.target.checked })} /></td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {problems.size > 0 && (
        <ul className="callout callout--warning ql-problems" role="alert" data-testid="ql-problems">
          {[...problems.values()].map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
      {error && <div className="callout callout--danger" role="alert" data-testid="ql-error"><Icon name="alert" size={16} /><span>{error}</span></div>}
      {anyEditable && (
        <div className="kt-actions">
          <button type="button" className="btn" disabled={!dirty.length || busy} onClick={() => setDrafts({})}>{t('Undo changes')}</button>
          <button type="button" className="btn-primary" disabled={!dirty.length || problems.size > 0 || busy} onClick={save} data-testid="ql-save">
            {busy ? t('Saving…') : t('Save limits ({n})', { n: dirty.length })}
          </button>
        </div>
      )}
    </section>
  );
}
