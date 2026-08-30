// RIVANI AI MP3 export worker
self.onmessage = event => {
  const data=event.data||{};
  if(data.type!=="encode")return;

  encode(data).catch(error=>{
    self.postMessage({
      type:"error",
      message:String(error?.message||error||"MP3 export failed")
    });
  });
};

async function encode(data){
  if(typeof lamejs==="undefined"){
    importScripts("https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js");
  }

  if(typeof lamejs==="undefined" || !lamejs.Mp3Encoder){
    throw new Error("MP3 encoder could not load.");
  }

  const sampleRate=Number(data.sampleRate||44100);
  const bitrate=Number(data.bitrate||192);
  const channels=Math.max(1,Math.min(2,Number(data.channels||1)));
  const arrays=(data.channelBuffers||[]).map(b=>new Float32Array(b));

  if(!arrays.length)throw new Error("No audio data was provided for MP3 export.");

  const encoder=new lamejs.Mp3Encoder(channels,sampleRate,bitrate);
  const blockSize=1152;
  const chunks=[];
  const length=arrays[0].length;

  for(let start=0;start<length;start+=blockSize){
    const end=Math.min(length,start+blockSize);
    const left=floatToInt16(arrays[0],start,end);

    let encoded;
    if(channels===2){
      const right=floatToInt16(arrays[1]||arrays[0],start,end);
      encoded=encoder.encodeBuffer(left,right);
    }else{
      encoded=encoder.encodeBuffer(left);
    }

    if(encoded.length)chunks.push(new Uint8Array(encoded));
  }

  const flushed=encoder.flush();
  if(flushed.length)chunks.push(new Uint8Array(flushed));

  let total=0;
  for(const chunk of chunks)total+=chunk.byteLength;

  const out=new Uint8Array(total);
  let offset=0;

  for(const chunk of chunks){
    out.set(chunk,offset);
    offset+=chunk.byteLength;
  }

  self.postMessage({type:"done",buffer:out.buffer},[out.buffer]);
}

function floatToInt16(src,start,end){
  const out=new Int16Array(end-start);

  for(let i=start,j=0;i<end;i++,j++){
    const x=Math.max(-1,Math.min(1,src[i]||0));
    out[j]=x<0 ? Math.round(x*32768) : Math.round(x*32767);
  }

  return out;
}
