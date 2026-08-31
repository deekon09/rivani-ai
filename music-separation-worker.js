// RIVANI AI · Music Control
const ORT_VERSION="1.29.0";
const ORT_WEBGPU_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.webgpu.min.mjs`;
const ORT_WASM_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.min.mjs`;
const ORT_WASM_BASE=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MODEL_PROXY="https://rivani-models.rivani.workers.dev/music-vocals-ft.onnx";
const MODEL_DIRECT="https://github.com/k2-fsa/sherpa-onnx/releases/download/source-separation-models/UVR-MDX-NET-Voc_FT.onnx";
const CACHE_NAME="rivani-specialist-models-v22";
// RIVANI V23.7: vocal fine-tuned UVR model geometry.
// UVR-MDX-NET-Voc_FT:
// sample_rate=44100, n_fft=6144, hop=1024,
// dim_t=256, dim_f=3072, dim_c=4, target=vocals.
const SR=44100;
const NFFT=6144;
const HOP=1024;
const DIM_F=3072;
const DIM_T=256;
const DIM_C=4;
const TRIM=NFFT>>1;
const FRAME_SPAN=HOP*(DIM_T-1);   // 261120
const GEN_SIZE=FRAME_SPAN-2*TRIM; // 254976
const LONG_CHUNK=15*SR;
const MARGIN=SR;

const WINDOW=new Float64Array(NFFT);
for(let n=0;n<NFFT;n++){
  // kaldi-native-fbank "hann" assumes periodic=true.
  WINDOW[n]=.5-.5*Math.cos(2*Math.PI*n/NFFT);
}
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
    self.postMessage({type:"error",message:String(err?.message||err||"Music Control failed")});
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
  // Final CPU Balanced profile: keep inference single-threaded.
  // Thread count changes speed/peak CPU only, not model quality.
  return 1;
}

