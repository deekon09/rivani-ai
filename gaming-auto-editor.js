
// RIVANI AI V38.1 · Gaming Auto Editor Next-Action + Cut Safety
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const gameplayInput = $('gameplayInput');
  const facecamInput = $('facecamInput');
  const voiceInput = $('voiceInput');
  const gameplayVideo = $('gameplayVideo');
  const facecamVideo = $('facecamVideo');
  const voiceAudio = $('voiceAudio');
  const facecamWrap = $('facecamWrap');
  const emptyGameplay = $('emptyGameplay');
  const facecamEmpty = $('facecamEmpty');

  if (!gameplayInput || !gameplayVideo) return;

  const state = {
    gameplayFile: null,
    facecamFile: null,
    voiceFile: null,
    urls: {},
    duration: 0,
    intensity: 'youtube',
    silenceMode: 'balanced',
    shape: 'rounded',
    position: 'br',
    cuts: [],
    silenceCandidates: [],
    peaks: [],
    plan: [],
    analyzing: false,
    previewing: false,
    skipGuard: false
  };

  const formatTime = s => {
    if (!Number.isFinite(s)) return '—';
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
  };
  const formatBytes = n => {
    if (!Number.isFinite(n)) return '';
    const units=['B','KB','MB','GB']; let i=0,v=n;
    while(v>=1024&&i<units.length-1){v/=1024;i++;}
    return `${v.toFixed(v>=100||i===0?0:v>=10?1:2)} ${units[i]}`;
  };
  const revoke = key => {
    if (state.urls[key]) { URL.revokeObjectURL(state.urls[key]); delete state.urls[key]; }
  };

  function loadMedia(input, key, media, metaEl, emptyEl) {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      revoke(key);
      state[key + 'File'] = file;
      const url = URL.createObjectURL(file);
      state.urls[key] = url;
      media.src = url;
      media.load();
      if (emptyEl) emptyEl.style.display = 'none';
      metaEl.textContent = `${file.name} · ${formatBytes(file.size)} · loading…`;
      media.addEventListener('loadedmetadata', () => {
        metaEl.textContent = `${file.name} · ${formatBytes(file.size)} · ${formatTime(media.duration)}`;
        if (key === 'gameplay') {
          state.duration = Number(media.duration || 0);
          $('statDuration').textContent = formatTime(state.duration);
          $('timelineScale').lastElementChild.textContent = formatTime(state.duration);
          $('syncStatus').textContent = 'Gameplay master loaded. Facecam/voice will follow this timeline.';
          $('stageBadge').textContent = 'SYNC MASTER · LOADED';
        }
      }, {once:true});
      if (key === 'facecam') facecamVideo.muted = true;
      if (key === 'voice') voiceAudio.volume = 1;
      resetAnalysis();
    });
  }

  loadMedia(gameplayInput, 'gameplay', gameplayVideo, $('gameplayMeta'), emptyGameplay);
  loadMedia(facecamInput, 'facecam', facecamVideo, $('facecamMeta'), facecamEmpty);
  loadMedia(voiceInput, 'voice', voiceAudio, $('voiceMeta'), null);

  function syncFollowers(force=false) {
    const t = gameplayVideo.currentTime || 0;
    if (state.facecamFile && Number.isFinite(facecamVideo.duration)) {
      if (force || Math.abs((facecamVideo.currentTime || 0) - t) > .18) {
        try { facecamVideo.currentTime = Math.min(t, Math.max(0, facecamVideo.duration - .03)); } catch (_) {}
      }
    }
    if (state.voiceFile && Number.isFinite(voiceAudio.duration)) {
      if (force || Math.abs((voiceAudio.currentTime || 0) - t) > .18) {
        try { voiceAudio.currentTime = Math.min(t, Math.max(0, voiceAudio.duration - .03)); } catch (_) {}
      }
    }
  }

  gameplayVideo.addEventListener('play', async () => {
    syncFollowers(true);
    try { if (state.facecamFile) await facecamVideo.play(); } catch (_) {}
    try { if (state.voiceFile) { gameplayVideo.muted = true; await voiceAudio.play(); } } catch (_) {}
    $('playAllBtn').textContent = '❚❚ Pause synced';
  });
  gameplayVideo.addEventListener('pause', () => {
    facecamVideo.pause(); voiceAudio.pause();
    $('playAllBtn').textContent = '▶ Play synced';
    if (state.previewing) {
      $('stopPreviewBtn').disabled = true;
      $('previewEditBtn').disabled = !state.plan.length;
    }
  });
  gameplayVideo.addEventListener('ended', () => {
    state.previewing = false;
    $('stopPreviewBtn').disabled = true;
    $('previewEditBtn').disabled = !state.plan.length;
    $('previewEditBtn').textContent = '▶ Preview Auto Edit';
    $('stageBadge').textContent = 'SYNC MASTER · PREVIEW COMPLETE';
  });
  gameplayVideo.addEventListener('seeked', () => syncFollowers(true));
  gameplayVideo.addEventListener('timeupdate', () => {
    syncFollowers(false);
    if (!$('liveCutPreview').checked || !state.cuts.length || state.skipGuard) return;
    const t = gameplayVideo.currentTime;
    const cut = state.cuts.find(x => t >= x.start && t < x.end);
    if (cut && cut.end < state.duration - .05) {
      state.skipGuard = true;
      gameplayVideo.currentTime = cut.end;
      syncFollowers(true);
      $('stageBadge').textContent = `LINKED CUT · ${formatTime(cut.start)} → ${formatTime(cut.end)}`;
      setTimeout(() => { state.skipGuard=false; $('stageBadge').textContent='SYNC MASTER · CUT PREVIEW'; }, 180);
    }
  });

  $('playAllBtn').addEventListener('click', () => {
    if (!state.gameplayFile) return alert('Load gameplay first.');
    if (gameplayVideo.paused) gameplayVideo.play().catch(()=>{});
    else gameplayVideo.pause();
  });
  $('jumpStartBtn').addEventListener('click', () => {
    gameplayVideo.currentTime = 0; syncFollowers(true);
  });

  function bindSegment(groupId, dataName, stateKey) {
    const group = $(groupId);
    group?.addEventListener('click', e => {
      const b = e.target.closest(`button[data-${dataName}]`);
      if (!b) return;
      group.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      state[stateKey] = b.dataset[dataName];
      resetAnalysis();
    });
  }
  bindSegment('intensityGroup','intensity','intensity');
  bindSegment('silenceGroup','silence','silenceMode');
  $('allowGameplayCuts').addEventListener('change', resetAnalysis);

  $('shapeGroup').addEventListener('click', e => {
    const b=e.target.closest('[data-shape]'); if(!b)return;
    $('shapeGroup').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
    ['circle','rounded','square','hex'].forEach(s=>facecamWrap.classList.remove(`shape-${s}`));
    state.shape=b.dataset.shape; facecamWrap.classList.add(`shape-${state.shape}`);
  });
  $('positionGrid').addEventListener('click', e => {
    const b=e.target.closest('[data-pos]'); if(!b)return;
    $('positionGrid').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
    ['tl','tc','tr','ml','mc','mr','bl','bc','br'].forEach(p=>facecamWrap.classList.remove(`pos-${p}`));
    state.position=b.dataset.pos; facecamWrap.classList.add(`pos-${state.position}`);
  });

  function bindRange(id, valueId, suffix, apply) {
    const el=$(id), out=$(valueId);
    const run=()=>{out.textContent=`${el.value}${suffix}`; apply(Number(el.value));};
    el.addEventListener('input',run); run();
  }
  bindRange('faceSize','faceSizeValue','%',v=>facecamWrap.style.width=`${v}%`);
  bindRange('borderWidth','borderValue',' px',v=>facecamWrap.style.borderWidth=`${v}px`);
  bindRange('glow','glowValue','%',v=> {
    const a=(v/100)*.75;
    facecamWrap.style.boxShadow=v?`0 0 ${Math.round(12+v*.35)}px rgba(76,210,255,${a.toFixed(2)})`:'none';
  });
  $('borderColor').addEventListener('input',()=>facecamWrap.style.borderColor=$('borderColor').value);
  $('bgRemove').addEventListener('change',()=>facecamWrap.classList.toggle('bg-requested',$('bgRemove').checked));

  function applyFilters() {
    facecamVideo.style.filter=`brightness(${$('faceBright').value}%) contrast(${$('faceContrast').value}%) saturate(${$('faceSat').value}%)`;
    gameplayVideo.style.filter=`brightness(${$('gameBright').value}%) contrast(${$('gameContrast').value}%) saturate(${$('gameSat').value}%)`;
  }
  [['faceBright','faceBrightValue'],['faceContrast','faceContrastValue'],['faceSat','faceSatValue'],['gameBright','gameBrightValue'],['gameContrast','gameContrastValue'],['gameSat','gameSatValue']]
    .forEach(([id,out])=>$(id).addEventListener('input',()=>{ $(out).textContent=`${$(id).value}%`; applyFilters(); }));
  applyFilters();

  function resetAnalysis() {
    state.cuts=[]; state.silenceCandidates=[]; state.peaks=[]; state.plan=[]; state.previewing=false;
    $('statCuts').textContent='0'; $('statRemoved').textContent='0:00'; $('statPeaks').textContent='0';
    $('planCount').textContent='0 events';
    $('downloadPlanBtn').disabled=true;
    $('previewEditBtn').disabled=true;
    $('stopPreviewBtn').disabled=true;
    $('editActions').classList.add('hidden');
    renderTimeline();
    $('eventList').innerHTML='<div class="ge-empty-plan">Run analysis to create a linked cut + energy plan.</div>';
  }

  async function decodeAudioFromFile(file) {
    const buf = await file.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio is not supported in this browser.');
    const ctx = new Ctx();
    try { return await ctx.decodeAudioData(buf.slice(0)); }
    finally { try { await ctx.close(); } catch (_) {} }
  }

  function silenceConfig(mode) {
    if (mode === 'safe') return {thresholdDb:-45, minSilence:1.25, pad:.16};
    if (mode === 'aggressive') return {thresholdDb:-34, minSilence:.48, pad:.08};
    return {thresholdDb:-39, minSilence:.78, pad:.12};
  }

  function analyzeBuffer(audioBuffer) {
    const ch = audioBuffer.getChannelData(0);
    const sr = audioBuffer.sampleRate;
    const stepSec = .10;
    const step = Math.max(1, Math.floor(sr * stepSec));
    const frames = [];
    for (let i=0;i<ch.length;i+=step) {
      let sum=0, count=Math.min(step,ch.length-i);
      for (let j=0;j<count;j++) { const v=ch[i+j]; sum += v*v; }
      const rms=Math.sqrt(sum/Math.max(1,count));
      const db=20*Math.log10(Math.max(1e-7,rms));
      frames.push({t:i/sr,db,rms});
    }

    const cfg=silenceConfig(state.silenceMode);
    const cuts=[]; let start=null;
    for (let i=0;i<frames.length;i++) {
      const silent=frames[i].db < cfg.thresholdDb;
      if (silent && start===null) start=frames[i].t;
      const atEnd=i===frames.length-1;
      if ((!silent || atEnd) && start!==null) {
        const end=atEnd ? frames[i].t+stepSec : frames[i].t;
        if (end-start >= cfg.minSilence) {
          const s=Math.max(0,start+cfg.pad);
          const e=Math.min(audioBuffer.duration,end-cfg.pad);
          if (e-s >= .28) cuts.push({start:s,end:e,duration:e-s,reason:'voice_silence'});
        }
        start=null;
      }
    }

    const peakFloor = state.intensity==='clean'?-13:state.intensity==='insane'?-22:-17;
    const candidates=frames.filter((f,i)=>f.db>peakFloor && f.db>(frames[i-1]?.db??-99)+1.6 && f.db>=(frames[i+1]?.db??-99));
    candidates.sort((a,b)=>b.db-a.db);
    const peaks=[];
    for(const p of candidates){
      if(peaks.every(x=>Math.abs(x.t-p.t)>2.4)){
        peaks.push({time:p.t,db:p.db});
        if(peaks.length>=12)break;
      }
    }
    peaks.sort((a,b)=>a.time-b.time);
    return {cuts,peaks,duration:audioBuffer.duration,thresholdDb:cfg.thresholdDb};
  }

  function selectedSfx() {
    return [...document.querySelectorAll('.ge-sfx-grid input:checked')].map(x=>x.value);
  }

  function buildPlan(sourceLabel) {
    const plan=[];
    if (!state.voiceFile && !$('allowGameplayCuts').checked && state.silenceCandidates.length) {
      plan.push({
        time:0,
        type:'safety_notice',
        label:'Gameplay-audio silence protected',
        detail:`${state.silenceCandidates.length} quiet ranges were detected but NOT applied as cuts. Add a separate voice track or explicitly enable the experimental gameplay-audio fallback.`
      });
    }
    state.cuts.forEach(c=>plan.push({time:c.start,end:c.end,type:'linked_cut',label:'Linked silence cut',detail:`Remove ${c.duration.toFixed(2)}s from gameplay + facecam + voice`,source:sourceLabel}));
    state.peaks.forEach((p,i)=>{
      const tags=[];
      if($('autoReaction').checked && state.facecamFile) tags.push('facecam punch zoom');
      if($('gameZoom').checked) tags.push('gameplay zoom candidate');
      if($('soundDirector').checked){
        const sfx=selectedSfx();
        if(sfx.length) tags.push(`SFX candidate: ${sfx[i%sfx.length]}`);
      }
      if($('replay').checked && i%3===1) tags.push('replay / slow-motion candidate');
      plan.push({time:p.time,type:'energy_moment',label:'Energy spike candidate',detail:tags.length?tags.join(' · '):'Review for highlight/effect timing',db:Number(p.db.toFixed(1))});
    });
    if($('cta').checked && state.duration>30){
      [0.18,0.68].forEach((r,i)=>plan.push({time:state.duration*r,type:'cta_slot',label:i?'Follow / Subscribe CTA slot':'Like / Subscribe CTA slot',detail:'Animation slot only — final creative will be selected by the renderer.'}));
    }
    if($('captions').checked) plan.push({time:0,type:'backend_stage',label:'Auto captions requested',detail:'Requires speech transcription stage; not generated by this local lab.'});
    if($('bgRemove').checked) plan.push({time:0,type:'backend_stage',label:'Facecam background removal requested',detail:'Requires segmentation stage; preview badge marks the request but does not fake removal.'});
    plan.sort((a,b)=>a.time-b.time);
    state.plan=plan;
  }

  function renderTimeline() {
    const duration=state.duration||1;
    document.querySelectorAll('.ge-track-bar').forEach(bar=>bar.innerHTML='');
    ['gameplay','facecam','voice'].forEach(track=>{
      const bar=document.querySelector(`[data-track="${track}"]`);
      state.cuts.forEach(c=>{
        const block=document.createElement('i'); block.className='ge-cut-block';
        block.style.left=`${Math.max(0,c.start/duration*100)}%`;
        block.style.width=`${Math.max(.25,(c.end-c.start)/duration*100)}%`;
        block.title=`Linked cut ${formatTime(c.start)}–${formatTime(c.end)}`;
        bar.appendChild(block);
      });
    });
    const fx=document.querySelector('[data-track="fx"]');
    state.peaks.forEach(p=>{
      const m=document.createElement('i'); m.className='ge-peak-marker';
      m.style.left=`calc(${Math.max(0,p.time/duration*100)}% - 2px)`;
      m.title=`Energy candidate ${formatTime(p.time)}`;
      fx.appendChild(m);
    });
  }

  function renderEvents() {
    const el=$('eventList');
    if(!state.plan.length){el.innerHTML='<div class="ge-empty-plan">No events found.</div>';return;}
    el.innerHTML='';
    state.plan.forEach(ev=>{
      const row=document.createElement('div');
      row.className=`ge-event ${ev.type==='energy_moment'?'energy':''}`;
      const time=ev.end?`${formatTime(ev.time)}–${formatTime(ev.end)}`:formatTime(ev.time);
      row.innerHTML=`<time>${time}</time><div><b>${escapeHtml(ev.label)}</b><small>${escapeHtml(ev.detail)}</small></div><em>${escapeHtml(ev.type.replaceAll('_',' '))}</em>`;
      el.appendChild(row);
    });
    $('planCount').textContent=`${state.plan.length} events`;
  }

  const escapeHtml=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  $('analyzeBtn').addEventListener('click', async () => {
    if(state.analyzing)return;
    if(!state.gameplayFile)return alert('Load gameplay first.');
    state.analyzing=true; $('analyzeBtn').disabled=true; $('analyzeBtn').textContent='Analyzing audio…';
    $('analysisNote').textContent='Reading audio locally. Large files can take longer because the browser must decode the audio track.';
    try{
      const sourceFile=state.voiceFile||state.gameplayFile;
      const sourceLabel=state.voiceFile?'voice_track':'gameplay_audio_fallback';
      const buffer=await decodeAudioFromFile(sourceFile);
      const result=analyzeBuffer(buffer);
      const detectedCuts=result.cuts.filter(c=>c.start<state.duration||!state.duration);
      state.silenceCandidates=detectedCuts;
      const gameplayFallbackAllowed=Boolean(state.voiceFile || $('allowGameplayCuts').checked);
      state.cuts=gameplayFallbackAllowed ? detectedCuts : [];
      state.peaks=result.peaks.filter(p=>p.time<state.duration||!state.duration);
      if(!state.duration)state.duration=Math.min(result.duration,gameplayVideo.duration||result.duration);
      const removed=state.cuts.reduce((a,c)=>a+c.duration,0);
      buildPlan(sourceLabel);
      $('statDuration').textContent=formatTime(state.duration);
      $('statCuts').textContent=String(state.cuts.length);
      $('statRemoved').textContent=formatTime(removed);
      $('statPeaks').textContent=String(state.peaks.length);
      $('timelineScale').lastElementChild.textContent=formatTime(state.duration);
      renderTimeline();renderEvents();
      $('downloadPlanBtn').disabled=false;
      $('previewEditBtn').disabled=false;
      $('editActions').classList.remove('hidden');

      if (!state.voiceFile && !$('allowGameplayCuts').checked) {
        $('analysisNote').innerHTML=`Analysis complete using <b>gameplay audio</b>. ${state.silenceCandidates.length} quiet ranges were detected, but V38.1 protected them from automatic cutting because no separate voice track was loaded. Energy markers can still be reviewed.`;
        $('editActionNote').textContent=state.silenceCandidates.length
          ? `${state.silenceCandidates.length} gameplay-audio quiet ranges are protected. Add a voice track for safe linked silence cuts, or explicitly enable the experimental fallback.`
          : 'No safe linked cuts were created. You can still preview the synced layout and current visual settings.';
      } else {
        $('analysisNote').innerHTML=`Analysis complete using <b>${sourceLabel==='voice_track'?'the separate voice track':'the explicitly enabled gameplay-audio fallback'}</b>. Silence threshold: ${result.thresholdDb} dB. Red blocks are linked cuts on all synced tracks; cyan/violet markers are signal-energy candidates.`;
        $('editActionNote').textContent=state.cuts.length
          ? `${state.cuts.length} linked cuts will be skipped in the non-destructive preview across gameplay + facecam + voice.`
          : 'No linked silence cuts were found. Preview will still show the synced facecam layout and visual corrections.';
      }
      $('stageBadge').textContent=state.cuts.length?'SYNC MASTER · AUTO EDIT READY':'SYNC MASTER · PLAN READY';
      setTimeout(()=>$('editActions').scrollIntoView({behavior:'smooth',block:'nearest'}),80);
    }catch(err){
      console.error(err);
      $('analysisNote').textContent=`Could not decode the selected audio in this browser: ${err?.message||'Unknown error'}. Try a separate WAV/MP3/M4A voice track for the silence analyzer.`;
      alert('Audio analysis could not run. Try loading a separate voice track in WAV/MP3/M4A and analyze again.');
    }finally{
      state.analyzing=false;$('analyzeBtn').disabled=false;$('analyzeBtn').textContent='✦ Analyze & Build Edit Plan';
    }
  });

  $('previewEditBtn').addEventListener('click', async () => {
    if (!state.gameplayFile || !state.plan.length) return;
    state.previewing = true;
    $('liveCutPreview').checked = true;
    gameplayVideo.pause();
    gameplayVideo.currentTime = 0;
    syncFollowers(true);
    $('previewEditBtn').disabled = true;
    $('stopPreviewBtn').disabled = false;
    $('previewEditBtn').textContent = 'Previewing…';
    $('stageBadge').textContent = state.cuts.length ? 'AUTO EDIT PREVIEW · LINKED CUTS ON' : 'AUTO EDIT PREVIEW · SYNCED LAYOUT';
    document.querySelector('.ge-preview-panel')?.scrollIntoView({behavior:'smooth',block:'center'});
    try { await gameplayVideo.play(); }
    catch (_) {
      state.previewing = false;
      $('previewEditBtn').disabled = false;
      $('stopPreviewBtn').disabled = true;
      $('previewEditBtn').textContent = '▶ Preview Auto Edit';
    }
  });

  $('stopPreviewBtn').addEventListener('click', () => {
    gameplayVideo.pause();
    state.previewing = false;
    $('previewEditBtn').disabled = !state.plan.length;
    $('stopPreviewBtn').disabled = true;
    $('previewEditBtn').textContent = '▶ Preview Auto Edit';
    $('stageBadge').textContent = 'SYNC MASTER · PREVIEW STOPPED';
  });

  $('downloadPlanBtn').addEventListener('click',()=>{
    if(!state.plan.length)return;
    const payload={
      schema:'rivani.gaming-auto-editor.edit-plan.v38.1',
      createdAt:new Date().toISOString(),
      master:{duration:state.duration,gameplay:state.gameplayFile?.name||null,facecam:state.facecamFile?.name||null,voice:state.voiceFile?.name||null},
      settings:{
        editStyle:$('editStyle').value,intensity:state.intensity,silenceMode:state.silenceMode,
        facecam:{shape:state.shape,position:state.position,size:Number($('faceSize').value),borderWidth:Number($('borderWidth').value),borderColor:$('borderColor').value,glow:Number($('glow').value),backgroundRemovalRequested:$('bgRemove').checked},
        color:{facecam:{brightness:Number($('faceBright').value),contrast:Number($('faceContrast').value),saturation:Number($('faceSat').value)},gameplay:{brightness:Number($('gameBright').value),contrast:Number($('gameContrast').value),saturation:Number($('gameSat').value)}},
        soundDirector:$('soundDirector').checked,sfx:selectedSfx(),captionsRequested:$('captions').checked
      },
      cuts:state.cuts,
      protectedSilenceCandidates:(!state.voiceFile && !$('allowGameplayCuts').checked) ? state.silenceCandidates : [],
      gameplayFallbackCutsApplied:(!state.voiceFile && $('allowGameplayCuts').checked),
      energyCandidates:state.peaks,events:state.plan,
      note:'This is a V38.1 lab edit plan. Gameplay-audio silence is protected by default when no separate voice track is loaded. Semantic scene understanding and final rendering are not included yet.'
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='rivani-gaming-edit-plan-v38-1.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  });

  window.addEventListener('beforeunload',()=>Object.keys(state.urls).forEach(revoke));
})();
