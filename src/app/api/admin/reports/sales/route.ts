import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/admin/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
// Basic sales report: daily revenue + tickets sold by ticket type, computed
// from paid bookings within the date range.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = searchParams.get('to') ?? new Date().toISOString();

  const supabase = createAdminClient();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, total_cents, created_at, payment_status, booking_items(item_type, ticket_type_id, quantity, line_total_cents)')
    .eq('payment_status', 'paid')
    .gte('created_at', from)
    .lte('created_at', to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dailyRevenue = new Map<string, number>();
  const ticketsByType = new Map<string, { quantity: number; revenueCents: number }>();

  for (const booking of bookings ?? []) {
    const day = booking.created_at.slice(0, 10);
    dailyRevenue.set(day, (dailyRevenue.get(day) ?? 0) + booking.total_cents);

    for (const item of booking.booking_items ?? []) {
      if (item.item_type !== 'ticket' || !item.ticket_type_id) continue;
      const existing = ticketsByType.get(item.ticket_type_id) ?? { quantity: 0, revenueCents: 0 };
      existing.quantity += item.quantity;
      existing.revenueCents += item.line_total_cents;
      ticketsByType.set(item.ticket_type_id, existing);
    }
  }

  const { data: ticketTypes } = await supabase.from('ticket_types').select('id, name');
  const ticketTypeNames = new Map((ticketTypes ?? []).map((t) => [t.id, t.name]));

  return NextResponse.json({
    dailyRevenue: [...dailyRevenue.entries()].map(([date, revenueCents]) => ({ date, revenueCents })),
    ticketsByType: [...ticketsByType.entries()].map(([ticketTypeId, stats]) => ({
      ticketTypeId,
      ticketTypeName: ticketTypeNames.get(ticketTypeId) ?? 'Unknown',
      ...stats,
    })),
    totalRevenueCents: (bookings ?? []).reduce((sum, b) => sum + b.total_cents, 0),
    totalBookings: (bookings ?? []).length,
  });
}
