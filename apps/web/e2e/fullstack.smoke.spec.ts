import { expect, test, type APIRequestContext } from '@playwright/test';

const enabled = process.env.TADSCORE_FULLSTACK === '1';
const mailpitUrl = process.env.TADSCORE_MAILPIT_URL || 'http://127.0.0.1:1109';

async function verificationCode(request: APIRequestContext, recipient: string) {
  let messageId = '';
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mailpitUrl}/api/v1/messages`);
        if (!response.ok()) return '';
        const body = (await response.json()) as {
          messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
        };
        messageId =
          body.messages.find((message) => message.To.some(({ Address }) => Address === recipient))
            ?.ID || '';
        return messageId;
      },
      { timeout: 15_000, intervals: [250, 500, 1_000] },
    )
    .not.toBe('');
  const response = await request.get(`${mailpitUrl}/api/v1/message/${messageId}`);
  expect(response.ok()).toBeTruthy();
  const message = (await response.json()) as { Text: string };
  const code = message.Text.match(/\b(\d{6})\b/)?.[1];
  expect(code).toMatch(/^\d{6}$/);
  return code!;
}

test.describe('full-stack smoke', () => {
  test.setTimeout(60_000);
  test.skip(!enabled, 'Set TADSCORE_FULLSTACK=1 to run against the fresh stack.');

  test('registers, verifies, scores, locks, and opens public ranking', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !['mobile-chrome', 'desktop-chrome'].includes(testInfo.project.name),
      'Full-stack smoke targets mobile and desktop only.',
    );
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `e2e-${nonce}@example.test`;
    const username = `e2e_${nonce.replace(/-/g, '_')}`.slice(0, 30);
    const password = `TadScore-${nonce}!`;
    const workspaceName = `E2E ${nonce}`;
    const slug = `e2e-${nonce}`.slice(0, 80);

    await page.goto('/register');
    await page.getByLabel('Họ và tên').fill('TadScore E2E');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByLabel('Nhập lại mật khẩu').fill(password);
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(page).toHaveURL(/\/(login|verify)/);
    if (new URL(page.url()).pathname === '/verify') {
      const code = await verificationCode(request, email);
      await page.getByLabel('Mã xác minh').fill(code);
      await page.getByRole('button', { name: 'Xác minh' }).click();
      await expect(page.getByRole('heading', { name: 'Email đã xác minh' })).toBeVisible();
      await page.getByRole('link', { name: 'Đăng nhập' }).click();
    }

    await page.getByLabel('Email hoặc username').fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('heading', { name: 'Không gian làm việc' })).toBeVisible();

    await page.getByRole('button', { name: 'Tạo workspace' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Tạo workspace' })).toBeVisible();
    await dialog.getByLabel('Tên workspace').fill(workspaceName);
    await dialog.getByLabel('Slug').fill(slug);
    await dialog.getByLabel('Bộ luật').selectOption({ index: 1 });
    await dialog.getByRole('button', { name: 'Tạo workspace' }).click();
    await expect(page.getByRole('heading', { name: workspaceName })).toBeVisible();
    const workspacePath = new URL(page.url()).pathname;

    await page.getByRole('link', { name: 'Nhập điểm', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nhập điểm' })).toBeVisible();
    const rankEntry = page.locator('section[aria-labelledby="rank-title"]');
    const teamFields = rankEntry.locator('fieldset');
    await expect.poll(() => teamFields.count()).toBeGreaterThanOrEqual(2);
    const teamCount = await teamFields.count();
    for (let index = 0; index < teamCount; index += 1) {
      await teamFields
        .nth(index)
        .getByRole('button', { name: `Hạng ${index + 1}` })
        .click();
    }
    await page.getByRole('button', { name: 'Kiểm tra & lưu kết quả' }).click();
    await page.getByRole('button', { name: 'Xác nhận' }).click();
    await expect(page.getByText('Đã lưu kết quả tất cả đội')).toBeVisible();

    await page.getByRole('link', { name: 'Xếp hạng', exact: true }).click();
    await page.getByRole('button', { name: 'Tạo link public' }).click();
    const publicUrl = await page.getByRole('link', { name: 'Mở' }).getAttribute('href');
    expect(publicUrl).toMatch(/\/ranking\//);

    await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
    await page.getByRole('button', { name: 'Khóa nhập điểm' }).click();
    await expect(page.getByText('Đã cập nhật workspace').last()).toBeVisible();
    await page.getByRole('link', { name: 'Nhập điểm', exact: true }).click();
    await expect(page.getByText(/mọi thao tác chấm điểm đã tắt/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kiểm tra & lưu kết quả' })).toBeDisabled();

    await page.goto(publicUrl!);
    await expect(page.getByRole('heading', { name: workspaceName })).toBeVisible();
    const firstTeam = page.getByRole('button', { name: /Xem chi tiết/ }).first();
    await firstTeam.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.goto(`${workspacePath}/settings`);
    await page.getByRole('button', { name: 'Mở khóa' }).click();
    await expect(page.getByText('Đã cập nhật workspace').last()).toBeVisible();
    page.once('dialog', (confirmation) => confirmation.accept());
    await page.getByRole('button', { name: 'Lưu trữ' }).click();
    await expect(page.getByText('Đã cập nhật workspace').last()).toBeVisible();
  });
});