function cpuYield(ms=4){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function getModelBytes(){const cache=await caches.open(CACHE_NAME),key=new Request(MODEL_PROXY),cached=await cache.match(key);if(cached){const ab=await cached.arrayBuffer();if(ab.byteLength>20000000)return ab;}let last;for(const url of [MODEL_PROXY,MODEL_DIRECT]){try{const res=await fetch(url,{mode:"cors",cache:"no-store"});if(!res.ok)throw new Error(`HTTP ${res.status}`);const total=Number(res.headers.get("content-length")||0),reader=res.body?.getReader();let ab;if(reader){let loaded=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;self.postMessage({type:"modelProgress",progress:total?Math.min(94,Math.round(loaded/total*94)):25,text:total?`Preparing Music Control AI ${Math.round(loaded/total*100)}%…`:"Preparing Music Control AI…"});}ab=concatChunks(chunks,loaded);}else ab=await res.arrayBuffer();if(ab.byteLength<20000000)throw new Error("Music model download was incomplete.");try{await cache.put(key,new Response(ab.slice(0),{headers:{"content-type":"application/octet-stream"}}));}catch{}return ab;}catch(err){last=err;}}throw new Error(`Music Control model could not load. Deploy the V22 rivani-models Worker update. ${last?.message||""}`);}
async function separateLong(left,right,amount){
  if(!left.length){
    return {
      audio:new Float32Array(),
      safetyFallback:false,
      retentionDb:0
    };
  }

  const rawMono=new Float32Array(left.length);
  for(let i=0;i<rawMono.length;i++){
    rawMono[i]=(left[i]+right[i])*.5;
  }

  // sherpa-onnx splits long audio into 15 s chunks with 1 s context margins.
  const chunkRanges=splitLongRanges(left.length);
  const vocalL=[];
  const vocalR=[];
  let written=0;

  for(let ci=0;ci<chunkRanges.length;ci++){
    const range=chunkRanges[ci];

    self.postMessage({
      type:"progress",
      progress:Math.round(
        ci/Math.max(1,chunkRanges.length)*92
      ),
      text:`Separating voice from music ${ci+1} of ${chunkRanges.length}…`
    });

    const chunkLeft=new Float32Array(
      left.subarray(range.start,range.end)
    );
    const chunkRight=new Float32Array(
      right.subarray(range.start,range.end)
    );

    const processed=await processReferenceChunk(
      chunkLeft,
      chunkRight,
      range.isFirst,
      range.isLast
    );

    vocalL.push(processed.left);
    vocalR.push(processed.right);
    written+=processed.left.length;

    if(ci<chunkRanges.length-1){
      await cpuYield(30);
    }
  }

  const vocalsLeft=concatFloat32(vocalL,written);
  const vocalsRight=concatFloat32(vocalR,written);

  // Guard against any small off-by-one difference from chunk trimming.
  const finalLength=Math.min(
    rawMono.length,
    vocalsLeft.length,
    vocalsRight.length
  );

  const candidate=new Float32Array(rawMono.length);

  for(let i=0;i<rawMono.length;i++){
    if(i<finalLength){
      const vocal=
        (vocalsLeft[i]+vocalsRight[i])*.5;

      candidate[i]=clamp(
        rawMono[i]*(1-amount)+
        vocal*amount,
        -1,
        1
      );
    }else{
      candidate[i]=rawMono[i];
    }
  }

  const rawRms=rmsSignal(rawMono);
  const candidateRms=rmsSignal(candidate);

  const ratio=
    rawRms>1e-8
      ?candidateRms/rawRms
      :1;

  const retentionDb=
    20*Math.log10(
      Math.max(1e-8,ratio)
    );

  const catastrophic=
    !Number.isFinite(ratio)||
    ratio<.018;

  if(catastrophic){
    self.postMessage({
      type:"progress",
      progress:100,
      text:"Music separation became over-aggressive — Safe Pass protected the voice."
    });

    return {
      audio:new Float32Array(rawMono),
      safetyFallback:true,
      retentionDb
    };
  }

  // Product quality gate.
  // Validate the model stem; do not repair a bad stem by mixing raw music back.
  const anchor=speechBandAnchor(rawMono);
  const candidateSpeech=speechBandAnchor(candidate);

  const anchorRms=rmsSignal(anchor);
  const speechRms=rmsSignal(candidateSpeech);

  const speechRetention=
    anchorRms>1e-8
      ?speechRms/anchorRms
      :1;

  const corr=normalizedCorrelation(
    anchor,
    candidateSpeech
  );

  const unreliable=
    !Number.isFinite(speechRetention)||
    speechRetention<.10||
    corr<.06;

  if(unreliable){
    self.postMessage({
      type:"progress",
      progress:100,
      text:"Music stem quality was not clean enough — Safe Pass protected the voice."
    });

    return {
      audio:new Float32Array(rawMono),
      safetyFallback:true,
      retentionDb
    };
  }

  // Valid vocal stem can receive restrained level recovery only.
  // No dry/background music is mixed back.
  const targetRetention=.46;

  if(speechRetention<targetRetention){
    const gain=clamp(
      targetRetention/Math.max(.01,speechRetention),
      1,
      2.15
    );

    for(let i=0;i<candidate.length;i++){
      candidate[i]=clamp(
        candidate[i]*gain,
        -1,
        1
      );
    }
  }

  self.postMessage({
    type:"progress",
    progress:100,
    text:"Music separation ready with reference reconstruction."
  });

  return {
    audio:candidate,
    safetyFallback:false,
    retentionDb
  };
}

function splitLongRanges(length){
  if(!length)return [];

  const ranges=[];
  const chunkSize=Math.min(LONG_CHUNK,length);

  for(let i=0;i<length;i+=chunkSize){
    const start=Math.max(
      0,
      i-MARGIN
    );

    const end=Math.min(
      i+chunkSize+MARGIN,
      length
    );

    if(start>=end)break;

    ranges.push({
      start,
      end,
      isFirst:i===0,
      isLast:end===length
    });

    if(end===length)break;
  }

  return ranges;
}

