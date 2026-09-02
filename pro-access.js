// RIVANI AI V32.1 — Public Beta unlimited-access compatibility layer
// Stable AI inference/model files are intentionally untouched.
(() => {
  'use strict';
  const API = 'https://rivani-account-api.rivani.workers.dev';
  const MEDIA_TOOLS = new Set(['audio-repair','image-enhancer','background-remover']);
  const UNLIMITED_NUMBER = 999999999;
  const nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;

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
    const response=await nativeFetch(`${API}${path}`,{
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
      dailyLimit:UNLIMITED_NUMBER,
      daily_limit:UNLIMITED_NUMBER,
      freeLimit:UNLIMITED_NUMBER,
      free_limit:UNLIMITED_NUMBER,
      usedToday:0,
      used_today:0,
      dailyUsage:0,
      daily_usage:0,
      usageCount:0,
      usage_count:0,
      successfulJobs:0,
      successful_jobs:0,
      jobsUsed:0,
      jobs_used:0,
      jobsRemaining:UNLIMITED_NUMBER,
      jobs_remaining:UNLIMITED_NUMBER,
      remainingJobs:UNLIMITED_NUMBER,
      remaining_jobs:UNLIMITED_NUMBER,
      quotaExceeded:false,
      quota_exceeded:false,
      locked:false,
      canProcess:true,
      can_process:true,
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

  function requestUrl(input){
    try{
      if(typeof input==='string')return input;
      if(input instanceof URL)return input.href;
      if(input && typeof input.url==='string')return input.url;
    }catch(_error){}
    return '';
  }

  async function readRequestBody(input,init){
    try{
      if(init && typeof init.body==='string')return JSON.parse(init.body);
      if(init && init.body && typeof init.body==='object' && !(init.body instanceof FormData))return init.body;
      if(typeof Request!=='undefined' && input instanceof Request){
        const clone=input.clone();
        const type=(clone.headers.get('content-type')||'').toLowerCase();
        if(type.includes('application/json'))return await clone.json();
      }
    }catch(_error){}
    return {};
  }

  function betaJsonResponse(data,status=200){
    return new Response(JSON.stringify(data),{
      status,
      headers:{
        'content-type':'application/json; charset=UTF-8',
        'cache-control':'no-store'
      }
    });
  }

  async function betaFetch(input,init){
    const raw=requestUrl(input);
    let url;
    try{url=new URL(raw,location.href);}catch(_error){return nativeFetch(input,init);}
    let apiOrigin='';
    try{apiOrigin=new URL(API).origin;}catch(_error){}
    if(url.origin!==apiOrigin)return nativeFetch(input,init);

    const path=url.pathname;
    if(path==='/api/subscription/status'){
      return betaJsonResponse(await getSubscription());
    }

    // Cover every legacy/new quota route under /api/usage/* so an older tool
    // script cannot bypass the Public Beta All Access compatibility layer.
    if(path.startsWith('/api/usage/')){
      try{
        await requireSignedIn();
      }catch(error){
        return betaJsonResponse({
          ok:false,
          error:'AUTH_REQUIRED',
          message:error?.message||'Please sign in to continue.'
        },401);
      }

      const body=await readRequestBody(input,init);
      let tool=String(body?.tool||url.searchParams.get('tool')||'');
      if(tool && !MEDIA_TOOLS.has(tool)){
        // Some historical callers used aliases. Map only obvious RIVANI aliases.
        const alias=tool.toLowerCase();
        if(alias.includes('audio'))tool='audio-repair';
        else if(alias.includes('enhanc')||alias.includes('image'))tool='image-enhancer';
        else if(alias.includes('background')||alias.includes('remove'))tool='background-remover';
      }

      const jobId=body?.jobId||body?.job_id||url.searchParams.get('jobId')||url.searchParams.get('job_id')||makeJobId(tool||'tool');
      const data=betaState(MEDIA_TOOLS.has(tool)?tool:null,{
        jobId,
        reservationId:jobId,
        reservation_id:jobId,
        completed:/complete|success|commit/i.test(path),
        cancelled:/cancel|release/i.test(path)
      });
      emitUsage(data);
      return betaJsonResponse(data);
    }

    return nativeFetch(input,init);
  }

  if(nativeFetch){
    window.fetch=betaFetch;
  }

  // Compatibility flags used by historical tool UI gates.
  window.RIVANI_BETA_ALL_ACCESS=true;
  window.RIVANI_UNLIMITED_ACCESS=true;
  window.RIVANI_PRO_ACTIVE=true;
  window.RIVANI_IS_PRO=true;
  window.RIVANI_PLAN='beta-all-access';
  window.RIVANI_PRO_API={api,getSubscription,getToken,base:API};
  window.RIVANI_USAGE={authorize,complete,cancel,getUsage};
  window.RIVANI_OPEN_PRO_CHECKOUT=openCheckout;

  try{window.dispatchEvent(new CustomEvent('rivani:beta-all-access',{detail:{enabled:true}}));}catch(_error){}
})();
