// RIVANI AI · Background Voices
const ORT_VERSION="1.29.0";
const ORT_WEBGPU_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.webgpu.min.mjs`;
const ORT_WASM_URL=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.min.mjs`;
const ORT_WASM_BASE=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MODEL_PROXY="https://rivani-models.rivani.workers.dev/background-voices.onnx";
const MODEL_DIRECT="https://huggingface.co/tonythethompson/SepFormer-WhamR16k-ONNX/resolve/main/sepformer.onnx?download=true";
const CACHE_NAME="rivani-specialist-models-v22";
const SR=16000,CHUNK=SR*6,OVERLAP=SR,STRIDE=CHUNK-OVERLAP;
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

    const input=sanitize(new Float32Array(d.buffer));
    await ensureSession();
    const r=await separateLong(input,String(d.mode||"auto").toLowerCase());

    self.postMessage({
      type:"done",
      selected:r.selected,
      energyA:r.energyA,
      energyB:r.energyB,
      applied:r.applied,
      confidence:r.confidence,
      reason:r.reason,
      buffer:r.audio.buffer
    },[r.audio.buffer]);
  }catch(err){
    self.postMessage({
      type:"error",
      message:String(err?.message||err||"Background Voices failed")
    });
  }
};

async function ensureSession(){
  if(session)return session;
  if(sessionPromise)return sessionPromise;

  sessionPromise=(async()=>{
    self.postMessage({
      type:"modelProgress",
      progress:1,
      text:"Preparing Background Voices AI…"
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
      text:`Starting Background Voices AI · ${wasmOrt.env.wasm.numThreads>1?"multi-core":"compatibility"}…`
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
      text:`Background Voices AI ready · ${wasmOrt.env.wasm.numThreads>1?"multi-core":"WASM"}`
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
  // Final CPU Balanced profile: stable single-thread inference.
  return 1;
}
function cpuYield(ms=24){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function getModelBytes(){const cache=await caches.open(CACHE_NAME),key=new Request(MODEL_PROXY),cached=await cache.match(key);if(cached){const ab=await cached.arrayBuffer();if(ab.byteLength>70000000)return ab;}let last;for(const url of [MODEL_PROXY,MODEL_DIRECT]){try{const res=await fetch(url,{mode:"cors",cache:"no-store"});if(!res.ok)throw new Error(`HTTP ${res.status}`);const total=Number(res.headers.get("content-length")||0),reader=res.body?.getReader();let ab;if(reader){let loaded=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;self.postMessage({type:"modelProgress",progress:total?Math.min(92,Math.round(loaded/total*92)):25,text:total?`Preparing Background Voices AI ${Math.round(loaded/total*100)}%…`:"Preparing Background Voices AI…"});}ab=concatChunks(chunks,loaded);}else ab=await res.arrayBuffer();if(ab.byteLength<70000000)throw new Error("Specialist model download was incomplete.");try{await cache.put(key,new Response(ab.slice(0),{headers:{"content-type":"application/octet-stream"}}));}catch{}return ab;}catch(err){last=err;}}throw new Error(`Background Voices model could not load. Deploy the V22 rivani-models Worker update. ${last?.message||""}`);}
function inputShapeFor(n){const name=session.inputNames[0];const meta=session.inputMetadata?.[name]||session.inputMetadata?.[0];const dims=meta?.dimensions||meta?.dims||[];if(dims.length===1)return [n];if(dims.length===3)return [1,1,n];return [1,n];}
async function runSegment(seg){const name=session.inputNames[0],tensor=new ort.Tensor("float32",seg,inputShapeFor(seg.length)),outs=await session.run({[name]:tensor});if(session.outputNames.length>=2){const a=outs[session.outputNames[0]],b=outs[session.outputNames[1]];if(a?.data?.length>=seg.length&&b?.data?.length>=seg.length)return {a:new Float32Array(a.data.slice(0,seg.length)),b:new Float32Array(b.data.slice(0,seg.length))};}const out=outs[session.outputNames[0]];if(!out?.data)throw new Error("Speaker separator returned no audio.");return extractTwoSources(out,seg.length);}
async function separateLong(input,mode){
  if(!input.length){
    return {audio:new Float32Array(),selected:"VOICE A",energyA:0,energyB:0,applied:false,confidence:0,reason:"empty"};
  }

  const sumA=new Float64Array(input.length);
  const sumB=new Float64Array(input.length);
  const wgt=new Float64Array(input.length);
  const pos=[];
  for(let p=0;p<input.length;p+=STRIDE){pos.push(p);if(p+CHUNK>=input.length)break;}

  let tailA=null,tailB=null;
  for(let ci=0;ci<pos.length;ci++){
    const p=pos[ci];
    const valid=Math.min(CHUNK,input.length-p);
    const seg=reflectPad(input.subarray(p,p+valid),CHUNK);
    self.postMessage({type:"progress",progress:Math.round(ci/Math.max(1,pos.length)*100),text:`Separating speakers ${ci+1} of ${pos.length}…`});

    let {a,b}=await runSegment(seg);
    if(ci>0&&tailA&&tailB){
      const ha=a.subarray(0,Math.min(OVERLAP,a.length));
      const hb=b.subarray(0,Math.min(OVERLAP,b.length));
      const same=Math.abs(correlation(tailA,ha))+Math.abs(correlation(tailB,hb));
      const swap=Math.abs(correlation(tailA,hb))+Math.abs(correlation(tailB,ha));
      if(swap>same){const tmp=a;a=b;b=tmp;}
    }

    const ts=Math.max(0,valid-OVERLAP);
    tailA=new Float32Array(a.subarray(ts,valid));
    tailB=new Float32Array(b.subarray(ts,valid));

    for(let i=0;i<valid;i++){
      const oi=p+i;let w=1;
      if(ci>0&&i<OVERLAP){const t=i/(OVERLAP-1);w*=.5-.5*Math.cos(Math.PI*t);}
      if(ci<pos.length-1&&i>=STRIDE){const t=(i-STRIDE)/(OVERLAP-1);w*=.5+.5*Math.cos(Math.PI*t);}
      sumA[oi]+=a[i]*w;sumB[oi]+=b[i]*w;wgt[oi]+=w;
    }

    if(ci<pos.length-1){
      await cpuYield();
    }
  }

  const A=new Float32Array(input.length),B=new Float32Array(input.length);
  for(let i=0;i<input.length;i++){
    const w=wgt[i]>1e-9?wgt[i]:1;
    A[i]=clamp(sumA[i]/w,-1,1);
    B[i]=clamp(sumB[i]/w,-1,1);
  }

  const eA=activeEnergy(A),eB=activeEnergy(B);
  const stronger=Math.max(eA,eB),weaker=Math.min(eA,eB);
  const secondaryRatio=stronger>1e-7?weaker/stronger:0;
  const reconstruction=reconstructionError(input,A,B);
  const speechA=speechActivityScore(A),speechB=speechActivityScore(B);
  const secondSpeechScore=Math.min(speechA,speechB);

  const secondaryStem=eA<=eB?A:B;
  const secondaryDuty=speechDutyCycle(secondaryStem);

  let audio,selected;
  if(mode==="a"){audio=A;selected="VOICE A";}
  else if(mode==="b"){audio=B;selected="VOICE B";}
  else if(eB>eA){audio=B;selected="VOICE B";}
  else{audio=A;selected="VOICE A";}

  const inputRms=rmsSignal(input),selectedRms=rmsSignal(audio);
  const selectedRatio=inputRms>1e-8?selectedRms/inputRms:1;
  const explicitStem=mode==="a"||mode==="b";

  const twoSpeakerScore=clamp((secondaryRatio-.12)/.45,0,1);
  const reconstructionScore=clamp(1-reconstruction/.62,0,1);
  const confidence=twoSpeakerScore*.45+reconstructionScore*.30+secondSpeechScore*.25;

  const unsafe=
    reconstruction>.68||
    selectedRatio<.055||
    selectedRatio>2.4;

  // In AUTO mode a continuous second stem is more often music/fan/room bed
  // than a separate human speaker. Keep AUTO conservative; manual Voice A/B
  // still lets the user explicitly choose a stem.
  const continuousBed=
    !explicitStem&&
    secondaryRatio>.16&&
    secondaryDuty>.76;

  const noReliableSecondSpeaker=
    !explicitStem&&(
      secondaryRatio<.16||
      secondSpeechScore<.24||
      confidence<.32||
      continuousBed
    );

  if(unsafe||noReliableSecondSpeaker){
    const pass=new Float32Array(input);
    self.postMessage({type:"progress",progress:100,text:noReliableSecondSpeaker?"No reliable second speaker detected — preserving the original voice path.":"Speaker-separation safety guard preserved the original voice path."});
    return {
      audio:pass,
      selected:"SAFE PASS",
      energyA:eA,
      energyB:eB,
      applied:false,
      confidence,
      reason:
        continuousBed
          ?"continuous-background-bed"
          :noReliableSecondSpeaker
            ?"no-second-speaker"
            :"unsafe-separation"
    };
  }

  // Do not add full-band original audio back here: it can reintroduce the
  // unwanted speaker/music. Voice-detail restoration is handled later by a
  // small speech-gated >7.2 kHz path in the 48 kHz host pipeline.
  softLevelProtect(input,audio);
  self.postMessage({type:"progress",progress:100,text:`${selected} isolated.`});
  return {audio,selected,energyA:eA,energyB:eB,applied:true,confidence,reason:"applied"};
}

function rmsSignal(x){
  let s=0,n=0;for(let i=0;i<x.length;i+=4){s+=x[i]*x[i];n++;}
  return Math.sqrt(s/Math.max(1,n));
}

function reconstructionError(input,a,b){
  let e=0,r=0,n=0;
  for(let i=0;i<input.length;i+=4){const x=input[i],d=x-(a[i]+b[i]);e+=d*d;r+=x*x;n++;}
  const er=Math.sqrt(e/Math.max(1,n)),rr=Math.sqrt(r/Math.max(1,n));
  return rr>1e-8?er/rr:er;
}

function speechDutyCycle(x){
  const block=320;
  if(x.length<block*4)return 0;

  const levels=[];

  for(let p=0;p<x.length;p+=block){
    const end=Math.min(
      x.length,
      p+block
    );

    let e=0;
    let n=0;

    for(let i=p;i<end;i++){
      const v=x[i]||0;
      e+=v*v;
      n++;
    }

    levels.push(
      Math.sqrt(e/Math.max(1,n))
    );
  }

  const sorted=[...levels].sort((a,b)=>a-b);
  const floor=
    sorted[Math.floor(sorted.length*.20)]||
    0;

  const threshold=Math.max(
    .0025,
    floor*1.7
  );

  const active=
    levels.filter(v=>v>threshold).length;

  return active/Math.max(1,levels.length);
}

function speechActivityScore(x){
  // Lightweight speech-likeness guard: human speech normally has strongly
  // modulated 20 ms frame energy rather than a continuous music/noise bed.
  const block=320; // 20 ms @16k
  if(x.length<block*4)return 0;
  const db=[];
  for(let p=0;p<x.length;p+=block){
    const end=Math.min(x.length,p+block);let e=0,z=0,prev=x[p]||0,n=0;
    for(let i=p;i<end;i++){
      const v=x[i]||0;e+=v*v;n++;
      if((v>=0)!=(prev>=0))z++;
      prev=v;
    }
    const rms=Math.sqrt(e/Math.max(1,n));
    db.push(20*Math.log10(rms+1e-7));
  }
  const sorted=[...db].sort((a,b)=>a-b);
  const p20=sorted[Math.floor(sorted.length*.20)]||-100;
  const p80=sorted[Math.floor(sorted.length*.80)]||-100;
  const dynamic=p80-p20;
  const dynamicScore=clamp((dynamic-5)/15,0,1);
  const active=db.filter(v=>v>p20+6).length/db.length;
  const activityScore=clamp((active-.10)/.70,0,1);
  return dynamicScore*.68+activityScore*.32;
}

function extractTwoSources(t,n){const d=t.dims.map(Number),x=t.data,A=new Float32Array(n),B=new Float32Array(n);if(d.length===3&&d[0]===1&&d[1]===2){const T=d[2];for(let i=0;i<n;i++){A[i]=x[i]||0;B[i]=x[T+i]||0;}return {a:A,b:B};}if(d.length===3&&d[0]===1&&d[2]===2){for(let i=0;i<n;i++){A[i]=x[i*2]||0;B[i]=x[i*2+1]||0;}return {a:A,b:B};}if(d.length===2&&d[0]===2){const T=d[1];for(let i=0;i<n;i++){A[i]=x[i]||0;B[i]=x[T+i]||0;}return {a:A,b:B};}if(d.length===2&&d[1]===2){for(let i=0;i<n;i++){A[i]=x[i*2]||0;B[i]=x[i*2+1]||0;}return {a:A,b:B};}throw new Error(`Unsupported speaker-separation output shape: [${d.join(", ")}]`);}
function activeEnergy(x){const block=320,e=[];for(let i=0;i<x.length;i+=block){let s=0,n=0;for(let j=i;j<Math.min(x.length,i+block);j++){s+=x[j]*x[j];n++;}e.push(Math.sqrt(s/Math.max(1,n)));}if(!e.length)return 0;const sorted=[...e].sort((a,b)=>a-b),floor=sorted[Math.floor(sorted.length*.3)]||0,th=Math.max(.003,floor*2.2);let s=0,n=0;for(const v of e)if(v>=th){s+=v*v;n++;}return n?Math.sqrt(s/n):0;}
function correlation(a,b){const n=Math.min(a.length,b.length);let ab=0,aa=0,bb=0;for(let i=0;i<n;i+=2){ab+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return ab/Math.sqrt(Math.max(1e-12,aa*bb));}
function softLevelProtect(ref,x){let a=0,b=0,n=0;for(let i=0;i<ref.length;i+=8){a+=ref[i]*ref[i];b+=x[i]*x[i];n++;}const ra=Math.sqrt(a/Math.max(1,n)),rb=Math.sqrt(b/Math.max(1,n));if(!(ra>1e-7&&rb>1e-7))return;const g=clamp(ra/rb,.72,1.35);for(let i=0;i<x.length;i++)x[i]=clamp(x[i]*g,-1,1);}
function reflectPad(input,target){if(input.length>=target)return new Float32Array(input.subarray(0,target));const out=new Float32Array(target);out.set(input);if(!input.length)return out;if(input.length===1){out.fill(input[0],1);return out;}const ctx=Math.min(input.length,SR>>1);for(let i=input.length;i<target;i++){const p=(i-input.length)%Math.max(2,ctx*2-2),r=p<ctx?p:ctx*2-2-p,idx=Math.max(0,input.length-1-r);out[i]=input[idx];}return out;}
function concatChunks(chunks,total){const out=new Uint8Array(total);let o=0;for(const c of chunks){out.set(c,o);o+=c.byteLength;}return out.buffer;}
function sanitize(x){const out=new Float32Array(x.length);for(let i=0;i<x.length;i++)out[i]=Number.isFinite(x[i])?clamp(x[i],-1,1):0;return out;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
