import { createAdminClient } from '@/lib/supabase/admin';
import { getPOSAdapter } from '@/lib/pos';
import type { POSBookingPayload, POSSaleRecord } from '@/lib/pos';

// Thin wrapper around the POSAdapter that also writes to `pos_sync_log` so
// every push/pull to the POS is auditable from the admin dashboard.

export async function syncBookingToPOS(bookingId: string, payload: POSBookingPayload) {
  const supabase = createAdminClient();
  const adapter = getPOSAdapter();

  let success = false;
  let response: unknown = null;
  let errorMessage: string | null = null;

  try {
    const result = await adapter.syncBooking(payload);
    success = result.success;
    response = result;
    if (!result.success) errorMessage = result.message ?? 'Unknown POS error';
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown POS error';
  }

  await supabase.from('pos_sync_log').insert({
    booking_id: bookingId,
    direction: 'push',
    operation: 'syncBooking',
    request_payload: payload as unknown as Record<string, unknown>,
    response_payload: response as Record<string, unknown> | null,
    success,
    error_message: errorMessage,
  });

  return { success, errorMessage };
}

export async function pushSaleRecordToPOS(bookingId: string, sale: POSSaleRecord) {
  const supabase = createAdminClient();
  const adapter = getPOSAdapter();

  let success = false;
  let response: unknown = null;
  let errorMessage: string | null = null;

  try {
    const result = await adapter.pushSaleRecord(sale);
    success = result.success;
    response = result;
    if (!result.success) errorMessage = result.message ?? 'Unknown POS error';
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown POS error';
  }

  await supabase.from('pos_sync_log').insert({
    booking_id: bookingId,
    direction: 'push',
    operation: 'pushSaleRecord',
    request_payload: sale as unknown as Record<string, unknown>,
    response_payload: response as Record<string, unknown> | null,
    success,
    error_message: errorMessage,
  });

  return { success, errorMessage };
}
