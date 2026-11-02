// Plain-language findings for the Dashboard, worked out from the numbers (never typed in). Each one is a sentence
// that says what the data shows; where a reading needs an assumption it says so.
import { dayStats, fleetTime, lineStats, monthly, packerStats, totals } from './calc';
import { MODES, PRODUCTS, type DispatchDay, type DispatchSettings } from './model';

const pct = (x: number, d = 1): string => `${(x * 100).toFixed(d)}%`;
const n0 = (x: number): string => Math.round(x).toLocaleString('en-GB');

export function insights(days: readonly DispatchDay[], settings?: DispatchSettings): string[] {
  if (days.length === 0) return [];
  const out: string[] = [];
  const tt = totals(days);
  const ms = monthly(days, settings);
  const ps = packerStats(days, settings);
  const fl = fleetTime(days);
  const cal = days.length * 24 * ps.length;

  // products
  const order = PRODUCTS.map((name, i) => ({ name, v: tt.byProduct[i]! })).filter((p) => p.v > 0).sort((a, b) => b.v - a.v);
  if (order.length) out.push(`${n0(tt.total)} t were dispatched. ${order[0]!.name} is ${pct(order[0]!.v / tt.total)} of it${order[1] ? `, then ${order[1].name} ${pct(order[1].v / tt.total)}` : ''}.`);
  const unused = PRODUCTS.filter((_, i) => tt.byProduct[i] === 0);
  if (unused.length) out.push(`No dispatch at all of: ${unused.join(', ')}.`);
  // modes
  const modeText = MODES.map((m, i) => ({ m, v: tt.byMode[i]! })).filter((x) => x.v > 0).map((x) => `${x.m.toLowerCase()} ${pct(x.v / tt.total)}`).join(', ');
  out.push(`By delivery mode: ${modeText}.`);
  if (ms.length >= 2) {
    const a = ms[0]!, b = ms[ms.length - 1]!;
    if (Math.abs(b.bulkShare - a.bulkShare) >= 0.05) out.push(`Bulk went from ${pct(a.bulkShare, 0)} of dispatch in ${a.label} to ${pct(b.bulkShare, 0)} in ${b.label}.`);
    const best = [...ms].sort((x, y) => y.total - x.total)[0]!, worst = [...ms].sort((x, y) => x.total - y.total)[0]!;
    out.push(`Best month ${best.label} (${n0(best.total)} t), lowest ${worst.label} (${n0(worst.total)} t${worst.days - worst.dispatchDays > 0 ? `, with ${worst.days - worst.dispatchDays} day(s) without dispatch` : ''}).`);
  }
  // days
  const st = dayStats(days);
  if (st.zeroDays.length) out.push(`${st.zeroDays.length} day(s) without any dispatch: ${st.zeroDays.slice(0, 8).join(', ')}${st.zeroDays.length > 8 ? ', ...' : ''}. Add the reason (a holiday or a stop) in the review.`);
  if (st.peak) out.push(`Peak day ${st.peak.date} with ${n0(st.peak.total)} t; the daily average on days with dispatch is ${n0(st.meanDispatchDay)} t (spread ${pct(st.cv, 0)} of the mean).`);
  // packers
  const run = fl.runH / cal, nt = fl.noTruckH / cal, un = fl.unplannedH / cal, ot = fl.otherStopH / cal;
  const loss = [{ k: 'waiting for trucks', v: nt }, { k: 'unplanned stops', v: un }, { k: 'other stoppages', v: ot }].sort((a, b) => b.v - a.v);
  out.push(`The six packers ran ${pct(run)} of the time. The largest loss is ${loss[0]!.k} (${pct(loss[0]!.v)}), then ${loss[1]!.k} (${pct(loss[1]!.v)}). ${nt > un + ot * 0.5 ? 'Packing is held back more by trucks than by breakdowns (assumption: "no trucks" hours mean a packer was ready and no truck was loading).' : ''}`.trim());
  const withTons = ps.filter((p) => p.runH > 0);
  if (withTons.length > 1) {
    const weak = [...withTons].sort((a, b) => a.availability - b.availability)[0]!, fast = [...withTons].sort((a, b) => b.rate - a.rate)[0]!;
    out.push(`Packer ${weak.packer} runs least (${pct(weak.availability)} of the time; ${n0(weak.unplannedH)} h unplanned, ${n0(weak.otherStopH)} h other stoppage). Packer ${fast.packer} packs fastest (${fast.rate.toFixed(1)} t/h).`);
    const ls = lineStats(ps);
    if (ls[0]!.noTruckH > 0 && ls[1]!.noTruckH > 0 && Math.abs(ls[0]!.noTruckH - ls[1]!.noTruckH) / Math.max(ls[0]!.noTruckH, ls[1]!.noTruckH) > 0.2) {
      const [hi, lo] = ls[0]!.noTruckH > ls[1]!.noTruckH ? [ls[0]!, ls[1]!] : [ls[1]!, ls[0]!];
      out.push(`Line ${hi.line} waits for trucks ${n0(hi.noTruckH)} h against ${n0(lo.noTruckH)} h on line ${lo.line}.`);
    }
  }
  if (settings && settings.ratedTph.some((r) => r > 0)) {
    const u = ps.filter((p) => p.utilisation !== null);
    if (u.length) out.push(`Against rated capacity the packers average ${pct(u.reduce((a, p) => a + p.utilisation!, 0) / u.length, 0)} while running.`);
  }
  if (settings?.availabilityTargetPct) out.push(`Fleet running availability ${pct(run)} against a target of ${settings.availabilityTargetPct}%.`);
  // clinker
  if (tt.clinker.total > 0) out.push(`Clinker dispatch was ${n0(tt.clinker.total)} t; low alkaline clinker is ${pct(tt.clinker.lowAlk / tt.clinker.total, 0)} of it.`);
  // bags
  out.push(`Bag counts and broken bags (${n0(tt.broken)} of ${n0(tt.bagsUsed + tt.broken)}, ${pct(tt.broken / Math.max(1, tt.bagsUsed + tt.broken), 2)}) are estimates worked out in the sheet, not counted.`);
  return out;
}
