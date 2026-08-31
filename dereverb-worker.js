// RIVANI AI · De-Reverb Beta worker
// Separate from the stable Clear Voice engine.
//
// Single-channel, chunked WPE-style late-reverberation suppression:
// - 48 kHz input
// - 2048-point STFT
// - 512-sample hop (~10.7 ms)
// - delayed long-term complex prediction
// - conservative blend / magnitude protection
// - 6 s chunks + 1 s smooth overlap
//
// This worker intentionally does not denoise or alter the main AI model.

const SR=48000;
const FFT=2048;
const HOP=512;
const BINS=FFT/2+1;
const CHUNK=Math.round(SR*6);
const OVERLAP=Math.round(SR*1);
const STRIDE=CHUNK-OVERLAP;

const WINDOW=new Float64Array(FFT);
for(let i=0;i<FFT;i++){
  // sqrt Hann; synthesis uses same window and explicit normalization.
  WINDOW[i]=Math.sqrt(Math.max(0,.5-.5*Math.cos(2*Math.PI*i/(FFT-1))));
}

self.onmessage=event=>{
  const data=event.data||{};

  // V23.2 transport health check. This does not touch De-Reverb DSP.
  if(data.type==="ping"){
    self.postMessage({type:"ready",version:"23.2"});
    return;
  }

  if(data.type!=="process")return;

  try{
    const input=sanitize(new Float32Array(data.buffer));
    const strength=clamp(Number(data.strength??.58),.25,.88);

    self.postMessage({
      type:"phase",
      progress:1,
      text:"Analyzing room reflections…"
    });

    const output=processLong(input,strength);

    self.postMessage(
      {type:"done",buffer:output.buffer},
      [output.buffer]
    );
  }catch(error){
    self.postMessage({
      type:"error",
      message:String(error?.message||error||"De-Reverb Beta failed")
    });
  }
};

function processLong(input,strength){
  if(input.length<=CHUNK){
    const padded=reflectPad(input,CHUNK);
    const out=processChunk(padded,strength);
    return new Float32Array(out.subarray(0,input.length));
  }

  const sum=new Float64Array(input.length);
  const weight=new Float64Array(input.length);

  const positions=[];
  for(let pos=0;pos<input.length;pos+=STRIDE){
    positions.push(pos);
    if(pos+CHUNK>=input.length)break;
  }

  for(let ci=0;ci<positions.length;ci++){
    const pos=positions[ci];
    const valid=Math.min(CHUNK,input.length-pos);
    const seg=reflectPad(input.subarray(pos,pos+valid),CHUNK);

    self.postMessage({
      type:"progress",
      progress:Math.round((ci/positions.length)*100),
      text:`De-Reverb segment ${ci+1} of ${positions.length}…`
    });

    const processed=processChunk(seg,strength);

    for(let i=0;i<valid;i++){
      const oi=pos+i;
      let w=1;

      if(ci>0 && i<OVERLAP){
        const t=i/Math.max(1,OVERLAP-1);
        w*=.5-.5*Math.cos(Math.PI*t);
      }

      if(ci<positions.length-1 && i>=STRIDE){
        const t=(i-STRIDE)/Math.max(1,OVERLAP-1);
        w*=.5+.5*Math.cos(Math.PI*t);
      }

      sum[oi]+=processed[i]*w;
      weight[oi]+=w;
    }
  }

  const out=new Float32Array(input.length);
  for(let i=0;i<out.length;i++){
    out[i]=weight[i]>1e-10
      ? clamp(sum[i]/weight[i],-1,1)
      : input[i];
  }

  self.postMessage({
    type:"progress",
    progress:100,
    text:"Room-reflection cleanup complete."
  });

  return out;
}

