import crypto from 'node:crypto';

// Maya (formerly PayMaya) Payment Gateway client.
//
// Docs: https://developers.maya.ph/ (Checkout API — redirect-based payment).
// This wraps the Checkout API, which is the simplest integration path for a
// prototype: we create a "checkout" session server-side, redirect the guest
// to Maya's hosted payment page, and receive success/failure/cancel
// redirects plus an asynchronous webhook for the authoritative status.
//
// TODO(client): confirm whether Checkout API (redirect) or Payments API
// (card tokenization, embedded UI) is preferred for production. Checkout API
// is used here because it requires no PCI-scope on our servers.

const MAYA_ENV = process.env.MAYA_ENV === 'production' ? 'production' : 'sandbox';

const MAYA_BASE_URL =
  MAYA_ENV === 'production'
    ? 'https://pg.maya.ph/checkout/v1'
    : 'https://pg-sandbox.paymaya.com/checkout/v1';

export interface MayaCheckoutItem {
  name: string;
  quantity: number;
  code?: string;
  description?: string;
  amount: {
    value: number; // e.g. 150.00 (major currency unit, NOT centavos)
  };
  totalAmount: {
    value: number;
    details?: { subtotal?: number };
  };
}

export interface CreateCheckoutParams {
  requestReferenceNumber: string; // our booking_reference / booking id
  totalAmount: number; // major currency unit (e.g. pesos)
  items: MayaCheckoutItem[];
  buyer: {
    firstName: string;
    lastName: string;
    contact?: { email?: string; phone?: string };
  };
  redirectUrl: {
    success: string;
    failure: string;
    cancel: string;
  };
}

export interface MayaCheckoutResponse {
  checkoutId: string;
  redirectUrl: string;
}

function getAuthHeader() {
  const secretKey = process.env.MAYA_SECRET_KEY;
  if (!secretKey) {
    throw new Error('MAYA_SECRET_KEY is not set. Add sandbox keys to .env.local (see .env.example).');
  }
  // Maya's Checkout API uses HTTP Basic auth with the secret key as username, blank password.
  const encoded = Buffer.from(`${secretKey}:`).toString('base64');
  return `Basic ${encoded}`;
}

/** Creates a Maya Checkout session and returns the URL to redirect the guest to. */
export async function createMayaCheckout(
  params: CreateCheckoutParams
): Promise<MayaCheckoutResponse> {
  const res = await fetch(`${MAYA_BASE_URL}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({
      totalAmount: { value: params.totalAmount, currency: 'PHP' },
      buyer: params.buyer,
      items: params.items,
      redirectUrl: params.redirectUrl,
      requestReferenceNumber: params.requestReferenceNumber,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Maya checkout creation failed (${res.status}): ${errorBody}`);
  }

  return res.json();
}

/**
 * Verifies the authenticity of a Maya webhook payload.
 *
 * TODO(client): Maya's exact webhook signing scheme (header name + HMAC
 * algorithm) should be confirmed against the merchant dashboard docs for
 * your account type; this checks the commonly documented
 * `Maya-Signature` HMAC-SHA256 header against the raw request body. Wire
 * `MAYA_WEBHOOK_SECRET` once Maya provides it for your merchant account.
 */
export function verifyMayaWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const webhookSecret = process.env.MAYA_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn(
      '[maya] MAYA_WEBHOOK_SECRET not set — skipping signature verification (sandbox only!). ' +
        'Do NOT deploy to production without this set.'
    );
    return true;
  }

  if (!signatureHeader) return false;

  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // length mismatch etc.
  }
}

export const mayaEnv = MAYA_ENV;
