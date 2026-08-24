import { authenticateMockUser, buildMockAppLink, createMockAccount, mockUserFromSearch } from '../shared-data/mockSession.js';

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

function showForm(mode) {
  signInForm.hidden = mode !== 'sign-in';
  signUpForm.hidden = mode !== 'sign-up';
  resetForm.hidden = mode !== 'reset';
}

if (mockUserFromSearch(window.location.search)) {
  gate.hidden = true;
  app.hidden = false;
} else {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.textContent = '';
    try {
      const user = authenticateMockUser(email.value, password.value);
      window.location.assign(buildMockAppLink(window.location.href, user));
    } catch (signInError) {
      error.textContent = signInError.message;
    }
  });
  document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => showForm(button.dataset.authMode)));
  signUpForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(signUpForm);
    const passwordValue = formData.get('password');
    if (passwordValue.length < 8) {
      document.getElementById('mockSignUpError').textContent = 'Use a password with at least 8 characters.';
      return;
    }
    try {
      const user = createMockAccount({ companyName: formData.get('companyName'), ownerName: formData.get('ownerName'), email: formData.get('email') });
      window.location.assign(buildMockAppLink(window.location.href, user));
    } catch (signUpError) {
      document.getElementById('mockSignUpError').textContent = signUpError.message;
    }
  });
  resetForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const resetEmail = new FormData(resetForm).get('email');
    resetMessage.textContent = `Demo only: a reset email would be sent to ${resetEmail}.`;
  });
}
