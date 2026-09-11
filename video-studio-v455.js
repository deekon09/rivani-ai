import { FilesetResolver, ImageSegmenter } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm";

const $ = id => document.getElementById(id);
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MEDIABUNNY_URL="https://cdn.jsdelivr.net/npm/mediabunny@1.56.1/+esm";
let mediabunnyPromise=null;
function getMediabunny(){ return mediabunnyPromise||(mediabunnyPromise=import(MEDIABUNNY_URL)); }
const IS_SAFARI=/^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent||"");

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") || Math.min(screen.width || 9999, screen.height || 9999) < 900;

const el = {
  upload: $("vsUpload"), file: $("vsFileInput"), choose: $("vsChooseBtn"), editor: $("vsEditor"),
  replace: $("vsReplaceBtn"), clear: $("vsClearBtn"), name: $("vsFileName"), meta: $("vsFileMeta"), video: $("vsSourceVideo"),
  canvas: $("vsCanvas"), stage: $("vsStage"), start: $("vsStartBtn"), preview: $("vsPreviewBtn"),
  exportBtn: $("vsExportBtn"), reset: $("vsResetBtn"), engineNote: $("vsEngineNote"),
  status: $("vsStatus"), fps: $("vsFps"), processing: $("vsProcessing"), processingTitle: $("vsProcessingTitle"),
  processingText: $("vsProcessingText"), progressFill: $("vsProgressFill"), progressMeta: $("vsProgressMeta"),
  personStatus: $("vsPersonStatus"), faceStatus: $("vsFaceStatus"), stabilityStatus: $("vsStabilityStatus"), engineStatus: $("vsEngineStatus"),
  beforeState: $("vsBeforeState"), afterState: $("vsAfterState"), bgModes: $("vsBgModes"),
  customColor: $("vsCustomColor"), customBgBtn: $("vsCustomBgBtn"), customBgInput: $("vsCustomBgInput"),
  edgeClean: $("vsEdgeClean"), edgeCleanValue: $("vsEdgeCleanValue"), feather: $("vsFeather"), featherValue: $("vsFeatherValue"),
  temporal: $("vsTemporal"), temporalValue: $("vsTemporalValue"), light: $("vsLight"), lightValue: $("vsLightValue"),
  smooth: $("vsSmooth"), smoothValue: $("vsSmoothValue"), glow: $("vsGlow"), glowValue: $("vsGlowValue"),
  clarity: $("vsClarity"), clarityValue: $("vsClarityValue"), warmth: $("vsWarmth"), warmthValue: $("vsWarmthValue"),
  resolution: $("vsResolution"), format: $("vsFormat"), result: $("vsResult"), resultTitle: $("vsResultTitle"),
  resultMeta: $("vsResultMeta"), resultVideo: $("vsResultVideo"), download: $("vsDownloadBtn")
};

const state = {
  file: null, url: "", segmenter: null, modelReady: false, running: false, exporting: false,
  bg: "transparent", customBg: null, customBgUrl: "", prevPerson: null, prevFace: null,
  inferCanvas: document.createElement("canvas"), inferCtx: null,
  maskCanvas: document.createElement("canvas"), maskCtx: null,
  faceMaskCanvas: document.createElement("canvas"), faceMaskCtx: null,
  frameCanvas: document.createElement("canvas"), frameCtx: null,
  subjectCanvas: document.createElement("canvas"), subjectCtx: null,
  faceCanvas: document.createElement("canvas"), faceCtx: null,
  lastSegmentAt: 0, lastFrameTime: -1, frameCount: 0, fpsStamp: performance.now(),
  previewToken: 0, lastMaskCoverage: 0, audioCtx: null, mediaSource: null, mediaDest: null, monitorGain: null,
  exportBlobUrl: "", recordingMime: "", renderBusy: false
};
state.inferCtx = state.inferCanvas.getContext("2d", {willReadFrequently:true});
state.maskCtx = state.maskCanvas.getContext("2d");
state.faceMaskCtx = state.faceMaskCanvas.getContext("2d");
state.frameCtx = state.frameCanvas.getContext("2d");
state.subjectCtx = state.subjectCanvas.getContext("2d");
state.faceCtx = state.faceCanvas.getContext("2d");
const outCtx = el.canvas.getContext("2d");
const RIVANI_VIDEO_BUILD="V45.5-NATIVE-ALPHA";
queueMicrotask(()=>{if(el.engineNote)el.engineNote.textContent="V45.5 ENGINE ACTIVE · human-only + native VP9 alpha export loaded";console.info("RIVANI Video Studio",RIVANI_VIDEO_BUILD);});

