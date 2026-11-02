// Pieces shared by the six Dispatch & Packing pages: loading / error / empty states, the period bar, a plain table, exports.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ExportMenu from '../components/ExportMenu';
import { PageHeader } from '../components/Tile';
import AccessBadge from '../components/AccessBadge';
import { useAuth } from '../auth/AuthContext';
import { CSV_MIME } from '../export/csv';
import { deliverFile, deliveredText } from '../export/deliverFile';
import { exportFileName } from '../export/files';
import { tableToCsv, tableToSheet, type ExportTable } from '../export/table';
import { buildXlsx, XLSX_MIME } from '../export/xlsx';
import { t } from '../i18n/t';
import { pageById, pageLabel, type PageId } from '../navigation';
import { seriesColor } from '../charts/palette';
import { useTheme } from '../theme/ThemeContext';
import { MONTH_NAMES } from './calc';
import type { DispatchDay } from './model';
import { usePeriod, useDispatchData } from './useDispatchData';
import '../components/ui.css';

export const tons = (n: number): string => Math.round(n).toLocaleString('en-GB');
export const tons1 = (n: number): string => n.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const pc = (x: number, d = 1): string => `${(x * 100).toFixed(d)}%`;
export const monthText = (key: string): string => `${MONTH_NAMES[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;

/** The colour of series slot i in the current theme (never cycled; see charts/palette). */
export function useSeries(): (slot: number) => string {
  const { dark } = useTheme();
  return (slot) => seriesColor(dark, slot);
}

export interface Col<R> { head: string; render: (r: R, i: number) => ReactNode; num?: boolean; key?: string }
/** A plain table. `total` is a last row drawn in bold. */
export function Tbl<R>({ cols, rows, total, testid, caption }: { cols: Col<R>[]; rows: R[]; total?: R; testid?: string; caption?: string }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption ?? testid}>
      <table className="data-table" data-testid={testid}>
        <thead><tr>{cols.map((c, i) => <th key={c.key ?? i} scope="col" className={c.num ? 'num' : undefined}>{c.head}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => <tr key={ri}>{cols.map((c, ci) => <td key={c.key ?? ci} className={c.num ? 'num' : undefined}>{c.render(r, ri)}</td>)}</tr>)}
          {total && <tr className="tbl-total">{cols.map((c, ci) => <td key={c.key ?? ci} className={c.num ? 'num' : undefined}><b>{c.render(total, -1)}</b></td>)}</tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Excel / CSV export of one table, with the note under the button. */
export function useTableExport(base: string) {
  const [note, setNote] = useState('');
  const { user } = useAuth();
  const run = async (table: ExportTable, kind: 'xlsx' | 'csv', period = '') => {
    const name = exportFileName({ base: `dispatch-${base}`, period }, kind);
    try {
      const result = kind === 'xlsx'
        ? await deliverFile(name, buildXlsx([tableToSheet(table)], { title: table.sheet, creator: user?.display_name || user?.email || undefined }), XLSX_MIME)
        : await deliverFile(name, tableToCsv(table), CSV_MIME);
      setNote(deliveredText(result, t('{name} saved.', { name }), name));
    } catch {
      setNote(t('The file could not be made. Try again.'));
    }
  };
  const menu = (table: ExportTable | null, period = '') => (
    <ExportMenu onExcel={() => table && void run(table, 'xlsx', period)} onCsv={() => table && void run(table, 'csv', period)} disabled={!table || table.rows.length === 0} testid={`export-${base}`} />
  );
  return { note, menu };
}

/** From / To month selects. */
export function PeriodBar({ p }: { p: ReturnType<typeof usePeriod> }) {
  if (p.months.length < 2) return null;
  return (
    <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', padding: '10px 16px' }} data-testid="dp-period">
      <div className="field">
        <label htmlFor="dp-from">{t('From')}</label>
        <select id="dp-from" className="select" value={p.from} onChange={(e) => p.setFrom(e.target.value)} data-testid="dp-from">
          {p.months.map((m) => <option key={m} value={m} disabled={m > p.to}>{monthText(m)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="dp-to">{t('To')}</label>
        <select id="dp-to" className="select" value={p.to} onChange={(e) => p.setTo(e.target.value)} data-testid="dp-to">
          {p.months.map((m) => <option key={m} value={m} disabled={m < p.from}>{monthText(m)}</option>)}
        </select>
      </div>
      {!p.all && <button type="button" className="btn btn-sm" onClick={() => { p.setFrom(''); p.setTo(''); }}>{t('Whole period')}</button>}
    </div>
  );
}

/**
 * The page around every Dispatch & Packing screen: header, loading, error and "no data yet" states, then the content for
 * the days in the chosen period. `period` false hides the From / To bar (the Data page shows every day).
 */
export function DispatchPage({ pageId, testid, subtitle, right, period = true, children }: {
  pageId: PageId; testid: string; subtitle?: (days: DispatchDay[]) => ReactNode; right?: ReactNode; period?: boolean;
  children: (ctx: { days: DispatchDay[]; all: DispatchDay[]; data: ReturnType<typeof useDispatchData>; p: ReturnType<typeof usePeriod> }) => ReactNode;
}) {
  const data = useDispatchData();
  const p = usePeriod(data.days);
  const { canEdit } = useAuth();
  const page = pageById(pageId);
  const days = period ? p.days : data.days ?? [];
  let body: ReactNode;
  if (data.error) {
    body = <div className="callout" role="alert"><span>{data.error}</span><button type="button" className="btn btn-sm" onClick={data.reload}>{t('Try again')}</button></div>;
  } else if (!data.days) {
    body = <p className="muted" aria-live="polite">{t('Loading…')}</p>;
  } else if (data.days.length === 0 && pageId !== 'dispatch-data') {
    body = <div className="callout" role="status"><span>{t('No dispatch or packing data has been uploaded yet.')}</span><Link className="btn btn-sm" to="/dispatch/data">{t('Upload the workbook')}</Link></div>;
  } else {
    body = <>{period && <PeriodBar p={p} />}{children({ days, all: data.days, data, p })}</>;
  }
  return (
    <div className="page" data-testid={testid}>
      <PageHeader
        title={pageLabel(page)} compact
        subtitle={data.days && data.days.length ? subtitle?.(days) : undefined}
        right={<>{right}<AccessBadge edit={canEdit('dispatch')} /></>}
      />
      {body}
    </div>
  );
}
