# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sharing.spec.ts >> owner can wrap a file key for a registered recipient
- Location: tests\e2e\sharing.spec.ts:3:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Timeout: 15000ms
- Expected substring  - 1
+ Received string     + 2

- File shared successfully
+
+ Property ownerId is undefined on object. for 'list' @ L15, false for 'list' @ L29

Call log:
  - Expect "toContainText" getByRole('alert') with timeout 15000ms
  - waiting for getByRole('alert')
    32 × locator resolved to <p role="alert" class="mb-3 rounded-xl border border-white/[0.07] bg-[#111625] px-4 py-3 text-sm text-[#b9c1d1]">↵Property ownerId is undefined on object. for 'li…</p>
       - unexpected value "
Property ownerId is undefined on object. for 'list' @ L15, false for 'list' @ L29"

```

```yaml
- alert: Property ownerId is undefined on object. for 'list' @ L15, false for 'list' @ L29
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | 
  3  | test('owner can wrap a file key for a registered recipient', async ({ page, browser }) => {
  4  |   const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  5  |   const recipientEmail = `recipient-${suffix}@example.test`
  6  |   const ownerEmail = `owner-${suffix}@example.test`
  7  |   const context = await browser.newContext()
  8  |   const recipientPage = await context.newPage()
  9  | 
  10 |   try {
  11 |     await recipientPage.goto('/register')
  12 |     await recipientPage.getByLabel('Full name').fill('Recipient User')
  13 |     await recipientPage.getByLabel('Email address').fill(recipientEmail)
  14 |     await recipientPage.getByLabel('Password').fill('TestPassword123!')
  15 |     await recipientPage.getByRole('button', { name: 'Create account' }).click()
  16 |     await expect(recipientPage).toHaveURL(/\/dashboard$/)
  17 | 
  18 |     await page.goto('/register')
  19 |     await page.getByLabel('Full name').fill('Owner User')
  20 |     await page.getByLabel('Email address').fill(ownerEmail)
  21 |     await page.getByLabel('Password').fill('TestPassword123!')
  22 |     await page.getByRole('button', { name: 'Create account' }).click()
  23 |     await expect(page).toHaveURL(/\/dashboard$/)
  24 | 
  25 |     await page.getByRole('button', { name: 'Upload' }).click()
  26 |     await page.locator('input[type="file"]').setInputFiles({
  27 |       name: `shared-${suffix}.txt`,
  28 |       mimeType: 'text/plain',
  29 |       buffer: Buffer.from('A locally encrypted file shared with a test recipient'),
  30 |     })
  31 |     await page.getByRole('link', { name: 'My Files' }).click()
  32 |     const shareButton = page.getByRole('button', { name: `Share shared-${suffix}.txt` })
  33 |     await expect(shareButton).toBeVisible({ timeout: 30_000 })
  34 |     page.once('dialog', dialog => dialog.accept(recipientEmail))
  35 |     await shareButton.click()
> 36 |     await expect(page.getByRole('alert')).toContainText('File shared successfully', { timeout: 15_000 })
     |                                           ^ Error: expect(locator).toContainText(expected) failed
  37 | 
  38 |     await recipientPage.getByRole('link', { name: 'Shared With Me' }).click()
  39 |     await expect(recipientPage.getByText(`shared-${suffix}.txt`)).toBeVisible({ timeout: 30_000 })
  40 |   } finally {
  41 |     await context.close()
  42 |   }
  43 | })
  44 | 
```