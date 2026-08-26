import { clearMockDataSession } from '../shared-data/mockDataSession.js';
import { authenticateMockUser, buildMockAppLink, createMockAccount, isDemoModeAvailable, isMockContractor, mockUserFromSearch } from '../shared-data/mockSession.js';
import { isSupabaseConfigured, sendPasswordReset, signIn, signOut, signUpBusiness } from '../shared-data/supabase.js';
import { loadSchedulingSession, refreshSchedulingSession } from './data.js';
import { friendlyAuthError, passwordResetConfirmation } from '../shared-data/authMessages.js';

const gate = document.getElementById('mockLoginGate');
const app = document.getElementById('schedulingApp');
const form = document.getElementById('mockLoginForm');
const email = document.getElementById('mockEmail');
const password = document.getElementById('mockPassword');
const error = document.getElementById('mockLoginError');
const signInForm = document.getElementById('mockLoginForm');
const signUpForm = document.getElementById('mockSignUpForm');
const resetForm = document.getElementById('mockResetForm');
const resetMessage = document.getElementById('mockResetMessage');
const signInButton = form.querySelector('button[type="submit"]');
if (isSupabaseConfigured) {
  document.getElementById('contractorLoginEyebrow').textContent = 'FieldFlow';
  document.getElementById('contractorLoginDescription').textContent = 'Use your registered FieldFlow email and password. Your company access is assigned securely after sign-in.';
  document.getElementById('contractorSignUpDescription').textContent = 'Create your company and its first owner account. You may need to confirm your email before signing in.';
  document.getElementById('contractorResetDescription').textContent = 'Enter your registered FieldFlow email and we will send a password-reset link.';
  document.getElementById('contractorDemoAccounts').hidden = true;
  document.getElementById('contractorLoginDescription').textContent = 'Use your registered FieldFlow email and password. Checking for an existing session…';
} else if (isDemoModeAvailable) {
  const demoAccounts = document.getElementById('contractorDemoAccounts');
  const heading = document.createElement('strong');
  heading.textContent = 'Demo accounts';
  const john = document.createElement('span');
  john.textContent = 'John: john@fieldflow.demo / john-demo-password';
  const sarah = document.createElement('span');
  sarah.textContent = 'Sarah: sarah@fieldflow.demo / sarah-demo-password';
  demoAccounts.replaceChildren(heading, john, sarah);
}

function showForm(mode) {
  signInForm.hidden = mode !== 'sign-in';
  signUpForm.hidden = mode !== 'sign-up';
  resetForm.hidden = mode !== 'reset';
}

const currentUser = mockUserFromSearch(window.location.search);
let liveContext = null;
let liveLoadError = '';
const showContractorApp = (context) => {
  if (context?.account) {
    gate.hidden = true;
    app.hidden = false;
  }
};

if (!isSupabaseConfigured && isMockContractor(currentUser)) {
  gate.hidden = true;
  app.hidden = false;
} else {
  if (currentUser?.role === 'ops') {
    error.textContent = 'Operations staff use the Operations Dashboard, not Scheduling.';
  }
  async function attemptSignIn(emailValue, passwordValue) {
    error.textContent = '';
    signInButton.disabled = true;
    signInButton.textContent = 'Signing in…';
    try {
      if (isSupabaseConfigured) {
        await signIn(emailValue, passwordValue);
        const context = await refreshSchedulingSession();
        if (!context?.account) {
          await signOut();
          throw new Error('This login is not assigned to a contractor company.');
        }
        window.location.reload();
      } else {
        const user = authenticateMockUser(emailValue, passwordValue);
        if (!isMockContractor(user)) throw new Error('Operations staff use the Operations Dashboard, not Scheduling.');
        window.location.assign(buildMockAppLink(window.location.href, user));
      }
    } catch (signInError) {
      error.textContent = friendlyAuthError(signInError);
    } finally {
      signInButton.disabled = false;
      signInButton.textContent = 'Sign in';
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    attemptSignIn(email.value, password.value);
  });
  const QUICK_SIGN_IN_ACCOUNTS = {
    quickSignInJohn: isSupabaseConfigured
      ? { email: 'john@fieldflow.demo', password: '8QXSDfbmH-DujdbLQMO0y2s4aA7!' }
      : { email: 'john@fieldflow.demo', password: 'john-demo-password' },
    quickSignInSarah: isSupabaseConfigured
      ? { email: 'sarah@fieldflow.demo', password: 'G-EJyv4LikxYzMj1Zdyfw2K_aA7!' }
      : { email: 'sarah@fieldflow.demo', password: 'sarah-demo-password' },
  };
  Object.entries(QUICK_SIGN_IN_ACCOUNTS).forEach(([buttonId, credentials]) => {
    document.getElementById(buttonId)?.addEventListener('click', () => attemptSignIn(credentials.email, credentials.password));
  });
  document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => showForm(button.dataset.authMode)));
  signUpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(signUpForm);
    const passwordValue = formData.get('password');
    if (passwordValue.length < 8) {
      document.getElementById('mockSignUpError').textContent = 'Use a password with at least 8 characters.';
      return;
    }
    try {
      if (isSupabaseConfigured) {
        const result = await signUpBusiness({ companyName: formData.get('companyName'), ownerName: formData.get('ownerName'), email: formData.get('email'), password: passwordValue });
        if (result.session) window.location.reload();
        else document.getElementById('mockSignUpError').textContent = 'Check your email to confirm the account, then return here to sign in.';
      } else {
        const user = createMockAccount({ companyName: formData.get('companyName'), ownerName: formData.get('ownerName'), email: formData.get('email') });
        window.location.assign(buildMockAppLink(window.location.href, user));
      }
    } catch (signUpError) {
      document.getElementById('mockSignUpError').textContent = signUpError.message;
    }
  });
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
  loadSchedulingSession().then((context) => {
    liveContext = context;
    if (context?.user && !context?.account) {
      error.textContent = 'Your login is not assigned to a company yet. Ask your FieldFlow administrator for access.';
      document.getElementById('contractorLoginDescription').textContent = 'Your account needs a company assignment before Scheduling can open.';
      return;
    }
    showContractorApp(context);
  }).catch((loadError) => {
    const message = String(loadError?.message ?? '').toLowerCase();
    liveLoadError = message.includes('jwt') || message.includes('session') || message.includes('401')
      ? 'Your session expired. Please sign in again.'
      : typeof navigator !== 'undefined' && !navigator.onLine
      ? 'You appear to be offline. Check your connection and try again.'
      : 'We couldn’t load your data. Check your connection and try again.';
    error.textContent = `${liveLoadError} You can try signing in again.`;
    document.getElementById('contractorLoginDescription').textContent = liveLoadError;
  });
}

document.getElementById('mockSignOutBtn').addEventListener('click', async () => {
  if (isSupabaseConfigured) await signOut();
  clearMockDataSession();
  window.location.assign(`${window.location.origin}${window.location.pathname}`);
});
