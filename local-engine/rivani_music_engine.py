from __future__ import annotations
import asyncio, json, os, platform, re, shutil, subprocess, sys, time, uuid
from pathlib import Path
from typing import Any, Optional
import httpx, psutil
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT=Path(__file__).resolve().parent
STUDIO=ROOT/'studio'; CONFIG=ROOT/'config'; WORKSPACE=ROOT/'workspace'; UPLOADS=WORKSPACE/'uploads'; PROJECTS=WORKSPACE/'projects'; VENDOR=ROOT/'vendor'/'ACE-Step-1.5'
ACE_URL='http://127.0.0.1:8001'; PORT=int(os.environ.get('RIVANI_MUSIC_PORT','43817'))
UPLOADS.mkdir(parents=True,exist_ok=True); PROJECTS.mkdir(parents=True,exist_ok=True)
VOICES=json.loads((CONFIG/'voice_presets.json').read_text(encoding='utf-8'))
MODEL_CFG=json.loads((CONFIG/'model_profiles.json').read_text(encoding='utf-8'))
app=FastAPI(title='RIVANI Music Local Engine',docs_url='/api/docs',redoc_url=None)
app.mount('/studio',StaticFiles(directory=str(STUDIO)),name='studio')
ace_process:Optional[subprocess.Popen]=None; downloads:dict[str,subprocess.Popen]={}

def _localhost_only(request:Request):
    host=(request.headers.get('host') or '').split(':')[0].lower()
    if host not in {'127.0.0.1','localhost','[::1]'}: raise HTTPException(403,'Local engine only')

@app.middleware('http')
async def local_guard(request:Request,call_next):
    _localhost_only(request)
    if request.method=='OPTIONS': return JSONResponse({'ok':True})
    return await call_next(request)

def _run(cmd:list[str],timeout=5)->str:
    try:return subprocess.check_output(cmd,stderr=subprocess.STDOUT,text=True,timeout=timeout).strip()
    except Exception:return ''

def detect_device()->dict[str,Any]:
    info={'os':platform.system(),'arch':platform.machine(),'cpu':platform.processor() or platform.machine(),'ram_gb':round(psutil.virtual_memory().total/1024**3,1),'vendor':'cpu','name':'CPU / fallback','vram_gb':0.0}
    n=_run(['nvidia-smi','--query-gpu=name,memory.total,driver_version','--format=csv,noheader,nounits'])
    if n:
        line=n.splitlines()[0]; parts=[x.strip() for x in line.split(',')]
        info.update(vendor='nvidia',name=parts[0],vram_gb=round(float(parts[1])/1024,1),driver=parts[2] if len(parts)>2 else '')
    elif platform.system()=='Darwin' and platform.machine().lower() in {'arm64','aarch64'}:
        info.update(vendor='apple',name='Apple Silicon (unified memory)',vram_gb=max(0.0,info['ram_gb']-2))
    else:
        roc=_run(['rocm-smi','--showproductname'])
        if roc: info.update(vendor='amd',name='AMD ROCm GPU',vram_gb=8.0)
    info['recommended']=recommend_profile(info['vram_gb'],info['vendor'])
    info['max_duration']=info['recommended']['max_duration']
    return info

def recommend_profile(vram:float,vendor:str)->dict[str,Any]:
    profiles=MODEL_CFG['profiles']; chosen=profiles[0]
    for p in profiles:
        if vram>=p['min_vram']: chosen=p
    if vendor=='cpu': chosen=next(p for p in profiles if p['id']=='lite')
    return chosen

def select_profile(requested:str,device:dict[str,Any])->dict[str,Any]:
    rec=device['recommended']; profiles={p['id']:p for p in MODEL_CFG['profiles']}
    if requested in {'','auto',None}: return rec
    p=profiles.get(requested,rec)
    if device['vram_gb']<p['min_vram'] and device['vendor']!='apple': return rec
    return p

async def ace_health()->bool:
    try:
        async with httpx.AsyncClient(timeout=1.2) as c:
            r=await c.get(f'{ACE_URL}/health'); return r.status_code==200
    except Exception:return False

