// RIVANI AI · Image Enhancer V25.3
// Real-ESRGAN x4plus ONNX · browser-side inference.
// Fixed model contract: 1x3x128x128 -> 1x3x512x512.

const ORT_VERSION="1.29.0";
const ORT_WEBGPU_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.webgpu.min.mjs`;
const ORT_WASM_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.min.mjs`;
const ORT_WASM_BASE=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

const MODEL_PROXY="https://rivani-models.rivani.workers.dev/image-enhancer-x4.onnx";
const MODEL_DIRECT="https://huggingface.co/qualcomm/Real-ESRGAN-x4plus/resolve/93195f43da324a8a3e49b563c69e6eadb6f3993d/Real-ESRGAN-x4plus.onnx?download=true";
const MODEL_URLS=[MODEL_PROXY,MODEL_DIRECT];

const CACHE_DB="rivani-image-models-v1";
const CACHE_STORE="models";
const CACHE_KEY="realesrgan-x4plus-qualcomm-128-v1";

const TILE=128;
const SCALE=4;
const CONTEXT=8;
const CORE=TILE-CONTEXT*2;

let ort=null;
let session=null;
let provider="RIVANI AI Engine";
let sessionMode="none";
let modelBytes=null;
let inputName="";
let outputName="";

self.onmessage=async event=>{
  const msg=event.data||{};
  if(msg.type!=="enhance")return;

  try{
    const width=Number(msg.width);
    const height=Number(msg.height);
    const targetScale=Number(msg.targetScale)===4?4:2;
    const pixels=new Uint8ClampedArray(msg.rgba);

    if(!width||!height||pixels.length!==width*height*4){
      throw new Error("Invalid image buffer.");
    }

    await ensureSession();

    self.postMessage({
      type:"status",
      progress:2,
      text:"AI model ready. Preparing image tiles…",
      provider
    });

    const result=await enhanceImage(
      pixels,
      width,
      height,
      targetScale
    );

    self.postMessage({
      type:"done",
      width:result.width,
      height:result.height,
      rgba:result.rgba.buffer,
      provider
    },[result.rgba.buffer]);
  }catch(error){
    self.postMessage({
      type:"error",
      message:error?.message||"Image enhancement failed."
    });
  }
};

async function ensureSession(){
  if(session)return;

  modelBytes=modelBytes||await getModelBytes();

  if(self.navigator?.gpu){
    // The model input is fully static (1×3×128×128), so graph capture can
    // reduce repeated per-tile CPU command overhead on compatible GPUs.
    try{
      await createWebGpuSession(true);
      return;
    }catch(error){
      await releaseSession();
      try{
        await createWebGpuSession(false);
        return;
      }catch(secondError){
        await releaseSession();
        self.postMessage({
          type:"status",
          progress:1,
          text:"GPU path is unavailable on this device. Using compatibility engine…",
          provider:"RIVANI AI Engine"
        });
      }
    }
  }

  await createWasmSession();
}

async function createWebGpuSession(graphCapture){
  ort=await import(ORT_WEBGPU_URL);
  ort.env.wasm.wasmPaths=ORT_WASM_BASE;

  if(ort.env.webgpu){
    ort.env.webgpu.powerPreference="high-performance";
    ort.env.webgpu.forceFallbackAdapter=false;
  }

  session=await ort.InferenceSession.create(
    modelBytes,
    {
      executionProviders:["webgpu"],
      graphOptimizationLevel:"all",
      enableGraphCapture:Boolean(graphCapture)
    }
  );

  inputName=session.inputNames[0];
  outputName=session.outputNames[0];
  sessionMode=graphCapture?"webgpu-graph":"webgpu";
  provider=graphCapture?"WebGPU-Graph":"WebGPU";
}

async function createWasmSession(){
  ort=await import(ORT_WASM_URL);
  ort.env.wasm.wasmPaths=ORT_WASM_BASE;

  const cores=Math.max(1,Number(self.navigator?.hardwareConcurrency)||1);
  const canThread=self.crossOriginIsolated===true;
  const threads=canThread?Math.max(1,Math.min(4,cores-1)):1;

  // RIVANI never enables cross-origin isolation just for image speed. If the
  // hosting environment already provides it, ORT can safely use a few threads.
  ort.env.wasm.numThreads=threads;
  ort.env.wasm.simd=true;

  session=await ort.InferenceSession.create(
    modelBytes,
    {
      executionProviders:["wasm"],
      graphOptimizationLevel:"all"
    }
  );

  inputName=session.inputNames[0];
  outputName=session.outputNames[0];
  sessionMode="wasm";
  provider=threads>1?`WASM-${threads}`:"WASM";
}

