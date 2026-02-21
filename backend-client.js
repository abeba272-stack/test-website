function getErrorMessage(error) {
  return error?.message || 'Unbekannter Fehler';
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text };
  }
}

async function requestJson(path, { method = 'GET', body = null } = {}) {
  const init = { method, headers: {} };
  if (body !== null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(path, init);
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const detail = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return data || {};
}

export async function createCheckoutSession(input) {
  try {
    const data = await requestJson('/api/create-checkout-session', {
      method: 'POST',
      body: input
    });
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function verifyCheckoutSession(sessionId) {
  try {
    const data = await requestJson(`/api/verify-checkout-session?session_id=${encodeURIComponent(sessionId)}`);
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

export async function sendBookingNotification(payload) {
  try {
    const data = await requestJson('/api/send-booking-notification', {
      method: 'POST',
      body: payload
    });
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}

