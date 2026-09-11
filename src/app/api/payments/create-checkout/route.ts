import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMayaCheckout } from '@/lib/maya/client';

// POST /api/payments/create-checkout
// Body: { bookingId: string }
// Creates a Maya Checkout session for a pending booking's total and returns
// the redirectUrl the browser should navigate to.
export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json();
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (booking.status !== 'pending' || booking.payment_status === 'paid') {
      return NextResponse.json({ error: 'Booking is not payable.' }, { status: 409 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const totalMajorUnits = booking.total_cents / 100;
    const [firstName, ...rest] = booking.guest_name.split(' ');

    const checkout = await createMayaCheckout({
      requestReferenceNumber: booking.booking_reference,
      totalAmount: totalMajorUnits,
      items: [
        {
          name: `Booking ${booking.booking_reference}`,
          quantity: 1,
          amount: { value: totalMajorUnits },
          totalAmount: { value: totalMajorUnits },
        },
      ],
      buyer: {
        firstName: firstName || booking.guest_name,
        lastName: rest.join(' ') || '-',
        contact: { email: booking.guest_email, phone: booking.guest_phone ?? undefined },
      },
      redirectUrl: {
        success: `${appUrl}/book/confirmation/${booking.id}?status=success`,
        failure: `${appUrl}/book/confirmation/${booking.id}?status=failure`,
        cancel: `${appUrl}/book/confirmation/${booking.id}?status=cancel`,
      },
    });

    await supabase.from('payments').insert({
      booking_id: booking.id,
      provider: 'maya',
      provider_checkout_id: checkout.checkoutId,
      status: 'pending',
      amount_cents: booking.total_cents,
      currency: booking.currency,
      raw_response: checkout as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ redirectUrl: checkout.redirectUrl, checkoutId: checkout.checkoutId });
  } catch (err) {
    console.error('[POST /api/payments/create-checkout]', err);
    const message = err instanceof Error ? err.message : 'Failed to create checkout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