function clamp(v,a=0,b=1){ return Math.max(a, Math.min(b,v)); }
function pct(v){ return `${Math.round(Number(v)||0)}%`; }
function formatTime(s){ if(!Number.isFinite(s)) return "—"; const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m}:${String(sec).padStart(2,"0")}`; }
function setProgress(value,title,text){
  const v = clamp(Number(value)||0,0,100);
  el.progressFill.style.width = `${v}%`;
  el.progressMeta.textContent = `${Math.round(v)}%`;
  if(title) el.processingTitle.textContent = title;
  if(text) el.processingText.textContent = text;
}
function showProcessing(on){ el.processing.classList.toggle("hidden", !on); }
function currentControls(){
  return {
    edge:Number(el.edgeClean.value), feather:Number(el.feather.value), temporal:Number(el.temporal.value)/100,
    light:Number(el.light.value), smooth:Number(el.smooth.value), glow:Number(el.glow.value),
    clarity:Number(el.clarity.value), warmth:Number(el.warmth.value)
  };
}
function bindRange(input, output, formatter=pct){
  const update=()=>{output.textContent=formatter(input.value); if(state.modelReady && el.video.readyState>=2 && el.video.paused) renderCurrentFrame(true).catch(()=>{});};
  input.addEventListener("input",update); update();
}
bindRange(el.edgeClean,el.edgeCleanValue);
bindRange(el.feather,el.featherValue,v=>`${Number(v).toFixed(Number(v)%1?1:0)}px`);
bindRange(el.temporal,el.temporalValue);
bindRange(el.light,el.lightValue);
bindRange(el.smooth,el.smoothValue);
bindRange(el.glow,el.glowValue);
bindRange(el.clarity,el.clarityValue);
bindRange(el.warmth,el.warmthValue);

function fitOutputDimensions(width,height,choice=el.resolution.value){
  let maxH;
  if(choice==="720") maxH=720;
  else if(choice==="1080") maxH=1080;
  else maxH=IS_MOBILE?1080:2160;
  let scale = Math.min(1, maxH/height);
  const maxW = IS_MOBILE?1920:3840;
  scale = Math.min(scale, maxW/width);
  let w=Math.max(2,Math.round(width*scale/2)*2), h=Math.max(2,Math.round(height*scale/2)*2);
  return [w,h];
}
function configureCanvases(){
  const vw=el.video.videoWidth||1280, vh=el.video.videoHeight||720;
  const [w,h]=fitOutputDimensions(vw,vh);
  el.canvas.width=w; el.canvas.height=h; state.frameCanvas.width=w; state.frameCanvas.height=h;
  state.subjectCanvas.width=w; state.subjectCanvas.height=h; state.faceCanvas.width=w; state.faceCanvas.height=h;
  el.stage.style.aspectRatio=`${vw}/${vh}`;
  const maxInfer=IS_MOBILE?288:384;
  const scale=Math.min(1,maxInfer/Math.max(vw,vh));
  const iw=Math.max(96,Math.round(vw*scale)), ih=Math.max(96,Math.round(vh*scale));
  state.inferCanvas.width=iw; state.inferCanvas.height=ih;
  state.prevPerson=null; state.prevFace=null;
}
function resetMasks(){ state.prevPerson=null; state.prevFace=null; state.lastSegmentAt=0; }

function cleanupFile(){
  state.previewToken++;
  state.running=false;
  state.exporting=false;
  if(state.url) URL.revokeObjectURL(state.url);
  if(state.exportBlobUrl) URL.revokeObjectURL(state.exportBlobUrl);
  state.url=""; state.exportBlobUrl="";
  el.video.pause(); el.video.removeAttribute("src"); el.video.load();
  el.result.classList.add("hidden"); el.resultVideo.removeAttribute("src");
  resetMasks();
}

async function loadVideo(file){
  if(!file) return;
  const okType=(file.type||"").startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name||"");
  if(!okType){ alert("Choose an MP4, WebM, MOV or M4V video."); return; }
  cleanupFile();
  state.file=file; state.url=URL.createObjectURL(file);
  el.video.src=state.url; el.video.muted=false;
  await new Promise((resolve,reject)=>{
    const ok=()=>{cleanup();resolve();}, bad=()=>{cleanup();reject(new Error("This browser could not decode the selected video."));};
    const cleanup=()=>{el.video.removeEventListener("loadedmetadata",ok);el.video.removeEventListener("error",bad);};
    el.video.addEventListener("loadedmetadata",ok,{once:true});el.video.addEventListener("error",bad,{once:true});
  }).catch(err=>{alert(err.message); throw err;});
  configureCanvases();
  el.name.textContent=file.name||"video";
  const mb=(file.size/1024/1024).toFixed(file.size>100*1024*1024?0:1);
  el.meta.textContent=`${el.video.videoWidth} × ${el.video.videoHeight} · ${formatTime(el.video.duration)} · ${mb} MB`;
  el.upload.classList.add("hidden"); el.editor.classList.remove("hidden");
  el.status.textContent="Video loaded. Start AI Studio when ready.";
  el.beforeState.textContent="Source"; el.afterState.textContent="Waiting";
  outCtx.clearRect(0,0,el.canvas.width,el.canvas.height);
  state.frameCtx.drawImage(el.video,0,0,state.frameCanvas.width,state.frameCanvas.height);
  el.stage.classList.remove("ai-ready");
  el.preview.disabled=true; el.exportBtn.disabled=true;
  state.modelReady=false; state.segmenter?.close?.(); state.segmenter=null;
  el.engineStatus.textContent="Not loaded"; el.personStatus.textContent="Waiting"; el.faceStatus.textContent="Waiting"; el.stabilityStatus.textContent="Waiting";
  el.engineNote.textContent="AI model loads only when processing starts.";
}
el.choose.addEventListener("click",()=>el.file.click());
el.replace.addEventListener("click",()=>el.file.click());
el.clear?.addEventListener("click",()=>{
  cleanupFile();state.file=null;
  try{state.segmenter?.close?.();}catch(_e){}state.segmenter=null;state.modelReady=false;
  el.editor.classList.add("hidden");el.upload.classList.remove("hidden");el.stage.classList.remove("ai-ready");
  el.status.textContent="Choose a video to begin.";el.fps.textContent="—";
  el.start.disabled=false;el.start.innerHTML="<span>✦</span> Start AI Studio →";
  el.preview.disabled=true;el.exportBtn.disabled=true;
  el.engineStatus.textContent="Not loaded";el.personStatus.textContent="Waiting";el.faceStatus.textContent="Waiting";el.stabilityStatus.textContent="Waiting";
  el.engineNote.textContent="V45.5 ENGINE ACTIVE · human-only + native VP9 alpha export loaded";
});
el.file.addEventListener("change",()=>{const f=el.file.files?.[0];if(f)loadVideo(f).catch(()=>{});el.file.value="";});
["dragenter","dragover"].forEach(t=>el.upload.addEventListener(t,e=>{e.preventDefault();el.upload.classList.add("drag");}));
["dragleave","drop"].forEach(t=>el.upload.addEventListener(t,e=>{e.preventDefault();el.upload.classList.remove("drag");}));
el.upload.addEventListener("drop",e=>{const f=e.dataTransfer?.files?.[0];if(f)loadVideo(f).catch(()=>{});});

el.bgModes.addEventListener("click",e=>{
  const b=e.target.closest("[data-bg]"); if(!b)return;
  state.bg=b.dataset.bg; el.bgModes.querySelectorAll("[data-bg]").forEach(x=>x.classList.toggle("active",x===b));
  if(state.modelReady && el.video.readyState>=2 && el.video.paused) renderCurrentFrame(true).catch(()=>{});
});
el.customColor.addEventListener("input",()=>{if(state.bg==="custom"&&state.modelReady&&el.video.paused)renderCurrentFrame(true).catch(()=>{});});
el.customBgBtn.addEventListener("click",()=>el.customBgInput.click());
el.customBgInput.addEventListener("change",async()=>{
  const f=el.customBgInput.files?.[0]; if(!f)return;
  try{
    if(state.customBgUrl)URL.revokeObjectURL(state.customBgUrl);
    state.customBgUrl=URL.createObjectURL(f); state.customBg=await createImageBitmap(f);
    state.bg="image"; el.bgModes.querySelectorAll("[data-bg]").forEach(x=>x.classList.remove("active"));
    el.customBgBtn.textContent="Custom image ✓";
    if(state.modelReady&&el.video.paused)await renderCurrentFrame(true);
  }catch(e){alert("Could not open that background image.");}
  el.customBgInput.value="";
});

async function ensureAuth(){
  if(typeof window.RIVANI_REQUIRE_AUTH==="function") return await window.RIVANI_REQUIRE_AUTH({tool:"Video Studio"});
  try{ await Promise.race([window.RIVANI_AUTH_READY,new Promise(r=>setTimeout(r,1600))]); }catch(_e){}
  if(window.RIVANI_LUKI_CONTEXT?.signedIn) return true;
  location.href=`auth.html?mode=signup&next=${encodeURIComponent("video-studio.html")}`; return false;
}

async function initSegmenter(){
  if(state.modelReady&&state.segmenter)return;
  showProcessing(true); setProgress(8,"Preparing local AI…","Loading MediaPipe Vision runtime.");
  el.engineStatus.textContent="Loading";
  const vision=await FilesetResolver.forVisionTasks(WASM_URL);
  setProgress(35,"Loading person model…","Downloading the local selfie segmentation model.");
  const delegate=(IS_IOS||IS_MOBILE)?"CPU":"GPU";
  try{
    state.segmenter=await ImageSegmenter.createFromOptions(vision,{
      baseOptions:{modelAssetPath:MODEL_URL,delegate},
      runningMode:"VIDEO",outputCategoryMask:true,outputConfidenceMasks:true
    });
  }catch(firstError){
    if(delegate==="CPU")throw firstError;
    setProgress(55,"Switching to compatibility mode…","GPU initialization failed; starting CPU segmentation.");
    state.segmenter=await ImageSegmenter.createFromOptions(vision,{
      baseOptions:{modelAssetPath:MODEL_URL,delegate:"CPU"},
      runningMode:"VIDEO",outputCategoryMask:true,outputConfidenceMasks:true
    });
  }
  state.modelReady=true; resetMasks();
  el.engineStatus.textContent=(IS_IOS||IS_MOBILE)?"Local CPU":"Local AI";
  el.engineNote.textContent="RIVANI Person Cutout ready · model runs on this device.";
  setProgress(92,"AI ready…","Scanning the first frame.");
  await renderCurrentFrame(true);
  setProgress(100,"Studio ready","Background and face controls are live.");
  setTimeout(()=>showProcessing(false),220);
  el.preview.disabled=false; el.exportBtn.disabled=false; el.afterState.textContent="AI Studio";
  el.stage.classList.add("ai-ready");
}

function smoothstep(edge0,edge1,x){
  const t=clamp((x-edge0)/(edge1-edge0)); return t*t*(3-2*t);
}
async function segmentCurrent(force=false){
  if(!state.segmenter||el.video.readyState<2)return false;
  const now=performance.now();
  if(!force && now-state.lastSegmentAt<(IS_MOBILE?68:40))return false;
  state.lastSegmentAt=now;

  const iw=state.inferCanvas.width, ih=state.inferCanvas.height;
  state.inferCtx.clearRect(0,0,iw,ih);
  state.inferCtx.drawImage(el.video,0,0,iw,ih);

  const result=await new Promise((resolve,reject)=>{
    let settled=false;
    try{
      const maybe=state.segmenter.segmentForVideo(
        state.inferCanvas,performance.now(),r=>{settled=true;resolve(r);}
      );
      if(maybe&&typeof maybe.then==="function")maybe.then(r=>{if(!settled&&r)resolve(r);}).catch(reject);
      else if(maybe&&maybe.categoryMask&&!settled)resolve(maybe);
    }catch(e){reject(e);}
  });

  const confidence=result?.confidenceMasks||[];
  const category=result?.categoryMask||null;
  // This is the SAME working V44.1 orientation:
  // multiclass confidence[0] = background probability.
  // foreground = 1 - background probability.
  const bgMask=confidence[0]||null;
  const faceConfidence=confidence[3]||null;
  const referenceMask=bgMask||category;
  if(!referenceMask)throw new Error("Person mask was not returned.");

  const mw=Math.max(1,Number(referenceMask.width)||256);
  const mh=Math.max(1,Number(referenceMask.height)||256);
  const n=mw*mh;
  if(state.maskCanvas.width!==mw||state.maskCanvas.height!==mh){
    state.maskCanvas.width=mw;state.maskCanvas.height=mh;
    state.faceMaskCanvas.width=mw;state.faceMaskCanvas.height=mh;
    state.prevPerson=null;state.prevFace=null;
  }

  const bgData=bgMask?.getAsFloat32Array?.()||null;
  const faceData=faceConfidence?.getAsFloat32Array?.()||null;
  let classes=null;
  try{
    classes=category?.getAsUint8Array?.()||null;
    if(classes&&classes.length>=n){
      // Category API should return 0..5. If a runtime returns an unexpected
      // representation, ignore the class veto and keep the proven V45.2 mask.
      let mx=0;
      for(let k=0;k<Math.min(classes.length,4096);k++)if(classes[k]>mx)mx=classes[k];
      if(mx>5)classes=null;
    }
  }catch(_e){classes=null;}
  if((bgData&&bgData.length<n)||(classes&&classes.length<n))throw new Error("Segmentation mask geometry mismatch.");

  const first=!state.prevPerson||state.prevPerson.length!==n;
  if(first){state.prevPerson=new Float32Array(n);state.prevFace=new Float32Array(n);}
  const c=currentControls();
  const baseKeep=Math.min(.28,c.temporal*.44); // V45.3: faster cleanup behind motion
  const faceKeep=Math.min(.56,c.temporal*.66);
  const personImage=new ImageData(mw,mh),faceImage=new ImageData(mw,mh);
  let personPixels=0,facePixels=0,borderAlpha=0,borderN=0;

  // Stricter than V44.1: low-confidence room/field pixels are removed quickly.
  // Edge Clean raises the cutoff, but strong human pixels are protected below.
  const lo=.16+(c.edge/100)*.0014;     // ~0.23 at 50
  const hi=.64+(c.edge/100)*.0010;     // ~0.69 at 50

  for(let i=0,j=0;i<n;i++,j+=4){
    const cls=classes?(classes[i]|0):-1;
    let target=bgData?clamp(1-Number(bgData[i]||0),0,1):(cls>0&&cls<5?1:0);
    const face=faceData?clamp(Number(faceData[i]||0),0,1):(cls===3?1:0);

    if(classes){
      // Human-only policy requested for Video Studio:
      // 0 background -> remove
      // 1 hair / 2 body-skin / 3 face-skin / 4 clothes -> keep
      // 5 others/accessories -> remove unless the human probability is nearly
      // certain, in which case retain a small amount to protect hands/occlusion.
      if(cls===0){
        if(target<.78)target=0;
        else target*=.42;
      }else if(cls>=1&&cls<=4){
        target=Math.max(target,.72);
      }else if(cls===5){
        // User requested HUMAN ONLY. Class 5 is "others/accessories":
        // balls, loose objects and miscellaneous non-human pixels are dropped.
        target=0;
      }
    }

    const prev=first?target:state.prevPerson[i];
    // When a pixel turns into background, release it much faster than when it
    // becomes foreground. This removes the halo/trail behind moving people.
    const dropping=target<prev;
    const keep=dropping?baseKeep*.08:baseKeep;
    const temporal=first?target:(prev*keep+target*(1-keep));
    state.prevPerson[i]=temporal;

    const prevFace=first?face:state.prevFace[i];
    const tf=first?face:(prevFace*faceKeep+face*(1-faceKeep));
    state.prevFace[i]=tf;

    let p=smoothstep(lo,hi,temporal);
    if(cls===5)p=0; // hard human-only veto; no temporal carry for objects
    // Human classes get explicit core protection. Background / "others" do not.
    if(cls>=1&&cls<=4){
      if(target>.68)p=Math.max(p,.992);
      else if(target>.50)p=Math.max(p,.92);
      else if(target>.36)p=Math.max(p,.70);
    }else{
      if(target>.78)p=Math.max(p,.88);
      if(target<.18)p=0;
    }

    const f=smoothstep(.10,.72,tf);
    const a=Math.round(255*clamp(p,0,1)),fa=Math.round(255*clamp(f,0,1));
    personImage.data[j]=personImage.data[j+1]=personImage.data[j+2]=255;personImage.data[j+3]=a;
    faceImage.data[j]=faceImage.data[j+1]=faceImage.data[j+2]=255;faceImage.data[j+3]=fa;
    if(a>80)personPixels++;if(fa>80)facePixels++;

    const x=i%mw,y=(i/mw)|0;
    if(x<mw*.06||x>mw*.94||y<mh*.06||y>mh*.94){borderAlpha+=a/255;borderN++;}
  }

  const coverage=personPixels/Math.max(1,n);
  const borderMean=borderAlpha/Math.max(1,borderN);
  // Guard against the exact catastrophic failure seen in V44.3–V45.1.
  if(coverage>.80&&borderMean>.58){
    for(const m of confidence){try{m?.close?.();}catch(_e){}}
    try{category?.close?.();}catch(_e){}
    throw new Error("Foreground safety stopped an inverted/full-frame mask instead of erasing the human.");
  }

  state.maskCtx.clearRect(0,0,mw,mh);state.maskCtx.putImageData(personImage,0,0);
  state.faceMaskCtx.clearRect(0,0,mw,mh);state.faceMaskCtx.putImageData(faceImage,0,0);
  state.lastMaskCoverage=coverage;
  el.personStatus.textContent=coverage>.02?`Human locked · ${Math.round(coverage*100)}%`:"Searching";
  el.faceStatus.textContent=facePixels/n>.002?"Face detected":"Human cutout";
  el.stabilityStatus.textContent="V45.3 stable mask · human-only cleanup";

  for(const m of confidence){try{m?.close?.();}catch(_e){}}
  try{category?.close?.();}catch(_e){}
  return true;
}
function drawCover(ctx,img,w,h){
  const sw=img.width||img.videoWidth,sh=img.height||img.videoHeight;
  const s=Math.max(w/sw,h/sh),dw=sw*s,dh=sh*s;
  ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
}
function drawMaskTo(ctx,mask,w,h,feather=0){
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  if(feather>0)ctx.filter=`blur(${feather}px)`;
  ctx.drawImage(mask,0,0,w,h);ctx.restore();
}
function renderComposite(){
  const w=el.canvas.width,h=el.canvas.height,c=currentControls(),ctx=outCtx;
  state.frameCtx.clearRect(0,0,w,h);state.frameCtx.filter="none";state.frameCtx.drawImage(el.video,0,0,w,h);
  ctx.save();ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation="source-over";ctx.filter="none";
  if(state.bg==="blur"){
    ctx.filter=`blur(${Math.max(12,Math.round(w/90))}px) brightness(.86) saturate(.9)`;
    ctx.drawImage(state.frameCanvas,-18,-18,w+36,h+36);ctx.filter="none";
  }else if(state.bg==="studio"){
    const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,"#0b2c58");g.addColorStop(.48,"#171d40");g.addColorStop(1,"#402054");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    const r=ctx.createRadialGradient(w*.5,h*.38,0,w*.5,h*.38,Math.max(w,h)*.62);r.addColorStop(0,"rgba(94,205,255,.18)");r.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=r;ctx.fillRect(0,0,w,h);
  }else if(state.bg==="white"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);}
  else if(state.bg==="black"){ctx.fillStyle="#05070c";ctx.fillRect(0,0,w,h);}
  else if(state.bg==="custom"){ctx.fillStyle=el.customColor.value;ctx.fillRect(0,0,w,h);}
  else if(state.bg==="image"&&state.customBg){drawCover(ctx,state.customBg,w,h);}
  ctx.restore();

  state.subjectCtx.clearRect(0,0,w,h);
  const brightness=100+c.light*.55, contrast=100+c.clarity*.32, saturation=100+Math.max(-10,c.clarity*.12);
  state.subjectCtx.filter=`brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  state.subjectCtx.drawImage(state.frameCanvas,0,0,w,h);state.subjectCtx.filter="none";
  state.subjectCtx.globalCompositeOperation="destination-in";
  drawMaskTo(state.subjectCtx,state.maskCanvas,w,h,c.feather);
  state.subjectCtx.globalCompositeOperation="source-over";

  if(c.warmth!==0){
    state.subjectCtx.save();state.subjectCtx.globalCompositeOperation="source-atop";state.subjectCtx.globalAlpha=Math.min(.18,Math.abs(c.warmth)/170);
    state.subjectCtx.fillStyle=c.warmth>0?"#ff9c54":"#72b8ff";state.subjectCtx.fillRect(0,0,w,h);state.subjectCtx.restore();
  }

  // Studio Light is subject-only. Painting it on the final transparent canvas
  // would create a faint translucent "background" even when Remove is selected.
  if(c.light>0){
    state.subjectCtx.save();
    state.subjectCtx.globalCompositeOperation="source-atop";
    state.subjectCtx.globalAlpha=Math.min(.12,c.light/360);
    const sg=state.subjectCtx.createRadialGradient(w*.5,h*.32,0,w*.5,h*.35,Math.max(w,h)*.5);
    sg.addColorStop(0,"rgba(214,242,255,.9)");
    sg.addColorStop(1,"rgba(255,255,255,0)");
    state.subjectCtx.fillStyle=sg;
    state.subjectCtx.fillRect(0,0,w,h);
    state.subjectCtx.restore();
  }

  // V45.3: never glow the entire cutout. Whole-body glow created the visible
  // purple/white halo around arms, hair and shoulders.
  ctx.drawImage(state.subjectCanvas,0,0);

  if(c.smooth>0){
    state.faceCtx.clearRect(0,0,w,h);state.faceCtx.filter=`blur(${1.1+c.smooth*.035}px) brightness(102%)`;
    state.faceCtx.drawImage(state.frameCanvas,0,0,w,h);state.faceCtx.filter="none";
    state.faceCtx.globalCompositeOperation="destination-in";drawMaskTo(state.faceCtx,state.faceMaskCanvas,w,h,Math.max(1,c.feather*.55));state.faceCtx.globalCompositeOperation="source-over";
    ctx.save();ctx.globalAlpha=Math.min(.58,c.smooth/105);ctx.drawImage(state.faceCanvas,0,0);ctx.restore();

    // Soft Glow is face-only. It no longer expands the body silhouette.
    if(c.glow>0){
      ctx.save();
      ctx.globalCompositeOperation="screen";
      ctx.globalAlpha=Math.min(.22,c.glow/190);
      ctx.filter=`blur(${Math.max(2,c.glow*.10)}px)`;
      ctx.drawImage(state.faceCanvas,0,0);
      ctx.restore();
    }
  }

}

