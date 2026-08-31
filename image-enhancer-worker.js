// RIVANI AI · Image Enhancer V25
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

  const model=await getModelBytes();

  if(self.navigator?.gpu){
    try{
      ort=await import(ORT_WEBGPU_URL);
      ort.env.wasm.wasmPaths=ORT_WASM_BASE;

      session=await ort.InferenceSession.create(
        model,
        {
          executionProviders:["webgpu"],
          graphOptimizationLevel:"all"
        }
      );

      provider="WebGPU";
      return;
    }catch(error){
      session=null;
      ort=null;
      self.postMessage({
        type:"status",
        progress:1,
        text:"Using compatibility engine for this device…",
        provider:"RIVANI AI Engine"
      });
    }
  }

  ort=await import(ORT_WASM_URL);
  ort.env.wasm.wasmPaths=ORT_WASM_BASE;
  ort.env.wasm.numThreads=1;
  ort.env.wasm.simd=true;

  session=await ort.InferenceSession.create(
    model,
    {
      executionProviders:["wasm"],
      graphOptimizationLevel:"all"
    }
  );

  provider="WASM";
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

  for(let gy=0;gy<height;gy+=CORE){
    const coreH=Math.min(CORE,height-gy);

    for(let gx=0;gx<width;gx+=CORE){
      const coreW=Math.min(CORE,width-gx);

      const input=makeTileTensor(src,width,height,gx,gy);
      const tensor=new ort.Tensor("float32",input,[1,3,TILE,TILE]);

      const inputName=session.inputNames[0];
      const outputs=await session.run({[inputName]:tensor});
      const outTensor=outputs[session.outputNames[0]];

      if(!outTensor?.data){
        throw new Error("AI model returned an empty result.");
      }

      if(outputFactor===null){
        outputFactor=detectOutputFactor(outTensor.data);
      }

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

      completed++;

      self.postMessage({
        type:"status",
        progress:3+Math.round((completed/total)*94),
        text:`Enhancing detail ${completed} of ${total}…`,
        provider
      });

      if(provider==="WASM"&&completed<total){
        await delay(2);
      }
    }
  }

  return {
    width:outW,
    height:outH,
    rgba:output
  };
}

function makeTileTensor(src,width,height,gx,gy){
  const plane=TILE*TILE;
  const out=new Float32Array(plane*3);

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

  return out;
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
  const nativeCrop=CONTEXT*SCALE;
  const nativePerTarget=SCALE/targetScale;

  for(let oy=0;oy<coreH*targetScale;oy++){
    for(let ox=0;ox<coreW*targetScale;ox++){
      const nativeX=nativeCrop+ox*nativePerTarget;
      const nativeY=nativeCrop+oy*nativePerTarget;

      const rgb=sampleOutput(
        data,
        dims,
        nchw,
        nativeW,
        nativeH,
        nativeX,
        nativeY,
        nativePerTarget,
        factor
      );

      const dx=gx*targetScale+ox;
      const dy=gy*targetScale+oy;
      const di=(dy*outW+dx)*4;

      dest[di]=rgb[0];
      dest[di+1]=rgb[1];
      dest[di+2]=rgb[2];
      dest[di+3]=255;
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
