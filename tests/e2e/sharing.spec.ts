import { expect, test } from '@playwright/test'

test('owner can wrap a file key for a registered recipient', async ({ page, browser }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const recipientEmail = `recipient-${suffix}@example.test`
  const ownerEmail = `owner-${suffix}@example.test`
  const context = await browser.newContext()
  const recipientPage = await context.newPage()

  try {
    await recipientPage.goto('/register')
    await recipientPage.getByLabel('Full name').fill('Recipient User')
    await recipientPage.getByLabel('Email address').fill(recipientEmail)
    await recipientPage.getByLabel('Password').fill('TestPassword123!')
    await recipientPage.getByRole('button', { name: 'Create account' }).click()
    await expect(recipientPage).toHaveURL(/\/dashboard$/)

    await page.goto('/register')
    await page.getByLabel('Full name').fill('Owner User')
    await page.getByLabel('Email address').fill(ownerEmail)
    await page.getByLabel('Password').fill('TestPassword123!')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.getByRole('button', { name: 'Upload' }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: `shared-${suffix}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('A locally encrypted file shared with a test recipient'),
    })
    await page.getByRole('link', { name: 'My Files' }).click()
    const shareButton = page.getByRole('button', { name: `Share shared-${suffix}.txt` })
    await expect(shareButton).toBeVisible({ timeout: 30_000 })
    page.once('dialog', dialog => dialog.accept(recipientEmail))
    await shareButton.click()
    await expect(page.getByRole('alert')).toContainText('File shared successfully', { timeout: 15_000 })

    await recipientPage.getByRole('link', { name: 'Shared With Me' }).click()
    await expect(recipientPage.getByText(`shared-${suffix}.txt`)).toBeVisible({ timeout: 30_000 })
  } finally {
    await context.close()
  }
})
