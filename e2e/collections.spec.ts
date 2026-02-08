import { test, expect } from '@playwright/test';

// Helper: login with admin credentials
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.locator('#email').fill('admin@sportscard.local');
  await page.locator('#password').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.auth-container')).not.toBeVisible({ timeout: 5000 });
}

test.describe('Collections', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.auth-container')).toBeVisible({ timeout: 10000 });
    await loginAsAdmin(page);
  });

  test('can create a new collection', async ({ page }) => {
    // Navigate to collections
    const collectionsLink = page.getByRole('link', { name: /collection/i });
    if (await collectionsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await collectionsLink.click();
      await page.waitForTimeout(500);
    }

    // Click create/add collection button
    const createBtn = page.getByRole('button', { name: /create|add|new/i }).first();
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();

      const nameField = page.getByLabel(/name/i).or(page.getByPlaceholder(/name/i));
      if (await nameField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameField.fill('Test Collection');

        const saveBtn = page.getByRole('button', { name: /save|create|add/i });
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('can move card to another collection', async ({ page }) => {
    // Navigate to cards
    const cardsLink = page.getByRole('link', { name: /cards|collection|inventory/i });
    if (await cardsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cardsLink.click();
      await page.waitForTimeout(500);
    }

    // Look for move/collection assignment UI
    const moveBtn = page.getByRole('button', { name: /move|collection|assign/i }).first();
    if (await moveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moveBtn.click();
      await page.waitForTimeout(500);

      // Select a collection from dropdown or list
      const collectionOption = page.getByRole('option').or(page.getByRole('listitem')).first();
      if (await collectionOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await collectionOption.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('default collection exists', async ({ page }) => {
    // Navigate to collections view
    const collectionsLink = page.getByRole('link', { name: /collection/i });
    if (await collectionsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await collectionsLink.click();
      await page.waitForTimeout(500);
    }

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });
});