async function renderCurrentFrame(forceSegment=false){
  if(state.renderBusy||!state.modelReady||el.video.readyState<2)return;
  state.renderBusy=true;
  try{await segmentCurrent(forceSegment);renderComposite();countFrame();}finally{state.renderBusy=false;}
}
function countFrame(){
  state.frameCount++;const now=performance.now();
  if(now-state.fpsStamp>1000){el.fps.textContent=`${Math.round(state.frameCount*1000/(now-state.fpsStamp))} AI fps`;state.frameCount=0;state.fpsStamp=now;}
}

async function startPreview(){
  if(!state.modelReady)return;
  const token=++state.previewToken;state.running=true;
  el.video.controls=false;el.stage.classList.add("ai-ready");
  try{await el.video.play();}catch(_e){}
  const loop=async()=>{
    if(token!==state.previewToken||state.exporting)return;
    if(!el.video.paused&&!el.video.ended)await renderCurrentFrame(false).catch(e=>{el.status.textContent=e.message||"Preview error";});
    if(el.video.ended){state.running=false;el.preview.textContent="↻ Preview Again";el.video.controls=true;return;}
    if("requestVideoFrameCallback" in HTMLVideoElement.prototype)el.video.requestVideoFrameCallback(()=>loop());
    else requestAnimationFrame(()=>loop());
  };
  el.preview.textContent="❚❚ Pause Preview";loop();
}
el.preview.addEventListener("click",async()=>{
  if(state.exporting)return;
  if(!state.modelReady)return;
  if(!el.video.paused){el.video.pause();state.running=false;state.previewToken++;el.preview.textContent="▶ Preview AI";el.video.controls=true;return;}
  if(el.video.ended||el.video.currentTime>=el.video.duration-.05)el.video.currentTime=0;
  await startPreview();
});
el.video.addEventListener("seeked",()=>{if(state.modelReady&&!state.exporting&&el.video.paused)renderCurrentFrame(true).catch(()=>{});});
el.video.addEventListener("pause",()=>{if(state.modelReady&&!state.exporting){el.preview.textContent="▶ Preview AI";}});

