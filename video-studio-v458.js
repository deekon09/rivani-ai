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
  exportBlobUrl: "", recordingMime: "", renderBusy: false, offlineFrameMode: false, matteRaw: null, matteCore: null, matteNear: null, matteTmp: null, matteRefined: null
};
state.inferCtx = state.inferCanvas.getContext("2d", {willReadFrequently:true});
state.maskCtx = state.maskCanvas.getContext("2d");
state.faceMaskCtx = state.faceMaskCanvas.getContext("2d");
state.frameCtx = state.frameCanvas.getContext("2d");
state.subjectCtx = state.subjectCanvas.getContext("2d");
state.faceCtx = state.faceCanvas.getContext("2d");
const outCtx = el.canvas.getContext("2d");
const RIVANI_VIDEO_BUILD="V45.8.1-BITRATE-HOTFIX";
queueMicrotask(()=>{if(el.engineNote)el.engineNote.textContent="V45.8.1 OFFLINE EXPORT · bitrate helper restored, original settings";console.info("RIVANI Video Studio",RIVANI_VIDEO_BUILD);});

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
  const portrait=height>width;
  let boxW,boxH;

  if(choice==="720"){
    boxW=portrait?720:1280;
    boxH=portrait?1280:720;
  }else if(choice==="1080"){
    boxW=portrait?1080:1920;
    boxH=portrait?1920:1080;
  }else{
    // Preserve source by default, only cap above a 4K-oriented frame box.
    boxW=portrait?2160:3840;
    boxH=portrait?3840:2160;
  }

  const scale=Math.min(1,boxW/Math.max(1,width),boxH/Math.max(1,height));
  const w=Math.max(2,Math.round(width*scale/2)*2);
  const h=Math.max(2,Math.round(height*scale/2)*2);
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
function resetMasks(){ state.prevPerson=null; state.prevFace=null; state.matteRaw=null; state.matteCore=null; state.matteNear=null; state.matteTmp=null; state.matteRefined=null; state.lastSegmentAt=0; }

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
  el.engineNote.textContent="V45.8.1 OFFLINE EXPORT · bitrate helper restored, original settings";
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
function dilateBinarySquare(src,w,h,radius,tmp,dst){
  // O(n) box dilation: horizontal running sum, then vertical running sum.
  for(let y=0;y<h;y++){
    const row=y*w;
    let sum=0;
    for(let x=0;x<=Math.min(w-1,radius);x++)sum+=src[row+x];
    for(let x=0;x<w;x++){
      tmp[row+x]=sum>0?1:0;
      const add=x+radius+1,sub=x-radius;
      if(add<w)sum+=src[row+add];
      if(sub>=0)sum-=src[row+sub];
    }
  }
  for(let x=0;x<w;x++){
    let sum=0;
    for(let y=0;y<=Math.min(h-1,radius);y++)sum+=tmp[y*w+x];
    for(let y=0;y<h;y++){
      dst[y*w+x]=sum>0?1:0;
      const add=y+radius+1,sub=y-radius;
      if(add<h)sum+=tmp[add*w+x];
      if(sub>=0)sum-=tmp[sub*w+x];
    }
  }
}
function sourceRgbAt(pixels,sw,sh,x,y,mw,mh){
  const sx=Math.max(0,Math.min(sw-1,Math.round(x*(sw-1)/Math.max(1,mw-1))));
  const sy=Math.max(0,Math.min(sh-1,Math.round(y*(sh-1)/Math.max(1,mh-1))));
  const k=(sy*sw+sx)*4;
  return [pixels[k],pixels[k+1],pixels[k+2]];
}
async function segmentCurrent(force=false){
  if(!state.segmenter||(!state.offlineFrameMode&&el.video.readyState<2))return false;
  const now=performance.now();
  if(!state.offlineFrameMode && !force && now-state.lastSegmentAt<(IS_MOBILE?68:40))return false;
  state.lastSegmentAt=now;

  const iw=state.inferCanvas.width, ih=state.inferCanvas.height;
  state.inferCtx.clearRect(0,0,iw,ih);
  state.inferCtx.drawImage(state.offlineFrameMode?state.frameCanvas:el.video,0,0,iw,ih);

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

  if(!state.matteRaw||state.matteRaw.length!==n){
    state.matteRaw=new Float32Array(n);
    state.matteCore=new Uint8Array(n);
    state.matteNear=new Uint8Array(n);
    state.matteTmp=new Uint8Array(n);
    state.matteRefined=new Float32Array(n);
  }

  const c=currentControls();
  const raw=state.matteRaw,core=state.matteCore,near=state.matteNear,tmp=state.matteTmp,refined=state.matteRefined;
  core.fill(0);

  // PASS 1: stable human core + raw foreground probability.
  for(let i=0;i<n;i++){
    const cls=classes?(classes[i]|0):-1;
    const fg=bgData?clamp(1-Number(bgData[i]||0),0,1):(cls===0?0:1);
    raw[i]=fg;

    if(classes){
      // Strong semantic human core only: hair, body-skin, face-skin, clothes.
      if(cls>=1&&cls<=4 && fg>.20)core[i]=1;
    }else if(fg>.58){
      core[i]=1;
    }
  }

  // Expand human support by ~5 model pixels. This preserves an object only when
  // it is touching / held / worn / immediately adjacent to the human silhouette.
  // Independent background objects remain outside this support and are rejected.
  dilateBinarySquare(core,mw,mh,5,tmp,near);

  // PASS 2: connected-subject matte.
  for(let i=0;i<n;i++){
    const cls=classes?(classes[i]|0):-1;
    let target=raw[i];

    if(classes){
      if(cls>=1&&cls<=4){
        // Human classes stay authoritative.
        target=Math.max(target,.74);
      }else if(cls===5){
        // "Others/accessories": preserve only when actually connected to human.
        // This fixes holes through held footballs/phones/bags without keeping
        // unrelated background objects.
        if(near[i]){
          target=target>.36 ? Math.max(target,.66) : target*.72;
        }else{
          target*=.06;
        }
      }else if(cls===0){
        // Background may contribute a tiny uncertain edge only near the person.
        if(!near[i] || target<.48)target=0;
        else target*=.42;
      }
    }

    raw[i]=clamp(target,0,1);
  }

  // PASS 3: color-aware 3x3 alpha refinement on uncertain edge pixels.
  // This is a lightweight guided matte: neighbours with similar RGB influence
  // the edge more than different-colour background pixels.
  const src=state.inferCtx.getImageData(0,0,iw,ih).data;
  for(let y=0;y<mh;y++){
    for(let x=0;x<mw;x++){
      const i=y*mw+x;
      const v=raw[i];

      if(v<=.025||v>=.975){
        refined[i]=v;
        continue;
      }

      const [cr,cg,cb]=sourceRgbAt(src,iw,ih,x,y,mw,mh);
      let sum=v*1.8,ws=1.8;

      for(let oy=-1;oy<=1;oy++){
        const yy=y+oy;
        if(yy<0||yy>=mh)continue;
        for(let ox=-1;ox<=1;ox++){
          if(ox===0&&oy===0)continue;
          const xx=x+ox;
          if(xx<0||xx>=mw)continue;

          const ni=yy*mw+xx;
          const [nr,ng,nb]=sourceRgbAt(src,iw,ih,xx,yy,mw,mh);
          const d=(cr-nr)*(cr-nr)+(cg-ng)*(cg-ng)+(cb-nb)*(cb-nb);
          const colorW=1/(1+d/2400);
          const spatialW=(ox===0||oy===0)?1:.72;
          const wgt=colorW*spatialW;
          sum+=raw[ni]*wgt;
          ws+=wgt;
        }
      }

      const guided=sum/Math.max(.001,ws);
      refined[i]=clamp(v*.62+guided*.38,0,1);
    }
  }

  const baseKeep=Math.min(.30,c.temporal*.46);
  const faceKeep=Math.min(.54,c.temporal*.64);
  const personImage=new ImageData(mw,mh),faceImage=new ImageData(mw,mh);
  let personPixels=0,facePixels=0,borderAlpha=0,borderN=0;

  // Narrower transition than V45.5 => fewer semi-transparent fringe pixels.
  const lo=.22+(c.edge/100)*.0010;
  const hi=.60+(c.edge/100)*.0012;

  for(let i=0,j=0;i<n;i++,j+=4){
    const cls=classes?(classes[i]|0):-1;
    const target=refined[i];
    const face=faceData?clamp(Number(faceData[i]||0),0,1):(cls===3?1:0);

    const prev=first?target:state.prevPerson[i];
    const dropping=target<prev;
    const motion=Math.abs(target-prev);

    // Very fast release to background; gentler acquisition for stable edges.
    const keep=dropping
      ? baseKeep*.05
      : baseKeep*(1-clamp(motion*2.7,0,.84));

    const temporal=first?target:(prev*keep+target*(1-keep));
    state.prevPerson[i]=temporal;

    const prevFace=first?face:state.prevFace[i];
    const tf=first?face:(prevFace*faceKeep+face*(1-faceKeep));
    state.prevFace[i]=tf;

    let p=smoothstep(lo,hi,temporal);

    // Preserve true human core and subject-connected accessories.
    if(cls>=1&&cls<=4){
      if(target>.64)p=Math.max(p,.995);
      else if(target>.48)p=Math.max(p,.93);
      else if(target>.32)p=Math.max(p,.72);
    }else if(cls===5&&near[i]){
      if(target>.60)p=Math.max(p,.94);
      else if(target>.42)p=Math.max(p,.70);
    }else{
      if(target<.16)p=0;
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
  el.stabilityStatus.textContent="V45.6 connected matte · edge refined";

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
  if(!state.offlineFrameMode){state.frameCtx.clearRect(0,0,w,h);state.frameCtx.filter="none";state.frameCtx.drawImage(el.video,0,0,w,h);}
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

// V45.8.1 hotfix: preserve V45.7's resolution-aware video bitrate policy.
// Offline export still uses the original matte, controls, and frame timestamps.
function recorderBitrate(w,h){
  const pixels=w*h;
  if(pixels>=8000000)return 32000000; // 4K-ish
  if(pixels>=3500000)return 22000000; // 1440p-ish
  if(pixels>=1800000)return 14000000; // Full HD portrait/landscape
  if(pixels>=900000)return 9000000;   // 720p / ~1MP
  return 6000000;
}

/* RIVANI V45.8: experimental source-timed offline exporter.
 * This code replaces only V45.7's exportVideo(), not its AI cutout or controls.
 * Frame decode order/timestamps come from source, independent of playback clock.
 */
async function exportOfflineSourceVideo(){
  if(typeof VideoEncoder==='undefined'||typeof VideoDecoder==='undefined'){
    throw new Error('This browser has no WebCodecs video encoder/decoder. Use Chrome or Edge desktop.');
  }
  const {
    Input,ALL_FORMATS,BlobSource,VideoSampleSink,AudioSampleSink,
    BufferTarget,CanvasSource,AudioSampleSource,Output,
    WebMOutputFormat,Mp4OutputFormat,Quality,canEncodeVideo,canEncodeAudio
  }=await getMediabunny();
  const inputFile=new Input({formats:ALL_FORMATS,source:new BlobSource(state.file)});
  let output=null,source=null,audioSource=null,audioTask=null;
  try{
    if(!(await inputFile.canRead()))throw new Error('The input video format cannot be read in this browser.');
    const videoTrack=await inputFile.getPrimaryVideoTrack();
    if(!videoTrack)throw new Error('No video track found.');
    if(!(await videoTrack.canDecode()))throw new Error('The source video codec cannot be decoded here. Try updated Chrome/Edge.');
    const audioTrack=await inputFile.getPrimaryAudioTrack();
    if(audioTrack && !(await audioTrack.canDecode()))throw new Error('Source audio codec cannot be decoded; audio will not be silently discarded.');
    const zero=await inputFile.getFirstTimestamp();
    const sourceEnd=await videoTrack.computeDuration();
    const originalDuration=Math.max(.001,sourceEnd-zero);
    configureCanvases();
    resetMasks();
    const w=el.canvas.width,h=el.canvas.height;
    const quality=new Quality({bitrate:recorderBitrate(w,h)});
    const transparent=state.bg==='transparent';
    const wanted=el.format.value;
    let codec,extension,format,alpha='discard';
    setProgress(3,'Checking offline encoder…','Checking source decoding and output compatibility.');
    if(transparent){
      if(IS_IOS||IS_SAFARI)throw new Error('Transparent WebM is not supported reliably on Safari/iPhone.');
      if(!(await canEncodeVideo('vp9',{width:w,height:h,quality,alpha:'keep'})))
        throw new Error('VP9 alpha encoding is unavailable at '+w+'×'+h+' on this device. Select a lower resolution; transparency will not be replaced with gradient.');
      codec='vp9';extension='webm';format=new WebMOutputFormat();alpha='keep';
    }else if(wanted!=='webm' && await canEncodeVideo('avc',{width:w,height:h,quality})){
      codec='avc';extension='mp4';format=new Mp4OutputFormat();
    }else if(wanted==='mp4'){
      throw new Error('This browser cannot encode MP4 at '+w+'×'+h+'. Try Auto, WebM, or lower resolution.');
    }else if(await canEncodeVideo('vp9',{width:w,height:h,quality})){
      codec='vp9';extension='webm';format=new WebMOutputFormat();
    }else{
      throw new Error('No compatible native offline video encoder at '+w+'×'+h+'.');
    }
    const target=new BufferTarget();
    output=new Output({format,target});
    source=new CanvasSource(el.canvas,{codec,quality,alpha,latencyMode:'quality',keyFrameInterval:2});
    output.addVideoTrack(source);
    if(audioTrack){
      const audioCodec=extension==='mp4'?'aac':'opus';
      if(!(await canEncodeAudio(audioCodec)))throw new Error('Source audio cannot be encoded as '+audioCodec+'. No silent video-only fallback.');
      audioSource=new AudioSampleSource({codec:audioCodec,quality:new Quality({bitrate:192000})});
      output.addAudioTrack(audioSource);
    }
    await output.start();
    let audioCount=0,audioError=null,audioEnd=0;
    if(audioSource){
      audioTask=(async()=>{
        const sink=new AudioSampleSink(audioTrack);
        for await(const sample of sink.samples()){
          try{
            // Normalize track timelines using the same original-file origin.
            let ts=sample.timestamp-zero;
            if(ts+sample.duration<=0)continue;
            if(ts<0){
              // A negative-start packet can cross t=0. Trim it before encoding.
              const trimFrames=Math.ceil(-ts*sample.sampleRate);
              if(trimFrames>=sample.numberOfFrames)continue;
              const clipped=sample.trim(trimFrames);
              try{
                clipped.setTimestamp(0);
                await audioSource.add(clipped);
                audioCount++;audioEnd=Math.max(audioEnd,clipped.duration);
              }finally{clipped.close();}
            }else{
              sample.setTimestamp(ts);
              await audioSource.add(sample);
              audioCount++;audioEnd=Math.max(audioEnd,ts+sample.duration);
            }
          }finally{sample.close();}
        }
      })().catch(error=>{audioError=error;throw error;});
      // Consume rejection immediately to avoid unhandled Promise warnings.
      audioTask.catch(()=>{});
    }
    const sink=new VideoSampleSink(videoTrack);
    let frames=0,lastTimestamp=-Infinity,lastEnd=0,lastPercent=-1;
    state.offlineFrameMode=true;
    for await(const sample of sink.samples()){
      try{
        if(audioError)throw audioError;
        const ts=sample.timestamp-zero;
        if(ts+sample.duration<=0)continue;
        // Source samples are decoded/presented in order; do not drop frames.
        const timestamp=Math.max(0,ts);
        if(timestamp<=lastTimestamp){
          throw new Error('Non-increasing video timestamps in source; refusing a silently corrupted export.');
        }
        const duration=Math.max(.0001,sample.duration||1/30);
        if(!Number.isFinite(timestamp)||!Number.isFinite(duration))throw new Error('Invalid source frame timestamp.');
        state.frameCtx.clearRect(0,0,w,h);
        state.frameCtx.filter='none';
        sample.draw(state.frameCtx,0,0,w,h);
        await segmentCurrent(true);
        renderComposite();
        await source.add(timestamp,duration,{keyFrame:frames===0 || timestamp-Math.floor(timestamp/2)*2<duration});
        frames++;
        lastTimestamp=timestamp;lastEnd=Math.max(lastEnd,timestamp+duration);
        const p=Math.floor(5+89*Math.min(1,lastEnd/originalDuration));
        if(p!==lastPercent){
          lastPercent=p;
          setProgress(p,'Encoding every original frame…',
            frames+' frames encoded · '+formatTime(lastEnd)+' / '+formatTime(originalDuration)+
            ' · '+w+'×'+h+' · source timestamps (not realtime)');
        }
      }finally{sample.close();}
    }
    if(frames<1)throw new Error('No source frames could be decoded.');
    if(lastEnd<originalDuration-.3)throw new Error('Source ended early; incomplete video will not be exported.');
    if(audioTask)await audioTask;
    if(audioError)throw audioError;
    if(audioTrack&&audioCount<1)throw new Error('Source audio is missing from export; operation cancelled.');
    const audioDurationTolerance=.45;
    if(audioTrack&&audioEnd<Math.min(originalDuration-.15,lastEnd-audioDurationTolerance)){
      throw new Error('Source audio ended unexpectedly early; operation cancelled rather than exporting unsynced sound.');
    }
    setProgress(97,'Finishing frame-complete export…',frames+' frames · '+audioCount+' audio samples');
    source.close();audioSource?.close();
    await output.finalize();
    if(!target.buffer?.byteLength)throw new Error('Encoder finalized an empty file.');
    return {
      blob:new Blob([target.buffer],{type:extension==='mp4'?'video/mp4':'video/webm'}),
      extension,frames,duration:originalDuration,hasAudio:!!audioTrack
    };
  }catch(error){
    try{source?.close();audioSource?.close();await output?.cancel();}catch(e){console.warn('Offline cleanup',e);}
    throw error;
  }finally{
    state.offlineFrameMode=false;
    el.video.pause();
    try{inputFile.dispose();}catch(e){}
    if(state.monitorGain)state.monitorGain.gain.value=1;
    resetMasks();
  }
}

async function exportVideo(){
  if(state.exporting||!state.modelReady)return;
  if(!(await ensureAuth()))return;
  state.exporting=true;state.previewToken++;
  el.video.pause();el.video.controls=false;
  el.exportBtn.disabled=true;el.preview.disabled=true;
  showProcessing(true);
  setProgress(1,'Preparing frame-complete export…','Offline processing may take longer than the video duration.');
  try{
    const resultFile=await exportOfflineSourceVideo();
    if(state.exportBlobUrl)URL.revokeObjectURL(state.exportBlobUrl);
    state.exportBlobUrl=URL.createObjectURL(resultFile.blob);
    el.resultVideo.src=state.exportBlobUrl;
    el.download.download='rivani-video-studio'+(state.bg==='transparent'?'-transparent':'')+'.'+resultFile.extension;
    el.download.href=state.exportBlobUrl;
    el.resultTitle.textContent=state.bg==='transparent'?'Transparent WebM ready':'Processed video ready';
    el.resultMeta.textContent=el.canvas.width+' × '+el.canvas.height+' · '+
      resultFile.frames+' source-timed frames · '+formatTime(resultFile.duration)+' · '+
      (resultFile.blob.size/1048576).toFixed(1)+' MB'+(resultFile.hasAudio?' · original audio kept':' · no source audio');
    el.result.classList.remove('hidden');
    el.status.textContent='Offline export complete · '+resultFile.frames+' source frames encoded.';
    setProgress(100,'Export complete','Source frames retained in original time order.');
    setTimeout(()=>showProcessing(false),350);
  }catch(error){
    console.error('V45.8 experimental offline export',error);
    showProcessing(false);
    alert('Offline export failed: '+String(error?.message||error)+'\n\nNo incomplete or silent fallback file was returned.');
  }finally{
    state.offlineFrameMode=false;
    state.exporting=false;
    el.video.pause();el.video.controls=true;
    el.exportBtn.disabled=false;el.preview.disabled=false;
  }
}

el.exportBtn.addEventListener("click",exportVideo);

function resetControls(){
  el.edgeClean.value=54;el.feather.value=.35;el.temporal.value=20;el.light.value=0;el.smooth.value=0;el.glow.value=0;el.clarity.value=0;el.warmth.value=0;
  [el.edgeClean,el.feather,el.temporal,el.light,el.smooth,el.glow,el.clarity,el.warmth].forEach(x=>x.dispatchEvent(new Event("input")));
  state.bg="transparent";el.bgModes.querySelectorAll("[data-bg]").forEach(x=>x.classList.toggle("active",x.dataset.bg==="transparent"));resetMasks();
  if(state.modelReady&&el.video.paused)renderCurrentFrame(true).catch(()=>{});
}
el.reset.addEventListener("click",resetControls);

window.addEventListener("beforeunload",()=>{
  try{state.segmenter?.close?.();}catch(_e){}
  if(state.url)URL.revokeObjectURL(state.url);if(state.customBgUrl)URL.revokeObjectURL(state.customBgUrl);if(state.exportBlobUrl)URL.revokeObjectURL(state.exportBlobUrl);
});
