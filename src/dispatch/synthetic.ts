// Made-up Dispatch & Packing data for demo mode and tests. Seeded, so every run gives the same days.
// It has the shape of the plant's sheet (six packers, six products, four modes, clinker, power) but none of its figures:
// this repository is public and real plant data is never committed.
import { BAGS_PER_TONNE, emptyDay, N_PACKERS, PRODUCTS, type DispatchDay } from './model';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Days without any dispatch in the demo data (so the gap and zero-day checks have something to show). */
export const DEMO_STOP_DATES = ['2025-02-10', '2025-02-11', '2025-05-03', '2025-05-04', '2025-05-05', '2025-08-21'];

export function syntheticDispatchDays(year = 2025, seed = 20250117): DispatchDay[] {
  const rand = rng(seed);
  const days: DispatchDay[] = [];
  const first = Date.UTC(year, 0, 1);
  const last = Date.UTC(year, 11, 31);
  // a packer's typical rate and how often it is held up, so the packers differ a little
  const typicalRate = [88, 86, 84, 87, 90, 91];
  const downBias = [1, 1.1, 1.8, 1, 1, 0.9];
  const trucksBias = [0.9, 0.9, 0.6, 1.3, 1.3, 1.1];
  let monthIdx = 0;
  for (let t = first; t <= last; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const d = emptyDay(date);
    monthIdx = Number(date.slice(5, 7)) - 1;
    const stopDay = DEMO_STOP_DATES.includes(date);
    const dow = (new Date(t).getUTCDay() + 6) % 7;
    const weekdayFactor = dow >= 5 ? 0.82 : 1;
    let packedTons = 0;
    for (let i = 0; i < N_PACKERS; i++) {
      const p = d.packers[i]!;
      if (stopDay) { p.stopH = 24; p.noTruckH = 18; p.unplannedH = 0; continue; }
      const noTruckH = Math.min(22, Math.max(0, r1(rand() * 14 * trucksBias[i]! * (dow >= 5 ? 1.25 : 1))));
      const unplannedH = rand() < 0.22 * downBias[i]! ? r1(rand() * 5 * downBias[i]!) : 0;
      const otherH = r1(1 + rand() * 4 * downBias[i]!);
      const stopH = Math.min(24, r1(noTruckH + unplannedH + otherH));
      const runH = r1(24 - stopH);
      const rate = typicalRate[i]! * (0.93 + rand() * 0.14);
      p.runH = runH; p.stopH = r1(24 - runH); p.noTruckH = Math.min(noTruckH, p.stopH); p.unplannedH = Math.min(unplannedH, Math.max(0, p.stopH - p.noTruckH));
      p.tons = runH > 0 ? Math.round((runH * rate) / 5) * 5 : 0;
      p.bags = p.tons * BAGS_PER_TONNE;
      p.broken = Math.round(p.bags * 0.0035);
      packedTons += p.tons;
    }
    if (!stopDay) {
      packedTons *= weekdayFactor;
      d.packers.forEach((p) => { p.tons = Math.round((p.tons * weekdayFactor) / 5) * 5; p.bags = p.tons * BAGS_PER_TONNE; p.broken = Math.round(p.bags * 0.0035); });
      packedTons = d.packers.reduce((a, p) => a + p.tons, 0);
      // sling bags are a share of packing, the rest is plain bags; bulk grows through the year
      const sling = Math.round(packedTons * (0.04 + rand() * 0.04));
      d.slingPalletizer = Math.round(sling * 0.85);
      d.slingManual = sling - d.slingPalletizer;
      d.slingProduction = Math.round(d.slingPalletizer * (0.99 + rand() * 0.03));
      const plain = Math.max(0, packedTons - sling);
      const mix = [0, 0.012, monthIdx === 0 ? 0.06 : 0, 0, 0.84, 0.088];
      const rest = 1 - mix.reduce((a, b) => a + b, 0);
      mix[4] = (mix[4] ?? 0) + rest;
      PRODUCTS.forEach((_, i) => { d.bagged[i] = Math.round(plain * (mix[i] ?? 0) * 5) / 5; });
      const bulkTotal = Math.round((0.45 + monthIdx * 0.025 + rand() * 0.1) * packedTons * 0.55);
      d.bulk[1] = Math.round(bulkTotal * (0.3 + monthIdx * 0.04));
      d.bulk[4] = bulkTotal - d.bulk[1]!;
      d.jumbo = rand() < 0.012 ? Math.round(rand() * 600) / 1 : 0;
      d.jumboProduction = d.jumbo;
      d.power = [r1(2.5 + packedTons / 2200 + rand()), r1(2.4 + packedTons / 2200 + rand())];
      d.wcnBags = rand() < 0.05 ? Math.round(rand() * 30_000) : 0;
      d.wcnBroken = Math.round(d.wcnBags * 0.015);
      // clinker dispatch comes in batches
      if (rand() < 0.55) {
        d.clinker.opc = rand() < 0.4 ? Math.round(rand() * 2500) : 0;
        d.clinker.lowAlk = rand() < 0.55 ? Math.round(rand() * 5000) : 0;
        d.clinker.over60 = rand() < 0.25 ? Math.round(rand() * 4000) : 0;
        d.clinker.src = rand() < 0.08 ? Math.round(rand() * 3000) : 0;
      }
    }
    days.push(d);
  }
  return days;
}
