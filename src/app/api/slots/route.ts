import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/slots?ticketTypeId=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns capacity slots (with remaining capacity) for the guest-facing date/slot picker.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticketTypeId = searchParams.get('ticketTypeId');
  const from = searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
  const to =
    searchParams.get('to') ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (!ticketTypeId) {
    return NextResponse.json({ error: 'ticketTypeId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('capacity_slots')
    .select('*')
    .eq('ticket_type_id', ticketTypeId)
    .gte('slot_date', from)
    .lte('slot_date', to)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const slots = (data ?? []).map((slot) => ({
    ...slot,
    remaining_capacity: Math.max(slot.max_capacity - slot.booked_count, 0),
    sold_out: !slot.is_blackout && slot.booked_count >= slot.max_capacity,
  }));

  return NextResponse.json({ slots });
}
