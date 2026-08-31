// RIVANI AI · Music Control Beta
const ORT_VERSION="1.29.0";
const ORT_WEBGPU_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.webgpu.min.mjs`;
const ORT_WASM_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.min.mjs`;
const ORT_WASM_BASE=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MODEL_PROXY="https://rivani-models.rivani.workers.dev/music-vocals.onnx";
const MODEL_DIRECT="https://github.com/k2-fsa/sherpa-onnx/releases/download/source-separation-models/UVR_MDXNET_9482.onnx";
const CACHE_NAME="rivani-specialist-models-v22";
const SR=44100,NFFT=4096,HOP=1024,DIM_F=2048,DIM_T=256,CHUNK=HOP*(DIM_T-1),OVERLAP=Math.round(CHUNK*.10),STRIDE=CHUNK-OVERLAP,PAD=NFFT>>1;
const WINDOW=new Float64Array(NFFT);for(let n=0;n<NFFT;n++)WINDOW[n]=.5-.5*Math.cos(2*Math.PI*n/NFFT);
let ort=null,session=null,sessionPromise=null;
let deviceProfile={lowPower:false,preferWebGPU:false};

self.onmessage=async e=>{
  const d=e.data||{};
  try{
    if(d.deviceProfile){deviceProfile={...deviceProfile,...d.deviceProfile};}
    if(d.type==="warmup"){
      await ensureSession();
      self.postMessage({type:"ready"});
      return;
    }
    if(d.type!=="process")return;

    const l=sanitize(new Float32Array(d.left));
    const r=sanitize(new Float32Array(d.right));
    const amount=clamp(Number(d.amount||1),.60,1);
    if(l.length!==r.length)throw new Error("Music Control received mismatched stereo channels.");

    await ensureSession();
    const result=await separateLong(l,r,amount);
    self.postMessage({
      type:"done",
      safetyFallback:result.safetyFallback,
      retentionDb:result.retentionDb,
      buffer:result.audio.buffer
    },[result.audio.buffer]);
  }catch(err){
    self.postMessage({type:"error",message:String(err?.message||err||"Music Control Beta failed")});
  }
};

async function ensureSession(){
  if(session)return session;
  if(sessionPromise)return sessionPromise;

  sessionPromise=(async()=>{
    self.postMessage({
      type:"modelProgress",
      progress:1,
      text:"Preparing Music Control AI…"
    });

    const bytes=await getModelBytes();

    // V23.1 recovery: use the standard WASM execution path. WebGPU session
    // compilation could hang indefinitely on some GPU/driver combinations.
    const wasmOrt=await import(ORT_WASM_URL);
    wasmOrt.env.wasm.wasmPaths=ORT_WASM_BASE;
    wasmOrt.env.wasm.numThreads=chooseWasmThreads();
    wasmOrt.env.wasm.simd=true;

    self.postMessage({
      type:"modelProgress",
      progress:97,
      text:`Starting Music Control AI · ${wasmOrt.env.wasm.numThreads>1?"multi-core":"compatibility"}…`
    });

    session=await wasmOrt.InferenceSession.create(bytes,{
      executionProviders:["wasm"],
      graphOptimizationLevel:"all",
      executionMode:"sequential"
    });

    ort=wasmOrt;

    self.postMessage({
      type:"modelProgress",
      progress:100,
      text:`Music Control AI ready · ${wasmOrt.env.wasm.numThreads>1?"multi-core":"WASM"}`
    });

    return session;
  })();

  try{
    return await sessionPromise;
  }catch(error){
    session=null;
    throw error;
  }finally{
    sessionPromise=null;
  }
}

