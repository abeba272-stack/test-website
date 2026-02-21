const STRIPE_API_BASE = 'https://api.stripe.com/v1';

const {
  setCors,
  sendJson,
  supabaseRequest,
  getAuthUser,
  getUserRole,
  isStaffRole,
  getBookingById
} = require('./_lib');

async function patchBookingPayment(bookingId, patch) {
  if (!bookingId) return null;
  const data = await supabaseRequest(`/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    body: patch
  });
  return Array.isArray(data) ? data[0] || null : null;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

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
    const authUser = await getAuthUser(req);
    if (!authUser?.id) {
      return sendJson(res, 401, { message: 'Nicht eingeloggt.' });
    }

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
      const booking = await getBookingById(bookingId);
      if (!booking) {
        return sendJson(res, 404, { message: 'Buchung nicht gefunden.' });
      }
      const role = await getUserRole(authUser.id);
      const canAccess = booking.user_id === authUser.id || isStaffRole(role);
      if (!canAccess) {
        return sendJson(res, 403, { message: 'Keine Berechtigung für diese Buchung.' });
      }

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
