const INVALID_CREDENTIAL_PATTERNS = [
  'invalid login credentials',
  'email not confirmed',
];

export function friendlyAuthError(error) {
  const message = String(error?.message || error || '').trim();
  const normalized = message.toLowerCase();

  if (INVALID_CREDENTIAL_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 'Email or password is incorrect. Try again or reset your password.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'FieldFlow could not reach the sign-in service. Check your connection and try again.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Too many sign-in attempts. Wait a moment, then try again.';
  }
  return message || 'We could not sign you in. Try again or reset your password.';
}

export function passwordResetConfirmation(email, isLive) {
  return isLive
    ? `If ${email} is registered with FieldFlow, a password-reset email is on its way.`
    : `Demo only: a reset email would be sent to ${email}.`;
}
