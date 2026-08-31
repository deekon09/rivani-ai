// RIVANI AI · Image Enhancer V25.10
// Adaptive desktop flagship + Mobile Selective AI + shared RIVANI HD Finish.
// Desktop keeps the flagship full-image model path. Mobile uses a bounded number
// of efficient-model tiles over a source-preserving resize so mid-range phones
// can finish instead of timing out after hundreds of model calls.

const ORT_VERSION="1.29.0";
const ORT_WEBGPU_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.webgpu.min.mjs`;
const ORT_WASM_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.min.mjs`;
const ORT_WASM_BASE=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

const MODEL_CONFIG={
  flagship:{
    urls:[
      "https://rivani-models.rivani.workers.dev/image-enhancer-x4.onnx",
      "https://huggingface.co/qualcomm/Real-ESRGAN-x4plus/resolve/93195f43da324a8a3e49b563c69e6eadb6f3993d/Real-ESRGAN-x4plus.onnx?download=true"
    ],
    cacheKey:"realesrgan-x4plus-qualcomm-128-v1",
    minBytes:10_000_000
  },
  mobile:{
    urls:[
      "https://rivani-models.rivani.workers.dev/image-enhancer-mobile-x4.onnx",
      "https://huggingface.co/qualcomm/Real-ESRGAN-General-x4v3/resolve/fa56d1c4c62c61cb0efe60f88a549d30b3a1dae3/Real-ESRGAN-General-x4v3.onnx?download=true"
    ],
    cacheKey:"realesrgan-general-x4v3-qualcomm-128-v1",
    minBytes:1_000_000
  }
};

const CACHE_DB="rivani-image-models-v1";
const CACHE_STORE="models";
const TILE=128;
const SCALE=4;
const CONTEXT=8;
const CORE=TILE-CONTEXT*2;

let ort=null;
let session=null;
let provider="RIVANI AI Engine";
let sessionMode="none";
let activeModelKind="none";
let inputName="";
let outputName="";
let performanceProfile="balanced";
let imageMode="natural";
let hdFinishEnabled=true;
let hdFinishStrength=70;
let uiPressure=0;
const modelBytesCache=new Map();

self.onmessage=async event=>{
  const msg=event.data||{};
  if(msg.type==="ui-pressure"){
    uiPressure=Math.max(0,Math.min(1,Number(msg.value)||0));
    return;
  }
  if(msg.type!=="enhance")return;

  try{
    const width=Number(msg.width);
    const height=Number(msg.height);
    const targetScale=Number(msg.targetScale)===4?4:2;
    const pixels=new Uint8ClampedArray(msg.rgba);
    performanceProfile=normalizeProfile(msg.performanceProfile);
    imageMode=normalizeMode(msg.imageMode);
    hdFinishEnabled=msg.hdFinishEnabled!==false;
    hdFinishStrength=Math.max(0,Math.min(100,Number(msg.hdFinishStrength)||0));
    uiPressure=0;

    if(!width||!height||pixels.length!==width*height*4){
      throw new Error("Invalid image buffer.");
    }

    const result=performanceProfile==="mobile"
      ?await enhanceMobileHybrid(pixels,width,height,targetScale)
      :await enhanceDesktop(pixels,width,height,targetScale);

    if(hdFinishEnabled&&hdFinishStrength>0){
      self.postMessage({
        type:"status",progress:98,
        text:"Applying RIVANI HD Finish…",
        provider:result.provider||provider
      });
      applyRivaniHdFinish(result.rgba,result.width,result.height,imageMode,hdFinishStrength);
    }

    self.postMessage({
      type:"done",
      width:result.width,
      height:result.height,
      rgba:result.rgba.buffer,
      provider:result.provider||provider,
      performanceProfile,
      mobileRefineTiles:result.mobileRefineTiles||0,
      mobileTotalTiles:result.mobileTotalTiles||0,
      hdFinishApplied:Boolean(hdFinishEnabled&&hdFinishStrength>0),
      hdFinishStrength:hdFinishEnabled?hdFinishStrength:0
    },[result.rgba.buffer]);
  }catch(error){
    self.postMessage({type:"error",message:error?.message||"Image enhancement failed."});
  }finally{
    await releaseSession();
  }
};

function normalizeProfile(value){
  return value==="fast"||value==="cool"||value==="mobile"?value:"balanced";
}
function normalizeMode(value){
  return value==="strong"||value==="restore"?value:"natural";
}

async function enhanceDesktop(src,width,height,targetScale){
  await ensureSession("flagship",true);
  self.postMessage({type:"status",progress:2,text:"AI model ready. Preparing image tiles…",provider});
  const result=await processTiles({
    src,width,height,targetScale,
    tiles:buildTiles(width,height),
    output:null,
    startProgress:3,endProgress:97,
    phase:"desktop",
    refineMask:null
  });
  result.provider=provider;
  return result;
}