async function processReferenceChunk(
  left,
  right,
  isFirstChunk,
  isLastChunk
){
  const preparedL=await computeReferenceStft(left);
  await cpuYield(6);
  const preparedR=await computeReferenceStft(right);
  await cpuYield(6);

  if(preparedL.segments.length!==preparedR.segments.length){
    throw new Error(
      "Music Control reference STFT channel mismatch."
    );
  }

  const count=preparedL.segments.length;

  if(!count){
    return {
      left:new Float32Array(),
      right:new Float32Array()
    };
  }

  // Official sherpa runtime batches all internal 256-frame segments from the
  // current long chunk in one model call.
  const input=new Float32Array(
    count*DIM_C*DIM_F*DIM_T
  );

  let cursor=0;

  for(let i=0;i<count;i++){
    cursor=writeSegmentToTensor(
      input,
      cursor,
      preparedL.segments[i],
      preparedR.segments[i]
    );
  }

  const tensor=new ort.Tensor(
    "float32",
    input,
    [count,DIM_C,DIM_F,DIM_T]
  );

  const inputName=session.inputNames[0];

  const outputs=await session.run({
    [inputName]:tensor
  });

  const output=outputs[session.outputNames[0]];

  const expected=
    count*DIM_C*DIM_F*DIM_T;

  if(!output?.data||output.data.length<expected){
    throw new Error(
      `Unexpected Music Control output shape [${output?.dims?.join(", ")||"none"}].`
    );
  }

  let outputCursor=0;

  for(let i=0;i<count;i++){
    outputCursor=applyPredictedSpectrum(
      output.data,
      outputCursor,
      preparedL.segments[i],
      preparedR.segments[i]
    );
  }

  await cpuYield(12);

  const leftSamples=await computeReferenceInverse(
    preparedL,
    isFirstChunk,
    isLastChunk
  );

  await cpuYield(6);

  const rightSamples=await computeReferenceInverse(
    preparedR,
    isFirstChunk,
    isLastChunk
  );

  const n=Math.min(
    leftSamples.length,
    rightSamples.length
  );

  return {
    left:leftSamples.subarray(0,n),
    right:rightSamples.subarray(0,n)
  };
}

async function computeReferenceStft(chunk){
  const numSamples=chunk.length;

  // Exact sherpa-onnx behavior: even an exact multiple receives one full
  // GEN_SIZE of padding.
  const remainder=numSamples%GEN_SIZE;
  const pad=GEN_SIZE-remainder;

  const padded=new Float32Array(
    TRIM+
    numSamples+
    pad+
    TRIM
  );

  padded.set(chunk,TRIM);

  const segments=[];

  for(let i=0;i<numSamples+pad;i+=GEN_SIZE){
    const segmentWave=
      padded.subarray(
        i,
        i+FRAME_SPAN
      );

    segments.push(
      await stftCenterReflect(segmentWave)
    );

    await cpuYield(6);
  }

  return {
    segments,
    pad
  };
}

async function stftCenterReflect(wave){
  // kaldi-native-fbank Stft(center=true, pad_mode="reflect")
  // adds NFFT/2 reflection on both sides before framing.
  const centered=reflectCenterPad(
    wave,
    TRIM
  );

  const frames=1+
    Math.floor(
      (centered.length-NFFT)/HOP
    );

  if(frames!==DIM_T){
    throw new Error(
      `Music Control reference STFT expected ${DIM_T} frames, got ${frames}.`
    );
  }

  const real=new Float32Array(
    DIM_T*(NFFT/2+1)
  );

  const imag=new Float32Array(
    DIM_T*(NFFT/2+1)
  );

  const re=new Float64Array(NFFT);
  const im=new Float64Array(NFFT);

  for(let t=0;t<DIM_T;t++){
    const start=t*HOP;

    re.fill(0);
    im.fill(0);

    for(let n=0;n<NFFT;n++){
      re[n]=
        centered[start+n]*
        WINDOW[n];
    }

    fftInPlace(re,im,false);

    const base=t*(NFFT/2+1);

    for(let b=0;b<=NFFT/2;b++){
      real[base+b]=re[b];
      imag[base+b]=
        (b===0||b===NFFT/2)
          ?0
          :im[b];
    }

    if((t+1)%16===0){
      await cpuYield();
    }
  }

  return {
    real,
    imag,
    numFrames:DIM_T
  };
}

