import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { buildXlsx, type RawCell } from '../helpers/xlsxWriter';
import { noSidewaysScroll, signInAndWait, stubFonts, watchConsole } from './helpers';
import { colIndex } from '../../src/dispatch/parseWorkbook';

// Dispatch & Packing: its own section of the app (own rail item, one access tab), separate from the downtime analysis.
const SHOTS = 'test-results/dispatch-screens';
const cells = (cols: Record<string, RawCell>): RawCell[] => { const r: RawCell[] = Array(260).fill(0); for (const [c, v] of Object.entries(cols)) r[colIndex(c)] = v; return r; };
/** A workbook with a "Packing & Dispatch" sheet of `n` days from 1 Jan 2027 (serial 46388). */
function workbook(n: number, first = 46388): Uint8Array {
  const rows: RawCell[][] = [
    cells({ C: 'Date', D: 'Packer 1', K: 'Packer 2', AM: 'Packer 6', CD: 'Dispatch', BZ: 'OPC Clinker Dispatch' }),
    cells({ D: 'Dispatch', CK: 'Bulk', GY: 'Stoppage Time', GZ: 'Unplanned Time' }),
    cells({ D: 'tons' }),
  ];
  for (let i = 0; i < n; i++) rows.push(cells({ C: first + i, D: 900, E: 18000, F: 63, I: 10, J: 6, GY: 14, GZ: 2, CH: 900, CO: 500 }));
  return buildXlsx([{ name: 'Packing & Dispatch', rows }]);
}