async function enhanceMobileHybrid(src,width,height,targetScale){
  const tiles=buildTiles(width,height);
  const total=tiles.length;
  const outW=Math.round(width*targetScale);
  const outH=Math.round(height*targetScale);

  // V25.9: do not run either model over every mobile tile. On mid-range Android,
  // hundreds of 128px WebGPU/WASM calls can take longer than the browser's safe
  // interactive window. Start from a high-quality source-preserving resize and
  // spend real AI compute only where the image contains the most useful detail.
  const base=makeSourceBaseline(src,width,height,outW,outH);

  await ensureSession("mobile",false);
  provider=sessionMode.startsWith("webgpu")?"WebGPU-MobileSelective":"WASM-MobileSelective";

  const sparseMask=selectMobileSparseTiles(src,width,height,tiles,imageMode,sessionMode);
  const sparseTiles=tiles.filter(tile=>sparseMask.has(tile.index));

  self.postMessage({
    type:"status",progress:2,
    text:`Mobile Selective AI: enhancing ${sparseTiles.length} important areas instead of ${total} full-image tiles…`,
    provider
  });

  if(!sparseTiles.length){
    return {
      width:outW,height:outH,rgba:base,
      provider:"RIVANI Mobile Selective",
      mobileRefineTiles:0,mobileTotalTiles:total
    };
  }

  const refined=await processTiles({
    src,width,height,targetScale,
    tiles:sparseTiles,
    output:base,
    outW,outH,
    startProgress:3,endProgress:97,
    phase:"mobile-sparse",
    refineMask:sparseMask
  });

  refined.provider=provider;
  refined.mobileRefineTiles=sparseTiles.length;
  refined.mobileTotalTiles=total;
  return refined;
}

function makeSourceBaseline(src,width,height,outW,outH){
  if(typeof OffscreenCanvas!=="undefined"){
    const sourceCanvas=new OffscreenCanvas(width,height);
    const sourceCtx=sourceCanvas.getContext("2d",{alpha:true,willReadFrequently:false});
    sourceCtx.putImageData(new ImageData(src,width,height),0,0);

    const outCanvas=new OffscreenCanvas(outW,outH);
    const outCtx=outCanvas.getContext("2d",{alpha:true,willReadFrequently:true});
    outCtx.imageSmoothingEnabled=true;
    outCtx.imageSmoothingQuality="high";
    outCtx.drawImage(sourceCanvas,0,0,outW,outH);
    return outCtx.getImageData(0,0,outW,outH).data;
  }

  // Compatibility fallback. It is intentionally simple but preserves the
  // original image everywhere the AI is not needed instead of returning blank
  // pixels. Modern Chrome/Android normally uses OffscreenCanvas above.
  const out=new Uint8ClampedArray(outW*outH*4);
  for(let y=0;y<outH;y++){
    const sy=Math.min(height-1,Math.floor(y*height/outH));
    for(let x=0;x<outW;x++){
      const sx=Math.min(width-1,Math.floor(x*width/outW));
      const si=(sy*width+sx)*4;
      const di=(y*outW+x)*4;
      out[di]=src[si];out[di+1]=src[si+1];out[di+2]=src[si+2];out[di+3]=src[si+3];
    }
  }
  return out;
}

function selectMobileSparseTiles(src,width,height,tiles,mode,engineMode){
  const memory=Number(self.navigator?.deviceMemory)||0;
  const cores=Math.max(1,Number(self.navigator?.hardwareConcurrency)||4);
  let cap=mode==="restore"?40:mode==="strong"?34:28;

  // Lower-memory phones get a stricter bounded workload. Stronger phones may
  // spend a few more real-AI passes without turning the job back into a full
  // image model sweep. If WebGPU is unavailable and the phone fell to WASM,
  // cut neural calls again because each tile is materially more expensive.
  if(memory&&memory<=4)cap-=6;
  else if(memory>=8&&cores>=8)cap+=6;
  if(engineMode==="wasm")cap=Math.min(cap,mode==="restore"?24:mode==="strong"?20:16);
  cap=Math.max(engineMode==="wasm"?12:20,Math.min(46,cap,tiles.length));

  const ranked=tiles.map(tile=>({tile,score:tileDetailScore(src,width,height,tile)}))
    .sort((a,b)=>b.score-a.score);
  const mask=new Set(ranked.slice(0,cap).map(item=>item.tile.index));

  // Reserve central identity/product areas even if smooth skin or flat product
  // surfaces have a lower raw gradient score than foliage/text elsewhere.
  const cx=width*.5,cy=height*.46;
  const centers=tiles.map(tile=>{
    const tx=tile.gx+tile.coreW*.5,ty=tile.gy+tile.coreH*.5;
    const dx=(tx-cx)/Math.max(1,width*.30),dy=(ty-cy)/Math.max(1,height*.34);
    return {tile,d:dx*dx+dy*dy};
  }).filter(item=>item.d<=1).sort((a,b)=>a.d-b.d).slice(0,6);

  centers.forEach(item=>mask.add(item.tile.index));

  if(mask.size>cap){
    const keep=new Set(ranked.slice(0,Math.max(0,cap-2)).map(item=>item.tile.index));
    centers.slice(0,2).forEach(item=>keep.add(item.tile.index));
    return keep;
  }
  return mask;
}

