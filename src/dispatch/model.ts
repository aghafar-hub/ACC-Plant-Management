// Dispatch & Packing: the data model. One DispatchDay is one calendar day of the workbook sheet "Packing & Dispatch"
// (one row). Everything in the section is worked out from these rows (calc.ts); nothing here is downtime: packer
// stoppage, unplanned and no-trucks hours belong to this section only and are never posted to the downtime events.

export const N_PACKERS = 6;
/** The six cement products, in the workbook's order. Index is used everywhere below. */
export const PRODUCTS = ['CEM I 42.5', 'CEM I 52.5', 'CEM II/A-P 42.5N', 'SRC Cement', 'CEM IV/A (P) 42.5N-SR', 'CEM IV/B (P) 32.5N'] as const;
/** Sling bags (palletised) are only ever CEM IV/A, jumbo bags only CEM I 52.5: fixed by the workbook layout. */
export const SLING_PRODUCT = 4;
export const JUMBO_PRODUCT = 1;
export const MODES = ['Bagged', 'Bulk', 'Sling bags', 'Jumbo bags'] as const;
export const CLINKER_TYPES = ['OPC clinker', 'SRC clinker', 'OPC clinker over 60', 'Low alkaline clinker'] as const;
/** Packers 1-3 feed line 1, packers 4-6 line 2. */
export const LINE_OF_PACKER = [1, 1, 1, 2, 2, 2] as const;
/** Bags per tonne the workbook assumes (50 kg bags). */
export const BAGS_PER_TONNE = 20;

export interface PackerDay {
  /** tons packed */
  tons: number;
  /** running hours */
  runH: number;
  /** hours the packer was ready but no truck was there */
  noTruckH: number;
  /** unplanned stop hours */
  unplannedH: number;
  /** all non-running hours of the day (24 - running); includes the two above and other stops */
  stopH: number;
  /** bags used (the workbook computes tons x 20: an estimate unless real counts are entered) */
  bags: number;
  /** broken bags (the workbook computes used x a fixed rate: an estimate, not a count) */
  broken: number;
}

export interface DispatchDay {
  /** YYYY-MM-DD */
  date: string;
  /** tons dispatched in plain bags, per product (PRODUCTS order) */
  bagged: number[];
  /** tons dispatched in bulk, per product */
  bulk: number[];
  /** CEM IV/A in sling bags: the part entered by hand (palletised manual) */
  slingManual: number;
  /** CEM IV/A in sling bags dispatched from the palletizer */
  slingPalletizer: number;
  /** CEM I 52.5 in jumbo bags */
  jumbo: number;
  packers: PackerDay[];
  clinker: { opc: number; src: number; over60: number; lowAlk: number };
  /** packing power, substations 691 and 692, MWh */
  power: [number, number];
  wcnBags: number;
  wcnBroken: number;
  /** sling production, tons */
  slingProduction: number;
  /** jumbo bag production, tons */
  jumboProduction: number;
}

/** Targets and capacities kept for the section. 0 or null means "not set". */
export interface DispatchSettings {
  /** rated capacity per packer, t/h */
  ratedTph: number[];
  /** dispatch target per calendar month (index 0 = January), tons */
  monthlyTargetT: number[];
  /** target running availability of a packer, % of calendar time */
  availabilityTargetPct: number | null;
  /** most no-trucks time accepted, % of calendar time */
  noTrucksMaxPct: number | null;
}

export const emptySettings = (): DispatchSettings => ({
  ratedTph: Array.from({ length: N_PACKERS }, () => 0),
  monthlyTargetT: Array.from({ length: 12 }, () => 0),
  availabilityTargetPct: null,
  noTrucksMaxPct: null,
});

export interface DispatchUploadResult {
  file_name: string;
  days_added: number;
  from: string;
  to: string;
}

export const emptyDay = (date: string): DispatchDay => ({
  date,
  bagged: PRODUCTS.map(() => 0), bulk: PRODUCTS.map(() => 0), slingManual: 0, slingPalletizer: 0, jumbo: 0,
  packers: Array.from({ length: N_PACKERS }, () => ({ tons: 0, runH: 0, noTruckH: 0, unplannedH: 0, stopH: 24, bags: 0, broken: 0 })),
  clinker: { opc: 0, src: 0, over60: 0, lowAlk: 0 }, power: [0, 0], wcnBags: 0, wcnBroken: 0, slingProduction: 0, jumboProduction: 0,
});