function chooseWasmThreads(){
  if(!self.crossOriginIsolated)return 1;

  const cores=Math.max(1,Number(self.navigator?.hardwareConcurrency)||4);

  if(cores>=8)return 4;
  if(cores>=6)return 3;
  if(cores>=4)return 2;
  return 1;
}
async function getModelBytes(){const cache=await caches.open(CACHE_NAME),key=new Request(MODEL_PROXY),cached=await cache.match(key);if(cached){const ab=await cached.arrayBuffer();if(ab.byteLength>20000000)return ab;}let last;for(const url of [MODEL_PROXY,MODEL_DIRECT]){try{const res=await fetch(url,{mode:"cors",cache:"no-store"});if(!res.ok)throw new Error(`HTTP ${res.status}`);const total=Number(res.headers.get("content-length")||0),reader=res.body?.getReader();let ab;if(reader){let loaded=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;self.postMessage({type:"modelProgress",progress:total?Math.min(94,Math.round(loaded/total*94)):25,text:total?`Preparing Music Control AI ${Math.round(loaded/total*100)}%…`:"Preparing Music Control AI…"});}ab=concatChunks(chunks,loaded);}else ab=await res.arrayBuffer();if(ab.byteLength<20000000)throw new Error("Music model download was incomplete.");try{await cache.put(key,new Response(ab.slice(0),{headers:{"content-type":"application/octet-stream"}}));}catch{}return ab;}catch(err){last=err;}}throw new Error(`Music Control model could not load. Deploy the V22 rivani-models Worker update. ${last?.message||""}`);}
async function separateLong(left,right,amount){
  if(!left.length)return {audio:new Float32Array(),safetyFallback:false,retentionDb:0};

  const sum=new Float64Array(left.length),wgt=new Float64Array(left.length),rawMono=new Float32Array(left.length),pos=[];
  for(let i=0;i<rawMono.length;i++)rawMono[i]=(left[i]+right[i])*.5;
  for(let p=0;p<left.length;p+=STRIDE){pos.push(p);if(p+CHUNK>=left.length)break;}

  for(let ci=0;ci<pos.length;ci++){
    const p=pos[ci],valid=Math.min(CHUNK,left.length-p);
    const l=reflectPad(left.subarray(p,p+valid),CHUNK),r=reflectPad(right.subarray(p,p+valid),CHUNK);
    self.postMessage({type:"progress",progress:Math.round(ci/Math.max(1,pos.length)*100),text:`Separating voice from music ${ci+1} of ${pos.length}…`});
    const stem=await runChunk(l,r);

    for(let i=0;i<valid;i++){
      const oi=p+i;let w=1;
      if(ci>0&&i<OVERLAP){const t=i/(OVERLAP-1);w*=.5-.5*Math.cos(Math.PI*t);}
      if(ci<pos.length-1&&i>=STRIDE){const t=(i-STRIDE)/(OVERLAP-1);w*=.5+.5*Math.cos(Math.PI*t);}
      const mix=(l[i]+r[i])*.5,voc=(stem.left[i]+stem.right[i])*.5;
      sum[oi]+=(mix*(1-amount)+voc*amount)*w;wgt[oi]+=w;
    }
  }

  const candidate=new Float32Array(left.length);
  for(let i=0;i<candidate.length;i++)candidate[i]=clamp(wgt[i]>1e-9?sum[i]/wgt[i]:rawMono[i],-1,1);

  const rawRms=rmsSignal(rawMono),candidateRms=rmsSignal(candidate);
  const ratio=rawRms>1e-8?candidateRms/rawRms:1;
  const retentionDb=20*Math.log10(Math.max(1e-8,ratio));
  const catastrophic=!Number.isFinite(ratio)||ratio<.018;

  if(catastrophic){
    const guarded=speechPreservationFallback(rawMono,candidate);
    self.postMessage({type:"progress",progress:100,text:"Music model became over-aggressive — speech-preservation guard protected the voice."});
    return {audio:guarded,safetyFallback:true,retentionDb};
  }

  applyLocalSpeechRetentionGuard(rawMono,candidate);
  self.postMessage({type:"progress",progress:100,text:"Music separation ready with speech-preservation guard."});
  return {audio:candidate,safetyFallback:false,retentionDb};
}

function rmsSignal(x){
  let s=0,n=0;for(let i=0;i<x.length;i+=4){const v=x[i];s+=v*v;n++;}
  return Math.sqrt(s/Math.max(1,n));
}

