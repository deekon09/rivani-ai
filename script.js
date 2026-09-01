// RIVANI AI frontend v30 — secure launch + ₹199 Pro offer + LUKI
const mobileMenuBtn=document.getElementById('mobileMenuBtn');const mainNav=document.getElementById('mainNav');mobileMenuBtn?.addEventListener('click',()=>{const open=mainNav?.classList.toggle('open');mobileMenuBtn.setAttribute('aria-expanded',String(open));});document.querySelectorAll('.main-nav a').forEach(a=>a.addEventListener('click',()=>mainNav?.classList.remove('open')));const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
(function ensureGrowthLinks(){const nav=document.getElementById('mainNav');if(nav&&!nav.querySelector('a[href="contact.html"]')){const a=document.createElement('a');a.href='contact.html';a.textContent='Contact';nav.appendChild(a);a.addEventListener('click',()=>nav.classList.remove('open'))}document.querySelectorAll('.footer-grid>div').forEach(col=>{const title=col.querySelector('strong')?.textContent?.trim();if(title==='Company'&&!col.querySelector('a[href="contact.html"]')){const a=document.createElement('a');a.href='contact.html';a.textContent='Contact';col.appendChild(a)}if(title==='Platform'&&!col.querySelector('a[href="calculator.html"]')){const a=document.createElement('a');a.href='calculator.html';a.textContent='Calculator';col.appendChild(a)}})})();

// RIVANI V30 — site-wide launch-offer animation. Visual only; checkout remains server verified.
(function installLaunchOffer(){
  if(document.querySelector('.rivani-launch-offer'))return;
  if(/admin-payments\.html$/i.test(location.pathname))return;
  const offer=document.createElement('a');
  offer.className='rivani-launch-offer';
  offer.href='pro.html';
  offer.setAttribute('aria-label','RIVANI Pro launch offer: regular price 499 rupees, now 199 rupees per month');
  offer.innerHTML='<span class="launch-offer-spark">✦</span><span class="launch-offer-copy"><small>RIVANI PRO · LAUNCH OFFER</small><b><s>₹499</s> <strong>₹199</strong><em>/month</em></b></span><span class="launch-offer-cta">Upgrade →</span>';
  document.body.appendChild(offer);
  function sync(context){offer.hidden=String(context?.plan||'').toLowerCase()==='pro';}
  sync(window.RIVANI_LUKI_CONTEXT||{});
  window.addEventListener('rivani:auth-context',event=>sync(event.detail));
})();

const reveals=document.querySelectorAll('.reveal');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('visible')}),{threshold:.1});reveals.forEach(el=>observer.observe(el));
const slides=[...document.querySelectorAll('.spotlight-slide')];const dotsWrap=document.getElementById('sliderDots');let currentSlide=0,slideTimer;if(slides.length&&dotsWrap){slides.forEach((_,i)=>{const dot=document.createElement('button');dot.setAttribute('aria-label',`Show tool ${i+1}`);dot.addEventListener('click',()=>showSlide(i));dotsWrap.appendChild(dot)});const dots=[...dotsWrap.children];window.showSlide=function(index){currentSlide=(index+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle('active',i===currentSlide));dots.forEach((d,i)=>d.classList.toggle('active',i===currentSlide));clearInterval(slideTimer);slideTimer=setInterval(()=>showSlide(currentSlide+1),5000)};document.getElementById('prevSlide')?.addEventListener('click',()=>showSlide(currentSlide-1));document.getElementById('nextSlide')?.addEventListener('click',()=>showSlide(currentSlide+1));showSlide(0);}


