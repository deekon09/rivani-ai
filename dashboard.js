import { firebaseConfig } from './assets/firebase-config.js';

const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
const authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(firebaseConfig);
const auth = authMod.getAuth(app);

const $ = (id) => document.getElementById(id);
const loading = $('dashboardLoading');
const content = $('dashboardContent');
const logoutBtn = $('logoutBtn');
const deleteModal = $('deleteModal');
const openDeleteModal = $('openDeleteModal');
const closeDeleteModal = $('closeDeleteModal');
const deleteUsername = $('deleteUsername');
const deleteAcknowledge = $('deleteAcknowledge');
const scheduleDeleteBtn = $('scheduleDeleteBtn');
const cancelDeleteRequest = $('cancelDeleteRequest');
const deleteStatus = $('deleteStatus');
const deletionBanner = $('deletionBanner');
let currentUser = null;

function formatDate(value){
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(date);
}
function providerLabel(user){
  const ids = user?.providerData?.map(p=>p.providerId) || [];
  if (ids.includes('google.com')) return 'Google';
  if (ids.includes('password')) return 'Email & password';
  return 'Firebase';
}
function pendingKey(user){ return `rivaniDeletionRequest:${user.uid}`; }
function readDeletionRequest(){
  if (!currentUser) return null;
  try { return JSON.parse(localStorage.getItem(pendingKey(currentUser)) || 'null'); } catch { return null; }
}
function setDeleteStatus(text,type='info'){
  if (!deleteStatus) return;
  deleteStatus.textContent=text;
  deleteStatus.dataset.type=type;
}
function renderDeletionState(){
  if (!deletionBanner) return;
  const request = readDeletionRequest();
  if (!request) {
    deletionBanner.hidden = true;
    if (cancelDeleteRequest) cancelDeleteRequest.hidden = true;
    if (scheduleDeleteBtn) scheduleDeleteBtn.hidden = false;
    return;
  }
  deletionBanner.hidden = false;
  deletionBanner.innerHTML = `<b>Deletion request saved</b><span>Grace period ends ${formatDate(request.deleteAt)}. Permanent server-side deletion is not active yet in this build.</span>`;
  if (cancelDeleteRequest) cancelDeleteRequest.hidden = false;
  if (scheduleDeleteBtn) scheduleDeleteBtn.hidden = true;
}
function openModal(){
  if (!deleteModal) return;
  deleteModal.classList.add('open');
  deleteModal.setAttribute('aria-hidden','false');
  setTimeout(()=>deleteUsername?.focus(),80);
  renderDeletionState();
}
function closeModal(){
  if (!deleteModal) return;
  deleteModal.classList.remove('open');
  deleteModal.setAttribute('aria-hidden','true');
  setDeleteStatus('');
}

function switchPanel(targetId){
  document.querySelectorAll('.dashboard-panel').forEach(panel=>{
    const active = panel.id === targetId;
    panel.hidden = !active;
    panel.classList.toggle('active',active);
  });
  document.querySelectorAll('.side-nav-link[data-target]').forEach(btn=>btn.classList.toggle('active',btn.dataset.target===targetId));
  const target = document.getElementById(targetId);
  if (target && window.innerWidth < 950) target.scrollIntoView({behavior:'smooth',block:'start'});
}

document.querySelectorAll('[data-target]').forEach(control=>{
  control.addEventListener('click',()=>switchPanel(control.dataset.target));
});

openDeleteModal?.addEventListener('click',openModal);
closeDeleteModal?.addEventListener('click',closeModal);
deleteModal?.addEventListener('click',e=>{if(e.target===deleteModal)closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

scheduleDeleteBtn?.addEventListener('click',()=>{
  if (!currentUser) return;
  const expected = (currentUser.displayName || '').trim();
  if (!expected) return setDeleteStatus('This account does not have a username yet.','error');
  if ((deleteUsername?.value || '').trim() !== expected) return setDeleteStatus('Username does not match your account. Type it exactly as shown.','error');
  if (!deleteAcknowledge?.checked) return setDeleteStatus('Please confirm that you understand the 7-day deletion notice.','error');
  const requestedAt = Date.now();
  const deleteAt = requestedAt + (7*24*60*60*1000);
  localStorage.setItem(pendingKey(currentUser), JSON.stringify({requestedAt,deleteAt,username:expected}));
  setDeleteStatus('7-day request saved on this browser. Server-side permanent deletion is intentionally not active yet.','warning');
  renderDeletionState();
});

cancelDeleteRequest?.addEventListener('click',()=>{
  if (!currentUser) return;
  localStorage.removeItem(pendingKey(currentUser));
  if (deleteUsername) deleteUsername.value='';
  if (deleteAcknowledge) deleteAcknowledge.checked=false;
  setDeleteStatus('Deletion request cancelled.','success');
  renderDeletionState();
});

logoutBtn?.addEventListener('click',async()=>{
  logoutBtn.disabled=true;
  try { await authMod.signOut(auth); location.replace('auth.html?mode=login'); }
  finally { logoutBtn.disabled=false; }
});

function setText(id,value){ const el=$(id); if(el) el.textContent=value; }
function setAvatar(el,user,name){
  if (!el) return;
  if (user.photoURL) el.innerHTML = `<img src="${user.photoURL}" alt="${name} profile photo" referrerpolicy="no-referrer">`;
  else el.textContent = name.charAt(0).toUpperCase();
}

authMod.onAuthStateChanged(auth,user=>{
  if (!user) { location.replace('auth.html?mode=login'); return; }
  currentUser = user;
  const name = user.displayName?.trim() || user.email?.split('@')[0] || 'RIVANI user';
  const email = user.email || 'No email available';
  const provider = providerLabel(user);
  const created = formatDate(user.metadata?.creationTime);
  const lastLogin = formatDate(user.metadata?.lastSignInTime);

  ['welcomeName','sideUsername','profileUsername','detailUsername','summaryUsername','deleteAccountName'].forEach(id=>setText(id,name));
  ['sideEmail','profileEmail','detailEmail','summaryEmail','deleteAccountEmail'].forEach(id=>setText(id,email));
  ['profileProvider','overviewProvider','securityProvider'].forEach(id=>setText(id,provider));
  ['profileCreated','summaryCreated'].forEach(id=>setText(id,created));
  ['profileLastLogin','summaryLastLogin'].forEach(id=>setText(id,lastLogin));

  setAvatar($('profileAvatar'),user,name);
  setAvatar($('sideAvatar'),user,name);
  setAvatar($('deleteAvatar'),user,name);

  const verified = user.emailVerified || provider === 'Google';
  setText('emailVerification',verified ? 'Verified' : 'Not verified');
  setText('emailVerificationCopy',verified ? 'Your email identity is verified for this account.' : 'Your email is not verified yet. Email verification can be added in the next security step.');

  loading.hidden = true;
  content.hidden = false;
  renderDeletionState();
});
