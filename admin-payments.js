const $=id=>document.getElementById(id);
const status=$('adminPayStatus');
const list=$('paymentList');
const stats=$('adminPayStats');
const pendingCount=$('pendingCount');
const approvedCount=$('approvedCount');
const refresh=$('refreshPayments');
const modal=$('proofModal');
const proofImage=$('proofImage');
const proofTitle=$('proofTitle');
const proofMeta=$('proofMeta');
let proofUrl='';

function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
function fmt(v){const d=new Date(Number(v)||v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-IN');}
function setStatus(text,type=''){status.textContent=text;status.dataset.state=type;}

async function adminFetch(path,options={}){
  await window.RIVANI_AUTH_READY;
  const token=await window.RIVANI_PRO_API.getToken(false);
  if(!token)throw new Error('Sign in with the RIVANI admin account first.');
  const response=await fetch(`${window.RIVANI_PRO_API.base}${path}`,{
    ...options,
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})},
    cache:'no-store',credentials:'omit'
  });
  const type=response.headers.get('content-type')||'';
  if(!response.ok){
    const data=type.includes('json')?await response.json().catch(()=>({})):{};
    const error=new Error(data.message||`Admin request failed (${response.status})`);error.code=data.error;throw error;
  }
  return type.includes('json')?response.json():response;
}

function renderItems(items){
  list.innerHTML='';
  if(!items.length){list.innerHTML='<div class="admin-pay-empty">No payment screenshots are waiting for review.</div>';return;}
  for(const item of items){
    const card=document.createElement('article');
    card.className='admin-pay-item';
    card.innerHTML=`
      <div class="admin-pay-item-main">
        <div class="admin-pay-reference"><span>${esc(item.reference)}</span><b>₹${esc(item.amountInr)}</b></div>
        <h3>${esc(item.email||'RIVANI account')}</h3>
        <p>Submitted ${esc(fmt(item.submittedAt))}</p>
        <div class="admin-pay-tags"><span>UTR: ${esc(item.utr||'not supplied')}</span><span>Status: ${esc(item.status)}</span></div>
      </div>
      <div class="admin-pay-actions">
        <button type="button" class="btn btn-secondary" data-proof="${esc(item.id)}">View screenshot</button>
        <button type="button" class="btn btn-primary" data-approve="${esc(item.id)}">Approve + activate Pro</button>
        <button type="button" class="admin-reject-btn" data-reject="${esc(item.id)}">Reject</button>
      </div>`;
    list.appendChild(card);
  }
}

async function load(){
  refresh.disabled=true;setStatus('Loading secure payment queue…');
  try{
    const data=await adminFetch('/api/admin/payments');
    stats.hidden=false;list.hidden=false;
    pendingCount.textContent=String(data.pending?.length||0);
    approvedCount.textContent=String(data.recentApproved||0);
    renderItems(data.pending||[]);
    setStatus(`Admin verified · ${data.pending?.length||0} payment${(data.pending?.length||0)===1?'':'s'} waiting.`, 'success');
  }catch(error){
    stats.hidden=true;list.hidden=true;
    setStatus(error.code==='ADMIN_FORBIDDEN'?'This signed-in account is not authorized to review payments.':error.message,'error');
  }finally{refresh.disabled=false;}
}

async function showProof(id){
  setStatus('Loading private payment screenshot…');
  try{
    const token=await window.RIVANI_PRO_API.getToken(false);
    const response=await fetch(`${window.RIVANI_PRO_API.base}/api/admin/payment-proof?session=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Could not load screenshot.');}
    const blob=await response.blob();
    if(proofUrl)URL.revokeObjectURL(proofUrl);proofUrl=URL.createObjectURL(blob);proofImage.src=proofUrl;
    proofTitle.textContent=`Payment ${id.slice(0,8).toUpperCase()}`;proofMeta.textContent='Verify the amount, receiver and transaction status directly in your receiving UPI/bank account before approving.';
    modal.hidden=false;document.body.style.overflow='hidden';
    setStatus('Payment screenshot opened. Verify against the actual bank/UPI receipt before approval.');
  }catch(error){setStatus(error.message,'error');}
}
function closeProof(){modal.hidden=true;document.body.style.overflow='';if(proofUrl){URL.revokeObjectURL(proofUrl);proofUrl='';}proofImage.removeAttribute('src');}
modal?.querySelectorAll('[data-proof-close]').forEach(el=>el.addEventListener('click',closeProof));

document.addEventListener('click',async event=>{
  const proof=event.target.closest('[data-proof]');
  if(proof){await showProof(proof.dataset.proof);return;}
  const approve=event.target.closest('[data-approve]');
  if(approve){
    if(!confirm('Approve this payment only after confirming ₹199 arrived in the correct receiving account. Activate Pro for one month?'))return;
    approve.disabled=true;setStatus('Activating Pro…');
    try{
      const data=await adminFetch('/api/admin/payment/approve',{method:'POST',body:JSON.stringify({sessionId:approve.dataset.approve})});
      setStatus(`Approved. Pro active until ${fmt(data.subscription?.expiresAt)}.`, 'success');
      await load();
    }catch(error){setStatus(error.message,'error');approve.disabled=false;}
    return;
  }
  const reject=event.target.closest('[data-reject]');
  if(reject){
    const note=prompt('Reason for rejection (shown to the customer):','Payment could not be verified. Please check the transaction and contact RIVANI if needed.');
    if(note===null)return;
    reject.disabled=true;setStatus('Rejecting payment proof…');
    try{
      await adminFetch('/api/admin/payment/reject',{method:'POST',body:JSON.stringify({sessionId:reject.dataset.reject,note})});
      setStatus('Payment proof rejected.', 'success');await load();
    }catch(error){setStatus(error.message,'error');reject.disabled=false;}
  }
});
refresh?.addEventListener('click',load);
await window.RIVANI_AUTH_READY;
if(!window.RIVANI_LUKI_CONTEXT?.signedIn){location.replace(`auth.html?mode=login&next=${encodeURIComponent('admin-payments.html')}`);}else{load();}
