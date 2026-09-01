(()=>{"use strict";

// RIVANI Image Enhancer V26.3 · Precision Suite + Filters + Free 9/day + account gate

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
const compareRange=$("imageCompareRange");
const exportSelect=$("imageExportFormat");
const exportQualitySelect=$("imageExportQuality");
const aiStrengthInput=$("aiStrength");
const aiStrengthValue=$("aiStrengthValue");
const clarityInput=$("clarityControl");
const clarityValue=$("clarityValue");
const sharpnessInput=$("sharpnessControl");
const sharpnessValue=$("sharpnessValue");
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
const printPresetSelect=$("printPresetSelect");
const protectedMeta=$("imageProtectedMeta");
const imageProModal=$("imageProModal");
const imageProModalTitle=$("imageProModalTitle");
const imageProModalCopy=$("imageProModalCopy");
const hdFinishToggle=$("hdFinishToggle");
const hdFinishStrengthInput=$("hdFinishStrength");
const hdFinishStrengthValue=$("hdFinishStrengthValue");
const hdFinishMeta=$("imageHdFinishMeta");
const filterStrengthInput=$("filterStrength");
const filterStrengthValue=$("filterStrengthValue");
const faceIdentityLockBtn=$("faceIdentityLockBtn");
const faceIdentityStatus=$("faceIdentityStatus");
const faceReferenceBtn=$("faceReferenceBtn");
const faceReferenceInput=$("faceReferenceInput");
const faceReferenceStatus=$("faceReferenceStatus");
const logoReferenceLockBtn=$("logoReferenceLockBtn");
const logoReferenceStatus=$("logoReferenceStatus");
const logoReferenceBtn=$("logoReferenceBtn");
const logoReferenceInput=$("logoReferenceInput");
const logoReferenceFileStatus=$("logoReferenceFileStatus");
const exactColorLockToggle=$("exactColorLockToggle");
const exactColorPicker=$("exactColorPicker");
const revertBrushToggle=$("revertBrushToggle");
const revertBrushCanvas=$("revertBrushCanvas");
const revertBrushSizeInput=$("revertBrushSize");
const revertBrushSizeValue=$("revertBrushSizeValue");
const qrGuardToggle=$("qrGuardToggle");
const qrGuardStatus=$("qrGuardStatus");
const batchConsistencyBtn=$("batchConsistencyBtn");
const batchImageInput=$("batchImageInput");
const batchResultsPanel=$("batchResultsPanel");
const batchResultsTitle=$("batchResultsTitle");
const batchResultsList=$("batchResultsList");
const imageFreeUsageCard=$("imageFreeUsageCard");
const imageFreeUsageText=$("imageFreeUsageText");
const imageFreeUsageProBtn=$("imageFreeUsageProBtn");
const imageProBuyBtn=$("imageProBuyBtn");

const DEFAULT_OUTPUT_PIXELS=36_000_000;
const DEFAULT_OUTPUT_EDGE=9000;
const FREE_IMAGE_DAILY_JOBS=9;
const FREE_IMAGE_USAGE_PREFIX="rivani_free_image_usage_v1";
const PRO_PRICE_INR=499;
const PRO_CHECKOUT_URL=String(window.RIVANI_PRO_CHECKOUT_URL||"").trim();

let sourceFile=null;
let sourceBitmap=null;
let sourceUrl="";
let enhancedUrl="";
let enhancedBlob=null;
let enhancedFormat="png";
let enhancedFileBytes=0;
let enhancedExportQuality="high";
let reencodeBusy=false;

let imageMode="natural";
let requestedScale=2;
let fidelityGuard=true;
let textLogoSafe=true;
let colorLock=true;
let hdFinish=true;
let hdFinishStrength=80;
let aiStrength=100;
let clarity=40;
let sharpness=30;
let busy=false;
let currentScan=null;
let currentImagePlan="free";
let protectionSelectMode=false;
let protectedRegions=[];
let truthMapEnabled=false;
let printProofEnabled=false;
let printPreset="none";
let protectDrag=null;
let precisionSelectionKind="critical";
let faceRegions=[];
let logoRegions=[];
let faceReferenceDescriptor=null;
let logoReferenceDescriptor=null;
let faceReferenceName="";
let logoReferenceName="";
let selectedFilter="none";
let filterStrength=60;
let exactColorLock=false;
let exactColorHex="#7c77ff";
let qrGuardEnabled=false;
let revertBrushEnabled=false;
let revertBrushSize=48;
let revertBrushDrawing=false;
let revertBrushLastPoint=null;
let currentResultCanvas=null;
let batchBusy=false;

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
    const value=Number(btn.dataset.imageScale);
    requestedScale=[1,2,4,8].includes(value)?value:2;

    document.querySelectorAll("[data-image-scale]").forEach(item=>{
      item.classList.toggle("active",item===btn);
    });
  });
});

bindToggle("fidelityGuardToggle",value=>fidelityGuard=value);
bindToggle("textSafeToggle",value=>textLogoSafe=value);
bindToggle("colorLockToggle",value=>colorLock=value);
bindToggle("hdFinishToggle",value=>{
  hdFinish=value;
  document.querySelector(".image-finish-strength")?.classList.toggle("is-disabled",!value);
});

hdFinishStrengthInput?.addEventListener("input",()=>{
  hdFinishStrength=Math.max(0,Math.min(100,Number(hdFinishStrengthInput.value)||0));
  if(hdFinishStrengthValue)hdFinishStrengthValue.textContent=`${hdFinishStrength}%`;
});

function bindPercentSlider(input,valueEl,setter){
  input?.addEventListener("input",()=>{
    const value=Math.max(0,Math.min(100,Number(input.value)||0));
    setter(value);
    if(valueEl)valueEl.textContent=`${Math.round(value)}%`;
  });
}
bindPercentSlider(aiStrengthInput,aiStrengthValue,value=>aiStrength=value);
bindPercentSlider(clarityInput,clarityValue,value=>clarity=value);
bindPercentSlider(sharpnessInput,sharpnessValue,value=>sharpness=value);

filterStrengthInput?.addEventListener("input",()=>{
  filterStrength=Math.max(0,Math.min(100,Number(filterStrengthInput.value)||0));
  if(filterStrengthValue)filterStrengthValue.textContent=`${filterStrength}%`;
});
document.querySelectorAll("[data-image-filter]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    selectedFilter=String(btn.dataset.imageFilter||"none");
    document.querySelectorAll("[data-image-filter]").forEach(item=>item.classList.toggle("active",item===btn));
  });
});

compareRange?.addEventListener("input",()=>setCompare(compareRange.value));
const requestReencode=()=>{
  if(enhancedBlob&&!busy)reencodeCurrentResult().catch(error=>{
    console.warn("RIVANI re-encode failed",error);
  });
};
exportSelect?.addEventListener("change",requestReencode);
exportQualitySelect?.addEventListener("change",requestReencode);

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

  const format=enhancedFormat||"png";
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
  renderImageDailyUsage();
}

function isImagePro(){
  return currentImagePlan==="pro";
}

