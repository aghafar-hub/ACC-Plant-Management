// Dispatch & Packing > Dashboard: the headline numbers, the charts and the summary tables of the whole section.
import { useMemo } from 'react';
import CartesianChart, { type CartSeries } from '../../charts/CartesianChart';
import { ChartCard } from '../../charts/ChartKit';
import { Tile } from '../../components/Tile';
import { dayStats, fleetTime, lineStats, monthly, packerStats, totals } from '../../dispatch/calc';
import { insights } from '../../dispatch/insights';
import { CLINKER_TYPES, MODES, PRODUCTS, type DispatchDay, type DispatchSettings } from '../../dispatch/model';
import { DispatchPage, monthText, pc, Tbl, tons, tons1, useSeries } from '../../dispatch/ui';
import { t } from '../../i18n/t';
import { useTheme } from '../../theme/ThemeContext';
import '../../components/ui.css';

function Dashboard({ days, settings }: { days: DispatchDay[]; settings: DispatchSettings }) {
  const { T } = useTheme();
  const color = useSeries();
  const tt = useMemo(() => totals(days), [days]);
  const ms = useMemo(() => monthly(days, settings), [days, settings]);
  const ps = useMemo(() => packerStats(days, settings), [days, settings]);
  const ls = useMemo(() => lineStats(ps), [ps]);
  const st = useMemo(() => dayStats(days), [days]);
  const fl = useMemo(() => fleetTime(days), [days]);
  const lines = useMemo(() => insights(days, settings), [days, settings]);
  const cats = ms.map((m) => ({ key: m.key, label: m.label, full: monthText(m.key) }));
  const fleetCal = days.length * 24 * 6;
  const availability = fleetCal ? fl.runH / fleetCal : 0;
  const noTruck = fleetCal ? fl.noTruckH / fleetCal : 0;
  const rate = fl.runH ? tt.packed / fl.runH : 0;
  const bulkShare = tt.total ? tt.byMode[1]! / tt.total : 0;
  const targetTotal = ms.reduce((a, m) => a + m.target, 0);
  const targetBase = ms.filter((m) => m.target > 0).reduce((a, m) => a + m.total, 0);
  const availBad = settings.availabilityTargetPct != null && settings.availabilityTargetPct > 0 && availability * 100 < settings.availabilityTargetPct;
  const noTruckBad = settings.noTrucksMaxPct != null && settings.noTrucksMaxPct > 0 && noTruck * 100 > settings.noTrucksMaxPct;

  const productSeries: CartSeries[] = PRODUCTS.map((p, i) => ({ key: `p${i}`, label: p, color: color(i), type: 'bar' as const, stack: 'p', values: ms.map((m) => m.byProduct[i]!), format: tons })).filter((s) => s.values.some((v) => v > 0));
  if (ms.some((m) => m.target > 0)) productSeries.push({ key: 'target', label: t('Target'), color: 'var(--tk-text-primary)', type: 'line', values: ms.map((m) => (m.target > 0 ? m.target : null)), dash: '5 4', marker: 'diamond', format: tons });
  const modeSeries: CartSeries[] = MODES.map((m, i) => ({ key: `m${i}`, label: m, color: color(i), type: 'bar' as const, stack: 'm', values: ms.map((r) => r.byMode[i]!), format: tons })).filter((s) => s.values.some((v) => v > 0));
  const timeSeries: CartSeries[] = [
    { key: 'run', label: t('Running'), color: color(2), type: 'bar', stack: 't', values: ps.map((p) => p.runShare * 100), format: (n) => `${n.toFixed(1)}%` },
    { key: 'nt', label: t('No trucks'), color: color(1), type: 'bar', stack: 't', values: ps.map((p) => p.noTruckShare * 100), format: (n) => `${n.toFixed(1)}%` },
    { key: 'un', label: t('Unplanned stop'), color: color(7), type: 'bar', stack: 't', values: ps.map((p) => p.unplannedShare * 100), format: (n) => `${n.toFixed(1)}%` },
    { key: 'ot', label: t('Other stoppage'), color: color(3), type: 'bar', stack: 't', values: ps.map((p) => p.otherShare * 100), format: (n) => `${n.toFixed(1)}%` },
  ];
  const clinkerKeys = ['opc', 'src', 'over60', 'lowAlk'] as const;
  const clinkerSeries: CartSeries[] = CLINKER_TYPES.map((c, i) => ({ key: clinkerKeys[i]!, label: c, color: color(i), type: 'bar' as const, stack: 'c', values: ms.map((m) => days.filter((d) => d.date.startsWith(m.key)).reduce((a, d) => a + d.clinker[clinkerKeys[i]!], 0)), format: tons })).filter((s) => s.values.some((v) => v > 0));
  const legendOf = (s: CartSeries[]) => s.map((x) => ({ label: x.label, color: x.color, symbol: x.type === 'line' ? ('dash' as const) : ('bar' as const) }));
  const table = (head: string[], rows: (string | number)[][]) => ({ head, rows });
  const packerCats = ps.map((p) => ({ key: `P${p.packer}`, label: `P${p.packer}`, full: `Packer ${p.packer}` }));

  return (
    <>
      <div className="tiles" data-testid="dp-tiles">
        <Tile icon="route" label={t('Cement dispatched')} value={`${tons(tt.total)} t`} sub={targetTotal > 0 ? t('{p} of the target', { p: pc(targetBase / targetTotal, 0) }) : t('{n} days with dispatch', { n: tt.dispatchDays })} testid="dp-total" />
        <Tile icon="trend" label={t('Bulk share')} value={pc(bulkShare)} sub={t('bagged {a} · sling {b}', { a: pc(tt.total ? tt.byMode[0]! / tt.total : 0, 0), b: pc(tt.total ? tt.byMode[2]! / tt.total : 0, 0) })} testid="dp-bulk" />
        <Tile icon="calendar" label={t('Per dispatch day')} value={`${tons(st.meanDispatchDay)} t`} sub={st.peak ? t('peak {n} t on {d}', { n: tons(st.peak.total), d: st.peak.date }) : undefined} testid="dp-avg" />
        <Tile icon="flask" label={t('Clinker dispatched')} value={`${tons(tt.clinker.total)} t`} sub={tt.clinker.total ? t('{p} low alkaline', { p: pc(tt.clinker.lowAlk / tt.clinker.total, 0) }) : undefined} testid="dp-clinker" />
        <Tile icon="tool" label={t('Packing rate')} value={`${tons1(rate)} t/h`} sub={t('while running, six packers')} testid="dp-rate" />
        <Tile icon="clock" label={t('Packer availability')} value={pc(availability)} tone={availBad ? T.warning : undefined} sub={settings.availabilityTargetPct ? t('target {n}%', { n: settings.availabilityTargetPct }) : t('running / calendar hours')} testid="dp-avail" />
        <Tile icon="alert" label={t('Waiting for trucks')} value={pc(noTruck)} tone={noTruckBad ? T.warning : undefined} sub={settings.noTrucksMaxPct ? t('limit {n}%', { n: settings.noTrucksMaxPct }) : t('of calendar hours')} testid="dp-notruck" />
        <Tile icon="thermometer" label={t('Packing power')} value={`${(tt.total ? (tt.powerMWh * 1000) / tt.total : 0).toFixed(2)} kWh/t`} sub={t('substations 691 + 692')} testid="dp-power" />
      </div>

      <section className="card" data-testid="dp-insights">
        <h2>{t('What the data shows')}</h2>
        <ul style={{ margin: '6px 0 0', paddingInlineStart: 20, color: 'var(--tk-text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </section>

      <div className="dp-grid">
        <ChartCard title={t('Dispatch by product')} summary={t('Tons dispatched each month, by product.')} legend={legendOf(productSeries)} testid="dp-ch-product"
          table={table([t('Month'), ...PRODUCTS.map((p) => p)], ms.map((m) => [monthText(m.key), ...m.byProduct.map(tons)]))}>
          {(w) => <CartesianChart categories={cats} series={productSeries} width={w} ariaLabel={t('Monthly dispatch by product')} yFormat={(n) => `${Math.round(n / 1000)}k`} />}
        </ChartCard>
        <ChartCard title={t('Dispatch by delivery mode')} summary={t('Tons dispatched each month: bagged, bulk, sling and jumbo bags.')} legend={legendOf(modeSeries)} testid="dp-ch-mode"
          table={table([t('Month'), ...MODES], ms.map((m) => [monthText(m.key), ...m.byMode.map(tons)]))}>
          {(w) => <CartesianChart categories={cats} series={modeSeries} width={w} ariaLabel={t('Monthly dispatch by delivery mode')} yFormat={(n) => `${Math.round(n / 1000)}k`} />}
        </ChartCard>
        <ChartCard title={t('Average per dispatch day')} summary={t('Tons per day that had dispatch, by month.')} testid="dp-ch-avg"
          table={table([t('Month'), t('t / dispatch day')], ms.map((m) => [monthText(m.key), tons(m.avgPerDispatchDay)]))}>
          {(w) => <CartesianChart categories={cats} series={[{ key: 'avg', label: t('t / dispatch day'), color: color(0), type: 'line', values: ms.map((m) => m.avgPerDispatchDay), marker: 'circle', format: tons }]} width={w} ariaLabel={t('Average dispatch per dispatch day')} zeroBased={false} />}
        </ChartCard>
        <ChartCard title={t('Packer time')} summary={t('Share of calendar hours each packer was running, waiting for trucks, stopped unplanned or stopped for other reasons.')} legend={legendOf(timeSeries)} testid="dp-ch-time"
          table={table([t('Packer'), t('Running %'), t('No trucks %'), t('Unplanned %'), t('Other %')], ps.map((p) => [`P${p.packer}`, pc(p.runShare), pc(p.noTruckShare), pc(p.unplannedShare), pc(p.otherShare)]))}>
          {(w) => <CartesianChart categories={packerCats} series={timeSeries} width={w} ariaLabel={t('Packer time allocation')} yMax={100} yFormat={(n) => `${n}%`} />}
        </ChartCard>
        <ChartCard title={t('Packer output')} summary={t('Tons packed by each packer.')} testid="dp-ch-packers"
          table={table([t('Packer'), t('Tons'), t('t/h while running')], ps.map((p) => [`P${p.packer}`, tons(p.tons), tons1(p.rate)]))}>
          {(w) => <CartesianChart categories={packerCats} series={[{ key: 'tons', label: t('Tons'), color: color(0), type: 'bar', values: ps.map((p) => p.tons), format: tons }]} width={w} ariaLabel={t('Tons packed per packer')} yFormat={(n) => `${Math.round(n / 1000)}k`} />}
        </ChartCard>
        <ChartCard title={t('Clinker dispatch')} summary={t('Clinker dispatched each month, by type.')} legend={legendOf(clinkerSeries)} testid="dp-ch-clinker"
          table={table([t('Month'), ...CLINKER_TYPES], ms.map((m) => [monthText(m.key), ...clinkerKeys.map((k) => tons(days.filter((d) => d.date.startsWith(m.key)).reduce((a, d) => a + d.clinker[k], 0)))]))}>
          {(w) => <CartesianChart categories={cats} series={clinkerSeries} width={w} ariaLabel={t('Monthly clinker dispatch')} yFormat={(n) => `${Math.round(n / 1000)}k`} />}
        </ChartCard>
      </div>

      <section className="card">
        <h2>{t('Month by month')}</h2>
        <Tbl testid="dp-monthly" caption={t('Monthly summary')} rows={ms} total={{ ...ms[0]!, label: t('Total'), key: '', days: days.length, dispatchDays: tt.dispatchDays, total: tt.total, byMode: tt.byMode, bulkShare, avgPerDispatchDay: st.meanDispatchDay, clinker: tt.clinker.total, rate, kwhPerTonne: tt.total ? (tt.powerMWh * 1000) / tt.total : 0 }}
          cols={[
            { head: t('Month'), render: (m) => (m.key ? monthText(m.key) : m.label) },
            { head: t('Dispatched t'), num: true, render: (m) => tons(m.total) },
            { head: t('Bagged t'), num: true, render: (m) => tons(m.byMode[0]!) },
            { head: t('Bulk t'), num: true, render: (m) => tons(m.byMode[1]!) },
            { head: t('Sling + jumbo t'), num: true, render: (m) => tons(m.byMode[2]! + m.byMode[3]!) },
            { head: t('Bulk share'), num: true, render: (m) => pc(m.bulkShare) },
            { head: t('Per dispatch day t'), num: true, render: (m) => tons(m.avgPerDispatchDay) },
            { head: t('Clinker t'), num: true, render: (m) => tons(m.clinker) },
            { head: t('Packing t/h'), num: true, render: (m) => tons1(m.rate) },
            { head: t('kWh/t'), num: true, render: (m) => m.kwhPerTonne.toFixed(2) },
            ...(ms.some((m) => m.target > 0) ? [{ head: t('Target t'), num: true, render: (m: (typeof ms)[number]) => (m.key ? (m.target > 0 ? tons(m.target) : '-') : tons(targetTotal)) }] : []),
          ]} />
      </section>

      <section className="card">
        <h2>{t('Packers and lines')}</h2>
        <Tbl testid="dp-packers" caption={t('Packers')} rows={ps}
          cols={[
            { head: t('Packer'), render: (p) => `Packer ${p.packer} (line ${p.line})` },
            { head: t('Packed t'), num: true, render: (p) => tons(p.tons) },
            { head: t('Share'), num: true, render: (p) => pc(p.share) },
            { head: t('Running h'), num: true, render: (p) => tons(p.runH) },
            { head: t('t/h'), num: true, render: (p) => tons1(p.rate) },
            { head: t('Availability'), num: true, render: (p) => pc(p.availability) },
            { head: t('No trucks h'), num: true, render: (p) => tons(p.noTruckH) },
            { head: t('Unplanned h'), num: true, render: (p) => tons(p.unplannedH) },
          ]} />
        <p className="muted" style={{ marginTop: 8 }}>
          {ls.map((l) => t('Line {n}: {t} t packed, {h} h waiting for trucks ({p} of the line\'s time).', { n: l.line, t: tons(l.tons), h: tons(l.noTruckH), p: pc(l.noTruckShare) })).join(' ')}
        </p>
      </section>
    </>
  );
}

export default function DispatchDashboard() {
  return (
    <DispatchPage pageId="dispatch" testid="page-dispatch" subtitle={(d) => (d.length ? t('{a} to {b} · {n} days', { a: d[0]!.date, b: d[d.length - 1]!.date, n: d.length }) : t('No days in this period'))}>
      {({ days, data }) => <Dashboard days={days} settings={data.settings} />}
    </DispatchPage>
  );
}
