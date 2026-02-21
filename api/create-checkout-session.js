const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function toStripeAmount(amount) {
  return Math.max(0, Math.round(Number(amount || 0) * 100));
}

function bodyFromReq(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return null;
    }
  }
  return req.body || null;
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

async function getBookingById(bookingId) {
  const data = await supabaseRequest(`/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}&select=*`);
  return Array.isArray(data) ? data[0] || null : null;
}

async function patchBookingPayment(bookingId, patch) {
  const data = await supabaseRequest(`/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    body: patch
  });
  return Array.isArray(data) ? data[0] || null : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return sendJson(res, 503, { message: 'Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt).' });
  }

  const body = bodyFromReq(req);
  const bookingId = String(body?.bookingId || '').trim();
  if (!bookingId) {
    return sendJson(res, 400, { message: 'bookingId fehlt.' });
  }

  try {
    const booking = await getBookingById(bookingId);
    if (!booking) {
      return sendJson(res, 404, { message: 'Buchung nicht gefunden.' });
    }

    if (booking.payment_status === 'paid' || booking.deposit_paid === true) {
      return sendJson(res, 409, { message: 'Anzahlung wurde bereits bezahlt.' });
    }

    const amountCents = toStripeAmount(booking.deposit);
    if (!amountCents) {
      return sendJson(res, 400, { message: 'Ungültige Anzahlung.' });
    }

    const origin = (req.headers.origin || '').replace(/\/$/, '');
    const fallbackOrigin = origin || `https://${req.headers.host || ''}`.replace(/\/$/, '');
    const successUrl = body?.successUrl || `${fallbackOrigin}/booking.html?payment=success&session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`;
    const cancelUrl = body?.cancelUrl || `${fallbackOrigin}/booking.html?payment=cancel&booking_id=${booking.id}`;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('payment_method_types[0]', 'card');
    params.append('client_reference_id', booking.id);
    params.append('line_items[0][price_data][currency]', 'eur');
    params.append('line_items[0][price_data][unit_amount]', String(amountCents));
    params.append('line_items[0][price_data][product_data][name]', `Anzahlung: ${booking.service_name || 'Termin'}`);
    params.append('line_items[0][quantity]', '1');

    const customer = booking.customer || {};
    if (customer.email) {
      params.append('customer_email', String(customer.email));
    }

    const metadata = {
      booking_id: booking.id || '',
      user_id: booking.user_id || '',
      service_name: booking.service_name || '',
      date_iso: booking.date_iso || '',
      time: booking.time || '',
      first_name: customer.firstName || '',
      last_name: customer.lastName || '',
      phone: customer.phone || ''
    };
    Object.entries(metadata).forEach(([key, value]) => {
      params.append(`metadata[${key}]`, String(value));
    });

    const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    const json = await response.json();
    if (!response.ok) {
      return sendJson(res, response.status, { message: json?.error?.message || 'Stripe Fehler' });
    }

    await patchBookingPayment(booking.id, {
      payment_provider: 'stripe',
      payment_reference: json.id,
      stripe_checkout_session_id: json.id
    });

    return sendJson(res, 200, {
      id: json.id,
      url: json.url,
      bookingId: booking.id
    });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Fehler beim Erstellen der Checkout Session.' });
  }
};
