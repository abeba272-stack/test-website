function setCors(res) {
  const allowOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Stripe-Signature');
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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

function getBearerToken(req) {
  const auth = String(req.headers?.authorization || '');
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

async function getAuthUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function getUserRole(userId) {
  if (!userId) return 'customer';
  const data = await supabaseRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`);
  return Array.isArray(data) && data[0]?.role ? data[0].role : 'customer';
}

function isStaffRole(role) {
  return role === 'staff' || role === 'admin';
}

async function getBookingById(bookingId) {
  if (!bookingId) return null;
  const data = await supabaseRequest(`/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}&select=*`);
  return Array.isArray(data) ? data[0] || null : null;
}

function mapBookingRowToClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    serviceName: row.service_name,
    dateISO: row.date_iso,
    time: row.time,
    deposit: Number(row.deposit || 0),
    depositPaid: Boolean(row.deposit_paid),
    paymentStatus: row.payment_status || (row.deposit_paid ? 'paid' : 'unpaid'),
    customer: row.customer || {}
  };
}

module.exports = {
  setCors,
  sendJson,
  bodyFromReq,
  getSupabaseEnv,
  supabaseRequest,
  getAuthUser,
  getUserRole,
  isStaffRole,
  getBookingById,
  mapBookingRowToClient
};
