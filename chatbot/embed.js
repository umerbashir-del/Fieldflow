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
// Usage: <script src="http://localhost:5175/embed.js"></script>
// Point at a different chatbot origin with a data-src attribute, e.g.
// <script src=".../embed.js" data-src="https://chat.example.com"></script>
(function () {
  const CURRENT_SCRIPT = document.currentScript;
  const BASE_URL = (CURRENT_SCRIPT && CURRENT_SCRIPT.dataset.src) || 'http://localhost:5175';

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

  const frame = document.createElement('iframe');
  frame.className = 'ff-embed-frame';
  frame.title = 'FieldFlow Support Assistant';
  frame.src = `${BASE_URL}/?embed=1`;

  function ready() {
    document.body.appendChild(frame);
    document.body.appendChild(launcher);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }

  launcher.addEventListener('click', () => {
    frame.classList.add('is-open');
    launcher.classList.add('is-hidden');
  });

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'fieldflow-chat-close') {
      frame.classList.remove('is-open');
      launcher.classList.remove('is-hidden');
    }
  });
})();
