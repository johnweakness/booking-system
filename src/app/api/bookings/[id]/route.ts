import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTicketQRDataUrl } from '@/lib/tickets/qr';

// GET /api/bookings/[id] — booking detail + line items (used by the
// confirmation page to render the QR e-ticket(s)).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, booking_items(*)')
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  const ticketItems = (booking.booking_items ?? []).filter(
    (item: { item_type: string }) => item.item_type === 'ticket'
  );

  const tickets = await Promise.all(
    ticketItems.map(async (item: { ticket_uuid: string | null; id: string }) => ({
      bookingItemId: item.id,
      ticketUuid: item.ticket_uuid!,
      qrDataUrl: await generateTicketQRDataUrl(item.ticket_uuid!),
    }))
  );

  return NextResponse.json({ booking, tickets });
}
