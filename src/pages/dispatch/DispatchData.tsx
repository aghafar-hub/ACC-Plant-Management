// Dispatch & Packing > Data: upload the production workbook, set targets and rated capacity, browse and export every stored day.
import { useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../../admin/ConfirmDialog';
import { api, describeError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { Tile } from '../../components/Tile';
import { runChecks, summarise } from '../../dispatch/checks';
import { dayClinker, dayModes, dayTotal, MONTH_NAMES, packerTons } from '../../dispatch/calc';
import { CLINKER_TYPES, MODES, N_PACKERS, PRODUCTS, type DispatchDay, type DispatchSettings } from '../../dispatch/model';
import { parseDispatchWorkbook, type ParseResult } from '../../dispatch/parseWorkbook';
import { DispatchPage, monthText, Tbl, tons, tons1, useTableExport } from '../../dispatch/ui';
import { exportCol, type ExportTable } from '../../export/table';
import { t } from '../../i18n/t';
import { Icon } from '../../icons';
import '../../components/ui.css';
import '../../upload/upload.css';

type Phase = { name: 'idle' } | { name: 'reading'; file: string } | { name: 'review'; file: string; res: ParseResult } | { name: 'saving'; file: string }
  | { name: 'done'; text: string } | { name: 'error'; text: string };

function UploadBox({ existing, onDone }: { existing: DispatchDay[]; onDone: () => void }) {
  const { token } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [confirm, setConfirm] = useState(false);
  const onFile = async (f: File) => {
    setPhase({ name: 'reading', file: f.name });
    try { setPhase({ name: 'review', file: f.name, res: await parseDispatchWorkbook(f) }); } catch { setPhase({ name: 'error', text: t('This file could not be read.') }); }
  };
  const review = phase.name === 'review' ? phase : null;
  const days = review?.res.ok ? review.res.days : [];
  const have = useMemo(() => new Set(existing.map((d) => d.date)), [existing]);
  const dup = days.filter((d) => have.has(d.date)).map((d) => d.date);
  const sum = useMemo(() => summarise(runChecks(days)), [days]);
  const save = async () => {
    if (!review || !review.res.ok || !token) return;
    const file = review.file;
    setConfirm(false);
    setPhase({ name: 'saving', file });
    try {
      const r = await api.uploadDispatchDays(token, review.res.days, file);
      setPhase({ name: 'done', text: t('{n} days added ({a} to {b}).', { n: r.days_added, a: r.from, b: r.to }) });
      onDone();
    } catch (e) {
      setPhase({ name: 'error', text: describeError(e) });
    }
  };
  return (
    <section className="card" data-testid="dp-upload">
      <h2>{t('Upload the workbook')}</h2>
      <p>{t('Choose the production workbook (.xlsx) with the sheet "Packing & Dispatch". You will see what it contains and what the checks find before anything is saved. Dates already in the app are never replaced: if one is found the whole upload is refused.')}</p>
      <input ref={input} className="up-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label={t('Workbook file')} data-testid="dp-file"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onFile(f); }} />
      <button type="button" className="btn-primary" onClick={() => input.current?.click()} disabled={phase.name === 'reading' || phase.name === 'saving'} data-testid="dp-choose">
        <Icon name="upload" size={15} /> {t('Choose file')}
      </button>
      {phase.name === 'reading' && <p role="status" aria-live="polite">{t('Reading {f}…', { f: phase.file })}</p>}
      {phase.name === 'saving' && <p role="status" aria-live="polite">{t('Saving {f}…', { f: phase.file })}</p>}
      {phase.name === 'done' && <div className="callout" role="status" data-testid="dp-done"><span>{phase.text}</span><button type="button" className="btn btn-sm" onClick={() => setPhase({ name: 'idle' })}>{t('Close')}</button></div>}
      {phase.name === 'error' && <div className="callout" role="alert" data-testid="dp-error"><span>{phase.text}</span><button type="button" className="btn btn-sm" onClick={() => setPhase({ name: 'idle' })}>{t('Close')}</button></div>}
      {review && !review.res.ok && <div className="callout" role="alert" data-testid="dp-refused"><span>{review.res.message}</span></div>}
      {review && review.res.ok && (
        <div data-testid="dp-review" style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 6px' }}>{review.file}</h3>
          <Tbl caption={t('What the file contains')} rows={[
            [t('Days'), String(days.length)], [t('From'), review.res.from], [t('To'), review.res.to],
            [t('Total dispatched'), `${tons(days.reduce((a, d) => a + dayTotal(d), 0))} t`],
            [t('Findings of the checks'), t('{a} must fix, {b} to check, {c} information', { a: sum.block, b: sum.warn, c: sum.info })],
            [t('Dates already in the app'), String(dup.length)],
          ]} cols={[{ head: t('Item'), render: (r) => r[0] }, { head: t('Value'), num: true, render: (r) => r[1] }]} />
          {review.res.warnings.length > 0 && <ul style={{ margin: '8px 0 0', paddingInlineStart: 20, color: 'var(--tk-text-secondary)', fontSize: 14 }} data-testid="dp-warnings">{review.res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          {dup.length > 0 && <div className="callout" role="alert" data-testid="dp-dup"><span>{t('Nothing can be saved: {n} date(s) are already in the app ({list}). Dates are never replaced by an upload.', { n: dup.length, list: dup.slice(0, 5).join(', ') + (dup.length > 5 ? ', …' : '') })}</span></div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn-primary" disabled={dup.length > 0} onClick={() => setConfirm(true)} data-testid="dp-save">{t('Save {n} days', { n: days.length })}</button>
            <button type="button" className="btn" onClick={() => setPhase({ name: 'idle' })}>{t('Cancel')}</button>
          </div>
        </div>
      )}
      {confirm && review && review.res.ok && (
        <ConfirmDialog title={t('Save these days?')} confirmLabel={t('Save {n} days', { n: days.length })} onConfirm={() => void save()} onCancel={() => setConfirm(false)} icon="upload">
          <p>{t('{n} days from {a} to {b} will be added to Dispatch & Packing. This cannot be undone from here.', { n: days.length, a: review.res.from, b: review.res.to })}</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function Targets({ settings, onSaved }: { settings: DispatchSettings; onSaved: (s: DispatchSettings) => void }) {
  const { token, canEdit } = useAuth();
  const edit = canEdit('dispatch');
  const [draft, setDraft] = useState<DispatchSettings>(settings);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const num = (v: string): number => (v.trim() === '' ? 0 : Number(v));
  const pctVal = (v: string): number | null => (v.trim() === '' ? null : Number(v));
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const save = async () => {
    if (!token) return;
    setBusy(true); setMsg('');
    try { const s = await api.saveDispatchSettings(token, draft); onSaved(s); setDraft(s); setMsg(t('Saved.')); } catch (e) { setMsg(describeError(e)); } finally { setBusy(false); }
  };
  const field = (id: string, label: string, value: number | null, on: (v: string) => void, unit: string) => (
    <div className="field" key={id}>
      <label htmlFor={id}>{label} <span className="muted">({unit})</span></label>
      <input id={id} className="input" type="number" min={0} step="any" inputMode="decimal" value={value ?? ''} disabled={!edit} onChange={(e) => on(e.target.value)} data-testid={id} />
    </div>
  );
  return (
    <section className="card" data-testid="dp-targets">
      <h2>{t('Targets and rated capacity')}</h2>
      <p>{t('Leave a field empty when there is no target. Rated capacity lets the Packers page show each packer against its nameplate; the monthly targets draw a line on the Dashboard.')}</p>
      <h3 style={{ margin: '10px 0 6px', fontSize: 14 }}>{t('Rated capacity per packer')}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {draft.ratedTph.map((v, i) => field(`dp-rated-${i}`, `Packer ${i + 1}`, v || null, (x) => setDraft({ ...draft, ratedTph: draft.ratedTph.map((o, j) => (j === i ? num(x) : o)) }), 't/h'))}
      </div>
      <h3 style={{ margin: '14px 0 6px', fontSize: 14 }}>{t('Dispatch target per month')}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        {draft.monthlyTargetT.map((v, i) => field(`dp-target-${i}`, MONTH_NAMES[i]!, v || null, (x) => setDraft({ ...draft, monthlyTargetT: draft.monthlyTargetT.map((o, j) => (j === i ? num(x) : o)) }), 't'))}
      </div>
      <h3 style={{ margin: '14px 0 6px', fontSize: 14 }}>{t('Packer time')}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {field('dp-avail-target', t('Target running availability'), draft.availabilityTargetPct, (x) => setDraft({ ...draft, availabilityTargetPct: pctVal(x) }), '%')}
        {field('dp-notruck-max', t('Most time waiting for trucks'), draft.noTrucksMaxPct, (x) => setDraft({ ...draft, noTrucksMaxPct: pctVal(x) }), '%')}
      </div>
      {edit ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <button type="button" className="btn-primary" disabled={!dirty || busy} onClick={() => void save()} data-testid="dp-save-targets">{busy ? t('Saving…') : t('Save targets')}</button>
          <button type="button" className="btn" disabled={!dirty || busy} onClick={() => setDraft(settings)}>{t('Undo changes')}</button>
          {msg && <span role="status" className="muted" data-testid="dp-targets-msg">{msg}</span>}
        </div>
      ) : <p className="muted" style={{ marginTop: 10 }}>{t('Changing targets needs Edit access to this section.')}</p>}
    </section>
  );
}

const PAGE = 100;
function DaysTable({ days }: { days: DispatchDay[] }) {
  const exp = useTableExport('days');
  const months = [...new Set(days.map((d) => d.date.slice(0, 7)))].sort();
  const [month, setMonth] = useState('');
  const [shown, setShown] = useState(PAGE);
  const rows = days.filter((d) => !month || d.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const exportTable = (): ExportTable => ({
    id: 'all-days', sheet: t('Daily data'),
    columns: [
      exportCol(t('Date'), 'date'),
      ...PRODUCTS.map((p) => exportCol(`Bagged ${p} (t)`, 'num')), ...PRODUCTS.map((p) => exportCol(`Bulk ${p} (t)`, 'num')),
      exportCol(t('Sling manual (t)'), 'num'), exportCol(t('Sling from palletizer (t)'), 'num'), exportCol(t('Jumbo (t)'), 'num'), exportCol(t('Total dispatched (t)'), 'num'),
      ...Array.from({ length: N_PACKERS }, (_, i) => [`P${i + 1} packed (t)`, `P${i + 1} running (h)`, `P${i + 1} no trucks (h)`, `P${i + 1} unplanned (h)`, `P${i + 1} stoppage (h)`, `P${i + 1} bags used (est.)`, `P${i + 1} broken (est.)`]).flat().map((h) => exportCol(h, 'num')),
      ...CLINKER_TYPES.map((c) => exportCol(`${c} (t)`, 'num')), exportCol(t('Power 691 (MWh)'), 'num'), exportCol(t('Power 692 (MWh)'), 'num'),
      exportCol(t('WCN bags'), 'num'), exportCol(t('WCN broken (est.)'), 'num'), exportCol(t('Sling production (t)'), 'num'), exportCol(t('Jumbo production (t)'), 'num'),
    ],
    rows: [...days].sort((a, b) => a.date.localeCompare(b.date)).map((d) => [
      d.date, ...d.bagged, ...d.bulk, d.slingManual, d.slingPalletizer, d.jumbo, dayTotal(d),
      ...d.packers.flatMap((p) => [p.tons, p.runH, p.noTruckH, p.unplannedH, p.stopH, p.bags, p.broken]),
      d.clinker.opc, d.clinker.src, d.clinker.over60, d.clinker.lowAlk, d.power[0], d.power[1], d.wcnBags, d.wcnBroken, d.slingProduction, d.jumboProduction,
    ]),
  });
  return (
    <section className="card" data-testid="dp-days-card">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <h2>{t('Every day')}</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field"><label htmlFor="dp-days-month">{t('Month')}</label>
            <select id="dp-days-month" className="select" value={month} onChange={(e) => { setMonth(e.target.value); setShown(PAGE); }} data-testid="dp-days-month">
              <option value="">{t('All months')}</option>
              {months.map((m) => <option key={m} value={m}>{monthText(m)}</option>)}
            </select></div>
          {exp.menu(days.length ? exportTable() : null)}
        </div>
      </div>
      {exp.note && <p className="muted" role="status" style={{ marginTop: 6 }}>{exp.note}</p>}
      <p className="muted" style={{ margin: '8px 0 6px' }}>{t('The export holds every stored column of every day, not only the ones shown here.')}</p>
      <Tbl testid="dp-days-table" caption={t('Daily data')} rows={rows.slice(0, shown)}
        cols={[
          { head: t('Date'), render: (d) => d.date },
          { head: t('Dispatched t'), num: true, render: (d) => tons(dayTotal(d)) },
          { head: t('Bagged t'), num: true, render: (d) => tons(dayModes(d)[0]) },
          { head: t('Bulk t'), num: true, render: (d) => tons(dayModes(d)[1]) },
          { head: t('Sling + jumbo t'), num: true, render: (d) => tons(dayModes(d)[2] + dayModes(d)[3]) },
          { head: t('Packed t'), num: true, render: (d) => tons(packerTons(d)) },
          { head: t('Running h (6 packers)'), num: true, render: (d) => tons1(d.packers.reduce((a, p) => a + p.runH, 0)) },
          { head: t('Clinker t'), num: true, render: (d) => tons(dayClinker(d)) },
          { head: t('Power MWh'), num: true, render: (d) => tons1(d.power[0] + d.power[1]) },
        ]} />
      {rows.length > shown && <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setShown((n) => n + PAGE)}>{t('Show more')}</button>}
    </section>
  );
}

export default function DispatchData() {
  const { canEdit } = useAuth();
  const edit = canEdit('dispatch');
  return (
    <DispatchPage pageId="dispatch-data" testid="page-dispatch-data" period={false} subtitle={(d) => (d.length ? t('{n} days stored, {a} to {b}', { n: d.length, a: d[0]!.date, b: d[d.length - 1]!.date }) : t('No days stored yet'))}>
      {({ days, data }) => (
        <>
          <div className="tiles">
            <Tile icon="calendar" label={t('Days stored')} value={days.length} sub={days.length ? `${days[0]!.date} → ${days[days.length - 1]!.date}` : undefined} testid="dd-days" />
            <Tile icon="route" label={t('Dispatched in total')} value={`${tons(days.reduce((a, d) => a + dayTotal(d), 0))} t`} testid="dd-total" />
            <Tile icon="tool" label={t('Delivery modes')} value={MODES.length} sub={MODES.join(', ')} testid="dd-modes" />
          </div>
          {edit
            ? <UploadBox existing={days} onDone={data.reload} />
            : <div className="callout" role="status" data-testid="dp-view-only"><span>{t('You can read the data. Uploading a workbook needs Edit access to this section.')}</span></div>}
          <Targets settings={data.settings} onSaved={data.setSettings} />
          <DaysTable days={days} />
        </>
      )}
    </DispatchPage>
  );
}
