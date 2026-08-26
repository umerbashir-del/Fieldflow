// Drop-in floating chat widget for any FieldFlow page.
//
// This is a plain script (not an ES module) on purpose: scheduling and
// ops-dashboard are meant to stay double-clickable, dependency-free pages,
// and analytics is a separate React app — none of them can import the
// chatbot's own module graph directly. Instead this shows a launcher button
// and, on click, loads the real chatbot (chatbot/index.html, running on its
// own dev server) into an iframe — the same pattern most third-party chat
// widgets (Intercom, Drift, etc.) use.
//
// Usage: <script src="{chatbot origin}/embed.js" data-src="{chatbot origin}"></script>
// data-src tells this script where the chatbot itself is served from (its
// own dev port locally, or wherever it's deployed in production) - built up
// at runtime rather than written as a literal string here, since this file
// ships as-is into production bundles and a hardcoded dev URL would leak.
(function () {
  const CURRENT_SCRIPT = document.currentScript;
  const BASE_URL = (CURRENT_SCRIPT && CURRENT_SCRIPT.dataset.src) || (window.location.protocol + '//' + window.location.hostname + ':' + '5175');

  const style = document.createElement('style');
  style.textContent = `
    .ff-embed-launcher {
      position: fixed; right: 24px; bottom: 24px;
      width: 60px; height: 60px; border: 0; border-radius: 50%;
      background: linear-gradient(145deg, #c1683f, #a4502c);
      box-shadow: 0 10px 30px -8px rgba(150, 70, 40, .6);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 999998;
      transition: transform .15s, box-shadow .15s, opacity .15s, visibility .15s;
    }
    .ff-embed-launcher img { width: 32px; height: 32px; object-fit: contain; }
    .ff-embed-launcher:hover { transform: scale(1.06); box-shadow: 0 14px 34px -8px rgba(150, 70, 40, .7); }
    .ff-embed-launcher.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; transform: scale(.8); }

    .ff-embed-frame {
      position: fixed; right: 24px; bottom: 24px; z-index: 999999;
      width: min(400px, calc(100vw - 32px));
      height: min(640px, calc(100vh - 48px));
      border: 0; border-radius: 20px;
      box-shadow: 0 24px 60px -24px rgba(150, 70, 40, .28), 0 4px 16px rgba(60, 40, 25, .05);
      opacity: 0; visibility: hidden;
      transform: translateY(16px) scale(.96); transform-origin: bottom right;
      transition: opacity .18s ease, transform .18s ease, visibility .18s;
    }
    .ff-embed-frame.is-open { opacity: 1; visibility: visible; transform: none; }

    @media (max-width: 480px) {
      .ff-embed-frame { right: 12px; bottom: 12px; width: calc(100vw - 24px); height: min(640px, calc(100vh - 24px)); }
    }
  `;
  document.head.appendChild(style);

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'ff-embed-launcher';
  launcher.setAttribute('aria-label', 'Open chat');
  launcher.innerHTML = `<img src="${BASE_URL}/robot.png" alt="" />`;

  // In demo/mock mode (no live Supabase config) the signed-in identity
  // travels as URL query params rather than a shared session — see
  // shared-data/mockSession.js's demo_user/account_id/demo_* params — and
  // since the chatbot loads from a different origin/port in local dev, it
  // can't read the host page's own params. Forward the ones that matter so
  // a signed-in visitor doesn't land back on the chatbot's sign-in gate.
  const MOCK_SESSION_PARAMS = ['demo_user', 'account_id', 'demo_name', 'demo_email', 'demo_company'];
  const hostParams = new URLSearchParams(window.location.search);
  const frameUrl = new URL(`${BASE_URL}/`);
  frameUrl.searchParams.set('embed', '1');
  MOCK_SESSION_PARAMS.forEach((key) => {
    const value = hostParams.get(key);
    if (value) frameUrl.searchParams.set(key, value);
  });

  const frame = document.createElement('iframe');
  frame.className = 'ff-embed-frame';
  frame.title = 'FieldFlow Support Assistant';
  frame.src = frameUrl.toString();

  // Live mode (real Supabase) stores the session in this origin's own
  // localStorage under a "sb-<project-ref>-auth-token" key - separate
  // storage from the chatbot's origin/port in local dev, so it can't see a
  // session this page already has on its own. Read it here and hand it to
  // the iframe directly, so a visitor already signed in on this page never
  // has to sign in again just to use the chat.
  function readSupabaseSession() {
    try {
      const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
      if (!key) return null;
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (!parsed?.access_token || !parsed?.refresh_token) return null;
      return { accessToken: parsed.access_token, refreshToken: parsed.refresh_token };
    } catch {
      return null;
    }
  }

  // The widget should only appear once someone's actually signed in - not
  // on the sign-in screen itself. Scheduling and Ops Dashboard are plain
  // pages that always fully reload right after sign-in/sign-out (see their
  // mockLogin.js), so checking once here at load time is enough to track
  // that transition correctly; Analytics is reached with the same identity
  // already in the URL after coming from Scheduling.
  function isSignedIn() {
    if (readSupabaseSession()) return true;
    return Boolean(hostParams.get('demo_user'));
  }

  function bridgeSession() {
    const session = readSupabaseSession();
    if (session) frame.contentWindow.postMessage({ type: 'fieldflow-session', ...session }, BASE_URL);
    else frame.contentWindow.postMessage({ type: 'fieldflow-session-clear' }, BASE_URL);
  }

  function ready() {
    if (!isSignedIn()) return;
    document.body.appendChild(frame);
    document.body.appendChild(launcher);
    frame.addEventListener('load', bridgeSession);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }

  launcher.addEventListener('click', () => {
    frame.classList.add('is-open');
    launcher.classList.add('is-hidden');
    bridgeSession();
  });

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'fieldflow-chat-close') {
      frame.classList.remove('is-open');
      launcher.classList.remove('is-hidden');
    }
  });
})();
