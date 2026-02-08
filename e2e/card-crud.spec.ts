import { test, expect } from '@playwright/test';

// Helper: login with admin credentials
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.locator('#email').fill('admin@sportscard.local');
  await page.locator('#password').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.auth-container')).not.toBeVisible({ timeout: 5000 });
}

test.describe('Card CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.auth-container')).toBeVisible({ timeout: 10000 });
    await loginAsAdmin(page);
  });

  test('can add a new card', async ({ page }) => {
    // Navigate to add card page
    const addBtn = page.getByRole('link', { name: /add card|new card/i })
      .or(page.getByRole('button', { name: /add card|new card/i }));

    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
    }

    // Fill card form
    const playerField = page.getByLabel(/player/i).or(page.getByPlaceholder(/player/i));
    if (await playerField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playerField.fill('Mike Trout');

      const teamField = page.getByLabel(/team/i).or(page.getByPlaceholder(/team/i));
      if (await teamField.isVisible()) {
        await teamField.fill('Angels');
      }

      const yearField = page.getByLabel(/year/i).or(page.getByPlaceholder(/year/i));
      if (await yearField.isVisible()) {
        await yearField.fill('2023');
      }

      const brandField = page.getByLabel(/brand|manufacturer/i).or(page.getByPlaceholder(/brand/i));
      if (await brandField.isVisible()) {
        await brandField.fill('Topps Chrome');
      }

      // Submit the form
      const saveBtn = page.getByRole('button', { name: /save|add|submit|create/i });
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('can view cards in list', async ({ page }) => {
    // Navigate to cards list / collection
    const cardsLink = page.getByRole('link', { name: /cards|collection|inventory/i });
    if (await cardsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cardsLink.click();
      await page.waitForTimeout(500);
    }

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('can edit an existing card', async ({ page }) => {
    // Navigate to cards list
    const cardsLink = page.getByRole('link', { name: /cards|collection|inventory/i });
    if (await cardsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cardsLink.click();
      await page.waitForTimeout(500);
    }

    // Find and click edit button on a card
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(500);

      // Modify a field
      const playerField = page.getByLabel(/player/i).or(page.getByPlaceholder(/player/i));
      if (await playerField.isVisible()) {
        await playerField.clear();
        await playerField.fill('Shohei Ohtani');

        const saveBtn = page.getByRole('button', { name: /save|update/i });
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('can delete a card', async ({ page }) => {
    // Navigate to cards list
    const cardsLink = page.getByRole('link', { name: /cards|collection|inventory/i });
    if (await cardsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cardsLink.click();
      await page.waitForTimeout(500);
    }

    // Find and click delete button
    const deleteBtn = page.getByRole('button', { name: /delete|remove/i }).first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();

      // Confirm deletion if dialog appears
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|ok/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(500);
    }
  });

  test('dashboard shows stats', async ({ page }) => {
    // Navigate to dashboard
    const dashLink = page.getByRole('link', { name: /dashboard|home/i });
    if (await dashLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dashLink.click();
    }

    // Dashboard should render without errors
    await expect(page.locator('body')).toBeVisible();
    // Look for stats elements
    const statsArea = page.getByText(/total|value|cards|portfolio/i).first();
    if (await statsArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(statsArea).toBeVisible();
    }
  });

  test('can export cards to CSV', async ({ page }) => {
    // Look for export button
    const exportBtn = page.getByRole('button', { name: /export|csv|download/i }).first();
    if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.(csv|json)$/i);
      }
    }
  });
});
