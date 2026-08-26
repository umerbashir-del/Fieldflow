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
  }).catch((loadError) => {
    const message = String(loadError?.message ?? '').toLowerCase();
    liveLoadError = message.includes('jwt') || message.includes('session') || message.includes('401')
      ? 'Your session expired. Please sign in again.'
      : typeof navigator !== 'undefined' && !navigator.onLine
      ? 'You appear to be offline. Check your connection and try again.'
      : 'We couldn’t load your data. Check your connection and try again.';
    error.textContent = `${liveLoadError} You can try signing in again.`;
    document.getElementById('operationsLoginDescription').textContent = liveLoadError;
    retryButton.hidden = liveLoadError.includes('session');
    retryButton.addEventListener('click', () => window.location.reload(), { once: true });
  });
}

document.getElementById('opsSignOutBtn').addEventListener('click', async () => {
  if (isSupabaseConfigured) await signOut();
  const url = new URL(window.location.href);
  url.search = '';
  window.location.assign(url.toString());
});