function processChunk(input,strength){
  const frameCount=Math.max(
    1,
    1+Math.ceil(Math.max(0,input.length-FFT)/HOP)
  );

  const reFrames=new Array(frameCount);
  const imFrames=new Array(frameCount);

  // Analysis STFT.
  for(let t=0;t<frameCount;t++){
    const start=t*HOP;
    const re=new Float64Array(FFT);
    const im=new Float64Array(FFT);

    for(let n=0;n<FFT;n++){
      const idx=start+n;
      re[n]=(idx<input.length?input[idx]:0)*WINDOW[n];
    }

    fftInPlace(re,im,false);

    const hr=new Float32Array(BINS);
    const hi=new Float32Array(BINS);
    for(let f=0;f<BINS;f++){
      hr[f]=re[f];
      hi[f]=im[f];
    }

    reFrames[t]=hr;
    imFrames[t]=hi;
  }

  // Prediction settings.
  const taps=strength>.72?9:8;
  const delay=3; // ~32 ms guard interval
  const iterations=strength>.74?2:1;

  // Keep extreme low/high bands untouched.
  const lowBin=Math.max(1,Math.floor(90*FFT/SR));
  const highBin=Math.min(BINS-1,Math.ceil(9000*FFT/SR));

  const T=frameCount;
  const validStart=delay+taps-1;

  if(T<=validStart+6){
    return input.slice();
  }

  for(let f=lowBin;f<=highBin;f++){
    const yr=new Float64Array(T);
    const yi=new Float64Array(T);
    const xr=new Float64Array(T);
    const xi=new Float64Array(T);

    for(let t=0;t<T;t++){
      yr[t]=reFrames[t][f];
      yi[t]=imFrames[t][f];
      xr[t]=yr[t];
      xi[t]=yi[t];
    }

    let solvedAny=false;

    for(let iter=0;iter<iterations;iter++){
      const invPower=estimateInversePower(xr,xi,validStart);

      const ar=new Float64Array(taps*taps);
      const ai=new Float64Array(taps*taps);
      const br=new Float64Array(taps);
      const bi=new Float64Array(taps);

      // Weighted complex correlations.
      for(let t=validStart;t<T;t++){
        const w=invPower[t];
        const ytr=yr[t], yti=yi[t];

        for(let i=0;i<taps;i++){
          const ti=t-delay-i;
          const zir=yr[ti], zii=yi[ti];

          // P = sum w * z * conj(y)
          br[i]+=w*(zir*ytr+zii*yti);
          bi[i]+=w*(zii*ytr-zir*yti);

          for(let j=0;j<taps;j++){
            const tj=t-delay-j;
            const zjr=yr[tj], zji=yi[tj];

            // R = sum w * z_i * conj(z_j)
            const idx=i*taps+j;
            ar[idx]+=w*(zir*zjr+zii*zji);
            ai[idx]+=w*(zii*zjr-zir*zji);
          }
        }
      }

      // Diagonal loading for numerical stability.
      let trace=0;
      for(let i=0;i<taps;i++)trace+=Math.max(0,ar[i*taps+i]);
      const reg=Math.max(1e-8,(trace/Math.max(1,taps))*(.0025+.003*(1-strength)));

      for(let i=0;i<taps;i++){
        ar[i*taps+i]+=reg;
      }

      const solved=solveComplex(ar,ai,br,bi,taps);
      if(!solved)break;
      solvedAny=true;

      const gr=solved.re;
      const gi=solved.im;

      const mix=.46+.43*strength;
      const minGain=.53-.11*strength;
      const maxGain=1.10;

      // Apply delayed prediction.
      for(let t=0;t<T;t++){
        if(t<validStart){
          xr[t]=yr[t];
          xi[t]=yi[t];
          continue;
        }

        let pr=0,pi=0;

        for(let k=0;k<taps;k++){
          const tk=t-delay-k;
          const zr=yr[tk],zi=yi[tk];

          // conj(g) * z
          pr+=gr[k]*zr+gi[k]*zi;
          pi+=gr[k]*zi-gi[k]*zr;
        }

        let rr=yr[t]-mix*pr;
        let ri=yi[t]-mix*pi;

        // Protect direct speech from extreme cancellation/amplification.
        const my=Math.hypot(yr[t],yi[t]);
        const mx=Math.hypot(rr,ri);

        if(my>1e-10 && mx>1e-12){
          const ratio=mx/my;
          if(ratio<minGain){
            const scale=minGain/ratio;
            rr*=scale;ri*=scale;
          }else if(ratio>maxGain){
            const scale=maxGain/ratio;
            rr*=scale;ri*=scale;
          }
        }

        xr[t]=rr;
        xi[t]=ri;
      }
    }

    if(!solvedAny)continue;

    // Store estimated direct component.
    for(let t=validStart;t<T;t++){
      reFrames[t][f]=xr[t];
      imFrames[t][f]=xi[t];
    }
  }

  // Synthesis STFT.
  const outLen=(frameCount-1)*HOP+FFT;
  const sum=new Float64Array(outLen);
  const norm=new Float64Array(outLen);

  for(let t=0;t<frameCount;t++){
    const re=new Float64Array(FFT);
    const im=new Float64Array(FFT);

    for(let f=0;f<BINS;f++){
      re[f]=reFrames[t][f];
      im[f]=imFrames[t][f];

      if(f>0 && f<FFT/2){
        re[FFT-f]=re[f];
        im[FFT-f]=-im[f];
      }
    }

    fftInPlace(re,im,true);

    const start=t*HOP;
    for(let n=0;n<FFT;n++){
      const idx=start+n;
      const w=WINDOW[n];
      sum[idx]+=re[n]*w;
      norm[idx]+=w*w;
    }
  }

  const out=new Float32Array(input.length);
  for(let i=0;i<out.length;i++){
    out[i]=norm[i]>1e-10
      ? clamp(sum[i]/norm[i],-1,1)
      : input[i];
  }

  // Preserve gross loudness; final RIVANI stage performs the real level finish.
  matchRmsSoft(input,out);

  return out;
}

