import { firebaseConfig } from './assets/firebase-config.js';
import { runtimeConfig } from './assets/runtime-config.js';

const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
const authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(firebaseConfig);
const auth = authMod.getAuth(app);
const DELETION_API = String(runtimeConfig.deletionApiBase || '').replace(/\/$/, '');

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
let currentDeletionRequest = null;

function formatDate(value){
  if (!value) return '—';
  const date = new Date(Number(value) || value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
}
function providerLabel(user){
  const ids = user?.providerData?.map(p=>p.providerId) || [];
  if (ids.includes('google.com')) return 'Google';
  if (ids.includes('password')) return 'Email & password';
  return 'Firebase';
}
function setDeleteStatus(text,type='info'){
  if (!deleteStatus) return;
  deleteStatus.textContent=text;
  deleteStatus.dataset.type=type;
}
async function accountApi(path, options={}){
  if (!currentUser) throw new Error('Please sign in again.');
  if (!DELETION_API) throw new Error('Account service is not configured.');
  const idToken = await currentUser.getIdToken();
  const response = await fetch(`${DELETION_API}${path}`, {
    ...options,
    headers: {
      'Content-Type':'application/json',
      'Authorization':`Bearer ${idToken}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Account service request failed.');
    error.code = data.error || `HTTP_${response.status}`;
    throw error;
  }
  return data;
}
async function loadDeletionState(){
  if (!deletionBanner || !currentUser) return;
  try {
    const data = await accountApi('/api/account-deletion/status');
    currentDeletionRequest = data.pending ? data.request : null;
    renderDeletionState();
  } catch (error) {
    deletionBanner.hidden = false;
    deletionBanner.innerHTML = `<b>Deletion service unavailable</b><span>${escapeHtml(error.message)} Your account has not been scheduled from this screen.</span>`;
    if (cancelDeleteRequest) cancelDeleteRequest.hidden = true;
    if (scheduleDeleteBtn) scheduleDeleteBtn.hidden = false;
  }
}
function renderDeletionState(){
  if (!deletionBanner) return;
  if (!currentDeletionRequest) {
    deletionBanner.hidden = true;
    if (cancelDeleteRequest) cancelDeleteRequest.hidden = true;
    if (scheduleDeleteBtn) scheduleDeleteBtn.hidden = false;
    return;
  }
  deletionBanner.hidden = false;
  deletionBanner.innerHTML = `<b>Account deletion scheduled</b><span>Your 7-day grace period ends ${formatDate(currentDeletionRequest.deleteAt)}. You can cancel before the deletion job runs.</span>`;
  if (cancelDeleteRequest) cancelDeleteRequest.hidden = false;
  if (scheduleDeleteBtn) scheduleDeleteBtn.hidden = true;
}
function openModal(){
  if (!deleteModal) return;
  deleteModal.classList.add('open');
  deleteModal.setAttribute('aria-hidden','false');
  setTimeout(()=>deleteUsername?.focus(),80);
  loadDeletionState();
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
document.querySelectorAll('[data-target]').forEach(control=>control.addEventListener('click',()=>switchPanel(control.dataset.target)));
openDeleteModal?.addEventListener('click',openModal);
closeDeleteModal?.addEventListener('click',closeModal);
deleteModal?.addEventListener('click',e=>{if(e.target===deleteModal)closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

scheduleDeleteBtn?.addEventListener('click', async()=>{
  if (!currentUser) return;
  const expected = (currentUser.displayName || '').trim();
  if (!expected) return setDeleteStatus('This account does not have a username yet.','error');
  if ((deleteUsername?.value || '').trim() !== expected) return setDeleteStatus('Username does not match your account. Type it exactly as shown.','error');
  if (!deleteAcknowledge?.checked) return setDeleteStatus('Please confirm that you understand the 7-day deletion notice.','error');

  scheduleDeleteBtn.disabled = true;
  setDeleteStatus('Scheduling your deletion request…','info');
  try {
    const data = await accountApi('/api/account-deletion/request', {
      method:'POST',
      body:JSON.stringify({ username: expected, acknowledged: true })
    });
    currentDeletionRequest = { requestedAt:data.requestedAt, deleteAt:data.deleteAt, status:'pending' };
    setDeleteStatus('Deletion scheduled. Signing you out for account security…','success');
    renderDeletionState();
    await authMod.signOut(auth);
    location.replace('auth.html?mode=login&deletion=scheduled');
    return;
  } catch (error) {
    if (error.code === 'RECENT_LOGIN_REQUIRED') {
      setDeleteStatus('For security, log out and sign in again, then return here to request deletion.','error');
    } else {
      setDeleteStatus(error.message,'error');
    }
  } finally {
    scheduleDeleteBtn.disabled = false;
  }
});

cancelDeleteRequest?.addEventListener('click', async()=>{
  if (!currentUser) return;
  cancelDeleteRequest.disabled = true;
  setDeleteStatus('Cancelling deletion request…','info');
  try {
    await accountApi('/api/account-deletion/cancel', { method:'POST', body:'{}' });
    currentDeletionRequest = null;
    if (deleteUsername) deleteUsername.value='';
    if (deleteAcknowledge) deleteAcknowledge.checked=false;
    setDeleteStatus('Deletion request cancelled. Your account will remain active.','success');
    renderDeletionState();
  } catch (error) {
    setDeleteStatus(error.message,'error');
  } finally {
    cancelDeleteRequest.disabled = false;
  }
});

logoutBtn?.addEventListener('click',async()=>{
  logoutBtn.disabled=true;
  try { await authMod.signOut(auth); location.replace('auth.html?mode=login'); }
  finally { logoutBtn.disabled=false; }
});

async function loadAdminQueueBadge(){
  const link=$('paymentReviewLink');
  if(!link||!currentUser)return;
  try{
    const data=await accountApi('/api/admin/payments');
    const pending=Array.isArray(data?.pending)?data.pending.length:0;
    link.hidden=false;
    const count=$('paymentReviewCount');
    if(count)count.textContent=pending?String(pending):'';
    link.title=pending?`${pending} payment proof${pending===1?'':'s'} waiting for review`:'No payment proofs waiting';
  }catch(_error){
    link.hidden=true;
  }
}

async function loadPlanState(){
  if(!currentUser)return;
  try{
    const data=await accountApi('/api/subscription/status');
    const pro=String(data?.plan||'free').toLowerCase()==='pro';
    const offer=$('dashboardProOffer');
    if(pro){
      const label='PRO';
      ['sidePlan','overviewPlan','currentPlan','planBadge','planPanelName'].forEach(id=>setText(id,label));
      setText('membershipMark',label);
      if(offer)offer.hidden=true;
      const expiry=data?.subscription?.expiresAt;
      setText('currentPlanCopy',expiry?`RIVANI Pro is active on this account until ${formatDate(expiry)}. Beta All Access does not remove your existing subscription record.`:'RIVANI Pro is active on this account. Beta All Access does not remove your existing subscription record.');
      setText('membershipCopy',expiry?`Your existing Pro membership remains active until ${formatDate(expiry)}.`:'Your existing RIVANI Pro membership is active.');
    }else{
      ['sidePlan','overviewPlan','planBadge'].forEach(id=>setText(id,'BETA'));
      ['currentPlan','planPanelName'].forEach(id=>setText(id,'BETA ALL ACCESS'));
      setText('membershipMark','BETA');
      if(offer)offer.hidden=false;
      setText('currentPlanCopy','RIVANI Public Beta All Access has no successful-job daily cap on the three active AI media tools, and current implemented controls are temporarily unlocked. Future paid Pro is still upcoming.');
      setText('membershipCopy','No payment method is required for Public Beta All Access. Future Pro pricing and public checkout remain paused.');
    }
  }catch(error){
    console.warn('Plan status unavailable',error);
  }
}

function setText(id,value){ const el=$(id); if(el) el.textContent=value; }
function setAvatar(el,user,name){
  if (!el) return;
  if (user.photoURL) el.innerHTML = `<img src="${escapeAttr(user.photoURL)}" alt="${escapeAttr(name)} profile photo" referrerpolicy="no-referrer">`;
  else el.textContent = name.charAt(0).toUpperCase();
}
function escapeHtml(value){ return String(value).replace(/[&<>"']/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[ch])); }
function escapeAttr(value){ return escapeHtml(value); }

authMod.onAuthStateChanged(auth,async user=>{
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
  await Promise.all([loadDeletionState(),loadPlanState(),loadAdminQueueBadge()]);
});