test.describe('Dispatch & Packing', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    await stubFonts(page);
    errors = watchConsole(page);
  });
  test.afterEach(() => expect(errors, 'console errors').toEqual([]));

  test('its own rail section with six pages; every page opens with its charts and tables', async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signInAndWait(page, 'admin');
    await expect(page.getByTestId('rail-section-dispatch')).toHaveText('Dispatch & Packing');
    await page.getByTestId('rail-link-dispatch').click();
    await expect(page).toHaveURL(/#\/dispatch\/dashboard$/);
    await expect(page.getByTestId('page-dispatch')).toBeVisible();
    await expect(page.getByTestId('dp-tiles').locator('> *')).toHaveCount(8);
    await expect(page.getByTestId('dp-total')).toContainText('t');
    await expect(page.getByTestId('dp-insights').locator('li')).not.toHaveCount(0);
    await expect(page.locator('[data-testid^="dp-ch-"]')).toHaveCount(6);
    await expect(page.getByTestId('dp-monthly').locator('tbody tr')).toHaveCount(13); // 12 months + total
    await page.screenshot({ path: `${SHOTS}/dashboard.png`, fullPage: true });
    // the six pages are the tabs under the top bar
    const tabs = page.getByTestId('page-tabs');
    await expect(tabs.locator('a')).toHaveText(['Dashboard', 'Dispatch analysis', 'Packers', 'Bags, clinker, power', 'Data validation', 'Data']);

    await tabs.getByText('Dispatch analysis').click();
    await expect(page.getByTestId('page-dispatch-analysis')).toBeVisible();
    await expect(page.getByTestId('dp-matrix').locator('tbody tr').last()).toContainText('Total');
    await expect(page.getByTestId('dp-top-days').locator('tbody tr')).toHaveCount(10);
    await expect(page.getByTestId('dp-zero-days')).toContainText('2025-02-10');
    await page.screenshot({ path: `${SHOTS}/analysis.png`, fullPage: true });

    await tabs.getByText('Packers').click();
    await expect(page.getByTestId('page-dispatch-packers')).toBeVisible();
    await expect(page.getByTestId('dp-packer-table').locator('tbody tr')).toHaveCount(7); // 6 + fleet
    await expect(page.getByTestId('dp-lines')).toBeVisible();
    await expect(page.getByText(/not downtime events/).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/packers.png`, fullPage: true });

    await tabs.getByText('Bags, clinker, power').click();
    await expect(page.getByTestId('page-dispatch-bags')).toBeVisible();
    await expect(page.getByTestId('dp-estimate-note')).toContainText('estimates');
    await page.screenshot({ path: `${SHOTS}/bags.png`, fullPage: true });

    await tabs.getByText('Data validation').click();
    await expect(page.getByTestId('page-dispatch-validate')).toBeVisible();
    await expect(page.getByTestId('dv-tiles')).toBeVisible();
    await expect(page.getByTestId('dv-rules').locator('tbody tr')).not.toHaveCount(0);
    await page.getByTestId('dv-level').selectOption('warn');
    await expect(page.getByTestId('dv-table').locator('tbody tr').first()).toContainText('Check');
    await page.screenshot({ path: `${SHOTS}/validation.png`, fullPage: true });

    await tabs.getByText('Data', { exact: true }).click();
    await expect(page.getByTestId('page-dispatch-data')).toBeVisible();
    await expect(page.getByTestId('dp-upload')).toBeVisible();
    await expect(page.getByTestId('dp-targets')).toBeVisible();
    await expect(page.getByTestId('dp-days-table').locator('tbody tr')).toHaveCount(100);
    await page.screenshot({ path: `${SHOTS}/data.png`, fullPage: true });
  });

  test('the period bar narrows every figure', async ({ page }) => {
    await signInAndWait(page, 'admin');
    await page.goto('/#/dispatch/dashboard');
    const before = await page.getByTestId('dp-total').innerText();
    await page.getByTestId('dp-to').selectOption('2025-03');
    await expect(page.getByTestId('dp-monthly').locator('tbody tr')).toHaveCount(4); // Jan-Mar + total
    expect(await page.getByTestId('dp-total').innerText()).not.toBe(before);
  });

  test('upload: review, save, then the same file is refused because the dates exist', async ({ page }) => {
    await signInAndWait(page, 'admin');
    await page.goto('/#/dispatch/data');
    const file = { name: 'Production_Report_2027.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(workbook(10)) };
    await page.getByTestId('dp-file').setInputFiles(file);
    const review = page.getByTestId('dp-review');
    await expect(review).toContainText('Production_Report_2027.xlsx');
    await expect(review).toContainText('2027-01-01');
    await expect(review).toContainText('2027-01-10');
    await expect(page.getByTestId('dp-save')).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}/upload-review.png`, fullPage: true });
    await page.getByTestId('dp-save').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('dp-done')).toContainText('10 days added');
    await expect(page.getByTestId('dd-days')).toContainText('375');
    // the same dates again: the whole upload is refused before saving
    await page.getByTestId('dp-file').setInputFiles(file);
    await expect(page.getByTestId('dp-dup')).toContainText('10 date(s) are already in the app');
    await expect(page.getByTestId('dp-save')).toBeDisabled();
  });

  test('a file that is not the right sheet is refused with the reason', async ({ page }) => {
    await signInAndWait(page, 'admin');
    await page.goto('/#/dispatch/data');
    const buffer = Buffer.from(buildXlsx([{ name: 'Downtime', rows: [['x']] }]));
    await page.getByTestId('dp-file').setInputFiles({ name: 'wrong.xlsx', mimeType: 'application/octet-stream', buffer });
    await expect(page.getByTestId('dp-refused')).toContainText('no sheet called "Packing & Dispatch"');
  });

  test('targets are saved and show on the Dashboard', async ({ page }) => {
    await signInAndWait(page, 'admin');
    await page.goto('/#/dispatch/data');
    await page.getByTestId('dp-avail-target').fill('60');
    await page.getByTestId('dp-target-0').fill('300000');
    await page.getByTestId('dp-rated-0').fill('120');
    await page.getByTestId('dp-save-targets').click();
    await expect(page.getByTestId('dp-targets-msg')).toHaveText('Saved.');
    await page.getByTestId('page-tabs').getByText('Dashboard').click();
    await expect(page.getByTestId('dp-avail')).toContainText('target 60%');
    await expect(page.getByTestId('dp-total')).toContainText('of the target');
  });

  test('a viewer reads everything but cannot upload or change targets', async ({ page }) => {
    await signInAndWait(page, 'viewer');
    await page.goto('/#/dispatch/data');
    await expect(page.getByTestId('page-dispatch-data')).toBeVisible();
    await expect(page.getByTestId('access-level')).toHaveText('View only');
    await expect(page.getByTestId('dp-view-only')).toBeVisible();
    await expect(page.getByTestId('dp-upload')).toHaveCount(0);
    await expect(page.getByTestId('dp-save-targets')).toHaveCount(0);
    await expect(page.getByTestId('dp-avail-target')).toBeDisabled();
  });

  test('phone: the section is reachable from More, the chips work and nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAndWait(page, 'admin');
    await page.goto('/#/dispatch/dashboard');
    await expect(page.getByTestId('page-dispatch')).toBeVisible();
    await expect(page.getByTestId('page-strip').locator('a')).toHaveCount(6);
    await page.getByTestId('page-strip').getByText('Packers').click();
    await expect(page.getByTestId('page-dispatch-packers')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/phone-packers.png`, fullPage: true });
    expect((await noSidewaysScroll(page)).ok).toBe(true);
    await page.goto('/#/dispatch/dashboard');
    await expect(page.getByTestId('dp-tiles')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/phone-dashboard.png`, fullPage: true });
    expect((await noSidewaysScroll(page)).ok).toBe(true);
  });
});
