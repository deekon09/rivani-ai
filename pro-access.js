// RIVANI AI V32 — Public Beta All Access compatibility layer
// Stable AI inference/model files are intentionally untouched.
(() => {
  'use strict';
  const API = 'https://rivani-account-api.rivani.workers.dev';
  const MEDIA_TOOLS = new Set(['audio-repair','image-enhancer','background-remover']);
  const UNLIMITED_NUMBER = Number.MAX_SAFE_INTEGER;

  async function waitForAuth(){
    try{
      if(window.RIVANI_AUTH_READY){
        await Promise.race([
          window.RIVANI_AUTH_READY,
          new Promise(resolve=>setTimeout(resolve,2200))
        ]);
      }
    }catch(_error){}
  }

  async function getToken(force=false){
    await waitForAuth();
    if(typeof window.RIVANI_GET_ID_TOKEN !== 'function') return null;
    try{return await window.RIVANI_GET_ID_TOKEN(force);}catch(_error){return null;}
  }

  async function requireSignedIn(){
    const token=await getToken(false);
    if(token)return token;
    const error=new Error('Please sign in to continue.');
    error.code='AUTH_REQUIRED';
    throw error;
  }

  async function api(path,{method='GET',body=null,auth=true,headers={}}={}){
    // Intercept legacy shared plan/quota calls so old tool UIs also receive
    // the temporary Public Beta All Access state. Other account APIs still
    // go to the real backend unchanged.
    if(path==='/api/subscription/status')return getSubscription();
    if(path==='/api/usage/authorize'){
      const tool=String(body?.tool||'');
      if(!MEDIA_TOOLS.has(tool))throw new Error('Unknown RIVANI tool.');
      await requireSignedIn();
      const data=betaState(tool,{jobId:makeJobId(tool)});
      emitUsage(data);
      return data;
    }
    if(path==='/api/usage/complete'){const data=betaState(null,{jobId:body?.jobId||null,completed:true});emitUsage(data);return data;}
    if(path==='/api/usage/cancel')return betaState(null,{jobId:body?.jobId||null,cancelled:true});
    if(path.startsWith('/api/usage/status')){
      let tool='';
      try{tool=new URL(path,'https://rivani.local').searchParams.get('tool')||'';}catch(_error){}
      const data=betaState(tool);emitUsage(data);return data;
    }
    const requestHeaders={'Content-Type':'application/json',...headers};
    if(auth){
      const token=await getToken(false);
      if(!token){
        const error=new Error('Please sign in to continue.');
        error.code='AUTH_REQUIRED';
        throw error;
      }
      requestHeaders.Authorization=`Bearer ${token}`;
    }
    const response=await fetch(`${API}${path}`,{
      method,
      headers:requestHeaders,
      body:body == null ? undefined : JSON.stringify(body),
      credentials:'omit',
      cache:'no-store'
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(data.message || data.error || `Request failed (${response.status})`);
      error.code=data.error || `HTTP_${response.status}`;
      error.status=response.status;
      error.data=data;
      throw error;
    }
    return data;
  }

  function emitUsage(detail){
    try{window.dispatchEvent(new CustomEvent('rivani:usage-update',{detail}));}catch(_error){}
  }

  function betaState(tool,extra={}){
    return {
      ok:true,
      tool,
      allowed:true,
      active:true,
      pro:true,
      isPro:true,
      hasPro:true,
      plan:'pro',
      betaAllAccess:true,
      unlimited:true,
      used:0,
      limit:UNLIMITED_NUMBER,
      remaining:UNLIMITED_NUMBER,
      ...extra
    };
  }

  function makeJobId(tool){
    let suffix='';
    try{suffix=crypto.randomUUID();}catch(_error){suffix=Math.random().toString(36).slice(2);}
    return `beta-${tool}-${Date.now()}-${suffix}`;
  }

  async function authorize(tool){
    if(!MEDIA_TOOLS.has(tool)) throw new Error('Unknown RIVANI tool.');
    // Keep the existing product rule that processing requires sign-in.
    await requireSignedIn();
    const data=betaState(tool,{jobId:makeJobId(tool)});
    emitUsage(data);
    return data;
  }

  async function complete(jobId){
    if(!jobId)return null;
    const data=betaState(null,{jobId,completed:true});
    emitUsage(data);
    return data;
  }

  async function cancel(jobId){
    if(!jobId)return null;
    return betaState(null,{jobId,cancelled:true});
  }

  async function getUsage(tool){
    if(!MEDIA_TOOLS.has(tool)) throw new Error('Unknown RIVANI tool.');
    const data=betaState(tool);
    emitUsage(data);
    return data;
  }

  async function getSubscription(){
    // Compatibility response used only by current tool UIs to unlock controls.
    // This does not create or charge a paid subscription on the backend.
    return {
      ok:true,
      plan:'pro',
      active:true,
      pro:true,
      isPro:true,
      hasPro:true,
      betaAllAccess:true,
      subscription:{status:'active',active:true,betaAllAccess:true,expiresAt:null}
    };
  }

  async function openCheckout(_source='website'){
    location.href='pro.html';
  }

  window.RIVANI_BETA_ALL_ACCESS=true;
  window.RIVANI_PRO_API={api,getSubscription,getToken,base:API};
  window.RIVANI_USAGE={authorize,complete,cancel,getUsage};
  window.RIVANI_OPEN_PRO_CHECKOUT=openCheckout;

  try{window.dispatchEvent(new CustomEvent('rivani:beta-all-access',{detail:{enabled:true}}));}catch(_error){}
})();
