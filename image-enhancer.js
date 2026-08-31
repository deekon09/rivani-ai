(()=>{"use strict";

// RIVANI Image Enhancer V25.5 · verified tone lock + precision protection

const $=id=>document.getElementById(id);

const fileInput=$("imageFileInput");
const chooseBtn=$("chooseImageBtn");
const replaceBtn=$("replaceImageBtn");
const dropZone=$("imageDropZone");
const editor=$("imageEditor");
const enhanceBtn=$("enhanceImageBtn");

const originalPreview=$("imageOriginalPreview");
const compareBefore=$("compareBefore");
const compareAfter=$("compareAfter");
const compareBox=$("imageCompare");
const previewEmpty=$("imagePreviewEmpty");
const previewShell=$("imagePreviewShell");
const protectCanvas=$("protectSelectionCanvas");

const processing=$("imageProcessingOverlay");
const progressFill=$("imageProgressFill");
const progressPercent=$("imageProgressPercent");
const processingTitle=$("imageProcessingTitle");
const processingText=$("imageProcessingText");
const providerText=$("imageProviderText");

const resultPanel=$("imageResultPanel");
const resultStatus=$("imageResultStatus");
const resultHeadline=$("imageResultHeadline");
const downloadBtn=$("downloadEnhancedBtn");
const againBtn=$("enhanceAgainBtn");
const anotherBtn=$("enhanceAnotherBtn");
const precisionProtectBtn=$("precisionProtectBtn");
const clearProtectedRegionBtn=$("clearProtectedRegionBtn");
const protectedRegionStatus=$("protectedRegionStatus");
const truthMapToggle=$("truthMapToggle");
const printProofToggle=$("printProofToggle");
const truthMapPanel=$("imageTruthMapPanel");
const truthMapCanvas=$("imageTruthMapCanvas");
const truthMapNote=$("imageTruthMapNote");
const truthMapStatus=$("truthMapStatus");
const printProofPanel=$("imagePrintProof");
const printProofValue=$("imagePrintProofValue");
const protectedMeta=$("imageProtectedMeta");
const imageProModal=$("imageProModal");
const imageProModalTitle=$("imageProModalTitle");
const imageProModalCopy=$("imageProModalCopy");

const DEFAULT_OUTPUT_PIXELS=36_000_000;
const DEFAULT_OUTPUT_EDGE=9000;

let sourceFile=null;
let sourceBitmap=null;
let sourceUrl="";
let enhancedUrl="";
let enhancedBlob=null;

let imageMode="natural";
let requestedScale=2;
let fidelityGuard=true;
let textLogoSafe=true;
let colorLock=true;
let busy=false;
let currentScan=null;
let currentImagePlan="free";
let protectionSelectMode=false;
let protectedRegions=[];
let truthMapEnabled=false;
let printProofEnabled=false;
let protectDrag=null;

chooseBtn?.addEventListener("click",()=>fileInput?.click());
replaceBtn?.addEventListener("click",()=>fileInput?.click());

fileInput?.addEventListener("change",()=>{
  const file=fileInput.files?.[0];
  if(file)loadImage(file);
});

dropZone?.addEventListener("dragover",event=>{
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone?.addEventListener("dragleave",()=>{
  dropZone.classList.remove("dragging");
});

dropZone?.addEventListener("drop",event=>{
  event.preventDefault();
  dropZone.classList.remove("dragging");

  const file=[...(event.dataTransfer?.files||[])].find(
    item=>item.type.startsWith("image/")
  );

  if(file)loadImage(file);
});

document.addEventListener("paste",event=>{
  if(busy)return;

  const item=[...(event.clipboardData?.items||[])].find(
    entry=>entry.type.startsWith("image/")
  );

  const file=item?.getAsFile();
  if(file)loadImage(file);
});

document.querySelectorAll("[data-image-mode]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    imageMode=btn.dataset.imageMode||"natural";

    document.querySelectorAll("[data-image-mode]").forEach(item=>{
      item.classList.toggle("active",item===btn);
    });
  });
});

document.querySelectorAll("[data-image-scale]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    requestedScale=Number(btn.dataset.imageScale)===4?4:2;

    document.querySelectorAll("[data-image-scale]").forEach(item=>{
      item.classList.toggle("active",item===btn);
    });
  });
});

bindToggle("fidelityGuardToggle",value=>fidelityGuard=value);
bindToggle("textSafeToggle",value=>textLogoSafe=value);
bindToggle("colorLockToggle",value=>colorLock=value);

enhanceBtn?.addEventListener("click",enhanceCurrentImage);
againBtn?.addEventListener("click",()=>{
  resultPanel?.classList.add("hidden");
  compareBox?.classList.add("hidden");
  previewEmpty?.classList.remove("hidden");
  redrawProtectedRegions();
  window.scrollTo({top:Math.max(0,enhanceBtn.offsetTop-180),behavior:"smooth"});
});

anotherBtn?.addEventListener("click",()=>{
  if(busy)return;
  resetForAnotherImage();
  fileInput?.click();
});