def spawn_ace()->None:
    global ace_process
    if ace_process and ace_process.poll() is None:return
    if not VENDOR.exists(): raise HTTPException(503,'ACE-Step is not installed. Run the local-engine installer first.')
    uv=shutil.which('uv')
    if not uv: raise HTTPException(503,'uv is not installed. Run the local-engine installer first.')
    env=os.environ.copy(); env.setdefault('ACESTEP_INIT_LLM','auto'); env.setdefault('ACESTEP_CHECKPOINTS_DIR',str(ROOT/'checkpoints')); env.setdefault('ACESTEP_DOWNLOAD_SOURCE','auto')
    log=(ROOT/'engine.log').open('a',encoding='utf-8')
    ace_process=subprocess.Popen([uv,'run','--project',str(VENDOR),'acestep-api','--host','127.0.0.1','--port','8001'],cwd=str(VENDOR),env=env,stdout=log,stderr=subprocess.STDOUT)

def wait_for_ace(seconds=4):
    spawn_ace()

async def ensure_ace():
    if await ace_health():return
    wait_for_ace()
    for _ in range(18):
        await asyncio.sleep(.55)
        if await ace_health():return
    raise HTTPException(503,'ACE-Step API is starting or model dependencies are still preparing. Check local engine log.')

def persona(voice_id:str)->dict[str,Any]:
    return next((v for v in VOICES if v['id']==voice_id),VOICES[0])

def build_caption(body:dict[str,Any])->str:
    p=persona(str(body.get('voice_id') or ''))
    parts=[str(body.get('prompt') or '').strip()]
    if not body.get('instrumental'): parts.append(f"lead singer: {p['descriptor']}")
    for label,key in [('song structure','structure'),('instrumentation','instruments'),('energy/mood journey','mood_journey')]:
        val=str(body.get(key) or '').strip()
        if val: parts.append(f'{label}: {val}')
    mode=str(body.get('creation_mode') or 'song')
    if mode=='exact': parts.append('resolve the musical ending exactly at the requested duration, no extra tail')
    elif mode=='loop': parts.append('seamless loopable composition, ending harmonically and rhythmically reconnects to the beginning, avoid a final-stop cadence')
    elif mode=='game': parts.append('adaptive game-music layer, stable tempo and key, loop-friendly arrangement, clear intensity contour for layering')
    parts.append('professional stereo mix, coherent full-song arrangement, natural dynamics, clean production, avoid clipped mastering')
    return '. '.join(x for x in parts if x)

def parse_task_id(data:Any)->str:
    if isinstance(data,dict):
        for key in ('task_id','taskId','id'):
            if data.get(key):return str(data[key])
        inner=data.get('data')
        if isinstance(inner,dict):return parse_task_id(inner)
        if isinstance(inner,list) and inner:return parse_task_id(inner[0])
    return ''

async def release_task(payload:dict[str,Any])->dict[str,Any]:
    await ensure_ace()
    async with httpx.AsyncClient(timeout=60) as c:
        r=await c.post(f'{ACE_URL}/release_task',json=payload)
    if r.status_code>=400: raise HTTPException(502,f'ACE-Step request failed: {r.text[:500]}')
    data=r.json(); tid=parse_task_id(data)
    if not tid: raise HTTPException(502,f'ACE-Step returned no task id: {str(data)[:600]}')
    return {'task_id':tid,'raw':data}

@app.get('/')
async def studio(): return FileResponse(STUDIO/'index.html')

@app.get('/api/health')
async def health():
    ready=await ace_health()
    return {'ok':True,'service':'rivani-music-local','ace_ready':ready,'workspace':str(WORKSPACE),'device':detect_device()}

@app.get('/api/device')
async def device(): return detect_device()

@app.get('/api/voices')
async def voices(): return {'voices':VOICES}

@app.get('/api/model-profiles')
async def profiles(): return MODEL_CFG

@app.post('/api/upload')
async def upload(file:UploadFile=File(...),kind:str=Form('source')):
    suffix=Path(file.filename or '').suffix.lower()
    if suffix not in {'.wav','.mp3','.flac','.m4a','.aac','.ogg','.webm','.mp4'}: raise HTTPException(400,'Unsupported audio file type')
    name=f'{kind}-{uuid.uuid4().hex}{suffix}'; path=UPLOADS/name
    total=0
    with path.open('wb') as out:
        while True:
            chunk=await file.read(1024*1024)
            if not chunk:break
            total+=len(chunk)
            if total>250*1024*1024: path.unlink(missing_ok=True); raise HTTPException(413,'Audio file is too large')
            out.write(chunk)
    return {'ok':True,'path':str(path),'name':name,'bytes':total}

