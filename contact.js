// RIVANI AI V33 Contact — resilient Turnstile bootstrap.
// Public Turnstile site keys are safe to ship in frontend code.
// TURNSTILE_SECRET_KEY must remain only in the Cloudflare Worker environment.

let runtimeConfig = {};
try {
  const mod = await import('./assets/runtime-config.js?v=33.0-beta-access-fix');
  runtimeConfig = mod?.runtimeConfig || {};
} catch (error) {
  console.warn('RIVANI runtime config could not be loaded; using safe public fallbacks.', error);
}

const API = String(
  runtimeConfig.accountApiBase ||
  runtimeConfig.deletionApiBase ||
  'https://rivani-account-api.rivani.workers.dev'
).replace(/\/$/, '');

// Public site key fallback prevents an old browser-cached runtime-config module
// from leaving Contact permanently stuck on "site key is not configured".
const SITE_KEY = String(
  runtimeConfig.turnstileSiteKey ||
  '0x4AAAAAAEkLoYPaUKHX_xuL'
).trim();

const form = document.getElementById('contactForm');
const submit = document.getElementById('contactSubmit');
const status = document.getElementById('contactStatus');
const widget = document.getElementById('contactTurnstile');

let turnstileToken = '';
let widgetId = null;

if (form && submit && status) {
  const setStatus = (text, type = '') => {
    status.textContent = text;
    status.classList.toggle('success', type === 'success');
    status.classList.toggle('error', type === 'error');
  };

  async function ensureTurnstileApi(){
    if (window.turnstile) return;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rivani-turnstile]');
      if (existing) {
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', () => reject(new Error('Could not load the security check.')), { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.rivaniTurnstile = '1';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load the security check.'));
      document.head.appendChild(script);
    });
  }

  async function loadTurnstile(){
    if (!SITE_KEY) {
      submit.disabled = true;
      if (widget) widget.innerHTML = '<div class="contact-security-missing">Turnstile site key is not configured yet.</div>';
      setStatus('Contact security setup is incomplete. Add the public Turnstile site key first.', 'error');
      return;
    }

    await ensureTurnstileApi();

    if (!widget || !window.turnstile) {
      throw new Error('Security check could not initialize.');
    }

    widget.innerHTML = '';
    widgetId = window.turnstile.render(widget, {
      sitekey: SITE_KEY,
      theme: 'dark',
      action: 'contact',
      callback: token => {
        turnstileToken = String(token || '');
        setStatus('Security check complete. Your message is not public.');
      },
      'expired-callback': () => {
        turnstileToken = '';
        setStatus('Security check expired. Complete it again before sending.', 'error');
      },
      'error-callback': () => {
        turnstileToken = '';
        setStatus('Security check could not finish. Please retry.', 'error');
      }
    });

    submit.disabled = false;
  }

  loadTurnstile().catch(error => {
    submit.disabled = true;
    setStatus(error?.message || 'Could not load the security check.', 'error');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!turnstileToken) {
      setStatus('Complete the security check before sending.', 'error');
      return;
    }

    const payload = {
      name: document.getElementById('contactName').value.trim(),
      email: document.getElementById('contactEmail').value.trim(),
      subject: document.getElementById('contactSubject').value,
      message: document.getElementById('contactMessage').value.trim(),
      website: document.getElementById('contactWebsite').value.trim(),
      turnstileToken
    };

    submit.disabled = true;
    submit.textContent = 'Sending…';
    setStatus('Sending your message securely…');

    try {
      const response = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'omit',
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Could not send the message.');

      form.reset();
      turnstileToken = '';
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
      setStatus(`Message sent successfully${data.reference ? ` · Ref ${data.reference}` : ''}.`, 'success');
    } catch (error) {
      turnstileToken = '';
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
      setStatus(error?.message || 'Could not send the message. Please try again.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Send Message →';
    }
  });
}
