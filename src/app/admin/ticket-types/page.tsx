import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { TicketTypesManager } from '@/components/admin/TicketTypesManager';

export const dynamic = 'force-dynamic';

export default async function AdminTicketTypesPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Ticket Types</h1>
      <TicketTypesManager />
    </div>
  );
}
