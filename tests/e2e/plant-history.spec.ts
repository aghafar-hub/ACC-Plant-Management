import { expect, test } from '@playwright/test';
import { buildXlsx, serialOf } from '../helpers/xlsxWriter';
import { signInAndWait, stubFonts, watchConsole } from './helpers';

// Plant system 2.2.0: Upload › History import (date only) from the NRS MS.Downtime sheet, Admin role, mock mode.
const HEAD = ['DATE ', 'LINE', 'EQUIPMENT', 'EQUIPMENT CODE', 'TOTAL STOPPAGE DURATION (h)', 'STOPPAGE CLASSIFICATION', 'CRITICALITY', 'REASON', 'Failure', 'DESCRIPTION'];
const d = (iso: string) => serialOf(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
function workbook() {
  const rows = [
    HEAD,
    [d('2023-03-01'), 'L.1', 'K.1', '131.BC100', 2, 'MEC', 'INC', 'Bearing failure', 'YES', null],
    [d('2023-03-01'), 'L.1', 'K.1', 'N/A', 1.5, 'Mec', 'INC', ' Full Silos', 'Yes', null],
    [d('2023-03-02'), 'L.1', 'CR', 'N/A', 20, 'CIR', 'NO_INC', 'Full Silos', 'NO', null],
    [d('2023-03-02'), 'L.1', 'CR', 'N/A', 6, 'PL', 'NO_INC', 'Weekly plan', 'NO', null],
    [d('2023-04-05'), 'L.2', 'K.2', '351.KF200', null, 'MEC', 'INC', 'x', 'YES', null],
  ];
  return Buffer.from(buildXlsx([{ name: 'MS.KPIS', rows: [['x']] }, { name: 'MS.Downtime', rows }]));
}

test.describe('history import', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    await stubFonts(page);
    errors = watchConsole(page);
  });
  test.afterEach(() => expect(errors, 'console errors').toEqual([]));

  test('admin reads the sheet, sees the checks, imports; a second import adds nothing', async ({ page }, info) => {
    await signInAndWait(page, 'admin');
    await page.goto('/#/upload');
    const box = page.getByTestId('history-import');
    await expect(box).toBeVisible();
    await box.getByTestId('history-file').setInputFiles({ name: 'NRS.xlsm', mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12', buffer: workbook() });
    await expect(box.getByTestId('history-summary')).toBeVisible();
    await expect(box.getByTestId('history-rows')).toHaveText('4');
    await expect(box.getByTestId('history-checks')).toContainText('1 rows left out');
    await expect(box.getByTestId('history-overdays')).toContainText('CR 2023-03-02 (26 h)');
    await expect(box.getByTestId('history-checks')).toContainText('classification case 1');
    await box.screenshot({ path: info.outputPath('history.png') });
    await box.getByTestId('history-send').click();
    await expect(box.getByTestId('history-done')).toContainText('4 stoppages added');
    // the same file again: everything is already stored
    await box.getByTestId('history-file').setInputFiles({ name: 'NRS.xlsm', mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12', buffer: workbook() });
    await box.getByTestId('history-send').click();
    await expect(box.getByTestId('history-done')).toContainText('0 stoppages added, 4 already stored');
    await expect(page.getByTestId('upload-history')).toContainText('History NRS.xlsm');
    // Validate leaves the history out until it is switched on; then its records can be filtered by year
    await page.goto('/#/validate');
    await page.getByTestId('v-refresh').click(); // the years list comes with the start-up data: read it again after the import
    const toggle = page.getByTestId('v-history-toggle');
    await expect(page.getByTestId('v-history')).toContainText('4 records');
    const before = await page.getByTestId('d-year').locator('option').allTextContents();
    expect(before).not.toContain('2023');
    await toggle.check();
    await page.getByTestId('d-year').selectOption('2023');
    await expect(page.getByTestId('v-row').first()).toBeVisible();
    for (const m of await page.getByTestId('d-month').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean))) expect(m.startsWith('2023-')).toBe(true);
    // the switch is remembered on this device
    await page.goto('/#/dashboard');
    await page.goto('/#/validate');
    await expect(page.getByTestId('v-history-toggle')).toBeChecked();
  });

  test('the engineer (not an Admin) has no history import', async ({ page }) => {
    await signInAndWait(page, 'engineer');
    await page.goto('/#/upload');
    await expect(page.getByTestId('page-upload')).toBeVisible();
    await expect(page.getByTestId('history-import')).toHaveCount(0);
  });
});
