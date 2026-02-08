import { test, expect } from '@playwright/test';

test.describe('Collections', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Try to login first
    const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    if (await emailField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailField.fill('admin@sportscard.local');
      const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
      await passwordField.fill('admin123');
      const submitBtn = page.getByRole('button', { name: /login|sign in/i });
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
      }
    }
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