function reflectCenterPad(input,pad){
  const out=new Float32Array(
    input.length+
    2*pad
  );

  out.set(input,pad);

  if(!input.length)return out;

  // Match kaldi-native-fbank:
  // left receives reverse(data[1 : 1+pad])
  // right receives reverse(data[n-pad-1 : n-1])
  for(let i=0;i<pad;i++){
    const li=Math.min(
      input.length-1,
      1+i
    );

    out[pad-1-i]=
      input[li]??0;

    const ri=Math.max(
      0,
      input.length-pad-1+i
    );

    out[pad+input.length+i]=
      input[ri]??0;
  }

  return out;
}

function writeSegmentToTensor(
  target,
  cursor,
  left,
  right
){
  const bins=NFFT/2+1;

  const writePlane=(array)=>{
    for(let f=0;f<DIM_F;f++){
      for(let t=0;t<DIM_T;t++){
        target[cursor++]=
          array[t*bins+f]||0;
      }
    }
  };

  writePlane(left.real);
  writePlane(left.imag);
  writePlane(right.real);
  writePlane(right.imag);

  return cursor;
}

function applyPredictedSpectrum(
  source,
  cursor,
  left,
  right
){
  const bins=NFFT/2+1;

  const readPlane=(array)=>{
    for(let f=0;f<DIM_F;f++){
      for(let t=0;t<DIM_T;t++){
        array[t*bins+f]=
          source[cursor++]||0;
      }
    }
  };

  readPlane(left.real);
  readPlane(left.imag);
  readPlane(right.real);
  readPlane(right.imag);

  // Official runtime zeros bins outside dim_f before iSTFT.
  for(let t=0;t<DIM_T;t++){
    const base=t*bins;

    for(let f=DIM_F;f<bins;f++){
      left.real[base+f]=0;
      left.imag[base+f]=0;
      right.real[base+f]=0;
      right.imag[base+f]=0;
    }
  }

  return cursor;
}

async function computeReferenceInverse(
  prepared,
  isFirstChunk,
  isLastChunk
){
  const pieces=[];
  let total=0;

  for(const segment of prepared.segments){
    const wave=await istftCenter(segment);

    // OfflineSourceSeparationUvrImpl trims NFFT/2 again after centered iSTFT.
    const trimmed=
      wave.subarray(
        TRIM,
        Math.max(TRIM,wave.length-TRIM)
      );

    pieces.push(trimmed);
    total+=trimmed.length;
    await cpuYield(6);
  }

  const joined=concatFloat32(
    pieces,
    total
  );

  const start=
    isFirstChunk
      ?0
      :MARGIN;

  const end=Math.max(
    start,
    joined.length-
    prepared.pad-
    (isLastChunk?0:MARGIN)
  );

  return new Float32Array(
    joined.subarray(start,end)
  );
}

