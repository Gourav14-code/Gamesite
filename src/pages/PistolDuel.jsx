import React, { useEffect, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   PISTOL DUEL — Player vs CPU, 5 levels
   Canvas fills its container via absolute positioning + resize observer
   No roundRect, no deprecated APIs — works on all browsers
   ═══════════════════════════════════════════════════════════════════════ */

const LEVELS = [
  { level:1, cpuHp:1, cpuMs:2200, scatter:100, label:'Rookie'       },
  { level:2, cpuHp:2, cpuMs:1700, scatter:65,  label:'Gunner'       },
  { level:3, cpuHp:3, cpuMs:1300, scatter:38,  label:'Sharpshooter' },
  { level:4, cpuHp:4, cpuMs:1000, scatter:18,  label:'Marksman'     },
  { level:5, cpuHp:5, cpuMs:750,  scatter:6,   label:'Legendary'    },
];

let duelAudioCtx = null;
function getDuelAudio() {
  try {
    if (!duelAudioCtx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (A) duelAudioCtx = new A();
    }
    if (duelAudioCtx && duelAudioCtx.state === 'suspended') {
      duelAudioCtx.resume().catch(() => {});
    }
  } catch {}
  return duelAudioCtx;
}

function tone(f1, f2, dur) {
  try {
    const ctx = getDuelAudio();
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f1;
    if (f2) o.frequency.linearRampToValueAtTime(f2, ctx.currentTime + dur);
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch {}
}

function initState(li) {
  const lv = LEVELS[Math.min(li, LEVELS.length - 1)];
  return {
    lv,
    px: 0, py: 0,          // filled after first resize
    cx: 0, cy: 0,
    pAngle: 0, pSpin: 0, pvx: 0, pvy: 0,
    cAngle: Math.PI, cSpin: 0, cvx: 0, cvy: 0,
    pHp: 3, cHp: lv.cpuHp, cMaxHp: lv.cpuHp,
    pFlash: 0, cFlash: 0,
    pBullets: [], cBullets: [],
    particles: [],
    cTimer: lv.cpuMs,
    score: 0,
    initialized: false,
  };
}

// Draw a gun using only fillRect + arc (no roundRect)
function drawGun(ctx, x, y, angle, col, flash) {
  const GW = 52, GH = 20;
  const blink = flash > 0 && Math.floor(flash / 5) % 2 === 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = blink ? 0.25 : 1;

  // Glow
  ctx.shadowColor = col;
  ctx.shadowBlur = 15;

  // Body
  ctx.fillStyle = col;
  ctx.fillRect(-GW * 0.3, -GH / 2, GW * 0.65, GH);

  // Barrel
  ctx.fillRect(GW * 0.33, -5, GW * 0.6, 10);

  // Muzzle (circle)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(GW * 0.92, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Grip (darker)
  ctx.fillStyle = col === '#38bdf8' ? '#1e40af' : '#7f1d1d';
  ctx.shadowBlur = 0;
  ctx.fillRect(-GW * 0.3, 2, GW * 0.22, GH - 2);

  // Shine
  ctx.globalAlpha = blink ? 0 : 0.22;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-GW * 0.26, -GH / 2 + 2, GW * 0.5, 4);

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

export default function PistolDuel({ onClose }) {
  const canvasRef  = useRef(null);
  const wrapRef    = useRef(null);
  const rafRef     = useRef(null);
  const loopRef    = useRef(null);
  const stateRef   = useRef(null);
  const phaseRef   = useRef('menu');
  const lvlRef     = useRef(0);
  const sizeRef    = useRef({ W: 580, H: 400 });

  const [phase,   setPhase]   = useState('menu');
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const check = () => setIsPortrait(window.innerWidth < window.innerHeight && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const [lvlIdx,  setLvlIdx]  = useState(0);
  const [hud,     setHud]     = useState({ pHp:3, cHp:1, cMax:1, lvl:1, label:'Rookie', score:0 });
  const [overlay, setOverlay] = useState(null);

  const syncPhase = p => { phaseRef.current = p; setPhase(p); };

  // ── Resize canvas to fill wrapper ──────────────────────────────────────────
  const resize = () => {
    const c = canvasRef.current, w = wrapRef.current;
    if (!c || !w) return;
    const rect = w.getBoundingClientRect();
    const width = Math.floor(rect.width || w.clientWidth || 580);
    const height = Math.floor(rect.height || w.clientHeight || 400);
    if (width > 0 && height > 0) {
      c.width = width;
      c.height = height;
      sizeRef.current = { W: width, H: height };
      const s = stateRef.current;
      if (s && !s.initialized) {
        s.px = width * 0.25;  s.py = height * 0.5;
        s.cx = width * 0.75;  s.cy = height * 0.5;
        s.initialized = true;
      }
    }
  };

  // ── Start level ────────────────────────────────────────────────────────────
  const startLevel = li => {
    const s = initState(li);
    const c = canvasRef.current;
    if (c) {
      s.px = c.width * 0.25;  s.py = c.height * 0.5;
      s.cx = c.width * 0.75;  s.cy = c.height * 0.5;
      s.initialized = true;
    }
    stateRef.current = s;
    lvlRef.current = li;
    setLvlIdx(li);
    setHud({ pHp:s.pHp, cHp:s.cHp, cMax:s.cMaxHp, lvl:s.lv.level, label:s.lv.label, score:0 });
    setOverlay(null);
    syncPhase('playing');
    if (!rafRef.current && loopRef.current) {
      rafRef.current = requestAnimationFrame(loopRef.current);
    }
  };

  // ── Shoot ──────────────────────────────────────────────────────────────────
  const shoot = (s, isPlayer, tx, ty) => {
    const ox = isPlayer ? s.px : s.cx;
    const oy = isPlayer ? s.py : s.cy;
    const dx = tx - ox, dy = ty - oy;
    const len = Math.sqrt(dx*dx+dy*dy) || 1;
    const nx = dx/len, ny = dy/len;
    const bArr = isPlayer ? s.pBullets : s.cBullets;
    bArr.push({ x: ox, y: oy, vx: nx*11, vy: ny*11 });
    // Recoil + directional spin
    const a = Math.atan2(ny, nx);
    const spin = (Math.sin(a) >= 0 ? -1 : 1) * (1.3 + Math.random()*0.3);
    if (isPlayer) {
      s.pvx -= nx * 7;  s.pvy -= ny * 7;
      s.pSpin = spin;
      tone(440, 80, 0.15);
    } else {
      s.cvx -= nx * 7;  s.cvy -= ny * 7;
      s.cSpin = -spin;
      tone(360, 65, 0.15);
    }
  };

  // ── Burst ──────────────────────────────────────────────────────────────────
  const burst = (s, x, y, col, n=18) => {
    for (let i=0; i<n; i++) {
      const a=Math.random()*Math.PI*2, sp=Math.random()*5+1.5;
      s.particles.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:1, col });
    }
  };

  // ── Handle click / tap ─────────────────────────────────────────────────────
  const getCanvasXY = (clientX, clientY) => {
    const c = canvasRef.current;
    if (!c) return [0,0];
    const r = c.getBoundingClientRect();
    return [clientX - r.left, clientY - r.top];
  };

  const handleClick = e => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current; if (!s) return;
    const [mx, my] = getCanvasXY(e.clientX, e.clientY);
    shoot(s, true, mx, my);
  };
  const handleTouch = e => {
    if (phaseRef.current !== 'playing') return;
    e.preventDefault();
    const t = e.changedTouches[0];
    const [mx, my] = getCanvasXY(t.clientX, t.clientY);
    const s = stateRef.current; if (!s) return;
    shoot(s, true, mx, my);
  };

  // ── Main render loop (runs once, reads from refs) ─────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let last = 0;

    const loop = ts => {
      const dt = Math.min((ts - (last||ts))/1000, 0.05);
      last = ts;

      const { W, H } = sizeRef.current;
      const s = stateRef.current;

      // ── Background ──────────────────────────────────────────────────────
      const bg = ctx.createLinearGradient(0,0,W,H);
      bg.addColorStop(0,'#0f172a'); bg.addColorStop(1,'#1e1b4b');
      ctx.fillStyle = bg;
      ctx.fillRect(0,0,W,H);

      // Grid lines
      ctx.strokeStyle='rgba(56,189,248,0.06)'; ctx.lineWidth=1;
      for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

      // Arena border
      ctx.strokeStyle='rgba(56,189,248,0.55)'; ctx.lineWidth=3;
      ctx.strokeRect(3,3,W-6,H-6);
      ctx.strokeStyle='rgba(56,189,248,0.1)'; ctx.lineWidth=14;
      ctx.strokeRect(3,3,W-6,H-6);

      // Centre dash
      ctx.setLineDash([8,12]); ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
      ctx.setLineDash([]);

      if (!s) { rafRef.current = requestAnimationFrame(loop); return; }

      // ── CPU AI shoot ─────────────────────────────────────────────────────
      if (phaseRef.current === 'playing') {
        s.cTimer -= dt * 1000;
        if (s.cTimer <= 0) {
          const sc = s.lv.scatter;
          shoot(s, false, s.px+(Math.random()-.5)*sc, s.py+(Math.random()-.5)*sc);
          s.cTimer = s.lv.cpuMs + (Math.random()-.5)*400;
        }
      }

      // ── Gun physics ───────────────────────────────────────────────────────
      const GW=52, GH=20;
      const moveGun = isP => {
        let x=isP?s.px:s.cx, y=isP?s.py:s.cy;
        let vx=isP?s.pvx:s.cvx, vy=isP?s.pvy:s.cvy;
        let spin=isP?s.pSpin:s.cSpin;
        vx*=0.87; vy*=0.87; spin*=0.84;
        x+=vx; y+=vy;
        const hw=GW/2, hh=GH/2;
        if(x-hw<4){x=hw+4; vx=Math.abs(vx)*0.6; spin*=-0.5;}
        if(x+hw>W-4){x=W-hw-4; vx=-Math.abs(vx)*0.6; spin*=-0.5;}
        if(y-hh<4){y=hh+4; vy=Math.abs(vy)*0.6; spin*=-0.5;}
        if(y+hh>H-4){y=H-hh-4; vy=-Math.abs(vy)*0.6; spin*=-0.5;}
        if(isP){s.px=x;s.py=y;s.pvx=vx;s.pvy=vy;s.pSpin=spin;s.pAngle+=spin;}
        else   {s.cx=x;s.cy=y;s.cvx=vx;s.cvy=vy;s.cSpin=spin;s.cAngle+=spin;}
      };
      moveGun(true); moveGun(false);

      // ── Bullets ───────────────────────────────────────────────────────────
      const moveBullets = (bullets, isPlayerBullet) => {
        for (let i=bullets.length-1; i>=0; i--) {
          const b=bullets[i];
          b.x+=b.vx; b.y+=b.vy;
          if(b.x<4||b.x>W-4){b.vx*=-0.8; burst(s,b.x,b.y,'#fde68a',4);}
          if(b.y<4||b.y>H-4){b.vy*=-0.8; burst(s,b.x,b.y,'#fde68a',4);}
          b.x=Math.max(4,Math.min(W-4,b.x));
          b.y=Math.max(4,Math.min(H-4,b.y));
          if(Math.hypot(b.vx,b.vy)<0.5){bullets.splice(i,1);continue;}
          if(phaseRef.current!=='playing') continue;
          const tx=isPlayerBullet?s.cx:s.px, ty=isPlayerBullet?s.cy:s.py;
          if(Math.hypot(b.x-tx,b.y-ty)<30){
            bullets.splice(i,1);
            burst(s,tx,ty,isPlayerBullet?'#38bdf8':'#ef4444',24);
            tone(660,110,0.22);
            const a=Math.atan2(b.vy,b.vx);
            const hSpin=(Math.sin(a)>=0?-1:1)*2.8;
            if(isPlayerBullet){
              s.cHp=Math.max(0,s.cHp-1);
              s.cFlash=28; s.cSpin=hSpin;
              s.cvx+=b.vx*0.6; s.cvy+=b.vy*0.6;
              s.score+=100;
              setHud(h=>({...h,cHp:s.cHp,score:s.score}));
              if(s.cHp<=0){
                burst(s,tx,ty,'#fbbf24',40);
                tone(880,1760,0.45);
                phaseRef.current='overlay';
                setPhase('overlay');
                setOverlay(lvlRef.current+1>=LEVELS.length?'win':'levelclear');
                setHud(h=>({...h,cHp:0,score:s.score}));
              }
            } else {
              s.pHp=Math.max(0,s.pHp-1);
              s.pFlash=32; s.pSpin=-hSpin;
              s.pvx+=b.vx*0.6; s.pvy+=b.vy*0.6;
              setHud(h=>({...h,pHp:s.pHp}));
              if(s.pHp<=0){
                burst(s,tx,ty,'#f87171',40);
                tone(280,55,0.5);
                phaseRef.current='overlay';
                setPhase('overlay');
                setOverlay('gameover');
                setHud(h=>({...h,pHp:0}));
              }
            }
          }
        }
      };
      moveBullets(s.pBullets,true); moveBullets(s.cBullets,false);
      if(s.pFlash>0) s.pFlash--;
      if(s.cFlash>0) s.cFlash--;

      // ── Particles ─────────────────────────────────────────────────────────
      s.particles=s.particles.filter(p=>p.life>0);
      s.particles.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.vx*=0.92; p.vy*=0.92; p.life-=0.035;
        ctx.globalAlpha=p.life;
        ctx.fillStyle=p.col;
        ctx.beginPath(); ctx.arc(p.x,p.y,3.5*p.life+0.5,0,Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha=1;

      // ── Draw bullets ──────────────────────────────────────────────────────
      [...s.pBullets.map(b=>({b,col:'#fbbf24'})), ...s.cBullets.map(b=>({b,col:'#fb923c'}))].forEach(({b,col})=>{
        ctx.shadowBlur=12; ctx.shadowColor=col;
        ctx.fillStyle=col;
        ctx.beginPath(); ctx.arc(b.x,b.y,5,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=0.35;
        ctx.beginPath(); ctx.arc(b.x-b.vx*1.6,b.y-b.vy*1.6,3,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1; ctx.shadowBlur=0;
      });

      // ── Draw guns ─────────────────────────────────────────────────────────
      drawGun(ctx, s.px, s.py, s.pAngle, '#38bdf8', s.pFlash);
      drawGun(ctx, s.cx, s.cy, s.cAngle, '#ef4444', s.cFlash);

      // Labels
      ctx.font=`bold ${Math.max(10,W*0.02)}px monospace`;
      ctx.textAlign='center';
      ctx.fillStyle='rgba(56,189,248,0.8)'; ctx.fillText('YOU',s.px,s.py-32);
      ctx.fillStyle='rgba(239,68,68,0.8)';  ctx.fillText('CPU',s.cx,s.cy-32);

      rafRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = loop;

    resize();
    rafRef.current = requestAnimationFrame(loop);

    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []); // single mount

  const lv = LEVELS[Math.min(lvlIdx, LEVELS.length-1)];

  return (
    <div className="flex flex-col w-full h-full bg-slate-950 overflow-hidden" style={{minHeight:0}}>
      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 flex-shrink-0 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-cyan-400 font-bold mr-1">YOU</span>
          {[0,1,2].map(i=><span key={i} className={`text-base ${i<hud.pHp?'text-cyan-400':'text-slate-700'}`}>♥</span>)}
        </div>
        <div className="text-center">
          <div className="text-yellow-400 font-bold text-xs">Lv.{hud.lvl} {hud.label}</div>
          <div className="text-slate-500 text-[10px]">Score {hud.score}</div>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(hud.cMax)].map((_,i)=><span key={i} className={`text-base ${i<hud.cHp?'text-red-400':'text-slate-700'}`}>♥</span>)}
          <span className="text-red-400 font-bold ml-1">CPU</span>
        </div>
      </div>

      {/* Canvas wrapper */}
      <div ref={wrapRef} className="flex-1 relative" style={{minHeight:0}}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onTouchStart={handleTouch}
          className="absolute inset-0 w-full h-full block"
          style={{ cursor: phase==='playing'?'crosshair':'default', touchAction:'none' }}
        />

        {isPortrait && (
          <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="text-5xl">🔄</div>
            <h3 className="text-xl font-bold text-white">Rotate to Landscape</h3>
            <p className="text-slate-400 text-sm">Pistol Duel plays best in landscape mode</p>
          </div>
        )}

        {/* MENU */}
        {phase==='menu' && (
          <div className="absolute inset-0 z-20 bg-slate-950/88 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
            <div className="text-5xl">🔫</div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center" style={{textShadow:'0 0 20px #38bdf8'}}>Pistol Duel</h2>
            <p className="text-slate-300 text-xs md:text-sm text-center max-w-xs">
              Tap / Click anywhere → shoot toward that point.<br/>Recoil spins gun in reverse. Beat CPU across 5 levels!
            </p>
            <button onClick={()=>startLevel(0)} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-8 py-3 rounded-2xl text-base hover:brightness-110 transition active:scale-95">
              ▶ START GAME
            </button>
            {onClose && <button onClick={onClose} className="text-slate-500 text-xs underline">Close</button>}
          </div>
        )}

        {/* LEVEL CLEAR */}
        {overlay==='levelclear' && (
          <div className="absolute inset-0 z-20 bg-slate-950/82 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
            <div className="text-5xl animate-bounce">🎉</div>
            <h2 className="text-3xl font-extrabold text-green-400" style={{textShadow:'0 0 20px #22c55e'}}>Level {hud.lvl} Clear!</h2>
            <p className="text-slate-300 text-sm">Score: <strong className="text-yellow-400">{hud.score}</strong></p>
            <button onClick={()=>startLevel(lvlIdx+1)} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-8 py-3 rounded-2xl text-base hover:brightness-110 transition active:scale-95">
              Next: {LEVELS[Math.min(lvlIdx+1,4)].label} →
            </button>
            {onClose && <button onClick={onClose} className="text-slate-500 text-xs underline mt-1">Exit</button>}
          </div>
        )}

        {/* WIN */}
        {overlay==='win' && (
          <div className="absolute inset-0 z-20 bg-slate-950/82 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
            <div className="text-5xl animate-bounce">🏆</div>
            <h2 className="text-3xl font-extrabold text-yellow-400" style={{textShadow:'0 0 20px #fbbf24'}}>YOU WIN!</h2>
            <p className="text-yellow-300 font-bold">All 5 levels cleared! Score: {hud.score}</p>
            <button onClick={()=>{setOverlay(null);syncPhase('menu');setLvlIdx(0);stateRef.current=null;}} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold px-8 py-3 rounded-2xl text-base hover:brightness-110">
              🔄 Play Again
            </button>
          </div>
        )}

        {/* GAME OVER */}
        {overlay==='gameover' && (
          <div className="absolute inset-0 z-20 bg-slate-950/82 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
            <div className="text-5xl">💀</div>
            <h2 className="text-3xl font-extrabold text-red-400" style={{textShadow:'0 0 20px #ef4444'}}>Game Over</h2>
            <p className="text-slate-300 text-sm">Score: <strong className="text-yellow-400">{hud.score}</strong></p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={()=>startLevel(lvlIdx)} className="bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold px-7 py-2.5 rounded-2xl hover:brightness-110 transition">
                🔄 Retry Lv.{hud.lvl}
              </button>
              <button onClick={()=>{setOverlay(null);syncPhase('menu');setLvlIdx(0);stateRef.current=null;}} className="bg-slate-700 text-white font-bold px-5 py-2.5 rounded-2xl hover:bg-slate-600">
                Menu
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 px-3 py-1 text-[10px] text-slate-500 flex justify-between">
        <span>🖱️ Click / 👆 Tap → Shoot · Gun spins opposite to shot</span>
        <span>Lv.{hud.lvl}/{LEVELS.length} · {lv.label}</span>
      </div>
    </div>
  );
}
