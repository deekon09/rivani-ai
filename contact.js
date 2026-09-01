(() => {
  'use strict';
  const API = 'https://rivani-account-api.rivani.workers.dev';
  const form = document.getElementById('contactForm');
  const submit = document.getElementById('contactSubmit');
  const status = document.getElementById('contactStatus');
  if (!form || !submit || !status) return;

  const setStatus = (text, type = '') => {
    status.textContent = text;
    status.classList.toggle('success', type === 'success');
    status.classList.toggle('error', type === 'error');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const payload = {
      name: document.getElementById('contactName').value.trim(),
      email: document.getElementById('contactEmail').value.trim(),
      subject: document.getElementById('contactSubject').value,
      message: document.getElementById('contactMessage').value.trim(),
      website: document.getElementById('contactWebsite').value.trim()
    };
    submit.disabled = true;
    submit.textContent = 'Sending…';
    setStatus('Sending your message…');
    try {
      const response = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Could not send the message.');
      form.reset();
      setStatus(`Message sent successfully${data.reference ? ` · Ref ${data.reference}` : ''}.`, 'success');
    } catch (error) {
      setStatus(error.message || 'Could not send the message. Please try again.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Send Message →';
    }
  });
})();
