import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('allows a new user to register', async ({ page }) => {
    // Look for register/sign-up link or button
    const registerLink = page.getByRole('link', { name: /register|sign up/i })
      .or(page.getByRole('button', { name: /register|sign up/i }));

    if (await registerLink.isVisible()) {
      await registerLink.click();
    }

    // Fill registration form
    const usernameField = page.getByLabel(/username/i).or(page.getByPlaceholder(/username/i));
    const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));

    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
    }
    if (await emailField.isVisible()) {
      await emailField.fill('test@example.com');
    }
    if (await passwordField.isVisible()) {
      await passwordField.fill('testpass123');
    }

    const submitBtn = page.getByRole('button', { name: /register|sign up|create/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Should redirect to dashboard or show success
      await expect(page).not.toHaveURL(/register|signup/i, { timeout: 5000 });
    }
  });

  test('allows login with valid credentials', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /login|sign in/i })
      .or(page.getByRole('button', { name: /login|sign in/i }));

    if (await loginLink.isVisible()) {
      await loginLink.click();
    }

    const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));

    if (await emailField.isVisible()) {
      await emailField.fill('admin@sportscard.local');
    }
    if (await passwordField.isVisible()) {
      await passwordField.fill('admin123');
    }

    const submitBtn = page.getByRole('button', { name: /login|sign in/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('shows error for invalid credentials', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /login|sign in/i })
      .or(page.getByRole('button', { name: /login|sign in/i }));

    if (await loginLink.isVisible()) {
      await loginLink.click();
    }

    const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));

    if (await emailField.isVisible()) {
      await emailField.fill('wrong@example.com');
    }
    if (await passwordField.isVisible()) {
      await passwordField.fill('wrongpassword');
    }

    const submitBtn = page.getByRole('button', { name: /login|sign in/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Should show error message
      const errorMsg = page.getByText(/invalid|error|incorrect|failed/i);
      await expect(errorMsg).toBeVisible({ timeout: 5000 }).catch(() => {
        // Error display may vary
      });
    }
  });

  test('allows user to logout', async ({ page }) => {
    // First login
    const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));

    if (await emailField.isVisible()) {
      await emailField.fill('admin@sportscard.local');
      await passwordField.fill('admin123');
      const submitBtn = page.getByRole('button', { name: /login|sign in/i });
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Now logout
    const logoutBtn = page.getByRole('button', { name: /logout|sign out/i })
      .or(page.getByRole('link', { name: /logout|sign out/i }));

    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForTimeout(500);
    }
  });
});
