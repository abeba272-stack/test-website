import { services } from './data/services.js';
import { storage, fmtDate, currency, formatMinutes } from './common.js';
import { isSupabaseConfigured } from './supabase.js';
import {
  getCurrentUser,
  getMyBookings,
  getMyWaitlist,
  createMyBooking,
  createMyWaitlistEntry
} from './supabase-data.js';

const YEAR = document.getElementById('year');
if (YEAR) YEAR.textContent = new Date().getFullYear();

const STATE_KEY = 'parry_booking_state';
let currentUser = null;
let bookingsCache = [];
let waitlistCache = [];

const stylists = [
  { id:'auto', name:'Egal (automatisch)', focus:'System entscheidet', role:'auto' },
  { id:'dreads', name:'Stylist A (Dreads/Locs)', focus:'Dreads Fokus', role:'staff' },
  { id:'stylist_b', name:'Stylist B', focus:'Allround', role:'staff' },
  { id:'stylist_c', name:'Stylist C', focus:'Allround', role:'staff' },
  { id:'stylist_d', name:'Stylist D', focus:'Allround', role:'staff' }
];

function getQueryService(){
  const params = new URLSearchParams(location.search);
  return params.get('service');
}

const state = storage.get(STATE_KEY, {
  step: 1,
  serviceId: getQueryService() || null,
  stylistId: 'auto',
  dateISO: null,
  time: null,
  customer: null
});

function saveState(){ storage.set(STATE_KEY, state); }

const steps = [...document.querySelectorAll('.step')];
const panels = {
  1: document.getElementById('step1'),
  2: document.getElementById('step2'),
  3: document.getElementById('step3'),
  4: document.getElementById('step4'),
  5: document.getElementById('step5'),
  done: document.getElementById('done')
};

function showStep(n){
  state.step = n;
  saveState();
  steps.forEach(s => s.classList.toggle('active', Number(s.dataset.step) === n));
  Object.entries(panels).forEach(([k,p]) => {
    if (!p) return;
    if (k === 'done') p.classList.toggle('hidden', n !== 'done');
    else p.classList.toggle('hidden', Number(k) !== n);
  });
  if (n === 3) renderCalendar();
  if (n === 5) renderSummary();
}

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showStep(Number(btn.dataset.back)));
});
document.querySelectorAll('[data-next]').forEach(btn => {
  btn.addEventListener('click', () => showStep(Number(btn.dataset.next)));
});

function card(html){
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = html;
  return div;
}

/* Step 1: service */
const servicePicker = document.getElementById('servicePicker');
const toStep2 = document.getElementById('toStep2');

function renderServicePicker(){
  servicePicker.innerHTML = '';
  services.forEach(s => {
    const selected = state.serviceId === s.id;
    const c = card(`
      <div class="row between">
        <h3>${s.name}</h3>
        <div class="price">ab ${currency(s.priceFrom)}</div>
      </div>
      <div class="muted small">${s.category}</div>
      <p class="muted">${s.description}</p>
      <div class="row between">
        <div class="tag">⏱ ${formatMinutes(s.durationMin)}</div>
        <button class="btn small ${selected ? 'ghost':''}" data-service="${s.id}">
          ${selected ? 'Ausgewählt' : 'Auswählen'}
        </button>
      </div>
    `);
    c.querySelector('[data-service]').addEventListener('click', () => {
      state.serviceId = s.id;
      saveState();
      renderServicePicker();
      toStep2.disabled = false;
    });
    servicePicker.appendChild(c);
  });

  toStep2.disabled = !state.serviceId;
}
renderServicePicker();
toStep2.addEventListener('click', () => showStep(2));