function estimateInversePower(xr,xi,start){
  const T=xr.length;
  const p=new Float64Array(T);

  let mean=0,count=0;
  for(let t=start;t<T;t++){
    const v=xr[t]*xr[t]+xi[t]*xi[t];
    p[t]=v;
    mean+=v;
    count++;
  }
  mean/=Math.max(1,count);

  const floor=Math.max(1e-10,mean*1e-6);
  const inv=new Float64Array(T);

  for(let t=0;t<T;t++){
    let sm=0,n=0;
    for(let q=Math.max(0,t-1);q<=Math.min(T-1,t+1);q++){
      sm+=p[q];
      n++;
    }
    sm/=Math.max(1,n);
    inv[t]=1/Math.max(floor,sm);
  }

  return inv;
}

function solveComplex(ar0,ai0,br0,bi0,n){
  // Gauss-Jordan elimination with partial pivoting.
  const ar=new Float64Array(ar0);
  const ai=new Float64Array(ai0);
  const br=new Float64Array(br0);
  const bi=new Float64Array(bi0);

  for(let col=0;col<n;col++){
    let pivot=col;
    let best=0;

    for(let row=col;row<n;row++){
      const idx=row*n+col;
      const mag=ar[idx]*ar[idx]+ai[idx]*ai[idx];
      if(mag>best){best=mag;pivot=row;}
    }

    if(!(best>1e-24) || !Number.isFinite(best))return null;

    if(pivot!==col){
      for(let j=0;j<n;j++){
        let idxA=col*n+j,idxB=pivot*n+j;

        let tr=ar[idxA];ar[idxA]=ar[idxB];ar[idxB]=tr;
        let ti=ai[idxA];ai[idxA]=ai[idxB];ai[idxB]=ti;
      }

      let tr=br[col];br[col]=br[pivot];br[pivot]=tr;
      let ti=bi[col];bi[col]=bi[pivot];bi[pivot]=ti;
    }

    const pidx=col*n+col;
    const pr=ar[pidx],pi=ai[pidx];
    const pden=pr*pr+pi*pi;
    if(!(pden>1e-24))return null;

    // Normalize pivot row.
    for(let j=col;j<n;j++){
      const idx=col*n+j;
      const qr=(ar[idx]*pr+ai[idx]*pi)/pden;
      const qi=(ai[idx]*pr-ar[idx]*pi)/pden;
      ar[idx]=qr;ai[idx]=qi;
    }

    {
      const qr=(br[col]*pr+bi[col]*pi)/pden;
      const qi=(bi[col]*pr-br[col]*pi)/pden;
      br[col]=qr;bi[col]=qi;
    }

    // Eliminate the column from all other rows.
    for(let row=0;row<n;row++){
      if(row===col)continue;

      const fidx=row*n+col;
      const fr=ar[fidx],fi=ai[fidx];
      if(Math.abs(fr)+Math.abs(fi)<1e-18)continue;

      for(let j=col;j<n;j++){
        const ridx=row*n+j;
        const pRow=col*n+j;

        // factor * pivotRow
        const mr=fr*ar[pRow]-fi*ai[pRow];
        const mi=fr*ai[pRow]+fi*ar[pRow];

        ar[ridx]-=mr;
        ai[ridx]-=mi;
      }

      const mr=fr*br[col]-fi*bi[col];
      const mi=fr*bi[col]+fi*br[col];
      br[row]-=mr;
      bi[row]-=mi;
    }
  }

  for(let i=0;i<n;i++){
    if(!Number.isFinite(br[i])||!Number.isFinite(bi[i]))return null;
  }

  return {re:br,im:bi};
}

