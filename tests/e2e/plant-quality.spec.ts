import { expect, test } from '@playwright/test';
import { noSidewaysScroll, signInAndWait, stubFonts, watchConsole } from './helpers';

// Plant system 2.3.0: Settings › Quality limits (specification and valid range of each laboratory parameter).
test.describe('quality limits', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    await stubFonts(page);
    errors = watchConsole(page);
  });
  test.afterEach(() => expect(errors, 'console errors').toEqual([]));

  test('admin enters the free lime specification; a target outside it is refused before saving', async ({ page }) => {
    await signInAndWait(page, 'admin');
    await page.goto('/#/settings/quality');
    const box = page.getByTestId('quality-limits');
    await expect(box.getByTestId('ql-row')).toHaveCount(52);
    await expect(box.getByTestId('ql-missing')).toContainText('52 active parameters have no specification yet');
    await box.getByTestId('ql-area').selectOption('K.1');
    await expect(box.getByTestId('ql-row')).toHaveCount(11);
    const id = 'K.1.CLINKER.FL';
    await box.getByTestId(`ql-spec_min-${id}`).fill('0.5');
    await box.getByTestId(`ql-spec_max-${id}`).fill('2');
    await box.getByTestId(`ql-target-${id}`).fill('3');
    await expect(box.getByTestId('ql-problems')).toContainText('K.1 Free lime: the target is outside the specification.');
    await expect(box.getByTestId('ql-save')).toBeDisabled();
    await box.getByTestId(`ql-target-${id}`).fill('1.2');
    await expect(box.getByTestId('ql-problems')).toHaveCount(0);
    await box.getByTestId('ql-save').click();
    await expect(page.getByText('Quality limits saved (1 parameters).')).toBeVisible();
    await expect(box.getByTestId('ql-missing')).toContainText('51 active parameters');
    await box.getByTestId('ql-only-missing').check();
    await expect(box.locator(`[data-testid="ql-row"][data-param="${id}"]`)).toHaveCount(0);
  });

  test('without the duty the page is read only', async ({ page }) => {
    await signInAndWait(page, 'engineer');
    await page.goto('/#/settings/quality');
    const box = page.getByTestId('quality-limits');
    await expect(box.getByTestId('ql-readonly')).toBeVisible();
    await expect(box.getByTestId('ql-spec_min-K.1.CLINKER.FL')).toBeDisabled();
    await expect(box.getByTestId('ql-save')).toHaveCount(0);
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('the page fits the screen (the table scrolls inside its frame)', async ({ page }) => {
      await signInAndWait(page, 'admin');
      await page.goto('/#/settings/quality');
      await expect(page.getByTestId('ql-row').first()).toBeVisible();
      expect((await noSidewaysScroll(page)).ok).toBe(true);
    });
  });
});