/* Step 2: stylist */
const stylistPicker = document.getElementById('stylistPicker');
function renderStylistPicker(){
  stylistPicker.innerHTML = '';
  stylists.forEach(s => {
    const selected = state.stylistId === s.id;
    const c = card(`
      <div class="row between">
        <h3>${s.name}</h3>
        <span class="pill ${selected ? 'confirmed':''}">${selected ? '✓' : ' '}</span>
      </div>
      <div class="muted">${s.focus}</div>
      <div class="row end gap" style="margin-top:12px">
        <button class="btn small ${selected ? 'ghost':''}" data-stylist="${s.id}">
          ${selected ? 'Ausgewählt' : 'Wählen'}
        </button>
      </div>
    `);
    c.querySelector('[data-stylist]').addEventListener('click', () => {
      state.stylistId = s.id;
      saveState();
      renderStylistPicker();
    });
    stylistPicker.appendChild(c);
  });
}
renderStylistPicker();

/* Step 3: calendar + slots */
const calendarEl = document.getElementById('calendar');
const slotsEl = document.getElementById('slots');
const slotHint = document.getElementById('slotHint');
const toStep4 = document.getElementById('toStep4');
const resetDate = document.getElementById('resetDate');
const joinWaitlist = document.getElementById('joinWaitlist');

const openDays = [2,3,4,5,6]; // Tue..Sat in JS: 0 Sun
const openStart = "11:00";
const openEnd = "19:30";
const slotStepMin = 30;
const maxDaysAhead = 60;
const capacitySeats = 4;

function timeToMinutes(t){
  const [h,m] = t.split(':').map(Number);
  return h*60+m;
}
function minutesToTime(min){
  const h = Math.floor(min/60).toString().padStart(2,'0');
  const m = (min%60).toString().padStart(2,'0');
  return `${h}:${m}`;
}

function getBookings(){ return bookingsCache; }

function overlaps(aStart, aDur, bStart, bDur){
  const a0 = timeToMinutes(aStart);
  const a1 = a0 + aDur;
  const b0 = timeToMinutes(bStart);
  const b1 = b0 + bDur;
  return a0 < b1 && b0 < a1;
}

function isSlotAvailable(dateISO, startTime, durMin){
  const bookings = getBookings().filter(b => b.dateISO === dateISO && b.status !== 'canceled');
  const desiredStylist = state.stylistId;
  if (desiredStylist && desiredStylist !== 'auto'){
    // stylist-specific: block if any booking for that stylist overlaps
    return !bookings.some(b => b.stylistId === desiredStylist && overlaps(b.time, b.durationMin, startTime, durMin));
  } else {
    // capacity-based: allow up to 4 overlapping bookings
    const overlapping = bookings.filter(b => overlaps(b.time, b.durationMin, startTime, durMin)).length;
    return overlapping < capacitySeats;
  }
}

