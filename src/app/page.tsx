import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import type { TicketType } from '@/types/database';
import { formatCentsToCurrency } from '@/lib/format';
import { WaveDivider } from '@/components/brand/WaveDivider';
import { TicketCategoryIcon, ticketAccentClass } from '@/components/brand/TicketCategoryIcon';

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
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden bg-gradient-to-br from-ocean to-aqua pb-20 pt-16 text-white sm:pb-28 sm:pt-24">
        <div
          className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl sm:h-96 sm:w-96"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 text-center">
          <span className="rounded-full bg-white/15 px-4 py-1 text-sm font-medium tracking-wide">
            🌊 Open daily · Book online in minutes
          </span>
          <h1 className="max-w-2xl font-[family-name:var(--font-display)] text-4xl font-bold leading-tight sm:text-6xl">
            Splash Cove Water Park
          </h1>
          <p className="max-w-xl text-lg text-white/90 sm:text-xl">
            Choose your ticket, pick a date, and get an instant e-ticket with QR code — sun, slides, and
            splashes await.
          </p>
          <a
            href="#tickets"
            className="mt-2 rounded-full bg-coral px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-coral-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Book your day
          </a>
        </div>
        <WaveDivider />
      </section>

      <section id="tickets" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
        <div className="text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-navy">
            Pick your ticket
          </h2>
          <p className="mt-2 text-navy/70">Every ticket includes full access to slides, pools, and the wave pool.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {ticketTypes.length === 0 && (
            <p className="col-span-full text-center text-navy/60">
              No ticket types available yet. Configure them in the admin dashboard.
            </p>
          )}

          {ticketTypes.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/book/${ticket.id}`}
              className={`group flex flex-col justify-between rounded-2xl border-l-4 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${ticketAccentClass(
                ticket.category
              )}`}
            >
              <div className="flex items-start gap-4">
                <TicketCategoryIcon category={ticket.category} />
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-navy">
                    {ticket.name}
                  </h3>
                  <p className="mt-1 text-sm text-navy/70">{ticket.description}</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="text-2xl font-bold text-ocean-dark">
                  {formatCentsToCurrency(ticket.base_price_cents)}
                </span>
                <span className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-coral-dark">
                  Select
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-ocean/10 bg-white/60 py-6 text-center text-xs text-navy/50">
        <Link href="/admin" className="underline decoration-ocean/40 underline-offset-2 hover:text-ocean-dark">
          Staff / Admin login
        </Link>
      </footer>
    </main>
  );
}
