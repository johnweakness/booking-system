import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Admin CRUD for capacity slots (daily/time-slot inventory caps + peak pricing).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticketTypeId = searchParams.get('ticketTypeId');
  const supabase = createAdminClient();

  let query = supabase.from('capacity_slots').select('*').order('slot_date', { ascending: true });
  if (ticketTypeId) query = query.eq('ticket_type_id', ticketTypeId);

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slots: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('capacity_slots')
    .insert({
      ticket_type_id: body.ticketTypeId,
      slot_date: body.slotDate,
      start_time: body.startTime ?? null,
      end_time: body.endTime ?? null,
      pricing_tier: body.pricingTier ?? 'off_peak',
      price_cents_override: body.priceCentsOverride ?? null,
      max_capacity: body.maxCapacity,
      is_blackout: body.isBlackout ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slot: data }, { status: 201 });
}
