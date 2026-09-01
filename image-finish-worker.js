// RIVANI AI V26 · Studio Finish worker
// Lightweight, non-neural, content-aware finishing stage. Runs after Fidelity Guard
// so the verified AI result keeps its visible crispness. No identity/geometry changes.
self.onmessage=event=>{
  const msg=event.data||{};
  if(msg.type!=="finish")return;
  try{
    const rgba=new Uint8ClampedArray(msg.rgba);
    const width=Number(msg.width)||0;
    const height=Number(msg.height)||0;
    if(!width||!height||rgba.length!==width*height*4)throw new Error("Invalid finish buffer.");
    applyStudioFinish(rgba,width,height,msg.mode,msg.strength,msg.sceneProfile,msg.colorLock!==false,msg.clarity,msg.sharpness);
    self.postMessage({type:"done",rgba:rgba.buffer},[rgba.buffer]);
  }catch(error){
    self.postMessage({type:"error",message:error?.message||"Studio Finish failed."});
  }
};

function applyStudioFinish(rgba,width,height,mode,strength,sceneProfile,colorLock,clarityAmount=0,sharpnessAmount=0){
  const power=Math.max(0,Math.min(1,Number(strength)||0)/100);
  if(power<=0||width<3||height<3)return;

  let params=mode==="strong"
    ?{contrast:.225,vibrance:.44,detail:1.34,mid:.025,shadow:.034,highlight:.043}
    :mode==="restore"
      ?{contrast:.145,vibrance:.22,detail:.88,mid:.016,shadow:.024,highlight:.027}
      :{contrast:.105,vibrance:.235,detail:.68,mid:.014,shadow:.017,highlight:.022};

  if(sceneProfile==="portrait"){
    params={...params,vibrance:params.vibrance*.82,detail:params.detail*.92,contrast:params.contrast*.92};
  }else if(sceneProfile==="graphics"){
    params={...params,vibrance:params.vibrance*1.08,detail:params.detail*1.08,contrast:params.contrast*1.04};
  }else if(sceneProfile==="scenery"){
    params={...params,vibrance:params.vibrance*1.12,contrast:params.contrast*1.05};
  }
  if(colorLock)params.vibrance*=.90;

  const clarity=Math.max(0,Math.min(1,(Number(clarityAmount)||0)/100));
  const sharpness=Math.max(0,Math.min(1,(Number(sharpnessAmount)||0)/100));
  // Clarity and Sharpness are additive Free controls on top of the verified
  // Studio Finish. They never change geometry; skin/highlight gates below remain.
  const contrast=params.contrast*power*(1+clarity*.46);
  const vibrance=params.vibrance*power*(1+clarity*.12);
  const detailAmount=params.detail*power*(1+sharpness*.90+clarity*.18);
  const mid=params.mid*power*(1+clarity*.60);
  const shadow=params.shadow*power*(1+clarity*.20);
  const highlight=params.highlight*power*(1+clarity*.18);

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
      const i=base+x*4;if(rgba[i+3]<8)continue;
      const r0=rgba[i]/255,g0=rgba[i+1]/255,b0=rgba[i+2]/255;
      const lum=curr[x],left=curr[x?x-1:x],right=curr[x<width-1?x+1:x];
      const local=(prev[x]+next[x]+left+right)*.25;
      const raw=Math.max(-.085,Math.min(.085,lum-local));
      const gate=Math.min(1,.18+Math.abs(raw)*18);
      const skin=r0>.26&&g0>.14&&b0>.07&&r0>g0&&g0>b0&&(r0-b0)>.065&&(r0-g0)<.32;
      const d=detailAmount*(skin?.55:1);
      const micro=Math.max(-.052,Math.min(.052,raw*d*gate));

      const centered=lum-.5;
      const sCurve=centered*(1-Math.min(1,2.8*centered*centered));
      const midShape=Math.max(0,1-Math.abs(lum-.53)/.53);
      const shadowShape=Math.max(0,Math.min(1,(.43-lum)/.43));
      const highlightShape=Math.max(0,Math.min(1,(lum-.50)/.50));
      const target=Math.max(0,Math.min(1,lum+micro+sCurve*contrast+mid*midShape-highlight*0+highlight*highlightShape-shadow*shadowShape));
      const delta=target-lum;
      let r=Math.max(0,Math.min(1,r0+delta));
      let g=Math.max(0,Math.min(1,g0+delta));
      let b=Math.max(0,Math.min(1,b0+delta));

      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx>1e-5?(mx-mn)/mx:0;
      let vib=vibrance*(1-sat*.58);
      if(skin)vib*=.30;
      if(target>.92)vib*=.45;
      const l=r*.2126+g*.7152+b*.0722;
      r=l+(r-l)*(1+vib);g=l+(g-l)*(1+vib);b=l+(b-l)*(1+vib);
      rgba[i]=clamp(r*255);rgba[i+1]=clamp(g*255);rgba[i+2]=clamp(b*255);
    }
    if(y<height-1){const t=prev;prev=curr;curr=next;next=t;fillLum(Math.min(height-1,y+2),next);}
  }
}
function clamp(v){return v<0?0:v>255?255:Math.round(v)}
