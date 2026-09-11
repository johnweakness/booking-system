import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { CapacitySlotsManager } from '@/components/admin/CapacitySlotsManager';

export const dynamic = 'force-dynamic';

export default async function AdminCapacitySlotsPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: ticketTypes } = await supabase.from('ticket_types').select('id, name').order('sort_order');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Capacity &amp; Pricing</h1>
      <CapacitySlotsManager ticketTypes={ticketTypes ?? []} />
    </div>
  );
}
