import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
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

  test('all navigation links load without errors', async ({ page }) => {
    // Get all nav links
    const navLinks = page.locator('nav a, [role="navigation"] a, .sidebar a, .nav a');
    const count = await navLinks.count();

    for (let i = 0; i < count; i++) {
      const link = navLinks.nth(i);
      if (await link.isVisible()) {
        const href = await link.getAttribute('href');
        if (href && href.startsWith('/')) {
          await link.click();
          await page.waitForTimeout(500);

          // Page should not show error boundary or crash
          const errorBoundary = page.getByText(/something went wrong|error|crash/i);
          const hasError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
          expect(hasError).toBe(false);
        }
      }
    }
  });

  test('routing works correctly', async ({ page }) => {
    // Test direct navigation to known routes
    const routes = ['/', '/dashboard', '/cards', '/collections', '/settings'];

    for (const route of routes) {
      const response = await page.goto(route);
      // Should not get a server error (404 is ok for SPA - it redirects)
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
      // Page should render
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
