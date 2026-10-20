import { expect, test } from '@playwright/test';
import { noSidewaysScroll, signInAndWait, stubFonts, watchConsole } from './helpers';

// Plant system 2.3.0: Settings › Month closing. Review, sign-off (locks the month), reopen with a reason.
test.describe('month closing', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    await stubFonts(page);
    errors = watchConsole(page);
  });
  test.afterEach(() => expect(errors, 'console errors').toEqual([]));

  test('admin reviews and signs off a month; a fix in it is refused until it is reopened', async ({ page }) => {
    await signInAndWait(page, 'admin');
    // a month that has ended and holds records to check
    await page.goto('/#/validate');
    await expect(page.getByTestId('v-row').first()).toBeVisible({ timeout: 20000 });
    const now = new Date();
    const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const months = await page.getByTestId('d-month').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    const ym = months.find((m) => m < thisYm)!;
    expect(ym, 'an ended month with records to check').toBeTruthy();
    const [y, m] = ym.split('-');

    await page.goto('/#/settings/closing');
    const box = page.getByTestId('month-closing');
    await box.getByTestId('mc-year').selectOption(y!);
    const cell = box.getByTestId(`mc-downtime-${ym}`);
    await expect(cell).toHaveAttribute('data-status', 'open');
    await cell.click();
    await expect(box.getByTestId('mc-open-checks')).toContainText('still need checking in Validate');
    await expect(box.getByTestId('mc-review')).toBeDisabled();
    await box.getByTestId('mc-comment').fill('Checked with the reliability team');
    await box.getByTestId('mc-review').click();
    await expect(cell).toHaveAttribute('data-status', 'reviewed');
    await box.getByTestId('mc-signoff').click();
    await expect(cell).toHaveAttribute('data-status', 'signed_off');
    await expect(box.getByTestId('mc-status')).toHaveText('Signed off');
    // the plant report waits for the other sections
    await box.getByTestId(`mc-plant-${ym}`).click();
    await expect(box.getByTestId('mc-panel')).toContainText('Signed off once Downtime, Production and Quality of the month are.');

    // a fix in the month is refused
    await page.goto(`/#/validate?month=${ym}`);
    await page.getByTestId('v-row').first().getByTestId('v-fix-btn').click();
    await page.getByTestId('f-desc').fill('try a change');
    await page.getByTestId('save-edit').click();
    await expect(page.getByTestId('server-error')).toContainText('is signed off and locked');
    await page.keyboard.press('Escape');

    // reopen needs a reason
    await page.goto('/#/settings/closing');
    await box.getByTestId('mc-year').selectOption(y!);
    await box.getByTestId(`mc-downtime-${ym}`).click();
    await expect(box.getByTestId('mc-reopen')).toBeDisabled();
    await box.getByTestId('mc-comment').fill('A classification was wrong');
    await box.getByTestId('mc-reopen').click();
    await expect(box.getByTestId(`mc-downtime-${ym}`)).toHaveAttribute('data-status', 'reopened');
    expect(Number(m)).toBeGreaterThan(0);
  });

  test('without the duties there is nothing to do; the page fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAndWait(page, 'engineer');
    await page.goto('/#/settings/closing');
    const box = page.getByTestId('month-closing');
    await expect(box.getByTestId('mc-row').first()).toBeVisible();
    await box.getByTestId('mc-row').first().locator('button').first().click();
    await expect(box.getByTestId('mc-no-action')).toBeVisible();
    await expect(box.getByTestId('mc-review')).toHaveCount(0);
    expect((await noSidewaysScroll(page)).ok).toBe(true);
  });
});
