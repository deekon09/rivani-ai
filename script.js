// RIVANI AI V31 — public Beta + Pro coming soon + LUKI
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

const reveals=document.querySelectorAll('.reveal');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('visible')}),{threshold:.1});reveals.forEach(el=>observer.observe(el));
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

// Public-Beta commerce state. This intentionally does NOT change inference,
// model URLs, quality or server-authoritative usage accounting.
(function installBetaCommerceState(){
  function setNodeText(el,text){
    if(el&&el.textContent!==text)el.textContent=text;
  }
  function setText(id,text){
    setNodeText(document.getElementById(id),text);
  }
  function apply(){
    // Buttons can still open pro.html, but that page is now a non-purchasable
    // Coming Soon page with no QR/payment scripts.
    [
      ['freeLimitProBtn','Pro · Coming Soon'],
      ['proBuyBtn','Pro · Coming Soon'],
      ['imageFreeUsageProBtn','Pro · Coming Soon'],
      ['imageProBuyBtn','Pro · Coming Soon'],
      ['bgUsageProBtn','Pro · Coming Soon'],
      ['bgProBuyBtn','Pro · Coming Soon']
    ].forEach(([id,text])=>setText(id,text));

    const audioPrice=document.querySelector('.pro-price-panel');
    if(audioPrice&&/₹|LAUNCH OFFER|month/i.test(audioPrice.textContent||'')){
      audioPrice.innerHTML='<strong>Pro · Coming Soon</strong><small>Pricing and payments are paused during the RIVANI public Beta.</small>';
    }
    const imagePrice=document.querySelector('.image-pro-price');
    if(imagePrice&&/₹|LAUNCH OFFER|month/i.test(imagePrice.textContent||'')){
      imagePrice.innerHTML='<strong>Pro · Coming Soon</strong><small>Pricing and payments are paused during the RIVANI public Beta.</small>';
    }
    const bgPrice=document.querySelector('.bg-pro-price');
    if(bgPrice&&/₹|LAUNCH OFFER|month/i.test(bgPrice.textContent||'')){
      bgPrice.innerHTML='<strong>Pro · Coming Soon</strong><small>Pricing and payments are paused during the RIVANI public Beta.</small>';
    }

    const audioCopy=document.getElementById('proPreviewCopy');
    setNodeText(audioCopy,'Advanced audio controls and lossless WAV are planned for RIVANI Pro. Pro is not for sale during the public Beta.');
    const imageCopy=document.getElementById('imageProModalCopy');
    setNodeText(imageCopy,'This precision control is planned for RIVANI Pro. Pro is coming soon and cannot be purchased during the public Beta.');
    const bgCopy=document.getElementById('bgProModalCopy');
    setNodeText(bgCopy,'Free Beta includes 9 successful removals per day with the same RIVANI Precision cutout quality. Pro is coming soon.');

    document.querySelectorAll('.pro-lock-badge').forEach(el=>setNodeText(el,'🔒 PRO · SOON'));

    // Tool-page Beta labels and public-plan copy. Runtime/inference code is untouched.
    const audioStatus=document.querySelector('.audio-tool-hero .status-pill');
    setNodeText(audioStatus,'PUBLIC BETA · AI CLEAR VOICE');
    const imageStatus=document.querySelector('.image-tool-badges .status-pill');
    setNodeText(imageStatus,'PUBLIC BETA · AI POWERED');
    const bgStatus=document.querySelector('.bg-badges .status-pill');
    setNodeText(bgStatus,'PUBLIC BETA · FREE');

    document.querySelectorAll('.upload-support-info .support-line').forEach(line=>{
      if(/^Pro:/i.test((line.textContent||'').trim())){
        const html='<b>Pro:</b> Coming Soon · advanced controls remain locked during Beta';
        if(line.innerHTML!==html)line.innerHTML=html;
      }
    });

    const limitCard=document.getElementById('freeDailyLimitCard');
    if(limitCard){
      const h=limitCard.querySelector('h3');
      const p=limitCard.querySelector('p');
      const meta=limitCard.querySelector('.free-limit-lock-meta');
      setNodeText(h,'Your 9 free enhancements are used for today.');
      setNodeText(p,'Free Beta daily limit is over. Try again tomorrow. RIVANI Pro is coming soon.');
      const metaHtml='<span><b>RIVANI PRO</b> Coming Soon</span><span>Higher-volume workflows and advanced controls are planned</span>';
      if(meta&&meta.innerHTML!==metaHtml)meta.innerHTML=metaHtml;
    }

    const audioProHead=document.getElementById('proPreviewTitle');
    setNodeText(audioProHead,'RIVANI Pro · Coming Soon');
    const imageProHead=document.getElementById('imageProModalTitle');
    setNodeText(imageProHead,'RIVANI Pro · Coming Soon');
    const bgProHead=document.getElementById('bgProModalTitle');
    setNodeText(bgProHead,'RIVANI Pro · Coming Soon');

    const audioPlanNote=document.querySelector('.audio-beta-note p');
    setNodeText(audioPlanNote,'WAV, MP3, M4A, AAC, OGG and FLAC · Free Beta: 30 minutes, 500 MB and 9 successful enhancements per day. Pro is coming soon.');
    const proMixerCopy=document.querySelector('.pro-noise-mixer .pro-mixer-head p');
    setNodeText(proMixerCopy,'Advanced cleanup and specialist separation controls are planned for RIVANI Pro.');
    const imageRightCopy=document.querySelector('.image-right-panel .image-panel-head p');
    setNodeText(imageRightCopy,'Filters are Free during Beta. Identity, brand and verification controls are planned for RIVANI Pro.');
    const bgProNote=document.querySelector('.bg-pro-note');
    setNodeText(bgProNote,'Pro is coming soon and is expected to focus on higher-volume workflow benefits. Cutout quality stays the same on Free Beta.');

    document.querySelectorAll('.image-pro-heading span,.image-pro-tool em').forEach(el=>setNodeText(el,'PRO · SOON'));

    document.querySelectorAll('.seo-live-tool-copy .seo-tool-note p').forEach(el=>{
      const page=document.body;
      if(page.classList.contains('audio-repair-page'))setNodeText(el,'Read the full RIVANI guide for Beta controls, Free limits, exports, privacy, realistic quality limits and future Pro controls.');
      if(page.classList.contains('image-enhancer-page'))setNodeText(el,'Read the full RIVANI guide for Beta controls, Free limits, exports, privacy, adaptive 8× details and future Pro precision tools.');
      if(page.classList.contains('bg-remover-page'))setNodeText(el,'Read the full RIVANI guide for Beta controls, Free limits, exports, privacy, difficult-edge guidance and future Pro workflow benefits.');
    });
  }
  apply();
  const mo=new MutationObserver(()=>apply());
  mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();

// LUKI — RIVANI website assistant.
const LUKI_API_BASE='https://rivani-account-api.rivani.workers.dev';
if(!document.getElementById('lukiLauncher')){document.body.insertAdjacentHTML('beforeend',`<button class="luki-launcher" id="lukiLauncher" type="button" aria-label="Open LUKI assistant" aria-expanded="false"><span class="luki-launcher-orb rivani-r-crop luki-r-logo" aria-hidden="true"><img src="assets/rivani-ai-logo.png" alt=""></span><span class="luki-launcher-copy"><strong>LUKI</strong><small>Ask about RIVANI AI</small></span><span class="luki-online-dot"></span></button><aside class="luki-panel" id="lukiPanel" aria-label="LUKI RIVANI assistant" aria-hidden="true"><div class="luki-head"><div class="luki-avatar rivani-r-crop luki-r-logo" aria-hidden="true"><img src="assets/rivani-ai-logo.png" alt=""></div><div><strong>LUKI</strong><span>RIVANI AI Assistant</span></div><button class="luki-close" id="lukiClose" type="button" aria-label="Close LUKI">×</button></div><div class="luki-scope"><span>✦</span>Ask naturally. LUKI understands questions about RIVANI tools, accounts, plans, policies and website features.</div><div class="luki-messages" id="lukiMessages" aria-live="polite"><div class="luki-message bot"><div class="luki-bubble">Hi, I’m LUKI. Ask me anything about RIVANI AI — tools, your account, plans, policies, or how a feature works.</div></div></div><div class="luki-quick" id="lukiQuick"><button type="button" data-question="What can AI Audio Repair do?">Audio Repair</button><button type="button" data-question="Which RIVANI tools are in Beta?">Beta tools</button><button type="button" data-question="Which RIVANI tools are upcoming?">Upcoming</button><button type="button" data-question="How does the 7-day account deletion work?">Account deletion</button><button type="button" data-question="What is the Free Beta plan?">Plans</button></div><form class="luki-form" id="lukiForm"><input id="lukiInput" type="text" maxlength="500" autocomplete="off" placeholder="Ask LUKI about RIVANI AI…"><button type="submit" aria-label="Send question">➜</button></form><div class="luki-foot">RIVANI help only · AI responses can be imperfect</div></aside>`)}
const lukiLauncher=document.getElementById('lukiLauncher'),lukiPanel=document.getElementById('lukiPanel'),lukiClose=document.getElementById('lukiClose'),lukiForm=document.getElementById('lukiForm'),lukiInput=document.getElementById('lukiInput'),lukiMessages=document.getElementById('lukiMessages'),lukiQuick=document.getElementById('lukiQuick');
const lukiHistory=[];
function lukiAdd(text,who='bot',extraClass=''){if(!lukiMessages)return null;const row=document.createElement('div');row.className=`luki-message ${who} ${extraClass}`.trim();const b=document.createElement('div');b.className='luki-bubble';b.textContent=text;row.appendChild(b);lukiMessages.appendChild(row);lukiMessages.scrollTop=lukiMessages.scrollHeight;return row}
function lukiFallbackReply(raw){
  const q=raw.toLowerCase().trim();
  if(/(audio|voice|noise|echo|recording|sound|podcast|wav|mp3|dereverb|background voices|music control)/.test(q))return 'AI Audio Repair is available in public Beta. Free accounts get 9 successful repairs per day, up to 30 minutes and 500 MB per file, with MP3 export. Clear Voice runs in the browser and includes scan, repair strength, microphone recording and Before/After playback. Advanced specialist controls and lossless WAV are planned for RIVANI Pro, which is coming soon and is not currently for sale.';
  if(/(background|remove bg|cutout|transparent|alpha|hair|product|glass)/.test(q))return 'Background Remover is available in public Beta. RIVANI Precision supports Hair/Product/Glass/Logo presets, edge cleanup, manual Erase/Restore, background replacement, shadow and transparent exports. Free Beta gets 9 successful removals per day with the same cutout quality. Pro is coming soon; pricing and payments are not active.';
  if(/(image|photo|picture|upscale|enhance|fidelity|8x|8×|filter)/.test(q))return 'Image Enhancer is available in public Beta. It supports 1×, 2×, 4× and adaptive 8× output, AI Strength, Clarity, Sharpness, Studio Finish, Smart Scan, Fidelity Guard, filters and Before/After comparison. Free Beta gets 9 successful enhancements per day. Precision Pro controls are planned for later; Pro is not currently purchasable.';
  if(/(calculator|scientific|fraction|percentage|equation|quadratic|statistics|geometry|converter|emi|interest|student math)/.test(q))return 'The Advanced Student Calculator has been moved to Upcoming while RIVANI focuses the public Beta on its three AI media tools. It is not being promoted as a live tool right now.';
  if(/(upcoming|roadmap|passport|resizer|compressor|converter|ocr|object remover|pdf|subtitle|transcription|rewriter|grammar|qr|photo restorer|colorizer)/.test(q))return 'RIVANI’s roadmap includes the Advanced Student Calculator, Passport Photo Maker, image resize/compress/convert tools, Object Remover, OCR, photo restoration/colorization, PDF tools, subtitle/transcription tools, text utilities and QR tools. Upcoming means planned, not live.';
  if(/(contact|support|send message|feedback|bug report)/.test(q))return 'Use the Contact page to send RIVANI tool feedback, bug reports, account help, feature requests or business enquiries. Do not send passwords, private keys or banking secrets.';
  if(/(plan|free|pro|premium|price|billing|payment|upi|qr|limit|9 per day|9\/day)/.test(q)){const c=window.RIVANI_LUKI_CONTEXT||{};const prefix=c.signedIn?`You’re currently on the ${c.plan||'Free'} plan${c.username?`, ${c.username}`:''}. `:'';return prefix+'RIVANI is in public Beta. The three active AI media tools each use a 9-successful-jobs-per-day Free limit. Pro and Premium are upcoming tiers; public pricing is not finalized and the QR/UPI purchase flow is disabled during Beta.';}
  if(/(all tool|which tool|tools|feature|about|rivani|platform|live|beta)/.test(q))return 'RIVANI AI currently has three public-Beta AI media tools: AI Audio Repair, Image Enhancer and Background Remover. The Advanced Student Calculator is now marked Upcoming, together with the broader image, PDF, audio/video and text roadmap. Pro is also coming later and is not currently for sale.';
  if(/(login|sign up|account|google|password|dashboard)/.test(q))return 'RIVANI AI supports email/password and Google authentication through Firebase. Processing actions require an account, and the dashboard shows account and plan information.';
  if(/(delete|deletion|7 day|cancel account)/.test(q))return 'A signed-in user can schedule account deletion from the dashboard. RIVANI signs the user out after a successful request, then keeps a 7-day grace period during which the user can log back in and cancel the deletion.';
  if(/(privacy|policy|file|upload|data|secure|terms|cookie)/.test(q))return 'RIVANI AI has Privacy, Terms, Acceptable Use and Cookie pages. The current Audio Repair, Image Enhancer and Background Remover workflows process the selected media in the browser; model weights may be downloaded to the device and cached.';
  return 'I can help with the RIVANI public-Beta tools, Upcoming Tools, accounts, Free limits, future Pro status, exports, policies and website navigation.';
}
function openLuki(){lukiPanel?.classList.add('open');lukiPanel?.setAttribute('aria-hidden','false');lukiLauncher?.setAttribute('aria-expanded','true');setTimeout(()=>lukiInput?.focus(),100)}
function closeLuki(){lukiPanel?.classList.remove('open');lukiPanel?.setAttribute('aria-hidden','true');lukiLauncher?.setAttribute('aria-expanded','false')}
function betaLocalQuestion(q){return /(plan|free|pro|premium|price|billing|payment|upi|qr|calculator|upcoming|roadmap|which rivani tools|tool status)/i.test(q)}
function staleCommerceAnswer(text){return /(₹\s*(?:199|499)|launch offer|15-minute|15 minute|upi\/qr|manual (?:upi|payment) verification|payment screenshot|calculator is (?:a )?live|live free advanced)/i.test(text)}
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
    const response=await fetch(`${LUKI_API_BASE}/api/luki/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history:historyForRequest,context:window.RIVANI_LUKI_CONTEXT||{signedIn:false}})});
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
lukiLauncher?.addEventListener('click',()=>lukiPanel?.classList.contains('open')?closeLuki():openLuki());lukiClose?.addEventListener('click',closeLuki);lukiForm?.addEventListener('submit',async e=>{e.preventDefault();const q=lukiInput?.value.trim();if(!q)return;lukiInput.value='';await lukiAsk(q)});lukiQuick?.addEventListener('click',async e=>{const b=e.target.closest('button[data-question]');if(!b)return;openLuki();await lukiAsk(b.dataset.question)});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLuki()});

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
    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        if(mutation.type==="characterData"){decorateTextNode(mutation.target);continue;}
        mutation.addedNodes.forEach(node=>{
          if(node.nodeType===Node.TEXT_NODE)decorateTextNode(node);
          else if(node.nodeType===Node.ELEMENT_NODE)decorateWithin(node);
        });
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
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
    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        mutation.addedNodes.forEach(node=>{
          if(node.nodeType!==Node.ELEMENT_NODE)return;
          if(node.matches?.('img[src*="assets/rivani-ai-logo.png"]'))wrapLogos(node.parentElement||document);
          else wrapLogos(node);
        });
      }
    });
    observer.observe(document.body,{subtree:true,childList:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
