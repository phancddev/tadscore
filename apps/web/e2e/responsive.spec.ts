import { expect, test } from '@playwright/test';

async function expectTouchTargets(page: import('@playwright/test').Page) {
  const undersized = await page
    .locator('button, input:not([type="hidden"]), select, textarea')
    .evaluateAll((controls) =>
      controls
        .filter((control) => {
          const rect = control.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
        })
        .map((control) => ({
          label:
            control.getAttribute('aria-label') || control.textContent?.trim() || control.tagName,
          size: `${Math.round(control.getBoundingClientRect().width)}x${Math.round(control.getBoundingClientRect().height)}`,
        })),
    );
  expect(undersized).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
    }),
  );
});

test('authentication remains usable without horizontal page overflow', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeVisible();
  await expect(page.getByLabel('Email hoặc username')).toBeVisible();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible();
  const sizes = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  await expectTouchTargets(page);
});

test('public ranking is responsive and exposes team detail without authentication', async ({
  page,
}) => {
  const ranking = {
    workspace: { id: 'w1', name: 'Trại hè 2026' },
    rule: { id: 'hoh-2026', version: '1.0.0', minimumPieces: 4 },
    teams: [
      {
        teamId: 't1',
        id: 't1',
        name: 'Lan',
        displayName: 'Nhà Lan',
        medals: 120,
        pieces: 4,
        items: 1,
        eligible: true,
        rank: 1,
      },
      {
        teamId: 't2',
        id: 't2',
        name: 'Mai',
        displayName: 'Nhà Mai',
        medals: 90,
        pieces: 2,
        items: 0,
        eligible: false,
        rank: 2,
      },
    ],
  };
  await page.route('**/api/public/rankings/demo/events', (route) => route.abort());
  await page.route('**/api/public/rankings/demo/teams/t1', (route) =>
    route.fulfill({ json: { data: { ...ranking.teams[0], ledger: [] } } }),
  );
  await page.route('**/api/public/rankings/demo', (route) =>
    route.fulfill({ json: { data: ranking } }),
  );
  await page.goto('/ranking/demo');
  await expect(page.getByRole('heading', { name: 'Trại hè 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem chi tiết Nhà Lan' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Nhà Lan' })).toBeVisible();
  const sizes = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  await expectTouchTargets(page);
});
