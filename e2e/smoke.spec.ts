import { test, expect } from '@playwright/test'
import { seedFixtures, clearFixtures } from './seed'

test.beforeAll(async () => { await seedFixtures() })
test.afterAll(async () => { await clearFixtures() })

test('loads, shows seeded events, filters by type', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('DC Events Digest')).toBeVisible()
  await expect(page.getByText('E2E Jazz Night')).toBeVisible()
  await expect(page.getByText('E2E Market')).toBeVisible()

  // Filter to music — Market should disappear
  await page.getByRole('button', { name: 'Music' }).click()
  await expect(page.getByText('E2E Jazz Night')).toBeVisible()
  await expect(page.getByText('E2E Market')).not.toBeVisible()
})