function renderCalendar(){
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  calendarEl.innerHTML = '';

  // 7 day header labels
  const labels = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  labels.forEach(l => {
    const d = document.createElement('div');
    d.className = 'muted small';
    d.style.textAlign = 'center';
    d.textContent = l;
    calendarEl.appendChild(d);
  });

  // Determine first day offset (calendar starts Monday)
  const first = new Date(start);
  const dow = (first.getDay()+6)%7; // Monday=0
  for (let i=0;i<dow;i++){
    const pad = document.createElement('div');
    pad.className = 'day disabled';
    pad.style.visibility = 'hidden';
    calendarEl.appendChild(pad);
  }

  // render 28 days view (4 weeks) starting today
  const daysToShow = 28;
  for (let i=0;i<daysToShow;i++){
    const d = new Date(start);
    d.setDate(d.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const isOpen = openDays.includes(d.getDay());
    const ahead = Math.floor((d - start)/(1000*60*60*24));
    const inRange = ahead <= maxDaysAhead;

    const btn = document.createElement('button');
    btn.type='button';
    btn.className = 'day';
    if (!isOpen || !inRange) btn.classList.add('disabled');

    const day = d.getDate().toString().padStart(2,'0');
    const mon = (d.getMonth()+1).toString().padStart(2,'0');
    btn.innerHTML = `<div>${day}.${mon}</div><div class="sub">${isOpen ? '' : 'zu'}</div>`;
    if (state.dateISO === iso) btn.classList.add('selected');

    btn.addEventListener('click', () => {
      if (!isOpen || !inRange) return;
      state.dateISO = iso;
      state.time = null;
      saveState();
      [...calendarEl.querySelectorAll('.day')].forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
      renderSlots();
    });

    calendarEl.appendChild(btn);
  }

  renderSlots();
}

function renderSlots(){
  slotsEl.innerHTML='';
  toStep4.disabled = !state.time || !state.dateISO;

  if (!state.dateISO){
    slotHint.textContent = 'Wähle links ein Datum.';
    return;
  }
  const service = services.find(s => s.id === state.serviceId);
  if (!service){
    slotHint.textContent = 'Wähle zuerst einen Service.';
    return;
  }

  slotHint.textContent = `Service-Dauer: ${formatMinutes(service.durationMin)} · Öffnung: ${openStart}–${openEnd}`;
  const startMin = timeToMinutes(openStart);
  const endMin = timeToMinutes(openEnd);
  for (let t=startMin; t + service.durationMin <= endMin; t += slotStepMin){
    const tt = minutesToTime(t);
    const ok = isSlotAvailable(state.dateISO, tt, service.durationMin);
    const btn = document.createElement('button');
    btn.type='button';
    btn.className = 'slot';
    btn.textContent = tt;
    if (!ok) btn.classList.add('full');
    if (state.time === tt) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      if (!ok) return;
      state.time = tt;
      saveState();
      renderSlots();
    });
    slotsEl.appendChild(btn);
  }
  toStep4.disabled = !(state.time && state.dateISO);
}

resetDate.addEventListener('click', () => {
  state.dateISO = null; state.time = null; saveState(); renderCalendar();
});

joinWaitlist.addEventListener('click', async () => {
  const service = services.find(s => s.id === state.serviceId);
  if (!service) return alert('Bitte zuerst einen Service wählen.');
  const email = prompt('Warteliste: deine E‑Mail?');
  if (!email) return;
  const phone = prompt('Telefonnummer?');
  if (!phone) return;

  try {
    const row = await createMyWaitlistEntry({
      serviceId: service.id,
      serviceName: service.name,
      email,
      phone,
      note: 'Warteliste'
    }, currentUser.id);
    waitlistCache = [row, ...waitlistCache];
    alert('✅ Warteliste gespeichert.');
  } catch (error) {
    alert(`❌ Warteliste fehlgeschlagen: ${error.message}`);
  }
});

/* Step 4: details form */
const detailsForm = document.getElementById('detailsForm');
detailsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(detailsForm);
  state.customer = Object.fromEntries(fd.entries());
  saveState();
  showStep(5);
});

/* Step 5: payment sim */
const summary = document.getElementById('summary');
const doneSummary = document.getElementById('doneSummary');
const payDeposit = document.getElementById('payDeposit');
const skipPay = document.getElementById('skipPay');
const downloadIcs = document.getElementById('downloadIcs');
const toDone = async () => {
  const service = services.find(s => s.id === state.serviceId);
  const bookingPayload = {
    status: 'requested',
    serviceId: service.id,
    serviceName: service.name,
    durationMin: service.durationMin,
    priceFrom: service.priceFrom,
    deposit: service.deposit,
    stylistId: state.stylistId,
    stylistName: stylists.find(x=>x.id===state.stylistId)?.name || 'Auto',
    dateISO: state.dateISO,
    time: state.time,
    customer: state.customer,
    depositPaid: false
  };
  let booking = null;
  try {
    booking = await createMyBooking(bookingPayload, currentUser.id);
    bookingsCache = [booking, ...bookingsCache];
  } catch (error) {
    alert(`❌ Buchung konnte nicht gespeichert werden: ${error.message}`);
    return;
  }

  // Reset transient state but keep last booking id in memory
  state.lastBookingId = booking.id;
  saveState();

  renderDone(booking);
  showStep('done');
};

