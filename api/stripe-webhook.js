const crypto = require('crypto');

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, key, configured: Boolean(url && key) };
}

async function supabaseRequest(path, { method = 'GET', body = null } = {}) {
  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    throw new Error('Supabase Admin ist nicht konfiguriert (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen).');
  }

  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body === null ? undefined : JSON.stringify(body)
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message || json?.hint || `Supabase Fehler (${response.status})`);
  }
  return json;
}

async function patchBookingPayment(bookingId, patch) {
  if (!bookingId) return null;
  const data = await supabaseRequest(`/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    body: patch
  });
  return Array.isArray(data) ? data[0] || null : null;
}

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseStripeSignature(headerValue) {
  const parts = String(headerValue || '')
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const entries = {};
  parts.forEach((part) => {
    const [key, value] = part.split('=');
    if (!key || !value) return;
    if (!entries[key]) entries[key] = [];
    entries[key].push(value);
  });
  return entries;
}

function secureEqualHex(left, right) {
  const a = Buffer.from(String(left || ''), 'hex');
  const b = Buffer.from(String(right || ''), 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyStripeSignature(payload, signatureHeader, webhookSecret) {
  const parsed = parseStripeSignature(signatureHeader);
  const timestamp = parsed.t?.[0];
  const signatures = parsed.v1 || [];
  if (!timestamp || !signatures.length) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return signatures.some((candidate) => secureEqualHex(candidate, expected));
}

function paymentPatchFromSession(session, paid) {
  const paymentIntentId = session.payment_intent?.id || session.payment_intent || null;
  const receiptUrl = session.payment_intent?.latest_charge?.receipt_url || null;
  return {
    payment_status: paid ? 'paid' : 'failed',
    payment_provider: 'stripe',
    deposit_paid: paid,
    paid_at: paid ? new Date().toISOString() : null,
    stripe_checkout_session_id: session.id || null,
    stripe_payment_intent_id: paymentIntentId,
    payment_reference: paymentIntentId || session.id || null,
    payment_receipt_url: receiptUrl
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return sendJson(res, 503, { message: 'Stripe Webhook ist nicht konfiguriert (STRIPE_WEBHOOK_SECRET fehlt).' });
  }

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    return sendJson(res, 400, { message: `Webhook Body konnte nicht gelesen werden: ${error.message}` });
  }

  const signatureHeader = req.headers['stripe-signature'];
  const validSignature = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!validSignature) {
    return sendJson(res, 400, { message: 'Ungültige Stripe-Signatur.' });
  }

  let event = null;
  try {
    event = JSON.parse(rawBody);
  } catch (_error) {
    return sendJson(res, 400, { message: 'Webhook Body ist kein gültiges JSON.' });
  }

  const session = event?.data?.object || {};
  const bookingId = session?.metadata?.booking_id || session?.client_reference_id || null;
  const eventType = event?.type || '';

  try {
    if (bookingId && (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded')) {
      await patchBookingPayment(bookingId, paymentPatchFromSession(session, true));
    } else if (bookingId && (eventType === 'checkout.session.expired' || eventType === 'checkout.session.async_payment_failed')) {
      await patchBookingPayment(bookingId, paymentPatchFromSession(session, false));
    }

    return sendJson(res, 200, {
      received: true,
      event: eventType,
      bookingId
    });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Webhook Verarbeitung fehlgeschlagen.' });
  }
};
