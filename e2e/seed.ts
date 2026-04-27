import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function seedFixtures() {
  // Today + tomorrow, both in current week. Seeding on today ensures they show
  // in the Agenda which defaults to today's selected day.
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  const rows = [
    { title: 'E2E Jazz Night', start_at: today.toISOString(), type: 'music', source: 'e2e', source_external_id: 'e2e-1' },
    { title: 'E2E Market', start_at: today.toISOString(), type: 'food', source: 'e2e', source_external_id: 'e2e-2' },
    { title: 'E2E Council Meeting', start_at: tomorrow.toISOString(), type: 'civic', source: 'e2e', source_external_id: 'e2e-3' },
  ]
  await sb.from('events').delete().eq('source', 'e2e')
  await sb.from('events').insert(rows)
}

export async function clearFixtures() {
  await sb.from('events').delete().eq('source', 'e2e')
}