async function istftCenter(stft){
  const numSamples=
    NFFT+
    (stft.numFrames-1)*HOP;

  const sum=new Float64Array(numSamples);
  const denominator=new Float64Array(numSamples);

  const re=new Float64Array(NFFT);
  const im=new Float64Array(NFFT);

  const bins=NFFT/2+1;

  for(let t=0;t<stft.numFrames;t++){
    re.fill(0);
    im.fill(0);

    const base=t*bins;

    for(let b=0;b<=NFFT/2;b++){
      re[b]=stft.real[base+b]||0;
      im[b]=
        (b===0||b===NFFT/2)
          ?0
          :(stft.imag[base+b]||0);
    }

    for(let b=1;b<NFFT/2;b++){
      re[NFFT-b]=re[b];
      im[NFFT-b]=-im[b];
    }

    fftInPlace(re,im,true);

    const start=t*HOP;

    for(let n=0;n<NFFT;n++){
      const w=WINDOW[n];
      const index=start+n;

      sum[index]+=
        re[n]*w;

      denominator[index]+=
        w*w;
    }

    if((t+1)%16===0){
      await cpuYield();
    }
  }

  const full=new Float32Array(numSamples);

  for(let i=0;i<numSamples;i++){
    full[i]=
      denominator[i]>1e-12
        ?clamp(
            sum[i]/denominator[i],
            -1,
            1
          )
        :0;
  }

  // IStft(center=true) removes NFFT/2 at both ends.
  return new Float32Array(
    full.subarray(
      TRIM,
      full.length-TRIM
    )
  );
}

function concatFloat32(chunks,total){
  const out=new Float32Array(total);
  let offset=0;

  for(const chunk of chunks){
    out.set(chunk,offset);
    offset+=chunk.length;
  }

  return out;
}

function normalizedCorrelation(a,b){
  const n=Math.min(a.length,b.length);
  if(!n)return 0;

  let ab=0,aa=0,bb=0;

  for(let i=0;i<n;i+=8){
    const x=a[i]||0;
    const y=b[i]||0;

    ab+=x*y;
    aa+=x*x;
    bb+=y*y;
  }

  if(aa<1e-12||bb<1e-12)return 0;

  return ab/Math.sqrt(aa*bb);
}

function rmsSignal(x){
  let s=0;
  let n=0;

  for(let i=0;i<x.length;i+=4){
    const v=x[i];
    s+=v*v;
    n++;
  }

  return Math.sqrt(
    s/Math.max(1,n)
  );
}

function speechBandAnchor(input){
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

    out[i]=clamp(
      y0,
      -1,
      1
    );

    x2=x1;
    x1=x0;
    y2=y1;
    y1=y0;
  }

  return out;
}

function fftInPlace(re,im,inverse){
  const n=re.length;

  for(let i=1,j=0;i<n;i++){
    let bit=n>>1;

    for(;j&bit;bit>>=1){
      j^=bit;
    }

    j^=bit;

    if(i<j){
      let x=re[i];
      re[i]=re[j];
      re[j]=x;

      x=im[i];
      im[i]=im[j];
      im[j]=x;
    }
  }

  for(let len=2;len<=n;len<<=1){
    const ang=
      (inverse?2:-2)*
      Math.PI/
      len;

    const cr=Math.cos(ang);
    const ci=Math.sin(ang);

    for(let i=0;i<n;i+=len){
      let wr=1;
      let wi=0;

      for(let j=0;j<(len>>1);j++){
        const u=i+j;
        const v=u+(len>>1);

        const vr=
          re[v]*wr-
          im[v]*wi;

        const vi=
          re[v]*wi+
          im[v]*wr;

        re[v]=re[u]-vr;
        im[v]=im[u]-vi;

        re[u]+=vr;
        im[u]+=vi;

        const nw=
          wr*cr-
          wi*ci;

        wi=
          wr*ci+
          wi*cr;

        wr=nw;
      }
    }
  }

  if(inverse){
    for(let i=0;i<n;i++){
      re[i]/=n;
      im[i]/=n;
    }
  }
}

function concatChunks(chunks,total){const out=new Uint8Array(total);let o=0;for(const c of chunks){out.set(c,o);o+=c.byteLength;}return out.buffer;}
function sanitize(x){const out=new Float32Array(x.length);for(let i=0;i<x.length;i++)out[i]=Number.isFinite(x[i])?clamp(x[i],-1,1):0;return out;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
