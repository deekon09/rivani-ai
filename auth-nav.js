import { firebaseConfig } from './assets/firebase-config.js';
const configured = Object.values(firebaseConfig).every(v => typeof v === 'string' && v.trim());
if (configured) {
  try {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    authMod.onAuthStateChanged(auth, user => {
      const login = document.querySelector('[data-auth-login]'); const signup = document.querySelector('[data-auth-signup]');
      if (user) {
        if (login) login.style.display='none';
        if (signup) { signup.textContent = (user.displayName?.split(' ')[0] || 'Account'); signup.href='auth.html'; }
      } else { if (login) login.style.display=''; if (signup) { signup.textContent='Sign up'; signup.href='auth.html?mode=signup'; } }
    });
  } catch(e) { console.warn('RIVANI auth nav unavailable', e); }
}
