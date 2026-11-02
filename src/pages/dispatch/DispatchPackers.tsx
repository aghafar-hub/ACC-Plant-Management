// Dispatch & Packing > Packers: output, rate, availability and where the time goes, packer by packer and line by line.
// Packer stoppage, unplanned and no-trucks hours are kept here only: they are never posted to the downtime analysis.
import { useMemo } from 'react';
import CartesianChart, { type CartSeries } from '../../charts/CartesianChart';
import { ChartCard } from '../../charts/ChartKit';
import { Tile } from '../../components/Tile';
import { fleetTime, lineStats, monthly, packerMonthly, packerStats } from '../../dispatch/calc';
import { N_PACKERS, type DispatchDay, type DispatchSettings } from '../../dispatch/model';
import { DispatchPage, monthText, pc, Tbl, tons, tons1, useSeries, useTableExport } from '../../dispatch/ui';
import { exportCol, type ExportTable } from '../../export/table';
import { t } from '../../i18n/t';
import { useTheme } from '../../theme/ThemeContext';
import '../../components/ui.css';

function Packers({ days, settings, periodLabel }: { days: DispatchDay[]; settings: DispatchSettings; periodLabel: string }) {
  const { T } = useTheme();
  const color = useSeries();
  const exp = useTableExport('packers');
  const ps = useMemo(() => packerStats(days, settings), [days, settings]);
  const ls = useMemo(() => lineStats(ps), [ps]);
  const ms = useMemo(() => monthly(days), [days]);
  const pm = useMemo(() => packerMonthly(days), [days]);
  const fl = useMemo(() => fleetTime(days), [days]);
  const cal = days.length * 24 * N_PACKERS;
  const availability = cal ? fl.runH / cal : 0;
  const noTruck = cal ? fl.noTruckH / cal : 0;
  const tonsAll = ps.reduce((a, p) => a + p.tons, 0);
  const rate = fl.runH ? tonsAll / fl.runH : 0;
  const weakest = [...ps].sort((a, b) => a.availability - b.availability)[0];
  const rated = settings.ratedTph.some((r) => r > 0);
  const packerCats = ps.map((p) => ({ key: `P${p.packer}`, label: `P${p.packer}`, full: `Packer ${p.packer}` }));
  const cats = ms.map((m) => ({ key: m.key, label: m.label, full: monthText(m.key) }));
  const pctF = (n: number) => `${n.toFixed(1)}%`;
  const timeSeries: CartSeries[] = [
    { key: 'run', label: t('Running'), color: color(2), type: 'bar', stack: 't', values: ps.map((p) => p.runShare * 100), format: pctF },
    { key: 'nt', label: t('No trucks'), color: color(1), type: 'bar', stack: 't', values: ps.map((p) => p.noTruckShare * 100), format: pctF },
    { key: 'un', label: t('Unplanned stop'), color: color(7), type: 'bar', stack: 't', values: ps.map((p) => p.unplannedShare * 100), format: pctF },
    { key: 'ot', label: t('Other stoppage'), color: color(3), type: 'bar', stack: 't', values: ps.map((p) => p.otherShare * 100), format: pctF },
  ];
  const fleetSeries: CartSeries[] = [
    { key: 'run', label: t('Running'), color: color(2), type: 'bar', stack: 'f', values: ms.map((m) => m.runH), format: tons },
    { key: 'nt', label: t('No trucks'), color: color(1), type: 'bar', stack: 'f', values: ms.map((m) => m.noTruckH), format: tons },
    { key: 'un', label: t('Unplanned stop'), color: color(7), type: 'bar', stack: 'f', values: ms.map((m) => m.unplannedH), format: tons },
    { key: 'ot', label: t('Other stoppage'), color: color(3), type: 'bar', stack: 'f', values: ms.map((m) => m.otherStopH), format: tons },
  ];
  const legend = (s: CartSeries[]) => s.map((x) => ({ label: x.label, color: x.color, symbol: 'bar' as const }));
  const exportTable: ExportTable = {
    id: 'packers', sheet: t('Packers'),
    columns: [exportCol(t('Packer')), exportCol(t('Line'), 'int'), exportCol(t('Packed (t)'), 'num'), exportCol(t('Running (h)'), 'h1'), exportCol(t('Rate (t/h)'), 'h1'), exportCol(t('Availability'), 'pct'), exportCol(t('No trucks (h)'), 'h1'), exportCol(t('Unplanned (h)'), 'h1'), exportCol(t('Other stoppage (h)'), 'h1'), exportCol(t('Days operated'), 'int'), exportCol(t('Best day (t)'), 'num')],
    rows: ps.map((p) => [`Packer ${p.packer}`, p.line, p.tons, p.runH, p.rate, p.availability * 100, p.noTruckH, p.unplannedH, p.otherStopH, p.daysOperated, p.bestDay]),
  };
  const tableOf = (head: string[], rows: (string | number)[][]) => ({ head, rows });
  return (
    <>
      <div className="tiles" data-testid="dp-packer-tiles">
        <Tile icon="tool" label={t('Packed')} value={`${tons(tonsAll)} t`} sub={t('{n} packers', { n: N_PACKERS })} testid="pk-tons" />
        <Tile icon="trend" label={t('Rate while running')} value={`${tons1(rate)} t/h`} sub={rated ? t('rated {n} t/h on average', { n: tons1(settings.ratedTph.filter((r) => r > 0).reduce((a, b) => a + b, 0) / Math.max(1, settings.ratedTph.filter((r) => r > 0).length)) }) : t('no rated capacity set')} testid="pk-rate" />
        <Tile icon="clock" label={t('Running availability')} value={pc(availability)} tone={settings.availabilityTargetPct && availability * 100 < settings.availabilityTargetPct ? T.warning : undefined} sub={settings.availabilityTargetPct ? t('target {n}%', { n: settings.availabilityTargetPct }) : t('of calendar hours')} testid="pk-avail" />
        <Tile icon="alert" label={t('Waiting for trucks')} value={pc(noTruck)} tone={settings.noTrucksMaxPct && noTruck * 100 > settings.noTrucksMaxPct ? T.warning : undefined} sub={settings.noTrucksMaxPct ? t('limit {n}%', { n: settings.noTrucksMaxPct }) : `${tons(fl.noTruckH)} h`} testid="pk-notruck" />
        <Tile icon="ban" label={t('Unplanned stops')} value={pc(cal ? fl.unplannedH / cal : 0)} sub={`${tons(fl.unplannedH)} h`} testid="pk-unplanned" />
        <Tile icon="flag" label={t('Least running packer')} value={weakest ? `Packer ${weakest.packer}` : '-'} sub={weakest ? t('{p} availability', { p: pc(weakest.availability) }) : undefined} testid="pk-weakest" />
      </div>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2>{t('Packer by packer')}</h2>
          {exp.menu(exportTable, periodLabel)}
        </div>
        <Tbl testid="dp-packer-table" caption={t('Packers')} rows={ps}
          total={{ ...ps[0]!, packer: 0, line: 0, tons: tonsAll, share: 1, runH: fl.runH, rate, availability, noTruckH: fl.noTruckH, unplannedH: fl.unplannedH, otherStopH: fl.otherStopH, daysOperated: ps.reduce((a, p) => a + p.daysOperated, 0), bestDay: Math.max(...ps.map((p) => p.bestDay)), avgPerOperatingDay: 0, utilisation: null }}
          cols={[
            { head: t('Packer'), render: (p) => (p.packer ? `Packer ${p.packer} (line ${p.line})` : t('Fleet')) },
            { head: t('Packed t'), num: true, render: (p) => tons(p.tons) },
            { head: t('Share'), num: true, render: (p) => pc(p.share) },
            { head: t('Running h'), num: true, render: (p) => tons(p.runH) },
            { head: t('Rate t/h'), num: true, render: (p) => tons1(p.rate) },
            ...(rated ? [{ head: t('Of rated'), num: true, render: (p: (typeof ps)[number]) => (p.utilisation == null ? '-' : pc(p.utilisation, 0)) }] : []),
            { head: t('Availability'), num: true, render: (p) => pc(p.availability) },
            { head: t('No trucks h'), num: true, render: (p) => tons(p.noTruckH) },
            { head: t('Unplanned h'), num: true, render: (p) => tons(p.unplannedH) },
            { head: t('Other stoppage h'), num: true, render: (p) => tons(p.otherStopH) },
            { head: t('Best day t'), num: true, render: (p) => tons(p.bestDay) },
          ]} />
        {exp.note && <p className="muted" role="status" style={{ marginTop: 6 }}>{exp.note}</p>}
        <p className="muted" style={{ marginTop: 6 }}>{t('Other stoppage is the rest of each packer\'s non-running hours after no-trucks and unplanned time. These hours belong to this section only; they are not downtime events.')}</p>
      </section>

      <div className="dp-grid">
        <ChartCard title={t('Packer output')} summary={t('Tons packed by each packer.')} testid="pk-ch-tons" table={tableOf([t('Packer'), t('Tons')], ps.map((p) => [`P${p.packer}`, tons(p.tons)]))}>
          {(w) => <CartesianChart categories={packerCats} series={[{ key: 'tons', label: t('Tons'), color: color(0), type: 'bar', values: ps.map((p) => p.tons), format: tons }]} width={w} ariaLabel={t('Tons packed per packer')} yFormat={(n) => `${Math.round(n / 1000)}k`} />}
        </ChartCard>
        <ChartCard title={t('Rate while running')} summary={t('Tons per running hour of each packer.')} legend={rated ? [{ label: t('Rate'), color: color(1), symbol: 'bar' }, { label: t('Rated capacity'), color: 'var(--tk-text-primary)', symbol: 'dash' }] : undefined} testid="pk-ch-rate"
          table={tableOf([t('Packer'), t('t/h'), t('Rated t/h')], ps.map((p) => [`P${p.packer}`, tons1(p.rate), settings.ratedTph[p.packer - 1] ? tons1(settings.ratedTph[p.packer - 1]!) : '-']))}>
          {(w) => <CartesianChart categories={packerCats} series={[
            { key: 'rate', label: t('t/h'), color: color(1), type: 'bar', values: ps.map((p) => p.rate), format: tons1 },
            ...(rated ? [{ key: 'rated', label: t('Rated t/h'), color: 'var(--tk-text-primary)', type: 'line' as const, dash: '5 4', marker: 'diamond' as const, values: ps.map((p) => settings.ratedTph[p.packer - 1] || null), format: tons1 }] : []),
          ]} width={w} ariaLabel={t('Packing rate per packer')} />}
        </ChartCard>
        <ChartCard title={t('Where the time goes')} summary={t('Share of calendar hours each packer was running, waiting for trucks, stopped unplanned or stopped for other reasons.')} legend={legend(timeSeries)} testid="pk-ch-time"
          table={tableOf([t('Packer'), t('Running %'), t('No trucks %'), t('Unplanned %'), t('Other %')], ps.map((p) => [`P${p.packer}`, pc(p.runShare), pc(p.noTruckShare), pc(p.unplannedShare), pc(p.otherShare)]))}>
          {(w) => <CartesianChart categories={packerCats} series={timeSeries} width={w} ariaLabel={t('Packer time allocation')} yMax={100} yFormat={(n) => `${n}%`} />}
        </ChartCard>
        <ChartCard title={t('Fleet hours by month')} summary={t('Hours of all six packers by status, each month.')} legend={legend(fleetSeries)} testid="pk-ch-fleet"
          table={tableOf([t('Month'), t('Running h'), t('No trucks h'), t('Unplanned h'), t('Other h')], ms.map((m) => [monthText(m.key), tons(m.runH), tons(m.noTruckH), tons(m.unplannedH), tons(m.otherStopH)]))}>
          {(w) => <CartesianChart categories={cats} series={fleetSeries} width={w} ariaLabel={t('Fleet hours by status per month')} yFormat={(n) => `${Math.round(n / 100) / 10}k`} />}
        </ChartCard>
        <ChartCard title={t('Monthly output per packer')} summary={t('Tons packed each month by each packer.')} legend={ps.map((p) => ({ label: `Packer ${p.packer}`, color: color(p.packer - 1), symbol: 'circle' as const }))} testid="pk-ch-monthly"
          table={tableOf([t('Month'), ...ps.map((p) => `P${p.packer}`)], pm.map((m) => [monthText(m.key), ...m.tons.map(tons)]))}>
          {(w) => <CartesianChart categories={cats} series={ps.map((p, i) => ({ key: `p${i}`, label: `Packer ${p.packer}`, color: color(i), type: 'line' as const, marker: (['circle', 'square', 'diamond', 'triangle'] as const)[i % 4], values: pm.map((m) => m.tons[i]!), format: tons }))} width={w} ariaLabel={t('Monthly tons per packer')} yFormat={(n) => `${Math.round(n / 1000)}k`} />}
        </ChartCard>
        <ChartCard title={t('Packing rate by month')} summary={t('Tons per running hour of the six packers together.')} testid="pk-ch-rate-month"
          table={tableOf([t('Month'), t('t/h')], ms.map((m) => [monthText(m.key), tons1(m.rate)]))}>
          {(w) => <CartesianChart categories={cats} series={[{ key: 'r', label: 't/h', color: color(0), type: 'line', marker: 'circle', values: ms.map((m) => m.rate), format: tons1 }]} width={w} ariaLabel={t('Fleet packing rate by month')} zeroBased={false} />}
        </ChartCard>
      </div>

      <section className="card" data-testid="dp-lines">
        <h2>{t('Line 1 and line 2')}</h2>
        <Tbl caption={t('Lines')} rows={ls}
          cols={[
            { head: t('Line'), render: (l) => `Line ${l.line} (packers ${l.line === 1 ? '1-3' : '4-6'})` },
            { head: t('Packed t'), num: true, render: (l) => tons(l.tons) },
            { head: t('Running h'), num: true, render: (l) => tons(l.runH) },
            { head: t('Rate t/h'), num: true, render: (l) => tons1(l.rate) },
            { head: t('No trucks h'), num: true, render: (l) => tons(l.noTruckH) },
            { head: t('No trucks, share of time'), num: true, render: (l) => pc(l.noTruckShare) },
          ]} />
      </section>
    </>
  );
}

export default function DispatchPackers() {
  return (
    <DispatchPage pageId="dispatch-packers" testid="page-dispatch-packers" subtitle={(d) => (d.length ? t('{a} to {b} · stoppage hours here are not downtime', { a: d[0]!.date, b: d[d.length - 1]!.date }) : '')}>
      {({ days, data }) => <Packers days={days} settings={data.settings} periodLabel={days.length ? `${days[0]!.date}_${days[days.length - 1]!.date}` : ''} />}
    </DispatchPage>
  );
}
