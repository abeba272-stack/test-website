import { storage, fmtDate, currency, formatMinutes } from './common.js';

document.getElementById('year').textContent = new Date().getFullYear();
document.getElementById('today').textContent = new Date().toLocaleString('de-DE', { weekday:'long', year:'numeric', month:'long', day:'2-digit' });

const BOOKINGS_KEY = 'parry_bookings';
const WAITLIST_KEY = 'parry_waitlist';

const table = document.getElementById('bookingsTable');
const waitTable = document.getElementById('waitlistTable');
const statusFilter = document.getElementById('statusFilter');
const search = document.getElementById('search');

function bookings(){ return storage.get(BOOKINGS_KEY, []); }
function setBookings(list){ storage.set(BOOKINGS_KEY, list); }

function waitlist(){ return storage.get(WAITLIST_KEY, []); }
function setWaitlist(list){ storage.set(WAITLIST_KEY, list); }

function pill(status){
  const label = status === 'requested' ? 'Angefragt' : status === 'confirmed' ? 'Bestätigt' : 'Storniert';
  return `<span class="pill ${status}">${label}</span>`;
}

function matches(b){
  const f = statusFilter.value;
  if (f !== 'all' && b.status !== f) return false;
  const q = search.value.trim().toLowerCase();
  if (!q) return true;
  const hay = `${b.customer?.firstName||''} ${b.customer?.lastName||''} ${b.serviceName||''} ${b.customer?.phone||''}`.toLowerCase();
  return hay.includes(q);
}

function render(){
  const list = bookings().slice().sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  table.innerHTML = '';
  list.filter(matches).forEach(b => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="row between">
        <div>
          ${pill(b.status)}
          <strong>${b.customer.firstName} ${b.customer.lastName}</strong>
          <div class="muted small">${b.serviceName}</div>
        </div>
        <div style="text-align:right">
          <div><strong>${fmtDate(b.dateISO)} · ${b.time}</strong></div>
          <div class="muted small">⏱ ${formatMinutes(b.durationMin)} · Anz.: ${currency(b.deposit||0)}</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="muted small">
        📞 ${b.customer.phone} · ✉️ ${b.customer.email} · 🏠 ${b.customer.address}
      </div>
      ${b.customer.notes ? `<div class="muted small" style="margin-top:8px">📝 ${b.customer.notes}</div>` : ''}
      <div class="row end gap" style="margin-top:12px">
        <button class="btn small" data-confirm="${b.id}" ${b.status==='confirmed'?'disabled':''}>Bestätigen</button>
        <button class="btn small ghost" data-cancel="${b.id}" ${b.status==='canceled'?'disabled':''}>Stornieren</button>
      </div>
    `;
    div.querySelector('[data-confirm]')?.addEventListener('click', () => updateStatus(b.id, 'confirmed'));
    div.querySelector('[data-cancel]')?.addEventListener('click', () => updateStatus(b.id, 'canceled'));
    table.appendChild(div);
  });

  renderWaitlist();
}

function renderWaitlist(){
  const wl = waitlist().slice().sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  waitTable.innerHTML = '';
  if (!wl.length){
    const empty = document.createElement('div');
    empty.className='item';
    empty.innerHTML = `<div class="muted">Keine Einträge.</div>`;
    waitTable.appendChild(empty);
    return;
  }
  wl.forEach(w => {
    const div = document.createElement('div');
    div.className='item';
    div.innerHTML = `
      <div class="row between">
        <div>
          <strong>${w.serviceName}</strong>
          <div class="muted small">✉️ ${w.email} · 📞 ${w.phone}</div>
        </div>
        <button class="btn small ghost" data-remove="${w.id}">Entfernen</button>
      </div>
    `;
    div.querySelector('[data-remove]').addEventListener('click', () => {
      setWaitlist(waitlist().filter(x => x.id !== w.id));
      renderWaitlist();
    });
    waitTable.appendChild(div);
  });
}

function updateStatus(id, status){
  const list = bookings();
  const b = list.find(x => x.id === id);
  if (!b) return;
  b.status = status;
  setBookings(list);
  render();

  const msg = status === 'confirmed'
    ? `✅ SMS/E‑Mail (Demo): Hallo ${b.customer.firstName}, dein Termin am ${fmtDate(b.dateISO)} um ${b.time} für ${b.serviceName} ist bestätigt. – Parrylicious Studio`
    : `❌ SMS/E‑Mail (Demo): Hallo ${b.customer.firstName}, leider müssen wir den Termin am ${fmtDate(b.dateISO)} stornieren. Bitte buche einen neuen Slot. – Parrylicious Studio`;
  alert(msg);
}

statusFilter.addEventListener('change', render);
search.addEventListener('input', render);

document.getElementById('exportCsv').addEventListener('click', () => {
  const list = bookings();
  const rows = [
    ['id','status','createdAt','date','time','service','durationMin','deposit','firstName','lastName','phone','email','address','notes'].join(',')
  ];
  list.forEach(b => {
    const c = b.customer || {};
    const row = [
      b.id, b.status, b.createdAt, b.dateISO, b.time, `"${(b.serviceName||'').replaceAll('"','""')}"`,
      b.durationMin, b.deposit,
      `"${(c.firstName||'').replaceAll('"','""')}"`,
      `"${(c.lastName||'').replaceAll('"','""')}"`,
      c.phone, c.email, `"${(c.address||'').replaceAll('"','""')}"`,
      `"${(c.notes||'').replaceAll('"','""')}"`
    ].join(',');
    rows.push(row);
  });
  const blob = new Blob([rows.join('\n')], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'parrylicious-bookings.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('clearDemo').addEventListener('click', () => {
  if (!confirm('Wirklich alle Demo-Daten löschen?')) return;
  storage.set(BOOKINGS_KEY, []);
  storage.set(WAITLIST_KEY, []);
  render();
});

render();
