import { supabase, isSupabaseConfigured } from './supabase.js';
import { getCurrentUserRole } from './supabase-data.js';

function safeRoleLabel(role) {
  if (role === 'admin') return 'admin';
  if (role === 'staff') return 'staff';
  return 'gast/kunde';
}

function buildMenu(container) {
  container.innerHTML = `
    <div class="profile-menu">
      <button class="btn small ghost profile-trigger" type="button">Profil</button>
      <div class="profile-dropdown hidden">
        <div class="profile-meta">
          <div class="profile-email">Gast</div>
          <div class="profile-role">Nicht eingeloggt</div>
        </div>
        <a class="btn small ghost" href="admin.html">Profil-Einstellungen</a>
        <a class="btn small ghost profile-login" href="login.html">Einloggen</a>
        <button class="btn small ghost profile-logout hidden" type="button">Abmelden</button>
      </div>
    </div>
  `;
  return {
    trigger: container.querySelector('.profile-trigger'),
    dropdown: container.querySelector('.profile-dropdown'),
    emailEl: container.querySelector('.profile-email'),
    roleEl: container.querySelector('.profile-role'),
    loginLink: container.querySelector('.profile-login'),
    logoutBtn: container.querySelector('.profile-logout')
  };
}

async function readUserState() {
  if (!isSupabaseConfigured || !supabase) return { email: null, role: 'gast/kunde' };

  const { data, error } = await supabase.auth.getSession();
  if (error) return { email: null, role: 'gast/kunde' };
  const email = data.session?.user?.email || null;
  if (!email) return { email: null, role: 'gast/kunde' };

  let role = 'customer';
  try {
    role = await getCurrentUserRole();
  } catch (_error) {
    role = 'customer';
  }
  return { email, role: safeRoleLabel(role) };
}

function wireInteractions(parts) {
  parts.trigger.addEventListener('click', () => {
    parts.dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (event) => {
    const menuRoot = parts.trigger.closest('.profile-menu');
    if (!menuRoot?.contains(event.target)) {
      parts.dropdown.classList.add('hidden');
    }
  });
}

async function syncState(parts) {
  const state = await readUserState();
  if (!state.email) {
    parts.emailEl.textContent = 'Gast';
    parts.roleEl.textContent = 'Nicht eingeloggt';
    parts.loginLink.classList.remove('hidden');
    parts.logoutBtn.classList.add('hidden');
    return;
  }
  parts.emailEl.textContent = state.email;
  parts.roleEl.textContent = `Rolle: ${state.role}`;
  parts.loginLink.classList.add('hidden');
  parts.logoutBtn.classList.remove('hidden');
}

async function initMenu(container) {
  const parts = buildMenu(container);
  wireInteractions(parts);

  parts.logoutBtn.addEventListener('click', async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    parts.dropdown.classList.add('hidden');
    await syncState(parts);
    if (window.location.pathname.endsWith('/admin.html') || window.location.pathname.endsWith('admin.html')) {
      window.location.href = 'login.html';
    }
  });

  if (isSupabaseConfigured && supabase) {
    supabase.auth.onAuthStateChange(() => {
      syncState(parts);
    });
  }
  syncState(parts);
}

document.querySelectorAll('[data-profile-menu]').forEach((node) => {
  initMenu(node);
});

