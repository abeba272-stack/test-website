import { fmtDate, currency, formatMinutes } from './common.js';
import { isSupabaseConfigured } from './supabase.js';
import {
  getCurrentUser,
  getCurrentUserRole,
  getMyBookings,
  getMyWaitlist,
  updateBookingStatus,
  cancelMyBooking,
  removeMyWaitlistEntry,
  clearMyBookings,
  clearMyWaitlist
} from './supabase-data.js';
import { createCheckoutSession, sendBookingNotification } from './backend-client.js';

document.getElementById('year').textContent = new Date().getFullYear();
document.getElementById('today').textContent = new Date().toLocaleString('de-DE', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: '2-digit'
});

const table = document.getElementById('bookingsTable');
const waitTable = document.getElementById('waitlistTable');
const statusFilter = document.getElementById('statusFilter');
const search = document.getElementById('search');
const roleBadge = document.getElementById('roleBadge');
const sessionUser = document.getElementById('sessionUser');
const dashboardHint = document.getElementById('dashboardHint');

let bookingsCache = [];
let waitlistCache = [];
let currentUser = null;
let currentRole = 'customer';

function isStaffRole() {
  return currentRole === 'staff' || currentRole === 'admin';
}

function bookings() {
  return bookingsCache;
}

function waitlist() {
  return waitlistCache;
}

function canPayDeposit(booking) {
  if (!booking) return false;
  if (isStaffRole()) return false;
  if (booking.status === 'canceled') return false;
  if (booking.depositPaid || booking.paymentStatus === 'paid') return false;
  return true;
}

function paymentActionLabel(booking) {
  if (!booking) return 'Anzahlung zahlen';
  if (booking.paymentStatus === 'pending') return 'Anzahlung fortsetzen';
  if (booking.paymentStatus === 'failed') return 'Erneut zahlen';
  return 'Anzahlung zahlen';
}

function pill(status) {
  const label = status === 'requested' ? 'Angefragt' : status === 'confirmed' ? 'Bestätigt' : 'Storniert';
  return `<span class="pill ${status}">${label}</span>`;
}

function paymentPill(status) {
  const normalized = status || 'unpaid';
  const label = normalized === 'paid'
    ? 'Anzahlung: bezahlt'
    : normalized === 'pending'
      ? 'Anzahlung: ausstehend'
      : normalized === 'failed'
        ? 'Anzahlung: fehlgeschlagen'
        : normalized === 'refunded'
          ? 'Anzahlung: erstattet'
          : 'Anzahlung: offen';
  return `<span class="pill payment-${normalized}">${label}</span>`;
}

function matches(b) {
  const f = statusFilter.value;
  if (f !== 'all' && b.status !== f) return false;
  const q = search.value.trim().toLowerCase();
  if (!q) return true;
  const hay = `${b.customer?.firstName || ''} ${b.customer?.lastName || ''} ${b.serviceName || ''} ${b.customer?.phone || ''}`.toLowerCase();
  return hay.includes(q);
}

function render() {
  const list = bookings().slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  table.innerHTML = '';

  const filtered = list.filter(matches);
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'item';
    empty.innerHTML = `<div class="muted">Keine Buchungen gefunden.</div>`;
    table.appendChild(empty);
  }

  filtered.forEach((b) => {
    const div = document.createElement('div');
    div.className = 'item';

    const actions = isStaffRole()
      ? `
        <button class="btn small" data-confirm="${b.id}" ${b.status === 'confirmed' ? 'disabled' : ''}>Bestätigen</button>
        <button class="btn small ghost" data-cancel="${b.id}" ${b.status === 'canceled' ? 'disabled' : ''}>Stornieren</button>
      `
      : `
        ${canPayDeposit(b) ? `<button class="btn small" data-pay="${b.id}">${paymentActionLabel(b)}</button>` : ''}
        <button class="btn small ghost" data-cancel-own="${b.id}" ${b.status === 'canceled' ? 'disabled' : ''}>Termin stornieren</button>
      `;

    div.innerHTML = `
      <div class="row between">
        <div>
          ${pill(b.status)}
          ${paymentPill(b.paymentStatus)}
          <strong>${b.customer?.firstName || ''} ${b.customer?.lastName || ''}</strong>
          <div class="muted small">${b.serviceName}</div>
        </div>
        <div style="text-align:right">
          <div><strong>${fmtDate(b.dateISO)} · ${b.time}</strong></div>
          <div class="muted small">⏱ ${formatMinutes(b.durationMin)} · Anz.: ${currency(b.deposit || 0)}</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="muted small">
        📞 ${b.customer?.phone || '-'} · ✉️ ${b.customer?.email || '-'} · 🏠 ${b.customer?.address || '-'}
      </div>
      ${b.customer?.notes ? `<div class="muted small" style="margin-top:8px">📝 ${b.customer.notes}</div>` : ''}
      ${b.paymentReceiptUrl ? `<div class="muted small" style="margin-top:8px">🧾 <a href="${b.paymentReceiptUrl}" target="_blank" rel="noreferrer">Stripe-Zahlungsbeleg</a></div>` : ''}
      <div class="row end gap" style="margin-top:12px">
        ${actions}
      </div>
    `;

    div.querySelector('[data-confirm]')?.addEventListener('click', () => updateStatus(b.id, 'confirmed'));
    div.querySelector('[data-cancel]')?.addEventListener('click', () => updateStatus(b.id, 'canceled'));
    div.querySelector('[data-cancel-own]')?.addEventListener('click', () => updateStatus(b.id, 'canceled'));
    div.querySelector('[data-pay]')?.addEventListener('click', () => payDepositForBooking(b));
    table.appendChild(div);
  });

  renderWaitlist();
}

