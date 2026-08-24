import { authenticateMockUser, mockUserFromSearch } from '../shared-data/mockSession.js';

const gate = document.getElementById('opsLoginGate');
const dashboard = document.getElementById('opsDashboard');
const form = document.getElementById('opsLoginForm');
const email = document.getElementById('opsEmail');
const password = document.getElementById('opsPassword');
const error = document.getElementById('opsLoginError');
const resetForm = document.getElementById('opsResetForm');
const resetMessage = document.getElementById('opsResetMessage');

function showForm(mode) {
  form.hidden = mode !== 'sign-in';
  resetForm.hidden = mode !== 'reset';
}

function signedInOpsUser() {
  const user = mockUserFromSearch(window.location.search);
  return user?.role === 'ops' ? user : null;
}

function showDashboard() {
  gate.hidden = true;
  dashboard.hidden = false;
}

if (signedInOpsUser()) {
  showDashboard();
} else {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.textContent = '';
    try {
      const user = authenticateMockUser(email.value, password.value);
      if (user.role !== 'ops') throw new Error('This sign-in is for FieldFlow Operations staff. Use Scheduling for contractor accounts.');
      const url = new URL(window.location.href);
      url.searchParams.set('demo_user', user.id);
      window.location.assign(url.toString());
    } catch (signInError) {
      error.textContent = signInError.message;
    }
  });
  document.querySelectorAll('[data-ops-auth-mode]').forEach((button) => button.addEventListener('click', () => showForm(button.dataset.opsAuthMode)));
  resetForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const resetEmail = new FormData(resetForm).get('email');
    resetMessage.textContent = `Demo only: a reset email would be sent to ${resetEmail}.`;
  });
}

document.getElementById('opsSignOutBtn').addEventListener('click', () => {
  const url = new URL(window.location.href);
  url.search = '';
  window.location.assign(url.toString());
});
