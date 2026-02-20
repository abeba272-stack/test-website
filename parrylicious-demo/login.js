import { storage, uid } from './common.js';

document.getElementById('year').textContent = new Date().getFullYear();

const USERS_KEY = 'parry_users';
const SESSION_KEY = 'parry_session';

const statusEl = document.getElementById('loginStatus');
const form = document.getElementById('loginForm');
const registerBtn = document.getElementById('registerBtn');

const googleBtn = document.getElementById('googleBtn');
const appleBtn = document.getElementById('appleBtn');

function users(){ return storage.get(USERS_KEY, []); }
function setUsers(u){ storage.set(USERS_KEY, u); }

function setSession(s){ storage.set(SESSION_KEY, s); }

function show(msg){ statusEl.textContent = msg; }

googleBtn.addEventListener('click', () => {
  setSession({ provider:'google', email:'demo.google@parrylicious.de', at: Date.now() });
  show('✅ (Demo) Angemeldet mit Google.');
});
appleBtn.addEventListener('click', () => {
  setSession({ provider:'apple', email:'demo.apple@parrylicious.de', at: Date.now() });
  show('✅ (Demo) Angemeldet mit Apple.');
});

registerBtn.addEventListener('click', () => {
  const email = prompt('E‑Mail:');
  if (!email) return;
  const password = prompt('Passwort:');
  if (!password) return;
  const u = users();
  if (u.some(x => x.email === email)) return show('❌ E‑Mail existiert schon.');
  u.push({ id: uid('user'), email, password });
  setUsers(u);
  setSession({ provider:'email', email, at: Date.now() });
  show('✅ Registriert (Demo).');
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const email = fd.get('email');
  const password = fd.get('password');
  const u = users().find(x => x.email === email && x.password === password);
  if (!u) return show('❌ Falsche Daten (Demo).');
  setSession({ provider:'email', email, at: Date.now() });
  show('✅ Eingeloggt (Demo).');
});
