import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BookingError, createPendingBooking } from '@/lib/bookings/bookingService';
import type { BookingStatus, PaymentStatus } from '@/types/database';

// POST /api/bookings — guest checkout step: validates items, reserves capacity
// (race-safe), and creates a `pending` booking. The guest is then redirected
// to /api/payments/create-checkout with the returned booking id.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const booking = await createPendingBooking({
      guestName: body.guestName,
      guestEmail: body.guestEmail,
      guestPhone: body.guestPhone,
      items: body.items,
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[POST /api/bookings]', err);
    return NextResponse.json({ error: 'Failed to create booking.' }, { status: 500 });
  }
}

// GET /api/bookings — admin bookings list with filters (date, status, payment status).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const paymentStatus = searchParams.get('paymentStatus');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // NOTE: this uses the admin client for simplicity in the prototype; in
  // production, gate this route behind Supabase Auth session checks (see
  // src/lib/supabase/server.ts) so only authenticated admin_users can call it.
  const supabase = createAdminClient();
  let query = supabase.from('bookings').select('*, booking_items(*)').order('created_at', { ascending: false });

  if (status) query = query.eq('status', status as BookingStatus);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus as PaymentStatus);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data });
}
