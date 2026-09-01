// RIVANI AI V26.3 · Adaptive Quality + Filters + Exact Color worker
// Lightweight, non-neural, content-aware finishing after Fidelity Guard.
// Uses Smart Scan metadata to tune deblur, cleanup, tone, vibrance, clarity and edge recovery.
// No geometry changes or synthetic content generation.
self.onmessage=event=>{
  const msg=event.data||{};
  if(msg.type!=="finish")return;
  try{
    const rgba=new Uint8ClampedArray(msg.rgba);
    const width=Number(msg.width)||0;
    const height=Number(msg.height)||0;
    if(!width||!height||rgba.length!==width*height*4)throw new Error("Invalid finish buffer.");
    applyAdaptiveFinish(
      rgba,width,height,msg.mode,msg.strength,msg.sceneProfile,
      msg.colorLock!==false,msg.clarity,msg.sharpness,msg.scan||null,
      msg.filterPreset||"none",msg.filterAmount||0,msg.exactColor||""
    );
    self.postMessage({type:"done",rgba:rgba.buffer},[rgba.buffer]);
  }catch(error){
    self.postMessage({type:"error",message:error?.message||"Studio Finish failed."});
  }
};

function applyAdaptiveFinish(rgba,width,height,mode,strength,sceneProfile,colorLock,clarityAmount=0,sharpnessAmount=0,scan=null,filterPreset="none",filterAmount=0,exactColor=""){
  const power=clamp01((Number(strength)||0)/100);
  const filterMix=clamp01((Number(filterAmount)||0)/100);
  const filter=String(filterPreset||"none").toLowerCase();
  const exact=parseHexColor(exactColor);
  if((power<=0&&filter==="none"&&!exact)||width<3||height<3)return;

  const blurRisk=risk(scan?.blur?.[0],{High:.95,Medium:.52,Low:.08},.2);
  const noiseRisk=risk(scan?.noise?.[0],{High:.90,Medium:.48,Low:.08},.16);
  const compressionRisk=risk(scan?.compression?.[0],{High:.90,Medium:.50,Low:.08},.14);
  const lighting=String(scan?.lighting?.[0]||"Balanced");

  // V26.2 raises visible enhancement while keeping Strong/Restore distinct.
  let p=mode==="strong"
    ?{contrast:.285,vibrance:.54,detail:1.62,mid:.026,shadowDepth:.024,highlightSpark:.025,denoise:.24}
    :mode==="restore"
      ?{contrast:.190,vibrance:.29,detail:1.20,mid:.024,shadowDepth:.012,highlightSpark:.015,denoise:.42}
      :{contrast:.145,vibrance:.31,detail:.94,mid:.019,shadowDepth:.012,highlightSpark:.016,denoise:.20};

  if(sceneProfile==="portrait"){
    p={...p,vibrance:p.vibrance*.84,detail:p.detail*.96,contrast:p.contrast*.95,denoise:p.denoise*1.08};
  }else if(sceneProfile==="graphics"){
    p={...p,vibrance:p.vibrance*1.06,detail:p.detail*1.16,contrast:p.contrast*1.06,denoise:p.denoise*.66};
  }else if(sceneProfile==="scenery"){
    p={...p,vibrance:p.vibrance*1.18,detail:p.detail*1.08,contrast:p.contrast*1.08};
  }
  if(colorLock)p.vibrance*=.92;

  const clarity=clamp01((Number(clarityAmount)||0)/100);
  const sharpness=clamp01((Number(sharpnessAmount)||0)/100);
  const cleanupRisk=Math.max(noiseRisk,compressionRisk*.88);

  const contrast=p.contrast*power*(1+clarity*.58);
  const vibrance=p.vibrance*power*(1+clarity*.18);
  const deblurBoost=1+blurRisk*.36;
  const detailAmount=p.detail*power*(1+sharpness*1.08+clarity*.26)*deblurBoost;
  const mid=p.mid*power*(1+clarity*.72);
  const denoise=p.denoise*power*(.32+cleanupRisk*.98)*(1-sharpness*.16);

  // Lighting-aware tone balancing: dark sources get useful shadow lift; bright
  // sources recover highlights. Balanced sources keep mild cinematic depth.
  const shadowLift=(lighting==="Low"?.050:lighting==="Bright"?.006:.014)*power;
  const highlightRecover=(lighting==="Bright"?.052:lighting==="Low"?.006:.014)*power;
  const shadowDepth=p.shadowDepth*power*(lighting==="Balanced"?1:.35);
  const highlightSpark=p.highlightSpark*power*(lighting==="Balanced"?1:.38);

  let prev=new Float32Array(width),curr=new Float32Array(width),next=new Float32Array(width);
  const fillLum=(y,row)=>{
    const base=y*width*4;
    for(let x=0;x<width;x++){
      const i=base+x*4;
      row[x]=(rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722)/255;
    }
  };
  fillLum(0,curr);prev.set(curr);fillLum(Math.min(1,height-1),next);

  for(let y=0;y<height;y++){
    const base=y*width*4;
    for(let x=0;x<width;x++){
      const i=base+x*4;
      if(rgba[i+3]<8)continue;

      const r0=rgba[i]/255,g0=rgba[i+1]/255,b0=rgba[i+2]/255;
      const lum=curr[x];
      const left=curr[x?x-1:x],right=curr[x<width-1?x+1:x];
      const farL=curr[x>1?x-2:0],farR=curr[x<width-2?x+2:width-1];
      const local=(prev[x]+next[x]+left+right)*.21+(farL+farR)*.08;
      const raw=clampSigned(lum-local,.11);
      const absRaw=Math.abs(raw);

      const skin=isSkin(r0,g0,b0);
      const edgeGate=Math.min(1,.12+absRaw*20);
      const flatGate=Math.max(0,1-Math.min(1,absRaw*24));

      // 1) Noise/JPEG cleanup on flat micro-variation only. Significant edges are
      // protected by flatGate, so text/hair boundaries are not blurred away.
      const darkNoiseGate=lum<.30?1.15:1;
      const cleanupDelta=(local-lum)*denoise*flatGate*darkNoiseGate;

      // 2) Deblur + fine detail. Skin gets a softer limit; portrait non-skin
      // structures (hair, glasses, brows, fabric) keep more edge recovery.
      let detailGate=skin?.50:1;
      if(sceneProfile==="portrait"&&!skin)detailGate*=1.10;
      if(sceneProfile==="graphics")detailGate*=1.08;
      if(lum>.94)detailGate*=.42;
      const micro=clampSigned(raw*detailAmount*edgeGate*detailGate,.072);

      // 3) Local contrast/depth plus adaptive highlight/shadow balance.
      const centered=lum-.5;
      const sCurve=centered*(1-Math.min(1,2.65*centered*centered));
      const midShape=Math.max(0,1-Math.abs(lum-.52)/.52);
      const shadowShape=Math.max(0,Math.min(1,(.46-lum)/.46));
      const deepShadow=Math.max(0,Math.min(1,(.30-lum)/.30));
      const highlightShape=Math.max(0,Math.min(1,(lum-.56)/.44));
      const hotHighlight=Math.max(0,Math.min(1,(lum-.78)/.22));

      let target=lum+cleanupDelta+micro+sCurve*contrast+mid*midShape;
      target+=shadowLift*deepShadow-highlightRecover*hotHighlight;
      target-=shadowDepth*shadowShape;
      target+=highlightSpark*highlightShape;
      target=clamp01(target);

      const delta=target-lum;
      let r=clamp01(r0+delta),g=clamp01(g0+delta),b=clamp01(b0+delta);

      // 4) Controlled vibrance. Low-saturation colors receive more boost than
      // already-saturated colors. Skin/highlights stay restrained.
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx>1e-5?(mx-mn)/mx:0;
      let vib=vibrance*(1-sat*.68);
      if(skin)vib*=.30;
      if(target>.90)vib*=.46;
      if(cleanupRisk>.60&&flatGate>.70)vib*=.88; // don't magnify chroma artifacts
      const l=r*.2126+g*.7152+b*.0722;
      r=l+(r-l)*(1+vib);g=l+(g-l)*(1+vib);b=l+(b-l)*(1+vib);

      if(filterMix>0&&filter!=="none"){
        [r,g,b]=applyFilterLook(r,g,b,filter,filterMix,skin);
      }
      if(exact){
        const dr=r-exact[0],dg=g-exact[1],db=b-exact[2];
        const dist=Math.sqrt(dr*dr+dg*dg+db*db);
        const gate=clamp01((.19-dist)/.13);
        if(gate>0){
          const snap=.82*gate;
          r=r*(1-snap)+exact[0]*snap;
          g=g*(1-snap)+exact[1]*snap;
          b=b*(1-snap)+exact[2]*snap;
        }
      }

      rgba[i]=clamp255(r*255);
      rgba[i+1]=clamp255(g*255);
      rgba[i+2]=clamp255(b*255);
    }
    if(y<height-1){
      const t=prev;prev=curr;curr=next;next=t;
      fillLum(Math.min(height-1,y+2),next);
    }
  }
}

