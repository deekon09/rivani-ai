/* RIVANI Cutout Studio inference worker — V27.6 Mobile Precision
   Desktop: BiRefNet-lite 512 on WebGPU.
   Mobile-safe HQ: dynamic IS-Net q8 on WASM at 512/384.
   Final emergency fallback: U2NetP on WASM.
   One worker = one engine attempt = one ONNX Runtime instance. */
const MODEL_BASE='https://rivani-models.rivani.workers.dev';
const MODEL_URLS={
  precision:`${MODEL_BASE}/background-remover-birefnet-512.onnx`,
  mobile:`${MODEL_BASE}/background-remover-mobile.onnx`,
  fast:`${MODEL_BASE}/background-remover-fast.onnx`,
};

let busy=false;
let ortPromise=null;
let sessionPromise=null;

self.onmessage=async(event)=>{
  const msg=event.data||{};
  if(msg.type!=='remove')return;
  const {id,bitmap,engine='precision',inputSize=0}=msg;
  if(busy){
    try{bitmap?.close?.();}catch(_e){}
    postMessage({type:'error',id,message:'Local AI worker was already busy'});
    return;
  }
  busy=true;
  const kind=engine==='fast'?'fast':engine==='mobile'?'mobile':'precision';
  try{
    post(id,'progress',{
      value:3,
      title:'Preparing cutout engine…',
      text:kind==='precision'?'Starting desktop Precision GPU.':kind==='mobile'?'Starting mobile-safe Precision.':'Starting emergency safety engine.',
      stage:'prepare'
    });
    const result=await infer(bitmap,kind,id,inputSize);
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
    post(id,'progress',{value:to,title:'AI model ready…',text:'Model loaded. Starting subject analysis.',stage:'model'});
    return buf;
  }
  const reader=res.body.getReader();
  const chunks=[];let loaded=0;
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    chunks.push(value);loaded+=value.byteLength;
    const p=from+(to-from)*Math.min(1,loaded/total);
    post(id,'progress',{
      value:p,
      title:'Loading cutout model…',
      text:`${label} ${(loaded/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB · cached after first load`,
      stage:'model'
    });
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
    const label=kind==='precision'?'Desktop Precision AI':kind==='mobile'?'Mobile Precision AI':'Safety AI';
    const model=await fetchModel(
      MODEL_URLS[kind],id,8,
      kind==='precision'?42:kind==='mobile'?36:28,
      label
    );
    post(id,'progress',{
      value:kind==='precision'?45:kind==='mobile'?40:31,
      title:kind==='precision'?'Starting Precision AI…':kind==='mobile'?'Starting Mobile Precision…':'Starting safety AI…',
      text:kind==='precision'?'Initializing 512px high-quality WebGPU matting.':kind==='mobile'?'Initializing the quantized high-quality CPU path.':'Initializing portable compatibility matting.',
      stage:'session'
    });
    const options={graphOptimizationLevel:'all',executionProviders:[kind==='precision'?'webgpu':'wasm']};
    const session=await ort.InferenceSession.create(model,options);
    return {ort,session,provider:kind==='precision'?'webgpu':'wasm'};
  })();
  return sessionPromise;
}

