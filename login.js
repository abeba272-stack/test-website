import { supabase, isSupabaseConfigured, getAuthRedirectUrl } from './supabase.js';

document.getElementById('year').textContent = new Date().getFullYear();

const statusEl = document.getElementById('loginStatus');
const form = document.getElementById('loginForm');
const registerBtn = document.getElementById('registerBtn');
const googleBtn = document.getElementById('googleBtn');
const logoutBtn = document.getElementById('logoutBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const loginActions = document.getElementById('loginActions');
const sessionHint = document.getElementById('sessionHint');
const nextParam = new URLSearchParams(window.location.search).get('next');

function show(msg){ statusEl.textContent = msg; }
function clear(){ statusEl.textContent = ''; }

function mapAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (message.includes('email not confirmed')) return 'Bitte bestaetige zuerst deine E-Mail-Adresse.';
  if (message.includes('user already registered')) return 'Diese E-Mail ist bereits registriert.';
  if (message.includes('password should be at least')) return 'Das Passwort ist zu kurz.';
  if (message.includes('unable to validate email address')) return 'Bitte gib eine gueltige E-Mail-Adresse ein.';
  if (message.includes('signup is disabled')) return 'Registrierung ist aktuell deaktiviert.';
  if (message.includes('provider is not enabled')) return 'Dieser Login-Provider ist in Supabase noch nicht aktiviert.';
  if (message.includes('invalid api key')) return 'Supabase API-Key ist ungueltig.';
  if (message.includes('network') || message.includes('fetch')) return 'Netzwerkfehler. Bitte versuche es erneut.';
  return error?.message || 'Unbekannter Fehler.';
}

function showError(prefix, error) {
  show(`${prefix}: ${mapAuthError(error)}`);
}

function getSafeNextPath() {
  if (!nextParam) return null;
  if (nextParam.includes('://')) return null;
  if (nextParam.startsWith('//')) return null;
  if (!nextParam.endsWith('.html')) return null;
  return nextParam;
}

function setLoggedInUI(email){
  loginActions.classList.add('hidden');
  logoutBtn.classList.remove('hidden');
  sessionHint.textContent = `Angemeldet als ${email}`;
}

function setLoggedOutUI(){
  loginActions.classList.remove('hidden');
  logoutBtn.classList.add('hidden');
  sessionHint.textContent = 'Noch nicht eingeloggt.';
}

async function refreshSession() {
  if (!supabase) return;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setLoggedOutUI();
    showError('Fehler beim Laden der Session', error);
    return;
  }
  const email = data.session?.user?.email;
  if (email) {
    setLoggedInUI(email);
    show('Login erfolgreich.');
    const nextPath = getSafeNextPath();
    if (nextPath) {
      window.location.href = nextPath;
      return;
    }
    return;
  }
  setLoggedOutUI();
  clear();
}

if (!isSupabaseConfigured) {
  show('Supabase ist noch nicht konfiguriert. Bitte supabase-config.js ausfuellen.');
  form.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
  googleBtn.disabled = true;
  registerBtn.disabled = true;
  forgotPasswordBtn.disabled = true;
} else {
  googleBtn.addEventListener('click', async () => {
    clear();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthRedirectUrl() }
    });
    if (error) showError('Google-Login fehlgeschlagen', error);
  });

  registerBtn.addEventListener('click', async () => {
    clear();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    if (!email || !password) {
      show('Bitte E-Mail und Passwort ausfuellen.');
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectUrl() }
    });
    if (error) {
      showError('Registrierung fehlgeschlagen', error);
      return;
    }
    show('Registrierung gesendet. Bitte E-Mail bestaetigen.');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clear();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showError('Login fehlgeschlagen', error);
      return;
    }
    await refreshSession();
  });

  forgotPasswordBtn.addEventListener('click', async () => {
    clear();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    if (!email) {
      show('Bitte zuerst deine E-Mail ins Feld eintragen.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl()
    });
    if (error) {
      showError('Passwort-Reset fehlgeschlagen', error);
      return;
    }
    show('Reset-Link wurde per E-Mail versendet.');
  });

  logoutBtn.addEventListener('click', async () => {
    clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError('Logout fehlgeschlagen', error);
      return;
    }
    setLoggedOutUI();
    show('Erfolgreich abgemeldet.');
    window.location.href = 'home.html';
  });

  supabase.auth.onAuthStateChange(() => {
    refreshSession();
  });

  refreshSession();
}
