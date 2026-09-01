const $ = id => document.getElementById(id);
const title = $('paymentTitle');
const chip = $('paymentStatusChip');
const account = $('paymentAccount');
const timer = $('paymentTimer');
const restart = $('restartPaymentBtn');
const qrCanvas = $('paymentQrCanvas');
const qrPlaceholder = $('paymentQrPlaceholder');
const refEl = $('paymentReference');
const upiLink = $('upiPayLink');
const warning = $('paymentWarning');
const form = $('paymentProofForm');
const proofInput = $('paymentProof');
const proofLabel = $('paymentProofLabel');
const proofPreview = $('paymentProofPreview');
const utrInput = $('paymentUtr');
const submitBtn = $('submitPaymentProof');
const proofStatus = $('paymentProofStatus');
const awaiting = $('paymentAwaiting');
const approved = $('paymentApproved');
const approvedCopy = $('paymentApprovedCopy');

let session = null;
let proofDataUrl = '';
let timerHandle = null;
let pollHandle = null;
let previewUrl = '';

function setChip(text,state=''){
  chip.textContent=text;
  chip.dataset.state=state;
}
function setProofStatus(text,state=''){
  proofStatus.textContent=text;
  proofStatus.dataset.state=state;
}
function formatTime(ms){
  const sec=Math.max(0,Math.ceil(ms/1000));
  return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
}
function stopTimer(){if(timerHandle){clearInterval(timerHandle);timerHandle=null;}}
function stopPoll(){if(pollHandle){clearInterval(pollHandle);pollHandle=null;}}
function renderTimer(){
  if(!session?.expiresAt){timer.textContent='--:--';return;}
  const left=Number(session.expiresAt)-Date.now();
  timer.textContent=formatTime(left);
  timer.classList.toggle('urgent',left>0&&left<=120000);
  if(left<=0 && ['awaiting_payment','created'].includes(session.status)){
    stopTimer();
    setChip('EXPIRED','expired');
    title.textContent='Payment session expired';
    warning.textContent='Do not pay using an expired session. Start a fresh 15-minute session first.';
    form.hidden=true;
    restart.hidden=false;
    upiLink.hidden=true;
  }
}
function startTimer(){stopTimer();renderTimer();timerHandle=setInterval(renderTimer,1000);}

async function renderQr(uri){
  if(!uri){
    qrCanvas.hidden=true;
    qrPlaceholder.hidden=false;
    qrPlaceholder.textContent='Payment QR is not configured yet.';
    return;
  }
  try{
    const mod=await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
    const QRCode=mod.default||mod;
    await QRCode.toCanvas(qrCanvas,uri,{width:280,margin:2,errorCorrectionLevel:'M'});
    qrCanvas.hidden=false;
    qrPlaceholder.hidden=true;
  }catch(error){
    console.error('QR render failed',error);
    qrCanvas.hidden=true;
    qrPlaceholder.hidden=false;
    qrPlaceholder.textContent='QR could not render. Use the UPI app button below.';
  }
}

function showApproved(data){
  stopTimer();stopPoll();
  form.hidden=true;awaiting.hidden=true;approved.hidden=false;restart.hidden=true;
  setChip('PRO ACTIVE','approved');
  title.textContent='Payment verified';
  const expiry=data?.subscription?.expiresAt||data?.expiresAt;
  approvedCopy.textContent=expiry?`Pro is active until ${new Date(expiry).toLocaleString('en-IN')}.`:'Your RIVANI Pro membership is active.';
  window.RIVANI_REFRESH_PLAN?.().catch?.(()=>{});
}

function showSubmitted(){
  form.hidden=true;awaiting.hidden=false;approved.hidden=true;restart.hidden=true;upiLink.hidden=true;
  setChip('VERIFYING','submitted');
  title.textContent='Verification pending';
  warning.textContent='Your screenshot was received. RIVANI will activate Pro only after the payment is verified.';
  stopTimer();
  startPolling();
}

async function loadStatus(){
  if(!session?.id)return;
  try{
    const data=await window.RIVANI_PRO_API.api(`/api/payment/status?session=${encodeURIComponent(session.id)}`);
    session={...session,...data.session};
    if(data.plan==='pro'||data.session?.status==='approved'){showApproved(data);return;}
    if(data.session?.status==='submitted'){showSubmitted();return;}
    if(data.session?.status==='rejected'){
      stopPoll();form.hidden=true;awaiting.hidden=true;restart.hidden=false;
      setChip('REJECTED','rejected');title.textContent='Payment proof needs attention';
      warning.textContent=data.session.adminNote||'The payment could not be verified. Start a new payment session only after checking the payment details.';
    }
  }catch(_error){}
}
function startPolling(){
  stopPoll();
  pollHandle=setInterval(loadStatus,10000);
}