async function infer(bitmap,kind,id,inputSize){
  const size=kind==='precision'?512:kind==='mobile'?normalizeMobileSize(inputSize):320;
  const pack=await getSession(kind,id);
  const {session,ort,provider}=pack;
  post(id,'progress',{
    value:kind==='precision'?52:kind==='mobile'?54:40,
    title:'Scanning subject…',
    text:kind==='mobile'?`Mobile Precision ${size}px · separating subject and fine boundaries.`:'Separating people, products, objects and difficult boundaries.',
    stage:'inference',
    engine:kind,
    inputSize:size
  });
  const tensorData=bitmapToTensor(bitmap,size,kind);
  const inputName=session.inputNames?.[0];
  if(!inputName)throw new Error('AI model input was not found');
  const feeds={[inputName]:new ort.Tensor('float32',tensorData,[1,3,size,size])};
  const started=performance.now();
  const outputs=await session.run(feeds);
  const elapsed=performance.now()-started;
  const raw=pickMaskOutput(outputs,session.outputNames,size);
  if(!raw)throw new Error('AI engine returned no usable alpha mask');

  post(id,'progress',{value:82,title:'Refining alpha edges…',text:'Cleaning the subject boundary without changing source pixels.',stage:'post'});
  let mask;
  if(kind==='precision'){
    mask=decodePrecision(raw,size);
  }else if(kind==='mobile'){
    mask=decodeMobile(raw,size);
  }else{
    mask=decodeFast(raw,size);
  }
  mask=sanitizeMask(mask,size);
  mask=polishMask(mask,size,kind);
  post(id,'progress',{value:94,title:'Running Cutout Guard…',text:'Checking edge confidence and transparent detail.',stage:'post'});
  return {
    mask,
    maskWidth:size,
    maskHeight:size,
    engine:kind,
    provider:kind==='precision'?'WebGPU':kind==='mobile'?'Mobile Precision':'Compatibility',
    inferenceMs:elapsed,
    inputSize:size
  };
}

function normalizeMobileSize(v){
  const n=Number(v)||512;
  if(n<=384)return 384;
  return 512;
}

function decodePrecision(raw,size){
  const mask=new Uint8ClampedArray(size*size);
  let lo=Infinity,hi=-Infinity;
  const n=Math.min(raw.length,mask.length);
  for(let i=0;i<n;i++){const v=Number(raw[i])||0;if(v<lo)lo=v;if(v>hi)hi=v;}
  const normalized=lo>=-0.01&&hi<=1.01;
  for(let i=0;i<mask.length;i++){
    let v=Number(raw[i])||0;
    if(!normalized){v=Math.max(-18,Math.min(18,v));v=1/(1+Math.exp(-v));}
    v=Math.max(0,Math.min(1,v));
    mask[i]=Math.round(v*255);
  }
  return mask;
}

function decodeMobile(raw,size){
  const mask=new Uint8ClampedArray(size*size);
  let lo=Infinity,hi=-Infinity;
  const n=Math.min(raw.length,mask.length);
  for(let i=0;i<n;i++){const v=Number(raw[i])||0;if(v<lo)lo=v;if(v>hi)hi=v;}
  const normalized=lo>=-0.02&&hi<=1.02;
  const d=Math.max(1e-7,hi-lo);
  for(let i=0;i<mask.length;i++){
    let v=Number(raw[i])||0;
    if(!normalized)v=(v-lo)/d;
    v=Math.max(0,Math.min(1,v));
    // Very light smoothstep keeps hair alpha while suppressing weak background haze.
    v=v*v*(3-2*v);
    mask[i]=Math.round(v*255);
  }
  return mask;
}

function decodeFast(raw,size){
  let lo=Infinity,hi=-Infinity;
  const n=Math.min(raw.length,size*size);
  for(let i=0;i<n;i++){const v=Number(raw[i])||0;if(v<lo)lo=v;if(v>hi)hi=v;}
  const d=Math.max(1e-7,hi-lo);
  const mask=new Uint8ClampedArray(size*size);
  for(let i=0;i<mask.length;i++){
    let v=((Number(raw[i])||0)-lo)/d;
    v=Math.max(0,Math.min(1,v));
    v=v*v*(3-2*v);
    mask[i]=Math.round(v*255);
  }
  return mask;
}


