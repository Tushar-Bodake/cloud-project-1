import { expect, test } from '@playwright/test'

test('invalid credentials are rejected with an actionable error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(`missing-${Date.now()}@example.test`)
  await page.getByLabel('Password').fill('IncorrectPassword123!')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