el.start.addEventListener("click",async()=>{
  if(!state.file)return;
  if(state.modelReady){showProcessing(false);el.start.disabled=true;return;}
  if(!(await ensureAuth()))return;
  try{
    el.start.disabled=true;showProcessing(true);setProgress(4,"Starting stable cutout…","Loading the proven multiclass person mask.");
    await initSegmenter();
    el.status.textContent="AI Studio ready. Preview or export.";
    el.start.textContent="✓ Background AI Ready";
    el.start.disabled=true;
  }catch(e){
    console.error(e);showProcessing(false);el.engineStatus.textContent="Unavailable";el.engineNote.textContent="Local AI could not start on this browser/device.";
    el.start.disabled=false;
    alert(`Video Studio could not start: ${e?.message||e}`);
  }
});

function selectMime(){
  const transparent=state.bg==="transparent",wanted=el.format.value;
  const candidates=[];
  if(transparent||wanted==="webm")candidates.push("video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm");
  else if(wanted==="mp4")candidates.push("video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4","video/webm;codecs=vp9,opus","video/webm");
  else candidates.push("video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/mp4","video/webm");
  return candidates.find(x=>MediaRecorder.isTypeSupported(x))||"";
}
async function prepareAudioTrack(){
  try{
    if(!state.audioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return [];
      state.audioCtx=new AC();state.mediaSource=state.audioCtx.createMediaElementSource(el.video);state.mediaDest=state.audioCtx.createMediaStreamDestination();
      state.monitorGain=state.audioCtx.createGain();state.monitorGain.gain.value=1;
      state.mediaSource.connect(state.mediaDest);state.mediaSource.connect(state.monitorGain);state.monitorGain.connect(state.audioCtx.destination);
    }
    await state.audioCtx.resume();state.monitorGain.gain.value=0;
    return state.mediaDest.stream.getAudioTracks();
  }catch(e){console.warn("Audio export fallback",e);return [];}
}

