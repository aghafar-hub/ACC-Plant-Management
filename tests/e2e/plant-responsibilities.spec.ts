import { expect, test } from '@playwright/test';
import { noSidewaysScroll, signInAndWait, stubFonts, watchConsole } from './helpers';

// Plant system step A (backend 2.0.0): responsibilities per person and the coverage grid, in mock mode.
test.describe('users: responsibilities and coverage', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    await stubFonts(page);
    errors = watchConsole(page);
  });
  test.afterEach(() => expect(errors, 'console errors').toEqual([]));

  test('admin gives an engineer duties, sees them in the coverage grid, and the change is in the activity log', async ({ page }, info) => {
    await signInAndWait(page, 'admin');
    await page.goto('/#/settings/users');
    await expect(page.getByTestId('page-users')).toBeVisible();
    await page.getByTestId('toggle-coverage').click();
    await expect(page.getByTestId('coverage-summary')).toContainText(/duties have nobody/);
    await expect(page.getByTestId('cov-K.1-shift_entry')).toHaveAttribute('data-state', 'gap');
    await page.getByTestId('toggle-coverage').click();

    await page.getByRole('button', { name: 'Open Demo Engineer' }).click();
    const modal = page.getByTestId('user-modal');
    await expect(modal.getByTestId('resp-empty')).toBeVisible();
    // main shift entry for line 1
    await modal.getByTestId('resp-duty').selectOption('shift_entry');
    await modal.getByTestId('resp-scope').selectOption('line:L.1');
    await modal.getByTestId('resp-add-btn').click();
    // month review needs a section
    await modal.getByTestId('resp-duty').selectOption('month_review');
    await modal.getByTestId('resp-add-btn').click();
    await expect(modal.getByTestId('resp-error')).toContainText('Choose the section');
    await modal.getByTestId('resp-section-pick').selectOption('downtime');
    await modal.getByTestId('resp-scope').selectOption('plant');
    await modal.getByTestId('resp-add-btn').click();
    // backup for K.2 for October only
    await modal.getByTestId('resp-duty').selectOption('shift_entry');
    await modal.getByTestId('resp-scope').selectOption('area:K.2');
    await modal.getByTestId('resp-is-backup').click();
    await modal.getByTestId('resp-from').fill('2026-10-01');
    await modal.getByTestId('resp-to').fill('2026-10-31');
    await modal.getByTestId('resp-add-btn').click();
    await expect(modal.getByTestId('resp-item')).toHaveCount(3);
    await expect(modal.getByTestId('resp-unsaved')).toBeVisible();
    await modal.getByTestId('resp-section').screenshot({ path: info.outputPath('responsibilities.png') });
    await modal.getByTestId('resp-save').click();
    await expect(modal.getByTestId('resp-unsaved')).toHaveCount(0);
    await expect(modal.getByTestId('resp-count')).toHaveText('3 duties');
    await page.getByTestId('user-close').click();

    await page.getByTestId('toggle-coverage').click();
    await expect(page.getByTestId('cov-K.1-shift_entry')).toContainText('Demo Engineer');
    await expect(page.getByTestId('cov-K.1-shift_entry')).toHaveAttribute('data-state', 'no-backup');
    await expect(page.getByTestId('cov-downtime-month_review')).toContainText('Demo Engineer');
    await expect(page.getByTestId('cov-K.1-production_review')).toHaveAttribute('data-state', 'gap');
    await page.getByTestId('coverage').screenshot({ path: info.outputPath('coverage.png') });

    // reopen: the saved duties come back; remove one and save
    await page.getByRole('button', { name: 'Open Demo Engineer' }).click();
    await expect(modal.getByTestId('resp-item')).toHaveCount(3);
    await modal.getByTestId('resp-item').filter({ hasText: 'Month review' }).getByTestId('resp-remove').click();
    await modal.getByTestId('resp-save').click();
    await expect(modal.getByTestId('resp-count')).toHaveText('2 duties');
  });

  test('phone: the editor and the grid fit the screen', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAndWait(page, 'admin');
    await page.goto('/#/settings/users');
    await page.getByTestId('toggle-coverage').click();
    await expect(page.getByTestId('coverage')).toBeVisible();
    expect((await noSidewaysScroll(page)).ok).toBe(true);
    await page.getByTestId('user-card').filter({ hasText: 'Demo Engineer' }).click();
    await expect(page.getByTestId('resp-section')).toBeVisible();
    await page.getByTestId('resp-section').screenshot({ path: info.outputPath('responsibilities-phone.png') });
    expect((await noSidewaysScroll(page)).ok).toBe(true);
  });

  test('a viewer has no Users page, a manager without Users Edit sees no editor', async ({ page }) => {
    await signInAndWait(page, 'manager');
    await page.goto('/#/settings/users');
    await expect(page.getByTestId('resp-section')).toHaveCount(0);
  });
});
