// RIVANI AI frontend v8 — LUKI backend connected
const mobileMenuBtn=document.getElementById('mobileMenuBtn');const mainNav=document.getElementById('mainNav');mobileMenuBtn?.addEventListener('click',()=>{const open=mainNav?.classList.toggle('open');mobileMenuBtn.setAttribute('aria-expanded',String(open));});document.querySelectorAll('.main-nav a').forEach(a=>a.addEventListener('click',()=>mainNav?.classList.remove('open')));const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
const reveals=document.querySelectorAll('.reveal');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('visible')}),{threshold:.1});reveals.forEach(el=>observer.observe(el));
const slides=[...document.querySelectorAll('.spotlight-slide')];const dotsWrap=document.getElementById('sliderDots');let currentSlide=0,slideTimer;if(slides.length&&dotsWrap){slides.forEach((_,i)=>{const dot=document.createElement('button');dot.setAttribute('aria-label',`Show tool ${i+1}`);dot.addEventListener('click',()=>showSlide(i));dotsWrap.appendChild(dot)});const dots=[...dotsWrap.children];window.showSlide=function(index){currentSlide=(index+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle('active',i===currentSlide));dots.forEach((d,i)=>d.classList.toggle('active',i===currentSlide));clearInterval(slideTimer);slideTimer=setInterval(()=>showSlide(currentSlide+1),5000)};document.getElementById('prevSlide')?.addEventListener('click',()=>showSlide(currentSlide-1));document.getElementById('nextSlide')?.addEventListener('click',()=>showSlide(currentSlide+1));showSlide(0);}

// LUKI — AI-powered RIVANI website assistant.
const LUKI_API_BASE='https://rivani-account-api.rivani.workers.dev';
if(!document.getElementById('lukiLauncher')){document.body.insertAdjacentHTML('beforeend',`<button class="luki-launcher" id="lukiLauncher" type="button" aria-label="Open LUKI assistant" aria-expanded="false"><span class="luki-launcher-orb rivani-r-crop luki-r-logo" aria-hidden="true"><img src="assets/rivani-ai-logo.png" alt=""></span><span class="luki-launcher-copy"><strong>LUKI</strong><small>Ask about RIVANI AI</small></span><span class="luki-online-dot"></span></button><aside class="luki-panel" id="lukiPanel" aria-label="LUKI RIVANI assistant" aria-hidden="true"><div class="luki-head"><div class="luki-avatar rivani-r-crop luki-r-logo" aria-hidden="true"><img src="assets/rivani-ai-logo.png" alt=""></div><div><strong>LUKI</strong><span>RIVANI AI Assistant</span></div><button class="luki-close" id="lukiClose" type="button" aria-label="Close LUKI">×</button></div><div class="luki-scope"><span>✦</span>Ask naturally. LUKI understands questions about RIVANI tools, accounts, plans, policies and website features.</div><div class="luki-messages" id="lukiMessages" aria-live="polite"><div class="luki-message bot"><div class="luki-bubble">Hi, I’m LUKI. Ask me anything about RIVANI AI — tools, your account, plans, policies, or how a feature works.</div></div></div><div class="luki-quick" id="lukiQuick"><button type="button" data-question="What can AI Audio Repair do?">Audio Repair</button><button type="button" data-question="Which RIVANI tools are live or planned?">Tool status</button><button type="button" data-question="How does the 7-day account deletion work?">Account deletion</button><button type="button" data-question="What is the Free plan?">Plans</button></div><form class="luki-form" id="lukiForm"><input id="lukiInput" type="text" maxlength="500" autocomplete="off" placeholder="Ask LUKI about RIVANI AI…"><button type="submit" aria-label="Send question">➜</button></form><div class="luki-foot">RIVANI help only · AI responses can be imperfect</div></aside>`)}
const lukiLauncher=document.getElementById('lukiLauncher'),lukiPanel=document.getElementById('lukiPanel'),lukiClose=document.getElementById('lukiClose'),lukiForm=document.getElementById('lukiForm'),lukiInput=document.getElementById('lukiInput'),lukiMessages=document.getElementById('lukiMessages'),lukiQuick=document.getElementById('lukiQuick');
const lukiHistory=[];
function lukiAdd(text,who='bot',extraClass=''){if(!lukiMessages)return null;const row=document.createElement('div');row.className=`luki-message ${who} ${extraClass}`.trim();const b=document.createElement('div');b.className='luki-bubble';b.textContent=text;row.appendChild(b);lukiMessages.appendChild(row);lukiMessages.scrollTop=lukiMessages.scrollHeight;return row}
function lukiFallbackReply(raw){const q=raw.toLowerCase().trim();if(/(audio|voice|noise|echo|recording|sound|podcast)/.test(q))return 'AI Audio Repair is available as a working Beta. It scans a recording, runs RIVANI AI Clear Voice, lets you compare before/after, and exports MP3 on Free. Free supports up to 30 minutes and 500 MB per file. Pro is designed for lossless WAV and advanced audio controls.';if(/(background|remove bg|cutout)/.test(q))return 'Background Remover is currently planned. It is intended to isolate the main subject and export a transparent result for products, profile pictures and creator graphics.';if(/(image|photo|picture|upscale)/.test(q))return 'RIVANI Image Enhancer is live. It uses real browser-side AI super-resolution, Smart Scan, Fidelity Guard, 2×/4× enhancement, before/after comparison and PNG/WebP/JPEG export.';if(/(subtitle|caption|video)/.test(q))return 'Video Subtitle Generator is currently planned. It is intended to turn speech into caption-ready text for creator workflows.';if(/(pdf|document|doc)/.test(q))return 'PDF Assistant is currently planned for extracting, organizing, searching, summarizing and explaining document information.';if(/(text|rewrite|translate|grammar|writing)/.test(q))return 'Text Tools are currently planned for focused rewriting, cleanup, translation, grammar and formatting tasks.';if(/(delete|deletion|7 day|cancel account)/.test(q))return 'A signed-in user can schedule account deletion from the dashboard. After a successful request, RIVANI signs the user out. There is a 7-day grace period, and the user can log back in during that period to cancel the deletion.';if(/(plan|free|pro|premium|price|billing)/.test(q)){const c=window.RIVANI_LUKI_CONTEXT||{};if(c.signedIn)return `You’re currently on the ${c.plan||'Free'} plan${c.username?`, ${c.username}`:''}. Pro access is not yet enabled for public purchase.`;return 'Current public accounts use the Free plan. The planned Pro audio limits are up to 1 GB per file and 5 hours of processing per day, with lossless WAV and advanced controls.';}if(/(login|sign up|account|google|password|dashboard)/.test(q))return 'RIVANI AI supports email/password and Google authentication through Firebase. New signups confirm account creation, then log in to open the personal dashboard.';if(/(privacy|policy|file|upload|data|secure|terms|cookie)/.test(q))return 'RIVANI AI has Privacy, Terms, Acceptable Use and Cookie pages. Tool-specific processing should disclose whether files stay in the browser or are sent to a remote service before processing begins.';if(/(all tool|which tool|tools|feature|about|rivani|platform)/.test(q))return 'RIVANI AI is a focused multi-tool platform. It currently includes AI Audio Repair and Image Enhancer as live tools, with Background Remover, Video Subtitle Generator, PDF Assistant and Text Tools planned.';return 'I can only help with RIVANI AI, its tools, account, plans, policies, and website features.'}
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
