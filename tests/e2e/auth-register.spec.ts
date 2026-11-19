import { expect, test } from '@playwright/test'

test('new account receives its own empty encrypted workspace', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const name = `Workspace ${suffix}`
  await page.goto('/register')
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email address').fill(`workspace-${suffix}@example.test`)
  await page.getByLabel('Password').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: `Good morning, Workspace` })).toBeVisible()
  await expect(page.getByText('Total files').locator('..')).toContainText('0')
  await expect(page.getByText('No uploaded files yet')).toBeVisible()
  await expect(page.getByText('No storage activity')).toBeVisible()
})
