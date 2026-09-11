import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTicketQRDataUrl } from '@/lib/tickets/qr';
import { formatCentsToCurrency } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function getBookingWithTickets(id: string) {
  const supabase = createAdminClient();
  const { data: booking } = await supabase.from('bookings').select('*, booking_items(*)').eq('id', id).single();
  if (!booking) return null;

  const ticketItems = (booking.booking_items ?? []).filter((i: { item_type: string }) => i.item_type === 'ticket');
  const tickets = await Promise.all(
    ticketItems.map(async (item: { id: string; ticket_uuid: string | null; ticket_status: string }) => ({
      id: item.id,
      ticketUuid: item.ticket_uuid!,
      status: item.ticket_status,
      qrDataUrl: await generateTicketQRDataUrl(item.ticket_uuid!),
    }))
  );

  return { booking, tickets };
}

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const result = await getBookingWithTickets(bookingId);
  if (!result) notFound();
  const { booking, tickets } = result;

  const isPaid = booking.payment_status === 'paid';

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="rounded-2xl bg-gradient-to-br from-ocean to-aqua p-6 text-white shadow-sm">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
          {isPaid ? '🎉 Booking confirmed!' : 'Booking status: ' + booking.payment_status}
        </h1>
        <p className="mt-1 text-white/90">
          Reference <span className="font-mono">{booking.booking_reference}</span> ·{' '}
          {formatCentsToCurrency(booking.total_cents)}
        </p>
      </div>

      {!isPaid && (
        <p className="rounded-xl bg-sun/20 p-3 text-sm text-navy">
          Payment is still {booking.payment_status}. If you just paid, this page will update once Maya&apos;s webhook
          is processed — refresh in a few seconds.
        </p>
      )}

      {isPaid && (
        <section className="flex flex-col gap-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-navy">Your e-tickets</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tickets.map((ticket: { id: string; ticketUuid: string; status: string; qrDataUrl: string }) => (
              <div
                key={ticket.id}
                className="flex flex-col items-center gap-2 rounded-2xl border-l-4 border-l-aqua bg-white p-4 shadow-sm"
              >
                <Image src={ticket.qrDataUrl} alt="Ticket QR code" width={200} height={200} unoptimized />
                <p className="font-mono text-xs text-navy/50">{ticket.ticketUuid}</p>
                <p className="rounded-full bg-ocean/10 px-3 py-0.5 text-xs font-medium uppercase text-ocean-dark">
                  {ticket.status}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-navy/50">
            Present this QR code at the gate for scanning. Each code can only be used once.
          </p>
        </section>
      )}

      <Link
        href="/"
        className="mt-4 self-start rounded-full border-2 border-ocean/30 px-6 py-2 font-semibold text-ocean-dark transition hover:border-ocean"
      >
        Back to home
      </Link>
    </main>
  );
}
