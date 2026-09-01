(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const FREE_DAILY=9;
  const TESTING_UNLIMITED=false; // Production Free plan: 9 successful removals per local day
  const PRO_PRICE_INR=499;
  const IS_MOBILE=(()=>{
    const ua=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
    const touch=Number(navigator.maxTouchPoints||0)>=2;
    const sw=Math.min(Number(screen?.width||9999),Number(screen?.height||9999));
    const modestMemory=Number(navigator.deviceMemory||8)<=8;
    const modestCpu=Number(navigator.hardwareConcurrency||8)<=8;
    // Chrome "Desktop site" can alter UA/viewport, but touch + physical screen /
    // capability signals still identify a handheld device.
    return ua||(touch&&(sw<=1100||modestMemory||modestCpu));
  })();

  const fileInput=$('bgFileInput'),chooseBtn=$('bgChooseBtn'),replaceBtn=$('bgReplaceBtn'),dropZone=$('bgDropZone');
  const removeBtn=$('bgRemoveBtn'),usageText=$('bgUsageText'),usageProBtn=$('bgUsageProBtn');
  const fileName=$('bgFileName'),fileMeta=$('bgFileMeta'),editor=$('bgEditor');
  const stage=$('bgStage'),beforeCanvas=$('bgBeforeCanvas'),afterCanvas=$('bgAfterCanvas'),compareRange=$('bgCompareRange'),compareWrap=$('bgCompareWrap');
  const processing=$('bgProcessingOverlay'),progressFill=$('bgProgressFill'),progressPct=$('bgProgressPercent'),processingTitle=$('bgProcessingTitle'),processingText=$('bgProcessingText'),providerText=$('bgProviderText');
  const modeGroup=$('bgModeGroup');
  const edgeClean=$('bgEdgeClean'),edgeCleanValue=$('bgEdgeCleanValue'),edgeShift=$('bgEdgeShift'),edgeShiftValue=$('bgEdgeShiftValue'),feather=$('bgFeather'),featherValue=$('bgFeatherValue'),decontam=$('bgDecontam'),decontamValue=$('bgDecontamValue');
  const bgModeGroup=$('bgBackgroundGroup'),customColor=$('bgCustomColor'),customBgInput=$('bgCustomBackgroundInput'),customBgBtn=$('bgCustomBackgroundBtn');
  const shadowToggle=$('bgShadowToggle'),shadowStrength=$('bgShadowStrength'),shadowStrengthValue=$('bgShadowStrengthValue');
  const brushToggle=$('bgBrushToggle'),brushControls=$('bgBrushControls'),brushOverlay=$('bgBrushOverlay'),eraseBrush=$('bgEraseBrush'),restoreBrush=$('bgRestoreBrush'),brushSize=$('bgBrushSize'),brushSizeValue=$('bgBrushSizeValue'),undoBrush=$('bgUndoBrush'),resetMask=$('bgResetMask');
  const subjectPicker=$('bgSubjectPicker'),subjectButtons=$('bgSubjectButtons'),subjectSummary=$('bgSubjectSummary');
  const guardCard=$('bgGuardCard'),guardScore=$('bgGuardScore'),guardTitle=$('bgGuardTitle'),guardCopy=$('bgGuardCopy'),hardEdgeCanvas=$('bgHardEdgeCanvas'),hardEdgeLabel=$('bgHardEdgeLabel');
  const scanGrid=$('bgScanGrid'),resultMeta=$('bgResultMeta');
  const canvasPreset=$('bgCanvasPreset'),padding=$('bgPadding'),paddingValue=$('bgPaddingValue');
  const exportType=$('bgExportType'),exportQuality=$('bgExportQuality'),downloadBtn=$('bgDownloadBtn'),newImageBtn=$('bgNewImageBtn');
  const proModal=$('bgProModal'),proTitle=$('bgProModalTitle'),proCopy=$('bgProModalCopy'),proBuy=$('bgProBuyBtn');

  const state={
    file:null,url:'',bitmap:null,sourceCanvas:null,outW:0,outH:0,mask:null,baseMask:null,maskW:0,maskH:0,
    effectiveMask:null,subjectCanvas:null,shadowCanvas:null,customBgBitmap:null,bgEstimate:{rgb:[255,255,255],variance:1},
    engine:null,provider:null,inferenceMs:0,mode:'auto',bgMode:'transparent',shadow:false,brush:false,brushMode:'erase',
    undoMask:null,components:null,selectedComponent:'all',hardEdge:null,worker:null,jobId:0,painting:false,renderTimer:null,
    running:false,currentEngine:'precision',precisionAttempts:0,mobileAttempts:0,usedSafetyFallback:false,
    attemptTimer:null,progressPulseTimer:null,visualProgress:0,currentInputSize:0,maskGuide:null,
  };

  function isPro(){return String(window.RIVANI_LUKI_CONTEXT?.plan||'').toLowerCase()==='pro';}
  function signedIn(){return !!window.RIVANI_LUKI_CONTEXT?.signedIn;}
  function usageKey(){
    const uid=window.RIVANI_LUKI_CONTEXT?.uid||'guest';
    const d=new Date();const day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return `rivani:bgremove:${uid}:${day}`;
  }
  function usageCount(){return Math.max(0,Number(localStorage.getItem(usageKey())||0)||0);}
  function incrementUsage(){if(TESTING_UNLIMITED){updateUsage();return;}if(!isPro()){const next=usageCount()+1;localStorage.setItem(usageKey(),String(next));updateUsage();if(next>=FREE_DAILY)setTimeout(()=>openPro('Daily free limit reached',`You completed ${FREE_DAILY} free background removals today. RIVANI Pro removes the daily cap while keeping the same Precision quality.`),700);return;}updateUsage();}
  function updateUsage(){
    if(!usageText)return;
    if(TESTING_UNLIMITED){
      usageText.textContent='Testing mode · unlimited removals';
      removeBtn.disabled=!state.file;
      if(usageProBtn)usageProBtn.classList.add('hidden');
      return;
    }
    if(usageProBtn)usageProBtn.classList.remove('hidden');
    if(!signedIn()){usageText.textContent='Sign in to start removing backgrounds.';removeBtn.disabled=!state.file;return;}
    if(isPro()){usageText.textContent='Pro · unlimited background removals';removeBtn.disabled=!state.file;return;}
    const used=usageCount(),left=Math.max(0,FREE_DAILY-used);
    usageText.textContent=left?`${left} of ${FREE_DAILY} removals left today`:'Daily limit reached · upgrade to Pro for unlimited removals';
    removeBtn.disabled=!state.file||left<=0;
  }
  window.addEventListener('rivani:auth-context',updateUsage);
  window.RIVANI_AUTH_READY?.then(updateUsage).catch(()=>{});

  function openPro(title='Free daily limit reached',copy=`You used all ${FREE_DAILY} free background removals for today. Upgrade to RIVANI Pro for unlimited daily removals.`){
    if(!proModal)return;
    proTitle.textContent=title;proCopy.textContent=copy;proModal.classList.remove('hidden');document.body.style.overflow='hidden';
  }
  function closePro(){proModal?.classList.add('hidden');document.body.style.overflow='';}
  document.querySelectorAll('[data-close-bg-pro]').forEach(el=>el.addEventListener('click',closePro));
  usageProBtn?.addEventListener('click',()=>openPro('RIVANI Pro',`All Cutout Studio quality controls are included on Free. Free has ${FREE_DAILY} successful removals per day; Pro removes the daily cap. Secure checkout will connect here when billing is enabled.`));
  proBuy?.addEventListener('click',()=>openPro('Pro checkout coming next',`RIVANI Pro is planned at ₹${PRO_PRICE_INR}/month in India. The purchase button is ready for the payment gateway; billing is not connected yet.`));

  function setProgress(value,title,text,provider){
    const v=Math.max(0,Math.min(100,Math.round(value||0)));
    if(progressFill)progressFill.style.width=`${v}%`;if(progressPct)progressPct.textContent=`${v}%`;
    if(title)processingTitle.textContent=title;if(text)processingText.textContent=text;if(provider)providerText.textContent=provider;
  }
  function showProcessing(on){processing?.classList.toggle('hidden',!on);document.body.classList.toggle('bg-processing',!!on);}

  function clearAttemptTimers(){
    if(state.attemptTimer){clearTimeout(state.attemptTimer);state.attemptTimer=null;}
    if(state.progressPulseTimer){clearInterval(state.progressPulseTimer);state.progressPulseTimer=null;}
  }
  function destroyWorker(){
    clearAttemptTimers();
    if(!state.worker)return;
    try{state.worker.terminate();}catch(_e){}
    state.worker=null;
  }
  function makeWorker(){
    // Every attempt gets a fresh runtime. Desktop Precision uses WebGPU; mobile
    // Precision intentionally uses a separate WASM model so mobile GPU/JSEP hangs
    // cannot freeze the job at "Scanning subject".
    destroyWorker();
    const w=new Worker('background-remover-worker.js?v=27.9-same-birefnet',{type:'module'});
    w.addEventListener('message',onWorkerMessage);
    state.worker=w;return w;
  }
  async function runInferenceAttempt(engine,inputSize=0){
    if(!state.file)throw new Error('Choose an image first.');
    state.currentEngine=engine;state.currentInputSize=inputSize||0;
    state.jobId++;
    const id=state.jobId;
    const worker=makeWorker();
    const bitmap=await createImageBitmap(state.file);
    worker.postMessage({type:'remove',id,bitmap,engine,inputSize},[bitmap]);
  }
  function startSessionWatchdog(){
    clearAttemptTimers();
    const id=state.jobId;
    const timeoutMs=state.currentEngine==='mobile'?120000:state.currentEngine==='precision'?45000:30000;
    state.attemptTimer=setTimeout(()=>{
      if(!state.running||id!==state.jobId)return;
      handleAttemptFailure(`AI session initialization timed out on ${state.currentEngine}`,true);
    },timeoutMs);
  }
  function startInferenceWatchdog(m){
    clearAttemptTimers();
    state.visualProgress=Math.round(Number(m.value)||52);
    const engine=state.currentEngine;
    const size=Number(m.inputSize||state.currentInputSize||0);
    const timeoutMs=engine==='precision'?50000:engine==='mobile'?180000:45000;
    state.progressPulseTimer=setInterval(()=>{
      state.visualProgress=Math.min(78,state.visualProgress+1);
      setProgress(state.visualProgress,null,null,engine==='mobile'?'RIVANI Precision · CPU safe':'RIVANI Cutout Engine');
    },1400);
    const id=state.jobId;
    state.attemptTimer=setTimeout(()=>{
      if(!state.running||id!==state.jobId)return;
      handleAttemptFailure(`AI inference timed out on ${engine}${size?` ${size}px`:''}`,true);
    },timeoutMs);
  }
  function failRemoval(message){
    state.running=false;destroyWorker();showProcessing(false);setProgress(0);updateUsage();
    alert(`Background removal failed: ${message}\n\nRIVANI already retried the high-quality path and its safety fallback automatically.`);
  }
  function handleAttemptFailure(reason,timedOut=false){
    const failedEngine=state.currentEngine;
    destroyWorker();
    if(IS_MOBILE){
      if(failedEngine==='mobile' && state.mobileAttempts<2){
        state.mobileAttempts++;
        setProgress(24,'Restarting Precision safely…','Retrying the SAME BiRefNet 512 model in a fresh CPU session.','RIVANI Precision · CPU safe');
        setTimeout(()=>runInferenceAttempt('mobile',512).catch(err=>failRemoval(err.message||err)),220);
        return;
      }
      if(failedEngine!=='fast'&&!state.usedSafetyFallback){
        state.usedSafetyFallback=true;
        setProgress(30,'Starting final safety fallback…','BiRefNet could not complete on this run. The lightweight model is used only as the last emergency fallback.','Safety fallback');
        setTimeout(()=>runInferenceAttempt('fast',320).catch(err=>failRemoval(err.message||err)),220);
        return;
      }
      failRemoval(reason);return;
    }
    if(failedEngine==='precision'&&state.precisionAttempts<2){
      state.precisionAttempts++;
      setProgress(18,'Restarting Precision safely…','Fresh isolated GPU session.','RIVANI Precision');
      setTimeout(()=>runInferenceAttempt('precision',512).catch(err=>failRemoval(err.message||err)),180);
      return;
    }
    if(failedEngine==='precision'){
      setProgress(25,'Switching to CPU Precision…','GPU Precision could not finish, so RIVANI is using the higher-quality CPU safety path.','RIVANI Precision');
      setTimeout(()=>runInferenceAttempt('mobile',512).catch(err=>handleAttemptFailure(err.message||err)),180);
      return;
    }
    if(failedEngine==='mobile'&&!state.usedSafetyFallback){
      state.usedSafetyFallback=true;
      setProgress(30,'Starting final safety fallback…','High-quality CPU Precision could not complete.','Safety fallback');
      setTimeout(()=>runInferenceAttempt('fast',320).catch(err=>failRemoval(err.message||err)),180);
      return;
    }
    failRemoval(reason);
  }
  function onWorkerMessage(e){
    const m=e.data||{};if(m.id!==state.jobId)return;
    if(m.type==='progress'){
      if(m.stage==='session')startSessionWatchdog();
      else if(m.stage==='inference')startInferenceWatchdog(m);
      else if(m.stage==='post')clearAttemptTimers();
      setProgress(m.value,m.title,m.text,m.value<45?'Loading model':state.currentEngine==='mobile'?'RIVANI Precision · CPU safe':'RIVANI Cutout Engine');
      return;
    }
    if(m.type==='error'){
      handleAttemptFailure(String(m.message||'Local AI failed'));return;
    }
    if(m.type==='result'){
      clearAttemptTimers();
      if(state.currentEngine==='fast'&&state.usedSafetyFallback){m.fallbackFrom=IS_MOBILE?'mobile':'precision';}
      destroyWorker();
      finishRemoval(m).then(()=>{state.running=false;updateUsage();}).catch(err=>{state.running=false;showProcessing(false);updateUsage();alert(`Could not build the cutout: ${err.message||err}`);});
    }
  }

  function clamp(v,min=0,max=255){return Math.max(min,Math.min(max,v));}
  function safeDimensions(w,h){
    const maxMP=IS_MOBILE?20:48,maxDim=IS_MOBILE?6000:10000;
    let scale=Math.min(1,maxDim/Math.max(w,h));
    if((w*h*scale*scale)>maxMP*1e6)scale=Math.sqrt((maxMP*1e6)/(w*h));
    return [Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)),scale];
  }

  async function loadFile(file){
    if(!file||!file.type.startsWith('image/')){alert('Please choose a browser-supported image file.');return;}
    cleanupFile();
    const bitmap=await createImageBitmap(file);
    const [w,h,scale]=safeDimensions(bitmap.width,bitmap.height);
    const source=document.createElement('canvas');source.width=w;source.height=h;
    const ctx=source.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);
    state.file=file;state.bitmap=bitmap;state.sourceCanvas=source;state.outW=w;state.outH=h;state.bgEstimate=estimateBackground(source);
    state.url=URL.createObjectURL(file);
    fileName.textContent=file.name||'image';
    const sizeMB=(file.size/1048576).toFixed(file.size>10*1048576?1:2);
    fileMeta.textContent=`${bitmap.width} × ${bitmap.height} · ${sizeMB} MB${scale<0.999?` · working ${w} × ${h}`:''}`;
    editor.classList.remove('hidden');dropZone.classList.add('hidden');compareWrap.classList.remove('hidden');
    stage.style.setProperty('--bg-aspect',`${w}/${h}`);
    beforeCanvas.width=w;beforeCanvas.height=h;afterCanvas.width=w;afterCanvas.height=h;
    beforeCanvas.getContext('2d').drawImage(source,0,0);
    afterCanvas.getContext('2d').drawImage(source,0,0);
    compareWrap.style.setProperty('--compare-position','50%');compareRange.value='50';
    resetResultState();
    // Device-specific defaults are applied after each new file. Desktop receives
    // the frozen V27.6 values; mobile receives the tighter matte defaults.
    applyModePreset(state.mode,true);
    updateUsage();
  }
  function cleanupFile(){
    if(state.url)URL.revokeObjectURL(state.url);state.url='';
    try{state.bitmap?.close?.();}catch(_e){}
    state.bitmap=null;
  }
  function resetResultState(){
    state.mask=state.baseMask=state.effectiveMask=state.subjectCanvas=state.shadowCanvas=null;state.maskGuide=null;state.components=null;state.selectedComponent='all';state.undoMask=null;state.engine=null;
    subjectPicker?.classList.add('hidden');guardCard?.classList.add('hidden');resultMeta.textContent='Run Remove Background to create a transparent cutout.';
    downloadBtn.disabled=true;newImageBtn.classList.add('hidden');brushToggle.disabled=true;brushControls.classList.add('hidden');brushOverlay.classList.add('hidden');
    scanGrid.innerHTML='<div><b>Subject</b><span>Waiting</span></div><div><b>Edges</b><span>Waiting</span></div><div><b>Background</b><span>Waiting</span></div><div><b>Engine</b><span>Auto</span></div>';
  }

  async function startRemoval(){
    if(!state.file||state.running)return;
    const ok=await window.RIVANI_REQUIRE_AUTH?.({tool:'Background Remover'});
    if(ok===false)return;
    if(!TESTING_UNLIMITED&&!isPro()&&usageCount()>=FREE_DAILY){openPro();updateUsage();return;}
    state.running=true;state.precisionAttempts=1;state.mobileAttempts=1;state.usedSafetyFallback=false;
    const firstEngine=IS_MOBILE?'mobile':'precision';
    state.currentEngine=firstEngine;
    removeBtn.disabled=true;
    showProcessing(true);setProgress(2,'Preparing image…','Your image stays on this device.',IS_MOBILE?'RIVANI Precision · CPU safe':'RIVANI Precision');
    try{await runInferenceAttempt(firstEngine,512);}
    catch(e){state.running=false;destroyWorker();showProcessing(false);updateUsage();throw e;}
  }

  async function finishRemoval(m){
    state.mask=new Uint8ClampedArray(m.mask);state.baseMask=state.mask.slice();state.maskW=m.maskWidth;state.maskH=m.maskHeight;
    state.engine=m.engine;state.provider=m.provider;state.inferenceMs=m.inferenceMs||0;
    state.components=detectComponents(state.baseMask,state.maskW,state.maskH);renderSubjectPicker();
    await rebuildAll();
    updateGuard();updateScan();
    // Show the completed result immediately. The user can drag back to Before at any time.
    compareRange.value='100';
    compareWrap.style.setProperty('--compare-position','100%');
    setProgress(100,'Cutout ready','Background removed. Transparent areas are shown with a checkerboard. Choose any background on the right.',m.provider==='WebGPU'?'GPU accelerated':m.engine==='mobile'?'Precision · mobile-safe':'Compatibility safety');
    setTimeout(()=>showProcessing(false),220);
    incrementUsage();
    downloadBtn.disabled=false;newImageBtn.classList.remove('hidden');brushToggle.disabled=false;
    const stats=maskStats(state.effectiveMask);
    const engineLabel=m.engine==='precision'?'RIVANI Precision · WebGPU':m.engine==='mobile'?'RIVANI Precision · same BiRefNet/WASM':'Safety fallback';
    resultMeta.textContent=`Background removed · foreground ${stats.coverage.toFixed(0)}% · ${state.outW} × ${state.outH} · ${engineLabel} · ${(state.inferenceMs/1000).toFixed(1)}s${m.fallbackFrom?' · Precision unavailable on this run':''}`;
  }

  function maskStats(mask){
    if(!mask?.length)return {coverage:0,mean:0,min:0,max:0};
    let fg=0,sum=0,min=255,max=0;
    for(let i=0;i<mask.length;i++){const v=mask[i];sum+=v;if(v>32)fg++;if(v<min)min=v;if(v>max)max=v;}
    return {coverage:fg/mask.length*100,mean:sum/mask.length,min,max};
  }

  function mobileMatteActive(){
    // V27.9: mobile now uses the SAME BiRefNet matte as desktop. The aggressive
    // rescue path is retained ONLY for the low-quality emergency fallback.
    return state.engine==='fast';
  }

  function estimateBackground(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),w=canvas.width,h=canvas.height;
    const s=Math.max(4,Math.round(Math.min(w,h)*.025));
    const pts=[[0,0],[w-s,0],[0,h-s],[w-s,h-s]];const colors=[];
    for(const [x,y] of pts){const d=ctx.getImageData(x,y,s,s).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=16){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}colors.push([r/n,g/n,b/n]);}
    const avg=[0,1,2].map(c=>colors.reduce((a,v)=>a+v[c],0)/colors.length);
    let variance=0;for(const c of colors)variance+=Math.hypot(c[0]-avg[0],c[1]-avg[1],c[2]-avg[2]);variance/=colors.length;
    return {rgb:avg,variance};
  }

  function applyModePreset(mode,quiet=false){
    state.mode=mode;
    modeGroup.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.bgMode===mode));
    const desktop={
      auto:[22,0,1,40],portrait:[12,1,1.5,42],product:[34,-1,0.5,50],glass:[5,3,1.5,20],logo:[48,-2,0,55]
    };
    const mobile={
      auto:[34,-1,0.25,88],portrait:[26,-0.5,0.35,90],product:[44,-1.5,0.15,86],glass:[8,1,0.8,38],logo:[55,-2,0,88]
    };
    const preset=(mobileMatteActive()?mobile:desktop)[mode]||(mobileMatteActive()?mobile.auto:desktop.auto);
    [edgeClean.value,edgeShift.value,feather.value,decontam.value]=preset;
    syncSliderLabels();if(!quiet)scheduleRebuild();
  }
  function syncSliderLabels(){edgeCleanValue.textContent=`${edgeClean.value}%`;edgeShiftValue.textContent=`${Number(edgeShift.value)>0?'+':''}${edgeShift.value}`;featherValue.textContent=`${feather.value}px`;decontamValue.textContent=`${decontam.value}%`;shadowStrengthValue.textContent=`${shadowStrength.value}%`;brushSizeValue.textContent=`${brushSize.value}px`;paddingValue.textContent=`${padding.value}%`;}

  function buildEffectiveMask(){
    if(!state.mask)return null;
    const src=state.mask,w=state.maskW,h=state.maskH,out=new Uint8ClampedArray(src.length);
    const clean=Number(edgeClean.value)/100,shift=Number(edgeShift.value),mode=state.mode;
    let gamma=1;if(mode==='portrait')gamma=.88;else if(mode==='glass')gamma=.68;else if(mode==='logo')gamma=1.18;else if(mode==='product')gamma=1.05;
    const component=state.selectedComponent;
    for(let i=0;i<src.length;i++){
      let v=src[i]/255;
      if(component!=='all'&&state.components?.grid){
        const x=i%w,y=(i/w)|0,gx=Math.min(state.components.gw-1,Math.floor(x/w*state.components.gw)),gy=Math.min(state.components.gh-1,Math.floor(y/h*state.components.gh));
        if(state.components.grid[gy*state.components.gw+gx]!==Number(component)){out[i]=0;continue;}
      }
      v=Math.pow(v,gamma);
      const center=.5-shift*.012;
      const contrast=1+clean*1.6;
      v=.5+(v-center)*contrast;
      out[i]=Math.round(clamp(v*255));
    }

    // BiRefNet Precision (WebGPU desktop or WASM handheld) shares the same proven matte path.
    if(!mobileMatteActive()){
      const f=Number(feather.value);
      return f>0.01?blurMask(out,w,h,f):out;
    }

    let refined=mobileMaskCleanup(out,w,h);
    const f=Math.min(Number(feather.value),state.mode==='glass'?1:0.65);
    if(f>0.01)refined=blurMask(refined,w,h,f);
    return mobileSoftBandTighten(refined,w,h);
  }

  function mobileMaskCleanup(mask,w,h){
    let refined=sourceGuidedEdgeRefine(mask,w,h);
    const src=refined,out=refined.slice();
    for(let y=1;y<h-1;y++){
      for(let x=1;x<w-1;x++){
        const i=y*w+x,a=src[i];
        if(a===0||a===255)continue;
        let nmax=0,nmin=255,strong=0;
        for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){
          if(!xx&&!yy)continue;const v=src[i+yy*w+xx];if(v>nmax)nmax=v;if(v<nmin)nmin=v;if(v>180)strong++;
        }
        let v=a;
        // Broad weak bands are background haze, not useful soft hair. Real hair alpha
        // normally touches a much stronger neighbouring subject pixel.
        if(v<24)v=0;
        else if(v<72&&nmax<150)v*=0.16;
        else if(v<105&&nmax<175)v*=0.48;
        else if(v<135&&strong===0)v*=0.72;
        if(nmax-nmin<12&&v<58)v*=0.25;
        if(v>249)v=255;
        out[i]=Math.round(clamp(v));
      }
    }
    return out;
  }

  function mobileSoftBandTighten(mask,w,h){
    if(state.mode==='glass')return mask;
    const out=mask.slice();
    for(let i=0;i<out.length;i++){
      let v=out[i];
      if(v<10)v=0;
      else if(v<34)v*=0.34;
      else if(v<58)v*=0.72;
      else if(v>250)v=255;
      out[i]=Math.round(v);
    }
    return out;
  }

  function getMaskGuide(w,h){
    if(state.maskGuide&&state.maskGuide.w===w&&state.maskGuide.h===h)return state.maskGuide.data;
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d',{willReadFrequently:true});
    x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(state.sourceCanvas,0,0,w,h);
    const data=x.getImageData(0,0,w,h).data;
    state.maskGuide={w,h,data};return data;
  }

  function sourceGuidedEdgeRefine(mask,w,h){
    if(!state.sourceCanvas||state.mode==='glass')return mask;
    const rgb=getMaskGuide(w,h),src=mask,out=mask.slice();
    const recoverThreshold=state.mode==='portrait'?40:state.mode==='product'||state.mode==='logo'?58:48;
    const suppressThreshold=state.mode==='portrait'?42:48;
    for(let y=2;y<h-2;y++){
      for(let x=2;x<w-2;x++){
        const i=y*w+x,a=src[i];
        let nmax=0,nmin=255;
        for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){
          if(!xx&&!yy)continue;const v=src[i+yy*w+xx];if(v>nmax)nmax=v;if(v<nmin)nmin=v;
        }
        if(nmax-nmin<28&&!(a>8&&a<232))continue;

        let br=0,bg=0,bb=0,bn=0;
        for(let yy=-2;yy<=2;yy+=2){
          for(let xx=-2;xx<=2;xx+=2){
            if(!xx&&!yy)continue;const ni=i+yy*w+xx;if(src[ni]>32)continue;const j=ni*4;br+=rgb[j];bg+=rgb[j+1];bb+=rgb[j+2];bn++;
          }
        }
        if(!bn)continue;
        br/=bn;bg/=bn;bb/=bn;const j=i*4;
        const dr=rgb[j]-br,dg=rgb[j+1]-bg,db=rgb[j+2]-bb;
        const dist=Math.sqrt(dr*dr+dg*dg+db*db);

        let v=a;
        // Rescue a thin high-contrast strand/frame only when it is immediately
        // connected to the AI subject. Never grow foreground into a distant region.
        if(a<145&&nmax>165&&dist>recoverThreshold){
          const confidence=Math.min(1,(dist-recoverThreshold)/105);
          const target=Math.min(205,nmax*(0.26+0.46*confidence));
          v=Math.max(v,target*confidence);
        }
        // If an uncertain pixel still matches the nearby old background, collapse it.
        if(a<215&&dist<suppressThreshold){
          const closeness=1-dist/Math.max(1,suppressThreshold);
          v*=1-closeness*0.90;
        }
        if(v<8)v=0;else if(v>250)v=255;
        out[i]=Math.round(clamp(v));
      }
    }
    return out;
  }

  function blurMask(data,w,h,radius){
    const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=w;a.height=b.height=h;
    const c=a.getContext('2d',{willReadFrequently:true}),d=c.createImageData(w,h);
    for(let i=0,j=0;i<data.length;i++,j+=4){const v=data[i];d.data[j]=d.data[j+1]=d.data[j+2]=v;d.data[j+3]=255;}c.putImageData(d,0,0);
    const x=b.getContext('2d',{willReadFrequently:true});x.filter=`blur(${radius}px)`;x.drawImage(a,0,0);const rd=x.getImageData(0,0,w,h).data,o=new Uint8ClampedArray(data.length);
    for(let i=0,j=0;i<o.length;i++,j+=4)o[i]=rd[j];return o;
  }

  function maskCanvas(mask=state.effectiveMask,w=state.maskW,h=state.maskH){
    // IMPORTANT: this canvas is used with destination-in. The mask MUST live in
    // the alpha channel. V27.2 accidentally kept alpha at 255 everywhere, so the
    // original image stayed fully opaque even when the AI mask itself was correct.
    const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),d=x.createImageData(w,h);
    for(let i=0,j=0;i<mask.length;i++,j+=4){const v=mask[i];d.data[j]=d.data[j+1]=d.data[j+2]=255;d.data[j+3]=v;}x.putImageData(d,0,0);return c;
  }
  function maskPreviewCanvas(mask=state.effectiveMask,w=state.maskW,h=state.maskH){
    // Opaque grayscale visualization/export of the same alpha matte.
    const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),d=x.createImageData(w,h);
    for(let i=0,j=0;i<mask.length;i++,j+=4){const v=mask[i];d.data[j]=d.data[j+1]=d.data[j+2]=v;d.data[j+3]=255;}x.putImageData(d,0,0);return c;
  }
  function fullMaskCanvas(){
    const small=maskCanvas();const full=document.createElement('canvas');full.width=state.outW;full.height=state.outH;
    const x=full.getContext('2d',{willReadFrequently:mobileMatteActive()});x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(small,0,0,full.width,full.height);
    if(mobileMatteActive())refineMobileFullMask(full);
    return full;
  }

  function refineMobileFullMask(full){
    // The fallback matte is low-resolution while phone photos are usually much larger. A plain
    // bilinear upscale creates the visible cyan soft ring. Refine ONLY the uncertain
    // full-resolution edge band against source-image color, leaving the solid core
    // untouched. Keep the work bounded so large mobile photos do not run out of RAM.
    const w=full.width,h=full.height,pixels=w*h;
    if(!state.sourceCanvas||pixels>4800000||state.mode==='glass')return;
    const mx=full.getContext('2d',{willReadFrequently:true});
    const md=mx.getImageData(0,0,w,h),m=md.data;
    const src=state.sourceCanvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
    const originalAlpha=new Uint8ClampedArray(pixels);
    for(let i=0,j=3;i<pixels;i++,j+=4)originalAlpha[i]=m[j];
    const alpha=originalAlpha,out=originalAlpha.slice();
    const radii=[2,4,7];
    for(let y=2;y<h-2;y++){
      for(let x0=2;x0<w-2;x0++){
        const idx=y*w+x0,a=alpha[idx];
        if(a<=4||a>=251)continue;
        const gx=alpha[idx+1]-alpha[idx-1],gy=alpha[idx+w]-alpha[idx-w];
        const mag=Math.abs(gx)+Math.abs(gy);
        if(mag<16){if(a<28)out[idx]=0;continue;}
        const dx=gx>6?1:gx<-6?-1:0,dy=gy>6?1:gy<-6?-1:0;
        if(!dx&&!dy)continue;
        let bi=-1,fi=-1;
        for(const r of radii){
          if(bi<0){const bx=x0-dx*r,by=y-dy*r;if(bx>=0&&by>=0&&bx<w&&by<h){const ii=by*w+bx;if(alpha[ii]<72)bi=ii;}}
          if(fi<0){const fx=x0+dx*r,fy=y+dy*r;if(fx>=0&&fy>=0&&fx<w&&fy<h){const ii=fy*w+fx;if(alpha[ii]>205)fi=ii;}}
          if(bi>=0&&fi>=0)break;
        }
        if(bi<0)continue;
        const cj=idx*4,bj=bi*4;
        const c0=src[cj],c1=src[cj+1],c2=src[cj+2];
        const b0=src[bj],b1=src[bj+1],b2=src[bj+2];
        const db=Math.hypot(c0-b0,c1-b1,c2-b2);
        let nv=a;
        if(db<15&&a<220)nv*=0.08;
        else if(db<25&&a<190)nv*=0.30;
        else if(db<38&&a<150)nv*=0.60;

        if(fi>=0){
          const fj=fi*4,f0=src[fj],f1=src[fj+1],f2=src[fj+2];
          const vx=f0-b0,vy=f1-b1,vz=f2-b2,den=vx*vx+vy*vy+vz*vz;
          if(den>625){
            const est=Math.max(0,Math.min(1,((c0-b0)*vx+(c1-b1)*vy+(c2-b2)*vz)/den))*255;
            const sep=Math.min(1,(Math.sqrt(den)-25)/70);
            const trust=0.18+0.42*sep;
            // Strongly reduce background-like pixels, but only gently recover a
            // strand so the source-guided pass cannot invent a fat outline.
            if(est<nv)nv=nv*(1-trust)+est*trust;
            else if(est>nv&&nv>18)nv=nv*(1-trust*.28)+est*(trust*.28);
          }
        }
        if(nv<7)nv=0;else if(nv>250)nv=255;
        out[idx]=Math.round(clamp(nv));
      }
    }
    for(let i=0,j=3;i<pixels;i++,j+=4)m[j]=out[i];
    mx.putImageData(md,0,0);
  }

  async function rebuildAll(){
    if(!state.mask||!state.sourceCanvas)return;
    state.effectiveMask=buildEffectiveMask();
    state.subjectCanvas=buildSubjectCanvas();
    state.shadowCanvas=null;
    renderPreview();updateGuard();updateHardEdge();
  }
  function scheduleRebuild(){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(()=>rebuildAll().catch(console.error),90);}

  function buildSubjectCanvas(){
    const c=document.createElement('canvas');c.width=state.outW;c.height=state.outH;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(state.sourceCanvas,0,0);
    const m=fullMaskCanvas();x.globalCompositeOperation='destination-in';x.drawImage(m,0,0);x.globalCompositeOperation='source-over';
    const amount=Number(decontam.value)/100;
    if(amount>.01){
      if(mobileMatteActive())applyMobileEdgeDecontamination(c,m,amount);
      else if(state.bgEstimate.variance<80)applyDesktopDecontamination(c,amount);
    }
    return c;
  }

  function applyDesktopDecontamination(c,amount){
    // Frozen V27.6 desktop behaviour.
    const x=c.getContext('2d',{willReadFrequently:true}),img=x.getImageData(0,0,c.width,c.height),p=img.data,bg=state.bgEstimate.rgb;
    for(let i=0;i<p.length;i+=4){const a=p[i+3]/255;if(a<.04||a>.96)continue;const strength=amount*(1-a)*Math.max(0,1-state.bgEstimate.variance/100)*.72;if(strength<=.01)continue;const den=Math.max(.12,a);for(let k=0;k<3;k++){const corrected=clamp((p[i+k]-bg[k]*(1-a))/den);p[i+k]=Math.round(p[i+k]*(1-strength)+corrected*strength);}}
    x.putImageData(img,0,0);
  }

  function applyMobileEdgeDecontamination(subject,fullMask,amount){
    const w=subject.width,h=subject.height,pixels=w*h;
    const sx=subject.getContext('2d',{willReadFrequently:true});
    const img=sx.getImageData(0,0,w,h),p=img.data;
    const ma=fullMask.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
    // For very large originals use the conservative global unmix path to stay stable.
    if(pixels>5200000){
      const bg=state.bgEstimate.rgb;
      for(let i=0;i<p.length;i+=4){const a=p[i+3]/255;if(a<.04||a>.90)continue;const strength=amount*(1-a)*.48,den=Math.max(.16,a);for(let k=0;k<3;k++){const corrected=clamp((p[i+k]-bg[k]*(1-a))/den);p[i+k]=Math.round(p[i+k]*(1-strength)+corrected*strength);}}
      sx.putImageData(img,0,0);return;
    }

    const src=state.sourceCanvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
    const alpha=new Uint8ClampedArray(pixels);for(let i=0,j=3;i<pixels;i++,j+=4)alpha[i]=ma[j];
    const radii=[2,4,7,10];
    for(let y=2;y<h-2;y++){
      for(let x0=2;x0<w-2;x0++){
        const idx=y*w+x0,a=alpha[idx]/255;
        if(a<.035||a>.90)continue;
        const gx=alpha[idx+1]-alpha[idx-1],gy=alpha[idx+w]-alpha[idx-w];
        const dx=gx>5?1:gx<-5?-1:0,dy=gy>5?1:gy<-5?-1:0;if(!dx&&!dy)continue;
        let fi=-1,bi=-1;
        for(const r of radii){
          if(fi<0){const fx=x0+dx*r,fy=y+dy*r;if(fx>=0&&fy>=0&&fx<w&&fy<h){const ii=fy*w+fx;if(alpha[ii]>225)fi=ii;}}
          if(bi<0){const bx=x0-dx*r,by=y-dy*r;if(bx>=0&&by>=0&&bx<w&&by<h){const ii=by*w+bx;if(alpha[ii]<45)bi=ii;}}
          if(fi>=0&&bi>=0)break;
        }
        if(fi<0)continue;
        const pi=idx*4,fj=fi*4;
        let strength=amount*(1-a)*0.78;
        if(bi>=0){
          const bj=bi*4;
          const db=Math.hypot(src[pi]-src[bj],src[pi+1]-src[bj+1],src[pi+2]-src[bj+2]);
          const df=Math.hypot(src[pi]-src[fj],src[pi+1]-src[fj+1],src[pi+2]-src[fj+2]);
          // More aggressive only where the edge color is visibly closer to the old
          // background than to the solid subject interior.
          if(db<df)strength*=1.24;else strength*=0.72;
        }
        strength=Math.min(.88,strength);
        p[pi]=Math.round(p[pi]*(1-strength)+src[fj]*strength);
        p[pi+1]=Math.round(p[pi+1]*(1-strength)+src[fj+1]*strength);
        p[pi+2]=Math.round(p[pi+2]*(1-strength)+src[fj+2]*strength);
      }
    }
    sx.putImageData(img,0,0);
  }

  function renderPreview(){
    const c=afterCanvas;c.width=state.outW;c.height=state.outH;const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
    // A transparent After canvas would reveal the Before canvas beneath it and make
    // a successful cutout look unchanged. Checkerboard is preview-only, never exported.
    drawBackground(x,c.width,c.height,true);
    if(state.shadow)drawShadow(x,state.subjectCanvas,0,0,c.width,c.height);
    x.drawImage(state.subjectCanvas,0,0);
  }
  function drawCheckerPreview(ctx,w,h){
    const cell=Math.max(10,Math.min(28,Math.round(Math.min(w,h)/28)));
    ctx.fillStyle='#f1f3f7';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#d8dce4';
    for(let y=0;y<h;y+=cell)for(let x=0;x<w;x+=cell){if(((x/cell)+(y/cell))%2===0)ctx.fillRect(x,y,cell,cell);}
  }
  function drawBackground(ctx,w,h,preview=false){
    const mode=state.bgMode;
    if(mode==='transparent'){if(preview)drawCheckerPreview(ctx,w,h);return;}
    if(mode==='white'||mode==='black'||mode==='custom'){
      ctx.fillStyle=mode==='white'?'#ffffff':mode==='black'?'#000000':customColor.value;ctx.fillRect(0,0,w,h);return;
    }
    if(mode==='gradient'){
      const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#0a1029');g.addColorStop(.45,'#4051d8');g.addColorStop(1,'#e341ba');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);return;
    }
    if(mode==='blur'){
      ctx.save();ctx.filter=`blur(${Math.max(8,Math.round(Math.min(w,h)*.012))}px)`;const pad=Math.round(Math.min(w,h)*.04);ctx.drawImage(state.sourceCanvas,-pad,-pad,w+pad*2,h+pad*2);ctx.restore();return;
    }
    if(mode==='image'&&state.customBgBitmap){drawCover(ctx,state.customBgBitmap,w,h);return;}
  }

  function drawCover(ctx,img,w,h){const ar=img.width/img.height,t=w/h;let sx=0,sy=0,sw=img.width,sh=img.height;if(ar>t){sw=img.height*t;sx=(img.width-sw)/2;}else{sh=img.width/t;sy=(img.height-sh)/2;}ctx.drawImage(img,sx,sy,sw,sh,0,0,w,h);}
  function makeShadowSource(subject){
    const c=document.createElement('canvas');c.width=subject.width;c.height=subject.height;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='destination-in';x.drawImage(subject,0,0);return c;
  }
  function drawShadow(ctx,subject,dx,dy,dw,dh){
    const strength=Number(shadowStrength.value)/100;if(strength<=0)return;
    const sh=makeShadowSource(subject);ctx.save();ctx.globalAlpha=.5*strength;ctx.filter=`blur(${Math.max(5,Math.round(Math.min(dw,dh)*.012))}px)`;const ox=Math.round(dw*.012),oy=Math.round(dh*.022);ctx.drawImage(sh,dx+ox,dy+oy,dw,dh);ctx.restore();
  }

  function detectComponents(mask,w,h){
    const max=192,scale=Math.min(1,max/Math.max(w,h)),gw=Math.max(32,Math.round(w*scale)),gh=Math.max(32,Math.round(h*scale));
    const bin=new Uint8Array(gw*gh),grid=new Int16Array(gw*gh);grid.fill(-1);
    for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const sx=Math.min(w-1,Math.floor((x+.5)/gw*w)),sy=Math.min(h-1,Math.floor((y+.5)/gh*h));bin[y*gw+x]=mask[sy*w+sx]>135?1:0;}
    const comps=[];const qx=new Int16Array(gw*gh),qy=new Int16Array(gw*gh);let label=0;
    for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
      const idx=y*gw+x;if(!bin[idx]||grid[idx]>=0)continue;let head=0,tail=0;qx[tail]=x;qy[tail++]=y;grid[idx]=label;let area=0,minx=x,maxx=x,miny=y,maxy=y,sxsum=0,sysum=0;
      while(head<tail){const cx=qx[head],cy=qy[head++];area++;sxsum+=cx;sysum+=cy;if(cx<minx)minx=cx;if(cx>maxx)maxx=cx;if(cy<miny)miny=cy;if(cy>maxy)maxy=cy;const ns=[[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];for(const [nx,ny] of ns){if(nx<0||ny<0||nx>=gw||ny>=gh)continue;const ni=ny*gw+nx;if(bin[ni]&&grid[ni]<0){grid[ni]=label;qx[tail]=nx;qy[tail++]=ny;}}}
      comps.push({label,area,minx,maxx,miny,maxy,cx:sxsum/area,cy:sysum/area});label++;
    }
    const minArea=gw*gh*.004;const keep=comps.filter(c=>c.area>=minArea).sort((a,b)=>b.area-a.area).slice(0,6);
    const remap=new Map(keep.map((c,i)=>[c.label,i]));for(let i=0;i<grid.length;i++)grid[i]=remap.has(grid[i])?remap.get(grid[i]):-1;keep.forEach((c,i)=>c.label=i);
    return {gw,gh,grid,list:keep};
  }
  function renderSubjectPicker(){
    const list=state.components?.list||[];subjectButtons.innerHTML='';
    if(list.length<=1){subjectSummary.textContent=list.length===1?'1 main subject found':'Single combined subject mask';subjectPicker.classList.remove('hidden');return;}
    subjectSummary.textContent=`${list.length} separate subject regions found`;
    const all=document.createElement('button');all.type='button';all.className='active';all.textContent='Keep all';all.dataset.component='all';subjectButtons.appendChild(all);
    list.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.dataset.component=String(i);b.textContent=`Subject ${i+1}`;subjectButtons.appendChild(b);});subjectPicker.classList.remove('hidden');
    subjectButtons.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.selectedComponent=b.dataset.component;subjectButtons.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));scheduleRebuild();}));
  }

  function updateGuard(){
    if(!state.effectiveMask)return;let fg=0,soft=0,border=0;const m=state.effectiveMask,w=state.maskW,h=state.maskH;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=m[y*w+x];if(a>20)fg++;if(a>30&&a<225)soft++;if((x<2||y<2||x>w-3||y>h-3)&&a>90)border++;}
    const fgRatio=fg/m.length,softRatio=fg?soft/fg:1,borderRatio=border/(2*w+2*h||1);const modeRelief=(state.mode==='portrait'||state.mode==='glass')?10:0;
    const score=Math.round(clamp(100-softRatio*72-borderRatio*80+modeRelief,35,99));
    guardScore.textContent=`${score}%`;guardTitle.textContent=score>=88?'Clean cutout':score>=72?'Review soft edges':'Edge review recommended';
    guardCopy.textContent=score>=88?'Cutout Guard found a confident subject boundary.':score>=72?'Most edges are clean. Check hair, glass or low-contrast areas in Hardest Edge.':'The alpha mask has a large uncertain region. Use Refine Brush or try Precision engine for this image.';
    guardCard.classList.remove('hidden');
  }
  function updateScan(){
    if(!state.effectiveMask)return;const m=state.effectiveMask;let fg=0,soft=0;for(const a of m){if(a>20)fg++;if(a>30&&a<225)soft++;}
    const coverage=fg/m.length*100,softPct=fg?soft/fg*100:0;const bgCons=state.bgEstimate.variance<28?'Uniform':state.bgEstimate.variance<60?'Mixed':'Complex';
    const modeName={auto:'Auto',portrait:'Portrait / Hair',product:'Product',glass:'Glass / Soft',logo:'Logo / Text'}[state.mode];
    scanGrid.innerHTML=`<div><b>Subject</b><span>${coverage.toFixed(0)}% frame · ${state.components?.list?.length||1} region${(state.components?.list?.length||1)>1?'s':''}</span></div><div><b>Soft edges</b><span>${softPct.toFixed(0)}% of subject · ${modeName}</span></div><div><b>Background</b><span>${bgCons} corners</span></div><div><b>Engine</b><span>${state.engine==='precision'?'RIVANI Precision · GPU':state.engine==='mobile'?'RIVANI Precision · CPU':'Safety fallback'}</span></div>`;
  }
  function updateHardEdge(){
    if(!state.effectiveMask||!state.sourceCanvas)return;const m=state.effectiveMask,w=state.maskW,h=state.maskH,block=Math.max(12,Math.round(Math.min(w,h)/12));let best=-1,bx=0,by=0;
    for(let y=0;y<h;y+=block)for(let x=0;x<w;x+=block){let u=0,n=0;for(let yy=y;yy<Math.min(h,y+block);yy+=2)for(let xx=x;xx<Math.min(w,x+block);xx+=2){const a=m[yy*w+xx];if(a>28&&a<228)u++;n++;}const s=u/n;if(s>best){best=s;bx=x;by=y;}}
    state.hardEdge={x:bx/w,y:by/h,w:block/w,h:block/h,score:best};
    const c=hardEdgeCanvas;c.width=220;c.height=160;const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);const sx=bx/w*state.outW,sy=by/h*state.outH,sw=Math.min(state.outW-sx,block/w*state.outW),sh=Math.min(state.outH-sy,block/h*state.outH);x.fillStyle='#10152a';x.fillRect(0,0,c.width,c.height);x.drawImage(afterCanvas,sx,sy,sw,sh,0,0,c.width,c.height);hardEdgeLabel.textContent=best<.08?'Low uncertainty':best<.22?'Check this edge':'High-uncertainty edge';
  }

  function setBackground(mode){
    state.bgMode=mode;
    bgModeGroup.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.bgBackground===mode));
    renderPreview();updateHardEdge();
    if(state.subjectCanvas){
      const label={transparent:'Transparent',white:'White',black:'Black',blur:'Blurred original',gradient:'Studio gradient',custom:'Custom color',image:'Custom image'}[mode]||'Custom';
      resultMeta.textContent=`Background removed · ${label} background preview`;
    }
  }

  async function loadCustomBackground(file){if(!file||!file.type.startsWith('image/'))return;try{state.customBgBitmap?.close?.();}catch(_e){}state.customBgBitmap=await createImageBitmap(file);setBackground('image');}

  function setBrush(on){state.brush=on;brushToggle.classList.toggle('active',on);brushToggle.setAttribute('aria-pressed',String(on));brushControls.classList.toggle('hidden',!on);brushOverlay.classList.toggle('hidden',!on);compareRange.style.pointerEvents=on?'none':'auto';stage.classList.toggle('brush-active',on);if(on){brushOverlay.width=state.maskW||512;brushOverlay.height=state.maskH||512;}else clearBrushOverlay();}
  function clearBrushOverlay(){const x=brushOverlay.getContext('2d');x.clearRect(0,0,brushOverlay.width,brushOverlay.height);}
  function brushPoint(evt){const r=stage.getBoundingClientRect();const x=(evt.clientX-r.left)/r.width,y=(evt.clientY-r.top)/r.height;return [clamp(Math.round(x*state.maskW),0,state.maskW-1),clamp(Math.round(y*state.maskH),0,state.maskH-1),r];}
  function applyBrushAt(mx,my,evt){if(!state.mask)return;const rect=stage.getBoundingClientRect();const rad=Math.max(1,Number(brushSize.value)*(state.maskW/Math.max(1,rect.width)));const r2=rad*rad;const minx=Math.max(0,Math.floor(mx-rad)),maxx=Math.min(state.maskW-1,Math.ceil(mx+rad)),miny=Math.max(0,Math.floor(my-rad)),maxy=Math.min(state.maskH-1,Math.ceil(my+rad));
    for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){const dx=x-mx,dy=y-my,d2=dx*dx+dy*dy;if(d2>r2)continue;const t=1-Math.sqrt(d2)/rad,idx=y*state.maskW+x;if(state.brushMode==='erase')state.mask[idx]=Math.round(state.mask[idx]*(1-t));else state.mask[idx]=Math.round(state.mask[idx]+(255-state.mask[idx])*t);}
    const o=brushOverlay.getContext('2d');o.fillStyle=state.brushMode==='erase'?'rgba(255,75,110,.20)':'rgba(66,232,196,.20)';o.beginPath();o.arc(mx,my,rad,0,Math.PI*2);o.fill();
  }
  stage.addEventListener('pointerdown',e=>{if(!state.brush||!state.mask)return;state.painting=true;state.undoMask=state.mask.slice();stage.setPointerCapture?.(e.pointerId);const [x,y]=brushPoint(e);applyBrushAt(x,y,e);});
  stage.addEventListener('pointermove',e=>{if(!state.painting||!state.brush)return;const [x,y]=brushPoint(e);applyBrushAt(x,y,e);});
  const endPaint=()=>{if(!state.painting)return;state.painting=false;clearBrushOverlay();scheduleRebuild();};stage.addEventListener('pointerup',endPaint);stage.addEventListener('pointercancel',endPaint);

  function currentBBox(mask=state.effectiveMask){
    if(!mask)return {x:0,y:0,w:state.maskW,h:state.maskH};let minx=state.maskW,miny=state.maskH,maxx=-1,maxy=-1;for(let y=0;y<state.maskH;y++)for(let x=0;x<state.maskW;x++){if(mask[y*state.maskW+x]>35){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;}}
    if(maxx<0)return {x:0,y:0,w:state.maskW,h:state.maskH};return {x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1};
  }
  function exportCanvas(kind='composite'){
    const preset=canvasPreset.value||'original',pad=Number(padding.value)/100;
    if(preset==='original'){
      if(kind==='subject')return copyCanvas(state.subjectCanvas);
      const c=document.createElement('canvas');c.width=state.outW;c.height=state.outH;const x=c.getContext('2d');
      drawBackground(x,c.width,c.height,false);
      if(state.shadow)drawShadow(x,state.subjectCanvas,0,0,c.width,c.height);
      x.drawImage(state.subjectCanvas,0,0);return c;
    }
    const long=Math.min(Math.max(state.outW,state.outH),IS_MOBILE?4096:8192);let w,h;if(preset==='square'){w=h=long;}else if(preset==='45'){h=long;w=Math.round(long*.8);}else{w=Math.round(long*16/9);h=long;if(w>8192){const s=8192/w;w=Math.round(w*s);h=Math.round(h*s);}}
    const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
    if(kind!=='subject')drawBackground(x,w,h,false);
    const b=currentBBox(),sx=b.x/state.maskW*state.outW,sy=b.y/state.maskH*state.outH,sw=b.w/state.maskW*state.outW,sh=b.h/state.maskH*state.outH;const availW=w*(1-pad*2),availH=h*(1-pad*2),s=Math.min(availW/sw,availH/sh),dw=sw*s,dh=sh*s,dx=(w-dw)/2,dy=(h-dh)/2;
    if(kind!=='subject'&&state.shadow){const crop=document.createElement('canvas');crop.width=Math.max(1,Math.round(sw));crop.height=Math.max(1,Math.round(sh));crop.getContext('2d').drawImage(state.subjectCanvas,sx,sy,sw,sh,0,0,crop.width,crop.height);drawShadow(x,crop,dx,dy,dw,dh);}
    x.drawImage(state.subjectCanvas,sx,sy,sw,sh,dx,dy,dw,dh);return c;
  }

  function copyCanvas(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c;}
  function canvasBlob(canvas,type='image/png',quality=.92){return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('Encoding failed')),type,quality));}
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
  function maskExportCanvas(){const c=document.createElement('canvas');c.width=state.outW;c.height=state.outH;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,c.width,c.height);x.imageSmoothingEnabled=true;x.drawImage(maskPreviewCanvas(),0,0,c.width,c.height);return c;}
  function shadowExportCanvas(){const c=document.createElement('canvas');c.width=state.outW;c.height=state.outH;const x=c.getContext('2d');drawShadow(x,state.subjectCanvas,0,0,c.width,c.height);return c;}
  async function exportResult(){
    if(!state.subjectCanvas)return;downloadBtn.disabled=true;downloadBtn.textContent='Preparing download…';
    try{
      const type=exportType.value,q=exportQuality.value==='standard'?.82:exportQuality.value==='max'?.98:.92;const base=(state.file.name||'image').replace(/\.[^.]+$/,'');
      if(type==='mask'){downloadBlob(await canvasBlob(maskExportCanvas(),'image/png'),`${base}-alpha-mask.png`);}
      else if(type==='shadow'){downloadBlob(await canvasBlob(shadowExportCanvas(),'image/png'),`${base}-shadow.png`);}
      else if(type==='subject-webp'){downloadBlob(await canvasBlob(exportCanvas('subject'),'image/webp',q),`${base}-cutout.webp`);}
      else if(type==='composite-jpeg'){const c=exportCanvas('composite');if(state.bgMode==='transparent'){const x=c.getContext('2d');x.globalCompositeOperation='destination-over';x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='source-over';}downloadBlob(await canvasBlob(c,'image/jpeg',q),`${base}-background-removed.jpg`);}
      else if(type==='pack'){
        const {default:JSZip}=await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');const zip=new JSZip();
        zip.file(`${base}-cutout.png`,await canvasBlob(exportCanvas('subject'),'image/png'));zip.file(`${base}-alpha-mask.png`,await canvasBlob(maskExportCanvas(),'image/png'));zip.file(`${base}-shadow.png`,await canvasBlob(shadowExportCanvas(),'image/png'));zip.file(`${base}-preview.webp`,await canvasBlob(exportCanvas('composite'),'image/webp',.9));
        downloadBlob(await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}}),`${base}-rivani-cutout-pack.zip`);
      } else {downloadBlob(await canvasBlob(exportCanvas('subject'),'image/png'),`${base}-cutout.png`);}
    }catch(err){alert(`Export failed: ${err.message||err}`);}finally{downloadBtn.disabled=false;downloadBtn.textContent='Download →';}
  }

  function openImagePicker(){fileInput.value='';fileInput.click();}
  chooseBtn.addEventListener('click',openImagePicker);replaceBtn?.addEventListener('click',openImagePicker);fileInput.addEventListener('change',()=>loadFile(fileInput.files?.[0]).catch(e=>alert(e.message)));
  newImageBtn?.addEventListener('click',openImagePicker);removeBtn.addEventListener('click',()=>startRemoval().catch(e=>{showProcessing(false);alert(e.message||e);}));
  ['dragenter','dragover'].forEach(t=>dropZone.addEventListener(t,e=>{e.preventDefault();dropZone.classList.add('dragging');}));['dragleave','drop'].forEach(t=>dropZone.addEventListener(t,e=>{e.preventDefault();dropZone.classList.remove('dragging');}));dropZone.addEventListener('drop',e=>loadFile(e.dataTransfer.files?.[0]).catch(err=>alert(err.message)));
  document.addEventListener('paste',e=>{const f=[...(e.clipboardData?.files||[])].find(x=>x.type.startsWith('image/'));if(f)loadFile(f).catch(err=>alert(err.message));});
  compareRange.addEventListener('input',()=>compareWrap.style.setProperty('--compare-position',`${compareRange.value}%`));
  modeGroup.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>applyModePreset(b.dataset.bgMode)));
  [edgeClean,edgeShift,feather,decontam].forEach(el=>el.addEventListener('input',()=>{syncSliderLabels();scheduleRebuild();}));
  bgModeGroup.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setBackground(b.dataset.bgBackground)));
  customColor.addEventListener('input',()=>{if(state.bgMode==='custom')renderPreview();});customBgBtn.addEventListener('click',()=>customBgInput.click());customBgInput.addEventListener('change',()=>loadCustomBackground(customBgInput.files?.[0]).catch(console.error));
  shadowToggle.addEventListener('click',()=>{state.shadow=!state.shadow;shadowToggle.classList.toggle('active',state.shadow);shadowToggle.setAttribute('aria-pressed',String(state.shadow));renderPreview();});shadowStrength.addEventListener('input',()=>{syncSliderLabels();if(state.shadow)renderPreview();});
  brushToggle.addEventListener('click',()=>setBrush(!state.brush));eraseBrush.addEventListener('click',()=>{state.brushMode='erase';eraseBrush.classList.add('active');restoreBrush.classList.remove('active');});restoreBrush.addEventListener('click',()=>{state.brushMode='restore';restoreBrush.classList.add('active');eraseBrush.classList.remove('active');});brushSize.addEventListener('input',syncSliderLabels);
  undoBrush.addEventListener('click',()=>{if(state.undoMask){const tmp=state.mask;state.mask=state.undoMask;state.undoMask=tmp;scheduleRebuild();}});resetMask.addEventListener('click',()=>{if(state.baseMask){state.undoMask=state.mask?.slice();state.mask=state.baseMask.slice();state.selectedComponent='all';subjectButtons.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===0));scheduleRebuild();}});
  canvasPreset.addEventListener('change',()=>{});padding.addEventListener('input',syncSliderLabels);downloadBtn.addEventListener('click',exportResult);
  window.addEventListener('beforeunload',()=>{cleanupFile();try{state.customBgBitmap?.close?.();}catch(_e){}destroyWorker();});
  applyModePreset(state.mode,true);updateUsage();
})();
