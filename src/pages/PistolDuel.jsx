import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   PISTOL DUEL — Player vs CPU Duel Arena (5 Levels)
   - Fully responsive: native portrait (mobile) & landscape (desktop)
   - Zero blank screen: arena & guns render immediately on mount
   - Touch & Click aiming with recoil physics and bullet ricochet
   - Safe WebAudio & canvas rendering on all devices
   ═══════════════════════════════════════════════════════════════════════ */

const LEVELS = [
  { level: 1, cpuHp: 2, cpuMs: 2000, scatter: 80, label: 'Rookie',       badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  { level: 2, cpuHp: 3, cpuMs: 1600, scatter: 55, label: 'Gunner',       badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' },
  { level: 3, cpuHp: 3, cpuMs: 1250, scatter: 35, label: 'Sharpshooter', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  { level: 4, cpuHp: 4, cpuMs: 950,  scatter: 18, label: 'Marksman',     badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  { level: 5, cpuHp: 5, cpuMs: 700,  scatter: 6,  label: 'Legendary',    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
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

function playTone(f1, f2, dur, soundEnabled = true, type = 'sawtooth') {
  if (!soundEnabled) return;
  try {
    const ctx = getDuelAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, ctx.currentTime);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), ctx.currentTime + dur);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch {}
}

function initState(li, width = 600, height = 400) {
  const lv = LEVELS[Math.min(li, LEVELS.length - 1)];
  const isPortrait = height > width;

  // Initial gun positions depending on orientation
  const px = isPortrait ? width * 0.5 : width * 0.22;
  const py = isPortrait ? height * 0.78 : height * 0.5;
  const pAngle = isPortrait ? -Math.PI / 2 : 0;

  const cx = isPortrait ? width * 0.5 : width * 0.78;
  const cy = isPortrait ? height * 0.22 : height * 0.5;
  const cAngle = isPortrait ? Math.PI / 2 : Math.PI;

  return {
    lv,
    isPortrait,
    px, py, pvx: 0, pvy: 0, pAngle, pSpin: 0, pFlash: 0,
    cx, cy, cvx: 0, cvy: 0, cAngle, cSpin: 0, cFlash: 0,
    pHp: 3, pMaxHp: 3,
    cHp: lv.cpuHp, cMaxHp: lv.cpuHp,
    pBullets: [], cBullets: [],
    particles: [],
    floatingTexts: [],
    cTimer: lv.cpuMs,
    score: 0,
    initialized: true,
  };
}

// Draw a stylized cyber pistol
function drawGun(ctx, x, y, angle, col, flash, isPlayer = true) {
  const GW = 52, GH = 20;
  const blink = flash > 0 && Math.floor(flash / 4) % 2 === 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = blink ? 0.3 : 1;

  // Glow halo
  ctx.shadowColor = col;
  ctx.shadowBlur = flash > 0 ? 25 : 14;

  // Main gun slide/body
  ctx.fillStyle = col;
  ctx.fillRect(-GW * 0.32, -GH / 2, GW * 0.65, GH);

  // Extended barrel
  ctx.fillStyle = isPlayer ? '#38bdf8' : '#f87171';
  ctx.fillRect(GW * 0.33, -5, GW * 0.58, 10);

  // Muzzle ring
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(GW * 0.91, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Dark ergonomic grip
  ctx.fillStyle = isPlayer ? '#0f172a' : '#450a0a';
  ctx.shadowBlur = 0;
  ctx.fillRect(-GW * 0.32, 2, GW * 0.24, GH - 1);

  // Trigger guard
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-GW * 0.05, 5, 5, 0, Math.PI);
  ctx.stroke();

  // Metallic top highlight
  ctx.globalAlpha = blink ? 0 : 0.45;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-GW * 0.28, -GH / 2 + 2, GW * 0.55, 3);

  // Laser sight dot guide
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = col;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.moveTo(GW * 0.95, 0);
  ctx.lineTo(GW * 0.95 + 70, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

export default function PistolDuel({ onClose }) {
  const canvasRef  = useRef(null);
  const wrapRef    = useRef(null);
  const rafRef     = useRef(null);
  const loopRef    = useRef(null);
  const stateRef   = useRef(null);
  const phaseRef   = useRef('menu'); // 'menu' | 'countdown' | 'playing' | 'overlay'
  const lvlRef     = useRef(0);
  const sizeRef    = useRef({ W: 600, H: 400 });
  const soundRef   = useRef(true);

  const [phase, setPhase]         = useState('menu');
  const [countdown, setCountdown] = useState(3);
  const [lvlIdx, setLvlIdx]       = useState(0);
  const [soundOn, setSoundOn]     = useState(true);
  const [overlay, setOverlay]     = useState(null); // 'levelclear' | 'win' | 'gameover'
  const [hud, setHud]             = useState({ pHp: 3, cHp: 2, cMax: 2, lvl: 1, label: 'Rookie', score: 0 });

  const syncPhase = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const toggleSound = () => {
    soundRef.current = !soundRef.current;
    setSoundOn(soundRef.current);
  };

  // ── Resize handler with layout preservation ──────────────────────────────
  const resize = useCallback(() => {
    const c = canvasRef.current;
    const w = wrapRef.current;
    if (!c || !w) return;

    const rect = w.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width || w.clientWidth || 600));
    const height = Math.max(240, Math.floor(rect.height || w.clientHeight || 400));

    c.width = width;
    c.height = height;

    const oldW = sizeRef.current.W;
    const oldH = sizeRef.current.H;
    sizeRef.current = { W: width, H: height };

    const s = stateRef.current;
    if (s) {
      s.isPortrait = height > width;
      // Reposition proportionally if screen resized
      if (oldW > 0 && oldH > 0) {
        s.px = (s.px / oldW) * width;
        s.py = (s.py / oldH) * height;
        s.cx = (s.cx / oldW) * width;
        s.cy = (s.cy / oldH) * height;
      }
    }
  }, []);

  // ── Shoot helper ─────────────────────────────────────────────────────────
  const shoot = (s, isPlayer, tx, ty) => {
    const ox = isPlayer ? s.px : s.cx;
    const oy = isPlayer ? s.py : s.cy;
    const dx = tx - ox;
    const dy = ty - oy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    // Bullet speed
    const spd = 12;
    const bArr = isPlayer ? s.pBullets : s.cBullets;
    bArr.push({ x: ox + nx * 30, y: oy + ny * 30, vx: nx * spd, vy: ny * spd, bounces: 0 });

    // Recoil kickback + spin
    const targetAngle = Math.atan2(ny, nx);
    const spin = (Math.sin(targetAngle) >= 0 ? -1 : 1) * (1.2 + Math.random() * 0.4);

    if (isPlayer) {
      s.pvx -= nx * 8;
      s.pvy -= ny * 8;
      s.pSpin = spin;
      s.pAngle = targetAngle;
      playTone(480, 80, 0.16, soundRef.current, 'sawtooth');
    } else {
      s.cvx -= nx * 8;
      s.cvy -= ny * 8;
      s.cSpin = -spin;
      s.cAngle = targetAngle;
      playTone(340, 60, 0.16, soundRef.current, 'triangle');
    }

    // Muzzle sparks
    for (let i = 0; i < 7; i++) {
      const a = targetAngle + (Math.random() - 0.5) * 0.8;
      const sp = Math.random() * 5 + 2;
      s.particles.push({
        x: ox + nx * 30,
        y: oy + ny * 30,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        col: isPlayer ? '#38bdf8' : '#fb923c',
      });
    }
  };

  // ── Burst particles ───────────────────────────────────────────────────────
  const burst = (s, x, y, col, n = 20) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * 6 + 1.5;
      s.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        col,
      });
    }
  };

  // ── Start / Restart Level ────────────────────────────────────────────────
  const startLevel = (li) => {
    const { W, H } = sizeRef.current;
    const s = initState(li, W, H);
    stateRef.current = s;
    lvlRef.current = li;
    setLvlIdx(li);
    setHud({
      pHp: s.pHp,
      cHp: s.cHp,
      cMax: s.cMaxHp,
      lvl: s.lv.level,
      label: s.lv.label,
      score: s.score,
    });
    setOverlay(null);

    // Short exciting 3..2..1 countdown
    syncPhase('countdown');
    setCountdown(3);
    playTone(520, null, 0.08, soundRef.current, 'sine');

    let count = 3;
    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        playTone(520, null, 0.08, soundRef.current, 'sine');
      } else if (count === 0) {
        setCountdown('DRAW!');
        playTone(880, 1100, 0.25, soundRef.current, 'sine');
      } else {
        clearInterval(timer);
        syncPhase('playing');
      }
    }, 450);
  };

  // ── Input coordinates with high-DPI scaling ──────────────────────────────
  const getCanvasXY = (clientX, clientY) => {
    const c = canvasRef.current;
    if (!c) return [0, 0];
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height) return [0, 0];
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    return [(clientX - r.left) * scaleX, (clientY - r.top) * scaleY];
  };

  const handleClick = (e) => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current;
    if (!s) return;
    const [mx, my] = getCanvasXY(e.clientX, e.clientY);
    shoot(s, true, mx, my);
  };

  const handleTouch = (e) => {
    if (phaseRef.current !== 'playing') return;
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    const [mx, my] = getCanvasXY(t.clientX, t.clientY);
    const s = stateRef.current;
    if (!s) return;
    shoot(s, true, mx, my);
  };

  // ── Main Game / Render Loop ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    let last = 0;

    // Initial resize to establish canvas coordinate space
    resize();

    // Initialize state immediately so the arena & guns NEVER appear blank
    const { W, H } = sizeRef.current;
    if (!stateRef.current) {
      stateRef.current = initState(0, W, H);
    }

    const loop = (ts) => {
      const dt = Math.min((ts - (last || ts)) / 1000, 0.05);
      last = ts;

      const { W, H } = sizeRef.current;
      const s = stateRef.current;

      // ── Draw Arena Background ──────────────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#0a0f1d');
      bg.addColorStop(0.5, '#0f172a');
      bg.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Cyber Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = Math.max(28, Math.min(45, Math.floor(W / 16)));
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Center Division Line
      ctx.save();
      ctx.setLineDash([8, 12]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (H > W) {
        // Horizontal division for Portrait
        ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
      } else {
        // Vertical division for Landscape
        ctx.moveTo(W / 2, 0); ctx.lineTo(W/ 2, H);
      }
      ctx.stroke();
      ctx.restore();

      // Outer Arena Neon Border
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(3, 3, W - 6, H - 6);

      // Inner faint glow border
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, W - 12, H - 12);

      if (s) {
        // ── Idle Floating Motion in Menu / Countdown ───────────────────────
        if (phaseRef.current === 'menu' || phaseRef.current === 'countdown') {
          const hover = Math.sin(ts * 0.003) * 0.4;
          s.py += hover;
          s.cy -= hover;
        }

        // ── CPU AI Logic ──────────────────────────────────────────────────
        if (phaseRef.current === 'playing') {
          s.cTimer -= dt * 1000;
          if (s.cTimer <= 0) {
            const sc = s.lv.scatter;
            const targetX = s.px + (Math.random() - 0.5) * sc;
            const targetY = s.py + (Math.random() - 0.5) * sc;
            shoot(s, false, targetX, targetY);
            s.cTimer = s.lv.cpuMs + (Math.random() - 0.5) * 350;
          }
        }

        // ── Physics: Gun Movement & Wall Collisions ───────────────────────
        const GW = 52, GH = 20;
        const updateGun = (isP) => {
          let x = isP ? s.px : s.cx;
          let y = isP ? s.py : s.cy;
          let vx = isP ? s.pvx : s.cvx;
          let vy = isP ? s.pvy : s.cvy;
          let spin = isP ? s.pSpin : s.cSpin;

          vx *= 0.88;
          vy *= 0.88;
          spin *= 0.85;

          x += vx;
          y += vy;

          const hw = GW / 2, hh = GH / 2;
          if (x - hw < 6) { x = hw + 6; vx = Math.abs(vx) * 0.6; spin *= -0.5; }
          if (x + hw > W - 6) { x = W - hw - 6; vx = -Math.abs(vx) * 0.6; spin *= -0.5; }
          if (y - hh < 6) { y = hh + 6; vy = Math.abs(vy) * 0.6; spin *= -0.5; }
          if (y + hh > H - 6) { y = H - hh - 6; vy = -Math.abs(vy) * 0.6; spin *= -0.5; }

          if (isP) {
            s.px = x; s.py = y; s.pvx = vx; s.pvy = vy; s.pSpin = spin; s.pAngle += spin;
          } else {
            s.cx = x; s.cy = y; s.cvx = vx; s.cvy = vy; s.cSpin = spin; s.cAngle += spin;
          }
        };

        updateGun(true);
        updateGun(false);

        // ── Bullets with Wall Ricochet & Hit Detection ─────────────────────
        const processBullets = (bullets, isPlayerBullet) => {
          for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vx;
            b.y += b.vy;

            // Bounce on boundary
            let bounced = false;
            if (b.x < 6 || b.x > W - 6) {
              b.vx *= -0.85;
              b.x = Math.max(7, Math.min(W - 7, b.x));
              bounced = true;
            }
            if (b.y < 6 || b.y > H - 6) {
              b.vy *= -0.85;
              b.y = Math.max(7, Math.min(H - 7, b.y));
              bounced = true;
            }

            if (bounced) {
              b.bounces = (b.bounces || 0) + 1;
              burst(s, b.x, b.y, '#fef08a', 4);
              playTone(850, 600, 0.04, soundRef.current, 'sine');
              if (b.bounces > 4) {
                bullets.splice(i, 1);
                continue;
              }
            }

            // Low velocity cleanup
            if (Math.hypot(b.vx, b.vy) < 0.8) {
              bullets.splice(i, 1);
              continue;
            }

            if (phaseRef.current !== 'playing') continue;

            // Target check
            const tx = isPlayerBullet ? s.cx : s.px;
            const ty = isPlayerBullet ? s.cy : s.py;
            const dist = Math.hypot(b.x - tx, b.y - ty);

            if (dist < 32) {
              bullets.splice(i, 1);
              burst(s, tx, ty, isPlayerBullet ? '#38bdf8' : '#ef4444', 28);
              playTone(600, 90, 0.22, soundRef.current, 'sawtooth');

              const hitAngle = Math.atan2(b.vy, b.vx);
              const hitSpin = (Math.sin(hitAngle) >= 0 ? -1 : 1) * 3.2;

              if (isPlayerBullet) {
                s.cHp = Math.max(0, s.cHp - 1);
                s.cFlash = 24;
                s.cSpin = hitSpin;
                s.cvx += b.vx * 0.7;
                s.cvy += b.vy * 0.7;
                s.score += 150;
                setHud((h) => ({ ...h, cHp: s.cHp, score: s.score }));

                // Level victory
                if (s.cHp <= 0) {
                  burst(s, tx, ty, '#fbbf24', 45);
                  playTone(880, 1760, 0.45, soundRef.current, 'triangle');
                  syncPhase('overlay');
                  setOverlay(lvlRef.current + 1 >= LEVELS.length ? 'win' : 'levelclear');
                  setHud((h) => ({ ...h, cHp: 0, score: s.score }));
                }
              } else {
                s.pHp = Math.max(0, s.pHp - 1);
                s.pFlash = 28;
                s.pSpin = -hitSpin;
                s.pvx += b.vx * 0.7;
                s.pvy += b.vy * 0.7;
                setHud((h) => ({ ...h, pHp: s.pHp }));

                // Player defeat
                if (s.pHp <= 0) {
                  burst(s, tx, ty, '#f87171', 45);
                  playTone(280, 50, 0.5, soundRef.current, 'sawtooth');
                  syncPhase('overlay');
                  setOverlay('gameover');
                  setHud((h) => ({ ...h, pHp: 0 }));
                }
              }
            }
          }
        };

        processBullets(s.pBullets, true);
        processBullets(s.cBullets, false);

        if (s.pFlash > 0) s.pFlash--;
        if (s.cFlash > 0) s.cFlash--;

        // ── Render Particles (safely bounded) ──────────────────────────────
        s.particles = s.particles.filter((p) => p.life > 0.02);
        s.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.92;
          p.vy *= 0.92;
          p.life -= 0.035;

          const alpha = Math.max(0, Math.min(1, p.life));
          const rad = Math.max(0.2, 3.2 * alpha + 0.4);

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.col;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // ── Render Bullets ────────────────────────────────────────────────
        const allBullets = [
          ...s.pBullets.map((b) => ({ b, col: '#38bdf8' })),
          ...s.cBullets.map((b) => ({ b, col: '#f97316' })),
        ];

        allBullets.forEach(({ b, col }) => {
          ctx.save();
          ctx.shadowBlur = 12;
          ctx.shadowColor = col;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Tracer glow
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(b.x - b.vx * 1.5, b.y - b.vy * 1.5, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // ── Render Guns ────────────────────────────────────────────────────
        drawGun(ctx, s.px, s.py, s.pAngle, '#38bdf8', s.pFlash, true);
        drawGun(ctx, s.cx, s.cy, s.cAngle, '#ef4444', s.cFlash, false);

        // Name tags over pistols
        ctx.font = `bold ${Math.max(11, Math.min(14, W * 0.025))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.fillText('YOU', s.px, s.py - 30);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.fillText('CPU', s.cx, s.cy - 30);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = loop;
    rafRef.current = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [resize]);

  const currentLevel = LEVELS[Math.min(lvlIdx, LEVELS.length - 1)];

  return (
    <div className="flex flex-col w-full h-full bg-slate-950 overflow-hidden select-none" style={{ minHeight: 0 }}>
      {/* ── Top HUD ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 md:px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex-shrink-0 text-xs backdrop-blur-md">
        {/* Player HP */}
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-400 font-extrabold text-xs tracking-wider">YOU</span>
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`text-sm md:text-base transition-colors ${
                  i < hud.pHp ? 'text-cyan-400 drop-shadow-[0_0_8px_#38bdf8]' : 'text-slate-700'
                }`}
              >
                ♥
              </span>
            ))}
          </div>
        </div>

        {/* Level badge & score */}
        <div className="text-center flex items-center gap-2 md:gap-3">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider border ${currentLevel.badge}`}>
            Lv.{hud.lvl} {hud.label}
          </span>
          <span className="text-yellow-400 font-black text-xs md:text-sm">
            {hud.score} <span className="text-[10px] text-slate-500 font-normal">PTS</span>
          </span>
        </div>

        {/* CPU HP + Sound */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[...Array(hud.cMax)].map((_, i) => (
                <span
                  key={i}
                  className={`text-sm md:text-base transition-colors ${
                    i < hud.cHp ? 'text-red-500 drop-shadow-[0_0_8px_#ef4444]' : 'text-slate-700'
                  }`}
                >
                  ♥
                </span>
              ))}
            </div>
            <span className="text-red-400 font-extrabold text-xs tracking-wider">CPU</span>
          </div>

          <button
            onClick={toggleSound}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 border border-slate-700 hover:bg-slate-700 transition"
            title={soundOn ? 'Mute' : 'Unmute'}
          >
            <i className={`fa-solid ${soundOn ? 'fa-volume-high' : 'fa-volume-xmark text-red-400'} text-xs`} />
          </button>
        </div>
      </div>

      {/* ── Canvas Arena Wrapper ────────────────────────────────────────── */}
      <div ref={wrapRef} className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onTouchStart={handleTouch}
          className="absolute inset-0 w-full h-full block"
          style={{
            cursor: phase === 'playing' ? 'crosshair' : 'default',
            touchAction: 'none',
          }}
        />

        {/* ── COUNTDOWN OVERLAY ─────────────────────────────────────────── */}
        {phase === 'countdown' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="text-center animate-pulse">
              <span
                className="text-6xl md:text-8xl font-black text-white tracking-widest"
                style={{
                  textShadow: '0 0 35px #38bdf8, 0 0 70px #38bdf8',
                  fontFamily: 'Fredoka, sans-serif',
                }}
              >
                {countdown}
              </span>
            </div>
          </div>
        )}

        {/* ── START MENU OVERLAY ────────────────────────────────────────── */}
        {phase === 'menu' && (
          <div className="absolute inset-0 z-20 bg-slate-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center">
            <div className="max-w-md w-full bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-3xl shadow-lg shadow-cyan-500/30">
                🔫
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-wide" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  Pistol Duel
                </h2>
                <p className="text-slate-400 text-xs md:text-sm mt-1">
                  Aim & shoot by tapping anywhere. Watch gun recoil & physics!
                </p>
              </div>

              {/* Levels Preview */}
              <div className="flex gap-1.5 flex-wrap justify-center py-1">
                {LEVELS.map((l, i) => (
                  <span
                    key={l.level}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      i === 0 ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500' : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Lv.{l.level} {l.label}
                  </span>
                ))}
              </div>

              {/* Start Button */}
              <button
                onClick={() => startLevel(0)}
                className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-extrabold py-3.5 px-6 rounded-2xl text-base shadow-xl shadow-cyan-500/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-play text-sm" /> START DUEL
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
                >
                  Back to Games
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── LEVEL CLEAR OVERLAY ───────────────────────────────────────── */}
        {overlay === 'levelclear' && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="max-w-sm w-full bg-slate-900 border border-green-500/40 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center gap-4">
              <div className="text-5xl animate-bounce">🎉</div>
              <div>
                <h3 className="text-2xl font-extrabold text-green-400" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  Level {hud.lvl} Cleared!
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  Target eliminated! Total Score: <strong className="text-yellow-400 font-bold">{hud.score}</strong>
                </p>
              </div>

              <button
                onClick={() => startLevel(lvlIdx + 1)}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-2xl text-sm shadow-lg shadow-green-500/30 hover:brightness-110 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
              >
                Next Level: {LEVELS[Math.min(lvlIdx + 1, 4)].label} →
              </button>

              {onClose && (
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs underline">
                  Exit
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── WIN OVERLAY ───────────────────────────────────────────────── */}
        {overlay === 'win' && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="max-w-sm w-full bg-slate-900 border border-yellow-500/40 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center gap-4">
              <div className="text-5xl animate-bounce">🏆</div>
              <div>
                <h3 className="text-3xl font-extrabold text-yellow-400" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  VICTORY!
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  You conquered all 5 levels! Grand Score:{' '}
                  <strong className="text-yellow-400 text-sm font-bold">{hud.score}</strong>
                </p>
              </div>

              <button
                onClick={() => startLevel(0)}
                className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-black py-3 px-6 rounded-2xl text-sm shadow-lg shadow-yellow-500/30 hover:brightness-110 active:scale-95 transition cursor-pointer"
              >
                🔄 Play Again
              </button>
            </div>
          </div>
        )}

        {/* ── GAME OVER OVERLAY ─────────────────────────────────────────── */}
        {overlay === 'gameover' && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="max-w-sm w-full bg-slate-900 border border-red-500/40 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center gap-4">
              <div className="text-5xl">💀</div>
              <div>
                <h3 className="text-2xl font-extrabold text-red-500" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  Defeated!
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  You were eliminated on Level {hud.lvl} ({hud.label}).
                </p>
              </div>

              <div className="flex gap-2.5 w-full">
                <button
                  onClick={() => startLevel(lvlIdx)}
                  className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold py-3 px-4 rounded-2xl text-xs hover:brightness-110 active:scale-95 transition cursor-pointer"
                >
                  🔄 Retry Level
                </button>
                <button
                  onClick={() => {
                    setOverlay(null);
                    syncPhase('menu');
                    setLvlIdx(0);
                  }}
                  className="bg-slate-800 text-slate-300 hover:text-white font-bold py-3 px-4 rounded-2xl text-xs hover:bg-slate-700 transition cursor-pointer"
                >
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Controls Footer ──────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-slate-900/90 border-t border-slate-800 px-3 py-1.5 text-[10px] md:text-xs text-slate-400 flex justify-between items-center">
        <span>🎯 Tap / Click anywhere to aim & shoot · Gun recoils backwards</span>
        <span className="hidden sm:inline">Bullets ricochet off walls</span>
      </div>
    </div>
  );
}