function imageTodayKey(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function imageUsageStorageKey(){
  const uid=String(window.RIVANI_LUKI_CONTEXT?.uid||"signed-user").replace(/[^A-Za-z0-9_-]/g,"");
  return `${FREE_IMAGE_USAGE_PREFIX}:${uid||"signed-user"}`;
}
function readImageDailyUsage(){
  try{
    const parsed=JSON.parse(localStorage.getItem(imageUsageStorageKey())||"{}");
    if(parsed.date!==imageTodayKey())return {date:imageTodayKey(),count:0};
    return {date:parsed.date,count:Math.max(0,Math.floor(Number(parsed.count)||0))};
  }catch(_error){return {date:imageTodayKey(),count:0};}
}
function writeImageDailyUsage(count){
  try{localStorage.setItem(imageUsageStorageKey(),JSON.stringify({date:imageTodayKey(),count:Math.max(0,Math.floor(Number(count)||0))}));}catch(_error){}
  renderImageDailyUsage();
}
function imageJobsRemaining(){return Math.max(0,FREE_IMAGE_DAILY_JOBS-readImageDailyUsage().count);}
function recordCompletedImageJob(){
  if(isImagePro())return;
  const usage=readImageDailyUsage();
  writeImageDailyUsage(usage.count+1);
}
function renderImageDailyUsage(){
  if(!imageFreeUsageText)return;
  const signedIn=Boolean(window.RIVANI_LUKI_CONTEXT?.signedIn);
  if(!signedIn){
    imageFreeUsageText.textContent="Sign up before your first enhancement.";
    imageFreeUsageCard?.classList.remove("limit-reached");
    if(enhanceBtn&&sourceBitmap&&!busy)enhanceBtn.disabled=false;
    return;
  }
  if(isImagePro()){
    imageFreeUsageText.textContent="Pro · unlimited image enhancement jobs";
    imageFreeUsageCard?.classList.remove("limit-reached");
    if(enhanceBtn&&sourceBitmap&&!busy)enhanceBtn.disabled=false;
    return;
  }
  const left=imageJobsRemaining();
  imageFreeUsageText.textContent=left>0?`${left} of ${FREE_IMAGE_DAILY_JOBS} enhancements left today`:`Daily limit reached · unlock Pro to continue`;
  imageFreeUsageCard?.classList.toggle("limit-reached",left<=0);
  if(enhanceBtn&&sourceBitmap&&!busy)enhanceBtn.disabled=left<=0;
}
async function requireImageAccount(){
  if(window.RIVANI_REQUIRE_AUTH)return await window.RIVANI_REQUIRE_AUTH({tool:"Image Enhancer"});
  if(window.RIVANI_LUKI_CONTEXT?.signedIn)return true;
  const next=encodeURIComponent(`image-enhancer.html${location.search||""}`);
  location.href=`auth.html?mode=signup&next=${next}`;
  return false;
}
function startImageProCheckout(){
  if(PRO_CHECKOUT_URL){location.href=PRO_CHECKOUT_URL;return;}
  openImagePro("RIVANI Pro",`Free includes ${FREE_IMAGE_DAILY_JOBS} image enhancements per day. RIVANI Pro is ₹${PRO_PRICE_INR}/month in India and unlocks unlimited image jobs plus all precision controls. Secure checkout will open here once billing is connected.`);
}
function showImageDailyLimit(){
  openImagePro("Free daily limit reached",`You used all ${FREE_IMAGE_DAILY_JOBS} free image enhancements for today. Upgrade to RIVANI Pro for unlimited image enhancement jobs and the full Precision Suite.`);
}
function requireSignedForPrecisionAction(){
  if(window.RIVANI_LUKI_CONTEXT?.signedIn)return true;
  if(window.RIVANI_REQUIRE_AUTH)window.RIVANI_REQUIRE_AUTH({tool:"Image Enhancer"});
  else location.href="auth.html?mode=signup&next=image-enhancer.html";
  return false;
}

window.addEventListener("rivani:auth-context",event=>syncImagePlan(event.detail));
syncImagePlan(window.RIVANI_LUKI_CONTEXT||{});
imageFreeUsageProBtn?.addEventListener("click",startImageProCheckout);
imageProBuyBtn?.addEventListener("click",startImageProCheckout);

function enterPrecisionSelection(kind){
  if(!sourceBitmap){
    alert("Choose an image first, then mark the area you want RIVANI to protect.");
    return;
  }
  if(!requireSignedForPrecisionAction())return;
  if(!isImagePro()){
    const labels={
      critical:["Critical Area Lock","Select up to five important regions. RIVANI restores those exact regions from the original after enhancement."],
      face:["Face Identity Lock","Mark up to three face regions. RIVANI keeps facial geometry source-anchored while retaining a controlled amount of enhanced detail."],
      logo:["Logo Reference Lock","Mark logo or brand regions and optionally attach a clean reference image for verification."]
    };
    const item=labels[kind]||labels.critical;
    openImagePro(item[0],item[1]);
    return;
  }
  const turnOff=protectionSelectMode&&precisionSelectionKind===kind;
  precisionSelectionKind=kind;
  protectionSelectMode=!turnOff;
  [precisionProtectBtn,faceIdentityLockBtn,logoReferenceLockBtn].forEach(btn=>{btn?.classList.remove("active");btn?.setAttribute("aria-pressed","false");});
  const active=kind==="face"?faceIdentityLockBtn:kind==="logo"?logoReferenceLockBtn:precisionProtectBtn;
  if(protectionSelectMode){
    active?.classList.add("active");
    active?.setAttribute("aria-pressed","true");
    previewEmpty?.classList.remove("hidden");
    compareBox?.classList.add("hidden");
    resultPanel?.classList.add("hidden");
  }
  revertBrushEnabled=false;
  revertBrushToggle?.classList.remove("active");
  revertBrushToggle?.setAttribute("aria-pressed","false");
  redrawProtectedRegions();
}

precisionProtectBtn?.addEventListener("click",()=>enterPrecisionSelection("critical"));
faceIdentityLockBtn?.addEventListener("click",()=>enterPrecisionSelection("face"));
logoReferenceLockBtn?.addEventListener("click",()=>enterPrecisionSelection("logo"));

clearProtectedRegionBtn?.addEventListener("click",()=>{
  protectedRegions=[];
  faceRegions=[];
  logoRegions=[];
  protectionSelectMode=false;
  [precisionProtectBtn,faceIdentityLockBtn,logoReferenceLockBtn].forEach(btn=>{
    btn?.classList.remove("active");
    btn?.setAttribute("aria-pressed","false");
  });
  redrawProtectedRegions();
});

faceReferenceBtn?.addEventListener("click",()=>{
  if(!requireSignedForPrecisionAction())return;
  if(!isImagePro()){openImagePro("Face Reference Check","Attach an optional clear face reference. RIVANI uses a local visual-anchor comparison only; the reference never leaves your browser.");return;}
  faceReferenceInput?.click();
});
faceReferenceInput?.addEventListener("change",async()=>{
  const file=faceReferenceInput.files?.[0];if(!file)return;
  try{
    faceReferenceDescriptor=await descriptorFromFile(file);
    faceReferenceName=file.name||"reference";
    if(faceReferenceStatus)faceReferenceStatus.textContent=`Loaded · ${shortFileName(faceReferenceName)}`;
  }catch(error){alert(error?.message||"Could not read the face reference.");}
});
logoReferenceBtn?.addEventListener("click",()=>{
  if(!requireSignedForPrecisionAction())return;
  if(!isImagePro()){openImagePro("Logo Reference Lock","Attach a clean logo reference and mark the logo region in the source. RIVANI preserves that region and performs a local visual reference check.");return;}
  logoReferenceInput?.click();
});
logoReferenceInput?.addEventListener("change",async()=>{
  const file=logoReferenceInput.files?.[0];if(!file)return;
  try{
    logoReferenceDescriptor=await descriptorFromFile(file);
    logoReferenceName=file.name||"logo";
    if(logoReferenceFileStatus)logoReferenceFileStatus.textContent=`Loaded · ${shortFileName(logoReferenceName)}`;
  }catch(error){alert(error?.message||"Could not read the logo reference.");}
});

exactColorLockToggle?.addEventListener("click",()=>{
  if(!requireSignedForPrecisionAction())return;
  if(!isImagePro()){openImagePro("Exact Brand Color Lock","Choose a brand HEX color. Near-matching colors in the verified result are snapped back toward that exact target without changing geometry.");return;}
  exactColorLock=!exactColorLock;
  exactColorLockToggle.setAttribute("aria-pressed",String(exactColorLock));
  exactColorLockToggle.classList.toggle("active",exactColorLock);
});
exactColorPicker?.addEventListener("input",()=>{exactColorHex=String(exactColorPicker.value||"#7c77ff");});

qrGuardToggle?.addEventListener("click",()=>{
  if(!requireSignedForPrecisionAction())return;
  if(!isImagePro()){openImagePro("QR / Barcode Guard","RIVANI checks readable QR/barcodes before and after enhancement. If the enhanced code becomes unreadable or changes, its source region is restored.");return;}
  qrGuardEnabled=!qrGuardEnabled;
  qrGuardToggle.setAttribute("aria-pressed",String(qrGuardEnabled));
  qrGuardToggle.classList.toggle("active",qrGuardEnabled);
  if(qrGuardStatus)qrGuardStatus.textContent=qrGuardEnabled?"Verification armed":"Verification off";
});

revertBrushToggle?.addEventListener("click",()=>{
  if(!requireSignedForPrecisionAction())return;
  if(!isImagePro()){openImagePro("Selective Revert Brush","After enhancement, paint any part of the result back toward the original without rerunning the AI engine.");return;}
  if(!currentResultCanvas||compareBox?.classList.contains("hidden")){
    alert("Enhance an image first, then turn on the Revert Brush from the result view.");
    return;
  }
  revertBrushEnabled=!revertBrushEnabled;
  revertBrushToggle.setAttribute("aria-pressed",String(revertBrushEnabled));
  revertBrushToggle.classList.toggle("active",revertBrushEnabled);
  protectionSelectMode=false;
  redrawProtectedRegions();
  resizeRevertBrushCanvas();
  revertBrushCanvas?.classList.toggle("hidden",!revertBrushEnabled);
  revertBrushCanvas?.classList.toggle("active",revertBrushEnabled);
});
revertBrushSizeInput?.addEventListener("input",()=>{
  revertBrushSize=Math.max(16,Math.min(140,Number(revertBrushSizeInput.value)||48));
  if(revertBrushSizeValue)revertBrushSizeValue.textContent=`${Math.round(revertBrushSize)}px`;
});
revertBrushCanvas?.addEventListener("pointerdown",beginRevertBrush);
revertBrushCanvas?.addEventListener("pointermove",moveRevertBrush);
revertBrushCanvas?.addEventListener("pointerup",endRevertBrush);
revertBrushCanvas?.addEventListener("pointercancel",endRevertBrush);

truthMapToggle?.addEventListener("click",()=>{
  if(!requireSignedForPrecisionAction())return;
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
  if(!requireSignedForPrecisionAction())return;
  if(!isImagePro()){
    openImagePro("Print Proof","Get a conservative 300 DPI print-size estimate from the actual verified output dimensions.");
    return;
  }
  printProofEnabled=!printProofEnabled;
  printProofToggle.setAttribute("aria-pressed",String(printProofEnabled));
  printProofToggle.classList.toggle("active",printProofEnabled);
  if(!printProofEnabled)printProofPanel?.classList.add("hidden");
});

printPresetSelect?.addEventListener("change",()=>{
  const next=String(printPresetSelect.value||"none");
  if(next!=="none"){
    if(!requireSignedForPrecisionAction()){printPresetSelect.value="none";return;}
    if(!isImagePro()){printPresetSelect.value="none";openImagePro("Print-ready presets","Fit the verified result to A4 or A3 300-DPI pixel bounds without cropping or changing aspect ratio.");return;}
  }
  printPreset=next;
});

batchConsistencyBtn?.addEventListener("click",()=>{
  if(!requireSignedForPrecisionAction())return;
  if(!isImagePro()){openImagePro("Batch + Consistency Lock","Process up to eight images sequentially with the exact same enhancement, filter and export settings.");return;}
  if(batchBusy)return;
  batchImageInput?.click();
});
batchImageInput?.addEventListener("change",()=>{
  const files=[...(batchImageInput.files||[])].filter(looksLikeImageFile).slice(0,8);
  if(files.length)processBatchFiles(files);
});

document.querySelectorAll("[data-close-image-pro]").forEach(btn=>{
  btn.addEventListener("click",closeImagePro);
});

document.addEventListener("keydown",event=>{
  if(event.key==="Escape"){
    closeImagePro();
    if(protectionSelectMode){
      protectionSelectMode=false;
      [precisionProtectBtn,faceIdentityLockBtn,logoReferenceLockBtn].forEach(btn=>{btn?.classList.remove("active");btn?.setAttribute("aria-pressed","false");});
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
  resizeRevertBrushCanvas();
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

async function loadImage(file,options={}){
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
    enhancedFormat="";
    enhancedExportQuality=getSelectedExportQuality();
    enhancedFileBytes=0;
    protectedRegions=[];
    faceRegions=[];
    logoRegions=[];
    protectionSelectMode=false;
    precisionSelectionKind="critical";
    currentResultCanvas=null;
    revertBrushEnabled=false;
    revertBrushCanvas?.classList.add("hidden");
    revertBrushCanvas?.classList.remove("active");
    [precisionProtectBtn,faceIdentityLockBtn,logoReferenceLockBtn,revertBrushToggle].forEach(btn=>{btn?.classList.remove("active");btn?.setAttribute("aria-pressed","false");});
    truthMapPanel?.classList.add("hidden");
    printProofPanel?.classList.add("hidden");
    if(qrGuardStatus&&qrGuardEnabled)qrGuardStatus.textContent="Verification armed";

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
    renderImageDailyUsage();
    requestAnimationFrame(()=>{redrawProtectedRegions();resizeRevertBrushCanvas();});

    const scan=await smartScan(bitmap,file);
    currentScan=scan;
    renderSmartScan(scan);

    if(!options?.batch)editor.scrollIntoView({behavior:"smooth",block:"start"});
    return true;
  }catch(error){
    if(!options?.batch)alert("RIVANI could not decode this image in your browser.");
    return false;
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
  let skinCount=0;
  let saturationSum=0;
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

      const rr=data[p]/255,gg=data[p+1]/255,bb=data[p+2]/255;
      const mx=Math.max(rr,gg,bb),mn=Math.min(rr,gg,bb);
      saturationSum+=mx>1e-5?(mx-mn)/mx:0;
      if(rr>.26&&gg>.14&&bb>.07&&rr>gg&&gg>bb&&(rr-bb)>.065&&(rr-gg)<.32)skinCount++;
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

  const skinRatio=skinCount/Math.max(1,pixelCount);
  const meanSaturation=saturationSum/Math.max(1,pixelCount);
  let profile="photo";
  let scene=["Photo","General restoration route"];
  if(skinRatio>.055){
    profile="portrait";
    scene=["Portrait","Skin-aware finish + face-priority detail"];
  }else if(edgeDensity>.17&&meanSaturation>.34){
    profile="graphics";
    scene=["Graphics","Edge/text-aware detail route"];
  }else if(meanSaturation>.28&&edgeDensity>.08){
    profile="scenery";
    scene=["Scenery","Color + texture presence route"];
  }

  return {
    blur,
    noise:noiseState,
    compression,
    lighting,
    detail,
    alpha,
    scene,
    profile,
    score:{
      sharpness,
      noise,
      meanLuma,
      edgeDensity,
      skinRatio,
      meanSaturation
    }
  };
}

function renderSmartScan(scan){
  const items=[
    ["Scene route",scan.scene||["Photo","General restoration route"]],
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

async function enhanceCurrentImage(options={}){
  const batchRun=Boolean(options?.batch);
  if(!sourceBitmap||busy)return null;
  if(!batchRun){
    const signedIn=await requireImageAccount();
    if(!signedIn)return null;
    if(!isImagePro()&&imageJobsRemaining()<=0){showImageDailyLimit();renderImageDailyUsage();return null;}
  }

  busy=true;
  enhanceBtn.disabled=true;
  document.body.classList.add("rivani-processing-performance");
  if(isMobileImageDevice())document.body.classList.add("image-mobile-processing");
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

    let sourceCodeCheck={supported:false,codes:[]};
    if(isImagePro()&&qrGuardEnabled){
      setProgress(2,"Checking QR / barcodes…","Reading source codes before enhancement so RIVANI can verify them later.");
      sourceCodeCheck=await detectBarcodesPreview(sourceBitmap);
      if(qrGuardStatus)qrGuardStatus.textContent=sourceCodeCheck.supported
        ?(sourceCodeCheck.codes.length?`${sourceCodeCheck.codes.length} source code${sourceCodeCheck.codes.length===1?"":"s"} detected`:"No readable source code detected")
        :"Detector unavailable · use Critical Area Lock";
    }

    const worker=new Worker(
      "image-enhancer-worker.js?v=26.1-studio",
      {type:"module"}
    );

    const runtimeStarted=performance.now();
    const response=await runWorker(
      worker,
      prep.imageData,
      prep.width,
      prep.height,
      prep.workerScale,
      getImagePerformanceProfile(),
      imageMode,
      false,
      0,
      currentScan?.profile||"photo"
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
      currentScan,
      aiStrength
    );

    let finalCanvas=composeFinal(
      sourceBitmap,
      aiCanvas,
      response.width,
      response.height,
      decision.blend,
      colorLock,
      rawMetrics,
      []
    );

    let finalMetrics=measureFidelity(sourceBitmap,finalCanvas);

    if(colorLock&&decision.blend>0){
      finalMetrics=repairVerifiedTone(sourceBitmap,finalCanvas,finalMetrics);
    }

    // V26.1: 1× keeps source dimensions after neural restoration; 8× uses the
    // verified native 4× neural result as its truth/detail carrier and performs
    // a high-quality 2× Studio reconstruction. This is intentionally not called
    // an 8× neural model. Device budgets may reduce the effective output scale.
    if(finalCanvas.width!==prep.finalWidth||finalCanvas.height!==prep.finalHeight){
      setProgress(98,"Reconstructing requested output…",requestedScale===8?"Building verified 8× Studio output from the 4× AI result.":"Matching the requested output dimensions.",response.provider);
      const resized=resizeVerifiedCanvas(finalCanvas,prep.finalWidth,prep.finalHeight);
      if(resized!==finalCanvas){
        try{finalCanvas.width=1;finalCanvas.height=1;}catch(_error){}
        finalCanvas=resized;
      }
      finalMetrics=measureFidelity(sourceBitmap,finalCanvas);
    }

    // V26: Studio Finish runs AFTER Fidelity Guard/Tone Lock. Earlier builds
    // finished the raw model output first, then source protection partially
    // pulled that visible crispness back. A strip worker keeps the UI responsive
    // and avoids allocating another giant full-resolution canvas.
    if((hdFinish&&hdFinishStrength>0&&decision.blend>0)||selectedFilter!=="none"||(isImagePro()&&exactColorLock)){
      setProgress(98,"Applying RIVANI Studio Finish…","Adding verified crispness, cleanup, color and selected finishing.",response.provider);
      await applyStudioFinishToCanvas(
        finalCanvas,
        imageMode,
        hdFinish&&decision.blend>0?hdFinishStrength:0,
        currentScan?.profile||"photo",
        colorLock,
        clarity,
        sharpness,
        currentScan,
        selectedFilter,
        filterStrength,
        isImagePro()&&exactColorLock?exactColorHex:""
      );
      finalMetrics=measureFidelity(sourceBitmap,finalCanvas);
    }

    if(isImagePro()&&faceRegions.length){
      applyFaceIdentityRegions(sourceBitmap,finalCanvas.getContext("2d",{alpha:true}),finalCanvas.width,finalCanvas.height,faceRegions);
      finalMetrics=measureFidelity(sourceBitmap,finalCanvas);
    }
    if(isImagePro()&&logoRegions.length){
      applyProtectedRegions(sourceBitmap,finalCanvas.getContext("2d",{alpha:true}),finalCanvas.width,finalCanvas.height,logoRegions);
      finalMetrics=measureFidelity(sourceBitmap,finalCanvas);
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

    if(isImagePro()&&printPreset!=="none"){
      const fitted=fitCanvasToPrintPreset(finalCanvas,printPreset);
      if(fitted!==finalCanvas){try{finalCanvas.width=1;finalCanvas.height=1;}catch(_error){}finalCanvas=fitted;}
      finalMetrics=measureFidelity(sourceBitmap,finalCanvas);
    }

    if(isImagePro()&&qrGuardEnabled&&sourceCodeCheck.supported&&sourceCodeCheck.codes.length){
      setProgress(99,"Verifying QR / barcodes…","Checking that readable code values survived enhancement.",response.provider);
      const enhancedCodeCheck=await detectBarcodesPreview(finalCanvas);
      const guard=verifyBarcodeSet(sourceCodeCheck.codes,enhancedCodeCheck.codes||[]);
      if(guard.restoreRegions.length){
        applyProtectedRegions(sourceBitmap,finalCanvas.getContext("2d",{alpha:true}),finalCanvas.width,finalCanvas.height,guard.restoreRegions);
        finalMetrics=measureFidelity(sourceBitmap,finalCanvas);
      }
      if(qrGuardStatus)qrGuardStatus.textContent=guard.restoreRegions.length
        ?`Restored ${guard.restoreRegions.length} code area${guard.restoreRegions.length===1?"":"s"} for safety`
        :`Verified ${sourceCodeCheck.codes.length} code${sourceCodeCheck.codes.length===1?"":"s"}`;
    }

    currentResultCanvas=isImagePro()?finalCanvas:null;
    updateReferenceVerification(sourceBitmap);

    const requestedFormat=$("imageExportFormat")?.value||"auto";
    const format=resolveExportFormat(requestedFormat,currentScan);
    const exportQuality=getSelectedExportQuality();
    setProgress(99,"Encoding final image…",format==="png"?"Creating pixel-lossless PNG master.":`Creating ${exportQuality} quality photo export.`,response.provider);
    const blob=await canvasToBlob(finalCanvas,format,exportQuality);

    if(!blob)throw new Error("Could not create the enhanced image.");

    enhancedBlob=blob;
    enhancedFormat=format;
    enhancedExportQuality=exportQuality;
    enhancedFileBytes=blob.size||0;

    if(enhancedUrl)URL.revokeObjectURL(enhancedUrl);
    enhancedUrl=URL.createObjectURL(blob);

    compareAfter.src=enhancedUrl;
    setCompare(50);
    previewEmpty.classList.add("hidden");
    compareBox.classList.remove("hidden");
    protectionSelectMode=false;
    [precisionProtectBtn,faceIdentityLockBtn,logoReferenceLockBtn].forEach(btn=>{btn?.classList.remove("active");btn?.setAttribute("aria-pressed","false");});
    redrawProtectedRegions();

    if(isImagePro()&&truthMapEnabled){
      renderTruthMap(sourceBitmap,finalCanvas,finalMetrics,decision);
      truthMapPanel?.classList.remove("hidden");
    }else{
      truthMapPanel?.classList.add("hidden");
    }

    if(isImagePro()&&printProofEnabled){
      renderPrintProof(finalCanvas.width,finalCanvas.height);
      printProofPanel?.classList.remove("hidden");
    }else{
      printProofPanel?.classList.add("hidden");
    }

    renderReport(
      finalMetrics,
      decision,
      finalCanvas.width,
      finalCanvas.height,
      prep.effectiveScale,
      response.provider,
      runtimeMs,
      response.performanceProfile,
      enhancedFormat,
      enhancedFileBytes,
      enhancedExportQuality
    );

    if(hdFinishMeta){
      const finishLabel=hdFinish&&hdFinishStrength>0&&decision.blend>0?`Studio ${Math.round(hdFinishStrength)}%`:"Studio off";
      const filterLabel=selectedFilter!=="none"?` · ${selectedFilter[0].toUpperCase()+selectedFilter.slice(1)} ${Math.round(filterStrength)}%`:"";
      const colorLabel=isImagePro()&&exactColorLock?` · Color ${exactColorHex.toUpperCase()}`:"";
      hdFinishMeta.textContent=`${finishLabel}${filterLabel}${colorLabel}`;
    }

    processing.classList.add("hidden");
    resultPanel.classList.remove("hidden");
    if(!batchRun)resultPanel.scrollIntoView({behavior:"smooth",block:"nearest"});
    if(!batchRun)recordCompletedImageJob();
    return {blob:enhancedBlob,format:enhancedFormat,fileBytes:enhancedFileBytes,fileName:sourceFile?.name||"image",url:enhancedUrl};
  }catch(error){
    processing.classList.add("hidden");
    if(!batchRun)alert(error?.message||"RIVANI Image Enhancer could not finish this image.");
    return null;
  }finally{
    document.body.classList.remove("rivani-processing-performance","image-mobile-processing");
    busy=false;
    enhanceBtn.disabled=!sourceBitmap;
    renderImageDailyUsage();
  }
}

function prepareInputForModel(bitmap,targetScale){
  const budget=getDeviceOutputBudget(bitmap);
  const requested=[1,2,4,8].includes(Number(targetScale))?Number(targetScale):2;
  const workerScale=requested<=2?2:4;
  let prepScale=1;

  const targetPixels=bitmap.width*bitmap.height*requested*requested;
  if(targetPixels>budget.maxPixels){
    prepScale=Math.min(prepScale,Math.sqrt(budget.maxPixels/targetPixels));
  }

  const longest=Math.max(bitmap.width,bitmap.height)*requested;
  if(longest>budget.maxEdge){
    prepScale=Math.min(prepScale,budget.maxEdge/longest);
  }

  if(prepScale>.97)prepScale=1;

  const width=Math.max(16,Math.round(bitmap.width*prepScale));
  const height=Math.max(16,Math.round(bitmap.height*prepScale));
  const finalWidth=Math.max(16,Math.round(width*requested));
  const finalHeight=Math.max(16,Math.round(height*requested));

  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:true,willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.drawImage(bitmap,0,0,width,height);

  return {
    imageData:ctx.getImageData(0,0,width,height),
    width,height,workerScale,finalWidth,finalHeight,requestedScale:requested,
    effectiveScale:finalWidth/bitmap.width,
    wasCapped:prepScale<.97,
    budget
  };
}

function resizeVerifiedCanvas(sourceCanvas,width,height){
  if(sourceCanvas.width===width&&sourceCanvas.height===height)return sourceCanvas;
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(width));
  canvas.height=Math.max(1,Math.round(height));
  const ctx=canvas.getContext("2d",{alpha:true});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(sourceCanvas,0,0,canvas.width,canvas.height);
  return canvas;
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
    // Mobile browser memory is shared by the page, compositor, WebGPU model,
    // source bitmap, result canvas and encoder. A 36 MP RGBA canvas alone is
    // ~144 MB before GPU/encoder copies, so V25.7 uses a safer adaptive ceiling.
    // This never changes per-pixel AI quality; only oversized 4× requests are
    // capped to the highest effective resolution the device can hold smoothly.
    // V25.9 also budgets the encoded/result canvas, not only model compute.
    // Selective AI makes inference bounded; this lower canvas ceiling prevents
    // mid-range Android from being killed while allocating/encoding a 30+ MP PNG.
    maxPixels=16_000_000;
    maxEdge=6800;

    if(memory&&memory<=4){
      maxPixels=12_000_000;
      maxEdge=6000;
    }else if(memory>=8&&cores>=8){
      maxPixels=18_000_000;
      maxEdge=7300;
    }else if(memory>=6){
      maxPixels=17_000_000;
      maxEdge=7000;
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

function isMobileImageDevice(){
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||"") ||
    Boolean(window.matchMedia?.("(pointer:coarse)")?.matches);
}

function getImagePerformanceProfile(){
  const cores=Math.max(1,Number(navigator.hardwareConcurrency)||4);
  const memory=Math.max(0,Number(navigator.deviceMemory)||0);
  const mobile=isMobileImageDevice();

  // Mobile gets its own responsive profile. It still uses the same WebGPU
  // model/output path, but lets the browser compositor breathe when scrolling
  // or touch interaction starts dropping frames.
  if(mobile)return "mobile";

  // V25.5 device-aware defaults. The worker then self-tunes further from real
  // tile latency, so this is only the starting profile—not a quality mode.
  if(memory&&memory<=3)return "cool";
  if(cores>=12&&(memory===0||memory>=8))return "fast";
  if(cores>=8&&(memory===0||memory>=4))return "balanced";
  if(cores>=6&&(memory===0||memory>=6))return "balanced";
  return "cool";
}

function startImageUiPressureMonitor(worker,performanceProfile){
  if(performanceProfile!=="mobile" || typeof requestAnimationFrame!=="function"){
    return ()=>{};
  }

  let active=true;
  let raf=0;
  let last=performance.now();
  let pressure=0;
  let lastSent=-1;
  let lastSendAt=0;

  const tick=now=>{
    if(!active)return;

    const frameMs=Math.max(0,now-last);
    last=now;

    // 60 Hz healthy frame ~=16.7 ms. Pressure reacts quickly to visible jank
    // and decays gradually so the AI speeds back up when the UI is smooth.
    let sample=0;
    if(frameMs>95)sample=1;
    else if(frameMs>65)sample=.82;
    else if(frameMs>45)sample=.58;
    else if(frameMs>32)sample=.32;

    pressure=Math.max(sample,pressure*.90);

    if(document.hidden)pressure=Math.min(pressure,.15);

    if(now-lastSendAt>240 && Math.abs(pressure-lastSent)>.06){
      lastSendAt=now;
      lastSent=pressure;
      try{worker.postMessage({type:"ui-pressure",value:pressure});}catch(_error){}
    }

    raf=requestAnimationFrame(tick);
  };

  raf=requestAnimationFrame(tick);

  return ()=>{
    active=false;
    if(raf)cancelAnimationFrame(raf);
    try{worker.postMessage({type:"ui-pressure",value:0});}catch(_error){}
  };
}

function runWorker(worker,imageData,width,height,targetScale,performanceProfile,imageMode,hdFinishEnabled,hdFinishAmount,sceneProfile){
  return new Promise((resolve,reject)=>{
    const stopUiMonitor=startImageUiPressureMonitor(worker,performanceProfile);
    const mobile=performanceProfile==="mobile";
    const startedAt=Date.now();
    let lastActivity=startedAt;
    let settled=false;

    const finishWorker=()=>{
      stopUiMonitor();
      worker.terminate();
    };
    const finish=(fn,value)=>{
      if(settled)return;
      settled=true;
      clearInterval(watchdog);
      finishWorker();
      fn(value);
    };

    // V25.8 used one fixed 12-minute wall clock. A mobile job that was still
    // making progress was killed at exactly the same point for both 2× and 4×.
    // V25.9 watches for a real stall instead. Selective AI should normally finish
    // much sooner, while a dead GPU/session still exits instead of hanging forever.
    const hardLimit=mobile?20*60*1000:12*60*1000;
    const stallLimit=mobile?4*60*1000:3*60*1000;
    const watchdog=setInterval(()=>{
      const now=Date.now();
      if(now-lastActivity>stallLimit){
        finish(reject,new Error("The mobile AI engine stopped making progress on this device. RIVANI ended the job safely."));
        return;
      }
      if(now-startedAt>hardLimit){
        finish(reject,new Error("This image still exceeds the safe processing window for this device."));
      }
    },15000);

    worker.onmessage=event=>{
      const msg=event.data||{};
      lastActivity=Date.now();

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
        const mapped=28+Math.round(Number(msg.progress||0)*.68);
        setProgress(
          Math.min(96,mapped),
          "Enhancing image…",
          msg.text||"Reconstructing clean detail.",
          msg.provider
        );
        return;
      }

      if(msg.type==="done"){
        finish(resolve,{
          width:msg.width,
          height:msg.height,
          rgba:msg.rgba,
          provider:msg.provider||"RIVANI AI Engine",
          performanceProfile:msg.performanceProfile||performanceProfile||"balanced",
          mobileRefineTiles:Number(msg.mobileRefineTiles)||0,
          mobileTotalTiles:Number(msg.mobileTotalTiles)||0,
          hdFinishApplied:Boolean(msg.hdFinishApplied),
          hdFinishStrength:Number(msg.hdFinishStrength)||0
        });
        return;
      }

      if(msg.type==="error"){
        finish(reject,new Error(msg.message||"Image enhancement failed."));
      }
    };

    worker.onerror=event=>{
      lastActivity=Date.now();
      finish(reject,new Error(event.message||"Image enhancement worker failed."));
    };

    const inputBuffer=imageData.data.buffer;
    worker.postMessage({
      type:"enhance",
      width,
      height,
      targetScale,
      performanceProfile,
      imageMode:imageMode||"natural",
      hdFinishEnabled:Boolean(hdFinishEnabled),
      hdFinishStrength:Math.max(0,Math.min(100,Number(hdFinishAmount)||0)),
      sceneProfile:String(sceneProfile||"photo"),
      rgba:inputBuffer
    },[inputBuffer]);
  });
}

function decideGuard(metrics,mode,guard,textSafe,colorSafe,scan,userAiStrength=100){
  const base={
    natural:.84,
    // Strong keeps almost the full verified model result. Fidelity Guard still
    // owns the emergency brake, so more detail does not mean less safety.
    strong:.995,
    restore:.91
  }[mode]||.84;

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
    // Do not globally soften ordinary landscapes/portraits just because the
    // source contains many fine edges. Pull back only when verification shows
    // the model is actually stressing fine structure.
    if(metrics.edgeRatio>2.20)blend-=sensitive?.045:.03;
    if(metrics.structure<.875)blend-=sensitive?.035:.02;
  }

  // Color Lock now has a real tonal/chroma correction pass in composeFinal().
  // Only severe verified drift reduces AI strength here.
  if(colorSafe&&(metrics.colorDrift>.09||Math.abs(metrics.lumaDrift)>.085)){
    blend-=.015;
  }

  if(guard){
    if(risk==="high"){
      blend=0;
    }else if(risk==="medium"){
      const mediumCap=mode==="strong"?.91:mode==="restore"?.83:.79;
      blend=Math.min(blend,mediumCap);
    }
  }

  if(!(guard&&risk==="high")){
    blend=Math.max(.40,Math.min(.995,blend));
    // Free AI Strength is a user preference applied *after* safety. At 100 the
    // mode keeps its full verified AI result; lower values preserve more source.
    blend*=Math.max(0,Math.min(1,(Number(userAiStrength)||0)/100));
  }

  return {
    blend,
    risk,
    reasons,
    requestedAiStrength:Math.max(0,Math.min(100,Number(userAiStrength)||0))
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
    const chromaAlpha=Math.min(.20,Math.max(0,(metrics?.colorDrift||0)-.022)*2.1);

    if(chromaAlpha>.015){
      ctx.save();
      ctx.globalCompositeOperation="color";
      ctx.globalAlpha=chromaAlpha;
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";
      ctx.drawImage(source,0,0,width,height);
      ctx.restore();
    }

    // Do not overlay the low-resolution source in luminosity mode here. That
    // can subtly soften Strong/Maximum Detail. V25.6 repairs only the verified
    // *global* exposure after composition, preserving the AI high-frequency map.
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
    sourceLuma:meanA,
    enhancedLuma:meanB,
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
  performanceProfile,
  exportFormat,
  exportBytes,
  exportQuality="high"
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
      :performanceProfile==="mobile"
        ?"Mobile Selective"
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

  const megapixels=(width*height)/1_000_000;
  const qualityLabel=exportQuality==="max"?"Max":exportQuality==="standard"?"Standard":"High";
  const formatLabel=exportFormat==="png"?"PNG lossless":exportFormat==="webp"?`WebP ${qualityLabel}`:`JPEG ${qualityLabel}`;
  const sizeLabel=formatBytes(exportBytes||0);
  const sizeEl=$("imageOutputFileSize");
  const formatEl=$("imageOutputFormat");
  const mpEl=$("imageOutputMegapixels");
  if(sizeEl)sizeEl.textContent=sizeLabel;
  if(formatEl)formatEl.textContent=formatLabel;
  if(mpEl)mpEl.textContent=`${megapixels.toFixed(megapixels>=10?1:2)} MP`;

  const note=$("imageExportSizeNote");
  if(note){
    note.textContent=exportFormat==="png"&&exportBytes>24*1024*1024
      ?`This is a true lossless master (${sizeLabel}). Photos with millions of detailed pixels can be large. Choose Smart Photo or WebP High for a much smaller high-quality photo file.`
      :exportFormat==="png"
        ?`Pixel-lossless master · ${sizeLabel}`
        :`High-quality photo export · ${sizeLabel}. PNG Lossless remains available when exact pixels matter.`;
  }
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

function setCompare(value){
  const p=Math.max(0,Math.min(100,Number(value)||0));
  compareBox?.style.setProperty("--compare-position",`${p}%`);
  if(compareRange&&Number(compareRange.value)!==Math.round(p))compareRange.value=String(Math.round(p));
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

  const palette={
    critical:["rgba(124,119,255,.95)","rgba(105,84,255,.11)"],
    face:["rgba(89,220,196,.96)","rgba(42,196,165,.11)"],
    logo:["rgba(255,178,86,.97)","rgba(255,162,62,.10)"]
  };
  const drawRegion=(r,kind="critical",temporary=false)=>{
    const x=imageRect.left+r.x*imageRect.width;
    const y=imageRect.top+r.y*imageRect.height;
    const w=r.w*imageRect.width;
    const h=r.h*imageRect.height;
    const [stroke,fill]=palette[kind]||palette.critical;
    ctx.save();
    ctx.lineWidth=temporary?2:2.5;
    ctx.strokeStyle=temporary?"rgba(120,220,255,.95)":stroke;
    ctx.fillStyle=temporary?"rgba(80,190,255,.10)":fill;
    ctx.setLineDash(temporary?[7,5]:[]);
    ctx.fillRect(x,y,w,h);
    ctx.strokeRect(x+.5,y+.5,Math.max(0,w-1),Math.max(0,h-1));
    ctx.restore();
  };

  protectedRegions.forEach(r=>drawRegion(r,"critical",false));
  faceRegions.forEach(r=>drawRegion(r,"face",false));
  logoRegions.forEach(r=>drawRegion(r,"logo",false));
  if(temp)drawRegion(temp,precisionSelectionKind,true);
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
  return {x:(left-r.left)/r.width,y:(top-r.top)/r.height,w:width/r.width,h:height/r.height};
}

function protectPointer(event){
  const rect=protectCanvas.getBoundingClientRect();
  return {x:event.clientX-rect.left,y:event.clientY-rect.top};
}
function selectedRegionArray(){
  return precisionSelectionKind==="face"?faceRegions:precisionSelectionKind==="logo"?logoRegions:protectedRegions;
}
function selectedRegionLimit(){return precisionSelectionKind==="critical"?5:3;}
function beginProtectionDrag(event){
  if(!protectionSelectMode||!isImagePro()||!sourceBitmap)return;
  const list=selectedRegionArray();
  const max=selectedRegionLimit();
  if(list.length>=max){alert(`Up to ${max} ${precisionSelectionKind==="critical"?"critical":"precision"} areas can be selected per image.`);return;}
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
  if(region)selectedRegionArray().push(region);
  redrawProtectedRegions();
  event.preventDefault();
}
function cancelProtectionDrag(){protectDrag=null;redrawProtectedRegions();}

function updateProtectedRegionStatus(){
  const count=protectedRegions.length;
  if(protectedRegionStatus){
    protectedRegionStatus.textContent=count?`${count} critical area${count===1?"":"s"} selected`:protectionSelectMode&&precisionSelectionKind==="critical"?"Drag over a critical detail":"No protected areas";
  }
  if(faceIdentityStatus){
    const n=faceRegions.length;
    faceIdentityStatus.textContent=n?`${n} face region${n===1?"":"s"} identity-anchored`:protectionSelectMode&&precisionSelectionKind==="face"?"Drag over the face region":"No face regions selected";
  }
  if(logoReferenceStatus){
    const n=logoRegions.length;
    logoReferenceStatus.textContent=n?`${n} logo region${n===1?"":"s"} protected`:protectionSelectMode&&precisionSelectionKind==="logo"?"Drag over the logo / brand mark":"No logo regions selected";
  }
  const total=count+faceRegions.length+logoRegions.length;
  clearProtectedRegionBtn?.classList.toggle("hidden",total===0);
  if(protectedMeta){
    protectedMeta.classList.toggle("hidden",total===0);
    if(total)protectedMeta.textContent=`${total} precision anchor${total===1?"":"s"} active`;
  }
}

function applyProtectedRegions(source,ctx,width,height,regions){
  for(const r of regions.slice(0,5)){
    const sx=Math.max(0,r.x*source.width);
    const sy=Math.max(0,r.y*source.height);
    const sw=Math.max(1,Math.min(source.width-sx,r.w*source.width));
    const sh=Math.max(1,Math.min(source.height-sy,r.h*source.height));
    const dx=r.x*width,dy=r.y*height,dw=r.w*width,dh=r.h*height;
    for(let step=4;step>=1;step--){
      const px=(dw*.004)*step,py=(dh*.004)*step;
      ctx.save();ctx.globalCompositeOperation="source-over";ctx.globalAlpha=.055;
      ctx.drawImage(source,sx,sy,sw,sh,dx-px,dy-py,dw+px*2,dh+py*2);ctx.restore();
    }
    ctx.save();ctx.globalCompositeOperation="source-over";ctx.globalAlpha=1;
    ctx.drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh);ctx.restore();
  }
}

function applyFaceIdentityRegions(source,ctx,width,height,regions){
  // Preserve facial geometry/identity while retaining a restrained amount of
  // enhanced high-frequency detail. This is an anchor blend, not face synthesis.
  for(const r of regions.slice(0,3)){
    const sx=Math.max(0,r.x*source.width),sy=Math.max(0,r.y*source.height);
    const sw=Math.max(1,Math.min(source.width-sx,r.w*source.width));
    const sh=Math.max(1,Math.min(source.height-sy,r.h*source.height));
    const dx=r.x*width,dy=r.y*height,dw=r.w*width,dh=r.h*height;
    for(let step=5;step>=1;step--){
      const px=(dw*.006)*step,py=(dh*.006)*step;
      ctx.save();ctx.globalAlpha=.04;ctx.drawImage(source,sx,sy,sw,sh,dx-px,dy-py,dw+px*2,dh+py*2);ctx.restore();
    }
    ctx.save();ctx.globalAlpha=.76;ctx.drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh);ctx.restore();
  }
}

function shortFileName(name){
  const value=String(name||"");
  return value.length>24?`${value.slice(0,20)}…`:value;
}

async function descriptorFromFile(file){
  const bitmap=await decodeImageSource(file);
  try{return descriptorFromDrawable(bitmap,null);}finally{try{bitmap?.close?.();}catch(_error){}}
}
function descriptorFromDrawable(drawable,region=null){
  const w=48,h=48;
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  const dw=Number(drawable?.width)||1,dh=Number(drawable?.height)||1;
  let sx=0,sy=0,sw=dw,sh=dh;
  if(region){sx=region.x*dw;sy=region.y*dh;sw=Math.max(1,region.w*dw);sh=Math.max(1,region.h*dh);}
  ctx.drawImage(drawable,sx,sy,sw,sh,0,0,w,h);
  const data=ctx.getImageData(0,0,w,h).data;
  let r=0,g=0,b=0,sat=0,edge=0,n=0;
  const lum=new Float32Array(w*h);
  for(let i=0;i<w*h;i++){
    const p=i*4,rr=data[p]/255,gg=data[p+1]/255,bb=data[p+2]/255;
    r+=rr;g+=gg;b+=bb;n++;
    const mx=Math.max(rr,gg,bb),mn=Math.min(rr,gg,bb);sat+=mx>1e-6?(mx-mn)/mx:0;
    lum[i]=rr*.2126+gg*.7152+bb*.0722;
  }
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x;
    edge+=Math.abs(lum[i]*4-lum[i-1]-lum[i+1]-lum[i-w]-lum[i+w]);
  }
  return {r:r/n,g:g/n,b:b/n,sat:sat/n,edge:edge/Math.max(1,(w-2)*(h-2))};
}
function descriptorSimilarity(a,b){
  if(!a||!b)return null;
  const color=Math.sqrt((a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2)/Math.sqrt(3);
  const sat=Math.min(1,Math.abs(a.sat-b.sat));
  const edge=Math.min(1,Math.abs(a.edge-b.edge)/Math.max(.03,a.edge,b.edge));
  return Math.max(0,Math.min(1,1-(color*.46+sat*.16+edge*.38)));
}
function updateReferenceVerification(source){
  if(!isImagePro()||!currentResultCanvas)return;
  if(faceRegions.length){
    const src=descriptorFromDrawable(source,faceRegions[0]);
    const dst=descriptorFromDrawable(currentResultCanvas,faceRegions[0]);
    const preserve=descriptorSimilarity(src,dst);
    if(faceIdentityStatus)faceIdentityStatus.textContent=`${faceRegions.length} face region${faceRegions.length===1?"":"s"} · ${Math.round((preserve??0)*100)}% visual anchor${faceReferenceDescriptor?" · reference loaded":""}`;
  }
  if(logoRegions.length){
    const src=descriptorFromDrawable(source,logoRegions[0]);
    const dst=descriptorFromDrawable(currentResultCanvas,logoRegions[0]);
    const preserve=descriptorSimilarity(src,dst);
    let refText="";
    if(logoReferenceDescriptor){
      const ref=descriptorSimilarity(src,logoReferenceDescriptor);
      refText=` · ref ${Math.round((ref??0)*100)}%`;
    }
    if(logoReferenceStatus)logoReferenceStatus.textContent=`${logoRegions.length} logo region${logoRegions.length===1?"":"s"} · ${Math.round((preserve??0)*100)}% source match${refText}`;
  }
}

async function detectBarcodesPreview(drawable){
  if(typeof window.BarcodeDetector!=="function")return {supported:false,codes:[]};
  try{
    const supported=typeof window.BarcodeDetector.getSupportedFormats==="function"?await window.BarcodeDetector.getSupportedFormats():[];
    const preferred=["qr_code","data_matrix","aztec","pdf417","code_128","code_39","code_93","codabar","ean_13","ean_8","itf","upc_a","upc_e"];
    const formats=supported.length?preferred.filter(f=>supported.includes(f)):preferred;
    const detector=formats.length?new window.BarcodeDetector({formats}):new window.BarcodeDetector();
    const max=1400,dw=Number(drawable.width)||1,dh=Number(drawable.height)||1;
    const scale=Math.min(1,max/Math.max(dw,dh));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(64,Math.round(dw*scale));canvas.height=Math.max(64,Math.round(dh*scale));
    const ctx=canvas.getContext("2d");ctx.drawImage(drawable,0,0,canvas.width,canvas.height);
    const found=await detector.detect(canvas);
    const codes=[];
    for(const item of found||[]){
      const box=item.boundingBox||{};
      if(!(box.width>0&&box.height>0))continue;
      codes.push({
        rawValue:String(item.rawValue||""),format:String(item.format||""),
        region:expandRegion({x:box.x/canvas.width,y:box.y/canvas.height,w:box.width/canvas.width,h:box.height/canvas.height},.05)
      });
    }
    return {supported:true,codes};
  }catch(error){
    console.warn("RIVANI barcode verification unavailable",error);
    return {supported:false,codes:[]};
  }
}
function expandRegion(r,pad=.04){
  const x=Math.max(0,r.x-r.w*pad),y=Math.max(0,r.y-r.h*pad);
  const right=Math.min(1,r.x+r.w+r.w*pad),bottom=Math.min(1,r.y+r.h+r.h*pad);
  return {x,y,w:Math.max(.001,right-x),h:Math.max(.001,bottom-y)};
}
function verifyBarcodeSet(sourceCodes,enhancedCodes){
  const restoreRegions=[];
  for(const source of sourceCodes){
    const match=enhancedCodes.find(item=>item.rawValue&&item.rawValue===source.rawValue&&(item.format===source.format||!item.format||!source.format));
    if(!match)restoreRegions.push(source.region);
  }
  return {restoreRegions};
}

function resizeRevertBrushCanvas(){
  if(!revertBrushCanvas||!previewShell)return;
  const rect=previewShell.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
  const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(revertBrushCanvas.width!==w||revertBrushCanvas.height!==h){revertBrushCanvas.width=w;revertBrushCanvas.height=h;}
  revertBrushCanvas.dataset.dpr=String(dpr);
}
function revertBrushPoint(event){
  const shellRect=previewShell?.getBoundingClientRect();
  const imageRect=previewImageRect();
  if(!shellRect||!imageRect)return null;
  const x=event.clientX-shellRect.left,y=event.clientY-shellRect.top;
  if(x<imageRect.left||x>imageRect.left+imageRect.width||y<imageRect.top||y>imageRect.top+imageRect.height)return null;
  return {x,y,nx:(x-imageRect.left)/imageRect.width,ny:(y-imageRect.top)/imageRect.height,imageRect};
}
function drawBrushMark(point,last=null){
  if(!revertBrushCanvas||!point)return;
  resizeRevertBrushCanvas();
  const dpr=Number(revertBrushCanvas.dataset.dpr)||1;
  const ctx=revertBrushCanvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.save();ctx.strokeStyle="rgba(92,221,197,.78)";ctx.fillStyle="rgba(92,221,197,.18)";ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=revertBrushSize;
  if(last){ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(point.x,point.y);ctx.stroke();}
  else{ctx.beginPath();ctx.arc(point.x,point.y,revertBrushSize/2,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(166,255,236,.92)";ctx.lineWidth=1.5;ctx.stroke();}
  ctx.restore();
}
function applyRevertStamp(point){
  if(!currentResultCanvas||!sourceBitmap||!point)return;
  const radiusNorm=(revertBrushSize/2)/Math.max(1,point.imageRect.width);
  const cx=point.nx*currentResultCanvas.width,cy=point.ny*currentResultCanvas.height;
  const radius=Math.max(2,radiusNorm*currentResultCanvas.width);
  const sx=Math.max(0,(point.nx-radiusNorm)*sourceBitmap.width),sy=Math.max(0,(point.ny-radiusNorm)*sourceBitmap.height);
  const sw=Math.max(1,Math.min(sourceBitmap.width-sx,radiusNorm*2*sourceBitmap.width));
  const sh=Math.max(1,Math.min(sourceBitmap.height-sy,radiusNorm*2*sourceBitmap.height));
  const dx=cx-radius,dy=cy-radius,dw=radius*2,dh=radius*2;
  const ctx=currentResultCanvas.getContext("2d",{alpha:true});
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();ctx.globalAlpha=1;ctx.drawImage(sourceBitmap,sx,sy,sw,sh,dx,dy,dw,dh);ctx.restore();
}
function applyRevertBetween(a,b){
  if(!a||!b){if(b)applyRevertStamp(b);return;}
  const dx=b.nx-a.nx,dy=b.ny-a.ny,dist=Math.hypot(dx,dy);
  const step=Math.max(.002,(revertBrushSize/3)/Math.max(1,b.imageRect.width));
  const count=Math.max(1,Math.ceil(dist/step));
  for(let i=1;i<=count;i++){
    const t=i/count;
    applyRevertStamp({...b,nx:a.nx+dx*t,ny:a.ny+dy*t,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  }
}
function beginRevertBrush(event){
  if(!revertBrushEnabled||!isImagePro()||!currentResultCanvas)return;
  const point=revertBrushPoint(event);if(!point)return;
  revertBrushDrawing=true;revertBrushLastPoint=point;
  revertBrushCanvas.setPointerCapture?.(event.pointerId);drawBrushMark(point);applyRevertStamp(point);event.preventDefault();
}
function moveRevertBrush(event){
  if(!revertBrushDrawing)return;
  const point=revertBrushPoint(event);if(!point)return;
  drawBrushMark(point,revertBrushLastPoint);applyRevertBetween(revertBrushLastPoint,point);revertBrushLastPoint=point;event.preventDefault();
}
async function endRevertBrush(event){
  if(!revertBrushDrawing)return;
  revertBrushDrawing=false;revertBrushLastPoint=null;
  event?.preventDefault?.();
  try{await refreshEnhancedFromResultCanvas();}catch(error){console.warn("RIVANI revert brush encode failed",error);}
}
async function refreshEnhancedFromResultCanvas(){
  if(!currentResultCanvas||reencodeBusy)return;
  reencodeBusy=true;
  const desired=resolveExportFormat(exportSelect?.value||"auto",currentScan),quality=getSelectedExportQuality();
  try{
    const blob=await canvasToBlob(currentResultCanvas,desired,quality);if(!blob)throw new Error("Could not encode brushed result.");
    if(enhancedUrl)URL.revokeObjectURL(enhancedUrl);
    enhancedBlob=blob;enhancedFormat=desired;enhancedExportQuality=quality;enhancedFileBytes=blob.size||0;enhancedUrl=URL.createObjectURL(blob);compareAfter.src=enhancedUrl;
    const qLabel=quality==="max"?"Max":quality==="standard"?"Standard":"High";
    $("imageOutputFormat").textContent=desired==="png"?"PNG lossless":desired==="webp"?`WebP ${qLabel}`:`JPEG ${qLabel}`;
    $("imageOutputFileSize").textContent=formatBytes(enhancedFileBytes);
    const note=$("imageExportSizeNote");if(note)note.textContent=`Selective Revert applied · ${formatBytes(enhancedFileBytes)} · no AI rerun.`;
  }finally{reencodeBusy=false;}
}

function captureConsistencySettings(){
  return {imageMode,requestedScale,fidelityGuard,textLogoSafe,colorLock,hdFinish,hdFinishStrength,aiStrength,clarity,sharpness,selectedFilter,filterStrength,exactColorLock,exactColorHex,printPreset,exportFormat:exportSelect?.value||"auto",exportQuality:getSelectedExportQuality()};
}
function applyConsistencySettings(snap){
  if(!snap)return;
  imageMode=snap.imageMode;requestedScale=snap.requestedScale;fidelityGuard=snap.fidelityGuard;textLogoSafe=snap.textLogoSafe;colorLock=snap.colorLock;hdFinish=snap.hdFinish;hdFinishStrength=snap.hdFinishStrength;aiStrength=snap.aiStrength;clarity=snap.clarity;sharpness=snap.sharpness;selectedFilter=snap.selectedFilter;filterStrength=snap.filterStrength;exactColorLock=snap.exactColorLock;exactColorHex=snap.exactColorHex;printPreset=snap.printPreset||"none";
  document.querySelectorAll("[data-image-mode]").forEach(btn=>btn.classList.toggle("active",btn.dataset.imageMode===imageMode));
  document.querySelectorAll("[data-image-scale]").forEach(btn=>btn.classList.toggle("active",Number(btn.dataset.imageScale)===requestedScale));
  document.querySelectorAll("[data-image-filter]").forEach(btn=>btn.classList.toggle("active",btn.dataset.imageFilter===selectedFilter));
  if(aiStrengthInput)aiStrengthInput.value=String(aiStrength);if(aiStrengthValue)aiStrengthValue.textContent=`${aiStrength}%`;
  if(clarityInput)clarityInput.value=String(clarity);if(clarityValue)clarityValue.textContent=`${clarity}%`;
  if(sharpnessInput)sharpnessInput.value=String(sharpness);if(sharpnessValue)sharpnessValue.textContent=`${sharpness}%`;
  if(hdFinishStrengthInput)hdFinishStrengthInput.value=String(hdFinishStrength);if(hdFinishStrengthValue)hdFinishStrengthValue.textContent=`${hdFinishStrength}%`;
  if(filterStrengthInput)filterStrengthInput.value=String(filterStrength);if(filterStrengthValue)filterStrengthValue.textContent=`${filterStrength}%`;
  if(exactColorPicker)exactColorPicker.value=exactColorHex;
  if(printPresetSelect)printPresetSelect.value=printPreset;
  if(exportSelect)exportSelect.value=snap.exportFormat;if(exportQualitySelect)exportQualitySelect.value=snap.exportQuality;
  const toggles=[["fidelityGuardToggle",fidelityGuard],["textSafeToggle",textLogoSafe],["colorLockToggle",colorLock],["hdFinishToggle",hdFinish]];
  toggles.forEach(([id,on])=>{const btn=$(id);btn?.setAttribute("aria-pressed",String(on));btn?.classList.toggle("enabled",on);});
  exactColorLockToggle?.setAttribute("aria-pressed",String(exactColorLock));exactColorLockToggle?.classList.toggle("active",exactColorLock);
}

async function processBatchFiles(files){
  if(batchBusy||!isImagePro())return;
  const consistency=captureConsistencySettings();
  batchBusy=true;
  document.body.classList.add("image-batch-processing");
  batchResultsPanel?.classList.remove("hidden");
  if(batchResultsList)batchResultsList.innerHTML="";
  if(batchResultsTitle)batchResultsTitle.textContent=`Processing 0 / ${files.length}`;
  batchConsistencyBtn.disabled=true;
  try{
    let completed=0;
    for(let i=0;i<files.length;i++){
      const file=files[i];
      applyConsistencySettings(consistency);
      if(batchResultsTitle)batchResultsTitle.textContent=`Processing ${i+1} / ${files.length} · ${shortFileName(file.name)}`;
      const loaded=await loadImage(file,{batch:true});
      if(!loaded)continue;
      const result=await enhanceCurrentImage({batch:true});
      if(!result?.blob)continue;
      completed++;
      const url=URL.createObjectURL(result.blob);
      const ext=result.format==="jpeg"?"jpg":result.format;
      const base=(file.name||`image-${i+1}`).replace(/\.[^.]+$/,"").replace(/[^\w-]+/g,"-")||`image-${i+1}`;
      const a=document.createElement("a");a.href=url;a.download=`${base}-rivani-enhanced.${ext}`;a.textContent=shortFileName(a.download);
      const size=document.createElement("span");size.textContent=formatBytes(result.fileBytes||result.blob.size||0);a.appendChild(size);
      batchResultsList?.appendChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),30*60*1000);
    }
    if(batchResultsTitle)batchResultsTitle.textContent=`Batch complete · ${completed} / ${files.length}`;
  }finally{
    applyConsistencySettings(consistency);
    document.body.classList.remove("image-batch-processing");
    batchBusy=false;batchConsistencyBtn.disabled=false;if(batchImageInput)batchImageInput.value="";
  }
}

function repairVerifiedTone(source,canvas,metrics){
  let current=metrics;
  const ctx=canvas.getContext("2d",{alpha:true});

  for(let pass=0;pass<2;pass++){
    const luma=Math.abs(current.lumaDrift||0);
    const color=current.colorDrift||0;
    if(luma<=.012&&color<=.042)break;

    if(color>.035){
      ctx.save();
      ctx.globalCompositeOperation="color";
      ctx.globalAlpha=Math.min(.28,Math.max(.04,(color-.028)*3.2));
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";
      ctx.drawImage(source,0,0,canvas.width,canvas.height);
      ctx.restore();
    }

    if(luma>.010){
      // Correct only the global mean exposure. Unlike drawing the original in
      // luminosity mode, a uniform screen/multiply nudge cannot replace fine AI
      // structure with an upscaled source, so Strong detail stays intact.
      const src=Math.max(0,Math.min(255,current.sourceLuma||0));
      const dst=Math.max(0,Math.min(255,current.enhancedLuma||0));
      let alpha=0;
      let mode="source-over";
      let fill="#000";

      if(dst>src+1){
        alpha=Math.min(.22,Math.max(0,1-(src/Math.max(1,dst))));
        mode="multiply";
        fill="#000";
      }else if(dst<src-1){
        alpha=Math.min(.22,Math.max(0,(src-dst)/Math.max(1,255-dst)));
        mode="screen";
        fill="#fff";
      }

      if(alpha>.003){
        ctx.save();
        ctx.globalCompositeOperation=mode;
        ctx.globalAlpha=alpha;
        ctx.fillStyle=fill;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.restore();
      }
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

  // Draw all precision anchors as outlines on the Truth Map.
  const anchored=[...protectedRegions,...faceRegions,...logoRegions];
  if(anchored.length){
    ctx.save();ctx.strokeStyle="rgba(215,240,255,.95)";ctx.lineWidth=2;
    for(const r of anchored)ctx.strokeRect(r.x*width+.5,r.y*height+.5,r.w*width-1,r.h*height-1);
    ctx.restore();
  }

  const avg=sum/(width*height);
  const changedPct=Math.round(changed/(width*height)*100);
  const level=avg<.025?"Low":avg<.055?"Moderate":"High";
  if(truthMapStatus)truthMapStatus.textContent=`${level} change`;
  if(truthMapNote){
    truthMapNote.textContent=decision.risk==="high"
      ?`Safe Result protection was triggered. ${changedPct}% of sampled pixels crossed the change threshold before protection.`
      :`${changedPct}% of sampled pixels show meaningful verified change. Structure ${Math.round(metrics.structure*100)}% preserved.${anchored.length?` ${anchored.length} precision anchor${anchored.length===1?"":"s"} applied.`:""}`;
  }
}

function fitCanvasToPrintPreset(canvas,preset){
  const sizes={a4p:[2480,3508],a4l:[3508,2480],a3p:[3508,4961],a3l:[4961,3508]};
  const target=sizes[preset];if(!target)return canvas;
  const scale=Math.min(target[0]/canvas.width,target[1]/canvas.height);
  const w=Math.max(16,Math.round(canvas.width*scale)),h=Math.max(16,Math.round(canvas.height*scale));
  if(Math.abs(w-canvas.width)<2&&Math.abs(h-canvas.height)<2)return canvas;
  return resizeVerifiedCanvas(canvas,w,h);
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


async function applyStudioFinishToCanvas(canvas,mode,strength,sceneProfile,colorSafe,clarityAmount=0,sharpnessAmount=0,scan=null,filterPreset="none",filterAmount=0,exactColor=""){
  const ctx=canvas.getContext("2d",{alpha:true,willReadFrequently:true});
  const worker=new Worker("image-finish-worker.js?v=26.3-precision",{type:"module"});
  const mobile=isMobileImageDevice();
  const stripHeight=mobile?224:512;
  const total=Math.ceil(canvas.height/stripHeight);
  try{
    for(let index=0,y=0;y<canvas.height;index++,y+=stripHeight){
      const h=Math.min(stripHeight,canvas.height-y);
      const imageData=ctx.getImageData(0,y,canvas.width,h);
      const processed=await finishStrip(worker,imageData,mode,strength,sceneProfile,colorSafe,clarityAmount,sharpnessAmount,scan,filterPreset,filterAmount,exactColor);
      ctx.putImageData(processed,0,y);
      const pct=98+Math.min(.7,((index+1)/Math.max(1,total))*.7);
      setProgress(pct,"Applying RIVANI Studio Finish…",`Finishing detail and color ${index+1}/${total}.`);
      if(mobile)await new Promise(resolve=>setTimeout(resolve,0));
    }
  }finally{
    worker.terminate();
  }
}

function finishStrip(worker,imageData,mode,strength,sceneProfile,colorSafe,clarityAmount=0,sharpnessAmount=0,scan=null,filterPreset="none",filterAmount=0,exactColor=""){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Studio Finish took too long.")),60000);
    const cleanup=()=>{clearTimeout(timer);worker.onmessage=null;worker.onerror=null;};
    worker.onmessage=event=>{
      const msg=event.data||{};
      if(msg.type==="error"){cleanup();reject(new Error(msg.message||"Studio Finish failed."));return;}
      if(msg.type!=="done")return;
      cleanup();
      resolve(new ImageData(new Uint8ClampedArray(msg.rgba),imageData.width,imageData.height));
    };
    worker.onerror=event=>{cleanup();reject(new Error(event.message||"Studio Finish worker failed."));};
    const buffer=imageData.data.buffer;
    worker.postMessage({
      type:"finish",width:imageData.width,height:imageData.height,mode,strength,sceneProfile,colorLock:Boolean(colorSafe),clarity:clarityAmount,sharpness:sharpnessAmount,scan,filterPreset,filterAmount,exactColor,rgba:buffer
    },[buffer]);
  });
}

async function reencodeCurrentResult(){
  if(!enhancedBlob||reencodeBusy)return;
  const desired=resolveExportFormat(exportSelect?.value||"auto",currentScan);
  const quality=getSelectedExportQuality();
  if(desired===enhancedFormat&&(desired==="png"||quality===enhancedExportQuality))return;
  reencodeBusy=true;
  const previousText=downloadBtn?.textContent||"Download Enhanced Image";
  if(downloadBtn){downloadBtn.disabled=true;downloadBtn.textContent="Re-encoding…";}
  const note=$("imageExportSizeNote");
  if(note)note.textContent="Re-encoding the verified result without rerunning AI…";
  let bitmap=null;
  try{
    let canvas=currentResultCanvas;
    if(!canvas){
      bitmap=await createImageBitmap(enhancedBlob);
      canvas=document.createElement("canvas");
      canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext("2d",{alpha:true});
      ctx.drawImage(bitmap,0,0);
    }
    const blob=await canvasToBlob(canvas,desired,quality);
    if(!blob)throw new Error("Could not re-encode this result.");
    if(enhancedUrl)URL.revokeObjectURL(enhancedUrl);
    enhancedBlob=blob;enhancedFormat=desired;enhancedExportQuality=quality;enhancedFileBytes=blob.size||0;
    enhancedUrl=URL.createObjectURL(blob);
    compareAfter.src=enhancedUrl;
    const qLabel=quality==="max"?"Max":quality==="standard"?"Standard":"High";
    $("imageOutputFormat").textContent=desired==="png"?"PNG lossless":desired==="webp"?`WebP ${qLabel}`:`JPEG ${qLabel}`;
    $("imageOutputFileSize").textContent=formatBytes(enhancedFileBytes);
    if(note){
      note.textContent=desired==="png"
        ?"PNG is lossless for the current decoded result. For an exact original AI pixel master, select PNG before running enhancement."
        :`${desired.toUpperCase()} re-encoded from the verified result · ${formatBytes(enhancedFileBytes)} · no AI rerun.`;
    }
  }finally{
    try{bitmap?.close?.();}catch(_error){}
    reencodeBusy=false;
    if(downloadBtn){downloadBtn.disabled=false;downloadBtn.textContent=previousText;}
  }
}

function resolveExportFormat(requested,scan){
  if(requested==="auto"){
    // Transparency requires a format that preserves alpha exactly. For normal
    // photos, WebP Max dramatically reduces file size while remaining a
    // maximum-quality *photo* export (not labelled lossless).
    return scan?.alpha?.[0]==="Present"?"png":"webp";
  }
  return requested==="jpeg"||requested==="webp"?requested:"png";
}

function getSelectedExportQuality(){
  const value=String(exportQualitySelect?.value||"high");
  return value==="standard"||value==="max"?value:"high";
}

function canvasToBlob(canvas,format,qualityKey="high"){
  const type=format==="jpeg"?"image/jpeg":format==="webp"?"image/webp":"image/png";
  const qualityMap={
    standard:{jpeg:.86,webp:.82},
    high:{jpeg:.92,webp:.90},
    max:{jpeg:.97,webp:.95}
  };
  const q=qualityMap[qualityKey]||qualityMap.high;
  const quality=format==="jpeg"?q.jpeg:format==="webp"?q.webp:undefined;
  return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
}

function formatBytes(bytes){
  const value=Math.max(0,Number(bytes)||0);
  if(value<1024)return `${Math.round(value)} B`;
  if(value<1024*1024)return `${(value/1024).toFixed(1)} KB`;
  return `${(value/(1024*1024)).toFixed(value>=100*1024*1024?0:1)} MB`;
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
  enhancedFormat="png";
  enhancedExportQuality=getSelectedExportQuality();
  enhancedFileBytes=0;
  currentScan=null;
  protectedRegions=[];
  faceRegions=[];
  logoRegions=[];
  protectionSelectMode=false;
  precisionSelectionKind="critical";
  protectDrag=null;
  currentResultCanvas=null;
  revertBrushEnabled=false;
  revertBrushDrawing=false;
  [precisionProtectBtn,faceIdentityLockBtn,logoReferenceLockBtn,revertBrushToggle].forEach(btn=>{btn?.classList.remove("active");btn?.setAttribute("aria-pressed","false");});
  revertBrushCanvas?.classList.add("hidden");
  revertBrushCanvas?.classList.remove("active");
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
  resizeRevertBrushCanvas();
  renderImageDailyUsage();
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