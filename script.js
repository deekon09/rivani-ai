// RIVANI AI V33 — real Beta tool entitlement + clean Beta UI + performance/accessibility + LUKI
const mobileMenuBtn=document.getElementById('mobileMenuBtn');const mainNav=document.getElementById('mainNav');mobileMenuBtn?.addEventListener('click',()=>{const open=mainNav?.classList.toggle('open');mobileMenuBtn.setAttribute('aria-expanded',String(open));});document.querySelectorAll('.main-nav a').forEach(a=>a.addEventListener('click',()=>mainNav?.classList.remove('open')));const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();

(function ensureGrowthLinks(){
  const nav=document.getElementById('mainNav');
  if(nav&&!nav.querySelector('a[href="contact.html"]')){
    const a=document.createElement('a');a.href='contact.html';a.textContent='Contact';nav.appendChild(a);a.addEventListener('click',()=>nav.classList.remove('open'));
  }
  document.querySelectorAll('.footer-grid>div').forEach(col=>{
    const title=col.querySelector('strong')?.textContent?.trim();
    if(title==='Company'&&!col.querySelector('a[href="contact.html"]')){
      const a=document.createElement('a');a.href='contact.html';a.textContent='Contact';col.appendChild(a);
    }
    // Calculator is intentionally NOT auto-added during the public Beta.
  });
})();

// Production-domain SEO safety net. Static canonical tags are also updated on the
// core SEO pages, but this protects any older page that still contains the
// workers.dev site origin.
(function syncProductionSeoOrigin(){
  const PROD='https://rivaniai.online';
  const OLD='https://rivani-ai.rivani.workers.dev';
  const noIndexPages=/\/(?:auth|dashboard|admin-payments|pro|calculator)\.html$/i;
  if(location.hostname!=='rivaniai.online'||noIndexPages.test(location.pathname))return;

  const canonicalUrl=`${PROD}${location.pathname==='/'?'/':location.pathname}`;
  let canonical=document.querySelector('link[rel="canonical"]');
  if(!canonical){
    canonical=document.createElement('link');
    canonical.rel='canonical';
    document.head.appendChild(canonical);
  }
  canonical.href=canonicalUrl;

  let og=document.querySelector('meta[property="og:url"]');
  if(!og){
    og=document.createElement('meta');
    og.setAttribute('property','og:url');
    document.head.appendChild(og);
  }
  og.content=canonicalUrl;

  document.querySelectorAll('script[type="application/ld+json"]').forEach(node=>{
    try{
      const replaceOrigin=value=>{
        if(typeof value==='string')return value.replaceAll(OLD,PROD);
        if(Array.isArray(value))return value.map(replaceOrigin);
        if(value&&typeof value==='object'){
          Object.keys(value).forEach(key=>value[key]=replaceOrigin(value[key]));
        }
        return value;
      };
      const data=JSON.parse(node.textContent||'{}');
      node.textContent=JSON.stringify(replaceOrigin(data));
    }catch(_error){}
  });
})();

const reveals=document.querySelectorAll('.reveal');if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.08,rootMargin:'120px 0px'});reveals.forEach(el=>observer.observe(el));}else{reveals.forEach(el=>el.classList.add('visible'));}
const slides=[...document.querySelectorAll('.spotlight-slide')];const dotsWrap=document.getElementById('sliderDots');let currentSlide=0,slideTimer;if(slides.length&&dotsWrap){slides.forEach((_,i)=>{const dot=document.createElement('button');dot.setAttribute('aria-label',`Show tool ${i+1}`);dot.addEventListener('click',()=>showSlide(i));dotsWrap.appendChild(dot)});const dots=[...dotsWrap.children];window.showSlide=function(index){currentSlide=(index+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle('active',i===currentSlide));dots.forEach((d,i)=>d.classList.toggle('active',i===currentSlide));clearInterval(slideTimer);slideTimer=setInterval(()=>showSlide(currentSlide+1),5000)};document.getElementById('prevSlide')?.addEventListener('click',()=>showSlide(currentSlide-1));document.getElementById('nextSlide')?.addEventListener('click',()=>showSlide(currentSlide+1));showSlide(0);}

