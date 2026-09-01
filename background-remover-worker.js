/* RIVANI Cutout Studio inference worker — V27.5 Mobile Session Fix
   One worker = one engine attempt = one ONNX Runtime instance.
   This isolates mobile WebGPU/JSEP state and prevents failed Precision sessions
   from contaminating the hidden compatibility retry. Image pixels stay local. */
const MODEL_BASE='https://rivani-models.rivani.workers.dev';
const MODEL_URLS={
  precision:`${MODEL_BASE}/background-remover-birefnet-512.onnx`,
  fast:`${MODEL_BASE}/background-remover-fast.onnx`,
};

let busy=false;
let ortPromise=null;
let sessionPromise=null;

self.onmessage=async(event)=>{
  const msg=event.data||{};
  if(msg.type!=='remove')return;
  const {id,bitmap,engine='precision'}=msg;
  if(busy){
    try{bitmap?.close?.();}catch(_e){}
    postMessage({type:'error',id,message:'Local AI worker was already busy'});
    return;
  }
  busy=true;
  const kind=engine==='fast'?'fast':'precision';
  try{
    post(id,'progress',{value:3,title:'Preparing cutout engine…',text:kind==='precision'?'Starting an isolated Precision session.':'Starting an isolated safety session.'});
    const result=await infer(bitmap,kind,id);
    try{bitmap.close?.();}catch(_e){}
    postMessage({type:'result',id,...result},[result.mask.buffer]);
  }catch(error){
    try{bitmap?.close?.();}catch(_e){}
    postMessage({type:'error',id,message:String(error?.message||error||'Background removal failed')});
  }finally{
    busy=false;
  }
};

function post(id,type,payload={}){postMessage({type,id,...payload});}

async function getOrt(kind){
  if(ortPromise)return ortPromise;
  ortPromise=(async()=>{
    const base='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
    // Never load the WebGPU and plain WASM bundles into the same worker. The JSEP
    // runtime keeps global session state; isolating bundles avoids mobile Session mismatch.
    const file=kind==='precision'?'ort.webgpu.min.mjs':'ort.min.mjs';
    const mod=await import(base+file);
    const ort=mod.default||mod;
    ort.env.wasm.wasmPaths=base;
    ort.env.wasm.numThreads=1;
    ort.env.wasm.simd=true;
    if('proxy' in ort.env.wasm)ort.env.wasm.proxy=false;
    if(kind==='precision'&&ort.env.webgpu){
      try{ort.env.webgpu.powerPreference='high-performance';}catch(_e){}
    }
    return ort;
  })();
  return ortPromise;
}

async function fetchModel(url,id,from,to,label){
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
    post(id,'progress',{value:p,title:'Loading cutout model…',text:`${label} ${(loaded/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB · cached after first load`});
  }
  const out=new Uint8Array(loaded);let off=0;
  for(const chunk of chunks){out.set(chunk,off);off+=chunk.byteLength;}
  return out.buffer;
}

async function getSession(kind,id){
  if(sessionPromise)return sessionPromise;
  sessionPromise=(async()=>{
    const ort=await getOrt(kind);
    if(kind==='precision'&&!self.navigator?.gpu)throw new Error('WebGPU is unavailable on this browser');
    const model=await fetchModel(
      MODEL_URLS[kind],id,8,kind==='precision'?42:28,
      kind==='precision'?'Precision AI':'Safety AI'
    );
    post(id,'progress',{
      value:kind==='precision'?45:31,
      title:kind==='precision'?'Starting Precision AI…':'Starting safety AI…',
      text:kind==='precision'?'Initializing the 512px high-quality matting engine.':'Initializing the portable compatibility engine.'
    });
    const options={graphOptimizationLevel:'all',executionProviders:[kind==='precision'?'webgpu':'wasm']};
    const session=await ort.InferenceSession.create(model,options);
    return {ort,session,provider:kind==='precision'?'webgpu':'wasm'};
  })();
  return sessionPromise;
}

async function infer(bitmap,kind,id){
  const size=kind==='precision'?512:320;
  const pack=await getSession(kind,id);
  const {session,ort,provider}=pack;
  post(id,'progress',{value:kind==='precision'?52:40,title:'Scanning subject…',text:'Separating people, products, objects and difficult boundaries.'});
  const tensorData=bitmapToTensor(bitmap,size,kind);
  const inputName=session.inputNames?.[0];
  if(!inputName)throw new Error('AI model input was not found');
  const feeds={[inputName]:new ort.Tensor('float32',tensorData,[1,3,size,size])};
  const started=performance.now();
  const outputs=await session.run(feeds);
  const elapsed=performance.now()-started;
  const raw=pickMaskOutput(outputs,session.outputNames,size);
  if(!raw)throw new Error('AI engine returned no usable alpha mask');

  post(id,'progress',{value:82,title:'Refining alpha edges…',text:'Cleaning the subject boundary without changing source pixels.'});
  let mask;
  if(kind==='precision'){
    mask=new Uint8ClampedArray(size*size);
    let lo=Infinity,hi=-Infinity;
    const n=Math.min(raw.length,mask.length);
    for(let i=0;i<n;i++){const v=Number(raw[i])||0;if(v<lo)lo=v;if(v>hi)hi=v;}
    // BiRefNet exports can expose either logits or already-normalized alpha.
    // Detect the range instead of blindly sigmoid-transforming a normalized mask.
    const normalized=lo>=-0.01&&hi<=1.01;
    for(let i=0;i<mask.length;i++){
      let v=Number(raw[i])||0;
      if(!normalized){v=Math.max(-18,Math.min(18,v));v=1/(1+Math.exp(-v));}
      v=Math.max(0,Math.min(1,v));
      mask[i]=Math.round(v*255);
    }
  }else{
    let lo=Infinity,hi=-Infinity;
    const n=Math.min(raw.length,size*size);
    for(let i=0;i<n;i++){const v=Number(raw[i])||0;if(v<lo)lo=v;if(v>hi)hi=v;}
    const d=Math.max(1e-7,hi-lo);
    mask=new Uint8ClampedArray(size*size);
    for(let i=0;i<mask.length;i++){
      let v=((Number(raw[i])||0)-lo)/d;
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
  const band=Math.max(4,Math.round(size*.035));
  let borderSum=0,borderN=0,centerSum=0,centerN=0;
  for(let y=0;y<size;y+=2){
    for(let x=0;x<size;x+=2){
      const v=mask[y*size+x];
      if(x<band||y<band||x>=size-band||y>=size-band){borderSum+=v;borderN++;}
      if(x>=size*.3&&x<size*.7&&y>=size*.25&&y<size*.75){centerSum+=v;centerN++;}
    }
  }
  const borderMean=borderN?borderSum/borderN:0;
  const centerMean=centerN?centerSum/centerN:0;
  if(borderMean>190&&centerMean+45<borderMean){for(let i=0;i<mask.length;i++)mask[i]=255-mask[i];}

  let min=255,max=0,fg=0,bg=0;
  for(let i=0;i<mask.length;i+=13){
    const v=mask[i];if(v<min)min=v;if(v>max)max=v;if(v>32)fg++;if(v<223)bg++;
  }
  if(max-min<18)throw new Error('AI mask was nearly constant');
  if(fg===0)throw new Error('AI could not find a foreground subject');
  if(bg===0)throw new Error('AI returned an all-foreground mask');
  return mask;
}

function pickMaskOutput(outputs,names,size){
  const wanted=size*size;
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
  return out;
}
