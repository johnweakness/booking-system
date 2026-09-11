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
      <h1 className="text-2xl font-bold">
        {isPaid ? 'Booking confirmed!' : 'Booking status: ' + booking.payment_status}
      </h1>
      <p className="text-gray-600">
        Reference <span className="font-mono">{booking.booking_reference}</span> · {formatCentsToCurrency(booking.total_cents)}
      </p>

      {!isPaid && (
        <p className="rounded bg-yellow-50 p-3 text-sm text-yellow-800">
          Payment is still {booking.payment_status}. If you just paid, this page will update once Maya&apos;s webhook
          is processed — refresh in a few seconds.
        </p>
      )}

      {isPaid && (
        <section className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold">Your e-tickets</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tickets.map((ticket: { id: string; ticketUuid: string; status: string; qrDataUrl: string }) => (
              <div key={ticket.id} className="flex flex-col items-center gap-2 rounded border border-gray-200 p-4">
                <Image src={ticket.qrDataUrl} alt="Ticket QR code" width={200} height={200} unoptimized />
                <p className="font-mono text-xs text-gray-500">{ticket.ticketUuid}</p>
                <p className="text-xs uppercase text-gray-400">{ticket.status}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Present this QR code at the gate for scanning. Each code can only be used once.
          </p>
        </section>
      )}

      <Link href="/" className="mt-4 underline">
        Back to home
      </Link>
    </main>
  );
}
