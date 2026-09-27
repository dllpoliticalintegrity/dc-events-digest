import { chromium } from '@playwright/test'
const SP = process.env.SP
const now = new Date()
function iso(dayOffset, h, m = 0) { const d = new Date(now); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.toISOString() }
const sample = [
  { id: '1', title: 'Jazz in the Garden', start_at: iso(0, 17), type: 'music', venue_name: 'Sculpture Garden', cost_text: 'Free', source: 'clockout' },
  { id: '2', title: 'FreshFarm Farmers Market', start_at: iso(0, 10), type: 'food', venue_name: 'Union Market', cost_text: null, source: 'unionmarket' },
  { id: '3', title: 'ANC 1A Public Meeting', start_at: iso(1, 19), type: 'civic', venue_name: null, cost_text: null, source: '730dc' },
  { id: '4', title: 'Hamilton Leithauser + Rostam: The Joint Tour', start_at: iso(1, 19), type: 'music', venue_name: '9:30 Club', cost_text: 'Sold out', source: 'imp' },
  { id: '5', title: 'Late Night Show', start_at: iso(1, 22, 30), type: 'arts', venue_name: 'Rhizome DC', cost_text: '$10-15', source: 'rhizome' },
  { id: '6', title: 'Union Market District Street Fest', start_at: iso(3, 0), type: 'community', venue_name: 'Union Market', cost_text: null, source: 'unionmarket', is_all_day: true },
  { id: '7', title: 'Sukkah Open Hours', start_at: iso(4, 9), type: 'community', venue_name: 'Sixth & I', cost_text: null, source: 'sixthandi' },
]
const row = e => ({ end_at: null, is_all_day: false, venue_address: null, neighborhood: null, url: null, source_external_id: e.id, description: null, created_at: '', updated_at: '', ...e })
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [name, viewport] of [['desktop', { width: 1200, height: 1400 }], ['phone', { width: 390, height: 1200 }]]) {
  const page = await browser.newPage({ viewport })
  await page.route('**/rest/v1/events**', async route => {
    const url = new URL(route.request().url())
    const gte = url.searchParams.get('start_at')  // 'gte.<iso>' first occurrence
    const lo = new Date(gte.replace('gte.', ''))
    const hi = new Date(lo); hi.setDate(hi.getDate() + 7)
    const rows = sample.map(row).filter(e => { const t = new Date(e.start_at); return t >= lo && t < hi })
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
  await page.route('**/rest/v1/event_tags**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SP}/calendar-${name}.png`, fullPage: true })
  const weeks = await page.locator('[data-week]').count()
  const secondWeek = await page.locator('[data-week]').nth(1).getAttribute('data-week')
  console.log(name, 'weeks rendered:', weeks, 'second:', secondWeek)
  if (name === 'desktop') {
    await page.getByText('▾ next week').click()
    await page.waitForTimeout(300)
    console.log('after next click weeks:', await page.locator('[data-week]').count())
    await page.getByText('Jazz in the Garden').click()
    await page.waitForTimeout(300)
    console.log('modal open:', await page.getByRole('dialog').count())
  }
  await page.close()
}
await browser.close()
