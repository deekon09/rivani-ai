/* RIVANI Cutout Studio inference worker — V27.2 Reliable Cutout
   Image pixels stay local. Only model weights are fetched from the RIVANI model-delivery Worker.
   Auto defaults to the lightweight general-object model for fast, reliable completion.
   Precision is opt-in and uses a browser-safe 512px BiRefNet graph. */
const MODEL_BASE='https://rivani-models.rivani.workers.dev';
const MODEL_URLS={
  precision:`${MODEL_BASE}/background-remover-birefnet-512.onnx`,
  fast:`${MODEL_BASE}/background-remover-fast.onnx`,
};

const sessions=new Map();
let ortWebGpuPromise=null;
let ortWasmPromise=null;
let adapterPromise=null;

self.onmessage=async(event)=>{
  const msg=event.data||{};
  if(msg.type!=='remove')return;
  const {id,bitmap,engine='auto'}=msg;
  try{
    post(id,'progress',{value:3,title:'Preparing cutout engine…',text:'RIVANI is preparing private browser inference.'});
    const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(self.navigator?.userAgent||'');

    // V27.1: Auto is intentionally lightweight-first. It avoids a 90–120 MB
    // first-use download and prevents the 1024px WebGPU "access out of bounds" failure.
    const choice=engine==='precision'?'precision':'fast';
    let result;

    if(choice==='precision'){
      try{
        result=await inferPrecision(bitmap,id);
      }catch(error){
        post(id,'progress',{value:46,title:'Switching to Fast AI…',text:'Precision was not stable here. RIVANI is continuing automatically with the reliable engine.'});
        result=await inferFast(bitmap,id,mobile);
        result.fallbackFrom='precision';
        result.fallbackReason=String(error?.message||error||'Precision unavailable');
      }
    }else{
      result=await inferFast(bitmap,id,mobile);
    }

    try{bitmap.close?.();}catch(_e){}
    postMessage({type:'result',id,...result},[result.mask.buffer]);
  }catch(error){
    try{bitmap?.close?.();}catch(_e){}
    postMessage({type:'error',id,message:String(error?.message||error||'Background removal failed')});
  }
};

function post(id,type,payload={}){ postMessage({type,id,...payload}); }

async function getOrtWebGPU(){
  if(ortWebGpuPromise)return ortWebGpuPromise;
  ortWebGpuPromise=(async()=>{
    const mod=await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/ort.webgpu.min.mjs');
    const ort=mod.default||mod;
    ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
    ort.env.wasm.numThreads=1;
    ort.env.wasm.simd=true;
    return ort;
  })();
  return ortWebGpuPromise;
}

async function getOrtWasm(){
  if(ortWasmPromise)return ortWasmPromise;
  ortWasmPromise=(async()=>{
    // Dedicated WASM build instead of routing compatibility work through the JSEP/WebGPU bundle.
    const mod=await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/ort.min.mjs');
    const ort=mod.default||mod;
    ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
    ort.env.wasm.numThreads=1;
    ort.env.wasm.simd=true;
    return ort;
  })();
  return ortWasmPromise;
}

async function getAdapter(){
  if(adapterPromise)return adapterPromise;
  adapterPromise=(async()=>{
    if(!self.navigator?.gpu)return null;
    try{return await self.navigator.gpu.requestAdapter({powerPreference:'high-performance'});}catch(_e){return null;}
  })();
  return adapterPromise;
}

async function fetchModel(url,id,from=8,to=38,label='cutout'){
  const res=await fetch(url,{cache:'force-cache'});
  if(!res.ok)throw new Error(`${label} model download failed (${res.status})`);
  const total=Number(res.headers.get('content-length'))||0;
  if(!res.body||!total){
    const buf=await res.arrayBuffer();
    post(id,'progress',{value:to,title:'AI model ready…',text:'Model loaded. Starting subject analysis.'});
    return buf;
  }
  const reader=res.body.getReader();
  const chunks=[];let loaded=0;
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    chunks.push(value);loaded+=value.byteLength;
    const p=from+(to-from)*Math.min(1,loaded/total);
    post(id,'progress',{value:p,title:'Loading cutout model…',text:`${label} model ${(loaded/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB · cached after first load`});
  }
  const out=new Uint8Array(loaded);let off=0;
  for(const c of chunks){out.set(c,off);off+=c.byteLength;}
  return out.buffer;
}

