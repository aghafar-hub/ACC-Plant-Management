// Upload › History import (backend 2.2.0, Admin role): the date-only stoppages of the NRS workbook (sheet MS.Downtime).
// Read in the browser, checked and summarised first; months that already hold stoppages are left out so nothing is
// counted twice; sending is safe to repeat (rows already stored are skipped). See historyImport.ts for the rules.
// 2.3.0: the months to import can be chosen (for example only December 2025 from a newer workbook).
import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { t } from '../i18n/t';
import { Icon } from '../icons';
import { num } from '../util/format';
import { sha256Hex } from '../util/sha256';
import { readHistoryFile, type HistoryPlan } from './historyImport';
import { runUpload, type Progress } from './uploadRunner';

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading'; name: string }
  | { kind: 'ready'; name: string; plan: HistoryPlan; taken: string[]; picked: string[] }
  | { kind: 'sending'; name: string; progress: Progress | null }
  | { kind: 'done'; name: string; added: number; identical: number; rejected: number }
  | { kind: 'error'; message: string };

const monthText = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function HistoryImport({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  async function choose(file: File) {
    setStage({ kind: 'reading', name: file.name });
    const res = await readHistoryFile(file);
    if (!res.ok) return setStage({ kind: 'error', message: res.message });
    // months that already hold stoppages (uploaded, entered in shift reports, or an earlier history import of other rows)
    const years = [...new Set(res.plan.months.map((m) => Number(m.slice(0, 4))))];
    const taken = new Set<string>();
    try {
      for (const y of years) for (const e of await api.getEvents(token ?? '', y)) if (!e.is_void && e.origin !== 'history') taken.add(e.event_date.slice(0, 7));
    } catch (e) {
      return setStage({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
    setStage({ kind: 'ready', name: file.name, plan: res.plan, taken: res.plan.months.filter((m) => taken.has(m)), picked: res.plan.months.filter((m) => !taken.has(m)) });
  }

  async function send(name: string, plan: HistoryPlan, taken: string[], picked: string[]) {
    if (!token) return;
    const rows = plan.rows.filter((r) => !taken.includes(r.event_date.slice(0, 7)) && picked.includes(r.event_date.slice(0, 7)));
    setStage({ kind: 'sending', name, progress: null });
    try {
      const hash = await sha256Hex(rows.map((r) => r.fingerprint).join(''));
      const out = await runUpload(api, token, {
        fileName: `History ${name}`, fileHash: hash, rows, kind: 'history',
        summary: { rows_read: plan.rowsRead, rows_skipped: plan.skipped.length + (plan.rows.length - rows.length) }, warnings: [],
      }, { onProgress: (p) => setStage({ kind: 'sending', name, progress: p }) });
      setStage({ kind: 'done', name, added: out.progress.added, identical: out.progress.identical, rejected: out.progress.rejected.length });
      onDone();
    } catch (e) {
      setStage({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <section className="card" data-testid="history-import" style={{ marginTop: 16, minWidth: 0, overflowWrap: 'anywhere' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}><Icon name="history" size={16} /> {t('History import (date only)')}</h3>
      <p className="adm-note">
        {t('Adds the stoppages of earlier years from the NRS reporting workbook (sheet MS.Downtime: date, area, code, hours, classification, reason, failure). They have no stop or restart times: the stops of each day are laid end to end from 00:00, so daily, monthly and yearly hours, failures, RF, UF, MTBF and MTTR are right, while the hour-of-day charts and the timeline leave them out. Admin only.')}
      </p>
      {(stage.kind === 'idle' || stage.kind === 'error' || stage.kind === 'done') && (
        <label className="btn" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', whiteSpace: 'normal', maxWidth: '100%', textAlign: 'left' }}>
          <Icon name="upload" size={15} /> {t('Choose the NRS workbook or its MS.Downtime sheet')}
          <input type="file" accept=".xlsx,.xlsm" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void choose(f); }} data-testid="history-file" />
        </label>
      )}
      {stage.kind === 'reading' && <p className="muted" data-testid="history-reading">{t('Reading {name}… a large workbook can take a minute.', { name: stage.name })}</p>}
      {stage.kind === 'error' && <div className="callout callout--danger" role="alert" data-testid="history-error" style={{ marginTop: 10 }}><Icon name="alert" size={16} /><span>{stage.message}</span></div>}
      {stage.kind === 'ready' && (() => {
        const { plan, taken, picked } = stage;
        const perMonth = new Map<string, number>();
        for (const r of plan.rows) perMonth.set(r.event_date.slice(0, 7), (perMonth.get(r.event_date.slice(0, 7)) ?? 0) + 1);
        const sendable = plan.rows.filter((r) => !taken.includes(r.event_date.slice(0, 7)) && picked.includes(r.event_date.slice(0, 7))).length;
        const free = plan.months.filter((m) => !taken.includes(m));
        const pick = (next: string[]) => setStage({ ...stage, picked: plan.months.filter((m) => next.includes(m) && !taken.includes(m)) });
        const toggle = (m: string) => pick(picked.includes(m) ? picked.filter((x) => x !== m) : [...picked, m]);
        const years = [...new Set(plan.months.map((m) => m.slice(0, 4)))];
        return (
          <div data-testid="history-summary">
            <div className="hi-figures" style={{ marginTop: 10 }}>
              <div className="card"><b data-testid="history-rows">{num(plan.rows.length)}</b> {t('stoppages')}<div className="adm-muted-sm">{t('{from} to {to}', { from: plan.dateFrom, to: plan.dateTo })}</div></div>
              <div className="card"><b>{num(Math.round(plan.hours))}</b> {t('stop hours')}<div className="adm-muted-sm">{t('{n} areas: {list}', { n: plan.areas.length, list: plan.areas.join(', ') })}</div></div>
              <div className="card"><b>{plan.months.length}</b> {t('months')}<div className="adm-muted-sm">{monthText(plan.months[0] ?? '')} – {monthText(plan.months[plan.months.length - 1] ?? '')}</div></div>
            </div>
            <ul className="adm-note" data-testid="history-checks">
              {plan.skipped.length > 0 && <li>{t('{n} rows left out: {list}', { n: plan.skipped.length, list: plan.skipped.slice(0, 5).map((s) => t('row {r} ({why})', { r: s.source_row, why: s.why })).join('; ') })}</li>}
              {plan.overDays.length > 0 && <li data-testid="history-overdays">{t('{n} area-days add up to more than 24 hours (entry errors to check; kept, the extra hours run into the next day): {list}', { n: plan.overDays.length, list: plan.overDays.slice(0, 8).map((o) => `${o.area} ${o.date} (${o.hours} h)`).join(', ') })}</li>}
              {plan.duplicates > 0 && <li>{t('{n} rows are exact copies of an earlier row. Kept: without times they may be two real stops.', { n: plan.duplicates })}</li>}
              {(plan.fixes.classification + plan.fixes.failure + plan.fixes.trimmed) > 0 && <li>{t('Spelling put right: classification case {a}, failure Yes / yes {b}, spaces around the reason {c}.', { a: plan.fixes.classification, b: plan.fixes.failure, c: plan.fixes.trimmed })}</li>}
              {taken.length > 0 && <li data-testid="history-taken"><b>{t('Left out because these months already hold stoppages: {list}.', { list: taken.map(monthText).join(', ') })}</b></li>}
            </ul>
            <fieldset className="hi-months" data-testid="history-months">
              <legend>{t('Months to import ({a} of {b})', { a: picked.length, b: free.length })}</legend>
              <div className="chip-row">
                <button type="button" className="btn btn-sm" onClick={() => pick(free)} data-testid="history-months-all">{t('All')}</button>
                <button type="button" className="btn btn-sm" onClick={() => pick([])} data-testid="history-months-none">{t('None')}</button>
              </div>
              {years.map((y) => (
                <div key={y} className="hi-year">
                  <span className="hi-year-label">{y}</span>
                  {plan.months.filter((m) => m.startsWith(y)).map((m) => {
                    const isTaken = taken.includes(m);
                    return (
                      <label key={m} className={`hi-month${isTaken ? ' hi-month--taken' : ''}`} title={isTaken ? t('This month already holds stoppages') : undefined}>
                        <input type="checkbox" checked={picked.includes(m)} disabled={isTaken} onChange={() => toggle(m)} data-testid={`history-month-${m}`} />
                        {monthText(m).split(' ')[0]} <span className="adm-muted-sm">{num(perMonth.get(m) ?? 0)}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </fieldset>
            <div className="chip-row" style={{ marginTop: 8 }}>
              <button type="button" className="btn-primary" disabled={sendable === 0} onClick={() => void send(stage.name, plan, taken, picked)} data-testid="history-send">{t('Import {n} stoppages as history', { n: num(sendable) })}</button>
              <button type="button" className="btn" onClick={() => setStage({ kind: 'idle' })}>{t('Cancel')}</button>
            </div>
          </div>
        );
      })()}
      {stage.kind === 'sending' && (
        <p className="status-line" data-testid="history-progress">
          {stage.progress ? t('Sending part {a} of {b} · {n} added so far', { a: stage.progress.chunksDone, b: stage.progress.totalChunks, n: num(stage.progress.added) }) : t('Starting…')}
        </p>
      )}
      {stage.kind === 'done' && (
        <div className="callout callout--success" data-testid="history-done" style={{ marginTop: 10 }}><Icon name="check" size={16} />
          <span>{t('History imported: {a} stoppages added, {b} already stored, {c} refused.', { a: num(stage.added), b: num(stage.identical), c: num(stage.rejected) })}</span>
        </div>
      )}
    </section>
  );
}
