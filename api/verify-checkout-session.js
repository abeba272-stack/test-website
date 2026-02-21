const STRIPE_API_BASE = 'https://api.stripe.com/v1';

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
  if (!configured) return null;

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
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function patchBookingPayment(bookingId, patch) {
  if (!bookingId) return null;
  const data = await supabaseRequest(`/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    body: patch
  });
  return Array.isArray(data) ? data[0] || null : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return sendJson(res, 503, { message: 'Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt).' });
  }

  const sessionId = req.query?.session_id;
  if (!sessionId) {
    return sendJson(res, 400, { message: 'session_id fehlt.' });
  }

  try {
    const response = await fetch(
      `${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent.latest_charge`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecret}`
        }
      }
    );
    const json = await response.json();
    if (!response.ok) {
      return sendJson(res, response.status, { message: json?.error?.message || 'Stripe Fehler' });
    }

    const bookingId = json.metadata?.booking_id || json.client_reference_id || null;
    const paid = json.payment_status === 'paid';
    const receiptUrl = json.payment_intent?.latest_charge?.receipt_url || null;
    const paymentIntentId = json.payment_intent?.id || json.payment_intent || null;

    if (bookingId) {
      await patchBookingPayment(bookingId, {
        payment_status: paid ? 'paid' : 'unpaid',
        payment_provider: 'stripe',
        deposit_paid: paid,
        paid_at: paid ? new Date().toISOString() : null,
        stripe_checkout_session_id: json.id,
        stripe_payment_intent_id: paymentIntentId,
        payment_reference: paymentIntentId || json.id,
        payment_receipt_url: receiptUrl
      });
    }

    return sendJson(res, 200, {
      id: json.id,
      paid,
      payment_status: json.payment_status,
      amount_total: json.amount_total || 0,
      currency: json.currency || 'eur',
      metadata: json.metadata || {},
      booking_id: bookingId,
      payment_intent_id: paymentIntentId,
      payment_receipt_url: receiptUrl
    });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Fehler beim Verifizieren der Zahlung.' });
  }
};
