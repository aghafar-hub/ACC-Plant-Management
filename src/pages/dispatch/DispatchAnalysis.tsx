// Dispatch & Packing > Dispatch analysis: by product, mode, month, weekday and week; the biggest days and the days without dispatch.
import { useMemo } from 'react';
import CartesianChart from '../../charts/CartesianChart';
import { ChartCard } from '../../charts/ChartKit';
import { dayStats, monthly, topDays, totals, weekdayProfile, weekly } from '../../dispatch/calc';
import { MODES, PRODUCTS, type DispatchDay } from '../../dispatch/model';
import { DispatchPage, monthText, pc, Tbl, tons, useSeries, useTableExport } from '../../dispatch/ui';
import { exportCol, type ExportTable } from '../../export/table';
import { t } from '../../i18n/t';
import '../../components/ui.css';

function Analysis({ days, periodLabel }: { days: DispatchDay[]; periodLabel: string }) {
  const color = useSeries();
  const exp = useTableExport('analysis');
  const tt = useMemo(() => totals(days), [days]);
  const ms = useMemo(() => monthly(days), [days]);
  const wd = useMemo(() => weekdayProfile(days), [days]);
  const wk = useMemo(() => weekly(days), [days]);
  const top = useMemo(() => topDays(days, 10), [days]);
  const st = useMemo(() => dayStats(days), [days]);
  const rows = PRODUCTS.map((name, i) => ({ name, i })).filter((r) => tt.byProduct[r.i]! > 0 || r.i === 0);
  const hasProduct = rows.filter((r) => tt.byProduct[r.i]! > 0);
  const exportTable: ExportTable = {
    id: 'monthly-by-product', sheet: t('Monthly dispatch'),
    columns: [exportCol(t('Month')), ...PRODUCTS.map((p) => exportCol(`${p} (t)`, 'num')), exportCol(t('Total (t)'), 'num'), ...MODES.map((m) => exportCol(`${m} (t)`, 'num')), exportCol(t('Dispatch days'), 'int')],
    rows: ms.map((m) => [monthText(m.key), ...m.byProduct, m.total, ...m.byMode, m.dispatchDays]),
    total: [t('Total'), ...tt.byProduct, tt.total, ...tt.byMode, tt.dispatchDays],
  };
  const cats = wd.map((w) => ({ key: String(w.weekday), label: w.label.slice(0, 3), full: w.label }));
  const wcats = wk.map((w) => ({ key: String(w.week), label: String(w.week), full: t('Week {n}', { n: w.week }), partial: w.days < 7 }));
  return (
    <>
      <section className="card" data-testid="dp-matrix-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2>{t('Product by delivery mode')}</h2>
          {exp.menu(exportTable, periodLabel)}
        </div>
        <Tbl testid="dp-matrix" caption={t('Product by delivery mode')} rows={hasProduct}
          total={{ name: t('Total'), i: -1 }}
          cols={[
            { head: t('Product'), render: (r) => r.name },
            ...MODES.map((m, j) => ({ head: `${m} t`, num: true, render: (r: { name: string; i: number }) => tons(r.i < 0 ? tt.byMode[j]! : tt.matrix[r.i]![j]!) })),
            { head: t('Total t'), num: true, render: (r) => tons(r.i < 0 ? tt.total : tt.byProduct[r.i]!) },
            { head: t('Share'), num: true, render: (r) => pc(tt.total ? (r.i < 0 ? 1 : tt.byProduct[r.i]! / tt.total) : 0) },
            { head: t('Bulk share of product'), num: true, render: (r) => { const tot = r.i < 0 ? tt.total : tt.byProduct[r.i]!; return pc(tot ? (r.i < 0 ? tt.byMode[1]! : tt.matrix[r.i]![1]!) / tot : 0); } },
          ]} />
        {exp.note && <p className="muted" role="status" style={{ marginTop: 6 }}>{exp.note}</p>}
        <p className="muted" style={{ marginTop: 6 }}>{t('Sling bags are CEM IV/A only and jumbo bags CEM I 52.5 only, as in the workbook.')}</p>
      </section>

      <section className="card">
        <h2>{t('Month by product')}</h2>
        <Tbl testid="dp-monthly-product" caption={t('Monthly dispatch by product')} rows={ms}
          total={{ ...ms[0]!, key: '', label: t('Total'), byProduct: tt.byProduct, total: tt.total, dispatchDays: tt.dispatchDays, days: days.length, avgPerDispatchDay: st.meanDispatchDay }}
          cols={[
            { head: t('Month'), render: (m) => (m.key ? monthText(m.key) : m.label) },
            ...hasProduct.map((r) => ({ head: `${r.name} t`, num: true, render: (m: (typeof ms)[number]) => tons(m.byProduct[r.i]!) })),
            { head: t('Total t'), num: true, render: (m) => tons(m.total) },
            { head: t('Days with dispatch'), num: true, render: (m) => (m.key ? `${m.dispatchDays} / ${m.days}` : `${m.dispatchDays} / ${m.days}`) },
          ]} />
      </section>

      <div className="dp-grid">
        <ChartCard title={t('Average by weekday')} summary={t('Average tons dispatched on each weekday, counting every day of the period.')} testid="dp-ch-weekday"
          table={{ head: [t('Weekday'), t('Days'), t('Total t'), t('Average t')], rows: wd.map((w) => [w.label, w.days, tons(w.total), tons(w.avg)]) }}>
          {(w) => <CartesianChart categories={cats} series={[{ key: 'avg', label: t('Average t / day'), color: color(0), type: 'bar', values: wd.map((x) => x.avg), format: tons }]} width={w} ariaLabel={t('Average dispatch by weekday')} />}
        </ChartCard>
        <ChartCard title={t('Week by week')} subtitle={t('Weeks start on Sunday, as in the workbook; the first and last weeks are partial.')} summary={t('Average tons per day in each week.')} testid="dp-ch-weekly"
          table={{ head: [t('Week'), t('Days'), t('Total t'), t('Average t / day')], rows: wk.map((w) => [w.week, w.days, tons(w.total), tons(w.avg)]) }}>
          {(w) => <CartesianChart categories={wcats} series={[{ key: 'avg', label: t('Average t / day'), color: color(1), type: 'line', values: wk.map((x) => x.avg), format: tons }]} width={w} ariaLabel={t('Weekly average dispatch per day')} zeroBased={false} />}
        </ChartCard>
      </div>

      <div className="dp-grid">
        <section className="card" data-testid="dp-top-days">
          <h2>{t('Ten biggest days')}</h2>
          <Tbl caption={t('Ten biggest days')} rows={top}
            cols={[
              { head: '#', render: (_r, i) => i + 1 },
              { head: t('Date'), render: (r) => r.date },
              { head: t('Total t'), num: true, render: (r) => tons(r.total) },
              { head: t('Bagged t'), num: true, render: (r) => tons(r.bagged) },
              { head: t('Bulk t'), num: true, render: (r) => tons(r.bulk) },
            ]} />
        </section>
        <section className="card" data-testid="dp-day-stats">
          <h2>{t('The days')}</h2>
          <Tbl caption={t('Daily statistics')} rows={[
            [t('Days in the period'), String(days.length)],
            [t('Days with dispatch'), String(tt.dispatchDays)],
            [t('Days without dispatch'), String(st.zeroDays.length)],
            [t('Average per calendar day'), `${tons(st.mean)} t`],
            [t('Average per dispatch day'), `${tons(st.meanDispatchDay)} t`],
            [t('Median day'), `${tons(st.median)} t`],
            [t('Spread (standard deviation)'), `${tons(st.stdev)} t (${pc(st.cv, 0)} of the mean)`],
            [t('Days above 12,000 t'), String(st.over)],
          ]} cols={[{ head: t('Figure'), render: (r) => r[0] }, { head: t('Value'), num: true, render: (r) => r[1] }]} />
          {st.zeroDays.length > 0 && <p className="muted" style={{ marginTop: 8 }} data-testid="dp-zero-days">{t('Days without dispatch: {list}.', { list: st.zeroDays.join(', ') })}</p>}
        </section>
      </div>
    </>
  );
}

export default function DispatchAnalysis() {
  return (
    <DispatchPage pageId="dispatch-analysis" testid="page-dispatch-analysis" subtitle={(d) => (d.length ? t('{a} to {b}', { a: d[0]!.date, b: d[d.length - 1]!.date }) : '')}>
      {({ days }) => <Analysis days={days} periodLabel={days.length ? `${days[0]!.date}_${days[days.length - 1]!.date}` : ''} />}
    </DispatchPage>
  );
}
