import { expect, test } from '@playwright/test';

// E2E smoke tests are excluded from CI (require running app + external services).
// Run locally with: npm run test:e2e

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/shelfchef/i)).toBeVisible();
});

test('health endpoint returns ok', async ({ request }) => {
  const res = await request.get('http://localhost:3001/api/v1/health');
  expect(res.ok()).toBe(true);
  const body = await res.json() as { status: string };
  expect(body.status).toBe('ok');
});
