import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyMayaWebhookSignature } from '@/lib/maya/client';
import { syncBookingToPOS, pushSaleRecordToPOS } from '@/lib/pos/syncService';

// POST /api/payments/webhook
// Receives Maya's asynchronous payment status notification, verifies the
// signature, and updates the booking's payment status. This is the
// authoritative source of truth for payment status (the success/failure
// redirect URLs are only for UX — never trust them alone).
//
// TODO(client): confirm the exact webhook payload shape + signature header
// name for your Maya merchant account/webhook subscription and adjust the
// parsing below (`requestReferenceNumber`/`status` fields shown here follow
// Maya's commonly documented Checkout webhook format).
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('maya-signature');

  if (!verifyMayaWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: {
    requestReferenceNumber?: string;
    checkoutId?: string;
    paymentId?: string;
    status?: string;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const bookingReference = payload.requestReferenceNumber;
  const mayaStatus = (payload.status ?? '').toUpperCase();

  if (!bookingReference) {
    return NextResponse.json({ error: 'Missing requestReferenceNumber' }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('booking_reference', bookingReference)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found for reference' }, { status: 404 });
  }

  const isPaid = mayaStatus === 'PAYMENT_SUCCESS' || mayaStatus === 'SUCCESS' || mayaStatus === 'PAID';
  const isFailed = mayaStatus === 'PAYMENT_FAILED' || mayaStatus === 'FAILED';
  const isCancelled = mayaStatus === 'PAYMENT_CANCELLED' || mayaStatus === 'CANCELLED';

  const newPaymentStatus = isPaid ? 'paid' : isFailed ? 'failed' : isCancelled ? 'cancelled' : 'pending';
  const newBookingStatus = isPaid ? 'confirmed' : isFailed || isCancelled ? 'cancelled' : booking.status;

  await supabase
    .from('payments')
    .update({
      status: newPaymentStatus,
      provider_payment_id: payload.paymentId ?? undefined,
      raw_response: payload as unknown as Record<string, unknown>,
    })
    .eq('booking_id', booking.id)
    .eq('provider_checkout_id', payload.checkoutId ?? booking.booking_reference);

  await supabase
    .from('bookings')
    .update({ payment_status: newPaymentStatus, status: newBookingStatus })
    .eq('id', booking.id);

  // Release held capacity if the payment failed/was cancelled so the slot
  // becomes available to other guests again.
  if (isFailed || isCancelled) {
    const { data: items } = await supabase
      .from('booking_items')
      .select('capacity_slot_id, quantity, item_type')
      .eq('booking_id', booking.id);

    await Promise.all(
      (items ?? [])
        .filter((i) => i.item_type === 'ticket' && i.capacity_slot_id)
        .map((i) =>
          supabase.rpc('release_capacity', {
            p_capacity_slot_id: i.capacity_slot_id!,
            p_quantity: i.quantity,
          })
        )
    );
  }

  // On successful payment: push the confirmed booking + sale record to the
  // POS so gate staff and online inventory stay in sync.
  if (isPaid) {
    const { data: items } = await supabase.from('booking_items').select('*').eq('booking_id', booking.id);

    await syncBookingToPOS(booking.id, {
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      guestName: booking.guest_name,
      guestEmail: booking.guest_email,
      items: (items ?? []).map((i) => ({
        ticketTypeId: i.ticket_type_id ?? undefined,
        ticketAddonId: i.ticket_addon_id ?? undefined,
        quantity: i.quantity,
        unitPriceCents: i.unit_price_cents,
      })),
      totalCents: booking.total_cents,
      currency: booking.currency,
    });

    await pushSaleRecordToPOS(booking.id, {
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      totalCents: booking.total_cents,
      currency: booking.currency,
      paidAt: new Date().toISOString(),
      paymentProvider: 'maya',
    });
  }

  return NextResponse.json({ received: true });
}