async function releaseSession(){
  try{session?.release?.();}catch(_error){}
  session=null;
  inputName="";
  outputName="";
}

async function runTile(input){
  const execute=async()=>{
    const tensor=new ort.Tensor("float32",input,[1,3,TILE,TILE]);
    try{
      const outputs=await session.run({[inputName]:tensor});
      const outTensor=outputs[outputName];
      if(!outTensor?.data){
        throw new Error("AI model returned an empty result.");
      }
      return outTensor;
    }finally{
      try{tensor?.dispose?.();}catch(_error){}
    }
  };

  try{
    return await execute();
  }catch(error){
    if(sessionMode==="webgpu-graph"){
      // Some GPUs accept the session but reject graph capture on first run.
      await releaseSession();
      self.postMessage({
        type:"status",
        progress:2,
        text:"Optimizing GPU compatibility…",
        provider:"WebGPU"
      });
      try{
        await createWebGpuSession(false);
        return await execute();
      }catch(secondError){
        await releaseSession();
      }
    }else if(sessionMode==="webgpu"){
      await releaseSession();
    }else{
      throw error;
    }

    // A WebGPU session can occasionally fail during actual inference even if
    // creation succeeded. Retry the same tile with the full-quality WASM EP.
    self.postMessage({
      type:"status",
      progress:2,
      text:"GPU inference was not stable. Continuing with compatibility engine…",
      provider:"RIVANI AI Engine"
    });
    await createWasmSession();
    return await execute();
  }
}

async function enhanceImage(src,width,height,targetScale){
  const outW=width*targetScale;
  const outH=height*targetScale;
  const output=new Uint8ClampedArray(outW*outH*4);

  const cols=Math.ceil(width/CORE);
  const rows=Math.ceil(height/CORE);
  const total=cols*rows;
  let completed=0;
  let outputFactor=null;
  let lastReported=-1;
  let lastReportAt=0;
  const inputBuffer=new Float32Array(TILE*TILE*3);

  for(let gy=0;gy<height;gy+=CORE){
    const coreH=Math.min(CORE,height-gy);

    for(let gx=0;gx<width;gx+=CORE){
      const coreW=Math.min(CORE,width-gx);

      fillTileTensor(inputBuffer,src,width,height,gx,gy);
      const outTensor=await runTile(inputBuffer);

      if(outputFactor===null){
        outputFactor=detectOutputFactor(outTensor.data);
      }

      try{
        writeCore(
          outTensor,
          outputFactor,
          output,
          outW,
          gx,
          gy,
          coreW,
          coreH,
          targetScale
        );
      }finally{
        try{outTensor?.dispose?.();}catch(_error){}
      }

      completed++;

      const progress=3+Math.round((completed/total)*94);
      const now=performance.now();
      if(progress!==lastReported&&(now-lastReportAt>=90||completed===total)){
        lastReported=progress;
        lastReportAt=now;
        self.postMessage({
          type:"status",
          progress,
          text:`Enhancing detail ${completed} of ${total}…`,
          provider
        });
      }

    }
  }

  return {
    width:outW,
    height:outH,
    rgba:output
  };
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

async function getModelBytes(){
  const cached=await idbGet(CACHE_KEY).catch(()=>null);

  if(cached instanceof ArrayBuffer&&cached.byteLength>10_000_000){
    self.postMessage({
      type:"status",
      progress:1,
      text:"AI model loaded from device cache…",
      provider:"RIVANI AI Engine"
    });
    return cached;
  }

  let lastError=null;

  for(const url of MODEL_URLS){
    try{
      const response=await fetch(url,{cache:"force-cache"});
      if(!response.ok)throw new Error(`Model fetch ${response.status}`);

      const total=Number(response.headers.get("content-length"))||0;
      const reader=response.body?.getReader();

      if(!reader){
        const buffer=await response.arrayBuffer();
        await idbPut(CACHE_KEY,buffer).catch(()=>{});
        return buffer;
      }

      const parts=[];
      let received=0;

      while(true){
        const {done,value}=await reader.read();
        if(done)break;

        parts.push(value);
        received+=value.byteLength;

        const pct=total
          ?Math.min(90,Math.round(received/total*90))
          :Math.min(90,5+Math.round(received/750000));

        self.postMessage({
          type:"model-progress",
          progress:pct,
          text:"Downloading RIVANI image model…",
          provider:"RIVANI AI Engine"
        });
      }

      const buffer=new Uint8Array(received);
      let offset=0;

      for(const part of parts){
        buffer.set(part,offset);
        offset+=part.byteLength;
      }

      await idbPut(CACHE_KEY,buffer.buffer).catch(()=>{});
      return buffer.buffer;
    }catch(error){
      lastError=error;
    }
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
