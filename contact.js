import { runtimeConfig } from './assets/runtime-config.js';

const API = String(runtimeConfig.accountApiBase || runtimeConfig.deletionApiBase || 'https://rivani-account-api.rivani.workers.dev').replace(/\/$/, '');
const SITE_KEY = String(runtimeConfig.turnstileSiteKey || '').trim();
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

  async function loadTurnstile(){
    if(!SITE_KEY){
      submit.disabled=true;
      if(widget)widget.innerHTML='<div class="contact-security-missing">Turnstile site key is not configured yet.</div>';
      setStatus('Contact security setup is incomplete. Add the public Turnstile site key first.','error');
      return;
    }
    await new Promise((resolve,reject)=>{
      if(window.turnstile)return resolve();
      const script=document.createElement('script');
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async=true;script.defer=true;
      script.onload=resolve;script.onerror=()=>reject(new Error('Could not load the security check.'));
      document.head.appendChild(script);
    });
    widgetId=window.turnstile.render(widget,{
      sitekey:SITE_KEY,
      theme:'dark',
      action:'contact',
      callback:token=>{turnstileToken=String(token||'');setStatus('Security check complete. Your message is not public.');},
      'expired-callback':()=>{turnstileToken='';setStatus('Security check expired. Complete it again before sending.','error');},
      'error-callback':()=>{turnstileToken='';setStatus('Security check could not finish. Please retry.','error');}
    });
  }

  loadTurnstile().catch(error=>{submit.disabled=true;setStatus(error.message,'error');});

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if(!turnstileToken){setStatus('Complete the security check before sending.','error');return;}
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
        credentials:'omit',
        cache:'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Could not send the message.');
      form.reset();
      turnstileToken='';
      if(window.turnstile && widgetId!==null)window.turnstile.reset(widgetId);
      setStatus(`Message sent successfully${data.reference ? ` · Ref ${data.reference}` : ''}.`, 'success');
    } catch (error) {
      turnstileToken='';
      if(window.turnstile && widgetId!==null)window.turnstile.reset(widgetId);
      setStatus(error.message || 'Could not send the message. Please try again.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Send Message →';
    }
  });
}
