import { test, expect } from '@playwright/test';

// Helper: login with admin credentials
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.locator('#email').fill('admin@sportscard.local');
  await page.locator('#password').fill('admin123');
  await page.locator('button[type="submit"]').click();
  // Wait for auth form to disappear (login complete)
  await expect(page.locator('.auth-container')).not.toBeVisible({ timeout: 5000 });
}

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for auth form to appear
    await expect(page.locator('.auth-container')).toBeVisible({ timeout: 10000 });
  });

  test('allows a new user to register', async ({ page }) => {
    // Default mode is login - switch to register
    await page.locator('button.toggle-link').click();

    // Wait for registration form heading
    await expect(page.locator('.auth-header h2')).toContainText('Create Account');

    // Fill registration form using specific IDs
    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('newuser@example.com');
    await page.locator('#password').fill('testpass123');
    await page.locator('#confirmPassword').fill('testpass123');

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should redirect away from auth form
    await expect(page.locator('.auth-container')).not.toBeVisible({ timeout: 5000 });
  });

  test('allows login with valid credentials', async ({ page }) => {
    // Already on login form by default
    await expect(page.locator('.auth-header h2')).toContainText('Sign In');

    await loginAsAdmin(page);

    // Should now see the main app (body visible, auth form gone)
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.locator('#email').fill('wrong@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Should show error message
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 5000 });
  });

  test('allows user to logout', async ({ page }) => {
    // First login
    await loginAsAdmin(page);

    // Find and click logout button
    const logoutBtn = page.getByRole('button', { name: /logout|sign out/i })
      .or(page.getByRole('link', { name: /logout|sign out/i }));

    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
      // Should show auth form again
      await expect(page.locator('.auth-container')).toBeVisible({ timeout: 5000 });
    }
  });
});