async function getFastSession(id,provider){
  const key=`fast-${provider}`;
  if(sessions.has(key))return sessions.get(key);
  const ort=provider==='webgpu'?await getOrtWebGPU():await getOrtWasm();
  const model=await fetchModel(MODEL_URLS.fast,id,8,26,'Fast AI');
  post(id,'progress',{value:30,title:'Starting Fast AI…',text:provider==='webgpu'?'Using GPU acceleration for the lightweight cutout model.':'Using the portable local compatibility engine.'});
  const options={graphOptimizationLevel:'all',executionProviders:[provider]};
  const session=await ort.InferenceSession.create(model,options);
  sessions.set(key,{session,ort,provider});
  return sessions.get(key);
}

async function getPrecisionSession(id){
  const key='precision-webgpu';
  if(sessions.has(key))return sessions.get(key);
  const adapter=await getAdapter();
  if(!adapter)throw new Error('WebGPU adapter unavailable');
  const buffers=Number(adapter.limits?.maxStorageBuffersPerShaderStage||0);
  if(buffers&&buffers<8)throw new Error(`WebGPU adapter limit too low (${buffers} storage buffers)`);
  const ort=await getOrtWebGPU();
  const model=await fetchModel(MODEL_URLS.precision,id,8,42,'Precision AI');
  post(id,'progress',{value:45,title:'Starting Precision AI…',text:'Initializing the browser-safe 512px WebGPU matting engine.'});
  const session=await ort.InferenceSession.create(model,{graphOptimizationLevel:'all',executionProviders:['webgpu']});
  sessions.set(key,{session,ort,provider:'webgpu'});
  return sessions.get(key);
}

async function inferFast(bitmap,id,mobile){
  // High-end desktop gets GPU acceleration, but the same tiny 4.6 MB model is used.
  // Mobile starts on WASM for broad stability; this keeps the first-use path reliable.
  let provider=(!mobile&&self.navigator?.gpu)?'webgpu':'wasm';
  let pack;
  try{
    pack=await getFastSession(id,provider);
    return await runModel(bitmap,'fast',id,pack,320);
  }catch(error){
    if(provider==='webgpu'){
      post(id,'progress',{value:37,title:'Using compatibility path…',text:'GPU acceleration was unavailable for this run. Continuing locally.'});
      pack=await getFastSession(id,'wasm');
      const result=await runModel(bitmap,'fast',id,pack,320);
      result.fallbackFrom='fast-webgpu';
      result.fallbackReason=String(error?.message||error||'Fast GPU path unavailable');
      return result;
    }
    throw error;
  }
}

async function inferPrecision(bitmap,id){
  const pack=await getPrecisionSession(id);
  return await runModel(bitmap,'precision',id,pack,512);
}