function speechPreservationFallback(raw,candidate){
  const out=new Float32Array(raw.length);
  const speechAnchor=speechBandAnchor(raw);
  const rr=rmsSignal(raw);
  const cr=rmsSignal(candidate);
  const candidateUsable=cr>rr*.006;

  // Never put full-band raw audio back into a music-removal result.
  // The old fallback protected speech but also reintroduced the music.
  // Keep only a controlled voice-band anchor, then Clear Voice runs next.
  for(let i=0;i<out.length;i++){
    out[i]=clamp(
      (candidateUsable?candidate[i]*.48:0)+
      speechAnchor[i]*.20,
      -1,
      1
    );
  }

  return out;
}

function applyLocalSpeechRetentionGuard(raw,candidate){
  const speechAnchor=speechBandAnchor(raw);
  const block=Math.round(SR*.020);
  const fade=Math.max(
    8,
    Math.round(SR*.004)
  );

  for(let start=0;start<raw.length;start+=block){
    const end=Math.min(
      raw.length,
      start+block
    );

    let rr=0;
    let cc=0;

    for(let i=start;i<end;i++){
      rr+=speechAnchor[i]*speechAnchor[i];
      cc+=candidate[i]*candidate[i];
    }

    const n=Math.max(1,end-start);
    const r=Math.sqrt(rr/n);
    const c=Math.sqrt(cc/n);

    if(r<.0038)continue;

    const localRatio=c/(r+1e-10);

    if(localRatio<.055){
      const need=clamp(
        .09-localRatio,
        .02,
        .075
      );

      for(let i=start;i<end;i++){
        let edge=1;
        const rel=i-start;
        const tail=end-1-i;

        if(rel<fade)edge*=rel/fade;
        if(tail<fade)edge*=tail/fade;

        candidate[i]=clamp(
          candidate[i]+
          speechAnchor[i]*need*edge,
          -1,
          1
        );
      }
    }
  }
}

function speechBandAnchor(input){
  // Conservative ~110 Hz to 6.5 kHz speech path.
  // This is not a fake music remover; it is only a safety anchor used when
  // the actual vocal-separation model over-suppresses a spoken block.
  const hp=biquadProcess(
    input,
    "highpass",
    110,
    .707
  );

  return biquadProcess(
    hp,
    "lowpass",
    6500,
    .707
  );
}

function biquadProcess(input,type,frequency,q=.707){
  const out=new Float32Array(input.length);

  const w0=2*Math.PI*frequency/SR;
  const cos=Math.cos(w0);
  const sin=Math.sin(w0);
  const alpha=sin/(2*q);

  let b0,b1,b2;
  let a0=1+alpha;
  let a1=-2*cos;
  let a2=1-alpha;

  if(type==="highpass"){
    b0=(1+cos)/2;
    b1=-(1+cos);
    b2=(1+cos)/2;
  }else{
    b0=(1-cos)/2;
    b1=1-cos;
    b2=(1-cos)/2;
  }

  b0/=a0;
  b1/=a0;
  b2/=a0;
  a1/=a0;
  a2/=a0;

  let x1=0,x2=0,y1=0,y2=0;

  for(let i=0;i<input.length;i++){
    const x0=input[i]||0;

    const y0=
      b0*x0+
      b1*x1+
      b2*x2-
      a1*y1-
      a2*y2;

    out[i]=clamp(y0,-1,1);

    x2=x1;
    x1=x0;
    y2=y1;
    y1=y0;
  }

  return out;
}

