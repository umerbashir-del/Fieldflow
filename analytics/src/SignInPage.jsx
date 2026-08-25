import { useState } from 'react';
import { signIn } from '../../shared-data/supabase.js';

export default function SignInPage({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      await onSignedIn();
    } catch (error) {
      setMessage(error.message || 'We could not sign you in. Check your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="analytics-page sign-in-page">
    <section className="sign-in-card" aria-labelledby="sign-in-title">
      <p className="eyebrow">FieldFlow</p>
      <h1 id="sign-in-title">Sign in to your business</h1>
      <p className="subtitle">Your account decides which jobs, clients, and Analytics data you can see.</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        <button className="copy-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
        {message && <p className="sign-in-message" role="alert">{message}</p>}
      </form>
    </section>
  </main>;
}
