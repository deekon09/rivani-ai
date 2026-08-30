import { firebaseConfig } from './assets/firebase-config.js';

const statusEl = document.getElementById('authStatus');
const noticeEl = document.getElementById('authNotice');
const googleBtn = document.getElementById('googleAuth');
const googleButtonText = document.getElementById('googleButtonText');
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
const passwordRules = document.getElementById('passwordRules');
let auth;
let authMod;
let mode = 'login';
let userActionInProgress = false;

const configured = Object.values(firebaseConfig).every(v => typeof v === 'string' && v.trim());
const usernamePattern = /^[A-Za-z0-9]{3,20}$/;
const passwordChecks = {
  capital: value => /^[A-Z]/.test(value),
  length: value => value.length >= 8 && value.length <= 64,
  lowercase: value => /[a-z]/.test(value),
  number: value => /\d/.test(value),
  special: value => /[^A-Za-z0-9\s]/.test(value),
  spaces: value => !/\s/.test(value)
};

function message(text, type='info') {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.type = type;
}

function updatePasswordRuleUI(){
  const value = passwordEl?.value || '';
  passwordRules?.querySelectorAll('[data-rule]').forEach(el => {
    const key = el.dataset.rule;
    el.classList.toggle('met', Boolean(passwordChecks[key]?.(value)));
  });
}
passwordEl?.addEventListener('input', updatePasswordRuleUI);

function setMode(nextMode){
  mode = nextMode === 'signup' ? 'signup' : 'login';
  const signup = mode === 'signup';
  loginTab?.classList.toggle('active', !signup);
  signupTab?.classList.toggle('active', signup);
  document.querySelectorAll('.signup-only').forEach(el => el.hidden = !signup);
  if (title) title.textContent = signup ? 'Create your RIVANI account' : 'Welcome back';
  if (subtitle) subtitle.textContent = signup ? 'Sign up with email or Google.' : 'Log in with email or Google.';
  if (emailSubmit) emailSubmit.textContent = signup ? 'Create account' : 'Log in';
  if (googleButtonText) googleButtonText.textContent = signup ? 'Sign up with Google' : 'Log in with Google';
  if (passwordEl) passwordEl.autocomplete = signup ? 'new-password' : 'current-password';
  if (!signup) {
    if (confirmEl) confirmEl.value = '';
    if (termsEl) termsEl.checked = false;
  }
  updatePasswordRuleUI();
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
  if (!usernamePattern.test(username)) return 'Username must be 3–20 characters and contain letters or numbers only.';
  if (!email || !emailEl.checkValidity()) return 'Please enter a valid email address.';
  if (!passwordChecks.capital(password)) return 'Password must start with a capital letter.';
  if (!passwordChecks.length(password)) return 'Password must be 8–64 characters long.';
  if (!passwordChecks.lowercase(password)) return 'Password must include at least one lowercase letter.';
  if (!passwordChecks.number(password)) return 'Password must include at least one number.';
  if (!passwordChecks.special(password)) return 'Password must include at least one special character such as @, # or !.';
  if (!passwordChecks.spaces(password)) return 'Password cannot contain spaces.';
  if (password !== confirmPassword) return 'Password and confirm password do not match.';
  if (!termsEl?.checked) return 'Please accept the Terms & Conditions before creating your account.';
  return '';
}

function friendlyAuthError(err, context='login'){
  const code = err?.code || '';
  const map = {
    'auth/email-already-in-use': 'An account already exists with this email. Please log in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Firebase rejected this password as too weak. Choose a stronger password.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account was found with this email. Please sign up first.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/too-many-requests': 'Too many attempts. Please wait a little and try again.',
    'auth/popup-closed-by-user': 'The Google sign-in popup was closed before login finished.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups and try again.',
    'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email using another sign-in method.'
  };
  return map[code] || err?.message || (context === 'signup' ? 'Account could not be created.' : 'Sign-in could not be completed.');
}

function goToCreated(name){
  sessionStorage.setItem('rivani_signup_name', name || 'your account');
  location.href = 'account-created.html';
}

if (!configured) {
  noticeEl.textContent = 'Authentication UI is ready, but Firebase configuration is missing.';
  googleBtn?.classList.add('needs-setup');
  emailForm?.addEventListener('submit', e => { e.preventDefault(); message('Firebase configuration is required before account login can work.', 'warning'); });
  googleBtn?.addEventListener('click',()=>message('Firebase configuration is required before Google login can work.', 'warning'));
} else {
  noticeEl.textContent = 'Secure account authentication is enabled through Firebase Authentication.';
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
  const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);

  emailForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = emailEl?.value.trim() || '';
    const password = passwordEl?.value || '';
    userActionInProgress = true;

    if (mode === 'signup') {
      const validationError = validateSignup();
      if (validationError) { userActionInProgress = false; return message(validationError, 'error'); }
      emailSubmit.disabled = true;
      message('Creating your RIVANI account…');
      try {
        const credential = await authMod.createUserWithEmailAndPassword(auth, email, password);
        const username = usernameEl.value.trim();
        await authMod.updateProfile(credential.user, { displayName: username });
        await authMod.signOut(auth);
        goToCreated(username);
      } catch (err) {
        userActionInProgress = false;
        message(friendlyAuthError(err, 'signup'), 'error');
      } finally { emailSubmit.disabled = false; }
    } else {
      if (!email || !emailEl?.checkValidity() || !password) { userActionInProgress = false; return message('Enter a valid email and password.', 'error'); }
      emailSubmit.disabled = true;
      message('Signing you in…');
      try {
        await authMod.signInWithEmailAndPassword(auth, email, password);
        location.href = 'dashboard.html';
      } catch (err) {
        userActionInProgress = false;
        message(friendlyAuthError(err, 'login'), 'error');
      } finally { emailSubmit.disabled = false; }
    }
  });

  googleBtn?.addEventListener('click', async () => {
    if (mode === 'signup') {
      const chosenUsername = usernameEl?.value.trim() || '';
      if (!usernamePattern.test(chosenUsername)) return message('Choose a username with 3–20 letters or numbers before signing up with Google.', 'error');
      if (!termsEl?.checked) return message('Please accept the Terms & Conditions before signing up with Google.', 'error');
    }
    userActionInProgress = true;
    googleBtn.disabled = true;
    message(mode === 'signup' ? 'Opening Google signup…' : 'Opening Google login…');
    try {
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await authMod.signInWithPopup(auth, provider);
      const info = authMod.getAdditionalUserInfo(result);
      const isNew = Boolean(info?.isNewUser);

      if (mode === 'signup') {
        if (!isNew) {
          await authMod.signOut(auth);
          userActionInProgress = false;
          message('This Google account is already registered. Please use Log in instead.', 'warning');
          return;
        }
        const name = usernameEl?.value.trim() || result.user.displayName || result.user.email || 'Google account';
        await authMod.updateProfile(result.user, { displayName: name });
        await authMod.signOut(auth);
        goToCreated(name);
      } else {
        if (isNew) {
          // Firebase creates a user automatically on first Google sign-in. Undo that here
          // so the Log in tab never silently creates a new account.
          await authMod.deleteUser(result.user);
          userActionInProgress = false;
          message('No RIVANI account exists for this Google account. Please use Sign up first.', 'warning');
          return;
        }
        location.href = 'dashboard.html';
      }
    } catch (err) {
      userActionInProgress = false;
      message(friendlyAuthError(err, mode), 'error');
    } finally { googleBtn.disabled = false; }
  });

  authMod.onAuthStateChanged(auth, user => {
    if (user && !userActionInProgress) location.replace('dashboard.html');
  });
}