async function exportTransparentVideo(){
  if(IS_IOS||IS_SAFARI){
    throw new Error("Transparent WebM alpha is not supported reliably by Safari/iPhone. Use a desktop browser with VP9 alpha encoding support.");
  }
  if(typeof VideoEncoder==="undefined"){
    throw new Error("This browser does not expose WebCodecs VideoEncoder, so true transparent export cannot run.");
  }

  const {
    BufferTarget,
    CanvasSource,
    MediaStreamAudioTrackSource,
    Output,
    Quality,
    WebMOutputFormat,
    canEncodeVideo,
    canEncodeAudio
  } = await getMediabunny();

  // Transparent encode is memory-backed, so keep mobile at 720p.
  const oldResolution=el.resolution.value;
  if(IS_MOBILE)el.resolution.value="720";

  configureCanvases();
  await seekTo(0);
  resetMasks();
  await renderCurrentFrame(true);

  const w=el.canvas.width,h=el.canvas.height;
  const fps=24;
  const videoQuality=new Quality({bitrate:recorderBitrate(w,h)});

  setProgress(4,"Checking transparent encoder…","Testing this browser's native VP9 alpha support.");
  let alphaSupported=false;
  try{
    alphaSupported=await canEncodeVideo("vp9",{
      width:w,
      height:h,
      quality:videoQuality,
      alpha:"keep",
      hardwareAcceleration:"prefer-software"
    });
    if(!alphaSupported){
      alphaSupported=await canEncodeVideo("vp9",{
        width:w,
        height:h,
        quality:videoQuality,
        alpha:"keep"
      });
    }
  }catch(_e){alphaSupported=false;}

  if(!alphaSupported){
    if(oldResolution!==el.resolution.value)el.resolution.value=oldResolution;
    throw new Error("This browser/device cannot encode VP9 with alpha through WebCodecs. RIVANI will not replace transparency with a gradient.");
  }

  const target=new BufferTarget();
  const output=new Output({
    format:new WebMOutputFormat(),
    target
  });

  const videoSource=new CanvasSource(el.canvas,{
    codec:"vp9",
    quality:videoQuality,
    alpha:"keep",
    latencyMode:"quality",
    keyFrameInterval:2,
    hardwareAcceleration:"prefer-software"
  });
  output.addVideoTrack(videoSource,{frameRate:fps});

  // Preserve audio when the browser can encode Opus. Audio failure is not
  // allowed to destroy the transparent video path.
  let audioSource=null,audioTrack=null;
  try{
    const tracks=await prepareAudioTrack();
    const opusOK=tracks.length ? await canEncodeAudio("opus") : false;
    if(opusOK){
      audioTrack=tracks[0].clone ? tracks[0].clone() : tracks[0];
      audioSource=new MediaStreamAudioTrackSource(audioTrack,{
        codec:"opus",
        quality:new Quality({bitrate:128000})
      },{timestampBase:"zero"});
      output.addAudioTrack(audioSource);
      audioSource.errorPromise?.catch(err=>console.warn("Transparent export audio warning",err));
    }
  }catch(audioError){
    console.warn("Transparent export will continue without audio",audioError);
    audioSource=null;audioTrack=null;
  }

  setProgress(8,"Starting native alpha export…","Encoding transparent canvas frames directly to VP9 WebM.");
  await output.start();

  // First frame at t=0, then follow decoded video frames. Because CanvasSource
  // receives the actual transparent canvas, there is no separate matte-merge step.
  await seekTo(0);
  resetMasks();
  await renderCurrentFrame(true);
  await videoSource.add(0,1/fps,{keyFrame:true});

  let frameIndex=1;
  let lastTime=0;
  let finished=false;
  let exportError=null;

  try{
    await el.video.play();

    await new Promise((resolve,reject)=>{
      const finish=()=>{
        if(finished)return;
        finished=true;
        resolve();
      };

      const processFrame=async(mediaTime)=>{
        if(finished)return;
        try{
          if(el.video.ended)return finish();

          await renderCurrentFrame(false);
          const t=Math.max(0,Number.isFinite(mediaTime)?mediaTime:el.video.currentTime);

          // requestVideoFrameCallback may occasionally surface the same media
          // timestamp twice. CanvasSource requires increasing timestamps.
          if(t>lastTime+0.0005){
            const duration=Math.max(1/fps,t-lastTime);
            await videoSource.add(t,duration,{keyFrame:frameIndex%(fps*2)===0});
            lastTime=t;
            frameIndex++;
          }

          setProgress(
            8+86*(t/Math.max(.1,el.video.duration)),
            "Encoding transparent WebM…",
            `${formatTime(t)} / ${formatTime(el.video.duration)} · VP9 alpha · ${w}×${h}`
          );

          if("requestVideoFrameCallback" in HTMLVideoElement.prototype){
            el.video.requestVideoFrameCallback((_now,meta)=>processFrame(meta?.mediaTime));
          }else{
            requestAnimationFrame(()=>processFrame(el.video.currentTime));
          }
        }catch(err){
          finished=true;
          reject(err);
        }
      };

      el.video.addEventListener("ended",finish,{once:true});
      if("requestVideoFrameCallback" in HTMLVideoElement.prototype){
        el.video.requestVideoFrameCallback((_now,meta)=>processFrame(meta?.mediaTime));
      }else{
        requestAnimationFrame(()=>processFrame(el.video.currentTime));
      }
    });
  }catch(err){
    exportError=err;
  }finally{
    el.video.pause();
  }

  try{videoSource.close?.();}catch(_e){}
  try{audioSource?.close?.();}catch(_e){}

  if(exportError){
    try{await output.cancel?.();}catch(_e){}
    try{audioTrack?.stop?.();}catch(_e){}
    if(state.monitorGain)state.monitorGain.gain.value=1;
    if(oldResolution!==el.resolution.value)el.resolution.value=oldResolution;
    throw exportError;
  }

  setProgress(96,"Finalizing transparent WebM…","Writing WebM alpha metadata and finishing the file.");
  await output.finalize();

  try{audioTrack?.stop?.();}catch(_e){}
  if(state.monitorGain)state.monitorGain.gain.value=1;
  if(oldResolution!==el.resolution.value)el.resolution.value=oldResolution;

  if(!target.buffer||!target.buffer.byteLength){
    throw new Error("Native alpha encoder finalized without an output buffer.");
  }

  return new Blob([target.buffer],{type:"video/webm"});
}


