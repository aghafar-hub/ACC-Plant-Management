import { expect, test } from '@playwright/test';
import { noSidewaysScroll, signInAndWait, stubFonts, watchConsole } from './helpers';

// Plant system 2.3.0: Settings › KPI targets is the one place targets live; the Dashboard judges RF against it.
test.describe('KPI targets', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    await stubFonts(page);
    errors = watchConsole(page);
  });
  test.afterEach(() => expect(errors, 'console errors').toEqual([]));

  test('admin sets the plant RF target; the Dashboard uses it; an area shows the plant target in grey', async ({ page }) => {
    await signInAndWait(page, 'admin');
    await page.goto('/#/settings/kpi-targets');
    const box = page.getByTestId('kpi-targets');
    await expect(box).toBeVisible();
    // approved KPIs only by default, grouped; EA is there
    await expect(box.locator('[data-testid="kt-row"][data-kpi="EA"]')).toHaveCount(1);
    await expect(box.locator('[data-testid="kt-row"][data-kpi="Q_LSF_SD"]')).toHaveCount(0);
    await box.getByTestId('kt-show-draft').check();
    await expect(box.locator('[data-testid="kt-row"][data-kpi="Q_LSF_SD"]')).toHaveCount(1);
    await box.getByTestId('kt-show-draft').uncheck();

    const year = String(new Date().getFullYear());
    await expect(box.getByTestId('kt-year')).toHaveValue(year);
    await box.getByTestId('kt-target-RF').fill('abc');
    await expect(box.getByTestId('kt-invalid')).toBeVisible();
    await expect(box.getByTestId('kt-save')).toBeDisabled();
    await box.getByTestId('kt-target-RF').fill('97');
    await box.getByTestId('kt-months-RF').click();
    await box.getByTestId('kt-month-RF-2').fill('90');
    await box.getByTestId('kt-save').click();
    await expect(page.getByText(/KPI targets of the plant for \d{4} saved/)).toBeVisible();
    await expect(box.getByTestId('kt-months-RF')).toContainText('1 set');

    // an area without its own target shows the plant's as a hint
    await box.getByTestId('kt-scope').selectOption('area:K.1');
    await expect(box.getByTestId('kt-target-RF')).toHaveValue('');
    await expect(box.getByTestId('kt-target-RF')).toHaveAttribute('placeholder', '97 (plant)');

    // the Dashboard judges the RF of this year against 97 %
    await page.goto('/#/dashboard?r=ytd');
    await expect(page.getByTestId('kpi-reliability')).toContainText(/Target 97%/);
    expect((await noSidewaysScroll(page)).ok).toBe(true);
  });

  test('an engineer without the Targets duty reads the page but cannot save', async ({ page }) => {
    await signInAndWait(page, 'engineer');
    await page.goto('/#/settings/kpi-targets');
    const box = page.getByTestId('kpi-targets');
    await expect(box).toBeVisible();
    await expect(box.getByTestId('kt-readonly')).toBeVisible();
    await expect(box.getByTestId('kt-target-RF')).toBeDisabled();
    await expect(box.getByTestId('kt-save')).toHaveCount(0);
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('the page fits the screen', async ({ page }) => {
      await signInAndWait(page, 'admin');
      await page.goto('/#/settings/kpi-targets');
      await expect(page.getByTestId('kpi-targets')).toBeVisible();
      expect((await noSidewaysScroll(page)).ok).toBe(true);
    });
  });
});
