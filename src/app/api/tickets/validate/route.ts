import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/tickets/validate
// Body: { ticketUuid: string }
// Called by gate staff (or the POS system) when scanning a guest's QR code.
// Marks the ticket as `used` if it is valid, unused, and belongs to a paid
// booking — preventing double-entry with a single ticket.
export async function POST(req: NextRequest) {
  try {
    const { ticketUuid } = await req.json();
    if (!ticketUuid) {
      return NextResponse.json({ valid: false, error: 'ticketUuid is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: item, error } = await supabase
      .from('booking_items')
      .select('*, bookings(status, payment_status, guest_name)')
      .eq('ticket_uuid', ticketUuid)
      .single();

    if (error || !item) {
      return NextResponse.json({ valid: false, error: 'Ticket not found.' }, { status: 404 });
    }

    const booking = item.bookings as unknown as { status: string; payment_status: string; guest_name: string };

    if (booking.payment_status !== 'paid' || booking.status !== 'confirmed') {
      return NextResponse.json({ valid: false, error: 'Ticket is not paid/confirmed.' }, { status: 409 });
    }

    if (item.ticket_status === 'used') {
      return NextResponse.json(
        { valid: false, error: 'Ticket already used.', usedAt: item.used_at },
        { status: 409 }
      );
    }

    if (item.ticket_status === 'void') {
      return NextResponse.json({ valid: false, error: 'Ticket has been voided.' }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from('booking_items')
      .update({ ticket_status: 'used', used_at: new Date().toISOString() })
      .eq('id', item.id);

    if (updateError) {
      return NextResponse.json({ valid: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ valid: true, guestName: booking.guest_name, ticketUuid });
  } catch (err) {
    console.error('[POST /api/tickets/validate]', err);
    return NextResponse.json({ valid: false, error: 'Validation failed.' }, { status: 500 });
  }
}
