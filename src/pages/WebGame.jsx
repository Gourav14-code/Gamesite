import React, { useState, useEffect, useRef, useCallback } from 'react';
import PistolDuel from './PistolDuel';
import BikeRacer  from './BikeRacer';

// ─── Game Catalog ────────────────────────────────────────────────────────────
const GAMES_DATA = [
  { id: 0, title: 'Pistol Duel',         category: 'Action', size: '2x2', color: 'from-slate-800 to-indigo-900', icon: 'fa-crosshairs',   likes: '99%', playable: true, duel: true  },
  { id:-1, title: '3D Bike Racer',       category: 'Racing', size: '2x2', color: 'from-blue-800 to-cyan-700',   icon: 'fa-motorcycle',   likes: '97%', playable: true, bike: true  },
  { id: 1, title: 'Pistol Target Shoot', category: 'Action', size: '2x1', color: 'from-red-500 to-amber-600',   icon: 'fa-gun',          likes: '98%', playable: true  },
  { id: 2, title: 'Subway Surfers',      category: 'Arcade', size: '1x2', color: 'from-emerald-400 to-teal-600', icon: 'fa-person-running',likes: '95%', playable: false },
  { id: 3, title: 'Speed Racer 3D',      category: 'Racing', size: '2x1', color: 'from-blue-600 to-indigo-700',  icon: 'fa-car-side',     likes: '92%', playable: false },
  { id: 4, title: 'Temple Dash',         category: 'Action', size: '1x1', color: 'from-yellow-500 to-amber-700', icon: 'fa-person-hiking', likes: '91%', playable: false },
  { id: 5, title: 'Slither Snake',       category: 'Arcade', size: '1x1', color: 'from-purple-500 to-pink-600',  icon: 'fa-staff-snake',  likes: '89%', playable: false },
  { id: 6, title: 'Brain Puzzle Deluxe', category: 'Puzzle', size: '2x1', color: 'from-cyan-500 to-blue-500',   icon: 'fa-brain',        likes: '96%', playable: false },
  { id: 7, title: 'Ludo Master',         category: 'Puzzle', size: '1x1', color: 'from-rose-500 to-red-600',    icon: 'fa-dice',         likes: '88%', playable: false },
  { id: 8, title: 'Zombie Survival',     category: 'Action', size: '1x2', color: 'from-stone-700 to-slate-900', icon: 'fa-biohazard',    likes: '94%', playable: false },
  { id: 9, title: 'Fruit Ninja Slash',   category: 'Arcade', size: '1x1', color: 'from-lime-500 to-emerald-600',icon: 'fa-apple-whole',  likes: '93%', playable: false },
  { id:10, title: 'Super Bike Stunts',   category: 'Racing', size: '2x1', color: 'from-orange-500 to-red-600',  icon: 'fa-motorcycle',   likes: '90%', playable: false },
  { id:11, title: 'Tic Tac Toe Pro',     category: 'Puzzle', size: '1x1', color: 'from-indigo-500 to-purple-600',icon: 'fa-xmarks-lines', likes: '85%', playable: false },
  { id:12, title: 'Highway Moto',        category: 'Racing', size: '1x1', color: 'from-sky-400 to-blue-600',    icon: 'fa-gauge-high',   likes: '87%', playable: false },
];