@app.post('/api/generate')
async def generate(body:dict[str,Any]):
    dev=detect_device(); prof=select_profile(str(body.get('quality') or 'auto'),dev)
    duration=max(10,min(float(body.get('duration') or 120),float(prof['max_duration'])))
    v=persona(str(body.get('voice_id') or ''))
    seed=int(body.get('seed') or v['seed']) if body.get('voice_lock',True) else -1
    ref=str(body.get('reference_audio_path') or '')
    if ref and not body.get('reference_consent'): raise HTTPException(400,'Reference voice requires rights/consent confirmation')
    lyrics=str(body.get('lyrics') or '').strip(); auto=bool(body.get('auto_lyrics')) and not lyrics and not body.get('instrumental')
    payload={'prompt':build_caption(body),'lyrics':lyrics,'thinking':bool(prof['thinking']),'use_format':bool(prof['thinking']),'sample_mode':auto,'sample_query':str(body.get('prompt') or '') if auto else '', 'instrumental':bool(body.get('instrumental')),'vocal_language':str(body.get('language') or 'en'),'audio_duration':duration,'bpm':int(body.get('bpm') or 96),'key_scale':str(body.get('key_scale') or ''),'time_signature':str(body.get('time_signature') or '4/4'),'inference_steps':int(prof['steps']),'guidance_scale':7.0,'use_random_seed':seed<0,'seed':seed,'batch_size':max(1,min(int(body.get('variants') or 1),int(prof.get('batch',1) or 1))),'task_type':'text2music','audio_format':'wav','model':prof['model']}
    if ref:payload['reference_audio_path']=ref
    out=await release_task(payload)
    _save_project_stub(out['task_id'],body,payload,prof)
    return {'ok':True,'task_id':out['task_id'],'profile':prof,'device':dev}

@app.post('/api/edit')
async def edit(body:dict[str,Any]):
    task=str(body.get('task_type') or 'repaint')
    if task not in {'cover','repaint','complete'}:raise HTTPException(400,'Unsupported edit task')
    src=str(body.get('src_audio_path') or '')
    if not src or not Path(src).exists():raise HTTPException(400,'Source audio is missing')
    dev=detect_device(); prof=select_profile(str(body.get('quality') or 'auto'),dev)
    if task=='complete': prof=next((p for p in MODEL_CFG['profiles'] if p['id']=='fast'),prof)
    payload={'task_type':task,'src_audio_path':src,'prompt':str(body.get('prompt') or ''),'thinking':bool(prof['thinking']),'use_format':bool(prof['thinking']),'inference_steps':int(prof['steps']),'audio_format':'wav','model':'acestep-v15-base' if task=='complete' else prof['model'],'repainting_start':float(body.get('repainting_start') or 0),'repainting_end':float(body.get('repainting_end') or -1),'repaint_strength':float(body.get('repaint_strength') or .5),'audio_cover_strength':.8}
    out=await release_task(payload);return {'ok':True,'task_id':out['task_id'],'profile':prof}

@app.post('/api/stem')
async def stem(body:dict[str,Any]):
    task=str(body.get('task_type') or 'extract')
    if task not in {'extract','lego','complete'}:raise HTTPException(400,'Unsupported stem task')
    src=str(body.get('src_audio_path') or '')
    if not src or not Path(src).exists():raise HTTPException(400,'Source audio is missing')
    target=str(body.get('target_track') or 'vocals')
    prompt=f"target track: {target}. {str(body.get('prompt') or '')}".strip()
    payload={'task_type':task,'src_audio_path':src,'prompt':prompt,'global_caption':prompt,'thinking':False,'inference_steps':50,'audio_format':'wav','model':'acestep-v15-base'}
    out=await release_task(payload);return {'ok':True,'task_id':out['task_id']}

