// Dispatch & Packing > Bags, clinker and power: bag use and breakage (estimates), sling and jumbo bags, clinker dispatch, packing power.
import { useMemo } from 'react';
import CartesianChart, { type CartSeries } from '../../charts/CartesianChart';
import { ChartCard } from '../../charts/ChartKit';
import { Tile } from '../../components/Tile';
import { brokenRate, monthly, packerStats, totals } from '../../dispatch/calc';
import { CLINKER_TYPES, type DispatchDay } from '../../dispatch/model';
import { DispatchPage, monthText, pc, Tbl, tons, useSeries, useTableExport } from '../../dispatch/ui';
import { exportCol, type ExportTable } from '../../export/table';
import { t } from '../../i18n/t';
import '../../components/ui.css';

const KEYS = ['opc', 'src', 'over60', 'lowAlk'] as const;

function Bags({ days, periodLabel }: { days: DispatchDay[]; periodLabel: string }) {
  const color = useSeries();
  const exp = useTableExport('bags-clinker-power');
  const tt = useMemo(() => totals(days), [days]);
  const ms = useMemo(() => monthly(days), [days]);
  const ps = useMemo(() => packerStats(days), [days]);
  const cats = ms.map((m) => ({ key: m.key, label: m.label, full: monthText(m.key) }));
  const clinkerBy = (key: string, k: (typeof KEYS)[number]) => days.filter((d) => d.date.startsWith(key)).reduce((a, d) => a + d.clinker[k], 0);
  const power = ms.map((m) => ({
    key: m.key,
    s691: days.filter((d) => d.date.startsWith(m.key)).reduce((a, d) => a + d.power[0], 0),
    s692: days.filter((d) => d.date.startsWith(m.key)).reduce((a, d) => a + d.power[1], 0),
    perDispatched: m.kwhPerTonne, perPacked: m.packed ? (m.powerMWh * 1000) / m.packed : 0,
  }));
  const clinkerSeries: CartSeries[] = CLINKER_TYPES.map((c, i) => ({ key: KEYS[i]!, label: c, color: color(i), type: 'bar' as const, stack: 'c', values: ms.map((m) => clinkerBy(m.key, KEYS[i]!)), format: tons })).filter((s) => s.values.some((v) => v > 0));
  const slingDisp = ms.map((m) => days.filter((d) => d.date.startsWith(m.key)).reduce((a, d) => a + d.slingManual + d.slingPalletizer, 0));
  const tableOf = (head: string[], rows: (string | number)[][]) => ({ head, rows });
  const exportTable: ExportTable = {
    id: 'monthly', sheet: t('Bags, clinker, power'),
    columns: [exportCol(t('Month')), exportCol(t('Bags used (est.)'), 'num'), exportCol(t('Broken bags (est.)'), 'num'), exportCol(t('Sling production (t)'), 'num'), exportCol(t('Sling dispatched (t)'), 'num'), ...CLINKER_TYPES.map((c) => exportCol(`${c} (t)`, 'num')), exportCol(t('Power 691 (MWh)'), 'h1'), exportCol(t('Power 692 (MWh)'), 'h1'), exportCol(t('kWh per t dispatched'), 'h2')],
    rows: ms.map((m, i) => [monthText(m.key), m.bagsUsed, m.broken, m.slingProduction, slingDisp[i]!, ...KEYS.map((k) => clinkerBy(m.key, k)), power[i]!.s691, power[i]!.s692, m.kwhPerTonne]),
  };
  return (
    <>
      <div className="callout" role="note" data-testid="dp-estimate-note">
        <span>{t('Bags used are tons × 20 and broken bags are the used bags × a fixed rate set in the workbook (0.35 % for machine bags). They are estimates, not counts. The workbook\'s own "broken %" column is ten times too high; the rates shown here are worked out correctly.')}</span>
      </div>
      <div className="tiles">
        <Tile icon="list" label={t('Bags used (estimate)')} value={tons(tt.bagsUsed)} sub={t('50 kg bags, tons × 20')} testid="bg-used" />
        <Tile icon="ban" label={t('Broken bags (estimate)')} value={tons(tt.broken)} sub={pc(brokenRate(tt.bagsUsed, tt.broken), 2)} testid="bg-broken" />
        <Tile icon="flask" label={t('Clinker dispatched')} value={`${tons(tt.clinker.total)} t`} sub={tt.clinker.total ? t('{p} low alkaline', { p: pc(tt.clinker.lowAlk / tt.clinker.total, 0) }) : undefined} testid="bg-clinker" />
        <Tile icon="thermometer" label={t('Packing power')} value={`${tons(tt.powerMWh)} MWh`} sub={tt.total ? t('{n} kWh per t dispatched', { n: ((tt.powerMWh * 1000) / tt.total).toFixed(2) }) : undefined} testid="bg-power" />
        <Tile icon="route" label={t('Sling bags')} value={`${tons(tt.byMode[2]!)} t`} sub={t('production {n} t', { n: tons(tt.slingProduction) })} testid="bg-sling" />
      </div>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2>{t('Month by month')}</h2>
          {exp.menu(exportTable, periodLabel)}
        </div>
        <Tbl testid="dp-bags-monthly" caption={t('Bags, clinker and power by month')} rows={ms.map((m, i) => ({ m, i }))}
          cols={[
            { head: t('Month'), render: (r) => monthText(r.m.key) },
            { head: t('Bags used'), num: true, render: (r) => tons(r.m.bagsUsed) },
            { head: t('Broken (est.)'), num: true, render: (r) => tons(r.m.broken) },
            { head: t('Broken %'), num: true, render: (r) => pc(brokenRate(r.m.bagsUsed, r.m.broken), 2) },
            { head: t('Sling made t'), num: true, render: (r) => tons(r.m.slingProduction) },
            { head: t('Sling sent t'), num: true, render: (r) => tons(slingDisp[r.i]!) },
            { head: t('Clinker t'), num: true, render: (r) => tons(r.m.clinker) },
            { head: t('Power MWh'), num: true, render: (r) => tons(r.m.powerMWh) },
            { head: t('kWh/t sent'), num: true, render: (r) => r.m.kwhPerTonne.toFixed(2) },
            { head: t('kWh/t packed'), num: true, render: (r) => power[r.i]!.perPacked.toFixed(2) },
          ]} />
        {exp.note && <p className="muted" role="status" style={{ marginTop: 6 }}>{exp.note}</p>}
      </section>

      <div className="dp-grid">
        <ChartCard title={t('Estimated broken bags')} summary={t('Broken bags each month, estimated from the fixed rates.')} testid="bg-ch-broken"
          table={tableOf([t('Month'), t('Broken bags')], ms.map((m) => [monthText(m.key), tons(m.broken)]))}>
          {(w) => <CartesianChart categories={cats} series={[{ key: 'b', label: t('Broken bags (est.)'), color: color(7), type: 'bar', values: ms.map((m) => m.broken), format: tons }]} width={w} ariaLabel={t('Estimated broken bags per month')} />}
        </ChartCard>
        <ChartCard title={t('Sling bags: made and sent')} summary={t('Sling production and sling tons dispatched each month.')} legend={[{ label: t('Produced'), color: color(0), symbol: 'bar' }, { label: t('Dispatched'), color: color(1), symbol: 'bar' }]} testid="bg-ch-sling"
          table={tableOf([t('Month'), t('Produced t'), t('Dispatched t')], ms.map((m, i) => [monthText(m.key), tons(m.slingProduction), tons(slingDisp[i]!)]))}>
          {(w) => <CartesianChart categories={cats} series={[
            { key: 'p', label: t('Produced'), color: color(0), type: 'bar', values: ms.map((m) => m.slingProduction), format: tons },
            { key: 'd', label: t('Dispatched'), color: color(1), type: 'bar', values: slingDisp, format: tons, hatch: true },
          ]} width={w} ariaLabel={t('Sling production and dispatch')} />}
        </ChartCard>
        <ChartCard title={t('Clinker dispatch')} summary={t('Clinker dispatched each month, by type.')} legend={clinkerSeries.map((s) => ({ label: s.label, color: s.color, symbol: 'bar' as const }))} testid="bg-ch-clinker"
          table={tableOf([t('Month'), ...CLINKER_TYPES], ms.map((m) => [monthText(m.key), ...KEYS.map((k) => tons(clinkerBy(m.key, k)))]))}>
          {(w) => <CartesianChart categories={cats} series={clinkerSeries} width={w} ariaLabel={t('Monthly clinker dispatch by type')} yFormat={(n) => `${Math.round(n / 1000)}k`} />}
        </ChartCard>
        <ChartCard title={t('Packing power')} summary={t('MWh used by the two packing substations each month.')} legend={[{ label: '691', color: color(0), symbol: 'bar' }, { label: '692', color: color(1), symbol: 'bar' }]} testid="bg-ch-power"
          table={tableOf([t('Month'), '691 MWh', '692 MWh'], power.map((p) => [monthText(p.key), tons(p.s691), tons(p.s692)]))}>
          {(w) => <CartesianChart categories={cats} series={[
            { key: 'a', label: '691', color: color(0), type: 'bar', stack: 'p', values: power.map((p) => p.s691), format: tons },
            { key: 'b', label: '692', color: color(1), type: 'bar', stack: 'p', values: power.map((p) => p.s692), format: tons },
          ]} width={w} ariaLabel={t('Packing power per month')} />}
        </ChartCard>
        <ChartCard title={t('Power per tonne')} summary={t('kWh per tonne dispatched and per tonne packed, by month.')} legend={[{ label: t('per t dispatched'), color: color(0), symbol: 'circle' }, { label: t('per t packed'), color: color(1), symbol: 'square' }]} testid="bg-ch-kwh"
          table={tableOf([t('Month'), t('kWh/t dispatched'), t('kWh/t packed')], power.map((p) => [monthText(p.key), p.perDispatched.toFixed(2), p.perPacked.toFixed(2)]))}>
          {(w) => <CartesianChart categories={cats} series={[
            { key: 'd', label: t('per t dispatched'), color: color(0), type: 'line', marker: 'circle', values: power.map((p) => p.perDispatched), format: (n) => n.toFixed(2) },
            { key: 'p', label: t('per t packed'), color: color(1), type: 'line', marker: 'square', values: power.map((p) => p.perPacked), format: (n) => n.toFixed(2) },
          ]} width={w} ariaLabel={t('kWh per tonne by month')} zeroBased={false} />}
        </ChartCard>
        <ChartCard title={t('Broken bags by packer')} summary={t('Estimated broken bags per packer (the same rate applies to every machine bag, so this follows tons packed).')} testid="bg-ch-packer"
          table={tableOf([t('Packer'), t('Bags used'), t('Broken (est.)')], ps.map((p) => [`P${p.packer}`, tons(p.bagsUsed), tons(p.broken)]))}>
          {(w) => <CartesianChart categories={ps.map((p) => ({ key: `P${p.packer}`, label: `P${p.packer}`, full: `Packer ${p.packer}` }))} series={[{ key: 'b', label: t('Broken (est.)'), color: color(7), type: 'bar', values: ps.map((p) => p.broken), format: tons }]} width={w} ariaLabel={t('Estimated broken bags per packer')} />}
        </ChartCard>
      </div>
    </>
  );
}

export default function DispatchBags() {
  return (
    <DispatchPage pageId="dispatch-bags" testid="page-dispatch-bags" subtitle={(d) => (d.length ? t('{a} to {b} · bag figures are estimates', { a: d[0]!.date, b: d[d.length - 1]!.date }) : '')}>
      {({ days }) => <Bags days={days} periodLabel={days.length ? `${days[0]!.date}_${days[days.length - 1]!.date}` : ''} />}
    </DispatchPage>
  );
}
