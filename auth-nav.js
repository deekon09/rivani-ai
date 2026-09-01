import { firebaseConfig } from './assets/firebase-config.js';
import { runtimeConfig } from './assets/runtime-config.js';

const ACCOUNT_API = String(runtimeConfig.accountApiBase || runtimeConfig.deletionApiBase || 'https://rivani-account-api.rivani.workers.dev').replace(/\/$/, '');

const configured = Object.values(firebaseConfig).every(v => typeof v === 'string' && v.trim());
let resolveAuthReady;
window.RIVANI_AUTH_READY = new Promise(resolve => { resolveAuthReady = resolve; });
let authResolved = false;

function currentReturnPath(){
  const file=(location.pathname.split('/').pop()||'index.html').replace(/[^A-Za-z0-9._-]/g,'');
  const query=location.search||'';
  const hash=location.hash||'';
  return `${file}${query}${hash}`;
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
      <p id="rivaniAuthGateCopy">Create a free RIVANI account before starting an enhancement.</p>
      <div class="rivani-auth-gate-actions">
        <a class="btn btn-primary" id="rivaniAuthGateSignup" href="auth.html?mode=signup">Sign up free →</a>
        <a class="btn btn-secondary" id="rivaniAuthGateLogin" href="auth.html?mode=login">Already have an account? Log in</a>
      </div>
      <small>Your selected file stays untouched until you choose to run the tool.</small>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-auth-gate-close]').forEach(el=>el.addEventListener('click',()=>{
    modal.classList.add('hidden');
    document.body.style.overflow='';
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
  if(copy)copy.textContent=`Create a free RIVANI account before starting ${toolName}. Free-plan limits are tied to your signed-in account experience.`;
  if(signup)signup.href=`auth.html?mode=signup&next=${encodeURIComponent(next)}`;
  if(login)login.href=`auth.html?mode=login&next=${encodeURIComponent(next)}`;
  modal.classList.remove('hidden');
  document.body.style.overflow='hidden';
}

window.RIVANI_REQUIRE_AUTH = async ({tool='this tool'}={}) => {
  if(window.RIVANI_LUKI_CONTEXT?.signedIn)return true;
  if(window.RIVANI_LUKI_CONTEXT?.signedIn===false){openAuthGate(tool);return false;}
  try{
    await Promise.race([window.RIVANI_AUTH_READY,new Promise(resolve=>setTimeout(resolve,1800))]);
  }catch(_error){}
  if(window.RIVANI_LUKI_CONTEXT?.signedIn)return true;
  openAuthGate(tool);
  return false;
};

function finishAuthReady(context){
  if(authResolved)return;
  authResolved=true;
  resolveAuthReady?.(context);
}

if (configured) {
  try {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    window.RIVANI_GET_ID_TOKEN = async (forceRefresh=false) => {
      const user = auth.currentUser;
      return user ? await user.getIdToken(Boolean(forceRefresh)) : null;
    };

    async function serverPlan(user, fallback='Free'){
      if(!user || !ACCOUNT_API)return {plan:fallback,expiresAt:null};
      try{
        const token=await user.getIdToken();
        const response=await fetch(`${ACCOUNT_API}/api/subscription/status`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',credentials:'omit'});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)return {plan:fallback,expiresAt:null};
        return {plan:String(data.plan||'free').toLowerCase()==='pro'?'Pro':'Free',expiresAt:data.subscription?.expiresAt||null};
      }catch(_error){return {plan:fallback,expiresAt:null};}
    }

    window.RIVANI_REFRESH_PLAN = async () => {
      const user=auth.currentUser;if(!user)return {plan:null};
      const resolved=await serverPlan(user,'Free');
      const previous=window.RIVANI_LUKI_CONTEXT||{};
      const context={...previous,signedIn:true,uid:user.uid||'',username:user.displayName?.trim()||'',email:user.email||'',plan:resolved.plan,proExpiresAt:resolved.expiresAt};
      window.RIVANI_LUKI_CONTEXT=context;
      window.dispatchEvent(new CustomEvent('rivani:auth-context',{detail:context}));
      return context;
    };
    authMod.onAuthStateChanged(auth, async user => {
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
        context={
          signedIn:true,
          uid:user.uid||'',
          username:user.displayName?.trim() || '',
          email:user.email || '',
          plan:resolvedPlan.plan,
          proExpiresAt:resolvedPlan.expiresAt
        };
      }else{
        context={signedIn:false,uid:'',plan:null};
      }
      window.RIVANI_LUKI_CONTEXT=context;
      finishAuthReady(context);
      window.dispatchEvent(new CustomEvent('rivani:auth-context',{detail:context}));
      const login = document.querySelector('[data-auth-login]');
      const signup = document.querySelector('[data-auth-signup]');
      if (user) {
        if (login) login.style.display='none';
        if (signup) {
          const label = user.displayName?.trim() || user.email?.split('@')[0] || 'Dashboard';
          signup.textContent = label;
          signup.href='dashboard.html';
          signup.setAttribute('title','Open your RIVANI dashboard');
        }
      } else {
        if (login) login.style.display='';
        if (signup) { signup.textContent='Sign up'; signup.href='auth.html?mode=signup'; }
      }
    });
  } catch(e) {
    window.RIVANI_GET_ID_TOKEN = async () => null;
    const context={signedIn:false,uid:'',plan:null};
    window.RIVANI_LUKI_CONTEXT=context;
    finishAuthReady(context);
    console.warn('RIVANI auth nav unavailable', e);
  }
} else {
  window.RIVANI_GET_ID_TOKEN = async () => null;
  const context={signedIn:false,uid:'',plan:null};
  window.RIVANI_LUKI_CONTEXT=context;
  finishAuthReady(context);
}
