import { useState } from 'react';
import { sendPasswordReset, signIn } from '../../shared-data/supabase.js';
import { friendlyAuthError, passwordResetConfirmation } from '../../shared-data/authMessages.js';

export default function SignInPage({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      await onSignedIn();
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    setResetMessage('');
    try {
      await sendPasswordReset(email, window.location.origin);
      setResetMessage(passwordResetConfirmation(email, true));
    } catch (error) {
      setResetMessage(friendlyAuthError(error));
    }
  }

  return <main className="analytics-page sign-in-page">
    <section className="sign-in-card" aria-labelledby="sign-in-title">
      <p className="eyebrow">FieldFlow</p>
      <h1 id="sign-in-title">FieldFlow Sign In</h1>
      <p className="subtitle">Use your registered FieldFlow email and password. Your account determines which company data you can see.</p>
      {!showReset ? <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        <button className="copy-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
        {message && <p className="sign-in-message" role="alert">{message}</p>}
        <button className="copy-button" type="button" onClick={() => { setShowReset(true); setMessage(''); }}>Forgot password?</button>
      </form> : <form onSubmit={resetPassword}>
        <h2>Reset your password</h2>
        <p className="subtitle">Enter your registered FieldFlow email and we will send a password-reset link.</p>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <button className="copy-button" type="submit">Send reset link</button>
        {resetMessage && <p className="sign-in-message" role="status">{resetMessage}</p>}
        <button className="copy-button" type="button" onClick={() => { setShowReset(false); setResetMessage(''); }}>Back to sign in</button>
      </form>}
    </section>
  </main>;
}
