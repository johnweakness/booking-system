import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import type { TicketType } from '@/types/database';
import { formatCentsToCurrency } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function getTicketTypes(): Promise<TicketType[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[Home] failed to load ticket types', error.message);
    return [];
  }
  return data ?? [];
}

export default async function Home() {
  const ticketTypes = await getTicketTypes();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Splash Cove Water Park</h1>
        <p className="mt-3 text-lg text-gray-600">
          Choose your ticket, pick a date, and get an instant e-ticket with QR code.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {ticketTypes.length === 0 && (
          <p className="col-span-full text-center text-gray-500">
            No ticket types available yet. Configure them in the admin dashboard.
          </p>
        )}

        {ticketTypes.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/book/${ticket.id}`}
            className="flex flex-col justify-between rounded-xl border border-gray-200 p-6 shadow-sm transition hover:shadow-md"
          >
            <div>
              <h2 className="text-xl font-semibold">{ticket.name}</h2>
              <p className="mt-2 text-sm text-gray-600">{ticket.description}</p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCentsToCurrency(ticket.base_price_cents)}</span>
              <span className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
                Select
              </span>
            </div>
          </Link>
        ))}
      </section>

      <footer className="mt-auto text-center text-xs text-gray-400">
        <Link href="/admin" className="underline">
          Staff / Admin login
        </Link>
      </footer>
    </main>
  );
}