function buildTiles(width,height){
  const cols=Math.ceil(width/CORE);
  const rows=Math.ceil(height/CORE);
  const tiles=[];
  let index=0;
  for(let row=0,gy=0;gy<height;row++,gy+=CORE){
    const coreH=Math.min(CORE,height-gy);
    for(let col=0,gx=0;gx<width;col++,gx+=CORE){
      tiles.push({index:index++,row,col,gx,gy,coreW:Math.min(CORE,width-gx),coreH});
    }
  }
  tiles.cols=cols;
  tiles.rows=rows;
  return tiles;
}

function selectRefineTiles(src,width,height,tiles,mode){
  const fraction=mode==="restore"?.36:mode==="strong"?.30:.20;
  const ranked=tiles.map(tile=>({tile,score:tileDetailScore(src,width,height,tile)}))
    .sort((a,b)=>b.score-a.score);
  const wanted=Math.max(6,Math.min(tiles.length,Math.ceil(tiles.length*fraction)));
  const mask=new Set(ranked.slice(0,wanted).map(item=>item.tile.index));

  // Portraits and product shots often place identity-critical content near the
  // center even when skin/smooth surfaces have fewer gradients than foliage/text.
  // Reserve a small center set without turning the whole phone job back into x4plus.
  const cx=width*.5,cy=height*.46;
  const centerCandidates=tiles
    .map(tile=>{
      const tx=tile.gx+tile.coreW*.5,ty=tile.gy+tile.coreH*.5;
      const dx=(tx-cx)/Math.max(1,width*.30),dy=(ty-cy)/Math.max(1,height*.34);
      return {tile,d:dx*dx+dy*dy};
    })
    .filter(item=>item.d<=1)
    .sort((a,b)=>a.d-b.d)
    .slice(0,Math.min(6,Math.ceil(tiles.length*.05)));
  centerCandidates.forEach(item=>mask.add(item.tile.index));

  // Hard ceiling keeps the flagship share bounded on long mobile jobs.
  const maxCount=Math.max(wanted,Math.ceil(tiles.length*(mode==="restore"?.42:.36)));
  if(mask.size>maxCount){
    const keep=new Set(ranked.slice(0,maxCount).map(item=>item.tile.index));
    // Preserve the two most central tiles even if their edge score is low.
    centerCandidates.slice(0,2).forEach(item=>keep.add(item.tile.index));
    return keep;
  }
  return mask;
}

function tileDetailScore(src,width,height,tile){
  const step=5;
  let edge=0,contrast=0,count=0;
  const xEnd=Math.max(tile.gx+1,Math.min(width-2,tile.gx+tile.coreW-1));
  const yEnd=Math.max(tile.gy+1,Math.min(height-2,tile.gy+tile.coreH-1));
  let mean=0,mean2=0;
  for(let y=Math.max(1,tile.gy);y<yEnd;y+=step){
    for(let x=Math.max(1,tile.gx);x<xEnd;x+=step){
      const i=(y*width+x)*4;
      const l=src[i]*.2126+src[i+1]*.7152+src[i+2]*.0722;
      const ir=(y*width+Math.min(width-1,x+step))*4;
      const id=(Math.min(height-1,y+step)*width+x)*4;
      const lr=src[ir]*.2126+src[ir+1]*.7152+src[ir+2]*.0722;
      const ld=src[id]*.2126+src[id+1]*.7152+src[id+2]*.0722;
      edge+=Math.abs(l-lr)+Math.abs(l-ld);
      mean+=l; mean2+=l*l; count++;
    }
  }
  if(!count)return 0;
  mean/=count;
  const variance=Math.max(0,mean2/count-mean*mean);
  contrast=Math.sqrt(variance);
  return edge/count+contrast*.55;
}

