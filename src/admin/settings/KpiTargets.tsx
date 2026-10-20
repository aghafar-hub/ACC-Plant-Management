// Settings › KPI targets (plant system, backend 2.3.0): the one place targets live. Choose a year and a scope (the plant,
// a line or an area); each KPI gets a year target, optional lower and upper limits, and optional month targets that
// replace the year target for that month. A blank area or line target uses the line's or the plant's (shown in grey).
// Saving needs the Admin role or the duty "targets" for the scope (the server checks it again).
import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { SERVER_2_3, versionAtLeast } from '../../auth/serverVersion';
import { t } from '../../i18n/t';
import { Icon } from '../../icons';
import { resolveKpiTarget, type KpiDefinition, type KpiTarget, type KpiTargetInput, type TargetScope } from '../../plant/kpiTargets';
import { useMyDuties } from '../../plant/useShiftData';
import { MONTHS } from '../../util/dates';
import { useAction } from '../useAction';
import { useSettingsData } from './useSettingsData';
import '../../components/ui.css';
import '../admin.css';
import './kpiTargets.css';

interface Draft { target: string; lower: string; upper: string; months: string[] }
const txt = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(n));
const numOf = (s: string): number | null => (s.trim() === '' ? null : Number(s.trim().replace(',', '.')));
const bad = (s: string): boolean => s.trim() !== '' && !Number.isFinite(Number(s.trim().replace(',', '.')));

const CATEGORY_TEXT: Record<string, string> = {
  reliability: 'Downtime and reliability', production: 'Production', energy: 'Energy', fuel: 'Fuel and heat', water: 'Water',
  materials: 'Materials and cement', stock: 'Stocks', quality: 'Quality', data: 'Data and reporting',
};

function draftOf(stored: readonly KpiTarget[], kpi: string): Draft {
  const year = stored.find((r) => r.kpi_id === kpi && r.month === 0);
  const months = Array.from({ length: 12 }, (_, i) => txt(stored.find((r) => r.kpi_id === kpi && r.month === i + 1)?.target_value));
  return { target: txt(year?.target_value), lower: txt(year?.lower_limit), upper: txt(year?.upper_limit), months };
}