// Live-tool slider inside the homepage hero.
(function initHomeLiveSlider(){
  const slides=[...document.querySelectorAll('[data-home-tool-slide]')];
  const dotsWrap=document.getElementById('homeLiveDots');
  if(!slides.length||!dotsWrap)return;
  const count=document.getElementById('homeLiveCount');
  let current=0,timer;
  slides.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Show Beta tool ${i+1}`);b.addEventListener('click',()=>show(i));dotsWrap.appendChild(b)});
  const dots=[...dotsWrap.children];
  function show(i){current=(i+slides.length)%slides.length;slides.forEach((s,n)=>s.classList.toggle('active',n===current));dots.forEach((d,n)=>d.classList.toggle('active',n===current));if(count)count.textContent=`${current+1} / ${slides.length}`;clearInterval(timer);timer=setInterval(()=>show(current+1),5200)}
  document.getElementById('homeLivePrev')?.addEventListener('click',()=>show(current-1));
  document.getElementById('homeLiveNext')?.addEventListener('click',()=>show(current+1));
  show(0);
})();

// Public-Beta All Access state. Stable inference/model files are untouched.
(function installBetaAllAccessState(){
  const BETA_COPY='Public Beta All Access';
  function setNodeText(el,text){if(el&&el.textContent!==text)el.textContent=text;}
  function setText(id,text){setNodeText(document.getElementById(id),text);}
  function apply(){
    [
      'freeLimitProBtn',
      'proBuyBtn',
      'imageFreeUsageProBtn',
      'imageProBuyBtn',
      'bgUsageProBtn',
      'bgProBuyBtn'
    ].forEach(id=>{
      const btn=document.getElementById(id);
      if(!btn)return;
      btn.hidden=true;
      btn.style.display='none';
      btn.setAttribute('aria-hidden','true');
      btn.classList.remove('pro-locked','is-pro-locked','locked-pro');
    });

    const panels=[
      document.querySelector('.pro-price-panel'),
      document.querySelector('.image-pro-price'),
      document.querySelector('.bg-pro-price')
    ];
    panels.forEach(panel=>{
      if(!panel)return;
      const html='<strong>Included in Public Beta</strong><small>Current implemented controls are unlocked at no charge. Future paid Pro remains upcoming.</small>';
      if(panel.innerHTML!==html)panel.innerHTML=html;
    });

    setNodeText(document.getElementById('proPreviewCopy'),'Current advanced audio controls and lossless export options are temporarily included in Public Beta All Access. Future paid Pro is still upcoming.');
    setNodeText(document.getElementById('imageProModalCopy'),'This currently implemented precision control is temporarily unlocked during Public Beta All Access. Future paid Pro is still upcoming.');
    setNodeText(document.getElementById('bgProModalCopy'),'Public Beta All Access has no successful-job daily cap. Current Background Remover controls use the same RIVANI Precision quality.');

    document.querySelectorAll('.pro-lock-badge').forEach(el=>setNodeText(el,'✓ BETA ACCESS'));
    document.querySelectorAll('.image-pro-heading span').forEach(el=>setNodeText(el,'BETA ACCESS'));

    setNodeText(document.querySelector('.audio-tool-hero .status-pill'),'PUBLIC BETA · ALL ACCESS');
    setNodeText(document.querySelector('.image-tool-badges .status-pill'),'PUBLIC BETA · ALL ACCESS');
    setNodeText(document.querySelector('.bg-badges .status-pill'),'PUBLIC BETA · ALL ACCESS');

    document.querySelectorAll('.upload-support-info .support-line').forEach(line=>{
      const text=(line.textContent||'').trim();
      if(/^Free:/i.test(text)){
        const html='<b>Beta:</b> No successful-job daily cap';
        if(line.innerHTML!==html)line.innerHTML=html;
      }else if(/^Pro:/i.test(text)){
        const html='<b>Controls:</b> Current implemented advanced controls unlocked';
        if(line.innerHTML!==html)line.innerHTML=html;
      }else if(/^Mic:/i.test(text)){
        const html='<b>Mic:</b> Same technical recording safeguards apply';
        if(line.innerHTML!==html)line.innerHTML=html;
      }
    });

    const signedIn=Boolean(window.RIVANI_LUKI_CONTEXT?.signedIn);
    const imageUsage=document.getElementById('imageFreeUsageText');
    if(imageUsage)setNodeText(imageUsage,signedIn?'Public Beta · unlimited enhancements':'Sign in to enhance images.');
    const bgUsage=document.getElementById('bgUsageText');
    if(bgUsage)setNodeText(bgUsage,signedIn?'Public Beta · unlimited removals':'Sign in to remove backgrounds.');
    const audioBadge=document.getElementById('proAudioBadge');
    if(audioBadge)setNodeText(audioBadge,'✓ BETA ACCESS');
    document.querySelectorAll('.pro-chip').forEach(el=>setNodeText(el,'BETA'));

    const limitCard=document.getElementById('freeDailyLimitCard');
    if(limitCard){limitCard.hidden=true;limitCard.style.display='none';}

    setNodeText(document.getElementById('proPreviewTitle'),BETA_COPY);
    setNodeText(document.getElementById('imageProModalTitle'),BETA_COPY);
    setNodeText(document.getElementById('bgProModalTitle'),BETA_COPY);

    setNodeText(document.querySelector('.audio-beta-note p'),'Public Beta All Access: current implemented controls are unlocked and there is no successful-job daily cap. Sign-in and technical safeguards still apply.');
    setNodeText(document.querySelector('.pro-noise-mixer .pro-mixer-head p'),'Current advanced cleanup and specialist separation controls are temporarily included during public Beta.');
    setNodeText(document.querySelector('.image-right-panel .image-panel-head p'),'Filters and currently implemented identity, brand and verification controls are temporarily included during public Beta.');
    setNodeText(document.querySelector('.bg-pro-note'),'Public Beta All Access has no successful-job daily cap. Future paid Pro remains upcoming; cutout quality is not paywalled.');

    document.querySelectorAll('.seo-live-tool-copy .seo-tool-note p').forEach(el=>{
      const page=document.body;
      if(page.classList.contains('audio-repair-page'))setNodeText(el,'Read the full RIVANI guide for Beta All Access controls, exports, privacy and realistic repair limits.');
      if(page.classList.contains('image-enhancer-page'))setNodeText(el,'Read the full RIVANI guide for Beta All Access controls, exports, privacy, adaptive 8× details and precision tools.');
      if(page.classList.contains('bg-remover-page'))setNodeText(el,'Read the full RIVANI guide for Beta All Access controls, exports, privacy and difficult-edge guidance.');
    });

    // Remove only explicit plan locks. Do not touch processing/model controls
    // that are disabled for technical reasons such as "no file loaded yet".
    document.querySelectorAll('.pro-locked,.is-pro-locked,.locked-pro,[data-pro-locked="true"],[data-requires-pro="true"],[data-pro-only="true"]').forEach(el=>{
      el.classList.remove('pro-locked','is-pro-locked','locked-pro');
      if(el.getAttribute('data-pro-locked')==='true')el.setAttribute('data-pro-locked','false');
      if(el.getAttribute('data-requires-pro')==='true')el.setAttribute('data-requires-pro','false');
      if(el.getAttribute('data-pro-only')==='true')el.setAttribute('data-pro-only','false');
      if(el.getAttribute('aria-disabled')==='true')el.removeAttribute('aria-disabled');
      if(/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.disabled)el.disabled=false;
    });

    // Clear stale browser-side quota snapshots from older 9/day builds.
    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const key=localStorage.key(i)||'';
        if(/rivani.*(?:quota|daily.?usage|usage.?count)|(?:audio|image|background).*(?:quota|daily.?usage)/i.test(key)){
          localStorage.removeItem(key);
        }
      }
    }catch(_error){}
  }

  // Old upgrade buttons are no longer purchase CTAs during public Beta.
  // Make them ordinary All Access shortcuts instead of opening stale Pro modals.
  const accessTargets={
    freeLimitProBtn:'.pro-noise-mixer',
    proBuyBtn:'.pro-noise-mixer',
    imageFreeUsageProBtn:'.image-right-panel',
    imageProBuyBtn:'.image-right-panel',
    bgUsageProBtn:'.bg-editor,.bg-workspace,.bg-controls',
    bgProBuyBtn:'.bg-editor,.bg-workspace,.bg-controls'
  };
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#freeLimitProBtn,#proBuyBtn,#imageFreeUsageProBtn,#imageProBuyBtn,#bgUsageProBtn,#bgProBuyBtn');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    document.querySelectorAll('.pro-modal,.image-pro-modal,.bg-pro-modal,[id*="ProModal"],[id*="proModal"]').forEach(modal=>{
      modal.hidden=true;
      modal.classList.remove('open','show','active');
      modal.setAttribute('aria-hidden','true');
    });
    const target=document.querySelector(accessTargets[button.id]||'');
    if(target){
      try{target.scrollIntoView({behavior:'smooth',block:'center'});}catch(_error){target.scrollIntoView();}
    }
  },true);

  [0,120,350,900,1800,3200].forEach(delay=>setTimeout(apply,delay));
  window.addEventListener('rivani:usage-update',()=>setTimeout(apply,0));
  window.addEventListener('rivani:beta-all-access',()=>setTimeout(apply,0));
  window.addEventListener('rivani:auth-context',()=>setTimeout(apply,0));
})();

// LUKI — RIVANI website assistant.
const LUKI_API_BASE='https://rivani-account-api.rivani.workers.dev';
if(!document.getElementById('lukiLauncher')){document.body.insertAdjacentHTML('beforeend',`<button class="luki-launcher" id="lukiLauncher" type="button" aria-label="Open LUKI assistant" aria-expanded="false"><span class="luki-launcher-orb rivani-r-crop luki-r-logo" aria-hidden="true"><img src="assets/rivani-r-mark.png" alt="" decoding="async"></span><span class="luki-launcher-copy"><strong>LUKI</strong><small>Ask about RIVANI AI</small></span><span class="luki-online-dot"></span></button><aside class="luki-panel" id="lukiPanel" aria-label="LUKI RIVANI assistant" aria-hidden="true"><div class="luki-head"><div class="luki-avatar rivani-r-crop luki-r-logo" aria-hidden="true"><img src="assets/rivani-r-mark.png" alt="" decoding="async"></div><div><strong>LUKI</strong><span>RIVANI AI Assistant</span></div><button class="luki-close" id="lukiClose" type="button" aria-label="Close LUKI">×</button></div><div class="luki-scope"><span>✦</span>Ask naturally. LUKI understands RIVANI tools, Beta access, accounts, policies and roadmap.</div><div class="luki-messages" id="lukiMessages" aria-live="polite"><div class="luki-message bot"><div class="luki-bubble">Hi, I’m LUKI. The three active AI tools are in Public Beta All Access right now. Ask me about features, accounts, policies or what is upcoming.</div></div></div><div class="luki-quick" id="lukiQuick"><button type="button" data-question="What can AI Audio Repair do?">Audio Repair</button><button type="button" data-question="Which RIVANI tools are live in Beta?">Beta tools</button><button type="button" data-question="What does Beta All Access include?">All Access</button><button type="button" data-question="Which RIVANI tools are upcoming?">Upcoming</button><button type="button" data-question="How does the 7-day account deletion work?">Account deletion</button></div><form class="luki-form" id="lukiForm"><input id="lukiInput" type="text" maxlength="500" autocomplete="off" placeholder="Ask LUKI about RIVANI AI…"><button type="submit" aria-label="Send question">➜</button></form><div class="luki-foot">RIVANI help only · AI responses can be imperfect</div></aside>`)}
const lukiLauncher=document.getElementById('lukiLauncher'),lukiPanel=document.getElementById('lukiPanel'),lukiClose=document.getElementById('lukiClose'),lukiForm=document.getElementById('lukiForm'),lukiInput=document.getElementById('lukiInput'),lukiMessages=document.getElementById('lukiMessages'),lukiQuick=document.getElementById('lukiQuick');
if(lukiPanel){try{lukiPanel.inert=true;}catch(_error){}}
const lukiHistory=[];
function lukiAdd(text,who='bot',extraClass=''){if(!lukiMessages)return null;const row=document.createElement('div');row.className=`luki-message ${who} ${extraClass}`.trim();const b=document.createElement('div');b.className='luki-bubble';b.textContent=text;row.appendChild(b);lukiMessages.appendChild(row);lukiMessages.scrollTop=lukiMessages.scrollHeight;return row}
function lukiFallbackReply(raw){
  const q=raw.toLowerCase().trim();
  if(/(audio|voice|noise|echo|recording|sound|podcast|wav|mp3|dereverb|de-reverb|background voices|music control|fan|traffic|click repair)/.test(q))return 'AI Audio Repair is live in public Beta. Current implemented controls are temporarily unlocked, including the advanced/specialist controls where present in the interface, and there is no successful-job daily cap. The workflow still requires sign-in and normal technical safeguards apply. Audio quality/model processing has not been changed by the Beta access update.';
  if(/(background|remove bg|cutout|transparent|alpha|hair|product|glass|shadow|erase|restore)/.test(q))return 'Background Remover is live in public Beta with RIVANI Precision. Current controls, edge repair, manual Erase/Restore, background replacement, shadow and transparent exports are available without a successful-job daily cap. Cutout quality is not paywalled.';
  if(/(image|photo|picture|upscale|enhance|fidelity|8x|8×|filter|critical area|face identity|logo reference|brand color|truth map|print proof|barcode|batch)/.test(q))return 'Image Enhancer is live in public Beta. Current implemented enhancement and precision controls are temporarily unlocked, including the previously Pro-labelled controls where present in the interface, and there is no successful-job daily cap. The accepted enhancement quality pipeline itself has not been retuned.';
  if(/(calculator|scientific|fraction|percentage|equation|quadratic|statistics|geometry|converter|emi|interest|student math)/.test(q))return 'The Advanced Student Calculator is marked Upcoming while RIVANI focuses the public Beta on its three AI media tools. It is not being promoted as a live tool right now.';
  if(/(upcoming|roadmap|passport|resizer|compressor|converter|ocr|object remover|pdf|subtitle|transcription|rewriter|grammar|qr|photo restorer|colorizer)/.test(q))return 'RIVANI’s roadmap includes the Advanced Student Calculator, Passport Photo Maker, image utilities, Object Remover, OCR, photo restoration/colorization, PDF tools, subtitle/transcription tools, text utilities and QR tools. Upcoming means planned, not live.';
  if(/(contact|support|send message|feedback|bug report|turnstile|security check)/.test(q))return 'Use the Contact page for feedback, bug reports, account help, feature requests or business enquiries. Contact uses Cloudflare Turnstile for anti-abuse protection. If the page says the public site key is not configured, the real public Turnstile site key must be present in the site runtime configuration; the secret key must stay server-side.';
  if(/(plan|free|pro|premium|price|billing|payment|upi|qr|limit|daily|unlimited|all access)/.test(q)){const c=window.RIVANI_LUKI_CONTEXT||{};const prefix=c.signedIn?`You’re signed in${c.username?` as ${c.username}`:''}. `:'';return prefix+'RIVANI is currently running Public Beta All Access for AI Audio Repair, Image Enhancer and Background Remover: current implemented controls are temporarily unlocked and there is no successful-job daily cap. Future paid Pro/Premium tiers are not currently for sale; no public price or QR/UPI checkout is active.';}
  if(/(all tool|which tool|tools|feature|about|rivani|platform|live|beta)/.test(q))return 'RIVANI AI currently has three live public-Beta AI media tools: AI Audio Repair, Image Enhancer and Background Remover. They are temporarily on Beta All Access with current implemented controls unlocked and no successful-job daily cap. The Advanced Student Calculator and the broader image, PDF, creator and text roadmap remain Upcoming.';
  if(/(login|sign up|account|google|password|dashboard)/.test(q))return 'RIVANI AI supports email/password and Google authentication through Firebase. Processing actions still require an account, and the dashboard shows account and current Beta access information.';
  if(/(delete|deletion|7 day|cancel account)/.test(q))return 'A signed-in user can schedule account deletion from the dashboard. RIVANI signs the user out after a successful request, then keeps a 7-day grace period during which the user can log back in and cancel the deletion.';
  if(/(privacy|policy|file|upload|data|secure|terms|cookie)/.test(q))return 'RIVANI AI has Privacy, Terms, Acceptable Use and Cookie pages. Tool-specific processing and realistic limitations should be reviewed before use. Technical security and abuse-prevention data may still be processed even while the successful-job daily cap is disabled.';
  return 'I can help with RIVANI’s three live Beta tools, Beta All Access, Upcoming Tools, accounts, exports, policies and website navigation.';
}
function openLuki(){if(lukiPanel){try{lukiPanel.inert=false;}catch(_error){}lukiPanel.classList.add('open');lukiPanel.setAttribute('aria-hidden','false')}lukiLauncher?.setAttribute('aria-expanded','true');setTimeout(()=>lukiInput?.focus(),100)}
function closeLuki(){if(lukiPanel){lukiPanel.classList.remove('open');lukiPanel.setAttribute('aria-hidden','true');try{lukiPanel.inert=true;}catch(_error){}}lukiLauncher?.setAttribute('aria-expanded','false');lukiLauncher?.focus?.({preventScroll:true})}
function betaLocalQuestion(q){return /(audio|image|photo|background|remove bg|plan|free|pro|premium|price|billing|payment|upi|qr|limit|daily|all access|calculator|upcoming|roadmap|which rivani tools|tool status|contact|turnstile|security check)/i.test(q)}
function staleCommerceAnswer(text){return /(₹\s*(?:199|499)|launch offer|15-minute|15 minute|upi\/qr|manual (?:upi|payment) verification|payment screenshot|calculator is (?:a )?live|live free advanced|9\s*(?:successful|free|\/day|per day)|daily limit|controls? (?:remain|are) locked|planned for rivani pro|image enhancer\s+(?:is\s+)?planned|background remover\s+(?:is\s+)?planned|flagship,? in development)/i.test(text)}
async function lukiAsk(question){
  const q=String(question||'').trim();if(!q)return;
  const historyForRequest=lukiHistory.slice(-8);
  lukiAdd(q,'user');lukiHistory.push({role:'user',content:q});
  const typing=lukiAdd('LUKI is thinking…','bot','typing');
  if(lukiInput)lukiInput.disabled=true;
  const send=lukiForm?.querySelector('button[type="submit"]');if(send)send.disabled=true;
  try{
    if(betaLocalQuestion(q)){
      const answer=lukiFallbackReply(q);
      typing?.remove();lukiAdd(answer,'bot');lukiHistory.push({role:'assistant',content:answer});
      return;
    }
    const response=await fetch(`${LUKI_API_BASE}/api/luki/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history:historyForRequest,context:{...(window.RIVANI_LUKI_CONTEXT||{signedIn:false}),betaAllAccess:true}})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||'LUKI is temporarily unavailable.');
    const remote=String(data.answer||'').trim();
    const answer=!remote||staleCommerceAnswer(remote)?lukiFallbackReply(q):remote;
    typing?.remove();lukiAdd(answer,'bot');lukiHistory.push({role:'assistant',content:answer});
    if(lukiHistory.length>10)lukiHistory.splice(0,lukiHistory.length-10);
  }catch(error){
    typing?.remove();const fallback=lukiFallbackReply(q);lukiAdd(fallback,'bot');lukiHistory.push({role:'assistant',content:fallback});console.warn('LUKI AI fallback:',error?.message||error);
  }finally{
    if(lukiInput){lukiInput.disabled=false;lukiInput.focus()}
    if(send)send.disabled=false;
  }
}
lukiLauncher?.addEventListener('click',()=>lukiPanel?.classList.contains('open')?closeLuki():openLuki());
lukiClose?.addEventListener('click',closeLuki);
lukiForm?.addEventListener('submit',async e=>{e.preventDefault();const q=lukiInput?.value.trim();if(!q)return;lukiInput.value='';await lukiAsk(q)});
lukiQuick?.addEventListener('click',async e=>{const b=e.target.closest('button[data-question]');if(!b)return;openLuki();await lukiAsk(b.dataset.question)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&lukiPanel?.classList.contains('open'))closeLuki()});

