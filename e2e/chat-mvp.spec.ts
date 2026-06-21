import { expect, test } from '@playwright/test'

async function openDemoChat(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '使用 Demo 账号' }).click()
  await expect(page.getByRole('heading', { name: '聊天' })).toBeVisible()
}

test.describe('Chat MVP company-trial smoke', () => {
  test('opens demo mode, sends a direct message, and searches the current chat', async ({ page }) => {
    await openDemoChat(page)

    await page.getByText('林小米').click()
    await expect(page.getByRole('textbox', { name: '消息' })).toBeVisible()

    const body = `E2E 自动验收消息 ${Date.now()}`
    await page.getByRole('textbox', { name: '消息' }).fill(body)
    await page.getByRole('button', { name: '发送消息' }).click()
    await expect(page.getByRole('log').getByText(body)).toBeVisible()

    await page.getByRole('button', { name: '搜索当前会话' }).click()
    await page.getByLabel('搜索当前会话消息').fill('自动验收')
    await expect(page.getByText(/条结果/)).toBeVisible()
    await expect(page.getByRole('button', { name: /当前会话搜索结果：E2E 自动验收消息/ })).toBeVisible()
  })

  test('opens group details and verifies management sections are available to the demo owner', async ({
    page,
  }) => {
    await openDemoChat(page)

    await page.getByText('上线准备群').click()
    await expect(page.getByRole('textbox', { name: '消息' })).toBeVisible()
    await page.getByRole('button', { name: /上线准备群/ }).click()

    await expect(page.getByRole('heading', { level: 1, name: '上线准备群' })).toBeVisible()
    await expect(page.getByRole('region', { name: '群公告与权限' })).toBeVisible()
    await expect(page.getByRole('region', { name: '群成员', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: '群文件' })).toBeVisible()
    await expect(page.getByText('全体禁言')).toBeVisible()

    await page.getByRole('button', { name: '更多群管理' }).click()
    await expect(page.getByRole('region', { name: '运行状态' })).toBeVisible()
    await expect(page.getByRole('region', { name: '群管理记录' })).toBeVisible()
  })

  test('shows media upload previews and in-app image viewer actions in demo mode', async ({ page }) => {
    await openDemoChat(page)

    await page.getByText('林小米').click()
    await page.getByLabel('文件附件').setInputFiles({
      name: 'e2e-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l7z8dQAAAABJRU5ErkJggg==',
        'base64',
      ),
    })

    await expect(page.getByRole('img', { name: 'e2e-photo.png' })).toBeVisible()
    await page.getByRole('button', { name: '打开图片 e2e-photo.png' }).click()
    await expect(page.getByRole('dialog', { name: '图片预览' })).toBeVisible()
    await page.getByRole('button', { name: '图片操作' }).click()
    await expect(page.getByRole('button', { name: '保存图片' })).toBeVisible()
    await expect(page.getByRole('link', { name: '打开原图' })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click()
    await page.getByRole('button', { name: '关闭图片预览' }).click()
    await expect(page.getByRole('dialog', { name: '图片预览' })).toBeHidden()

    await page.getByLabel('文件附件').setInputFiles({
      name: 'e2e-video.webm',
      mimeType: 'video/webm',
      buffer: Buffer.from('video'),
    })
    await expect(page.getByLabel('视频消息 e2e-video.webm')).toBeVisible()
  })

  test('disables the composer while the browser is offline', async ({ context, page }) => {
    await openDemoChat(page)

    await page.getByText('林小米').click()
    await expect(page.getByRole('textbox', { name: '消息' })).toBeVisible()

    await context.setOffline(true)
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))

    await expect(page.getByText('离线')).toBeVisible()
    await expect(page.getByRole('textbox', { name: '消息' })).toBeDisabled()
    await expect(page.getByText('网络不可用，恢复后可继续发送。')).toBeVisible()

    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(page.getByRole('textbox', { name: '消息' })).toBeEnabled()
  })
})