function applyFilterLook(r,g,b,filter,mix,skin){
  let rr=r,gg=g,bb=b;
  const lum=r*.2126+g*.7152+b*.0722;
  if(filter==="vivid"){
    const satBoost=skin?.10:.28;
    rr=lum+(r-lum)*(1+satBoost);gg=lum+(g-lum)*(1+satBoost);bb=lum+(b-lum)*(1+satBoost);
    rr=(rr-.5)*1.055+.5;gg=(gg-.5)*1.055+.5;bb=(bb-.5)*1.055+.5;
  }else if(filter==="clean"){
    rr=r*1.018+.012;gg=g*1.022+.014;bb=b*1.028+.018;
    const nl=rr*.2126+gg*.7152+bb*.0722;
    rr=nl+(rr-nl)*.96;gg=nl+(gg-nl)*.96;bb=nl+(bb-nl)*.96;
  }else if(filter==="warm"){
    rr=r*1.055+.010;gg=g*1.012+.004;bb=b*.955;
  }else if(filter==="cool"){
    rr=r*.965;gg=g*1.010+.002;bb=b*1.055+.008;
  }else if(filter==="cinematic"){
    const shadow=clamp01((.52-lum)/.52),high=clamp01((lum-.50)/.50);
    rr=r+high*.035-shadow*.012;gg=g+shadow*.018;bb=b+shadow*.035-high*.018;
    rr=(rr-.5)*1.075+.5;gg=(gg-.5)*1.075+.5;bb=(bb-.5)*1.075+.5;
  }else if(filter==="mono"){
    rr=gg=bb=lum;
  }
  return [clamp01(r*(1-mix)+rr*mix),clamp01(g*(1-mix)+gg*mix),clamp01(b*(1-mix)+bb*mix)];
}
function parseHexColor(value){
  const m=/^#?([0-9a-f]{6})$/i.exec(String(value||""));
  if(!m)return null;
  const n=parseInt(m[1],16);
  return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}

function risk(label,map,fallback){
  const key=String(label||"");
  return Object.prototype.hasOwnProperty.call(map,key)?map[key]:fallback;
}
function isSkin(r,g,b){return r>.26&&g>.14&&b>.07&&r>g&&g>b&&(r-b)>.065&&(r-g)<.32;}
function clampSigned(v,m){return v<-m?-m:v>m?m:v;}
function clamp01(v){return v<0?0:v>1?1:v;}
function clamp255(v){return v<0?0:v>255?255:Math.round(v);}
