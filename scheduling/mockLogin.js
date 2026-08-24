import { clearMockDataSession } from '../shared-data/mockDataSession.js';
import { authenticateMockUser, buildMockAppLink, createMockAccount, isDemoModeAvailable, isMockContractor, mockUserFromSearch } from '../shared-data/mockSession.js';
import { getSignedInAccount, isSupabaseConfigured, sendPasswordReset, signIn, signOut, signUpBusiness } from '../shared-data/supabase.js';

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

if (isSupabaseConfigured) {
  document.getElementById('contractorLoginEyebrow').textContent = 'FieldFlow';
  document.getElementById('contractorDemoAccounts').hidden = true;
  document.getElementById('schedulingDemoNotice').hidden = true;
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
const liveContext = isSupabaseConfigured ? await getSignedInAccount() : null;

if (isSupabaseConfigured && liveContext?.account) {
  gate.hidden = true;
  app.hidden = false;
} else if (!isSupabaseConfigured && isMockContractor(currentUser)) {
  gate.hidden = true;
  app.hidden = false;
} else {
  if (currentUser?.role === 'ops') {
    error.textContent = 'Operations staff use the Operations Dashboard, not Scheduling.';
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    try {
      if (isSupabaseConfigured) {
        await signIn(email.value, password.value);
        const context = await getSignedInAccount();
        if (!context?.account) {
          await signOut();
          throw new Error('This login is not assigned to a contractor company.');
        }
        window.location.reload();
      } else {
        const user = authenticateMockUser(email.value, password.value);
        if (!isMockContractor(user)) throw new Error('Operations staff use the Operations Dashboard, not Scheduling.');
        window.location.assign(buildMockAppLink(window.location.href, user));
      }
    } catch (signInError) {
      error.textContent = signInError.message;
    }
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
        resetMessage.textContent = `A password-reset email was sent to ${resetEmail}.`;
      } else {
        resetMessage.textContent = `Demo only: a reset email would be sent to ${resetEmail}.`;
      }
    } catch (resetError) {
      resetMessage.textContent = resetError.message;
    }
  });
}

document.getElementById('mockSignOutBtn').addEventListener('click', async () => {
  if (isSupabaseConfigured) await signOut();
  clearMockDataSession();
  window.location.assign(`${window.location.origin}${window.location.pathname}`);
});
