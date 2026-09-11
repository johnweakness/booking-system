import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatCentsToCurrency } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function getSalesReport() {
  const supabase = createAdminClient();
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, total_cents, created_at, booking_items(item_type, ticket_type_id, quantity, line_total_cents)')
    .eq('payment_status', 'paid')
    .gte('created_at', from);

  const { data: ticketTypes } = await supabase.from('ticket_types').select('id, name');
  const ticketTypeNames = new Map((ticketTypes ?? []).map((t) => [t.id, t.name]));

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

  return {
    dailyRevenue: [...dailyRevenue.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)),
    ticketsByType: [...ticketsByType.entries()].map(([id, stats]) => ({
      name: ticketTypeNames.get(id) ?? 'Unknown',
      ...stats,
    })),
    totalRevenueCents: (bookings ?? []).reduce((sum, b) => sum + b.total_cents, 0),
    totalBookings: (bookings ?? []).length,
  };
}

export default async function AdminReportsPage() {
  await requireAdmin();
  const report = await getSalesReport();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Sales report (last 30 days)</h1>

      <div className="flex gap-6">
        <div className="rounded border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total revenue</p>
          <p className="text-2xl font-bold">{formatCentsToCurrency(report.totalRevenueCents)}</p>
        </div>
        <div className="rounded border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Paid bookings</p>
          <p className="text-2xl font-bold">{report.totalBookings}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Daily revenue</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Date</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {report.dailyRevenue.map(([date, cents]) => (
              <tr key={date} className="border-b border-gray-100">
                <td className="py-2">{date}</td>
                <td>{formatCentsToCurrency(cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Tickets sold by type</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Ticket type</th>
              <th>Quantity</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {report.ticketsByType.map((t) => (
              <tr key={t.name} className="border-b border-gray-100">
                <td className="py-2">{t.name}</td>
                <td>{t.quantity}</td>
                <td>{formatCentsToCurrency(t.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
