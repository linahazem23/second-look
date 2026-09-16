import crypto from 'node:crypto';

const PAYMOB_BASE = 'https://accept.paymob.com/api';

const API_KEY = process.env.PAYMOB_API_KEY!;
const INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID!;
const IFRAME_ID = process.env.PAYMOB_IFRAME_ID!;
const HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET!;

async function paymobFetch(path: string, body: unknown) {
  const res = await fetch(`${PAYMOB_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Paymob ${path} failed: ${JSON.stringify(data)}`);
  return data;
}

async function authenticate(): Promise<string> {
  const data = await paymobFetch('/auth/tokens', { api_key: API_KEY });
  return data.token as string;
}

interface RegisterOrderResult {
  paymobOrderId: string;
}

async function registerOrder(authToken: string, amountCents: number, merchantOrderId: string): Promise<RegisterOrderResult> {
  const data = await paymobFetch('/ecommerce/orders', {
    auth_token: authToken,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: 'EGP',
    merchant_order_id: merchantOrderId,
    items: []
  });
  return { paymobOrderId: String(data.id) };
}

interface BillingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

async function getPaymentKey(authToken: string, paymobOrderId: string, amountCents: number, billing: BillingData): Promise<string> {
  const data = await paymobFetch('/acceptance/payment_keys', {
    auth_token: authToken,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: paymobOrderId,
    billing_data: {
      first_name: billing.firstName,
      last_name: billing.lastName || 'N/A',
      email: billing.email,
      phone_number: billing.phone || 'NA',
      apartment: 'NA',
      floor: 'NA',
      street: 'NA',
      building: 'NA',
      city: 'NA',
      country: 'EG',
      state: 'NA'
    },
    currency: 'EGP',
    integration_id: Number(INTEGRATION_ID)
  });
  return data.token as string;
}

/**
 * Runs the full auth -> register order -> payment key sequence and returns the
 * hosted checkout URL to send the buyer to. amountEgp is whole EGP (converted
 * to piastres/cents here, which is the unit Paymob's API actually takes).
 */
export async function createPaymobCheckout(params: { amountEgp: number; merchantOrderId: string; billing: BillingData }) {
  const amountCents = Math.round(params.amountEgp * 100);
  const authToken = await authenticate();
  const { paymobOrderId } = await registerOrder(authToken, amountCents, params.merchantOrderId);
  const paymentToken = await getPaymentKey(authToken, paymobOrderId, amountCents, params.billing);
  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${paymentToken}`;
  return { paymobOrderId, iframeUrl };
}

/**
 * Refunds a previously-captured transaction — full or partial — used when an
 * admin resolves a dispute in the buyer's favor. amountEgp is whole EGP.
 */
export async function refundPaymobTransaction(params: { transactionId: string; amountEgp: number }): Promise<void> {
  const authToken = await authenticate();
  await paymobFetch('/acceptance/void_refund/refund', {
    auth_token: authToken,
    transaction_id: params.transactionId,
    amount_cents: Math.round(params.amountEgp * 100)
  });
}

/**
 * Verifies a transaction-processed webhook callback per Paymob's documented HMAC
 * scheme: a fixed, ordered concatenation of specific fields from the "obj",
 * hashed with SHA512 using the merchant's HMAC secret, hex-encoded.
 */
export function verifyWebhookHmac(obj: Record<string, any>, providedHmac: string): boolean {
  const orderedFields = [
    'amount_cents',
    'created_at',
    'currency',
    'error_occured',
    'has_parent_transaction',
    'id',
    'integration_id',
    'is_3d_secure',
    'is_auth',
    'is_capture',
    'is_refunded',
    'is_standalone_payment',
    'is_voided',
    'order.id',
    'owner',
    'pending',
    'source_data.pan',
    'source_data.sub_type',
    'source_data.type',
    'success'
  ];

  const getField = (path: string) => {
    const parts = path.split('.');
    let value: any = obj;
    for (const part of parts) value = value?.[part];
    return value === undefined || value === null ? '' : String(value);
  };

  const concatenated = orderedFields.map(getField).join('');
  const computed = crypto.createHmac('sha512', HMAC_SECRET).update(concatenated).digest('hex');
  return computed === providedHmac;
}
