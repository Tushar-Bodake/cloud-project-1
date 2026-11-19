import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('uploaded encrypted file metadata persists in the owner file list', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const fileName = `encrypted-${suffix}.txt`
  await page.goto('/register')
  await page.getByLabel('Full name').fill('Upload Tester')
  await page.getByLabel('Email address').fill(`upload-${suffix}@example.test`)
  await page.getByLabel('Password').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: 'Upload' }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from('Client-side encryption persistence check'),
  })
  await expect(page.getByRole('heading', { name: 'Upload files' })).toHaveCount(0)
  await page.getByRole('link', { name: 'My Files' }).click()
  await expect(page.getByText(fileName)).toBeVisible({ timeout: 30_000 })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: `Download ${fileName}` }).click()
  const download = await downloadPromise
  const downloadedFilePath = await download.path()
  expect(downloadedFilePath).not.toBeNull()
  expect(await readFile(downloadedFilePath!)).toEqual(Buffer.from('Client-side encryption persistence check'))
  await page.reload()
  await expect(page.getByText(fileName)).toBeVisible({ timeout: 30_000 })
})