function recorderBitrate(w,h){const pixels=w*h;return pixels>=3000000?16000000:pixels>=1800000?10000000:pixels>=900000?6500000:4000000;}
async function seekTo(time){
  if(Math.abs(el.video.currentTime-time)<.02)return;
  await new Promise(resolve=>{const done=()=>{el.video.removeEventListener("seeked",done);resolve();};el.video.addEventListener("seeked",done,{once:true});el.video.currentTime=time;});
}
async function exportVideo(){
  if(state.exporting||!state.modelReady)return;
  if(!(await ensureAuth()))return;
  if(state.bg==="transparent"){
    state.exporting=true;state.previewToken++;el.video.pause();el.video.controls=false;el.exportBtn.disabled=true;el.preview.disabled=true;
    showProcessing(true);
    try{
      const blob=await exportTransparentVideo();
      if(state.exportBlobUrl)URL.revokeObjectURL(state.exportBlobUrl);
      state.exportBlobUrl=URL.createObjectURL(blob);
      el.resultVideo.src=state.exportBlobUrl;
      el.download.download="rivani-video-studio-transparent.webm";
      el.download.href=state.exportBlobUrl;
      el.resultTitle.textContent="Transparent WebM ready";
      el.resultMeta.textContent=`${el.canvas.width} × ${el.canvas.height} · ${(blob.size/1024/1024).toFixed(1)} MB · VP9 WebM + alpha`;
      el.result.classList.remove("hidden");
      setProgress(100,"Transparent export complete","Native VP9 alpha WebM ready · no gradient background was added.");
      el.status.textContent="Transparent WebM export complete.";
      setTimeout(()=>showProcessing(false),400);
    }catch(e){
      console.error(e);showProcessing(false);
      alert(`Transparent export failed: ${e?.message||e}\n\nRIVANI did not replace transparency with a gradient.`);
    }finally{
      state.exporting=false;el.video.pause();el.video.controls=true;el.exportBtn.disabled=false;el.preview.disabled=false;
      if(state.monitorGain)state.monitorGain.gain.value=1;
    }
    return;
  }
  if(typeof el.canvas.captureStream!=="function"||typeof MediaRecorder==="undefined"){alert("This browser does not support local canvas video export. Try current Chrome or Edge desktop.");return;}
  state.exporting=true;state.previewToken++;el.video.pause();el.video.controls=false;el.exportBtn.disabled=true;el.preview.disabled=true;
  showProcessing(true);setProgress(2,"Preparing local export…","Setting up the processed video recorder.");
  try{
    configureCanvases();await seekTo(0);resetMasks();await renderCurrentFrame(true);
    const fps=Math.min(30,Math.max(24,Number(el.video.getVideoPlaybackQuality?.().totalVideoFrames?30:30)));
    const canvasStream=el.canvas.captureStream(fps);
    const audioTracks=await prepareAudioTrack();
    const combined=new MediaStream([...canvasStream.getVideoTracks(),...audioTracks]);
    const mime=selectMime();state.recordingMime=mime||"video/webm";
    const opts={videoBitsPerSecond:recorderBitrate(el.canvas.width,el.canvas.height)};
    if(mime)opts.mimeType=mime;
    const recorder=new MediaRecorder(combined,opts),chunks=[];
    recorder.addEventListener("dataavailable",e=>{if(e.data?.size)chunks.push(e.data);});
    const stopped=new Promise((resolve,reject)=>{recorder.addEventListener("stop",resolve,{once:true});recorder.addEventListener("error",e=>reject(e.error||new Error("Recorder error")),{once:true});});
    recorder.start(1000);
    setProgress(5,"Exporting locally…","AI cutout + studio finish are being recorded in real time.");
    await el.video.play();
    const token=++state.previewToken;
    await new Promise((resolve,reject)=>{
      let finished=false;
      const finish=()=>{if(finished)return;finished=true;resolve();};
      const loop=async()=>{
        if(finished||token!==state.previewToken)return finish();
        try{
          if(el.video.ended)return finish();
          await renderCurrentFrame(false);
          const p=5+94*(el.video.currentTime/Math.max(.1,el.video.duration));
          setProgress(p,"Exporting locally…",`${formatTime(el.video.currentTime)} / ${formatTime(el.video.duration)} · ${el.canvas.width}×${el.canvas.height}`);
          if("requestVideoFrameCallback" in HTMLVideoElement.prototype)el.video.requestVideoFrameCallback(()=>loop());
          else requestAnimationFrame(()=>loop());
        }catch(e){reject(e);}
      };
      el.video.addEventListener("ended",finish,{once:true});loop();
    });
    await renderCurrentFrame(true).catch(()=>{});
    if(recorder.state!=="inactive")recorder.stop();
    await stopped;
    combined.getTracks().forEach(t=>t.stop());canvasStream.getTracks().forEach(t=>t.stop());
    const type=recorder.mimeType||mime||"video/webm",blob=new Blob(chunks,{type});
    if(!blob.size)throw new Error("The browser returned an empty recording.");
    if(state.exportBlobUrl)URL.revokeObjectURL(state.exportBlobUrl);
    state.exportBlobUrl=URL.createObjectURL(blob);el.resultVideo.src=state.exportBlobUrl;
    const ext=type.includes("mp4")?"mp4":"webm";el.download.download=`rivani-video-studio.${ext}`;el.download.href=state.exportBlobUrl;
    el.resultTitle.textContent="Processed video ready";
    el.resultMeta.textContent=`${el.canvas.width} × ${el.canvas.height} · ${(blob.size/1024/1024).toFixed(1)} MB · ${type.split(";")[0]}${state.bg==="transparent"?" · transparent alpha depends on browser encoder":""}`;
    el.result.classList.remove("hidden");setProgress(100,"Export complete","Your processed video is ready.");
    el.status.textContent="Export complete · local file ready.";
    setTimeout(()=>showProcessing(false),350);
  }catch(e){
    console.error(e);showProcessing(false);alert(`Export failed: ${e?.message||e}`);
  }finally{
    state.exporting=false;el.video.pause();el.video.controls=true;el.exportBtn.disabled=false;el.preview.disabled=false;
    if(state.monitorGain)state.monitorGain.gain.value=1;
  }
}
el.exportBtn.addEventListener("click",exportVideo);

function resetControls(){
  el.edgeClean.value=50;el.feather.value=.7;el.temporal.value=22;el.light.value=18;el.smooth.value=18;el.glow.value=0;el.clarity.value=10;el.warmth.value=6;
  [el.edgeClean,el.feather,el.temporal,el.light,el.smooth,el.glow,el.clarity,el.warmth].forEach(x=>x.dispatchEvent(new Event("input")));
  state.bg="transparent";el.bgModes.querySelectorAll("[data-bg]").forEach(x=>x.classList.toggle("active",x.dataset.bg==="transparent"));resetMasks();
  if(state.modelReady&&el.video.paused)renderCurrentFrame(true).catch(()=>{});
}
el.reset.addEventListener("click",resetControls);

window.addEventListener("beforeunload",()=>{
  try{state.segmenter?.close?.();}catch(_e){}
  if(state.url)URL.revokeObjectURL(state.url);if(state.customBgUrl)URL.revokeObjectURL(state.customBgUrl);if(state.exportBlobUrl)URL.revokeObjectURL(state.exportBlobUrl);
});
