import { authenticateMockUser, isDemoModeAvailable, mockUserFromSearch } from '../shared-data/mockSession.js';
import { getOperationsSession, isSupabaseConfigured, sendPasswordReset, signIn, signOut } from '../shared-data/supabase.js';
import { friendlyAuthError, passwordResetConfirmation } from '../shared-data/authMessages.js';

const gate = document.getElementById('opsLoginGate');
const dashboard = document.getElementById('opsDashboard');
const form = document.getElementById('opsLoginForm');
const email = document.getElementById('opsEmail');
const password = document.getElementById('opsPassword');
const error = document.getElementById('opsLoginError');
const resetForm = document.getElementById('opsResetForm');
const resetMessage = document.getElementById('opsResetMessage');
const retryButton = document.getElementById('opsRetryButton');
const demoSignInButton = document.getElementById('opsDemoSignIn');

if (isSupabaseConfigured) {
  document.getElementById('operationsLoginEyebrow').textContent = 'FieldFlow';
  document.getElementById('operationsLoginDescription').textContent = 'Use your registered FieldFlow staff email and password. Contractor accounts use Scheduling instead.';
  document.getElementById('operationsResetDescription').textContent = 'Enter your registered staff email and we will send a password-reset link.';
  document.getElementById('operationsDemoAccount').hidden = true;
} else if (isDemoModeAvailable) {
  const demoAccount = document.getElementById('operationsDemoAccount');
  const heading = document.createElement('strong');
  heading.textContent = 'Demo Operations account';
  const credentials = document.createElement('span');
  credentials.textContent = 'ops@fieldflow.demo / ops-demo-password';
  demoAccount.replaceChildren(heading, credentials);
  demoSignInButton.hidden = false;
  demoSignInButton.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('demo_user', 'ops');
    window.location.assign(url.toString());
  });
}

function showForm(mode) {
  form.hidden = mode !== 'sign-in';
  resetForm.hidden = mode !== 'reset';
}

function signedInOpsUser() {
  const user = mockUserFromSearch(window.location.search);
  return user?.role === 'ops' ? user : null;
}

let liveContext = null;
let liveLoadError = '';

function showDashboard() {
  gate.hidden = true;
  dashboard.hidden = false;
}

if (!isSupabaseConfigured && signedInOpsUser()) {
  showDashboard();
} else {
  async function attemptSignIn(emailValue, passwordValue) {
    error.textContent = '';
    try {
      if (isSupabaseConfigured) {
        await signIn(emailValue, passwordValue);
        const context = await getOperationsSession();
        if (!context?.staff) {
          await signOut();
          throw new Error('This sign-in is for FieldFlow Operations staff. Use Scheduling for contractor accounts.');
        }
        window.location.reload();
      } else {
        const user = authenticateMockUser(emailValue, passwordValue);
        if (user.role !== 'ops') throw new Error('This sign-in is for FieldFlow Operations staff. Use Scheduling for contractor accounts.');
        const url = new URL(window.location.href);
        url.searchParams.set('demo_user', user.id);
        window.location.assign(url.toString());
      }
    } catch (signInError) {
      error.textContent = friendlyAuthError(signInError);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    attemptSignIn(email.value, password.value);
  });
  document.querySelectorAll('[data-ops-auth-mode]').forEach((button) => button.addEventListener('click', () => showForm(button.dataset.opsAuthMode)));
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const resetEmail = new FormData(resetForm).get('email');
    try {
      if (isSupabaseConfigured) {
        await sendPasswordReset(resetEmail, window.location.origin);
      }
      resetMessage.textContent = passwordResetConfirmation(resetEmail, isSupabaseConfigured);
    } catch (resetError) {
      resetMessage.textContent = friendlyAuthError(resetError);
    }
  });
}

if (isSupabaseConfigured) {
  getOperationsSession().then((context) => {
    liveContext = context;
    if (context?.staff) showDashboard();
  }).catch(async () => {
    // A stale or invalid stored session must not block the sign-in form.
    // Clear it when possible, then let the person establish a fresh session.
    try { await signOut(); } catch { /* the local sign-in form still works offline */ }
    liveLoadError = '';
    error.textContent = '';
    document.getElementById('operationsLoginDescription').textContent = 'Use your registered FieldFlow staff email and password. Contractor accounts use Scheduling instead.';
    retryButton.hidden = true;
  });
}

document.getElementById('opsSignOutBtn').addEventListener('click', async () => {
  if (isSupabaseConfigured) await signOut();
  const url = new URL(window.location.href);
  url.search = '';
  window.location.assign(url.toString());
});