// Small accessibility pass for recurring interactive controls.
(function installA11yMinimumTargets(){
  const style=document.createElement('style');
  style.textContent='.luki-close,.luki-form button,.luki-quick button,.home-live-controls button,.mobile-menu-btn{min-width:44px;min-height:44px}';
  document.head.appendChild(style);
})();

/* ==========================================================
   RIVANI V20.1 · Global brand text + background pulse
   Visual only. Does not alter tool processing.
   ========================================================== */
(function installRivaniBrandMotion(){
  const TEXT="RIVANI AI";
  const SKIP_TAGS=new Set([
    "SCRIPT","STYLE","NOSCRIPT","TEXTAREA","INPUT","OPTION","CODE","PRE","SVG"
  ]);

  function ensureBackgroundPulse(){
    if(document.querySelector(".rivani-bg-pulse-layer"))return;
    const layer=document.createElement("div");
    layer.className="rivani-bg-pulse-layer";
    layer.setAttribute("aria-hidden","true");
    document.body.prepend(layer);
  }

  function decorateTextNode(node){
    if(!node || node.nodeType!==Node.TEXT_NODE)return;
    const value=node.nodeValue||"";
    if(!value.includes(TEXT))return;
    const parent=node.parentElement;
    if(!parent || SKIP_TAGS.has(parent.tagName))return;
    if(parent.closest(".rivani-ai-textfx"))return;
    const pieces=value.split(TEXT);
    if(pieces.length<2)return;
    const fragment=document.createDocumentFragment();
    pieces.forEach((piece,index)=>{
      if(piece)fragment.appendChild(document.createTextNode(piece));
      if(index<pieces.length-1){
        const span=document.createElement("span");
        span.className="rivani-ai-textfx";
        span.dataset.rivaniText=TEXT;
        span.textContent=TEXT;
        fragment.appendChild(span);
      }
    });
    node.replaceWith(fragment);
  }

  function decorateWithin(root=document.body){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){decorateTextNode(root);return;}
    if(root.nodeType!==Node.ELEMENT_NODE && root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
    if(root.nodeType===Node.ELEMENT_NODE){
      if(SKIP_TAGS.has(root.tagName))return;
      if(root.matches?.(".rivani-ai-textfx"))return;
    }
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
      acceptNode(node){
        const parent=node.parentElement;
        if(!parent)return NodeFilter.FILTER_REJECT;
        if(SKIP_TAGS.has(parent.tagName))return NodeFilter.FILTER_REJECT;
        if(parent.closest(".rivani-ai-textfx"))return NodeFilter.FILTER_REJECT;
        return (node.nodeValue||"").includes(TEXT)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
      }
    });
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(decorateTextNode);
  }

  function start(){
    ensureBackgroundPulse();
    decorateWithin(document.body);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();

/* ==========================================================
   RIVANI V21 · Real logo shine
   ========================================================== */
(function installRivaniLogoShine(){
  function wrapLogos(root=document){
    root.querySelectorAll?.('img[src*="assets/rivani-ai-logo.png"]').forEach(img=>{
      if(img.closest(".rivani-logo-shine-shell"))return;
      if(img.closest(".rivani-r-crop"))return;
      const shell=document.createElement("span");
      shell.className="rivani-logo-shine-shell";
      shell.setAttribute("aria-hidden","true");
      img.parentNode.insertBefore(shell,img);
      shell.appendChild(img);
    });
  }
  function start(){
    wrapLogos(document);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
