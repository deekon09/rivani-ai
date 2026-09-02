// RIVANI AI V31 — shared usage client + Pro Coming Soon routing
(() => {
  'use strict';
  const API = 'https://rivani-account-api.rivani.workers.dev';
  const MEDIA_TOOLS = new Set(['audio-repair','image-enhancer','background-remover']);

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

  async function api(path,{method='GET',body=null,auth=true,headers={}}={}){
    const requestHeaders = {'Content-Type':'application/json',...headers};
    if(auth){
      const token = await getToken(false);
      if(!token){
        const error = new Error('Please sign in to continue.');
        error.code = 'AUTH_REQUIRED';
        throw error;
      }
      requestHeaders.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${API}${path}`,{
      method,
      headers:requestHeaders,
      body:body == null ? undefined : JSON.stringify(body),
      credentials:'omit',
      cache:'no-store'
    });
    const data = await response.json().catch(()=>({}));
    if(!response.ok){
      const error = new Error(data.message || data.error || `Request failed (${response.status})`);
      error.code = data.error || `HTTP_${response.status}`;
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function emitUsage(detail){
    try{window.dispatchEvent(new CustomEvent('rivani:usage-update',{detail}));}catch(_error){}
  }

  async function authorize(tool){
    if(!MEDIA_TOOLS.has(tool)) throw new Error('Unknown RIVANI tool.');
    const data = await api('/api/usage/authorize',{method:'POST',body:{tool}});
    emitUsage({tool,...data});
    return data;
  }

  async function complete(jobId){
    if(!jobId) return null;
    const data = await api('/api/usage/complete',{method:'POST',body:{jobId}});
    emitUsage(data);
    return data;
  }

  async function cancel(jobId){
    if(!jobId) return null;
    try{return await api('/api/usage/cancel',{method:'POST',body:{jobId}});}
    catch(_error){return null;}
  }

  async function getUsage(tool){
    if(!MEDIA_TOOLS.has(tool)) throw new Error('Unknown RIVANI tool.');
    const data = await api(`/api/usage/status?tool=${encodeURIComponent(tool)}`);
    emitUsage({tool,...data});
    return data;
  }

  async function getSubscription(){
    return api('/api/subscription/status');
  }

  // Public purchasing is paused during Beta. Keep every existing Pro button
  // functional by routing it to the non-purchasable Coming Soon page.
  async function openCheckout(_source='website'){
    location.href='pro.html';
  }

  window.RIVANI_PRO_API = {api,getSubscription,getToken,base:API};
  window.RIVANI_USAGE = {authorize,complete,cancel,getUsage};
  window.RIVANI_OPEN_PRO_CHECKOUT = openCheckout;
})();