function renderSummary(){
  const service = services.find(s => s.id === state.serviceId);
  if (!service) return;
  summary.innerHTML = `
    <div class="row"><strong>Service</strong><div>${service.name}</div></div>
    <div class="row"><strong>Dauer</strong><div>${formatMinutes(service.durationMin)}</div></div>
    <div class="row"><strong>Datum</strong><div>${fmtDate(state.dateISO)} · ${state.time}</div></div>
    <div class="row"><strong>Stylist</strong><div>${stylists.find(s=>s.id===state.stylistId)?.name || 'Auto'}</div></div>
    <div class="divider"></div>
    <div class="row"><strong>Anzahlung</strong><div>${currency(service.deposit)}</div></div>
    <div class="row"><strong>Restzahlung</strong><div>im Salon</div></div>
  `;
}

payDeposit.addEventListener('click', () => {
  // In real: redirect to Stripe Checkout, then webhook confirms.
  alert('💳 (Demo) Zahlung erfolgreich. Anfrage wird gespeichert.');
  toDone();
});
skipPay.addEventListener('click', () => {
  alert('ℹ️ (Demo) Anfrage ohne Zahlung gespeichert. In live würdest du einen Zahlungslink per E‑Mail bekommen.');
  toDone();
});

function renderDone(booking){
  doneSummary.innerHTML = `
    <div class="row"><strong>Service</strong><div>${booking.serviceName}</div></div>
    <div class="row"><strong>Datum</strong><div>${fmtDate(booking.dateISO)} · ${booking.time}</div></div>
    <div class="row"><strong>Name</strong><div>${booking.customer.firstName} ${booking.customer.lastName}</div></div>
    <div class="row"><strong>Status</strong><div>Angefragt</div></div>
    <div class="divider"></div>
    <div class="muted">Demo-Nachricht (würde per SMS/E‑Mail gesendet):</div>
    <pre class="template">Hallo ${booking.customer.firstName}, wir haben deine Anfrage am ${fmtDate(booking.dateISO)} um ${booking.time} für ${booking.serviceName} erhalten. Wir bestätigen den Termin in Kürze. – Parrylicious Studio</pre>
  `;
}

downloadIcs.addEventListener('click', () => {
  const list = getBookings();
  const b = list.find(x => x.id === state.lastBookingId);
  if (!b) return alert('Keine Buchung gefunden.');
  const dtStart = new Date(`${b.dateISO}T${b.time}:00`);
  const dtEnd = new Date(dtStart.getTime() + b.durationMin*60000);

  const pad = n => String(n).padStart(2,'0');
  const toICS = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Parrylicious//Booking Demo//DE',
    'BEGIN:VEVENT',
    `UID:${b.id}@parrylicious-demo`,
    `DTSTAMP:${toICS(new Date())}`,
    `DTSTART:${toICS(dtStart)}`,
    `DTEND:${toICS(dtEnd)}`,
    `SUMMARY:${b.serviceName} – Parrylicious Studio`,
    'LOCATION:Bahlenstraße 42, 40589 Düsseldorf',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([ics], { type:'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'parrylicious-termin.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* init */
async function boot(){
  if (!isSupabaseConfigured) {
    alert('Supabase ist nicht konfiguriert. Bitte supabase-config.js ausfuellen.');
    window.location.href = 'login.html?next=booking.html';
    return;
  }
  try {
    currentUser = await getCurrentUser();
    if (!currentUser) {
      window.location.href = 'login.html?next=booking.html';
      return;
    }
    bookingsCache = await getMyBookings();
    waitlistCache = await getMyWaitlist();
    showStep(state.step || 1);
  } catch (error) {
    alert(`Fehler beim Laden der Buchungsdaten: ${error.message}`);
    window.location.href = 'login.html?next=booking.html';
  }
}

boot();