function fftInPlace(re,im,inverse){
  const n=re.length;

  for(let i=1,j=0;i<n;i++){
    let bit=n>>1;

    for(;j&bit;bit>>=1)j^=bit;
    j^=bit;

    if(i<j){
      let tr=re[i];re[i]=re[j];re[j]=tr;
      let ti=im[i];im[i]=im[j];im[j]=ti;
    }
  }

  for(let len=2;len<=n;len<<=1){
    const angle=(inverse?2:-2)*Math.PI/len;
    const wrStep=Math.cos(angle);
    const wiStep=Math.sin(angle);

    for(let i=0;i<n;i+=len){
      let wr=1,wi=0;
      const half=len>>1;

      for(let j=0;j<half;j++){
        const u=i+j;
        const v=u+half;

        const vr=re[v]*wr-im[v]*wi;
        const vi=re[v]*wi+im[v]*wr;

        re[v]=re[u]-vr;
        im[v]=im[u]-vi;
        re[u]+=vr;
        im[u]+=vi;

        const nwr=wr*wrStep-wi*wiStep;
        wi=wr*wiStep+wi*wrStep;
        wr=nwr;
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

function reflectPad(input,target){
  if(input.length>=target)return new Float32Array(input.subarray(0,target));

  const out=new Float32Array(target);
  out.set(input);

  if(!input.length)return out;
  if(input.length===1){
    out.fill(input[0],1);
    return out;
  }

  const context=Math.min(input.length,Math.round(SR*.65));
  const base=input.length-context;

  for(let i=input.length;i<target;i++){
    const p=(i-input.length)%Math.max(2,context*2-2);
    const r=p<context?p:context*2-2-p;
    const idx=Math.max(base,Math.min(input.length-1,input.length-1-r));
    out[i]=input[idx];
  }

  return out;
}

function matchRmsSoft(input,output){
  let a=0,b=0,n=0;

  for(let i=0;i<input.length;i+=8){
    a+=input[i]*input[i];
    b+=output[i]*output[i];
    n++;
  }

  const ra=Math.sqrt(a/Math.max(1,n));
  const rb=Math.sqrt(b/Math.max(1,n));
  if(!(ra>1e-7)||!(rb>1e-7))return;

  let gain=ra/rb;
  gain=clamp(gain,.88,1.12);

  for(let i=0;i<output.length;i++){
    output[i]=clamp(output[i]*gain,-1,1);
  }
}

function sanitize(input){
  const out=new Float32Array(input.length);

  for(let i=0;i<input.length;i++){
    const v=input[i];
    out[i]=Number.isFinite(v)?clamp(v,-1,1):0;
  }

  return out;
}

function clamp(v,a,b){
  return Math.max(a,Math.min(b,v));
}
