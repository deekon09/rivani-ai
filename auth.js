import { firebaseConfig } from './assets/firebase-config.js';

const statusEl = document.getElementById('authStatus');
const noticeEl = document.getElementById('authNotice');
const signOutBtn = document.getElementById('signOutBtn');
const googleBtn = document.getElementById('googleAuth');
const facebookBtn = document.getElementById('facebookAuth');
const title = document.getElementById('authTitle');
const subtitle = document.getElementById('authSubtitle');
const loginTab = document.getElementById('loginTab');
const signupTab = document.getElementById('signupTab');
let auth;
let signOutFn;

const configured = Object.values(firebaseConfig).every(v => typeof v === 'string' && v.trim());
function setMode(mode){
  const signup = mode === 'signup';
  loginTab?.classList.toggle('active', !signup);
  signupTab?.classList.toggle('active', signup);
  if (title) title.textContent = signup ? 'Create your RIVANI account' : 'Welcome back';
  if (subtitle) subtitle.textContent = signup ? 'Create an account with Google or Facebook.' : 'Continue to RIVANI AI with Google or Facebook.';
  const u = new URL(location.href); u.searchParams.set('mode', signup ? 'signup' : 'login'); history.replaceState({}, '', u);
}
setMode(new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login');
loginTab?.addEventListener('click',()=>setMode('login')); signupTab?.addEventListener('click',()=>setMode('signup'));

if (!configured) {
  statusEl.textContent = 'Authentication is not configured yet. Add your Firebase web config to assets/firebase-config.js.';
  googleBtn?.classList.add('needs-setup'); facebookBtn?.classList.add('needs-setup');
} else {
  noticeEl.textContent = 'Secure social sign-in is enabled through Firebase Authentication.';
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
  const app = appMod.initializeApp(firebaseConfig);
  auth = authMod.getAuth(app); signOutFn = authMod.signOut;
  const doLogin = async provider => {
    statusEl.textContent = 'Opening secure sign-in…';
    try {
      const result = await authMod.signInWithPopup(auth, provider);
      statusEl.textContent = `Signed in as ${result.user.displayName || result.user.email || 'RIVANI user'}.`;
    } catch (err) {
      statusEl.textContent = err?.message || 'Sign-in could not be completed.';
    }
  };
  googleBtn?.addEventListener('click',()=>doLogin(new authMod.GoogleAuthProvider()));
  facebookBtn?.addEventListener('click',()=>doLogin(new authMod.FacebookAuthProvider()));
  authMod.onAuthStateChanged(auth, user => {
    if (user) {
      statusEl.textContent = `Signed in as ${user.displayName || user.email || 'RIVANI user'}.`; signOutBtn.hidden = false;
    } else { signOutBtn.hidden = true; }
  });
  signOutBtn?.addEventListener('click', async()=>{ await signOutFn(auth); statusEl.textContent='Signed out.'; });
}
if (!configured) {
  [googleBtn,facebookBtn].forEach(btn=>btn?.addEventListener('click',()=>{ statusEl.textContent='Complete the Firebase setup note below to activate real social login.'; }));
}
