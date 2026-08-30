import { firebaseConfig } from './assets/firebase-config.js';

const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
const authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(firebaseConfig);
const auth = authMod.getAuth(app);

const loading = document.getElementById('dashboardLoading');
const content = document.getElementById('dashboardContent');
const logoutBtn = document.getElementById('logoutBtn');
const deleteModal = document.getElementById('deleteModal');
const openDeleteModal = document.getElementById('openDeleteModal');
const closeDeleteModal = document.getElementById('closeDeleteModal');
const deleteUsername = document.getElementById('deleteUsername');
const deleteAcknowledge = document.getElementById('deleteAcknowledge');
const scheduleDeleteBtn = document.getElementById('scheduleDeleteBtn');
const cancelDeleteRequest = document.getElementById('cancelDeleteRequest');
const deleteStatus = document.getElementById('deleteStatus');
const deletionBanner = document.getElementById('deletionBanner');
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
  const request = readDeletionRequest();
  if (!request) {
    deletionBanner.hidden = true;
    cancelDeleteRequest.hidden = true;
    scheduleDeleteBtn.hidden = false;
    return;
  }
  deletionBanner.hidden = false;
  deletionBanner.innerHTML = `<b>Deletion request preview active</b><span>Grace period ends ${formatDate(request.deleteAt)}. This development build does not yet have the server-side worker required to permanently delete Firebase accounts automatically.</span>`;
  cancelDeleteRequest.hidden = false;
  scheduleDeleteBtn.hidden = true;
}
function openModal(){ deleteModal.classList.add('open'); deleteModal.setAttribute('aria-hidden','false'); setTimeout(()=>deleteUsername?.focus(),80); renderDeletionState(); }
function closeModal(){ deleteModal.classList.remove('open'); deleteModal.setAttribute('aria-hidden','true'); setDeleteStatus(''); }

openDeleteModal?.addEventListener('click',openModal);
closeDeleteModal?.addEventListener('click',closeModal);
deleteModal?.addEventListener('click',e=>{if(e.target===deleteModal)closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

scheduleDeleteBtn?.addEventListener('click',()=>{
  if (!currentUser) return;
  const expected = (currentUser.displayName || '').trim();
  if (!expected) return setDeleteStatus('This account does not have a username yet.','error');
  if ((deleteUsername?.value || '').trim() !== expected) return setDeleteStatus('Username does not match your account. Type it exactly as shown on the dashboard.','error');
  if (!deleteAcknowledge?.checked) return setDeleteStatus('Please confirm that you understand the 7-day deletion notice.','error');
  const requestedAt = Date.now();
  const deleteAt = requestedAt + (7*24*60*60*1000);
  localStorage.setItem(pendingKey(currentUser), JSON.stringify({requestedAt,deleteAt,username:expected}));
  setDeleteStatus('7-day grace-period request saved in this browser. The automatic server-side deletion worker is intentionally not active yet.','warning');
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

authMod.onAuthStateChanged(auth,user=>{
  if (!user) { location.replace('auth.html?mode=login'); return; }
  currentUser = user;
  const name = user.displayName?.trim() || user.email?.split('@')[0] || 'RIVANI user';
  const initial = name.charAt(0).toUpperCase();
  document.getElementById('welcomeName').textContent = name;
  document.getElementById('profileUsername').textContent = name;
  document.getElementById('profileEmail').textContent = user.email || 'No email available';
  document.getElementById('detailUsername').textContent = name;
  document.getElementById('detailEmail').textContent = user.email || '—';
  document.getElementById('profileProvider').textContent = providerLabel(user);
  document.getElementById('profileCreated').textContent = formatDate(user.metadata?.creationTime);
  document.getElementById('profileLastLogin').textContent = formatDate(user.metadata?.lastSignInTime);
  const avatar = document.getElementById('profileAvatar');
  if (user.photoURL) {
    avatar.innerHTML = `<img src="${user.photoURL}" alt="${name} profile photo" referrerpolicy="no-referrer">`;
  } else avatar.textContent = initial;
  loading.hidden = true;
  content.hidden = false;
  renderDeletionState();
});