@app.get('/api/jobs/{task_id}')
async def job(task_id:str):
    await ensure_ace()
    async with httpx.AsyncClient(timeout=20) as c:r=await c.post(f'{ACE_URL}/query_result',json={'task_id_list':[task_id]})
    if r.status_code>=400:raise HTTPException(502,'Could not query ACE-Step task')
    raw=r.json(); rows=raw.get('data') if isinstance(raw,dict) else raw
    row=(rows or [{}])[0] if isinstance(rows,list) else {}
    status=int(row.get('status',0)); progress_text=str(row.get('progress_text') or '')
    items=[]; error=''
    try: parsed=json.loads(row.get('result') or '[]') if isinstance(row.get('result'),str) else (row.get('result') or [])
    except Exception: parsed=[]
    if isinstance(parsed,list):
        for it in parsed:
            if not isinstance(it,dict):continue
            file=str(it.get('file') or '')
            audio_url=''
            if file:
                if file.startswith('/v1/audio?'): audio_url='/api/audio?'+file.split('?',1)[1]
                elif 'path=' in file: audio_url='/api/audio?'+file.split('?',1)[-1]
                else: audio_url='/api/audio?path='+file
            items.append({**it,'audio_url':audio_url})
            if it.get('error'):error=str(it['error'])
    if status==1:_finalize_project(task_id,items)
    if status==2 and not error:error=progress_text or 'ACE-Step generation failed'
    return {'task_id':task_id,'status':status,'progress_text':progress_text,'progress':float((parsed[0].get('progress',0) if parsed and isinstance(parsed[0],dict) else 0) or 0),'items':items,'error':error}

@app.get('/api/audio')
async def audio(path:str):
    await ensure_ace()
    async with httpx.AsyncClient(timeout=None) as c:
        r=await c.get(f'{ACE_URL}/v1/audio',params={'path':path})
    if r.status_code>=400:raise HTTPException(404,'Generated audio not found')
    local=WORKSPACE/'exports'/Path(path).name; local.parent.mkdir(exist_ok=True); local.write_bytes(r.content)
    return FileResponse(local,filename=local.name,media_type=r.headers.get('content-type','audio/wav'))

@app.post('/api/models/download')
async def model_download(body:dict[str,Any]):
    model=str(body.get('model') or '').strip()
    allowed={p['model'] for p in MODEL_CFG['profiles']}|{p['lm'] for p in MODEL_CFG['profiles'] if p.get('lm')}
    if model not in allowed:raise HTTPException(400,'Unknown model')
    if model in downloads and downloads[model].poll() is None:return {'started':False,'running':True}
    if not VENDOR.exists():raise HTTPException(503,'ACE-Step is not installed')
    uv=shutil.which('uv')
    if not uv:raise HTTPException(503,'uv is not installed')
    log=(ROOT/f'download-{re.sub(r"[^A-Za-z0-9._-]","_",model)}.log').open('a',encoding='utf-8')
    p=subprocess.Popen([uv,'run','--project',str(VENDOR),'acestep-download','--model',model],cwd=str(VENDOR),stdout=log,stderr=subprocess.STDOUT)
    downloads[model]=p;return {'started':True,'pid':p.pid,'model':model}

@app.get('/api/projects')
async def projects():
    rows=[]
    for p in sorted(PROJECTS.glob('*.json'),key=lambda x:x.stat().st_mtime,reverse=True)[:60]:
        try:rows.append(json.loads(p.read_text(encoding='utf-8')))
        except Exception:pass
    return {'projects':rows}

def _save_project_stub(task_id:str,body:dict,payload:dict,profile:dict):
    data={'task_id':task_id,'created_at':time.strftime('%Y-%m-%d %H:%M:%S'),'title':str(body.get('prompt') or 'RIVANI song')[:80],'prompt':str(body.get('prompt') or ''),'voice_id':body.get('voice_id'),'profile':profile['id'],'payload':payload,'status':'running'}
    (PROJECTS/f'{task_id}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

def _finalize_project(task_id:str,items:list[dict]):
    p=PROJECTS/f'{task_id}.json'
    if not p.exists():return
    try:data=json.loads(p.read_text(encoding='utf-8'))
    except Exception:data={'task_id':task_id}
    data['status']='succeeded';data['items']=items;data['audio_url']=items[0].get('audio_url','') if items else ''
    p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':
    import uvicorn, webbrowser, threading
    def open_ui():time.sleep(1.2);webbrowser.open(f'http://127.0.0.1:{PORT}/')
    threading.Thread(target=open_ui,daemon=True).start()
    uvicorn.run(app,host='127.0.0.1',port=PORT,log_level='info')