async function processTiles({src,width,height,targetScale,tiles,output,outW,outH,startProgress,endProgress,phase,refineMask}){
  outW=outW||width*targetScale;
  outH=outH||height*targetScale;
  output=output||new Uint8ClampedArray(outW*outH*4);
  const total=tiles.length;
  let completed=0;
  let outputFactor=null;
  let lastReported=-1;
  let lastReportAt=0;
  let paceBatchStarted=performance.now();
  let tileEmaMs=0;
  let tileBaselineMs=Infinity;
  const inputBuffer=new Float32Array(TILE*TILE*3);
  const cols=Math.ceil(width/CORE);
  const rows=Math.ceil(height/CORE);

  for(const tile of tiles){
    const tileStarted=performance.now();
    fillTileTensor(inputBuffer,src,width,height,tile.gx,tile.gy);
    const outTensor=await runTile(inputBuffer);
    if(outputFactor===null)outputFactor=detectOutputFactor(outTensor.data);
    try{
      if(refineMask){
        writeCoreRefine(outTensor,outputFactor,output,outW,tile,targetScale,refineMask,cols,rows);
      }else{
        writeCore(outTensor,outputFactor,output,outW,tile.gx,tile.gy,tile.coreW,tile.coreH,targetScale);
      }
    }finally{
      try{outTensor?.dispose?.();}catch(_error){}
    }

    completed++;
    const tileMs=Math.max(1,performance.now()-tileStarted);
    tileEmaMs=tileEmaMs?tileEmaMs*.88+tileMs*.12:tileMs;
    if(completed<=8)tileBaselineMs=Math.min(tileBaselineMs,tileMs);
    else tileBaselineMs=Math.min(tileBaselineMs*1.0015,tileMs);

    paceBatchStarted=await adaptivePace(completed,total,paceBatchStarted,tileEmaMs,tileBaselineMs,phase);

    const progress=Math.round(startProgress+(completed/total)*(endProgress-startProgress));
    const now=performance.now();
    if(progress!==lastReported&&(now-lastReportAt>=120||completed===total)){
      lastReported=progress; lastReportAt=now;
      const text=phase==="mobile-sparse"
        ?`Selective AI detail ${completed} of ${total}…`
        :`Enhancing detail ${completed} of ${total}…`;
      self.postMessage({type:"status",progress,text,provider});
    }
  }
  return {width:outW,height:outH,rgba:output};
}

async function ensureSession(modelKind,graphCapture){
  if(session&&activeModelKind===modelKind)return;
  await releaseSession();
  const bytes=await getModelBytes(modelKind);

  if(self.navigator?.gpu){
    try{
      await createWebGpuSession(bytes,modelKind,Boolean(graphCapture));
      return;
    }catch(error){
      await releaseSession();
      if(graphCapture){
        try{
          await createWebGpuSession(bytes,modelKind,false);
          return;
        }catch(_second){await releaseSession();}
      }
    }
  }
  await createWasmSession(bytes,modelKind);
}

async function createWebGpuSession(bytes,modelKind,graphCapture){
  ort=await import(ORT_WEBGPU_URL);
  ort.env.wasm.wasmPaths=ORT_WASM_BASE;
  if(ort.env.webgpu){
    if(performanceProfile==="fast"&&modelKind==="flagship")ort.env.webgpu.powerPreference="high-performance";
    ort.env.webgpu.forceFallbackAdapter=false;
  }
  session=await ort.InferenceSession.create(bytes,{
    executionProviders:["webgpu"],graphOptimizationLevel:"all",enableGraphCapture:Boolean(graphCapture)
  });
  inputName=session.inputNames[0]; outputName=session.outputNames[0];
  sessionMode=graphCapture?"webgpu-graph":"webgpu";
  activeModelKind=modelKind;
  provider=performanceProfile==="mobile"?"WebGPU-MobileSelective":(graphCapture?"WebGPU-Graph":"WebGPU");
}

async function createWasmSession(bytes,modelKind){
  ort=await import(ORT_WASM_URL);
  ort.env.wasm.wasmPaths=ORT_WASM_BASE;
  const cores=Math.max(1,Number(self.navigator?.hardwareConcurrency)||1);
  const canThread=self.crossOriginIsolated===true;
  const threads=canThread?Math.max(1,Math.min(4,cores-1)):1;
  ort.env.wasm.numThreads=threads; ort.env.wasm.simd=true;
  session=await ort.InferenceSession.create(bytes,{executionProviders:["wasm"],graphOptimizationLevel:"all"});
  inputName=session.inputNames[0]; outputName=session.outputNames[0];
  sessionMode="wasm"; activeModelKind=modelKind;
  provider=performanceProfile==="mobile"?"WASM-MobileSelective":(threads>1?`WASM-${threads}`:"WASM");
}

async function releaseSession(){
  try{session?.release?.();}catch(_error){}
  session=null; inputName=""; outputName=""; sessionMode="none"; activeModelKind="none";
}

