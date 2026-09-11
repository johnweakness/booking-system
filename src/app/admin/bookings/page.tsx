import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatCentsToCurrency } from '@/lib/format';
import type { BookingStatus, PaymentStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

async function getBookings(searchParams: Record<string, string | undefined>) {
  const supabase = createAdminClient();
  let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });

  if (searchParams.status) query = query.eq('status', searchParams.status as BookingStatus);
  if (searchParams.paymentStatus) query = query.eq('payment_status', searchParams.paymentStatus as PaymentStatus);
  if (searchParams.from) query = query.gte('created_at', searchParams.from);
  if (searchParams.to) query = query.lte('created_at', searchParams.to);

  const { data } = await query.limit(200);
  return data ?? [];
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const bookings = await getBookings(sp);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Bookings</h1>

      <form className="flex flex-wrap gap-2 text-sm" action="/admin/bookings">
        <select name="status" defaultValue={sp.status ?? ''} className="rounded border border-gray-300 px-2 py-1">
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
          <option value="refunded">Refunded</option>
        </select>
        <select
          name="paymentStatus"
          defaultValue={sp.paymentStatus ?? ''}
          className="rounded border border-gray-300 px-2 py-1"
        >
          <option value="">Any payment status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input type="date" name="from" defaultValue={sp.from ?? ''} className="rounded border border-gray-300 px-2 py-1" />
        <input type="date" name="to" defaultValue={sp.to ?? ''} className="rounded border border-gray-300 px-2 py-1" />
        <button type="submit" className="rounded bg-black px-4 py-1 text-white">
          Filter
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2">Reference</th>
            <th>Guest</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Total</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id} className="border-b border-gray-100">
              <td className="py-2 font-mono">{b.booking_reference}</td>
              <td>
                {b.guest_name} <br />
                <span className="text-gray-400">{b.guest_email}</span>
              </td>
              <td>{b.status}</td>
              <td>{b.payment_status}</td>
              <td>{formatCentsToCurrency(b.total_cents)}</td>
              <td>{new Date(b.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {bookings.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-gray-500">
                No bookings found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