async function beginSession(){
  stopTimer();stopPoll();
  proofDataUrl='';
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl='';}
  proofPreview.hidden=true;form.hidden=true;awaiting.hidden=true;approved.hidden=true;restart.hidden=true;upiLink.hidden=true;
  setChip('CHECKING');title.textContent='Preparing your QR…';warning.textContent='Do not pay until your unique payment reference and QR are visible.';

  await window.RIVANI_AUTH_READY;
  const ctx=window.RIVANI_LUKI_CONTEXT||{};
  if(!ctx.signedIn){
    location.replace(`auth.html?mode=login&next=${encodeURIComponent('pro.html')}`);
    return;
  }
  account.textContent=ctx.email||ctx.username||'Signed-in RIVANI account';

  const sub=await window.RIVANI_PRO_API.getSubscription();
  if(sub.plan==='pro'){
    showApproved(sub);
    return;
  }

  const data=await window.RIVANI_PRO_API.api('/api/payment/session',{method:'POST',body:{source:new URLSearchParams(location.search).get('from')||'website'}});
  session=data.session;
  refEl.textContent=session.reference||session.id?.slice(0,8).toUpperCase()||'—';

  if(session.status==='submitted'){showSubmitted();return;}
  if(session.status==='approved'){showApproved(data);return;}

  if(!data.paymentConfigured){
    setChip('SETUP REQUIRED','error');
    title.textContent='Payment QR setup required';
    warning.textContent='RIVANI payment receiving details are not configured on the backend yet. Do not make a payment.';
    qrCanvas.hidden=true;qrPlaceholder.hidden=false;qrPlaceholder.textContent='QR unavailable until RIVANI_UPI_ID is configured.';
    return;
  }

  title.textContent='Scan QR and pay ₹199';
  setChip('15 MIN','ready');
  warning.textContent='Pay exactly ₹199. Never enter your UPI PIN, OTP or bank password on the RIVANI website.';
  form.hidden=false;
  if(data.upiUri){upiLink.href=data.upiUri;upiLink.hidden=false;}
  await renderQr(data.upiUri);
  startTimer();
}

async function fileToDataUrl(blob){
  return await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Could not read screenshot.'));
    reader.readAsDataURL(blob);
  });
}

async function compressProof(file){
  const allowed=new Set(['image/png','image/jpeg','image/webp']);
  if(!allowed.has(file.type))throw new Error('Use a PNG, JPG or WebP screenshot.');
  if(file.size>8*1024*1024)throw new Error('Screenshot is too large. Please use an image under 8 MB.');
  const bitmap=await createImageBitmap(file);
  let scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
  let quality=.88;
  let blob=null;
  for(let attempt=0;attempt<6;attempt++){
    const w=Math.max(320,Math.round(bitmap.width*scale));
    const h=Math.max(320,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
    blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(blob&&blob.size<=560*1024)break;
    quality=Math.max(.64,quality-.06);scale*=.88;
  }
  try{bitmap.close?.();}catch(_error){}
  if(!blob||blob.size>650*1024)throw new Error('Could not safely compress this screenshot. Crop it to the payment receipt and try again.');
  return blob;
}

proofInput?.addEventListener('change',async()=>{
  proofDataUrl='';
  const file=proofInput.files?.[0];
  if(!file){proofLabel.textContent='Choose successful-payment screenshot';proofPreview.hidden=true;return;}
  proofLabel.textContent='Preparing screenshot…';
  try{
    const blob=await compressProof(file);
    proofDataUrl=await fileToDataUrl(blob);
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    previewUrl=URL.createObjectURL(blob);
    proofPreview.src=previewUrl;proofPreview.hidden=false;
    proofLabel.textContent=`Ready · ${(blob.size/1024).toFixed(0)} KB secure upload`;
    setProofStatus('Screenshot ready. Confirm the payment succeeded in your UPI app, then submit.');
  }catch(error){
    proofInput.value='';proofLabel.textContent='Choose successful-payment screenshot';proofPreview.hidden=true;
    setProofStatus(error.message,'error');
  }
});

form?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!session?.id)return;
  if(Date.now()>=Number(session.expiresAt||0))return renderTimer();
  if(!proofDataUrl)return setProofStatus('Choose the successful-payment screenshot first.','error');
  submitBtn.disabled=true;submitBtn.textContent='Submitting securely…';
  setProofStatus('Uploading proof for manual verification…');
  try{
    const data=await window.RIVANI_PRO_API.api('/api/payment/proof',{method:'POST',body:{sessionId:session.id,utr:String(utrInput.value||'').trim(),proofDataUrl}});
    session={...session,...data.session};
    setProofStatus('Screenshot submitted. Waiting for RIVANI verification.','success');
    showSubmitted();
  }catch(error){
    setProofStatus(error.message||'Could not submit payment proof.','error');
  }finally{
    submitBtn.disabled=false;submitBtn.textContent='Submit screenshot for verification →';
  }
});

restart?.addEventListener('click',()=>beginSession().catch(error=>{warning.textContent=error.message;setChip('ERROR','error');}));

beginSession().catch(error=>{
  console.error(error);
  setChip('ERROR','error');title.textContent='Could not start payment session';warning.textContent=error.message||'Please try again.';restart.hidden=false;
});