async function runTile(input){
  const modelKind=activeModelKind;
  const execute=async()=>{
    const tensor=new ort.Tensor("float32",input,[1,3,TILE,TILE]);
    try{
      const outputs=await session.run({[inputName]:tensor});
      const outTensor=outputs[outputName];
      if(!outTensor?.data)throw new Error("AI model returned an empty result.");
      return outTensor;
    }finally{try{tensor?.dispose?.();}catch(_error){}}
  };
  try{return await execute();}
  catch(error){
    if(!sessionMode.startsWith("webgpu"))throw error;
    const bytes=await getModelBytes(modelKind);
    await releaseSession();
    self.postMessage({type:"status",progress:2,text:"GPU path adjusted for this device…",provider:"RIVANI AI Engine"});
    await createWasmSession(bytes,modelKind);
    return await execute();
  }
}

// V25.10: lightweight full-frame finishing pass shared by desktop and mobile.
// This is intentionally not marketed as another neural model. It adds controlled
// local contrast, vibrance and micro-detail after AI reconstruction. The pass is
// in-place and keeps only three luminance rows, so mobile memory stays bounded.
function applyRivaniHdFinish(rgba,width,height,mode,strength){
  const power=Math.max(0,Math.min(1,Number(strength)||0)/100);
  if(power<=0||width<3||height<3)return;

  const params=mode==="strong"
    ?{contrast:.080,vibrance:.180,detail:.480,lift:.012}
    :mode==="restore"
      ?{contrast:.055,vibrance:.105,detail:.350,lift:.007}
      :{contrast:.045,vibrance:.105,detail:.250,lift:.006};

  const contrast=params.contrast*power;
  const vibrance=params.vibrance*power;
  const detailAmount=params.detail*power;
  const lift=params.lift*power;

  let prev=new Float32Array(width);
  let curr=new Float32Array(width);
  let next=new Float32Array(width);

  const fillLum=(y,row)=>{
    const base=y*width*4;
    for(let x=0;x<width;x++){
      const i=base+x*4;
      row[x]=(rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722)/255;
    }
  };

  fillLum(0,curr);
  prev.set(curr);
  fillLum(Math.min(1,height-1),next);

  for(let y=0;y<height;y++){
    const rowBase=y*width*4;
    for(let x=0;x<width;x++){
      const i=rowBase+x*4;
      if(rgba[i+3]<8)continue;

      const lum=curr[x];
      const left=curr[x>0?x-1:x];
      const right=curr[x<width-1?x+1:x];
      const localAvg=(prev[x]+next[x]+left+right)*.25;
      const rawDetail=Math.max(-.085,Math.min(.085,lum-localAvg));
      const detailGate=Math.min(1,.18+Math.abs(rawDetail)*18);
      const micro=rawDetail*detailAmount*detailGate;

      const centered=lum-.5;
      const curve=centered*(1-Math.min(1,4*centered*centered));
      const dimensional=curve*contrast;
      const midPresence=lift*Math.max(0,1-Math.abs(lum-.55)/.55)*(lum<.94?1:0);
      const targetLum=Math.max(0,Math.min(1,lum+micro+dimensional+midPresence));
      const delta=targetLum-lum;

      let r=Math.max(0,Math.min(1,rgba[i]/255+delta));
      let g=Math.max(0,Math.min(1,rgba[i+1]/255+delta));
      let b=Math.max(0,Math.min(1,rgba[i+2]/255+delta));

      const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
      const sat=mx>1e-5?(mx-mn)/mx:0;
      let vib=vibrance*(1-sat*.72);

      // Keep skin from becoming orange/red while still allowing clothing and
      // scenery to gain visible color presence.
      const skin=r>.28&&g>.16&&b>.08&&r>g&&g>b&&(r-b)>.075&&(r-g)<.30;
      if(skin)vib*=.42;
      if(targetLum>.90)vib*=.55;

      const l=r*.2126+g*.7152+b*.0722;
      r=l+(r-l)*(1+vib);
      g=l+(g-l)*(1+vib);
      b=l+(b-l)*(1+vib);

      rgba[i]=clampByte(r*255);
      rgba[i+1]=clampByte(g*255);
      rgba[i+2]=clampByte(b*255);
    }

    if(y<height-1){
      const tmp=prev; prev=curr; curr=next; next=tmp;
      fillLum(Math.min(height-1,y+2),next);
    }
  }
}

