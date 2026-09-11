import type { POSAdapter } from './types';
import { MockPOSAdapter } from './mockAdapter';

// Factory that returns the active POS adapter implementation.
//
// TODO(client): once the real POS vendor is confirmed, implement a new class
// (e.g. `class AcmePOSAdapter implements POSAdapter { ... }` in
// `src/lib/pos/adapters/acme.ts`) and switch the branch below based on
// `POS_PROVIDER`. No other application code should need to change.
let cachedAdapter: POSAdapter | null = null;

export function getPOSAdapter(): POSAdapter {
  if (cachedAdapter) return cachedAdapter;

  const provider = process.env.POS_PROVIDER ?? 'mock';

  switch (provider) {
    case 'mock':
    default:
      cachedAdapter = new MockPOSAdapter();
      break;
    // case 'acme':
    //   cachedAdapter = new AcmePOSAdapter();
    //   break;
  }

  return cachedAdapter;
}

export type {
  POSAdapter,
  POSBookingPayload,
  POSInventory,
  POSSaleRecord,
  POSSyncResult,
} from './types';