async function runChunk(left,right){const input=buildModelInput(left,right),tensor=new ort.Tensor("float32",input,[1,4,DIM_F,DIM_T]),name=session.inputNames[0],outs=await session.run({[name]:tensor}),out=outs[session.outputNames[0]];if(!out?.data||out.data.length<4*DIM_F*DIM_T)throw new Error(`Unexpected Music Control output shape [${out?.dims?.join(", ")||"none"}].`);return synthesizeVocals(out.data,left.length);}
function buildModelInput(left,right){const L=centerReflectPad(left,PAD),R=centerReflectPad(right,PAD),out=new Float32Array(4*DIM_F*DIM_T),rl=new Float64Array(NFFT),il=new Float64Array(NFFT),rr=new Float64Array(NFFT),ir=new Float64Array(NFFT);for(let t=0;t<DIM_T;t++){const start=t*HOP;rl.fill(0);il.fill(0);rr.fill(0);ir.fill(0);for(let n=0;n<NFFT;n++){rl[n]=L[start+n]*WINDOW[n];rr[n]=R[start+n]*WINDOW[n];}fftInPlace(rl,il,false);fftInPlace(rr,ir,false);for(let b=0;b<DIM_F;b++){out[idx4(0,b,t)]=rl[b];out[idx4(1,b,t)]=il[b];out[idx4(2,b,t)]=rr[b];out[idx4(3,b,t)]=ir[b];}}return out;}
function synthesizeVocals(spec,valid){const total=CHUNK+2*PAD,sumL=new Float64Array(total),sumR=new Float64Array(total),norm=new Float64Array(total),rl=new Float64Array(NFFT),il=new Float64Array(NFFT),rr=new Float64Array(NFFT),ir=new Float64Array(NFFT);for(let t=0;t<DIM_T;t++){rl.fill(0);il.fill(0);rr.fill(0);ir.fill(0);for(let b=0;b<DIM_F;b++){rl[b]=spec[idx4(0,b,t)]||0;il[b]=spec[idx4(1,b,t)]||0;rr[b]=spec[idx4(2,b,t)]||0;ir[b]=spec[idx4(3,b,t)]||0;}for(let b=1;b<NFFT/2;b++){rl[NFFT-b]=rl[b];il[NFFT-b]=-il[b];rr[NFFT-b]=rr[b];ir[NFFT-b]=-ir[b];}fftInPlace(rl,il,true);fftInPlace(rr,ir,true);const start=t*HOP;for(let n=0;n<NFFT;n++){const i=start+n,w=WINDOW[n];sumL[i]+=rl[n]*w;sumR[i]+=rr[n]*w;norm[i]+=w*w;}}const left=new Float32Array(valid),right=new Float32Array(valid);for(let i=0;i<valid;i++){const j=i+PAD,d=norm[j]>1e-10?norm[j]:1;left[i]=clamp(sumL[j]/d,-1,1);right[i]=clamp(sumR[j]/d,-1,1);}return {left,right};}
function idx4(p,b,t){return ((p*DIM_F+b)*DIM_T+t);}
function centerReflectPad(input,pad){const out=new Float32Array(input.length+2*pad);out.set(input,pad);if(!input.length)return out;for(let i=0;i<pad;i++){const li=Math.min(input.length-1,Math.max(0,pad-i));const ri=Math.max(0,input.length-2-i);out[i]=input[li]??input[0];out[pad+input.length+i]=input[ri]??input[input.length-1];}return out;}
function reflectPad(input,target){if(input.length>=target)return new Float32Array(input.subarray(0,target));const out=new Float32Array(target);out.set(input);if(!input.length)return out;if(input.length===1){out.fill(input[0],1);return out;}const ctx=Math.min(input.length,Math.round(SR*.7));for(let i=input.length;i<target;i++){const p=(i-input.length)%Math.max(2,ctx*2-2),r=p<ctx?p:ctx*2-2-p,idx=Math.max(0,input.length-1-r);out[i]=input[idx];}return out;}
function fftInPlace(re,im,inverse){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let x=re[i];re[i]=re[j];re[j]=x;x=im[i];im[i]=im[j];im[j]=x;}}for(let len=2;len<=n;len<<=1){const ang=(inverse?2:-2)*Math.PI/len,cr=Math.cos(ang),ci=Math.sin(ang);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<(len>>1);j++){const u=i+j,v=u+(len>>1),vr=re[v]*wr-im[v]*wi,vi=re[v]*wi+im[v]*wr;re[v]=re[u]-vr;im[v]=im[u]-vi;re[u]+=vr;im[u]+=vi;const nw=wr*cr-wi*ci;wi=wr*ci+wi*cr;wr=nw;}}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
function concatChunks(chunks,total){const out=new Uint8Array(total);let o=0;for(const c of chunks){out.set(c,o);o+=c.byteLength;}return out.buffer;}
function sanitize(x){const out=new Float32Array(x.length);for(let i=0;i<x.length;i++)out[i]=Number.isFinite(x[i])?clamp(x[i],-1,1):0;return out;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