function renderWaitlist() {
  const wl = waitlist().slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  waitTable.innerHTML = '';
  if (!wl.length) {
    const empty = document.createElement('div');
    empty.className = 'item';
    empty.innerHTML = `<div class="muted">Keine Einträge.</div>`;
    waitTable.appendChild(empty);
    return;
  }
  wl.forEach((w) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="row between">
        <div>
          <strong>${w.serviceName}</strong>
          <div class="muted small">✉️ ${w.email} · 📞 ${w.phone}</div>
        </div>
        <button class="btn small ghost" data-remove="${w.id}">Entfernen</button>
      </div>
    `;
    div.querySelector('[data-remove]').addEventListener('click', async () => {
      try {
        await removeMyWaitlistEntry(w.id);
        waitlistCache = waitlistCache.filter((x) => x.id !== w.id);
        renderWaitlist();
      } catch (error) {
        alert(`Fehler beim Entfernen: ${error.message}`);
      }
    });
    waitTable.appendChild(div);
  });
}

async function updateStatus(id, status) {
  const list = bookings();
  const current = list.find((x) => x.id === id);
  if (!current) return;

  try {
    let updated = null;
    if (isStaffRole()) {
      updated = await updateBookingStatus(id, status);
    } else {
      if (status !== 'canceled') return;
      updated = await cancelMyBooking(id);
    }
    Object.assign(current, updated);
    render();
  } catch (error) {
    alert(`Status-Update fehlgeschlagen: ${error.message}`);
    return;
  }

  try {
    const eventType = status === 'confirmed' ? 'booking_confirmed' : 'booking_canceled';
    const notifyResult = await sendBookingNotification({
      eventType,
      booking: current,
      customer: current.customer || {}
    });
    if (!notifyResult.ok) {
      console.warn('Notification konnte nicht versendet werden:', notifyResult.message);
    }
  } catch (_error) {
    // Versandfehler blockieren den Statuswechsel nicht.
  }

  const msg = status === 'confirmed'
    ? `✅ Termin für ${current.customer?.firstName || ''} am ${fmtDate(current.dateISO)} um ${current.time} bestätigt.`
    : `❌ Termin für ${current.customer?.firstName || ''} am ${fmtDate(current.dateISO)} wurde storniert.`;
  alert(msg);
}

async function payDepositForBooking(booking) {
  if (!booking?.id) return;
  const origin = `${window.location.origin}/booking.html`;
  const checkout = await createCheckoutSession({
    bookingId: booking.id,
    successUrl: `${origin}?payment=success&session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
    cancelUrl: `${origin}?payment=cancel&booking_id=${booking.id}`
  });
  if (!checkout.ok || !checkout.url) {
    alert(`Checkout konnte nicht gestartet werden: ${checkout.message || 'Unbekannter Fehler'}`);
    return;
  }
  window.location.href = checkout.url;
}

statusFilter.addEventListener('change', render);
search.addEventListener('input', render);

document.getElementById('exportCsv').addEventListener('click', () => {
  const list = bookings();
  const rows = [
    ['id', 'status', 'createdAt', 'date', 'time', 'service', 'durationMin', 'deposit', 'firstName', 'lastName', 'phone', 'email', 'address', 'notes'].join(',')
  ];
  list.forEach((b) => {
    const c = b.customer || {};
    const row = [
      b.id,
      b.status,
      b.createdAt,
      b.dateISO,
      b.time,
      `"${(b.serviceName || '').replaceAll('"', '""')}"`,
      b.durationMin,
      b.deposit,
      `"${(c.firstName || '').replaceAll('"', '""')}"`,
      `"${(c.lastName || '').replaceAll('"', '""')}"`,
      c.phone || '',
      c.email || '',
      `"${(c.address || '').replaceAll('"', '""')}"`,
      `"${(c.notes || '').replaceAll('"', '""')}"`
    ].join(',');
    rows.push(row);
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'parrylicious-bookings.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('clearData').addEventListener('click', () => {
  clearAllData();
});

async function clearAllData() {
  if (!confirm('Wirklich alle eigenen Daten löschen?')) return;
  try {
    await clearMyBookings(currentUser?.id);
    await clearMyWaitlist(currentUser?.id);
    bookingsCache = [];
    waitlistCache = [];
    render();
  } catch (error) {
    alert(`Loeschen fehlgeschlagen: ${error.message}`);
  }
}

async function loadData() {
  bookingsCache = await getMyBookings();
  waitlistCache = await getMyWaitlist();
}

function renderIdentity() {
  if (roleBadge) roleBadge.textContent = `Rolle: ${currentRole}`;
  if (sessionUser) sessionUser.textContent = currentUser?.email || '';
  if (dashboardHint) {
    dashboardHint.textContent = isStaffRole()
      ? 'Mitarbeiteransicht: du siehst alle Buchungen und kannst Status setzen.'
      : 'Kundenansicht: du siehst nur deine eigenen Buchungen und kannst sie stornieren.';
  }
}

async function boot() {
  if (!isSupabaseConfigured) {
    alert('Supabase ist nicht konfiguriert. Bitte zuerst login.html einrichten.');
    window.location.href = 'login.html?next=admin.html';
    return;
  }
  try {
    currentUser = await getCurrentUser();
    if (!currentUser) {
      window.location.href = 'login.html?next=admin.html';
      return;
    }
    currentRole = await getCurrentUserRole();
    renderIdentity();
    await loadData();
    render();
  } catch (error) {
    alert(`Dashboard konnte nicht geladen werden: ${error.message}`);
    window.location.href = 'login.html?next=admin.html';
  }
}

boot();