// RIVANI V28 — live-tool slider inside the homepage hero.
(function initHomeLiveSlider(){
  const slides=[...document.querySelectorAll('[data-home-tool-slide]')];
  const dotsWrap=document.getElementById('homeLiveDots');
  if(!slides.length||!dotsWrap)return;
  const count=document.getElementById('homeLiveCount');
  let current=0,timer;
  slides.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Show live tool ${i+1}`);b.addEventListener('click',()=>show(i));dotsWrap.appendChild(b)});
  const dots=[...dotsWrap.children];
  function show(i){current=(i+slides.length)%slides.length;slides.forEach((s,n)=>s.classList.toggle('active',n===current));dots.forEach((d,n)=>d.classList.toggle('active',n===current));if(count)count.textContent=`${current+1} / ${slides.length}`;clearInterval(timer);timer=setInterval(()=>show(current+1),5200)}
  document.getElementById('homeLivePrev')?.addEventListener('click',()=>show(current-1));
  document.getElementById('homeLiveNext')?.addEventListener('click',()=>show(current+1));
  show(0);
})();

// LUKI — AI-powered RIVANI website assistant.
const LUKI_API_BASE='https://rivani-account-api.rivani.workers.dev';
if(!document.getElementById('lukiLauncher')){document.body.insertAdjacentHTML('beforeend',`<button class="luki-launcher" id="lukiLauncher" type="button" aria-label="Open LUKI assistant" aria-expanded="false"><span class="luki-launcher-orb rivani-r-crop luki-r-logo" aria-hidden="true"><img src="assets/rivani-ai-logo.png" alt=""></span><span class="luki-launcher-copy"><strong>LUKI</strong><small>Ask about RIVANI AI</small></span><span class="luki-online-dot"></span></button><aside class="luki-panel" id="lukiPanel" aria-label="LUKI RIVANI assistant" aria-hidden="true"><div class="luki-head"><div class="luki-avatar rivani-r-crop luki-r-logo" aria-hidden="true"><img src="assets/rivani-ai-logo.png" alt=""></div><div><strong>LUKI</strong><span>RIVANI AI Assistant</span></div><button class="luki-close" id="lukiClose" type="button" aria-label="Close LUKI">×</button></div><div class="luki-scope"><span>✦</span>Ask naturally. LUKI understands questions about RIVANI tools, accounts, plans, policies and website features.</div><div class="luki-messages" id="lukiMessages" aria-live="polite"><div class="luki-message bot"><div class="luki-bubble">Hi, I’m LUKI. Ask me anything about RIVANI AI — tools, your account, plans, policies, or how a feature works.</div></div></div><div class="luki-quick" id="lukiQuick"><button type="button" data-question="What can AI Audio Repair do?">Audio Repair</button><button type="button" data-question="What can the Advanced Calculator do?">Calculator</button><button type="button" data-question="Which RIVANI tools are live or planned?">Tool status</button><button type="button" data-question="How does the 7-day account deletion work?">Account deletion</button><button type="button" data-question="What is the Free plan?">Plans</button></div><form class="luki-form" id="lukiForm"><input id="lukiInput" type="text" maxlength="500" autocomplete="off" placeholder="Ask LUKI about RIVANI AI…"><button type="submit" aria-label="Send question">➜</button></form><div class="luki-foot">RIVANI help only · AI responses can be imperfect</div></aside>`)}
const lukiLauncher=document.getElementById('lukiLauncher'),lukiPanel=document.getElementById('lukiPanel'),lukiClose=document.getElementById('lukiClose'),lukiForm=document.getElementById('lukiForm'),lukiInput=document.getElementById('lukiInput'),lukiMessages=document.getElementById('lukiMessages'),lukiQuick=document.getElementById('lukiQuick');
const lukiHistory=[];
function lukiAdd(text,who='bot',extraClass=''){if(!lukiMessages)return null;const row=document.createElement('div');row.className=`luki-message ${who} ${extraClass}`.trim();const b=document.createElement('div');b.className='luki-bubble';b.textContent=text;row.appendChild(b);lukiMessages.appendChild(row);lukiMessages.scrollTop=lukiMessages.scrollHeight;return row}
function lukiFallbackReply(raw){
  const q=raw.toLowerCase().trim();
  if(/(audio|voice|noise|echo|recording|sound|podcast|wav|mp3|dereverb|background voices|music control)/.test(q))return 'AI Audio Repair is live. Free accounts get 9 successful repairs per day, up to 30 minutes and 500 MB per file, with MP3 export. The tool scans the recording, runs RIVANI Clear Voice locally in the browser, provides before/after playback, and supports microphone recordings. Pro is designed for unlimited jobs within its processing allowance, larger files, lossless WAV, advanced cleanup controls, Background Voices, Music Control and De-Reverb. The current launch offer is ₹199/month (regular ₹499) with manual UPI/QR verification.';
  if(/(background|remove bg|cutout|transparent|alpha|hair|product|glass)/.test(q))return 'Background Remover is live. RIVANI Precision isolates people and objects, then you can adjust Hair/Product/Glass/Logo presets, Edge Clean, Expand/Contract, Feather, Edge Decontaminate, manual Erase/Restore, backgrounds, shadow and product-canvas framing. Free gets 9 successful removals per day with the same cutout quality, transparent PNG/WebP and other exports. Pro removes the daily cap. The current launch offer is ₹199/month (regular ₹499) with manual UPI/QR verification.';
  if(/(image|photo|picture|upscale|enhance|fidelity|8x|8×|filter)/.test(q))return 'Image Enhancer is live. It supports 1×, 2×, 4× and adaptive 8× output, AI Strength, Clarity, Sharpness, Studio Finish, Smart Scan, Fidelity Guard, filters and a drag Before/After comparison. Free gets 9 successful enhancements per day. Pro adds unlimited image jobs plus precision controls such as Critical Area Lock, Face Identity Lock, Logo Reference Lock, Exact Brand Color Lock, Selective Revert Brush, QR/Barcode Guard, Truth Map, Print Proof and Batch + Consistency Lock.';
  if(/(calculator|scientific|fraction|percentage|equation|quadratic|statistics|geometry|converter|emi|interest|student math)/.test(q))return 'RIVANI Advanced Calculator is a live free utility with no daily limit. It includes scientific expressions, fractions, percentage tools, linear and quadratic equations, statistics, common geometry formulas, length/weight/temperature/data conversion, EMI and compound-interest calculations. It runs locally in the browser and shows readable steps where practical.';
  if(/(upcoming|roadmap|passport|resizer|compressor|converter|ocr|object remover|pdf|subtitle|transcription|rewriter|grammar|qr|photo restorer|colorizer)/.test(q))return 'RIVANI’s public roadmap includes Passport Photo Maker, image resize/compress/convert tools, Object Remover, OCR, photo restoration/colorization, a PDF Studio, subtitle/transcription tools, text utilities, QR tools and related creator utilities. They are marked Upcoming until they are actually launched.';
  if(/(contact|support|send message|feedback|bug report)/.test(q))return 'Use the Contact page to send RIVANI a tool-feedback, bug, account, feature or business message. The Send Message form uses a Cloudflare security check and stores the submission in the RIVANI support backend. Do not send passwords, private keys or payment details.';
  if(/(plan|free|pro|premium|price|billing|limit|9 per day|9\/day)/.test(q)){const c=window.RIVANI_LUKI_CONTEXT||{};const prefix=c.signedIn?`You’re currently on the ${c.plan||'Free'} plan${c.username?`, ${c.username}`:''}. `:'';return prefix+'The three live AI media tools each use a 9-successful-jobs-per-day Free limit. The Advanced Calculator is free and unlimited. Background Remover keeps full Precision quality on Free; Image Enhancer keeps its standard quality controls on Free; Audio Repair includes Clear Voice and MP3 on Free. One Pro subscription covers the active AI media tools. Regular price is ₹499/month and the current launch offer is ₹199/month. Launch checkout uses a 15-minute UPI/QR session; a payment screenshot is submitted for manual verification and Pro activates only after approval.';}
  if(/(all tool|which tool|tools|feature|about|rivani|platform|live)/.test(q))return 'RIVANI AI currently has three live AI media tools — AI Audio Repair, Image Enhancer and Background Remover — plus a live free Advanced Student Calculator. A separate Upcoming Tools roadmap lists planned image, PDF, audio/video and text utilities. LUKI can explain live controls, limits, exports, calculator modes and tool status.';
  if(/(login|sign up|account|google|password|dashboard)/.test(q))return 'RIVANI AI supports email/password and Google authentication through Firebase. Processing actions require an account, and the dashboard shows account and plan information.';
  if(/(delete|deletion|7 day|cancel account)/.test(q))return 'A signed-in user can schedule account deletion from the dashboard. RIVANI signs the user out after a successful request, then keeps a 7-day grace period during which the user can log back in and cancel the deletion.';
  if(/(privacy|policy|file|upload|data|secure|terms|cookie)/.test(q))return 'RIVANI AI has Privacy, Terms, Acceptable Use and Cookie pages. The current Audio Repair, Image Enhancer and Background Remover workflows process the selected media in the browser; model weights may be downloaded to the device and cached.';
  return 'I can help with RIVANI Audio Repair, Image Enhancer, Background Remover, the Advanced Calculator, Upcoming Tools, Contact, accounts, Free/Pro limits, exports, policies and website navigation.';
}
function openLuki(){lukiPanel?.classList.add('open');lukiPanel?.setAttribute('aria-hidden','false');lukiLauncher?.setAttribute('aria-expanded','true');setTimeout(()=>lukiInput?.focus(),100)}
function closeLuki(){lukiPanel?.classList.remove('open');lukiPanel?.setAttribute('aria-hidden','true');lukiLauncher?.setAttribute('aria-expanded','false')}
async function lukiAsk(question){const q=String(question||'').trim();if(!q)return;const historyForRequest=lukiHistory.slice(-8);lukiAdd(q,'user');lukiHistory.push({role:'user',content:q});const typing=lukiAdd('LUKI is thinking…','bot','typing');if(lukiInput)lukiInput.disabled=true;const send=lukiForm?.querySelector('button[type="submit"]');if(send)send.disabled=true;try{const response=await fetch(`${LUKI_API_BASE}/api/luki/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history:historyForRequest,context:window.RIVANI_LUKI_CONTEXT||{signedIn:false}})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'LUKI is temporarily unavailable.');const answer=String(data.answer||'').trim()||lukiFallbackReply(q);typing?.remove();lukiAdd(answer,'bot');lukiHistory.push({role:'assistant',content:answer});if(lukiHistory.length>10)lukiHistory.splice(0,lukiHistory.length-10)}catch(error){typing?.remove();const fallback=lukiFallbackReply(q);lukiAdd(fallback,'bot');lukiHistory.push({role:'assistant',content:fallback});console.warn('LUKI AI fallback:',error?.message||error)}finally{if(lukiInput){lukiInput.disabled=false;lukiInput.focus()}if(send)send.disabled=false}}
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

    if(root.nodeType===Node.TEXT_NODE){
      decorateTextNode(root);
      return;
    }

    if(root.nodeType!==Node.ELEMENT_NODE && root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE){
      return;
    }

    if(root.nodeType===Node.ELEMENT_NODE){
      if(SKIP_TAGS.has(root.tagName))return;
      if(root.matches?.(".rivani-ai-textfx"))return;
    }

    const walker=document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node){
          const parent=node.parentElement;
          if(!parent)return NodeFilter.FILTER_REJECT;
          if(SKIP_TAGS.has(parent.tagName))return NodeFilter.FILTER_REJECT;
          if(parent.closest(".rivani-ai-textfx"))return NodeFilter.FILTER_REJECT;
          return (node.nodeValue||"").includes(TEXT)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(decorateTextNode);
  }

  function start(){
    ensureBackgroundPulse();
    decorateWithin(document.body);

    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        if(mutation.type==="characterData"){
          decorateTextNode(mutation.target);
          continue;
        }

        mutation.addedNodes.forEach(node=>{
          if(node.nodeType===Node.TEXT_NODE){
            decorateTextNode(node);
          }else if(node.nodeType===Node.ELEMENT_NODE){
            decorateWithin(node);
          }
        });
      }
    });

    observer.observe(document.body,{
      subtree:true,
      childList:true,
      characterData:true
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",start,{once:true});
  }else{
    start();
  }
})();


/* ==========================================================
   RIVANI V21 · Real logo shine
   Wraps each existing RIVANI wordmark image with a precise shine shell.
   ========================================================== */
(function installRivaniLogoShine(){
  function wrapLogos(root=document){
    root.querySelectorAll?.('img[src*="assets/rivani-ai-logo.png"]').forEach(img=>{
      if(img.closest(".rivani-logo-shine-shell"))return;

      // Cropped ribbon-R icons need the PNG to stay as a direct child.
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

          if(node.matches?.('img[src*="assets/rivani-ai-logo.png"]')){
            wrapLogos(node.parentElement||document);
          }else{
            wrapLogos(node);
          }
        });
      }
    });

    observer.observe(document.body,{subtree:true,childList:true});
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",start,{once:true});
  }else{
    start();
  }
})();
