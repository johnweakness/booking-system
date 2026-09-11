import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import type { TicketType } from '@/types/database';
import { BookingFlow } from '@/components/booking/BookingFlow';

export const dynamic = 'force-dynamic';

async function getTicketType(id: string): Promise<TicketType | null> {
  const supabase = createPublicClient();
  const { data } = await supabase.from('ticket_types').select('*').eq('id', id).eq('is_active', true).single();
  return data;
}

export default async function BookTicketTypePage({
  params,
}: {
  params: Promise<{ ticketTypeId: string }>;
}) {
  const { ticketTypeId } = await params;
  const ticketType = await getTicketType(ticketTypeId);
  if (!ticketType) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <BookingFlow ticketType={ticketType} />
    </main>
  );
}