export default function KpiTargets() {
  const { st, toastNode, toast } = useSettingsData();
  const { serverVersion } = useAuth();
  const duties = useMyDuties();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [scope, setScope] = useState<{ type: TargetScope; id: string }>({ type: 'plant', id: '' });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [openKpi, setOpenKpi] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const { run, busy, error } = useAction();
  const startup = st.startup;
  const defs: KpiDefinition[] = useMemo(() => startup?.kpi_definitions ?? [], [startup]);
  const all: KpiTarget[] = useMemo(() => startup?.kpi_targets ?? [], [startup]);
  const areas = useMemo(() => (startup?.areas ?? []).slice().sort((a, b) => a.sort_order - b.sort_order), [startup]);
  const lines = startup?.lines ?? [];
  const lineOf = (area: string) => areas.find((a) => a.area_id === area)?.line_id;
  const stored = useMemo(() => all.filter((r) => r.year === year && r.scope_type === scope.type && (scope.type === 'plant' || r.scope_id === scope.id)), [all, year, scope]);
  useEffect(() => { setDrafts({}); setOpenKpi(null); }, [year, scope.type, scope.id]);
  const years = useMemo(() => [...new Set([thisYear - 1, thisYear, thisYear + 1, ...all.map((r) => r.year), ...(startup?.years ?? [])])].sort((a, b) => b - a), [all, startup, thisYear]);

  // may this person save for the chosen scope today? (the server checks it again)
  const today = new Date().toISOString().slice(0, 10);
  const scopeArea = scope.type === 'area' ? { area_id: scope.id, line_id: lineOf(scope.id) ?? '' } : null;
  const canSave = duties.admin || (duties.rows ?? []).some((r) => r.duty === 'targets' && (!r.valid_from || r.valid_from <= today) && (!r.valid_to || today <= r.valid_to) &&
    (r.scope_type === 'plant' || (r.scope_type === 'line' && (scope.type === 'line' ? r.scope_id === scope.id : scopeArea?.line_id === r.scope_id)) ||
      (r.scope_type === 'area' && scope.type === 'area' && r.scope_id === scope.id)));

  const shownDefs = defs.filter((d) => showDraft || d.status === 'approved');
  const groups = [...new Set(shownDefs.map((d) => d.category))];
  const draftFor = (kpi: string): Draft => drafts[kpi] ?? draftOf(stored, kpi);
  const set = (kpi: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [kpi]: { ...(d[kpi] ?? draftOf(stored, kpi)), ...patch } }));
  const dirty = Object.keys(drafts).filter((k) => JSON.stringify(drafts[k]) !== JSON.stringify(draftOf(stored, k)));
  const invalid = dirty.filter((k) => { const d = drafts[k]!; return [d.target, d.lower, d.upper, ...d.months].some(bad); });
  // what a blank field falls back to: the line's or the plant's target of the year
  const inherited = (kpi: string): KpiTarget | null => (scope.type === 'plant' ? null
    : resolveKpiTarget(all.filter((r) => !(r.scope_type === scope.type && r.scope_id === scope.id)), kpi, scope, year, null, lineOf));

  async function save() {
    if (invalid.length || !startup) return;
    // the complete set of the scope and year: every KPI as it now reads (stored, or changed here)
    const ids = new Set([...stored.map((r) => r.kpi_id), ...dirty]);
    const rows: KpiTargetInput[] = [];
    for (const kpi of ids) {
      const d = draftFor(kpi);
      const source = stored.find((r) => r.kpi_id === kpi && r.month === 0)?.source ?? '';
      rows.push({ kpi_id: kpi, month: 0, target_value: numOf(d.target), lower_limit: numOf(d.lower), upper_limit: numOf(d.upper), source });
      d.months.forEach((m, i) => { if (m.trim() !== '') rows.push({ kpi_id: kpi, month: i + 1, target_value: numOf(m) }); });
    }
    const res = await run((tok) => api.saveKpiTargets(tok, { year, scope_type: scope.type, scope_id: scope.id, rows }));
    if (res.ok) {
      setDrafts({});
      st.reload();
      toast(t('KPI targets of {s} for {y} saved.', { s: scope.type === 'plant' ? t('the plant') : scope.id, y: year }));
    }
  }

  if (!versionAtLeast(serverVersion, SERVER_2_3)) {
    return <div className="callout callout--warning" data-testid="kt-old-server"><Icon name="info" size={16} /><span>{t('The server is not updated yet. KPI targets need backend 2.3.0 (deploy/plant-apps-script).')}</span></div>;
  }
  const scopeValue = scope.type === 'plant' ? 'plant' : `${scope.type}:${scope.id}`;
  return (
    <section className="card kt" data-testid="kpi-targets">
      {toastNode}
      <header className="kt-head">
        <div>
          <h2>{t('KPI targets')}</h2>
          <p className="adm-note">{t('The one place targets are kept. A year target applies to every month; a month target replaces it for that month. An area without its own target uses its line’s, then the plant’s (shown in grey). The Dashboard judges RF, UF, MTBF and MTTR against these targets.')}</p>
        </div>
        <div className="kt-pick">
          <label className="field"><span>{t('Year')}</span>
            <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))} data-testid="kt-year">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="field"><span>{t('For')}</span>
            <select className="select" value={scopeValue} data-testid="kt-scope"
              onChange={(e) => { const v = e.target.value; setScope(v === 'plant' ? { type: 'plant', id: '' } : { type: v.split(':')[0] as TargetScope, id: v.split(':').slice(1).join(':') }); }}>
              <option value="plant">{t('The plant')}</option>
              <optgroup label={t('Lines')}>{lines.map((l) => <option key={l.line_id} value={`line:${l.line_id}`}>{l.line_id} · {l.name}</option>)}</optgroup>
              <optgroup label={t('Areas')}>{areas.map((a) => <option key={a.area_id} value={`area:${a.area_id}`}>{a.area_id} · {a.name}</option>)}</optgroup>
            </select>
          </label>
          <label className="kt-check"><input type="checkbox" checked={showDraft} onChange={(e) => setShowDraft(e.target.checked)} data-testid="kt-show-draft" /> {t('Also draft KPIs')}</label>
        </div>
      </header>
      {!canSave && duties.loaded && (
        <p className="callout" data-testid="kt-readonly"><Icon name="info" size={16} /><span>{t('Read only: saving targets for {s} needs the duty “Targets” (Settings › Users › Responsibilities).', { s: scope.type === 'plant' ? t('the plant') : scope.id })}</span></p>
      )}
      {defs.length === 0 && <p className="adm-muted-sm">{t('No KPI definitions in the database yet.')}</p>}
      <div className="table-wrap">
        <table className="data-table kt-table" data-testid="kt-table">
          <thead>
            <tr><th scope="col">{t('KPI')}</th><th scope="col">{t('Better')}</th><th scope="col">{t('Year target')}</th><th scope="col">{t('Lower limit')}</th><th scope="col">{t('Upper limit')}</th><th scope="col">{t('Months')}</th></tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g}>
                <tr className="kt-group"><th scope="rowgroup" colSpan={6}>{t(CATEGORY_TEXT[g] ?? g)}</th></tr>
                {shownDefs.filter((d) => d.category === g).map((def) => {
                  const d = draftFor(def.kpi_id);
                  const inh = inherited(def.kpi_id);
                  const monthCount = d.months.filter((m) => m.trim() !== '').length;
                  const open = openKpi === def.kpi_id;
                  const input = (value: string, onChange: (v: string) => void, label: string, testid: string, placeholder?: string) => (
                    <input className="input kt-num" inputMode="decimal" value={value} placeholder={placeholder} aria-label={label}
                      aria-invalid={bad(value) || undefined} disabled={!canSave} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
                  );
                  return (
                    <Fragment key={def.kpi_id}>
                      <tr data-testid="kt-row" data-kpi={def.kpi_id}>
                        <th scope="row"><span className="kt-name">{def.name}</span> <span className="adm-muted-sm">{def.unit}{def.status === 'draft' ? ` · ${t('draft')}` : ''}</span></th>
                        <td className="kt-better" title={def.better === 'higher' ? t('Higher is better') : def.better === 'lower' ? t('Lower is better') : t('No direction')}>{def.better === 'higher' ? '↑' : def.better === 'lower' ? '↓' : '–'}</td>
                        <td>{input(d.target, (v) => set(def.kpi_id, { target: v }), t('{k} year target', { k: def.name }), `kt-target-${def.kpi_id}`, inh?.target_value !== null && inh ? `${inh.target_value} (${inh.scope_type === 'plant' ? t('plant') : inh.scope_id})` : undefined)}</td>
                        <td>{input(d.lower, (v) => set(def.kpi_id, { lower: v }), t('{k} lower limit', { k: def.name }), `kt-lower-${def.kpi_id}`)}</td>
                        <td>{input(d.upper, (v) => set(def.kpi_id, { upper: v }), t('{k} upper limit', { k: def.name }), `kt-upper-${def.kpi_id}`)}</td>
                        <td>
                          <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpenKpi(open ? null : def.kpi_id)} data-testid={`kt-months-${def.kpi_id}`}>
                            {monthCount ? t('{n} set', { n: monthCount }) : t('By month')} <Icon name={open ? 'chevronUp' : 'chevronDown'} size={13} />
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="kt-month-row"><td colSpan={6}>
                          <div className="kt-months">
                            {MONTHS.map((m, i) => (
                              <label key={m} className="kt-month"><span>{t(m)}</span>
                                {input(d.months[i]!, (v) => set(def.kpi_id, { months: d.months.map((x, j) => (j === i ? v : x)) }), t('{k} target for {m}', { k: def.name, m: t(m) }), `kt-month-${def.kpi_id}-${i + 1}`, d.target || undefined)}
                              </label>
                            ))}
                          </div>
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div className="callout callout--danger" role="alert" data-testid="kt-error"><Icon name="alert" size={16} /><span>{error}</span></div>}
      {invalid.length > 0 && <p className="callout callout--warning" role="alert" data-testid="kt-invalid"><Icon name="alert" size={16} /><span>{t('Targets and limits must be numbers. Check the fields marked in red.')}</span></p>}
      {canSave && (
        <div className="kt-actions">
          <button type="button" className="btn" disabled={!dirty.length || busy} onClick={() => setDrafts({})}>{t('Undo changes')}</button>
          <button type="button" className="btn-primary" disabled={!dirty.length || invalid.length > 0 || busy} onClick={save} data-testid="kt-save">
            {busy ? t('Saving…') : t('Save targets')}
          </button>
        </div>
      )}
    </section>
  );
}