async function adaptivePace(completed,total,batchStarted,tileEmaMs,tileBaselineMs,phase){
  if(completed>=total||!sessionMode.startsWith("webgpu"))return performance.now();
  const slowdown=Number.isFinite(tileBaselineMs)&&tileBaselineMs>0?Math.max(1,tileEmaMs/tileBaselineMs):1;
  const throttling=Math.max(0,Math.min(1,(slowdown-1.20)/.55));
  const pressure=Math.max(throttling,uiPressure);

  let batchSize,baseDuty,minDuty,maxPause;
  if(performanceProfile==="mobile"){
    // V25.9 already bounds mobile AI to a small number of useful tiles, so it no
    // longer needs the very slow V25.7/V25.8 duty cycle. Keep short breathing
    // points for scrolling without turning a 2× job into a 12-minute timeout.
    batchSize=pressure>.45?1:2; baseDuty=.90; minDuty=.76; maxPause=70;
  }else if(performanceProfile==="fast"){
    batchSize=pressure>.32?12:18; baseDuty=.985; minDuty=.955; maxPause=12;
  }else if(performanceProfile==="cool"){
    batchSize=pressure>.32?2:3; baseDuty=.855; minDuty=.78; maxPause=88;
  }else{
    batchSize=pressure>.32?3:5; baseDuty=.905; minDuty=.84; maxPause=58;
  }
  if(completed%batchSize!==0)return batchStarted;
  const elapsed=Math.max(1,performance.now()-batchStarted);
  const thermalPenalty=throttling*(performanceProfile==="mobile"?.09:.075);
  const uiPenalty=uiPressure*(performanceProfile==="mobile"?(phase==="mobile-detail"?.26:.14):.08);
  const duty=Math.max(minDuty,baseDuty-thermalPenalty-uiPenalty);
  const pause=Math.min(maxPause,Math.max(0,elapsed*(1/duty-1)));
  await delay(pause>=1?Math.round(pause):0);
  return performance.now();
}

function writeCoreRefine(tensor,factor,dest,outW,tile,targetScale,mask,cols,rows){
  const dims=tensor.dims||[];
  const data=tensor.data;
  const nativeW=dims.length===4?(dims[3]===3?dims[2]:dims[3]):TILE*SCALE;
  const nativeH=dims.length===4?(dims[3]===3?dims[1]:dims[2]):TILE*SCALE;
  const nchw=dims.length===4&&dims[1]===3;
  const plane=nativeW*nativeH;
  const nativeCrop=CONTEXT*SCALE;
  const outCoreW=tile.coreW*targetScale;
  const outCoreH=tile.coreH*targetScale;
  const baseX=tile.gx*targetScale,baseY=tile.gy*targetScale;
  const feather=Math.max(8,targetScale*7);
  const leftExternal=tile.col>0&&!mask.has(tile.index-1);
  const rightExternal=tile.col<cols-1&&!mask.has(tile.index+1);
  const topExternal=tile.row>0&&!mask.has(tile.index-cols);
  const bottomExternal=tile.row<rows-1&&!mask.has(tile.index+cols);

  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};

  if(targetScale===4){
    for(let oy=0;oy<outCoreH;oy++){
      const ny=nativeCrop+oy;
      let ay=1;
      if(topExternal&&oy<feather)ay*=smooth(oy/feather);
      if(bottomExternal&&outCoreH-1-oy<feather)ay*=smooth((outCoreH-1-oy)/feather);
      for(let ox=0;ox<outCoreW;ox++){
        const nx=nativeCrop+ox; let r,g,b;
        if(nchw){const pi=ny*nativeW+nx;r=Number(data[pi]||0);g=Number(data[plane+pi]||0);b=Number(data[plane*2+pi]||0);}
        else{const pi=(ny*nativeW+nx)*3;r=Number(data[pi]||0);g=Number(data[pi+1]||0);b=Number(data[pi+2]||0);}
        let ax=1;
        if(leftExternal&&ox<feather)ax*=smooth(ox/feather);
        if(rightExternal&&outCoreW-1-ox<feather)ax*=smooth((outCoreW-1-ox)/feather);
        const a=ax*ay;
        const di=((baseY+oy)*outW+(baseX+ox))*4;
        r*=factor;g*=factor;b*=factor;
        if(a>=.999){dest[di]=clampByte(r);dest[di+1]=clampByte(g);dest[di+2]=clampByte(b);}
        else{
          dest[di]=clampByte(dest[di]*(1-a)+r*a);
          dest[di+1]=clampByte(dest[di+1]*(1-a)+g*a);
          dest[di+2]=clampByte(dest[di+2]*(1-a)+b*a);
        }
        dest[di+3]=255;
      }
    }
    return;
  }
  for(let oy=0;oy<outCoreH;oy++){
    const ny=nativeCrop+oy*2;
    let ay=1;
    if(topExternal&&oy<feather)ay*=smooth(oy/feather);
    if(bottomExternal&&outCoreH-1-oy<feather)ay*=smooth((outCoreH-1-oy)/feather);
    for(let ox=0;ox<outCoreW;ox++){
      const nx=nativeCrop+ox*2;let r=0,g=0,b=0;
      for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){
        const y=ny+yy,x=nx+xx;
        if(nchw){const pi=y*nativeW+x;r+=Number(data[pi]||0);g+=Number(data[plane+pi]||0);b+=Number(data[plane*2+pi]||0);}
        else{const pi=(y*nativeW+x)*3;r+=Number(data[pi]||0);g+=Number(data[pi+1]||0);b+=Number(data[pi+2]||0);}
      }
      let ax=1;
      if(leftExternal&&ox<feather)ax*=smooth(ox/feather);
      if(rightExternal&&outCoreW-1-ox<feather)ax*=smooth((outCoreW-1-ox)/feather);
      const a=ax*ay;
      const di=((baseY+oy)*outW+(baseX+ox))*4;
      r*=.25*factor;g*=.25*factor;b*=.25*factor;
      if(a>=.999){dest[di]=clampByte(r);dest[di+1]=clampByte(g);dest[di+2]=clampByte(b);}
      else{
        dest[di]=clampByte(dest[di]*(1-a)+r*a);
        dest[di+1]=clampByte(dest[di+1]*(1-a)+g*a);
        dest[di+2]=clampByte(dest[di+2]*(1-a)+b*a);
      }
      dest[di+3]=255;
    }
  }
}