// ─── Size → tailwind col/row span ────────────────────────────────────────────
const SPAN_MAP = {
  '1x1': 'col-span-1 row-span-1',
  '2x1': 'col-span-2 row-span-1',
  '1x2': 'col-span-1 row-span-2',
  '2x2': 'col-span-2 row-span-2',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Pistol Shoot – canvas game component
// ═══════════════════════════════════════════════════════════════════════════════
function PistolGame({ containerRef }) {
  const canvasRef   = useRef(null);
  const stateRef    = useRef(null);   // mutable game state
  const rafRef      = useRef(null);
  const timerRef    = useRef(null);
  const mouseRef    = useRef({ x: 0, y: 0 });

  const [phase, setPhase]   = useState('idle'); // idle | playing | over
  const [hud, setHud]       = useState({ score: 0, streak: 0, ammo: 6, time: 30 });
  const [finalStats, setFinalStats] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  const audioRef = useRef(null);

  // sync soundRef
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  // Audio helpers
  const getAudioCtx = () => {
    if (!audioRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioRef.current = new Ctx();
    }
    return audioRef.current;
  };

  const playTone = useCallback((freq1, freq2, dur, type = 'sawtooth', vol = 0.25) => {
    if (!soundRef.current) return;
    try {
      const ctx = getAudioCtx(); if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq1, ctx.currentTime);
      if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  }, []);

  // Resize canvas to container
  const resize = useCallback(() => {
    const c = canvasRef.current;
    const wrap = containerRef?.current || c?.parentElement;
    if (!c || !wrap) return;
    c.width  = wrap.clientWidth;
    c.height = wrap.clientHeight;
  }, [containerRef]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  // ── Game loop ──────────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    const s = stateRef.current;
    const c = canvasRef.current;
    if (!s || !c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const mx = mouseRef.current.x, my = mouseRef.current.y;

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Bullet holes
    s.holes = s.holes.filter(h => h.a > 0);
    s.holes.forEach(h => {
      ctx.beginPath(); ctx.arc(h.x, h.y, 4, 0, Math.PI*2);
      ctx.fillStyle = `rgba(0,0,0,${h.a})`; ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${h.a*0.3})`; ctx.stroke();
      h.a -= 0.005;
    });

    // Targets
    s.targets.forEach(t => {
      t.x += t.vx; t.y += t.vy;
      if (t.x - t.r < 0 || t.x + t.r > W) t.vx *= -1;
      if (t.y - t.r < 0 || t.y + t.r > H) t.vy *= -1;

      // Target rings
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2); ctx.fillStyle = '#ef4444'; ctx.fill();
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r*0.65, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r*0.3, 0, Math.PI*2); ctx.fillStyle = '#ef4444'; ctx.fill();
    });

    // Particles
    s.particles = s.particles.filter(p => p.a > 0);
    s.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.a -= 0.03;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(239,68,68,${p.a})`; ctx.fill();
    });

    // Crosshair
    ctx.save();
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI*2); ctx.fillStyle = '#ef4444'; ctx.fill();
    [[mx-25,my,mx-8,my],[mx+8,my,mx+25,my],[mx,my-25,mx,my-8],[mx,my+8,mx,my+25]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    ctx.restore();

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // ── Spawn target ──────────────────────────────────────────────────────────
  const spawnTarget = () => {
    const c = canvasRef.current;
    const r = Math.random()*15+20;
    const speed = Math.random()*2+1;
    const angle = Math.random()*Math.PI*2;
    stateRef.current.targets.push({
      x: Math.random()*(c.width-r*2)+r,
      y: Math.random()*(c.height-r*2)+r,
      r, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
    });
  };

  // ── Start ──────────────────────────────────────────────────────────────────
  const startGame = () => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);

    stateRef.current = { score:0, streak:0, shotsFired:0, shotsHit:0, ammo:6, timeLeft:30, targets:[], particles:[], holes:[] };
    setHud({ score:0, streak:0, ammo:6, time:30 });
    setFinalStats(null);
    setPhase('playing');

    for (let i=0; i<5; i++) spawnTarget();

    timerRef.current = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      s.timeLeft--;
      setHud(h => ({ ...h, time: s.timeLeft }));
      if (s.timeLeft <= 0) endGame();
    }, 1000);

    rafRef.current = requestAnimationFrame(loop);
  };

  // ── End ────────────────────────────────────────────────────────────────────
  const endGame = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    const s = stateRef.current;
    const acc = s.shotsFired > 0 ? Math.round((s.shotsHit/s.shotsFired)*100) : 0;
    setFinalStats({ score: s.score, accuracy: acc });
    setPhase('over');
  };

  // ── Shoot ──────────────────────────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    if (phase !== 'playing') return;
    const s = stateRef.current;
    const c = canvasRef.current;
    if (!s || !c) return;

    if (s.ammo <= 0) return;
    s.ammo--; s.shotsFired++;
    playTone(300, 0.01, 0.15);

    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    s.holes.push({ x: mx, y: my, a: 1 });

    let hit = false;
    for (let i = s.targets.length-1; i >= 0; i--) {
      const t = s.targets[i];
      if (Math.hypot(mx-t.x, my-t.y) < t.r) {
        hit = true; s.shotsHit++; s.streak++;
        const pts = Math.hypot(mx-t.x, my-t.y) < t.r*0.3 ? 150 : 100;
        s.score += pts * Math.min(s.streak, 5);
        playTone(800, 400, 0.1, 'sine', 0.2);
        // Particles
        for (let p=0; p<15; p++) {
          s.particles.push({ x:t.x, y:t.y, vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8, r:Math.random()*4+2, a:1 });
        }
        s.targets.splice(i, 1);
        spawnTarget();
        break;
      }
    }
    if (!hit) s.streak = 0;
    if (s.ammo === 0) { /* show prompt via state */ }

    setHud({ score: s.score, streak: s.streak, ammo: s.ammo, time: s.timeLeft });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, loop, playTone]);

  // ── Reload ─────────────────────────────────────────────────────────────────
  const reload = useCallback(() => {
    if (phase !== 'playing') return;
    const s = stateRef.current; if (!s) return;
    s.ammo = 6;
    playTone(200, 600, 0.2, 'triangle', 0.2);
    setHud(h => ({ ...h, ammo: 6 }));
  }, [phase, playTone]);

  // Keyboard R
  useEffect(() => {
    const onKey = (e) => { if ((e.key === 'r' || e.key === 'R') && phase === 'playing') reload(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, reload]);

  // Mouse tracking
  const onMouseMove = (e) => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div className="relative w-full h-full flex flex-col select-none" style={{ cursor: 'none' }}>
      <canvas
        ref={canvasRef}
        className="w-full flex-1 block"
        onMouseMove={onMouseMove}
        onClick={handleClick}
        style={{ cursor: 'none' }}
      />

      {/* HUD */}
      {phase === 'playing' && (
        <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none font-bold text-sm">
          <div className="bg-slate-900/85 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-3 text-white">
            <span><span className="text-slate-400 text-[10px] block">SCORE</span><span className="text-yellow-400 text-lg">{hud.score}</span></span>
            <span className="h-6 w-px bg-slate-700" />
            <span><span className="text-slate-400 text-[10px] block">STREAK</span><span className="text-cyan-400 text-lg">{hud.streak}x</span></span>
          </div>
          <div className="bg-slate-900/85 border border-slate-700 px-4 py-1.5 rounded-xl text-center text-white">
            <span className="text-slate-400 text-[10px] block">TIME</span>
            <span className="text-red-400 text-lg">{hud.time}s</span>
          </div>
          <div className="bg-slate-900/85 border border-slate-700 px-3 py-1.5 rounded-xl text-right text-white">
            <span className="text-slate-400 text-[10px] block">AMMO</span>
            <span className="text-emerald-400 text-lg">{hud.ammo}/6</span>
          </div>
        </div>
      )}

      {/* Out of ammo */}
      {phase === 'playing' && hud.ammo === 0 && (
        <button
          onClick={reload}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-red-600/90 text-white font-bold px-5 py-2 rounded-full shadow-lg border border-red-400 animate-pulse text-xs pointer-events-auto"
        >
          OUT OF AMMO! CLICK or [R] to Reload
        </button>
      )}

      {/* Sound toggle */}
      <button
        onClick={() => setSoundOn(s => !s)}
        className="absolute bottom-3 right-3 w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white pointer-events-auto transition"
      >
        <i className={`fa-solid ${soundOn ? 'fa-volume-high' : 'fa-volume-xmark text-red-400'} text-xs`} />
      </button>

      {/* Start / Game Over overlay */}
      {phase !== 'playing' && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white z-20">
          <div className="w-16 h-16 bg-gradient-to-tr from-red-500 to-orange-500 rounded-2xl flex items-center justify-center text-3xl shadow-2xl mb-4 border border-red-400/30">
            <i className="fa-solid fa-crosshairs" />
          </div>
          <h3 className="text-3xl font-extrabold mb-1" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            {phase === 'over' ? "Time's Up!" : 'Pistol Target Shoot'}
          </h3>
          <p className="text-slate-300 text-sm mb-5 max-w-xs">
            {phase === 'over'
              ? 'Check your results below!'
              : 'Shoot the bullseyes! Aim with mouse, click to fire, [R] to reload.'}
          </p>

          {phase === 'over' && finalStats && (
            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-5 bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div><span className="text-[10px] text-slate-400 block">FINAL SCORE</span><span className="text-2xl font-bold text-yellow-400">{finalStats.score}</span></div>
              <div><span className="text-[10px] text-slate-400 block">ACCURACY</span><span className="text-2xl font-bold text-cyan-400">{finalStats.accuracy}%</span></div>
            </div>
          )}

          <button
            onClick={startGame}
            className="bg-gradient-to-r from-red-500 to-orange-500 hover:brightness-110 text-white text-base font-bold px-8 py-3 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <i className={`fa-solid ${phase === 'over' ? 'fa-rotate-right' : 'fa-play'}`} />
            {phase === 'over' ? 'PLAY AGAIN' : 'START SHOOTING'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Animated mini-preview for Pistol Duel card (Authentic Game Visuals) ──────
function DuelPreviewCanvas() {
  const ref = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;

    const state = {
      p: { x: W * 0.25, y: H * 0.5, vx: 0.7, vy: 0.35, a: 0, spin: 0.02 },
      e: { x: W * 0.75, y: H * 0.5, vx: -0.65, vy: -0.4, a: Math.PI, spin: -0.02 },
      bullets: [],
      particles: [],
      t: 0,
    };

    const draw = () => {
      state.t++;
      // Arena background
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Arena grid lines (matches actual game)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Center dash line
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.setLineDash([]);

      // Arena glowing border
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, W - 4, H - 4);

      const moveDot = (d) => {
        d.x += d.vx; d.y += d.vy; d.a += d.spin;
        if (d.x < 24 || d.x > W - 24) { d.vx *= -1; d.spin *= -1; }
        if (d.y < 20 || d.y > H - 20) { d.vy *= -1; d.spin *= -1; }
      };
      moveDot(state.p); moveDot(state.e);

      // Spawn authentic bullets
      if (state.t % 50 === 0) {
        const dx = state.e.x - state.p.x, dy = state.e.y - state.p.y;
        const l = Math.sqrt(dx * dx + dy * dy) || 1;
        state.bullets.push({ x: state.p.x, y: state.p.y, vx: (dx / l) * 3.5, vy: (dy / l) * 3.5, c: '#fbbf24' });
        state.bullets.push({ x: state.e.x, y: state.e.y, vx: -(dx / l) * 3.5, vy: -(dy / l) * 3.5, c: '#fb923c' });
      }

      state.bullets = state.bullets.filter(b => b.x > 0 && b.x < W && b.y > 0 && b.y < H);
      state.bullets.forEach(b => {
        b.x += b.vx; b.y += b.vy;
        ctx.shadowBlur = 8;
        ctx.shadowColor = b.c;
        ctx.fillStyle = b.c;
        ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Authentic Gun drawing function matching PistolDuel.jsx
      const drawActualGun = (x, y, angle, col) => {
        const GW = 34, GH = 13;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.shadowColor = col;
        ctx.shadowBlur = 12;
        // Body
        ctx.fillStyle = col;
        ctx.fillRect(-GW * 0.3, -GH / 2, GW * 0.65, GH);
        // Barrel
        ctx.fillRect(GW * 0.33, -3.5, GW * 0.6, 7);
        // Muzzle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(GW * 0.92, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        // Grip
        ctx.fillStyle = col === '#22c55e' ? '#14532d' : '#7f1d1d';
        ctx.shadowBlur = 0;
        ctx.fillRect(-GW * 0.3, 1.5, GW * 0.22, GH - 1.5);
        ctx.restore();
      };

      drawActualGun(state.p.x, state.p.y, state.p.a, '#22c55e');
      drawActualGun(state.e.x, state.e.y, state.e.a, '#ef4444');

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  return <canvas ref={ref} width={260} height={160} className="w-full h-full rounded-2xl opacity-85 group-hover:opacity-100 transition-opacity" />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Game Card
// ═══════════════════════════════════════════════════════════════════════════════
function GameCard({ game, onOpen }) {
  // Special Pistol Duel card with live animated preview
  if (game.duel) {
    return (
      <div
        className={`relative rounded-3xl overflow-hidden cursor-pointer shadow-xl group transition-all duration-250 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl hover:z-10 ${SPAN_MAP[game.size] || 'col-span-1 row-span-1'}`}
        onClick={() => onOpen(game)}
        style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#0f172a 60%,#1e3a5f 100%)' }}
      >
        {/* Animated preview canvas */}
        <div className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none">
          <DuelPreviewCanvas />
        </div>
        {/* Overlay with game info */}
        <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/40">
          <div className="flex items-center justify-between">
            <span className="bg-cyan-400 text-slate-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-cyan-400/30 animate-pulse">
              🔫 #1 HOT
            </span>
            <span className="text-white/80 text-xs font-semibold bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm">{game.category}</span>
          </div>
          <div>
            <h3 className="text-white font-extrabold text-lg drop-shadow-lg mb-0.5" style={{ fontFamily: 'Fredoka, sans-serif', textShadow: '0 0 15px #38bdf8' }}>
              Pistol Duel
            </h3>
            <p className="text-slate-300 text-[11px] mb-2">Player vs CPU · 5 Levels · Recoil Physics</p>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs"><i className="fa-solid fa-thumbs-up text-xs mr-1 text-cyan-400" />{game.likes}</span>
              <span className="bg-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-xl shadow flex items-center gap-1">
                <i className="fa-solid fa-play text-[10px]" /> Play
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Bike Racer card (Lightweight Gameplay GIF & Authentic Poster) ──────────────
  if (game.bike) {
    return (
      <div
        className={`relative rounded-3xl overflow-hidden cursor-pointer shadow-xl group transition-all duration-250 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl hover:z-10 ${SPAN_MAP[game.size] || 'col-span-1 row-span-1'}`}
        onClick={() => onOpen(game)}
        style={{ background: '#020617' }}
      >
        {/* Animated 3D Gameplay GIF (Lightweight, zero video decoding overhead) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
          <img
            src="/videos/bike_preview.gif"
            alt="3D Bike Racer"
            loading="eager"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* Info overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-slate-950/95 via-slate-950/20 to-slate-950/40">
          <div className="flex items-center justify-between">
            <span className="bg-gradient-to-r from-orange-400 to-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-orange-500/40 animate-pulse">
              🏍️ #2 3D RACER
            </span>
            <span className="text-white/90 text-xs font-semibold bg-black/40 px-2.5 py-0.5 rounded-full backdrop-blur-md border border-white/10">{game.category}</span>
          </div>
          <div>
            <h3 className="text-white font-extrabold text-lg drop-shadow-lg mb-0.5" style={{ fontFamily: 'Fredoka, sans-serif', textShadow: '0 0 15px #f97316' }}>
              3D Bike Racer
            </h3>
            <p className="text-slate-300 text-[11px] mb-2 font-medium">Traffic Rider 3D · Cockpit View · Nitro Rush</p>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs"><i className="fa-solid fa-thumbs-up text-xs mr-1 text-orange-400" />{game.likes}</span>
              <span className="bg-gradient-to-r from-orange-500 to-rose-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-lg shadow-orange-500/30 flex items-center gap-1.5 hover:brightness-110">
                <i className="fa-solid fa-gauge-high text-[11px]" /> Race
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard card
  return (
    <div
      className={`relative rounded-3xl overflow-hidden cursor-pointer shadow-lg group transition-all duration-250 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl hover:z-10 ${SPAN_MAP[game.size] || 'col-span-1 row-span-1'}`}
      onClick={() => onOpen(game)}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${game.color} p-4 flex flex-col justify-between`}>
        <div className="flex items-center justify-between z-10">
          {game.playable && (
            <span className="bg-yellow-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow">PLAY NOW</span>
          )}
          <span className="text-white/80 text-xs font-semibold bg-black/20 px-2 py-0.5 rounded-full backdrop-blur-sm ml-auto">{game.category}</span>
        </div>
        <div className="my-auto text-center flex flex-col items-center gap-2">
          <i className={`fa-solid ${game.icon} text-white text-3xl md:text-5xl drop-shadow-md group-hover:scale-110 transition-transform`} />
          <h3 className="text-white font-bold text-sm md:text-base leading-tight drop-shadow" style={{ fontFamily: 'Fredoka, sans-serif' }}>{game.title}</h3>
        </div>
        <div className="flex items-center justify-between text-white/90 text-xs z-10 font-medium">
          <span><i className="fa-solid fa-thumbs-up text-xs mr-1" />{game.likes}</span>
          <span className="bg-white/20 p-1.5 rounded-xl group-hover:bg-white group-hover:text-slate-900 transition-colors"><i className="fa-solid fa-play text-xs" /></span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main WebGame Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function WebGame({ onLaunchBike }) {
  const [query,    setQuery]    = useState('');
  const [category, setCategory] = useState('all');
  const [modal,    setModal]    = useState(null); // game object or null
  const [fullscreen, setFullscreen] = useState(false);
  const [likedGames, setLikedGames] = useState({});
  const [reportedGame, setReportedGame] = useState(null);
  const gameAreaRef = useRef(null);

  const categories = ['all', 'Action', 'Racing', 'Puzzle', 'Arcade'];
  const catEmoji   = { all:'🔥', Action:'🎯', Racing:'🏎️', Puzzle:'🧩', Arcade:'🕹️' };

  const filtered = GAMES_DATA.filter(g => {
    const matchCat = category === 'all' || g.category === category;
    const matchQ   = g.title.toLowerCase().includes(query.toLowerCase()) ||
                     g.category.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  const openModal = (game) => {
    if (game.bike && onLaunchBike) {
      onLaunchBike();
      return;
    }
    setModal(game);
  };
  const closeModal = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setModal(null);
    setFullscreen(false);
  };

  const toggleFullscreen = () => {
    const el = gameAreaRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* Google Fonts (Fredoka) */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="min-h-screen p-3 md:p-6 text-slate-800"
        style={{ background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)', backgroundAttachment: 'fixed' }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="max-w-[1400px] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 bg-white/90 backdrop-blur-md p-3 md:p-4 rounded-3xl shadow-xl border border-white/40">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="bg-gradient-to-r from-pink-500 to-yellow-400 text-white font-bold text-3xl px-4 py-1.5 rounded-2xl shadow-md tracking-wider -rotate-2 hover:rotate-0 transition-transform cursor-pointer select-none"
              style={{ fontFamily: 'Fredoka, sans-serif' }}
              onClick={() => setCategory('all')}
            >
              poki
            </div>
            <span className="hidden sm:inline-block bg-sky-100 text-sky-700 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">Play Free</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md mx-2">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 1,000+ free games..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-100 focus:bg-white rounded-2xl outline-none border-2 border-transparent focus:border-cyan-400 text-sm transition-all font-medium text-slate-700 shadow-inner"
              />
            </div>
          </div>

          {/* All Games + Featured */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCategory('all'); setQuery(''); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              <i className="fa-solid fa-house text-[11px]" /> All Games
            </button>
            <button
              onClick={() => openModal(GAMES_DATA[0])}
              className="hidden md:flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white px-4 py-2.5 rounded-2xl font-bold text-sm shadow-md transition-all hover:scale-105"
            >
              <i className="fa-solid fa-crosshairs" /> Play Featured
            </button>
          </div>
        </header>

        {/* ── Category Filters ─────────────────────────────────────────────── */}
        <nav className="max-w-[1400px] mx-auto mb-6 flex items-center gap-2 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border-2 ${
                category === cat
                  ? 'bg-white text-slate-800 border-white shadow-md'
                  : 'bg-white/40 text-slate-900 border-white/20 hover:bg-white backdrop-blur-sm'
              }`}
            >
              {catEmoji[cat]} {cat === 'all' ? 'Hot Games' : cat}
            </button>
          ))}
        </nav>

        {/* ── Bento Grid ───────────────────────────────────────────────────── */}
        <main className="max-w-[1400px] mx-auto">
          <div
            className="grid gap-3 md:gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gridAutoRows: '130px',
              gridAutoFlow: 'dense',
            }}
          >
            {filtered.map(game => (
              <GameCard key={game.id} game={game} onOpen={openModal} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-20 text-white/70 text-sm">
                No games found for "<strong>{query || category}</strong>"
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-0 sm:p-2 md:p-4 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          {modal.duel ? (
            <div className="w-full max-w-5xl h-full max-h-[700px] flex items-center justify-center p-0">
              <PistolDuel
                onClose={closeModal}
                onToggleFullscreen={toggleFullscreen}
                isFullscreen={fullscreen}
                isLiked={!!likedGames[modal.id]}
                onToggleLike={() => setLikedGames(prev => ({ ...prev, [modal.id]: !prev[modal.id] }))}
                onReport={() => setReportedGame(modal.id)}
              />
            </div>
          ) : (
            <div className="bg-slate-900 rounded-none sm:rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl border-0 sm:border sm:border-slate-700 flex flex-col" style={{ height: '100dvh', maxHeight: '680px' }}>
              {/* Modal header */}
              <div className="bg-slate-800/90 px-5 py-3.5 border-b border-slate-700/60 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="bg-red-500/20 text-red-400 p-2 rounded-xl text-lg">
                    <i className={`fa-solid ${modal.icon || 'fa-gamepad'}`} />
                  </span>
                  <div>
                    <h2 className="text-white font-extrabold text-lg md:text-xl" style={{ fontFamily: 'Fredoka, sans-serif' }}>{modal.title}</h2>
                    <p className="text-slate-400 text-xs">
                      {modal.bike ? 'Traffic Rider 3D · First-Person Superbike · Highway Traffic' : modal.playable ? 'Shoot targets · Aim with mouse · R to reload' : 'Coming soon!'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleFullscreen}
                    className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-700/50 transition"
                    title="Fullscreen"
                  >
                    <i className={`fa-solid ${fullscreen ? 'fa-compress' : 'fa-expand'} text-lg`} />
                  </button>
                  <button
                    onClick={closeModal}
                    className="text-slate-400 hover:text-red-400 p-2 rounded-xl hover:bg-slate-700/50 transition text-xl"
                    title="Close"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              </div>

              {/* Game area — explicit height so children can use 100% */}
              <div
                ref={gameAreaRef}
                className="flex-1 bg-slate-950 relative overflow-hidden"
                style={{ minHeight: 0 }}
              >
                {modal.bike ? (
                  <BikeRacer onClose={closeModal} />
                ) : modal.playable ? (
                  <PistolGame containerRef={gameAreaRef} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-white p-8 text-center">
                    <i className="fa-solid fa-gamepad text-6xl text-cyan-400 mb-4 animate-bounce" />
                    <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>{modal.title}</h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-sm">This game is coming soon! Try our playable games below.</p>
                    <div className="flex gap-3">
                      <button onClick={() => setModal(GAMES_DATA[0])} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold px-5 py-2.5 rounded-xl transition hover:scale-105">
                        🔫 Pistol Duel
                      </button>
                      <button onClick={() => setModal(GAMES_DATA[1])} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl transition hover:scale-105">
                        🏍️ Bike Racer
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal footer — strictly Like and Report game buttons */}
              <div className="bg-slate-800/80 px-5 py-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400 gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setLikedGames(prev => ({ ...prev, [modal.id]: !prev[modal.id] }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer active:scale-95 border ${
                    likedGames[modal.id]
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'bg-slate-700 hover:bg-slate-600 border-slate-600/40 text-slate-200'
                  }`}
                >
                  <i className={`fa-solid fa-thumbs-up ${likedGames[modal.id] ? 'text-emerald-400 scale-110' : 'text-emerald-400'}`} />
                  <span>Like</span>
                  <span className="text-slate-400 font-mono text-[11px]">({modal.likes})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportedGame(modal.id);
                    setTimeout(() => setReportedGame(null), 3000);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold transition cursor-pointer active:scale-95 border ${
                    reportedGame === modal.id
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                      : 'bg-slate-700/50 hover:bg-rose-500/20 hover:text-rose-300 border-slate-600/30 text-slate-400'
                  }`}
                >
                  <i className={`fa-solid ${reportedGame === modal.id ? 'fa-check text-amber-400' : 'fa-flag text-rose-400 text-xs'}`} />
                  <span>{reportedGame === modal.id ? 'Report Submitted' : 'Report game'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
