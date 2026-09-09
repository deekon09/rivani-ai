import { firebaseConfig } from './assets/firebase-config.js';
import { runtimeConfig } from './assets/runtime-config.js';

const ACCOUNT_API = String(runtimeConfig.accountApiBase || runtimeConfig.deletionApiBase || 'https://rivani-account-api.rivani.workers.dev').replace(/\/$/, '');
const configured = Object.values(firebaseConfig).every(v => typeof v === 'string' && v.trim());

let resolveAuthReady;
window.RIVANI_AUTH_READY = new Promise(resolve => { resolveAuthReady = resolve; });
let authResolved = false;

function currentReturnPath(){
  const file=(location.pathname.split('/').pop()||'index.html').replace(/[^A-Za-z0-9._-]/g,'');
  return `${file}${location.search||''}${location.hash||''}`;
}
function ensureAuthGate(){
  let modal=document.getElementById('rivaniAuthGate');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='rivaniAuthGate';
  modal.className='rivani-auth-gate hidden';
  modal.innerHTML=`
    <div class="rivani-auth-gate-backdrop" data-auth-gate-close></div>
    <div class="rivani-auth-gate-card" role="dialog" aria-modal="true" aria-labelledby="rivaniAuthGateTitle">
      <button class="rivani-auth-gate-close" type="button" data-auth-gate-close aria-label="Close">×</button>
      <span class="section-kicker">RIVANI ACCOUNT</span>
      <h2 id="rivaniAuthGateTitle">Sign up to use this tool</h2>
      <p id="rivaniAuthGateCopy">Create a free RIVANI account before starting processing.</p>
      <div class="rivani-auth-gate-actions">
        <a class="btn btn-primary" id="rivaniAuthGateSignup" href="auth.html?mode=signup">Sign up free →</a>
        <a class="btn btn-secondary" id="rivaniAuthGateLogin" href="auth.html?mode=login">Already have an account? Log in</a>
      </div>
      <small>Your selected input stays untouched until you choose to run the tool.</small>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-auth-gate-close]').forEach(el=>el.addEventListener('click',()=>{
    modal.classList.add('hidden');document.body.style.overflow='';
  }));
  return modal;
}
function openAuthGate(toolName='this tool'){
  const modal=ensureAuthGate();
  const next=currentReturnPath();
  const title=modal.querySelector('#rivaniAuthGateTitle');
  const copy=modal.querySelector('#rivaniAuthGateCopy');
  const signup=modal.querySelector('#rivaniAuthGateSignup');
  const login=modal.querySelector('#rivaniAuthGateLogin');
  if(title)title.textContent=`Sign up to use ${toolName}`;
  if(copy)copy.textContent=`Create a free RIVANI account before starting ${toolName}. Public Beta All Access currently has no successful-job daily cap; sign-in is still required for processing.`;
  if(signup)signup.href=`auth.html?mode=signup&next=${encodeURIComponent(next)}`;
  if(login)login.href=`auth.html?mode=login&next=${encodeURIComponent(next)}`;
  modal.classList.remove('hidden');document.body.style.overflow='hidden';
}
window.RIVANI_REQUIRE_AUTH = async ({tool='this tool'}={}) => {
  if(window.RIVANI_LUKI_CONTEXT?.signedIn)return true;
  if(window.RIVANI_LUKI_CONTEXT?.signedIn===false){openAuthGate(tool);return false;}
  try{await Promise.race([window.RIVANI_AUTH_READY,new Promise(resolve=>setTimeout(resolve,1800))]);}catch(_error){}
  if(window.RIVANI_LUKI_CONTEXT?.signedIn)return true;
  openAuthGate(tool);return false;
};
function finishAuthReady(context){
  if(authResolved)return;
  authResolved=true;resolveAuthReady?.(context);
}

if(configured){
  try{
    const appMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const authMod=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
    const app=appMod.getApps().length?appMod.getApps()[0]:appMod.initializeApp(firebaseConfig);
    const auth=authMod.getAuth(app);
    window.RIVANI_GET_ID_TOKEN=async(forceRefresh=false)=>{
      const user=auth.currentUser;return user?await user.getIdToken(Boolean(forceRefresh)):null;
    };

    async function serverPlan(user,fallback='Free'){
      if(!user||!ACCOUNT_API)return {plan:fallback,expiresAt:null};
      try{
        const token=await user.getIdToken();
        const response=await fetch(`${ACCOUNT_API}/api/subscription/status`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',credentials:'omit'});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)return {plan:fallback,expiresAt:null};
        return {plan:String(data.plan||'free').toLowerCase()==='pro'?'Pro':'Free',expiresAt:data.subscription?.expiresAt||null};
      }catch(_error){return {plan:fallback,expiresAt:null};}
    }

    window.RIVANI_REFRESH_PLAN=async()=>{
      const user=auth.currentUser;if(!user)return {plan:null};
      const resolved=await serverPlan(user,'Free');
      const previous=window.RIVANI_LUKI_CONTEXT||{};
      const context={...previous,signedIn:true,uid:user.uid||'',username:user.displayName?.trim()||'',email:user.email||'',plan:resolved.plan,proExpiresAt:resolved.expiresAt};
      window.RIVANI_LUKI_CONTEXT=context;
      window.dispatchEvent(new CustomEvent('rivani:auth-context',{detail:context}));
      return context;
    };

    authMod.onAuthStateChanged(auth,async user=>{
      let context;
      if(user){
        window.RIVANI_LUKI_CONTEXT={signedIn:true,uid:user.uid||'',username:user.displayName?.trim()||'',email:user.email||'',plan:'Free'};
        let plan='Free';
        try{
          const tokenResult=await authMod.getIdTokenResult(user);
          const claim=String(tokenResult?.claims?.plan||tokenResult?.claims?.subscription||'').toLowerCase();
          if(claim==='pro'||tokenResult?.claims?.pro===true)plan='Pro';
        }catch(_error){}
        const resolvedPlan=await serverPlan(user,plan);
        context={signedIn:true,uid:user.uid||'',username:user.displayName?.trim()||'',email:user.email||'',plan:resolvedPlan.plan,proExpiresAt:resolvedPlan.expiresAt};
      }else context={signedIn:false,uid:'',plan:null};

      window.RIVANI_LUKI_CONTEXT=context;
      finishAuthReady(context);
      window.dispatchEvent(new CustomEvent('rivani:auth-context',{detail:context}));

      const login=document.querySelector('[data-auth-login]');
      const signup=document.querySelector('[data-auth-signup]');
      if(user){
        if(login)login.style.display='none';
        if(signup){
          signup.textContent=user.displayName?.trim()||user.email?.split('@')[0]||'Dashboard';
          signup.href='dashboard.html';signup.setAttribute('title','Open your RIVANI dashboard');
        }
      }else{
        if(login)login.style.display='';
        if(signup){signup.textContent='Sign up';signup.href='auth.html?mode=signup';}
      }
    });
  }catch(e){
    window.RIVANI_GET_ID_TOKEN=async()=>null;
    const context={signedIn:false,uid:'',plan:null};
    window.RIVANI_LUKI_CONTEXT=context;finishAuthReady(context);
    console.warn('RIVANI auth nav unavailable',e);
  }
}else{
  window.RIVANI_GET_ID_TOKEN=async()=>null;
  const context={signedIn:false,uid:'',plan:null};
  window.RIVANI_LUKI_CONTEXT=context;finishAuthReady(context);
}

// V40 global LUKI refresh: six live tools including Advanced Student Calculator.
(function patchLukiV40(attempt=0){
  if(typeof window.lukiFallbackReply!=='function'&&attempt<40){setTimeout(()=>patchLukiV40(attempt+1),50);return;}

  const compressorReply='RIVANI Smart Image Compressor is live in Public Beta All Access. It can compress images to exact KB/MB targets, compare supported formats with Smart Format Race, use Visual Quality Guard, Text & Logo Guard and Transparency Guard, process batches and build a Website Pack. Best Quality + Smaller Size is the recommended default. Image pixels are decoded and re-encoded in the browser; sign-in is required before processing and there is no successful-job daily cap.';
  const ocrReply='RIVANI Image to Text / OCR is live in Public Beta All Access. It extracts editable text from photos, screenshots, scanned pages, receipts and supported PDFs. It supports Indian and major world-language OCR choices, direct PDF text extraction before scanned-page OCR fallback, Auto Clean, Tiny Text Upscale, Smart OCR Race, confidence review, privacy-pattern scan, TXT/Markdown/JSON export and best-effort Table to CSV. Handwriting is Experimental and important names, numbers and official text should be reviewed.';
  const calculatorReply='RIVANI Advanced Student Calculator is live in Public Beta All Access. It includes scientific calculations, fractions, linear and quadratic equations, calculus, nCr/nPr, statistics, Learn Mode, Exam Ready explanations, Easy Hinglish, Check My Steps for supported linear/quadratic work, 2D graphing, Unit & Dimension Guard, conversions, 2×2 matrices, vectors, significant figures, percentages, geometry, EMI and compound interest. Core maths is deterministic and browser-side; sign-in is required when you run a calculation.';
  const toolsReply='RIVANI AI currently has six live Public Beta tools: AI Audio Repair, Image Enhancer, Background Remover, Smart Image Compressor, Image to Text / OCR and Advanced Student Calculator. Current implemented controls are available during Beta All Access with no successful-job daily cap. PDF Toolkit, AI Resume Builder, AI Logo Generator and broader utilities remain Upcoming.';

  const originalFallback=window.lukiFallbackReply;
  window.lukiFallbackReply=function(raw){
    const q=String(raw||'').toLowerCase().trim();
    if(/(student calculator|advanced calculator|calculator|check my steps|learn mode|exam ready|linear equation|quadratic equation|matrix|vectors?|dimension guard|scientific calculator)/.test(q))return calculatorReply;
    if(/(image to text|ocr|extract text|screenshot to text|photo to text|scan to text|receipt|table to csv|multilingual ocr|handwriting|pdf ocr)/.test(q))return ocrReply;
    if(/(compress image|image compressor|photo compressor|reduce image size|smaller image|exact\s*(?:kb|mb)|\b20\s*kb\b|\b50\s*kb\b|\b100\s*kb\b|\b200\s*kb\b|smart format race|quality guard|artifact map|website pack)/.test(q))return compressorReply;
    if(/(all tool|which tool|tools|feature|about|rivani|platform|live|beta)/.test(q))return toolsReply;
    if(/(upcoming|roadmap|passport|resizer|object remover|pdf toolkit|subtitle|transcription|rewriter|grammar|qr|photo restorer|colorizer|resume|logo generator)/.test(q))return 'RIVANI’s next planned major tools include PDF Toolkit, AI Resume Builder and AI Logo Generator, followed by broader image, creator and text utilities. Advanced Student Calculator, Smart Image Compressor and Image to Text / OCR are already live. Upcoming means planned, not live.';
    const answer=typeof originalFallback==='function'?originalFallback(raw):'';
    return String(answer||'')
      .replace(/three live Beta tools/gi,'six live Beta tools')
      .replace(/four live Beta tools/gi,'six live Beta tools')
      .replace(/five live Beta tools/gi,'six live Beta tools')
      .replace(/three live public-Beta AI media tools/gi,'six live Public Beta tools')
      .replace(/four live Public Beta tools/gi,'six live Public Beta tools')
      .replace(/five live Public Beta tools/gi,'six live Public Beta tools')
      .replace(/AI Audio Repair, Image Enhancer, Background Remover, Smart Image Compressor and Image to Text \/ OCR/g,'AI Audio Repair, Image Enhancer, Background Remover, Smart Image Compressor, Image to Text / OCR and Advanced Student Calculator')
      .replace(/three AI media tools/gi,'six live tools')
      .replace(/four live tools/gi,'six live tools')
      .replace(/five live tools/gi,'six live tools')
      .replace(/three active AI tools/gi,'six active tools')
      .replace(/four active tools/gi,'six active tools')
      .replace(/five active tools/gi,'six active tools');
  };

  const originalBetaLocal=window.betaLocalQuestion;
  window.betaLocalQuestion=function(q){
    if(/(student calculator|advanced calculator|calculator|check my steps|learn mode|exam ready|linear equation|quadratic equation|matrix|vector|dimension guard|image to text|ocr|extract text|screenshot to text|receipt|table to csv|compress image|image compressor|photo compressor|reduce image size|exact\s*(?:kb|mb)|smart format race|artifact map|website pack|which rivani tools|tool status|all tool|tools|live|beta|roadmap|upcoming)/i.test(q))return true;
    return typeof originalBetaLocal==='function'?originalBetaLocal(q):false;
  };

  const originalStale=window.staleCommerceAnswer;
  window.staleCommerceAnswer=function(text){
    const t=String(text||'');
    return /(advanced student calculator|student calculator|calculator).{0,40}(?:planned|upcoming|not live)/i.test(t)
      || /(image compressor|image to text|ocr).{0,35}(?:planned|upcoming|not live)/i.test(t)
      || /(three|four|five)\s+(?:live|active)/i.test(t)
      || (typeof originalStale==='function'&&originalStale(text));
  };

  function refreshDom(){
    const bubble=document.querySelector('#lukiMessages .luki-message.bot:first-child .luki-bubble');
    if(bubble&&/(three|four|five|six)\s+(?:RIVANI tools|active)/i.test(bubble.textContent||'')){
      bubble.textContent='Hi, I’m LUKI. Six RIVANI tools are live in Public Beta All Access right now. Ask me about Audio Repair, Image Enhancer, Background Remover, Smart Image Compressor, Image to Text / OCR, Advanced Student Calculator, accounts or the roadmap.';
    }
    const quick=document.getElementById('lukiQuick');
    if(quick&&!quick.dataset.v40){
      quick.dataset.v40='1';
      quick.innerHTML='<button type="button" data-question="What can Advanced Student Calculator do?">Calculator</button><button type="button" data-question="What can AI Audio Repair do?">Audio Repair</button><button type="button" data-question="What can Image to Text OCR do?">Image to Text</button><button type="button" data-question="What can Smart Image Compressor do?">Compressor</button><button type="button" data-question="What can Background Remover do?">Background</button><button type="button" data-question="Which RIVANI tools are upcoming?">Upcoming</button>';
    }
    if(!document.getElementById('lukiV40MobileStyle')){
      const st=document.createElement('style');st.id='lukiV40MobileStyle';
      st.textContent='.luki-quick{display:flex;flex-wrap:wrap;gap:7px}.luki-quick button{box-sizing:border-box;max-width:100%;min-width:0!important;min-height:38px!important;height:auto!important;white-space:normal!important;overflow-wrap:anywhere;word-break:normal;line-height:1.15;text-align:center;padding:8px 11px}@media(max-width:520px){.luki-quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.luki-quick button{width:100%;font-size:11px!important;padding:7px 6px!important;border-radius:13px!important}.luki-panel{max-width:calc(100vw - 16px)!important}}';
      document.head.appendChild(st);
    }
  }
  refreshDom();setTimeout(refreshDom,0);setTimeout(refreshDom,900);
})();
