// JavaScript: controls the schedule, progress, and UI (externalized)
(() => {
  const STORAGE_KEY = 'office_micro_gym_v2';

  const DEFAULT = {
    startDate: '2025-08-20',
    totalDays: 12,
    skipWeekday: 0, // 0=Domingo, 6=Sábado, -1=no omitir
    times: ['8:30 AM','12:00 PM','4:00 PM'],
    rotation: ['Biceps Curl','Shoulder Press','Bent-over Row'],
    pushupMiddayProgressive: false,
    basePushups: 12,     // objetivo fijo push‑ups
    baseLifts: 12,       // objetivo fijo mancuerna (por brazo)
    progressiveMax: 12,  // tope para progresión 1→N
  };

  // State
  let state = load() || { version:1, cfg: DEFAULT, progress:{} };
  state.cfg = Object.assign({}, DEFAULT, state.cfg || {});
  state.achievements = state.achievements || { days:{}, weeks:{}, challenge12:false };
  state.gamify = state.gamify || { xpTotal: 0, xpToday: 0, lastXPDay: '', streak: 0, streakBest: 0, badges: {} };

  // Helpers
  function parseISO(s){ const [Y,M,D] = s.split('-').map(Number); return new Date(Y, M-1, D); }
  function d2iso(d){ return d.toISOString().slice(0,10); }
  function dateNice(iso){ const d = parseISO(iso); return d.toLocaleDateString(undefined,{ weekday:'short', month:'short', day:'numeric' }); }
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||''); }catch(e){ return null } }
  function todayIso(){ return d2iso(new Date()); }

  // Progress
  function getProgressFor(iso){
    return state.progress[iso] || (state.progress[iso] = {
      morning:{pushups:0,dumbR:0,dumbL:0},
      midday:{pushups:0,dumbR:0,dumbL:0},
      evening:{pushups:0,dumbR:0,dumbL:0},
    });
  }

  // Build sprint days
  function buildDays(){
    const days = [];
    const d0 = parseISO(state.cfg.startDate);
    let d = new Date(d0);
    let included = 0;
    let step = 0; // 0..N-1 progresión

    while(included < state.cfg.totalDays){
      const skip = Number(state.cfg.skipWeekday);
      if (skip >= 0 && d.getDay() === skip){ d.setDate(d.getDate()+1); continue; }

      const iso = d2iso(d);
      const maxProg = Number(state.cfg.progressiveMax || 12);
      const midProg = Math.min(maxProg, step+1);
      const puMid = state.cfg.pushupMiddayProgressive ? midProg : 0;
      const rot = state.cfg.rotation;
      const exName = rot && rot.length ? rot[included % rot.length] : 'Dumbbell';
      const P = Number(state.cfg.basePushups || 12);
      const L = Number(state.cfg.baseLifts || 12);

      days.push({
        iso,
        dow: d.getDay(),
        title: exName,
        targets: {
          morning: { pushups: P,      dumbR: L,      dumbL: L },
          midday:  { pushups: puMid,  dumbR: midProg, dumbL: midProg },
          evening: { pushups: midProg, dumbR: L,      dumbL: L },
        }
      });

      included++; step++;
      d.setDate(d.getDate()+1);
    }
    return days;
  }

  // Totals for achievements
  function totalsAll(){
    const ds = buildDays();
    let pu=0, lifts=0;
    ds.forEach(d=>{
      const pp = getProgressFor(d.iso);
      ['morning','midday','evening'].forEach(s=>{
        pu += pp[s].pushups;
        lifts += pp[s].dumbR + pp[s].dumbL;
      });
    });
    return {pu, lifts};
  }

  // XP
  function addXP(n){
    const g = (state.gamify ||= { xpTotal:0, xpToday:0, lastXPDay:'' });
    const t = todayIso();
    if (g.lastXPDay !== t){ g.xpToday = 0; g.lastXPDay = t; }
    g.xpToday += n; g.xpTotal += n; save();
  }

  // Achievements helpers
  function isDay100(day, pClamped){
    const total =
      day.targets.morning.pushups + day.targets.morning.dumbR + day.targets.morning.dumbL +
      day.targets.midday.pushups + day.targets.midday.dumbR + day.targets.midday.dumbL +
      day.targets.evening.pushups + day.targets.evening.dumbR + day.targets.evening.dumbL;
    const done =
      pClamped.morning.pushups + pClamped.morning.dumbR + pClamped.morning.dumbL +
      pClamped.midday.pushups + pClamped.midday.dumbR + pClamped.midday.dumbL +
      pClamped.evening.pushups + pClamped.evening.dumbR + pClamped.evening.dumbL;
    return total > 0 && done >= total;
  }
  function isFriday(day){ return parseISO(day.iso).getDay() === 5; }

  function celebrate(x,y,big=false){
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced){ toast('¡Objetivo alcanzado!'); return; }
    const boom = document.getElementById('boom');
    const colors = ['#56f0c4','#67ff9b','#8ef','#ffd166','#ff6b6b','#c084fc'];
    for(let i=0;i<(big?80:28);i++){
      const el = document.createElement('div');
      el.className='piece';
      const a = (Math.random()*Math.PI*2);
      const r = 20+Math.random()*60;
      el.style.setProperty('--x', Math.cos(a)*r+'px');
      el.style.setProperty('--y', Math.sin(a)*r+'px');
      el.style.left = x+'px'; el.style.top = y+'px';
      el.style.background = colors[i%colors.length];
      el.style.animationDelay = (Math.random()*80)+'ms';
      boom.appendChild(el);
      setTimeout(()=>el.remove(), 1000);
    }
  }
  function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2000); }
  function megaCelebrate(){
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    celebrate(cx, cy, true);
    setTimeout(()=>celebrate(cx-120, cy-60, true), 120);
    setTimeout(()=>celebrate(cx+120, cy+40, true), 220);
  }

  function renderSlot(key, whenLabel, day, prog){
    const tgt = day.targets[key];
    const el = document.createElement('div'); el.className='slot';
    const head = document.createElement('div'); head.className='slot-head';
    head.innerHTML = `<div class="when">${whenLabel}</div>`;
    const doneAll = (prog[key].pushups>=tgt.pushups && prog[key].dumbR>=tgt.dumbR && prog[key].dumbL>=tgt.dumbL && (tgt.pushups+tgt.dumbR+tgt.dumbL)>0);
    const doneDiv = document.createElement('div'); doneDiv.className='done'; doneDiv.innerHTML = doneAll? '✓ Completado' : '';
    head.appendChild(doneDiv); el.appendChild(head);

    el.appendChild(counterRow('Push‑ups', day.iso, key, 'pushups', tgt.pushups));
    el.appendChild(counterRow('Mancuerna (Der)', day.iso, key, 'dumbR', tgt.dumbR));
    el.appendChild(counterRow('Mancuerna (Izq)', day.iso, key, 'dumbL', tgt.dumbL));
    return el;
  }

  function counterRow(label, iso, slot, field, target){
    const row = document.createElement('div'); row.className='exercise';
    const lb = document.createElement('div'); lb.className='label'; lb.textContent = label + (target? '' : '');
    if(target===0){ lb.classList.add('strike'); }
    const tgt = document.createElement('div'); tgt.className='pill'; tgt.textContent = target>0? ('Meta: '+target) : '— sin objetivo —';
    const ctr = document.createElement('div'); ctr.className='counter';
    const less = document.createElement('button'); less.textContent='－';
    const span = document.createElement('span'); span.className='count';
    const more = document.createElement('button'); more.textContent='＋';
    const p = getProgressFor(iso);
    span.textContent = p[slot][field];

    less.onclick = ()=>{
      p[slot][field] = clamp(p[slot][field]-1, 0, 999);
      save(); span.textContent = p[slot][field];
    };
    more.onclick = (ev)=>{
      p[slot][field] = clamp(p[slot][field]+1, 0, 999);
      save(); span.textContent = p[slot][field];
      addXP(1);
      const rect = ev.target.getBoundingClientRect();
      celebrate(rect.left+rect.width/2, rect.top+rect.height/2, false);
      if(target>0 && p[slot][field]===target){ celebrate(rect.left+rect.width/2, rect.top+rect.height/2, true); toast('¡Objetivo alcanzado!'); }
      render();
    };

    ctr.appendChild(less); ctr.appendChild(span); ctr.appendChild(more);
    row.appendChild(lb); row.appendChild(tgt); row.appendChild(ctr);
    return row;
  }

  function render(){
    const root = document.getElementById('app');
    root.innerHTML = '';
    const days = buildDays();
    const today = todayIso();

    (function ensureXPBadge(){
      const t = document.querySelector('.title'); if(!t) return;
      if (t.querySelector('#xp-pill')) return;
      const g = state.gamify || { xpToday:0, xpTotal:0, lastXPDay: today };
      const goal = 100;
      const pill = document.createElement('span');
      pill.id = 'xp-pill';
      pill.className = 'badge';
      pill.title = 'XP diario / total';
      pill.textContent = `XP: ${g.xpToday}/${goal} · Total: ${g.xpTotal}`;
      t.appendChild(pill);
    })();

    days.forEach(day => {
      const p = getProgressFor(day.iso);
      const tSum =
        day.targets.morning.pushups + day.targets.morning.dumbR + day.targets.morning.dumbL +
        day.targets.midday.pushups + day.targets.midday.dumbR + day.targets.midday.dumbL +
        day.targets.evening.pushups + day.targets.evening.dumbR + day.targets.evening.dumbL;
      const pClamped = {
        morning:{ pushups: clamp(p.morning.pushups,0,day.targets.morning.pushups), dumbR: clamp(p.morning.dumbR,0,day.targets.morning.dumbR), dumbL: clamp(p.morning.dumbL,0,day.targets.morning.dumbL) },
        midday:{  pushups: clamp(p.midday.pushups,0,day.targets.midday.pushups),   dumbR: clamp(p.midday.dumbR,0,day.targets.midday.dumbR),   dumbL: clamp(p.midday.dumbL,0,day.targets.midday.dumbL) },
        evening:{ pushups: clamp(p.evening.pushups,0,day.targets.evening.pushups), dumbR: clamp(p.evening.dumbR,0,day.targets.evening.dumbR), dumbL: clamp(p.evening.dumbL,0,day.targets.evening.dumbL) },
      };
      const doneSum =
        pClamped.morning.pushups + pClamped.morning.dumbR + pClamped.morning.dumbL +
        pClamped.midday.pushups + pClamped.midday.dumbR + pClamped.midday.dumbL +
        pClamped.evening.pushups + pClamped.evening.dumbR + pClamped.evening.dumbL;
      const pct = Math.round((doneSum / (tSum||1)) * 100);

      const card = document.createElement('section');
      card.className='card';

      const head = document.createElement('div');
      head.className='card-head';
      const ring = document.createElement('div');
      ring.className='day-ring'; ring.style.setProperty('--pct', pct);
      ring.innerHTML = `<span style="position:absolute; font-size:11px">${pct}%</span>`;
      const info = document.createElement('div');
      info.className='day-info';
      info.innerHTML = `<div style="font-weight:700">${dateNice(day.iso)} ${day.iso===today?'<span class="pill" style="margin-left:6px">HOY</span>':''}</div>
                        <small>Mancuerna: ${day.title}</small>`;
      head.appendChild(ring); head.appendChild(info);
      card.appendChild(head);

      const wasDayAwarded = !!(state.achievements.days && state.achievements.days[day.iso]);
      const nowIs100 = isDay100(day, pClamped);
      if(nowIs100){
        info.innerHTML += ' <span class="pill" style="margin-left:6px;background:#123a2a;border-color:#1f6b4e;color:#a7ffcf">100%</span>';
      }
      if(nowIs100 && !wasDayAwarded){
        if(!state.achievements.days) state.achievements.days = {};
        state.achievements.days[day.iso] = true;
        save();
        toast('Day Master: ¡100% completado!');
        const rectBody = document.body.getBoundingClientRect();
        celebrate(rectBody.width/2, 120, true);

        if(isFriday(day)){
          if(!state.achievements.weeks) state.achievements.weeks = {};
          if(!state.achievements.weeks[day.iso]){
            state.achievements.weeks[day.iso] = true;
            save();
            toast('Week Finisher: ¡Viernes completado al 100%!');
            megaCelebrate();
          }
        }
      }

      card.appendChild(renderSlot('morning', state.cfg.times[0]||'8:30 AM', day, p));
      card.appendChild(renderSlot('midday',  state.cfg.times[1]||'12:00 PM', day, p));
      card.appendChild(renderSlot('evening', state.cfg.times[2]||'4:00 PM', day, p));

      const foot = document.createElement('div'); foot.className='footer';
      const resetBtn = document.createElement('button'); resetBtn.textContent='Reiniciar día';
      resetBtn.onclick=()=>{ state.progress[day.iso] = { morning:{pushups:0,dumbR:0,dumbL:0}, midday:{pushups:0,dumbR:0,dumbL:0}, evening:{pushups:0,dumbR:0,dumbL:0} }; save(); render(); toast('Progreso del día reiniciado'); };
      foot.appendChild(resetBtn);
      const hint = document.createElement('div'); hint.className='hint';
      hint.textContent = 'Completa objetivos para desbloquear confetti ✨';
      foot.appendChild(hint);
      card.appendChild(foot);

      root.appendChild(card);
    });

    const xpPill = document.getElementById('xp-pill');
    if (xpPill){
      const g = state.gamify || { xpToday:0, xpTotal:0, lastXPDay: today };
      const goal = 100;
      xpPill.textContent = `XP: ${g.xpToday}/${goal} · Total: ${g.xpTotal}`;
    }

    // Global streak across calendar days (skip configured rest day)
    function computeStreakGlobal(){
      const skip = Number(state.cfg.skipWeekday || -1);
      const oneDay = 24*60*60*1000;
      let d = new Date();
      let streak = 0;
      let guard = 0;

      while (guard++ < 2000){
        if (skip >= 0 && d.getDay() === skip){
          d = new Date(d.getTime() - oneDay);
          continue;
        }
        const iso = d2iso(d);
        const p = state.progress[iso];
        const active = p && (['morning','midday','evening'].some(s => {
          const x = p[s] || {pushups:0,dumbR:0,dumbL:0};
          return (x.pushups + x.dumbR + x.dumbL) > 0;
        }));
        if (!active) break;
        streak++;
        d = new Date(d.getTime() - oneDay);
      }
      return streak;
    }
    const st = computeStreakGlobal();
    state.gamify.streak = st;
    state.gamify.streakBest = Math.max(state.gamify.streakBest || 0, st);
    save();

    (function ensureStreakBadge(){
      const t = document.querySelector('.title'); if(!t) return;
      let b = document.getElementById('streak-badge');
      if(!b){ b = document.createElement('span'); b.id='streak-badge'; b.className='badge'; t.appendChild(b); }
      b.textContent = `🔥 Streak: ${state.gamify.streak} (mejor: ${state.gamify.streakBest})`;
    })();

    (function grantBadges(){
      const g = state.gamify || (state.gamify = {badges:{}});
      const b = g.badges || (g.badges = {});
      const a = state.achievements || {days:{}, weeks:{}, challenge12:false};
      const daysCount = Object.keys(a.days||{}).length;
      const weeksCount = Object.keys(a.weeks||{}).length;
      const { pu, lifts } = totalsAll();

      function give(key, msg){
        if(!b[key]){ b[key] = true; toast(msg); save(); }
      }

      if(daysCount >= 1) give('dayMaster', '🥉 Badge: Day Master');
      if(weeksCount >= 1) give('weekFinisher', '🥈 Badge: Week Finisher');
      if(a.challenge12) give('challenge12', '🥇 Badge: 12-Day Challenger');

      if(pu >= 50) give('pu50', '💪 Badge: 50 Push-ups');
      if(lifts >= 100) give('lifts100', '🏋️ Badge: 100 Lifts');

      if((g.streak||0) >= 7) give('streak7', '🔥 Badge: Streak 7');
      if((g.streak||0) >= 12) give('streak12', '🔥 Badge: Streak 12');
    })();
  }

  function openSettings(){
    const cfg = state.cfg;
    document.getElementById('cfg-start').value = cfg.startDate;
    document.getElementById('cfg-days').value = cfg.totalDays;
    document.getElementById('cfg-skip').value = String(cfg.skipWeekday);
    document.getElementById('cfg-rotation').value = (cfg.rotation||[]).join(', ');
    document.getElementById('cfg-midPU').checked = !!cfg.pushupMiddayProgressive;
    document.getElementById('cfg-t1').value = cfg.times[0]||'';
    document.getElementById('cfg-t2').value = cfg.times[1]||'';
    document.getElementById('cfg-t3').value = cfg.times[2]||'';
    document.getElementById('cfg-basePU').value = Number(cfg.basePushups || 12);
    document.getElementById('cfg-baseLifts').value = Number(cfg.baseLifts || 12);
    document.getElementById('cfg-progMax').value = Number(cfg.progressiveMax || 12);
    modal.showModal();
  }

  function saveSettings(){
    const s = document.getElementById('cfg-start').value || DEFAULT.startDate;
    const days = Number(document.getElementById('cfg-days').value||DEFAULT.totalDays);
    const skip = Number(document.getElementById('cfg-skip').value||0);
    const rot = document.getElementById('cfg-rotation').value.trim();
    const midPU = document.getElementById('cfg-midPU').checked;
    const t1 = document.getElementById('cfg-t1').value || DEFAULT.times[0];
    const t2 = document.getElementById('cfg-t2').value || DEFAULT.times[1];
    const t3 = document.getElementById('cfg-t3').value || DEFAULT.times[2];
    const basePU = Number(document.getElementById('cfg-basePU').value || DEFAULT.basePushups);
    const baseLifts = Number(document.getElementById('cfg-baseLifts').value || DEFAULT.baseLifts);
    const progMax = Number(document.getElementById('cfg-progMax').value || DEFAULT.progressiveMax);

    state.cfg = {
      startDate:s,
      totalDays:days,
      skipWeekday:skip,
      rotation: rot? rot.split(',').map(x=>x.trim()).filter(Boolean): DEFAULT.rotation,
      pushupMiddayProgressive: midPU,
      times:[t1,t2,t3],
      basePushups: basePU,
      baseLifts: baseLifts,
      progressiveMax: progMax,
    };
    save(); modal.close(); render(); toast('Configuración guardada');
  }

  function exportData(){
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'office-micro-gym-progress.json'; a.click();
    URL.revokeObjectURL(url);
  }
  function importData(){
    const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if(!f) return;
      const rd = new FileReader(); rd.onload = () => {
        try{
          const obj = JSON.parse(rd.result);
          if(obj && obj.cfg && obj.progress){
            obj.achievements = obj.achievements || { days:{}, weeks:{}, challenge12:false };
            obj.gamify = obj.gamify || { xpTotal: 0, xpToday: 0, lastXPDay: '', streak: 0, streakBest: 0, badges: {} };
            state = obj;
            state.cfg = Object.assign({}, DEFAULT, state.cfg || {});
            save(); render(); toast('Importado ✓');
          }
        } catch(e){ alert('Archivo no válido'); }
      }; rd.readAsText(f);
    }; inp.click();
  }

  function openAchievementsList(){
    const box = document.getElementById('achv-body');
    const a = state.achievements || {days:{}, weeks:{}, challenge12:false};
    const daysCount = Object.keys(a.days||{}).length;
    const weeksCount = Object.keys(a.weeks||{}).length;
    const g = state.gamify || { xpToday:0, xpTotal:0, streak:0, streakBest:0, badges:{} };
    const bd = g.badges || {};
    const {pu, lifts} = totalsAll();
    const items = [
      ['🥉 Day Master', !!bd.dayMaster || daysCount>0],
      ['🥈 Week Finisher', !!bd.weekFinisher || weeksCount>0],
      ['🥇 12-Day Challenger', !!bd.challenge12 || a.challenge12],
      ['💪 50 Push-ups', !!bd.pu50, `${pu} totales`],
      ['🏋️ 100 Lifts', !!bd.lifts100, `${lifts} totales`],
      ['🔥 Streak 7', !!bd.streak7, `${g.streak||0} actual`],
      ['🔥 Streak 12', !!bd.streak12, `${g.streak||0} actual`],
    ];
    box.innerHTML = `
      <div class="pill">XP hoy: <strong>${(g.xpToday||0)}</strong> · XP total: <strong>${(g.xpTotal||0)}</strong></div>
      <div class="pill">Racha: <strong>${(g.streak||0)}</strong> · Mejor: <strong>${(g.streakBest||0)}</strong></div>
      ${items.map(([label, ok, sub]) => `
        <div class="pill" style="display:flex; justify-content:space-between; gap:8px; ${ok?'background:#123a2a;border-color:#1f6b4e;color:#a7ffcf':''}">
          <span>${label}</span>
          <span>${ok?'✓':'—'} ${sub?`<span class="mini">${sub}</span>`:''}</span>
        </div>
      `).join('')}
    `;
    document.getElementById('achv-list').showModal();
  }

  // Init
  render();
  document.getElementById('btn-settings').onclick=openSettings;
  document.getElementById('cfg-save').onclick=saveSettings;
  document.getElementById('btn-export').onclick=exportData;
  document.getElementById('btn-import').onclick=importData;
  document.getElementById('btn-achv').onclick = openAchievementsList;
  document.getElementById('btn-reset').onclick=()=>{ if(confirm('¿Borrar configuración y progreso?')){ localStorage.removeItem(STORAGE_KEY); state = { version:1, cfg: DEFAULT, progress:{} }; state.cfg = Object.assign({}, DEFAULT, state.cfg || {}); render(); } };
})();