async function runModel(bitmap,kind,id,pack,size){
  const {session,ort,provider}=pack;
  post(id,'progress',{value:kind==='precision'?52:40,title:'Scanning subject…',text:'Separating people, products, objects and difficult boundaries.'});
  const {tensor}=bitmapToTensor(bitmap,size,kind);
  const inputName=session.inputNames[0];
  const feeds={[inputName]:new ort.Tensor('float32',tensor,[1,3,size,size])};
  const started=performance.now();
  const outputs=await session.run(feeds);
  const elapsed=performance.now()-started;
  const raw=pickMaskOutput(outputs,session.outputNames,size);
  if(!raw)throw new Error('AI engine returned no usable alpha mask');

  post(id,'progress',{value:82,title:'Refining alpha edges…',text:'Cleaning the subject boundary without changing source pixels.'});
  let mask;
  if(kind==='precision'){
    mask=new Uint8ClampedArray(size*size);
    for(let i=0;i<mask.length;i++){
      const x=Math.max(-18,Math.min(18,Number(raw[i])||0));
      mask[i]=Math.round((1/(1+Math.exp(-x)))*255);
    }
  }else{
    let lo=Infinity,hi=-Infinity;
    const n=Math.min(raw.length,size*size);
    for(let i=0;i<n;i++){const v=Number(raw[i])||0;if(v<lo)lo=v;if(v>hi)hi=v;}
    const d=Math.max(1e-7,hi-lo);
    mask=new Uint8ClampedArray(size*size);
    for(let i=0;i<mask.length;i++){
      let v=((Number(raw[i])||0)-lo)/d;
      // Gentle S-curve removes background haze while preserving soft hair/fur alpha.
      v=Math.max(0,Math.min(1,v));
      v=v*v*(3-2*v);
      mask[i]=Math.round(v*255);
    }
  }
  mask=sanitizeMask(mask,size);
  post(id,'progress',{value:94,title:'Running Cutout Guard…',text:'Checking edge confidence and transparent detail.'});
  return {mask,maskWidth:size,maskHeight:size,engine:kind,provider:provider==='webgpu'?'WebGPU':'Compatibility',inferenceMs:elapsed};
}

function sanitizeMask(mask,size){
  const patch=Math.max(8,Math.round(size*.08));
  const corners=[[0,0],[size-patch,0],[0,size-patch],[size-patch,size-patch]];
  let cornerSum=0,cornerN=0;
  for(const [sx,sy] of corners){for(let y=sy;y<sy+patch;y+=2)for(let x=sx;x<sx+patch;x+=2){cornerSum+=mask[y*size+x];cornerN++;}}
  const cornerMean=cornerN?cornerSum/cornerN:0;
  let low=0,high=0;for(let i=0;i<mask.length;i+=17){if(mask[i]<40)low++;if(mask[i]>215)high++;}
  if(cornerMean>205 && low<high*.35){for(let i=0;i<mask.length;i++)mask[i]=255-mask[i];}
  let min=255,max=0;for(let i=0;i<mask.length;i+=13){const v=mask[i];if(v<min)min=v;if(v>max)max=v;}
  if(max-min<18)throw new Error('AI mask was nearly constant; retry Auto once.');
  return mask;
}

function pickMaskOutput(outputs,names,size){
  const wanted=size*size;
  // Prefer known fused output names, then choose the first tensor with enough pixels.
  for(const name of ['output_image','d0',names?.[0]]){
    if(name&&outputs[name]?.data?.length>=wanted)return outputs[name].data;
  }
  for(const name of Object.keys(outputs||{})){
    const data=outputs[name]?.data;
    if(data?.length>=wanted)return data;
  }
  return null;
}

function bitmapToTensor(bitmap,size,kind){
  const canvas=new OffscreenCanvas(size,size);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(bitmap,0,0,size,size);
  const data=ctx.getImageData(0,0,size,size).data;
  const n=size*size;
  const out=new Float32Array(n*3);
  let max=0;
  if(kind==='fast'){
    for(let i=0;i<n;i++){
      const j=i*4;
      if(data[j]>max)max=data[j];if(data[j+1]>max)max=data[j+1];if(data[j+2]>max)max=data[j+2];
    }
  }
  const extraScale=kind==='fast'&&max>0?255/max:1;
  const mean=[0.485,0.456,0.406],std=[0.229,0.224,0.225];
  for(let i=0;i<n;i++){
    const j=i*4;
    out[i]=(((data[j]/255)*extraScale)-mean[0])/std[0];
    out[n+i]=(((data[j+1]/255)*extraScale)-mean[1])/std[1];
    out[n*2+i]=(((data[j+2]/255)*extraScale)-mean[2])/std[2];
  }
  return {tensor:out};
}