function fillTileTensor(out,src,width,height,gx,gy){
  const plane=TILE*TILE;

  for(let ty=0;ty<TILE;ty++){
    const sy=reflectIndex(
      gy+ty-CONTEXT,
      height
    );

    for(let tx=0;tx<TILE;tx++){
      const sx=reflectIndex(
        gx+tx-CONTEXT,
        width
      );

      const source=(sy*width+sx)*4;
      const dst=ty*TILE+tx;

      out[dst]=src[source]/255;
      out[plane+dst]=src[source+1]/255;
      out[plane*2+dst]=src[source+2]/255;
    }
  }
}

function writeCore(
  tensor,
  factor,
  dest,
  outW,
  gx,
  gy,
  coreW,
  coreH,
  targetScale
){
  const dims=tensor.dims||[];
  const data=tensor.data;

  const nativeW=dims.length===4
    ?(dims[3]===3?dims[2]:dims[3])
    :TILE*SCALE;

  const nativeH=dims.length===4
    ?(dims[3]===3?dims[1]:dims[2])
    :TILE*SCALE;

  const nchw=dims.length===4&&dims[1]===3;
  const plane=nativeW*nativeH;
  const nativeCrop=CONTEXT*SCALE;
  const outCoreW=coreW*targetScale;
  const outCoreH=coreH*targetScale;
  const baseX=gx*targetScale;
  const baseY=gy*targetScale;

  // Hot path rewrite: V25 created a temporary RGB array plus .map() for every
  // output pixel. This version writes directly into the destination buffer.
  // The sampled values and averaging math are unchanged.
  if(targetScale===4){
    for(let oy=0;oy<outCoreH;oy++){
      const ny=nativeCrop+oy;
      const dy=baseY+oy;
      let di=(dy*outW+baseX)*4;

      for(let ox=0;ox<outCoreW;ox++){
        const nx=nativeCrop+ox;
        let r,g,b;

        if(nchw){
          const pi=ny*nativeW+nx;
          r=Number(data[pi]||0);
          g=Number(data[plane+pi]||0);
          b=Number(data[plane*2+pi]||0);
        }else{
          const pi=(ny*nativeW+nx)*3;
          r=Number(data[pi]||0);
          g=Number(data[pi+1]||0);
          b=Number(data[pi+2]||0);
        }

        dest[di]=clampByte(r*factor);
        dest[di+1]=clampByte(g*factor);
        dest[di+2]=clampByte(b*factor);
        dest[di+3]=255;
        di+=4;
      }
    }
    return;
  }

  // Requested 2× output: average the same native 2×2 model pixels as V25.
  for(let oy=0;oy<outCoreH;oy++){
    const ny=nativeCrop+oy*2;
    const dy=baseY+oy;
    let di=(dy*outW+baseX)*4;

    for(let ox=0;ox<outCoreW;ox++){
      const nx=nativeCrop+ox*2;
      let r=0,g=0,b=0;

      for(let yy=0;yy<2;yy++){
        const y=ny+yy;
        for(let xx=0;xx<2;xx++){
          const x=nx+xx;
          if(nchw){
            const pi=y*nativeW+x;
            r+=Number(data[pi]||0);
            g+=Number(data[plane+pi]||0);
            b+=Number(data[plane*2+pi]||0);
          }else{
            const pi=(y*nativeW+x)*3;
            r+=Number(data[pi]||0);
            g+=Number(data[pi+1]||0);
            b+=Number(data[pi+2]||0);
          }
        }
      }

      dest[di]=clampByte(r*.25*factor);
      dest[di+1]=clampByte(g*.25*factor);
      dest[di+2]=clampByte(b*.25*factor);
      dest[di+3]=255;
      di+=4;
    }
  }
}