function polishMask(mask,size,kind){
  // V27.7 Edge Rescue: keep real hair/soft alpha while removing low-confidence
  // haze and isolated scraps that mobile saliency models can leave behind.
  const src=mask;
  const n=src.length;
  const sharpened=new Uint8ClampedArray(n);
  const strength=kind==='precision'?0.08:kind==='mobile'?0.20:0.24;

  // Conservative 3x3 alpha unsharp. This tightens shoulder/glasses boundaries
  // without turning the matte into a hard binary cutout.
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const i=y*size+x;
      let sum=0,c=0;
      for(let yy=Math.max(0,y-1);yy<=Math.min(size-1,y+1);yy++){
        const row=yy*size;
        for(let xx=Math.max(0,x-1);xx<=Math.min(size-1,x+1);xx++){
          sum+=src[row+xx];c++;
        }
      }
      const a=src[i];
      const blur=sum/c;
      let v=a+(a-blur)*strength;
      if(v<10)v=0;
      else if(v<34)v*=0.58; // suppress faint background fog
      else if(v>248)v=255;
      sharpened[i]=Math.max(0,Math.min(255,Math.round(v)));
    }
  }

  suppressWeakIslands(sharpened,size);
  fillTinyPinholes(sharpened,size);
  return sharpened;
}

function suppressWeakIslands(mask,size){
  // Remove only tiny/weak disconnected alpha scraps. Large secondary subjects
  // remain untouched, so multi-subject photos still work.
  const n=mask.length;
  const seen=new Uint8Array(n);
  const queue=new Int32Array(n);
  const members=[];
  let largest=0;
  const comps=[];
  const threshold=42;

  for(let start=0;start<n;start++){
    if(seen[start]||mask[start]<=threshold)continue;
    let head=0,tail=0,sum=0,max=0;
    queue[tail++]=start;seen[start]=1;
    members.length=0;
    while(head<tail){
      const idx=queue[head++];members.push(idx);
      const v=mask[idx];sum+=v;if(v>max)max=v;
      const x=idx%size,y=(idx/size)|0;
      const a=idx-1,b=idx+1,c=idx-size,d=idx+size;
      if(x>0&&!seen[a]&&mask[a]>threshold){seen[a]=1;queue[tail++]=a;}
      if(x<size-1&&!seen[b]&&mask[b]>threshold){seen[b]=1;queue[tail++]=b;}
      if(y>0&&!seen[c]&&mask[c]>threshold){seen[c]=1;queue[tail++]=c;}
      if(y<size-1&&!seen[d]&&mask[d]>threshold){seen[d]=1;queue[tail++]=d;}
    }
    const copy=Int32Array.from(members);
    const comp={pixels:copy,area:copy.length,avg:sum/Math.max(1,copy.length),max};
    comps.push(comp);if(comp.area>largest)largest=comp.area;
  }

  const absoluteTiny=Math.max(20,Math.round(n*0.00018));
  for(const comp of comps){
    const weakSmall=comp.area<Math.max(absoluteTiny,largest*0.012)&&comp.avg<142&&comp.max<232;
    const dust=comp.area<absoluteTiny&&comp.max<245;
    if(!weakSmall&&!dust)continue;
    for(const idx of comp.pixels)mask[idx]=0;
  }
}

function fillTinyPinholes(mask,size){
  const src=mask.slice();
  for(let y=1;y<size-1;y++){
    const row=y*size;
    for(let x=1;x<size-1;x++){
      const i=row+x;
      if(src[i]>48)continue;
      let strong=0,sum=0;
      for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){
        if(!xx&&!yy)continue;
        const v=src[i+yy*size+xx];
        if(v>190){strong++;sum+=v;}
      }
      if(strong>=7)mask[i]=Math.round(sum/strong);
    }
  }
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
  for(const name of ['output','output_image','d0',names?.[0]]){
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

  if(kind==='mobile'){
    // IS-Net preprocessing: rescale 1/255, mean [0.5,0.5,0.5], std [1,1,1].
    for(let i=0;i<n;i++){
      const j=i*4;
      out[i]=data[j]/255-.5;
      out[n+i]=data[j+1]/255-.5;
      out[n*2+i]=data[j+2]/255-.5;
    }
    return out;
  }

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
