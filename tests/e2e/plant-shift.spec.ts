import { expect, test, type Page } from '@playwright/test';
import { noSidewaysScroll, signInAndWait, stubFonts, watchConsole } from './helpers';

// Plant system steps B-D (backend 2.1.0) in mock mode: the Admin role may do every step.
const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 2); return isoDay(d); };

async function fillStop(page: Page, i: number, v: { stop: string; start?: string; code?: string; cls: string; reason: string; failure?: boolean }) {
  const row = page.getByTestId('stop-row').nth(i);
  await row.getByTestId('stop-time').fill(v.stop);
  if (v.start) await row.getByTestId('start-time').fill(v.start);
  if (v.code) await row.getByTestId('stop-code').fill(v.code);
  await row.getByTestId('stop-class').selectOption(v.cls);
  if (v.failure) await row.getByTestId('stop-failure').check();
  await row.getByTestId('stop-reason').fill(v.reason);
}

test.describe('shift reports and daily meeting', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    await stubFonts(page);
    errors = watchConsole(page);
  });
  test.afterEach(() => expect(errors, 'console errors').toEqual([]));

  test('enter, restart by the next shift, approve, validate, and see it in the daily meeting', async ({ page }, info) => {
    const day = yesterday();
    await signInAndWait(page, 'admin');
    await page.goto(`/#/shift?date=${day}&shift=D&area=K.1`);
    await expect(page.getByTestId('page-shift')).toBeVisible();
    await expect(page.getByTestId('se-status')).toHaveText('Not started');
    await page.getByTestId('se-add').click();
    await fillStop(page, 0, { stop: '09:10', start: '10:40', code: '131.BC100', cls: 'MEC', reason: 'Bearing failure', failure: true });
    await page.getByTestId('se-add').click();
    await fillStop(page, 1, { stop: '18:30', cls: 'ELE', reason: 'Motor trip', failure: true });
    await expect(page.getByTestId('stop-row').nth(1).getByTestId('stop-open')).toBeVisible();
    // PL is never a failure
    await page.getByTestId('se-add').click();
    await page.getByTestId('stop-row').nth(2).getByTestId('stop-class').selectOption('PL');
    await expect(page.getByTestId('stop-row').nth(2).getByTestId('stop-failure')).toBeDisabled();
    await page.getByTestId('stop-row').nth(2).getByTestId('stop-remove').click();
    await page.getByTestId('se-save').click();
    await expect(page.getByTestId('se-status')).toHaveText('Draft');
    await page.getByTestId('page-shift').screenshot({ path: info.outputPath('entry.png') });
    await page.getByTestId('se-submit').click();
    await expect(page.getByTestId('se-status')).toHaveText('Waiting for production');
    await expect(page.getByTestId('se-locked')).toBeVisible();

    // the night shift enters the restart of the open stop
    await page.getByTestId('se-shift-N').click();
    await expect(page.getByTestId('se-open-item')).toHaveCount(1);
    await page.getByTestId('se-restart-time').fill('23:20');
    await page.getByTestId('se-restart-save').click();
    await expect(page.getByTestId('se-open-item')).toContainText('Restarted');
    await page.getByTestId('se-submit').click();
    await expect(page.getByTestId('se-status')).toHaveText('Waiting for production');

    // production approves the day report after correcting the reason
    await page.getByTestId('shift-tabs').getByText('Review').click();
    await expect(page.getByTestId('review-prod').getByTestId('review-item')).toHaveCount(2);
    await page.getByTestId('review-prod').locator(`[data-report="SR-${day.replace(/-/g, '')}-D-K.1"]`).click();
    const panel = page.getByTestId('review-panel');
    await panel.getByTestId('review-stop').first().getByTestId('stop-reason').fill('Bearing high temperature');
    await expect(panel.getByTestId('review-changes')).toHaveText('1 changed');
    await panel.screenshot({ path: info.outputPath('review.png') });
    await panel.getByTestId('review-approve').click();
    await expect(page.getByTestId('review-rel').getByTestId('review-item')).toHaveCount(1);
    // reliability validates; the long stop waits for the night report
    await page.getByTestId('review-rel').getByTestId('review-item').click();
    await page.getByTestId('review-panel').getByTestId('review-validate').click();
    await expect(page.getByText('Validated. Stoppages still open')).toBeVisible();
    // the night report: approve then validate -> both in the downtime analysis
    await page.getByTestId('review-prod').getByTestId('review-item').click();
    await page.getByTestId('review-panel').getByTestId('review-approve').click();
    await page.getByTestId('review-rel').getByTestId('review-item').click();
    await page.getByTestId('review-panel').getByTestId('review-validate').click();
    await expect(page.getByText('Validated. The stoppages are in the downtime analysis.')).toBeVisible();

    // All reports shows both as posted, with history
    await page.getByTestId('shift-tabs').getByText('All reports').click();
    await page.getByTestId('sa-from').fill(day);
    await expect(page.getByTestId('sa-row').filter({ hasText: 'K.1' })).toHaveCount(2);
    await expect(page.getByTestId('sa-row').first()).toContainText('In the downtime analysis');
    await page.getByTestId('sa-row').filter({ hasText: 'Day' }).getByRole('button').click();
    await expect(page.getByTestId('shift-history')).toContainText('Changed reason');

    // daily meeting of that day
    await page.goto(`/#/daily?date=${day}`);
    await expect(page.getByTestId('page-daily')).toBeVisible();
    const k1 = page.locator('[data-testid="dm-row"][data-area="K.1"]');
    await expect(k1).toContainText('In the downtime analysis');
    await expect(page.getByTestId('dm-failures')).toContainText('2');
    await expect(page.getByTestId('dm-longest')).toContainText('131.BC100');
    await page.getByTestId('page-daily').screenshot({ path: info.outputPath('daily.png') });
  });

  test('phone: entry and daily meeting fit the screen', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAndWait(page, 'admin');
    await page.goto(`/#/shift?date=${yesterday()}&shift=D&area=K.2`);
    await page.getByTestId('se-add').click();
    await expect(page.getByTestId('stop-row')).toHaveCount(1);
    expect((await noSidewaysScroll(page)).ok).toBe(true);
    await page.getByTestId('page-shift').screenshot({ path: info.outputPath('entry-phone.png') });
    await page.goto('/#/daily');
    await expect(page.getByTestId('dm-table')).toBeVisible();
    expect((await noSidewaysScroll(page)).ok).toBe(true);
    await page.getByTestId('page-daily').screenshot({ path: info.outputPath('daily-phone.png') });
  });

  test('a viewer sees the daily meeting but no Shift reports page', async ({ page }) => {
    await signInAndWait(page, 'viewer');
    await page.goto('/#/daily');
    await expect(page.getByTestId('page-daily')).toBeVisible();
    await page.goto('/#/shift');
    await expect(page.getByTestId('page-shift')).toHaveCount(0);
  });
});
