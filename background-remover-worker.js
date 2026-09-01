/* RIVANI Cutout Studio inference worker — V27.0
   Images stay local. Only model weights are fetched from the RIVANI model-delivery Worker. */
const MODEL_BASE='https://rivani-models.rivani.workers.dev';
const MODEL_URLS={
  precision:`${MODEL_BASE}/background-remover-birefnet.onnx`,
  fast:`${MODEL_BASE}/background-remover-fast.onnx`,
};
const sessions=new Map();
let ortPromise=null;

self.onmessage=async(event)=>{
  const msg=event.data||{};
  if(msg.type!=='remove')return;
  const {id,bitmap,engine='auto'}=msg;
  try{
    post(id,'progress',{value:3,title:'Preparing cutout engine…',text:'RIVANI is preparing private browser inference.'});
    const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(self.navigator?.userAgent||'');
    const mem=Number(self.navigator?.deviceMemory||8);
    const autoPrecision=!!self.navigator?.gpu&&(!mobile||mem>=6);
    const choice=engine==='auto'?(autoPrecision?'precision':'fast'):engine;
    let result;
    try{
      result=await infer(bitmap,choice,id);
    }catch(error){
      if(choice==='precision'){
        post(id,'progress',{value:48,title:'Switching to compatibility engine…',text:'The precision GPU path was not stable on this device. Your image is still local.'});
        result=await infer(bitmap,'fast',id);
        result.fallbackFrom='precision';
      }else throw error;
    }
    try{bitmap.close?.();}catch(_e){}
    postMessage({type:'result',id,...result},[result.mask.buffer]);
  }catch(error){
    try{bitmap?.close?.();}catch(_e){}
    postMessage({type:'error',id,message:String(error?.message||error||'Background removal failed')});
  }
};

function post(id,type,payload={}){ postMessage({type,id,...payload}); }

async function getOrt(){
  if(ortPromise)return ortPromise;
  ortPromise=(async()=>{
    const mod=await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/ort.webgpu.min.mjs');
    const ort=mod.default||mod;
    ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
    ort.env.wasm.numThreads=1;
    ort.env.wasm.simd=true;
    return ort;
  })();
  return ortPromise;
}

async function fetchModel(url,id,from=8,to=38){
  const res=await fetch(url,{cache:'force-cache'});
  if(!res.ok)throw new Error(`Model download failed (${res.status})`);
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
    post(id,'progress',{value:p,title:'Loading cutout model…',text:`Model ${(loaded/1048576).toFixed(0)} / ${(total/1048576).toFixed(0)} MB · cached after first load`});
  }
  const out=new Uint8Array(loaded);let off=0;
  for(const c of chunks){out.set(c,off);off+=c.byteLength;}
  return out.buffer;
}

async function getSession(kind,id){
  if(sessions.has(kind))return sessions.get(kind);
  const ort=await getOrt();
  const model=await fetchModel(MODEL_URLS[kind],id,8,kind==='precision'?40:28);
  post(id,'progress',{value:kind==='precision'?43:32,title:'Starting AI engine…',text:kind==='precision'?'Initializing high-detail WebGPU matting.':'Initializing portable compatibility matting.'});
  const options={graphOptimizationLevel:'all'};
  if(kind==='precision'){
    if(!self.navigator?.gpu)throw new Error('WebGPU is unavailable');
    options.executionProviders=['webgpu'];
  }else{
    options.executionProviders=['wasm'];
  }
  const session=await ort.InferenceSession.create(model,options);
  sessions.set(kind,session);
  return session;
}

async function infer(bitmap,kind,id){
  const ort=await getOrt();
  const session=await getSession(kind,id);
  const size=kind==='precision'?1024:320;
  post(id,'progress',{value:kind==='precision'?50:40,title:'Scanning subject…',text:'Separating subject, hair and difficult boundaries.'});
  const {tensor,maxValue}=bitmapToTensor(bitmap,size,kind);
  const inputName=session.inputNames[0];
  const feeds={[inputName]:new ort.Tensor('float32',tensor,[1,3,size,size])};
  const started=performance.now();
  const outputs=await session.run(feeds);
  const elapsed=performance.now()-started;
  const outputName=session.outputNames[0];
  const raw=outputs[outputName]?.data;
  if(!raw)throw new Error('AI engine returned no alpha mask');
  post(id,'progress',{value:82,title:'Refining alpha edges…',text:'Cleaning the subject boundary without changing the source pixels.'});
  let mask;
  if(kind==='precision'){
    mask=new Uint8ClampedArray(size*size);
    for(let i=0;i<mask.length;i++){
      const x=Math.max(-18,Math.min(18,Number(raw[i])||0));
      mask[i]=Math.round((1/(1+Math.exp(-x)))*255);
    }
  }else{
    let lo=Infinity,hi=-Infinity;
    for(let i=0;i<raw.length;i++){const v=Number(raw[i])||0;if(v<lo)lo=v;if(v>hi)hi=v;}
    const d=Math.max(1e-7,hi-lo);
    mask=new Uint8ClampedArray(size*size);
    for(let i=0;i<mask.length;i++)mask[i]=Math.round(((Number(raw[i])||0)-lo)/d*255);
  }
  post(id,'progress',{value:94,title:'Running Cutout Guard…',text:'Checking edge confidence and transparent detail.'});
  return {mask,maskWidth:size,maskHeight:size,engine:kind,provider:kind==='precision'?'WebGPU':'Compatibility',inferenceMs:elapsed,maxValue};
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
  for(let i=0;i<n;i++){
    const j=i*4;
    if(data[j]>max)max=data[j];if(data[j+1]>max)max=data[j+1];if(data[j+2]>max)max=data[j+2];
  }
  const extraScale=kind==='fast'&&max>0?255/max:1;
  const mean=[0.485,0.456,0.406],std=[0.229,0.224,0.225];
  for(let i=0;i<n;i++){
    const j=i*4;
    out[i]=(((data[j]/255)*extraScale)-mean[0])/std[0];
    out[n+i]=(((data[j+1]/255)*extraScale)-mean[1])/std[1];
    out[n*2+i]=(((data[j+2]/255)*extraScale)-mean[2])/std[2];
  }
  return {tensor:out,maxValue:max};
}
