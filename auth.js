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
const emailForm = document.getElementById('emailAuthForm');
const emailSubmit = document.getElementById('emailSubmit');
const usernameEl = document.getElementById('username');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const confirmEl = document.getElementById('confirmPassword');
const termsEl = document.getElementById('acceptTerms');
let auth;
let authMod;
let mode = 'login';

const configured = Object.values(firebaseConfig).every(v => typeof v === 'string' && v.trim());

function message(text, type='info') {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.type = type;
}

function setMode(nextMode){
  mode = nextMode === 'signup' ? 'signup' : 'login';
  const signup = mode === 'signup';
  loginTab?.classList.toggle('active', !signup);
  signupTab?.classList.toggle('active', signup);
  document.querySelectorAll('.signup-only').forEach(el => el.hidden = !signup);
  if (title) title.textContent = signup ? 'Create your RIVANI account' : 'Welcome back';
  if (subtitle) subtitle.textContent = signup ? 'Create an account with email, Google, or Facebook.' : 'Sign in with email, Google, or Facebook.';
  if (emailSubmit) emailSubmit.textContent = signup ? 'Create account' : 'Log in';
  if (passwordEl) passwordEl.autocomplete = signup ? 'new-password' : 'current-password';
  if (!signup) {
    if (confirmEl) confirmEl.value = '';
    if (termsEl) termsEl.checked = false;
  }
  message('');
  const u = new URL(location.href); u.searchParams.set('mode', mode); history.replaceState({}, '', u);
}

setMode(new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login');
loginTab?.addEventListener('click',()=>setMode('login'));
signupTab?.addEventListener('click',()=>setMode('signup'));

document.querySelectorAll('[data-toggle-password]').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.togglePassword);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
});

function validateSignup(){
  const username = usernameEl?.value.trim() || '';
  const email = emailEl?.value.trim() || '';
  const password = passwordEl?.value || '';
  const confirmPassword = confirmEl?.value || '';
  if (username.length < 2) return 'Please enter a username with at least 2 characters.';
  if (!email || !emailEl.checkValidity()) return 'Please enter a valid email address.';
  if (password.length < 6) return 'Password must contain at least 6 characters.';
  if (password !== confirmPassword) return 'Password and confirm password do not match.';
  if (!termsEl?.checked) return 'Please accept the Terms & Conditions before creating your account.';
  return '';
}

if (!configured) {
  noticeEl.textContent = 'Authentication UI is ready. Add your Firebase web config and enable Email/Password, Google, and Facebook providers to activate real accounts.';
  googleBtn?.classList.add('needs-setup');
  facebookBtn?.classList.add('needs-setup');
  emailForm?.addEventListener('submit', e => {
    e.preventDefault();
    if (mode === 'signup') {
      const err = validateSignup();
      if (err) return message(err, 'error');
    } else if (!emailEl?.checkValidity() || !(passwordEl?.value || '')) {
      return message('Enter your email and password.', 'error');
    }
    message('Complete the Firebase setup note below to activate real account login and signup.', 'warning');
  });
  [googleBtn,facebookBtn].forEach(btn=>btn?.addEventListener('click',()=>message('Complete the Firebase setup note below to activate real social login.', 'warning')));
} else {
  noticeEl.textContent = 'Secure account authentication is enabled through Firebase Authentication.';
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
  const app = appMod.initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);

  emailForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = emailEl?.value.trim() || '';
    const password = passwordEl?.value || '';

    if (mode === 'signup') {
      const validationError = validateSignup();
      if (validationError) return message(validationError, 'error');
      emailSubmit.disabled = true;
      message('Creating your RIVANI account…');
      try {
        const credential = await authMod.createUserWithEmailAndPassword(auth, email, password);
        await authMod.updateProfile(credential.user, { displayName: usernameEl.value.trim() });
        message(`Account created. Welcome, ${usernameEl.value.trim()}!`, 'success');
      } catch (err) {
        const friendly = err?.code === 'auth/email-already-in-use' ? 'An account already exists with this email. Try logging in.' :
          err?.code === 'auth/weak-password' ? 'Please choose a stronger password.' :
          err?.code === 'auth/invalid-email' ? 'Please enter a valid email address.' :
          (err?.message || 'Account could not be created.');
        message(friendly, 'error');
      } finally { emailSubmit.disabled = false; }
    } else {
      if (!email || !emailEl?.checkValidity() || !password) return message('Enter a valid email and password.', 'error');
      emailSubmit.disabled = true;
      message('Signing you in…');
      try {
        const result = await authMod.signInWithEmailAndPassword(auth, email, password);
        message(`Signed in as ${result.user.displayName || result.user.email || 'RIVANI user'}.`, 'success');
      } catch (err) {
        message('Email or password is incorrect, or this sign-in method is not enabled.', 'error');
      } finally { emailSubmit.disabled = false; }
    }
  });

  const doSocialLogin = async provider => {
    message('Opening secure sign-in…');
    try {
      const result = await authMod.signInWithPopup(auth, provider);
      message(`Signed in as ${result.user.displayName || result.user.email || 'RIVANI user'}.`, 'success');
    } catch (err) {
      message(err?.message || 'Sign-in could not be completed.', 'error');
    }
  };
  googleBtn?.addEventListener('click',()=>doSocialLogin(new authMod.GoogleAuthProvider()));
  facebookBtn?.addEventListener('click',()=>doSocialLogin(new authMod.FacebookAuthProvider()));

  authMod.onAuthStateChanged(auth, user => {
    if (user) {
      message(`Signed in as ${user.displayName || user.email || 'RIVANI user'}.`, 'success');
      signOutBtn.hidden = false;
    } else {
      signOutBtn.hidden = true;
    }
  });
  signOutBtn?.addEventListener('click', async()=>{
    await authMod.signOut(auth);
    message('Signed out.', 'success');
  });
}
