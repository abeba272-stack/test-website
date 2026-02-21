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

function pickTemplate(eventType, booking, customer) {
  const firstName = customer?.firstName || 'Kundin/Kunde';
  const date = booking?.dateISO || '';
  const time = booking?.time || '';
  const service = booking?.serviceName || 'Termin';
  if (eventType === 'booking_confirmed') {
    return `Hallo ${firstName}, dein Termin am ${date} um ${time} für ${service} ist bestätigt.`;
  }
  if (eventType === 'booking_canceled') {
    return `Hallo ${firstName}, dein Termin am ${date} um ${time} wurde storniert. Bitte melde dich für einen neuen Termin.`;
  }
  return `Hallo ${firstName}, wir haben deine Anfrage am ${date} um ${time} für ${service} erhalten.`;
}

async function sendResendEmail({ to, subject, message }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !to) return { sent: false, skipped: true };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: message
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.message || 'Resend Fehler');
  return { sent: true, id: json?.id || null };
}

async function sendTwilioSms({ to, message }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from || !to) return { sent: false, skipped: true };

  const basic = Buffer.from(`${sid}:${token}`).toString('base64');
  const form = new URLSearchParams();
  form.append('To', to);
  form.append('From', from);
  form.append('Body', message);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.message || 'Twilio Fehler');
  return { sent: true, sid: json?.sid || null };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const body = bodyFromReq(req);
  if (!body?.eventType || !body?.booking) {
    return sendJson(res, 400, { message: 'eventType und booking sind erforderlich.' });
  }

  const customer = body.customer || body.booking.customer || {};
  const message = pickTemplate(body.eventType, body.booking, customer);
  const subject = body.eventType === 'booking_confirmed'
    ? 'Termin bestätigt – Parrylicious'
    : body.eventType === 'booking_canceled'
      ? 'Termin storniert – Parrylicious'
      : 'Termin-Anfrage erhalten – Parrylicious';

  try {
    const [email, sms] = await Promise.all([
      sendResendEmail({ to: customer.email, subject, message }),
      sendTwilioSms({ to: customer.phone, message })
    ]);

    return sendJson(res, 200, {
      ok: true,
      email,
      sms
    });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Benachrichtigung fehlgeschlagen.' });
  }
};