downloadBtn?.addEventListener("click",()=>{
  if(!enhancedBlob)return;

  const format=$("imageExportFormat")?.value||"png";
  const ext=format==="jpeg"?"jpg":format;
  const base=(sourceFile?.name||"rivani-image")
    .replace(/\.[^.]+$/,"")
    .replace(/[^\w\-]+/g,"-")
    .replace(/^-+|-+$/g,"")
    ||"rivani-image";

  const link=document.createElement("a");
  link.href=URL.createObjectURL(enhancedBlob);
  link.download=`${base}-rivani-enhanced.${ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(()=>URL.revokeObjectURL(link.href),3000);
});



function normalizeImagePlan(value){
  return String(value||"").trim().toLowerCase()==="pro"?"pro":"free";
}

function syncImagePlan(context){
  currentImagePlan=normalizeImagePlan(context?.plan||window.RIVANI_LUKI_CONTEXT?.plan);
  document.body.classList.toggle("image-pro-entitled",currentImagePlan==="pro");
  redrawProtectedRegions();
}

function isImagePro(){
  return currentImagePlan==="pro";
}

window.addEventListener("rivani:auth-context",event=>syncImagePlan(event.detail));
syncImagePlan(window.RIVANI_LUKI_CONTEXT||{});

precisionProtectBtn?.addEventListener("click",()=>{
  if(!sourceBitmap){
    alert("Choose an image first, then mark the area you want RIVANI to protect.");
    return;
  }
  if(!isImagePro()){
    openImagePro("Logo / Critical Area Lock","Select up to five important regions. RIVANI restores those exact regions from the original after enhancement while the rest of the image keeps the verified AI result.");
    return;
  }
  protectionSelectMode=!protectionSelectMode;
  precisionProtectBtn.classList.toggle("active",protectionSelectMode);
  precisionProtectBtn.setAttribute("aria-pressed",String(protectionSelectMode));
  if(protectionSelectMode){
    previewEmpty?.classList.remove("hidden");
    compareBox?.classList.add("hidden");
    resultPanel?.classList.add("hidden");
  }
  redrawProtectedRegions();
});

clearProtectedRegionBtn?.addEventListener("click",()=>{
  protectedRegions=[];
  protectionSelectMode=false;
  precisionProtectBtn?.classList.remove("active");
  redrawProtectedRegions();
});

truthMapToggle?.addEventListener("click",()=>{
  if(!isImagePro()){
    openImagePro("RIVANI Truth Map","See a visual change map after verification so you can identify where enhancement changed the source most.");
    return;
  }
  truthMapEnabled=!truthMapEnabled;
  truthMapToggle.setAttribute("aria-pressed",String(truthMapEnabled));
  truthMapToggle.classList.toggle("active",truthMapEnabled);
  if(!truthMapEnabled)truthMapPanel?.classList.add("hidden");
});

printProofToggle?.addEventListener("click",()=>{
  if(!isImagePro()){
    openImagePro("Print Proof","Get a conservative 300 DPI print-size estimate from the actual verified output dimensions.");
    return;
  }
  printProofEnabled=!printProofEnabled;
  printProofToggle.setAttribute("aria-pressed",String(printProofEnabled));
  printProofToggle.classList.toggle("active",printProofEnabled);
  if(!printProofEnabled)printProofPanel?.classList.add("hidden");
});

document.querySelectorAll("[data-close-image-pro]").forEach(btn=>{
  btn.addEventListener("click",closeImagePro);
});

document.addEventListener("keydown",event=>{
  if(event.key==="Escape"){
    closeImagePro();
    if(protectionSelectMode){
      protectionSelectMode=false;
      precisionProtectBtn?.classList.remove("active");
      redrawProtectedRegions();
    }
  }
});

protectCanvas?.addEventListener("pointerdown",beginProtectionDrag);
protectCanvas?.addEventListener("pointermove",moveProtectionDrag);
protectCanvas?.addEventListener("pointerup",endProtectionDrag);
protectCanvas?.addEventListener("pointercancel",cancelProtectionDrag);
window.addEventListener("resize",()=>{
  if(sourceBitmap)redrawProtectedRegions();
});

function bindToggle(id,setter){
  const button=$(id);
  if(!button)return;

  button.addEventListener("click",()=>{
    const next=button.getAttribute("aria-pressed")!=="true";
    button.setAttribute("aria-pressed",String(next));
    button.classList.toggle("enabled",next);
    setter(next);
  });
}

async function loadImage(file){
  if(!looksLikeImageFile(file)){
    alert("Choose an image file supported by your browser.");
    return;
  }

  try{
    const bitmap=await decodeImageSource(file);

    if(!bitmap.width||!bitmap.height){
      throw new Error("Invalid image.");
    }

    if(sourceBitmap?.close)sourceBitmap.close();
    if(sourceUrl)URL.revokeObjectURL(sourceUrl);
    if(enhancedUrl)URL.revokeObjectURL(enhancedUrl);

    sourceFile=file;
    sourceBitmap=bitmap;
    sourceUrl=URL.createObjectURL(file);
    enhancedUrl="";
    enhancedBlob=null;
    protectedRegions=[];
    protectionSelectMode=false;
    precisionProtectBtn?.classList.remove("active");
    truthMapPanel?.classList.add("hidden");
    printProofPanel?.classList.add("hidden");

    originalPreview.src=sourceUrl;
    compareBefore.src=sourceUrl;
    compareAfter.removeAttribute("src");

    $("imageFileName").textContent=file.name;
    $("imageFileMeta").textContent=
      `${bitmap.width.toLocaleString()} × ${bitmap.height.toLocaleString()} · ${friendlyType(file.type)} · ${formatBytes(file.size)}`;

    dropZone.classList.add("hidden");
    editor.classList.remove("hidden");
    previewEmpty.classList.remove("hidden");
    compareBox.classList.add("hidden");
    resultPanel.classList.add("hidden");

    enhanceBtn.disabled=false;
    requestAnimationFrame(redrawProtectedRegions);

    const scan=await smartScan(bitmap,file);
    currentScan=scan;
    renderSmartScan(scan);

    editor.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    alert("RIVANI could not decode this image in your browser.");
  }
}

async function smartScan(bitmap,file){
  const sample=drawSample(bitmap,320);
  const {data,width,height}=sample.ctx.getImageData(
    0,0,sample.canvas.width,sample.canvas.height
  );

  let lumaSum=0;
  let lapSum=0;
  let flatNoise=0;
  let flatCount=0;
  let edgeCount=0;
  let alphaCount=0;
  const pixelCount=width*height;

  const lum=new Float32Array(pixelCount);

  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=y*width+x;
      const p=i*4;

      const l=
        data[p]*.2126+
        data[p+1]*.7152+
        data[p+2]*.0722;

      lum[i]=l;
      lumaSum+=l;

      if(data[p+3]<250)alphaCount++;
    }
  }

  for(let y=1;y<height-1;y+=2){
    for(let x=1;x<width-1;x+=2){
      const i=y*width+x;
      const c=lum[i];

      const lap=Math.abs(
        4*c-
        lum[i-1]-
        lum[i+1]-
        lum[i-width]-
        lum[i+width]
      );

      lapSum+=lap;

      if(lap>24){
        edgeCount++;
      }else{
        const localDiff=(
          Math.abs(c-lum[i-1])+
          Math.abs(c-lum[i+1])+
          Math.abs(c-lum[i-width])+
          Math.abs(c-lum[i+width])
        )/4;

        flatNoise+=localDiff;
        flatCount++;
      }
    }
  }

  const sampled=Math.max(1,Math.floor((width-2)*(height-2)/4));
  const sharpness=lapSum/sampled;
  const noise=flatNoise/Math.max(1,flatCount);
  const meanLuma=lumaSum/pixelCount;
  const edgeDensity=edgeCount/sampled;
  const bytesPerPixel=file.size/(bitmap.width*bitmap.height);

  const blur=
    sharpness<10
      ?["High","Soft / blurred"]
      :sharpness<18
        ?["Medium","Some softness"]
        :["Low","Detail is healthy"];

  const noiseState=
    noise>7.5
      ?["High","Visible grain risk"]
      :noise>4.5
        ?["Medium","Some fine noise"]
        :["Low","Relatively clean"];

  let compression=["Low","No strong warning"];
  if(file.type==="image/jpeg"){
    compression=
      bytesPerPixel<.32
        ?["High","Heavy JPEG risk"]
        :bytesPerPixel<.65
          ?["Medium","Compression likely"]
          :["Low","Healthy JPEG data"];
  }

  const lighting=
    meanLuma<62
      ?["Low","Dark image"]
      :meanLuma>205
        ?["Bright","Highlight-heavy"]
        :["Balanced","Normal exposure"];

  const detail=
    edgeDensity>.18
      ?["Sensitive","Fine edges / text-like detail"]
      :edgeDensity>.09
        ?["Medium","Mixed detail"]
        :["Normal","Mostly natural detail"];

  const alpha=
    alphaCount>pixelCount*.002
      ?["Present","Transparency will be preserved"]
      :["None","Opaque image"];

  return {
    blur,
    noise:noiseState,
    compression,
    lighting,
    detail,
    alpha,
    score:{
      sharpness,
      noise,
      meanLuma,
      edgeDensity
    }
  };
}

function renderSmartScan(scan){
  const items=[
    ["Blur risk",scan.blur],
    ["Noise",scan.noise],
    ["Compression",scan.compression],
    ["Lighting",scan.lighting],
    ["Fine detail",scan.detail],
    ["Transparency",scan.alpha]
  ];

  $("imageScanGrid").innerHTML=items.map(([label,value])=>{
    const state=String(value[0]).toLowerCase();
    const risk=
      /high|sensitive|low$/.test(state)&&label!=="Blur risk"&&label!=="Noise"
        ?"neutral"
        :/high/.test(state)
          ?"warn"
          :/medium|dark|bright/.test(state)
            ?"mid"
            :"good";

    return `
      <article class="image-scan-item ${risk}">
        <span>${escapeHtml(label)}</span>
        <b>${escapeHtml(value[0])}</b>
        <small>${escapeHtml(value[1])}</small>
      </article>
    `;
  }).join("");

  const warnings=[
    scan.blur[0]==="High",
    scan.noise[0]==="High",
    scan.compression[0]==="High"
  ].filter(Boolean).length;

  $("smartScanSummary").textContent=
    warnings>=2
      ?"Restoration recommended"
      :warnings===1
        ?"Enhancement recommended"
        :"Good source";
}

async function enhanceCurrentImage(){
  if(!sourceBitmap||busy)return;

  busy=true;
  enhanceBtn.disabled=true;
  processing.classList.remove("hidden");
  resultPanel.classList.add("hidden");

  setProgress(0,"Preparing enhancement…","Your image remains on this device.");

  try{
    const prep=prepareInputForModel(
      sourceBitmap,
      requestedScale
    );

    if(prep.wasCapped){
      setProgress(1,"Preparing device-safe enhancement…",`Large source detected. RIVANI will preserve the source and use the highest safe output this device can hold (${prep.effectiveScale.toFixed(2)}× effective).`);
    }

    const worker=new Worker(
      "image-enhancer-worker.js?v=25.5-image",
      {type:"module"}
    );

    const runtimeStarted=performance.now();
    const response=await runWorker(
      worker,
      prep.imageData,
      prep.width,
      prep.height,
      prep.workerScale,
      getImagePerformanceProfile()
    );
    const runtimeMs=performance.now()-runtimeStarted;

    setProgress(98,"Running Fidelity Guard…","Checking structure, color and edge behavior.");

    const aiCanvas=document.createElement("canvas");
    aiCanvas.width=response.width;
    aiCanvas.height=response.height;

    const aiCtx=aiCanvas.getContext("2d",{alpha:true});
    aiCtx.putImageData(
      new ImageData(
        new Uint8ClampedArray(response.rgba),
        response.width,
        response.height
      ),
      0,
      0
    );

    const rawMetrics=measureFidelity(
      sourceBitmap,
      aiCanvas
    );

    const decision=decideGuard(
      rawMetrics,
      imageMode,
      fidelityGuard,
      textLogoSafe,
      colorLock,
      currentScan
    );

    const finalCanvas=composeFinal(
      sourceBitmap,
      aiCanvas,
      response.width,
      response.height,
      decision.blend,
      colorLock,
      rawMetrics,
      isImagePro()?protectedRegions:[]
    );

    let finalMetrics=measureFidelity(
      sourceBitmap,
      finalCanvas
    );

    // V25.5 verified Tone Lock: if a Color Lock result still shifts overall
    // brightness/color after composition, repair the tone with the source as
    // the truth anchor. AI detail stays in place; only global tone is nudged.
    if(colorLock&&decision.blend>0){
      finalMetrics=repairVerifiedTone(
        sourceBitmap,
        finalCanvas,
        finalMetrics
      );
    }

    if(isImagePro()&&protectedRegions.length){
      applyProtectedRegions(
        sourceBitmap,
        finalCanvas.getContext("2d",{alpha:true}),
        finalCanvas.width,
        finalCanvas.height,
        protectedRegions
      );
      finalMetrics=measureFidelity(sourceBitmap,finalCanvas);
    }

    const format=$("imageExportFormat")?.value||"png";
    const blob=await canvasToBlob(
      finalCanvas,
      format
    );

    if(!blob)throw new Error("Could not create the enhanced image.");

    enhancedBlob=blob;

    if(enhancedUrl)URL.revokeObjectURL(enhancedUrl);
    enhancedUrl=URL.createObjectURL(blob);

    compareAfter.src=enhancedUrl;
    previewEmpty.classList.add("hidden");
    compareBox.classList.remove("hidden");
    protectionSelectMode=false;
    precisionProtectBtn?.classList.remove("active");
    redrawProtectedRegions();

    if(isImagePro()&&truthMapEnabled){
      renderTruthMap(sourceBitmap,finalCanvas,finalMetrics,decision);
      truthMapPanel?.classList.remove("hidden");
    }else{
      truthMapPanel?.classList.add("hidden");
    }

    if(isImagePro()&&printProofEnabled){
      renderPrintProof(response.width,response.height);
      printProofPanel?.classList.remove("hidden");
    }else{
      printProofPanel?.classList.add("hidden");
    }

    renderReport(
      finalMetrics,
      decision,
      response.width,
      response.height,
      prep.effectiveScale,
      response.provider,
      runtimeMs,
      response.performanceProfile
    );

    processing.classList.add("hidden");
    resultPanel.classList.remove("hidden");
    resultPanel.scrollIntoView({behavior:"smooth",block:"nearest"});
  }catch(error){
    processing.classList.add("hidden");
    alert(error?.message||"RIVANI Image Enhancer could not finish this image.");
  }finally{
    busy=false;
    enhanceBtn.disabled=!sourceBitmap;
  }
}

function prepareInputForModel(bitmap,targetScale){
  const budget=getDeviceOutputBudget(bitmap);
  let prepScale=1;

  const targetPixels=
    bitmap.width*
    bitmap.height*
    targetScale*
    targetScale;

  if(targetPixels>budget.maxPixels){
    prepScale=Math.min(
      prepScale,
      Math.sqrt(
        budget.maxPixels/
        targetPixels
      )
    );
  }

  const longest=Math.max(bitmap.width,bitmap.height)*targetScale;

  if(longest>budget.maxEdge){
    prepScale=Math.min(
      prepScale,
      budget.maxEdge/longest
    );
  }

  // Avoid tiny fractional resizes that only add work.
  if(prepScale>.97)prepScale=1;

  const width=Math.max(
    16,
    Math.round(bitmap.width*prepScale)
  );

  const height=Math.max(
    16,
    Math.round(bitmap.height*prepScale)
  );

  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;

  const ctx=canvas.getContext("2d",{
    alpha:true,
    willReadFrequently:true
  });

  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(bitmap,0,0,width,height);

  return {
    imageData:ctx.getImageData(0,0,width,height),
    width,
    height,
    workerScale:targetScale,
    effectiveScale:
      (width*targetScale)/
      bitmap.width,
    wasCapped:prepScale<.97,
    budget
  };
}

function getDeviceOutputBudget(bitmap){
  const memory=Number(navigator.deviceMemory)||0;
  const cores=Number(navigator.hardwareConcurrency)||4;
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||"") || window.matchMedia?.("(pointer:coarse)")?.matches;

  let maxPixels=DEFAULT_OUTPUT_PIXELS;
  let maxEdge=DEFAULT_OUTPUT_EDGE;

  // V25.2: the old fixed 24 MP cap rejected/capped modern phone photos too early.
  // These limits are only memory guards; enhancement math/model quality is unchanged.
  if(mobile){
    maxPixels=36_000_000;
    maxEdge=9200;

    if(memory&&memory<=2){
      maxPixels=28_000_000;
      maxEdge=8200;
    }else if(memory>=6||cores>=8){
      maxPixels=40_000_000;
      maxEdge=9800;
    }
  }else{
    maxPixels=48_000_000;
    maxEdge=12000;

    if(memory&&memory<=4){
      maxPixels=40_000_000;
      maxEdge=10000;
    }else if(memory>=8&&cores>=8){
      maxPixels=56_000_000;
      maxEdge=13000;
    }
  }

  // Never reject a normal high-resolution source just because the requested
  // upscale is too large. For large originals, preserve at least the source
  // resolution when it is still within a bounded browser-memory envelope.
  const sourcePixels=bitmap.width*bitmap.height;
  const sourceEdge=Math.max(bitmap.width,bitmap.height);
  const preserveCeiling=mobile?44_000_000:64_000_000;

  if(sourcePixels<=preserveCeiling){
    maxPixels=Math.max(maxPixels,sourcePixels);
    maxEdge=Math.max(maxEdge,sourceEdge);
  }

  return {maxPixels,maxEdge,mobile,memory,cores};
}

function getImagePerformanceProfile(){
  const cores=Math.max(1,Number(navigator.hardwareConcurrency)||4);
  const memory=Math.max(0,Number(navigator.deviceMemory)||0);
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||"") ||
    window.matchMedia?.("(pointer:coarse)")?.matches;

  if(mobile)return "cool";

  // V25.5 device-aware defaults. The worker then self-tunes further from real
  // tile latency, so this is only the starting profile—not a quality mode.
  if(memory&&memory<=3)return "cool";
  if(cores>=12&&(memory===0||memory>=8))return "fast";
  if(cores>=8&&(memory===0||memory>=4))return "balanced";
  if(cores>=6&&(memory===0||memory>=6))return "balanced";
  return "cool";
}

function runWorker(worker,imageData,width,height,targetScale,performanceProfile){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      worker.terminate();
      reject(
        new Error(
          "Enhancement took too long on this device. Try 2× or a smaller image."
        )
      );
    },12*60*1000);

    worker.onmessage=event=>{
      const msg=event.data||{};

      if(msg.type==="model-progress"){
        setProgress(
          Math.min(28,Math.round(msg.progress*.30)),
          "Preparing AI model…",
          msg.text||"Downloading enhancement model.",
          msg.provider
        );
        return;
      }

      if(msg.type==="status"){
        const mapped=
          28+
          Math.round(
            Number(msg.progress||0)*.68
          );

        setProgress(
          Math.min(96,mapped),
          "Enhancing image…",
          msg.text||"Reconstructing clean detail.",
          msg.provider
        );
        return;
      }

      if(msg.type==="done"){
        clearTimeout(timer);
        worker.terminate();

        resolve({
          width:msg.width,
          height:msg.height,
          rgba:msg.rgba,
          provider:msg.provider||"RIVANI AI Engine",
          performanceProfile:msg.performanceProfile||performanceProfile||"balanced"
        });
        return;
      }

      if(msg.type==="error"){
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(msg.message||"Image enhancement failed."));
      }
    };

    worker.onerror=event=>{
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message||"Image enhancement worker failed."));
    };

    const copy=new Uint8ClampedArray(imageData.data);

    worker.postMessage({
      type:"enhance",
      width,
      height,
      targetScale,
      performanceProfile,
      rgba:copy.buffer
    },[copy.buffer]);
  });
}

function decideGuard(metrics,mode,guard,textSafe,colorSafe,scan){
  const base={
    natural:.82,
    strong:.96,
    restore:.90
  }[mode]||.82;

  let blend=base;
  let risk="low";
  const reasons=[];

  // V25.4: the earlier guard treated ordinary Real-ESRGAN variation as medium
  // risk too easily, which pulled Strong all the way down to a 70% AI blend.
  // These thresholds still Safe-Pass genuine drift while allowing verified
  // model detail to survive in normal photographs.
  if(metrics.structure<.78){
    risk="high";
    reasons.push("structure drift");
  }else if(metrics.structure<.86){
    risk="medium";
    reasons.push("structure variation");
  }

  if(metrics.edgeRatio>3.0){
    risk="high";
    reasons.push("extreme edge amplification");
  }else if(metrics.edgeRatio>2.40){
    risk=risk==="high"?"high":"medium";
    reasons.push("edge amplification");
  }

  if(metrics.colorDrift>.15||Math.abs(metrics.lumaDrift)>.14){
    risk="high";
    reasons.push("strong tonal/color drift");
  }else if(metrics.colorDrift>.10||Math.abs(metrics.lumaDrift)>.09){
    risk=risk==="high"?"high":"medium";
    reasons.push("color or brightness drift");
  }

  // Text & Logo Safe is no longer a blanket 84% cap over the whole photo.
  // It only reins in the model when the verification signals show that fine
  // structure is actually being pushed hard. This keeps landscapes/portraits
  // detailed while still protecting edge-dense brand/text content.
  const sensitive=scan?.detail?.[0]==="Sensitive";
  if(textSafe){
    if(metrics.edgeRatio>2.05)blend-=sensitive?.06:.04;
    if(metrics.structure<.90)blend-=sensitive?.04:.02;
  }

  // Color Lock now has a real tonal/chroma correction pass in composeFinal().
  // Only severe verified drift reduces AI strength here.
  if(colorSafe&&(metrics.colorDrift>.075||Math.abs(metrics.lumaDrift)>.07)){
    blend-=.03;
  }

  if(guard){
    if(risk==="high"){
      blend=0;
    }else if(risk==="medium"){
      const mediumCap=mode==="strong"?.84:mode==="restore"?.80:.76;
      blend=Math.min(blend,mediumCap);
    }
  }

  if(!(guard&&risk==="high")){
    blend=Math.max(.40,Math.min(.97,blend));
  }

  return {
    blend,
    risk,
    reasons
  };
}

function composeFinal(
  source,
  aiCanvas,
  width,
  height,
  blend,
  colorSafe,
  metrics,
  regions=[]
){
  const ctx=aiCanvas.getContext("2d",{alpha:true});

  // Keep the AI result as the detail carrier and blend the original truth
  // anchor over it. No extra full-resolution result canvas is allocated.
  ctx.save();
  ctx.globalCompositeOperation="source-over";
  ctx.globalAlpha=Math.max(0,Math.min(1,1-blend));
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(source,0,0,width,height);
  ctx.restore();

  if(colorSafe&&blend>0){
    // Color Lock V25.4: correct global chroma and luminance drift with partial
    // source blend modes. This preserves AI micro-detail far better than simply
    // lowering the whole AI blend whenever the model shifts exposure/color.
    const chromaAlpha=Math.min(.22,Math.max(0,(metrics?.colorDrift||0)-.018)*2.4);
    const lumaAlpha=Math.min(.28,Math.abs(metrics?.lumaDrift||0)*3.4);

    if(chromaAlpha>.015){
      ctx.save();
      ctx.globalCompositeOperation="color";
      ctx.globalAlpha=chromaAlpha;
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";
      ctx.drawImage(source,0,0,width,height);
      ctx.restore();
    }

    if(lumaAlpha>.015){
      ctx.save();
      ctx.globalCompositeOperation="luminosity";
      ctx.globalAlpha=lumaAlpha;
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";
      ctx.drawImage(source,0,0,width,height);
      ctx.restore();
    }
  }

  if(regions?.length){
    applyProtectedRegions(source,ctx,width,height,regions);
  }

  // Preserve original transparency exactly.
  ctx.save();
  ctx.globalCompositeOperation="destination-in";
  ctx.globalAlpha=1;
  ctx.drawImage(source,0,0,width,height);
  ctx.restore();

  return aiCanvas;
}

function measureFidelity(source,enhancedCanvas){
  const max=220;
  const ratio=Math.min(
    1,
    max/source.width,
    max/source.height
  );

  const width=Math.max(32,Math.round(source.width*ratio));
  const height=Math.max(32,Math.round(source.height*ratio));

  const a=document.createElement("canvas");
  const b=document.createElement("canvas");
  a.width=b.width=width;
  a.height=b.height=height;

  const ac=a.getContext("2d",{willReadFrequently:true});
  const bc=b.getContext("2d",{willReadFrequently:true});

  ac.imageSmoothingEnabled=true;
  bc.imageSmoothingEnabled=true;
  ac.imageSmoothingQuality="high";
  bc.imageSmoothingQuality="high";

  ac.drawImage(source,0,0,width,height);
  bc.drawImage(enhancedCanvas,0,0,width,height);

  const A=ac.getImageData(0,0,width,height).data;
  const B=bc.getImageData(0,0,width,height).data;

  let meanA=0,meanB=0;
  let varA=0,varB=0,cov=0;
  let colorDiff=0;
  let edgeA=0,edgeB=0;
  const n=width*height;
  const la=new Float32Array(n);
  const lb=new Float32Array(n);

  for(let i=0;i<n;i++){
    const p=i*4;

    const ya=
      A[p]*.2126+
      A[p+1]*.7152+
      A[p+2]*.0722;

    const yb=
      B[p]*.2126+
      B[p+1]*.7152+
      B[p+2]*.0722;

    la[i]=ya;
    lb[i]=yb;
    meanA+=ya;
    meanB+=yb;

    colorDiff+=(
      Math.abs(A[p]-B[p])+
      Math.abs(A[p+1]-B[p+1])+
      Math.abs(A[p+2]-B[p+2])
    )/(3*255);
  }

  meanA/=n;
  meanB/=n;

  for(let i=0;i<n;i++){
    const da=la[i]-meanA;
    const db=lb[i]-meanB;
    varA+=da*da;
    varB+=db*db;
    cov+=da*db;
  }

  varA/=Math.max(1,n-1);
  varB/=Math.max(1,n-1);
  cov/=Math.max(1,n-1);

  for(let y=1;y<height-1;y+=2){
    for(let x=1;x<width-1;x+=2){
      const i=y*width+x;

      const ga=Math.hypot(
        la[i+1]-la[i-1],
        la[i+width]-la[i-width]
      );

      const gb=Math.hypot(
        lb[i+1]-lb[i-1],
        lb[i+width]-lb[i-width]
      );

      edgeA+=ga;
      edgeB+=gb;
    }
  }

  const c1=(.01*255)**2;
  const c2=(.03*255)**2;

  const ssim=(
    (2*meanA*meanB+c1)*
    (2*cov+c2)
  )/(
    (meanA*meanA+meanB*meanB+c1)*
    (varA+varB+c2)
  );

  return {
    structure:Math.max(0,Math.min(1,ssim)),
    colorDrift:colorDiff/n,
    lumaDrift:(meanB-meanA)/255,
    edgeRatio:
      edgeA>1e-6
        ?edgeB/edgeA
        :1
  };
}

function renderReport(
  metrics,
  decision,
  width,
  height,
  effectiveScale,
  provider,
  runtimeMs,
  performanceProfile
){
  const structurePct=Math.round(metrics.structure*100);
  const colorPct=Math.round(metrics.colorDrift*100);
  const edgeDelta=Math.round((metrics.edgeRatio-1)*100);
  const blendPct=Math.round(decision.blend*100);

  $("reportStructure").textContent=`${structurePct}%`;
  $("reportStructureNote").textContent=
    structurePct>=92
      ?"Original geometry strongly preserved"
      :structurePct>=84
        ?"Guard kept structure within a safe range"
        :"Conservative result used";

  $("reportColor").textContent=
    colorPct<=2
      ?"Very low"
      :colorPct<=5
        ?"Low"
        :"Moderate";

  const tonePct=Math.round(metrics.lumaDrift*1000)/10;
  $("reportColorNote").textContent=
    `${colorPct}% sampled color difference · tone ${tonePct>0?"+":""}${tonePct}%`;

  $("reportEdges").textContent=
    edgeDelta<=35
      ?"Natural"
      :edgeDelta<=80
        ?"Enhanced"
        :"Strong";

  $("reportEdgesNote").textContent=
    edgeDelta>=0
      ?`+${edgeDelta}% sampled edge energy`
      :`${edgeDelta}% sampled edge energy`;

  $("reportBlend").textContent=`${blendPct}%`;
  $("reportBlendNote").textContent=
    decision.risk==="low"
      ?"Full confidence range"
      :decision.risk==="medium"
        ?"Fidelity Guard reduced AI strength"
        :"Safe Result protection applied";

  const safe=
    decision.risk!=="high"||
    decision.blend<=.58;

  resultStatus.textContent=safe?"SAFE":"CAUTION";
  resultStatus.classList.toggle("safe",safe);
  resultStatus.classList.toggle("caution",!safe);

  resultHeadline.textContent=
    decision.risk==="low"
      ?"Enhanced result verified"
      :decision.risk==="medium"
        ?"Enhanced with Fidelity Guard"
        :"Safe Result protected the original";

  $("imageOutputDimensions").textContent=
    `${width.toLocaleString()} × ${height.toLocaleString()}`;

  $("imageEffectiveScale").textContent=
    `${effectiveScale.toFixed(effectiveScale>=3?1:2)}× effective scale`;

  const profileLabel=
    performanceProfile==="fast"
      ?"Fast"
      :performanceProfile==="cool"
        ?"Cool"
        :"Balanced";

  $("imageRuntimeProvider").textContent=
    String(provider||"").startsWith("WebGPU")
      ?`GPU accelerated · ${profileLabel}`
      :`Compatibility engine · ${profileLabel}`;

  const seconds=Math.max(0,Number(runtimeMs)||0)/1000;
  $("imageRuntimeTime").textContent=
    seconds>=60
      ?`${Math.floor(seconds/60)}m ${Math.round(seconds%60)}s`
      :`${seconds.toFixed(seconds<10?1:0)}s`;
}

function setProgress(percent,title,text,provider){
  const p=Math.max(0,Math.min(100,Math.round(percent)));
  progressFill.style.width=`${p}%`;
  progressPercent.textContent=`${p}%`;

  if(title)processingTitle.textContent=title;
  if(text)processingText.textContent=text;

  if(provider){
    providerText.textContent=
      String(provider).startsWith("WebGPU")
        ?"RIVANI GPU Engine"
        :String(provider).startsWith("WASM")
          ?"RIVANI Compatibility Engine"
          :"RIVANI AI Engine";
  }
}

function setCompare(_value){
  // V25.5 uses separate Original and Enhanced panels instead of a drag slider.
}

function openImagePro(title,copy){
  if(!imageProModal)return;
  if(imageProModalTitle)imageProModalTitle.textContent=title||"RIVANI Pro";
  if(imageProModalCopy)imageProModalCopy.textContent=copy||"This precision control is included with RIVANI Pro.";
  imageProModal.classList.remove("hidden");
  document.body.style.overflow="hidden";
}

function closeImagePro(){
  imageProModal?.classList.add("hidden");
  document.body.style.overflow="";
}

function previewImageRect(){
  if(!previewShell||!sourceBitmap)return null;
  const rect=previewShell.getBoundingClientRect();
  const w=rect.width;
  const h=rect.height;
  if(w<2||h<2)return null;
  const scale=Math.min(w/sourceBitmap.width,h/sourceBitmap.height);
  const iw=sourceBitmap.width*scale;
  const ih=sourceBitmap.height*scale;
  return {left:(w-iw)/2,top:(h-ih)/2,width:iw,height:ih};
}

function resizeProtectCanvas(){
  if(!protectCanvas||!previewShell)return;
  const rect=previewShell.getBoundingClientRect();
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const width=Math.max(1,Math.round(rect.width*dpr));
  const height=Math.max(1,Math.round(rect.height*dpr));
  if(protectCanvas.width!==width||protectCanvas.height!==height){
    protectCanvas.width=width;
    protectCanvas.height=height;
  }
  protectCanvas.dataset.dpr=String(dpr);
}

function redrawProtectedRegions(temp=null){
  if(!protectCanvas)return;
  resizeProtectCanvas();
  const dpr=Number(protectCanvas.dataset.dpr)||1;
  const ctx=protectCanvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,protectCanvas.width/dpr,protectCanvas.height/dpr);
  const imageRect=previewImageRect();
  const visible=Boolean(sourceBitmap&&protectionSelectMode);
  protectCanvas.classList.toggle("hidden",!visible);
  protectCanvas.classList.toggle("selecting",Boolean(protectionSelectMode));
  if(!imageRect){updateProtectedRegionStatus();return;}

  const drawRegion=(r,temporary=false)=>{
    const x=imageRect.left+r.x*imageRect.width;
    const y=imageRect.top+r.y*imageRect.height;
    const w=r.w*imageRect.width;
    const h=r.h*imageRect.height;
    ctx.save();
    ctx.lineWidth=temporary?2:2.5;
    ctx.strokeStyle=temporary?"rgba(120,220,255,.95)":"rgba(124,119,255,.95)";
    ctx.fillStyle=temporary?"rgba(80,190,255,.10)":"rgba(105,84,255,.11)";
    ctx.setLineDash(temporary?[7,5]:[]);
    ctx.fillRect(x,y,w,h);
    ctx.strokeRect(x+.5,y+.5,Math.max(0,w-1),Math.max(0,h-1));
    ctx.restore();
  };

  protectedRegions.forEach(r=>drawRegion(r,false));
  if(temp)drawRegion(temp,true);
  updateProtectedRegionStatus();
}

function pointToProtectedRegion(start,end){
  const r=previewImageRect();
  if(!r)return null;
  const x1=Math.max(r.left,Math.min(r.left+r.width,start.x));
  const y1=Math.max(r.top,Math.min(r.top+r.height,start.y));
  const x2=Math.max(r.left,Math.min(r.left+r.width,end.x));
  const y2=Math.max(r.top,Math.min(r.top+r.height,end.y));
  const left=Math.min(x1,x2),top=Math.min(y1,y2);
  const width=Math.abs(x2-x1),height=Math.abs(y2-y1);
  if(width<10||height<10)return null;
  return {
    x:(left-r.left)/r.width,
    y:(top-r.top)/r.height,
    w:width/r.width,
    h:height/r.height
  };
}

function protectPointer(event){
  const rect=protectCanvas.getBoundingClientRect();
  return {x:event.clientX-rect.left,y:event.clientY-rect.top};
}

function beginProtectionDrag(event){
  if(!protectionSelectMode||!isImagePro()||!sourceBitmap)return;
  if(protectedRegions.length>=5){
    alert("Up to 5 protected areas can be selected per image.");
    return;
  }
  const start=protectPointer(event);
  const r=previewImageRect();
  if(!r||start.x<r.left||start.x>r.left+r.width||start.y<r.top||start.y>r.top+r.height)return;
  protectDrag={start,current:start};
  protectCanvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function moveProtectionDrag(event){
  if(!protectDrag)return;
  protectDrag.current=protectPointer(event);
  redrawProtectedRegions(pointToProtectedRegion(protectDrag.start,protectDrag.current));
  event.preventDefault();
}

function endProtectionDrag(event){
  if(!protectDrag)return;
  const region=pointToProtectedRegion(protectDrag.start,protectPointer(event));
  protectDrag=null;
  if(region)protectedRegions.push(region);
  redrawProtectedRegions();
  event.preventDefault();
}

function cancelProtectionDrag(){
  protectDrag=null;
  redrawProtectedRegions();
}

function updateProtectedRegionStatus(){
  const count=protectedRegions.length;
  if(protectedRegionStatus){
    protectedRegionStatus.textContent=count
      ?`${count} protected area${count===1?"":"s"} selected`
      :protectionSelectMode
        ?"Drag over a logo, face, text or critical detail"
        :"No protected areas";
  }
  clearProtectedRegionBtn?.classList.toggle("hidden",count===0);
  if(protectedMeta){
    protectedMeta.classList.toggle("hidden",count===0);
    if(count)protectedMeta.textContent=`${count} precision-protected area${count===1?"":"s"}`;
  }
}

function applyProtectedRegions(source,ctx,width,height,regions){
  for(const r of regions.slice(0,5)){
    const sx=Math.max(0,r.x*source.width);
    const sy=Math.max(0,r.y*source.height);
    const sw=Math.max(1,Math.min(source.width-sx,r.w*source.width));
    const sh=Math.max(1,Math.min(source.height-sy,r.h*source.height));
    const dx=r.x*width;
    const dy=r.y*height;
    const dw=r.w*width;
    const dh=r.h*height;

    // Feathered truth-anchor edge: a few low-alpha expanded passes avoid a
    // hard rectangular seam, then the selected core is restored exactly.
    for(let step=4;step>=1;step--){
      const px=(dw*.004)*step;
      const py=(dh*.004)*step;
      ctx.save();
      ctx.globalCompositeOperation="source-over";
      ctx.globalAlpha=.055;
      ctx.drawImage(source,sx,sy,sw,sh,dx-px,dy-py,dw+px*2,dh+py*2);
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation="source-over";
    ctx.globalAlpha=1;
    ctx.drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh);
    ctx.restore();
  }
}

function repairVerifiedTone(source,canvas,metrics){
  let current=metrics;
  const ctx=canvas.getContext("2d",{alpha:true});
  for(let pass=0;pass<2;pass++){
    const luma=Math.abs(current.lumaDrift||0);
    const color=current.colorDrift||0;
    if(luma<=.028&&color<=.045)break;

    if(color>.035){
      ctx.save();
      ctx.globalCompositeOperation="color";
      ctx.globalAlpha=Math.min(.34,Math.max(.05,(color-.025)*4.0));
      ctx.drawImage(source,0,0,canvas.width,canvas.height);
      ctx.restore();
    }
    if(luma>.018){
      ctx.save();
      ctx.globalCompositeOperation="luminosity";
      ctx.globalAlpha=Math.min(.62,Math.max(.08,luma*7.2));
      ctx.drawImage(source,0,0,canvas.width,canvas.height);
      ctx.restore();
    }
    current=measureFidelity(source,canvas);
  }
  return current;
}

function renderTruthMap(source,enhancedCanvas,metrics,decision){
  if(!truthMapCanvas)return;
  const width=240;
  const height=Math.max(120,Math.round(width*(source.height/source.width)));
  truthMapCanvas.width=width;
  truthMapCanvas.height=height;
  const a=document.createElement("canvas");
  const b=document.createElement("canvas");
  a.width=b.width=width;a.height=b.height=height;
  const ac=a.getContext("2d",{willReadFrequently:true});
  const bc=b.getContext("2d",{willReadFrequently:true});
  ac.drawImage(source,0,0,width,height);
  bc.drawImage(enhancedCanvas,0,0,width,height);
  const A=ac.getImageData(0,0,width,height).data;
  const B=bc.getImageData(0,0,width,height).data;
  const ctx=truthMapCanvas.getContext("2d");
  const map=ctx.createImageData(width,height);
  let changed=0,sum=0;
  for(let i=0;i<width*height;i++){
    const p=i*4;
    const d=(Math.abs(A[p]-B[p])+Math.abs(A[p+1]-B[p+1])+Math.abs(A[p+2]-B[p+2]))/(3*255);
    const t=Math.min(1,d*5.5);
    sum+=d;if(d>.075)changed++;
    map.data[p]=Math.round(22+t*220);
    map.data[p+1]=Math.round(82+(1-Math.abs(t-.45)*2)*Math.max(0,72));
    map.data[p+2]=Math.round(155+(1-t)*85);
    map.data[p+3]=230;
  }
  ctx.putImageData(map,0,0);

  // Draw precision-protected regions as outlines on the Truth Map.
  if(protectedRegions.length){
    ctx.save();
    ctx.strokeStyle="rgba(215,240,255,.95)";
    ctx.lineWidth=2;
    for(const r of protectedRegions){
      ctx.strokeRect(r.x*width+.5,r.y*height+.5,r.w*width-1,r.h*height-1);
    }
    ctx.restore();
  }

  const avg=sum/(width*height);
  const changedPct=Math.round(changed/(width*height)*100);
  const level=avg<.025?"Low":avg<.055?"Moderate":"High";
  if(truthMapStatus)truthMapStatus.textContent=`${level} change`;
  if(truthMapNote){
    truthMapNote.textContent=decision.risk==="high"
      ?`Safe Result protection was triggered. ${changedPct}% of sampled pixels crossed the change threshold before protection.`
      :`${changedPct}% of sampled pixels show meaningful verified change. Structure ${Math.round(metrics.structure*100)}% preserved.${protectedRegions.length?` ${protectedRegions.length} selected area${protectedRegions.length===1?"":"s"} anchored to the original.`:""}`;
  }
}

function renderPrintProof(width,height){
  if(!printProofValue)return;
  const inchW=width/300;
  const inchH=height/300;
  const cmW=inchW*2.54;
  const cmH=inchH*2.54;
  printProofValue.textContent=`${cmW.toFixed(1)} × ${cmH.toFixed(1)} cm · ${inchW.toFixed(1)} × ${inchH.toFixed(1)} in at 300 DPI`;
}

function drawSample(bitmap,maxSize){
  const ratio=Math.min(
    1,
    maxSize/bitmap.width,
    maxSize/bitmap.height
  );

  const canvas=document.createElement("canvas");
  canvas.width=Math.max(16,Math.round(bitmap.width*ratio));
  canvas.height=Math.max(16,Math.round(bitmap.height*ratio));

  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);

  return {canvas,ctx};
}

function canvasToBlob(canvas,format){
  const type=
    format==="jpeg"
      ?"image/jpeg"
      :format==="webp"
        ?"image/webp"
        :"image/png";

  const quality=
    format==="jpeg"
      ?.94
      :format==="webp"
        ?.95
        :undefined;

  return new Promise(resolve=>{
    canvas.toBlob(resolve,type,quality);
  });
}

function looksLikeImageFile(file){
  if(file?.type?.startsWith("image/"))return true;
  return /\.(jpe?g|png|webp|avif|gif|bmp|svg|heic|heif)$/i.test(file?.name||"");
}

async function decodeImageSource(file){
  if("createImageBitmap" in window){
    try{
      return await createImageBitmap(file,{imageOrientation:"from-image"});
    }catch(_){
      // Fall through to the browser image decoder. This covers formats that the
      // <img> pipeline can decode even when createImageBitmap cannot.
    }
  }

  const url=URL.createObjectURL(file);
  try{
    return await new Promise((resolve,reject)=>{
      const img=new Image();
      img.decoding="async";
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error("Unsupported image format."));
      img.src=url;
    });
  }finally{
    URL.revokeObjectURL(url);
  }
}

function resetForAnotherImage(){
  if(sourceBitmap?.close)sourceBitmap.close();
  if(sourceUrl)URL.revokeObjectURL(sourceUrl);
  if(enhancedUrl)URL.revokeObjectURL(enhancedUrl);

  sourceFile=null;
  sourceBitmap=null;
  sourceUrl="";
  enhancedUrl="";
  enhancedBlob=null;
  currentScan=null;
  protectedRegions=[];
  protectionSelectMode=false;
  protectDrag=null;
  precisionProtectBtn?.classList.remove("active");
  truthMapPanel?.classList.add("hidden");
  printProofPanel?.classList.add("hidden");

  if(fileInput)fileInput.value="";
  originalPreview?.removeAttribute("src");
  compareBefore?.removeAttribute("src");
  compareAfter?.removeAttribute("src");
  previewEmpty?.classList.remove("hidden");
  compareBox?.classList.add("hidden");
  resultPanel?.classList.add("hidden");
  processing?.classList.add("hidden");
  editor?.classList.add("hidden");
  dropZone?.classList.remove("hidden");
  enhanceBtn.disabled=true;
  redrawProtectedRegions();
  setProgress(0,"Preparing enhancement…","Your image remains on this device.");
  dropZone?.scrollIntoView({behavior:"smooth",block:"center"});
}

function friendlyType(type){
  if(type==="image/jpeg")return "JPG";
  if(type==="image/png")return "PNG";
  if(type==="image/webp")return "WebP";
  if(type==="image/avif")return "AVIF";
  if(type==="image/gif")return "GIF";
  if(type==="image/bmp")return "BMP";
  if(type==="image/svg+xml")return "SVG";
  if(type==="image/heic")return "HEIC";
  if(type==="image/heif")return "HEIF";
  return "Image";
}

function formatBytes(bytes){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

function escapeHtml(value){
  return String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

})();