function sampleOutput(
  data,
  dims,
  nchw,
  width,
  height,
  x,
  y,
  step,
  factor
){
  if(step===1){
    return [
      readChannel(data,nchw,width,height,x,y,0)*factor,
      readChannel(data,nchw,width,height,x,y,1)*factor,
      readChannel(data,nchw,width,height,x,y,2)*factor
    ].map(clampByte);
  }

  // Native model is 4×. For requested 2×, box-average each 2×2 native group
  // instead of running a separate fake resize/sharpen filter.
  let r=0,g=0,b=0,count=0;

  for(let yy=0;yy<step;yy++){
    for(let xx=0;xx<step;xx++){
      r+=readChannel(data,nchw,width,height,x+xx,y+yy,0);
      g+=readChannel(data,nchw,width,height,x+xx,y+yy,1);
      b+=readChannel(data,nchw,width,height,x+xx,y+yy,2);
      count++;
    }
  }

  return [
    clampByte(r/count*factor),
    clampByte(g/count*factor),
    clampByte(b/count*factor)
  ];
}

function readChannel(data,nchw,width,height,x,y,c){
  x=Math.max(0,Math.min(width-1,Math.floor(x)));
  y=Math.max(0,Math.min(height-1,Math.floor(y)));

  if(nchw){
    const plane=width*height;
    return Number(data[c*plane+y*width+x]||0);
  }

  return Number(data[(y*width+x)*3+c]||0);
}

function detectOutputFactor(data){
  let max=0;
  const step=Math.max(1,Math.floor(data.length/2048));

  for(let i=0;i<data.length;i+=step){
    const v=Math.abs(Number(data[i]||0));
    if(v>max)max=v;
  }

  return max<=2?255:1;
}

function reflectIndex(i,n){
  if(n<=1)return 0;

  while(i<0||i>=n){
    if(i<0)i=-i;
    if(i>=n)i=2*n-2-i;
  }

  return i;
}

function clampByte(v){
  return Math.max(0,Math.min(255,Math.round(v)));
}

function delay(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}


async function getModelBytes(kind){
  const cfg=MODEL_CONFIG[kind]||MODEL_CONFIG.flagship;
  if(modelBytesCache.has(kind))return modelBytesCache.get(kind);
  const cached=await idbGet(cfg.cacheKey).catch(()=>null);
  if(cached instanceof ArrayBuffer&&cached.byteLength>cfg.minBytes){
    modelBytesCache.set(kind,cached);
    self.postMessage({type:"status",progress:1,text:"AI model loaded from device cache…",provider:"RIVANI AI Engine"});
    return cached;
  }
  let lastError=null;
  for(const url of cfg.urls){
    try{
      const response=await fetch(url,{cache:"force-cache"});
      if(!response.ok)throw new Error(`Model fetch ${response.status}`);
      const total=Number(response.headers.get("content-length"))||0;
      const reader=response.body?.getReader();
      if(!reader){
        const buffer=await response.arrayBuffer();
        await idbPut(cfg.cacheKey,buffer).catch(()=>{});
        modelBytesCache.set(kind,buffer);return buffer;
      }
      const parts=[];let received=0;
      while(true){
        const {done,value}=await reader.read();if(done)break;
        parts.push(value);received+=value.byteLength;
        const pct=total?Math.min(90,Math.round(received/total*90)):Math.min(90,5+Math.round(received/500000));
        self.postMessage({type:"model-progress",progress:pct,text:kind==="mobile"?"Downloading mobile AI engine…":"Downloading detail AI engine…",provider:"RIVANI AI Engine"});
      }
      const joined=new Uint8Array(received);let offset=0;
      for(const part of parts){joined.set(part,offset);offset+=part.byteLength;}
      await idbPut(cfg.cacheKey,joined.buffer).catch(()=>{});
      modelBytesCache.set(kind,joined.buffer);return joined.buffer;
    }catch(error){lastError=error;}
  }
  throw lastError||new Error("Could not load the image enhancement model.");
}

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(CACHE_DB,1);

    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(CACHE_STORE)){
        db.createObjectStore(CACHE_STORE);
      }
    };

    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function idbGet(key){
  const db=await openDb();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction(CACHE_STORE,"readonly");
    const request=tx.objectStore(CACHE_STORE).get(key);

    request.onsuccess=()=>{
      db.close();
      resolve(request.result||null);
    };

    request.onerror=()=>{
      db.close();
      reject(request.error);
    };
  });
}

async function idbPut(key,value){
  const db=await openDb();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction(CACHE_STORE,"readwrite");
    tx.objectStore(CACHE_STORE).put(value,key);

    tx.oncomplete=()=>{
      db.close();
      resolve();
    };

    tx.onerror=()=>{
      db.close();
      reject(tx.error);
    };
  });
}
