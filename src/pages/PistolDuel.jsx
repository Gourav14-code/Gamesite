import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════════
   RECOIL DUEL — ARENA MASTER
   Complete Playable Portrait Mobile Hyper-Casual Physics Game
   Flow Breakdown Map:
   1. Splash Screen: Animated rotating gun, segmented progress bar, "LOADING ARENA..."
   2. Main Menu: Bullet-shaped PLAY button, Music toggle, Skins customization
   3. Level Selection: 12-level vault grid, padlocks, hinges, skull difficulty meter, Home
   4. Gameplay Arena:
      - Panel A (Ready): "TAP TO SHOOT!"
      - Panel B (Action/Recoil): Real physics recoil, spinning gun, multi-frame ghost trails
      - Panel C (Hit/Damage): Skull icons damage feedback, explosion bursts, ricochets
   5. Outcome Screens:
      - VICTORY Screen: Level Clear, +50 Coins, Next Level button, unlocked flip logic
      - FAILED Screen: "CPU GOT YOU!", Retry Level, Home
   ═══════════════════════════════════════════════════════════════════════════════ */

// ── 12 Levels Configuration with Progressive Skull Meter Difficulty ───────────
const LEVELS_CONFIG = [
  { level: 1,  name: 'Recoil 101',      cpuHp: 2, cpuDelay: 2200, cpuTol: 0.58, skullMeter: 8,   obstacles: [] },
  { level: 2,  name: 'Target Arc',      cpuHp: 2, cpuDelay: 1950, cpuTol: 0.50, skullMeter: 16,  obstacles: [] },
  { level: 3,  name: 'Center Pillar',   cpuHp: 3, cpuDelay: 1750, cpuTol: 0.44, skullMeter: 25,  obstacles: [{ x: 0.5, y: 0.5, w: 0.22, h: 0.04, type: 'rect' }] },
  { level: 4,  name: 'Quick Spin',      cpuHp: 3, cpuDelay: 1550, cpuTol: 0.38, skullMeter: 33,  obstacles: [] },
  { level: 5,  name: 'Ledge Divide',    cpuHp: 3, cpuDelay: 1400, cpuTol: 0.34, skullMeter: 42,  obstacles: [{ x: 0.65, y: 0.48, w: 0.38, h: 0.035, type: 'rect' }] },
  { level: 6,  name: 'Ricochet Zone',   cpuHp: 3, cpuDelay: 1300, cpuTol: 0.30, skullMeter: 50,  obstacles: [{ x: 0.5, y: 0.36, w: 0.20, h: 0.04, type: 'rect' }, { x: 0.5, y: 0.64, w: 0.20, h: 0.04, type: 'rect' }] },
  { level: 7,  name: 'Twin Barriers',   cpuHp: 4, cpuDelay: 1200, cpuTol: 0.26, skullMeter: 58,  obstacles: [{ x: 0.3, y: 0.42, w: 0.32, h: 0.035, type: 'rect' }, { x: 0.7, y: 0.58, w: 0.32, h: 0.035, type: 'rect' }] },
  { level: 8,  name: 'Sharpshooter',    cpuHp: 4, cpuDelay: 1100, cpuTol: 0.22, skullMeter: 67,  obstacles: [{ x: 0.5, y: 0.5, w: 0.22, h: 0.22, type: 'diamond' }] },
  { level: 9,  name: 'Sliding Hazard',  cpuHp: 4, cpuDelay: 1000, cpuTol: 0.20, skullMeter: 75,  obstacles: [{ x: 0.5, y: 0.5, w: 0.30, h: 0.04, type: 'moving_x', speed: 1.3 }] },
  { level: 10, name: 'Twin Sliders',    cpuHp: 4, cpuDelay: 900,  cpuTol: 0.18, skullMeter: 83,  obstacles: [{ x: 0.5, y: 0.38, w: 0.26, h: 0.035, type: 'moving_x', speed: -1.2 }, { x: 0.5, y: 0.62, w: 0.26, h: 0.035, type: 'moving_x', speed: 1.4 }] },
  { level: 11, name: 'Bullet Storm',    cpuHp: 5, cpuDelay: 800,  cpuTol: 0.16, skullMeter: 92,  obstacles: [{ x: 0.5, y: 0.5, w: 0.34, h: 0.04, type: 'moving_x', speed: 1.8 }, { x: 0.5, y: 0.32, w: 0.20, h: 0.03, type: 'rect' }, { x: 0.5, y: 0.68, w: 0.20, h: 0.03, type: 'rect' }] },
  { level: 12, name: 'Arena Master',    cpuHp: 5, cpuDelay: 700,  cpuTol: 0.13, skullMeter: 100, obstacles: [{ x: 0.5, y: 0.5, w: 0.38, h: 0.045, type: 'moving_x', speed: 2.1 }, { x: 0.25, y: 0.35, w: 0.18, h: 0.035, type: 'rect' }, { x: 0.75, y: 0.65, w: 0.18, h: 0.035, type: 'rect' }] },
];

// ── Gun Skins Catalog ─────────────────────────────────────────────────────────
const SKINS_CATALOG = [
  { id: 'classic', name: 'Emerald Spec', price: 0,   col: '#22c55e', accent: '#15803d', highlight: '#86efac', trailCol: 'rgba(34, 197, 94, ' },
  { id: 'gold',    name: 'Golden Boss',  price: 150, col: '#f59e0b', accent: '#b45309', highlight: '#fde68a', trailCol: 'rgba(245, 158, 11, ' },
  { id: 'cyber',   name: 'Cyber Cyan',   price: 250, col: '#06b6d4', accent: '#0e7490', highlight: '#a5f3fc', trailCol: 'rgba(6, 182, 212, ' },
  { id: 'crimson', name: 'Hot Crimson',  price: 400, col: '#e11d48', accent: '#9f1239', highlight: '#fecdd3', trailCol: 'rgba(225, 29, 72, ' },
];

// ── Web Audio Synthesizer ─────────────────────────────────────────────────────
let globalAudioCtx = null;
function getAudioCtx() {
  try {
    if (!globalAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) globalAudioCtx = new AudioCtx();
    }
    if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => {});
    }
  } catch {}
  return globalAudioCtx;
}

function playSound(type, soundOn = true) {
  if (!soundOn) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'shoot_player') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.13);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'shoot_cpu') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'ricochet') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'hit') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } else if (type === 'gameover') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.45);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch {}
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ── Realistic 2D Gun Drawing with Customizable Skin ───────────────────────────
function renderGun(ctx, gun, skin, isPlayer) {
  const GL = gun.length;
  const GH = gun.height;
  const col = isPlayer ? skin.col : '#ef4444';
  const accent = isPlayer ? skin.accent : '#991b1b';
  const highlight = isPlayer ? skin.highlight : '#fca5a5';

  ctx.save();
  ctx.translate(gun.x, gun.y);
  ctx.rotate(gun.angle);

  // Blinking on hit
  if (gun.flash > 0 && Math.floor(gun.flash / 3) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  // Gun Drop Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;

  // 1. Grip / Handle
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.roundRect(-GL * 0.32, GH * 0.1, GL * 0.28, GH * 0.85, [2, 2, 5, 5]);
  ctx.fill();

  // Grip checkering
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-GL * 0.3, GH * 0.35);
  ctx.lineTo(-GL * 0.08, GH * 0.35);
  ctx.moveTo(-GL * 0.3, GH * 0.6);
  ctx.lineTo(-GL * 0.08, GH * 0.6);
  ctx.stroke();

  // 2. Trigger Guard
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(-GL * 0.02, GH * 0.28, GH * 0.28, 0, Math.PI);
  ctx.stroke();

  // 3. Lower Receiver
  ctx.fillStyle = accent;
  ctx.fillRect(-GL * 0.35, -GH * 0.1, GL * 0.65, GH * 0.45);

  // 4. Slide / Upper Barrel
  ctx.shadowBlur = 0;
  const slideGrad = ctx.createLinearGradient(0, -GH * 0.55, 0, GH * 0.15);
  slideGrad.addColorStop(0, highlight);
  slideGrad.addColorStop(0.35, col);
  slideGrad.addColorStop(1, accent);
  ctx.fillStyle = slideGrad;
  ctx.beginPath();
  ctx.roundRect(-GL * 0.36, -GH * 0.55, GL * 0.86, GH * 0.55, [3, 2, 2, 3]);
  ctx.fill();

  // Rear slide serrations
  ctx.fillStyle = '#0f172a';
  for (let s = -GL * 0.32; s < -GL * 0.16; s += 3.5) {
    ctx.fillRect(s, -GH * 0.5, 1.8, GH * 0.4);
  }

  // 5. Extended Steel Barrel Tip & Muzzle
  ctx.fillStyle = '#262626';
  ctx.fillRect(GL * 0.5, -GH * 0.35, GL * 0.12, GH * 0.3);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(GL * 0.62, -GH * 0.2, GH * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Sights
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(GL * 0.46, -GH * 0.66, 2.5, 3.5);
  ctx.fillRect(-GL * 0.34, -GH * 0.66, 2.5, 3.5);

  // Ejection Port
  ctx.fillStyle = '#171717';
  ctx.fillRect(-GL * 0.05, -GH * 0.52, GL * 0.22, GH * 0.22);

  // 6. Laser Guide Line
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(GL * 0.62, -GH * 0.2);
  ctx.lineTo(GL * 0.62 + 90, -GH * 0.2);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// ── Main PistolDuel Component ─────────────────────────────────────────────────
export default function PistolDuel({ onClose }) {
  // Navigation / Flow States
  // 'splash' -> 'menu' -> 'level_select' / 'skins' -> 'playing' -> 'victory' / 'failed'
  const [phase, setPhase] = useState('splash');
  const [splashProgress, setSplashProgress] = useState(0);

  // Persistence States
  const [coins, setCoins] = useState(() => {
    return parseInt(localStorage.getItem('duel_coins') || '250', 10);
  });
  const [unlockedLevels, setUnlockedLevels] = useState(() => {
    return parseInt(localStorage.getItem('duel_unlocked_level') || '1', 10);
  });
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [selectedSkinId, setSelectedSkinId] = useState(() => {
    return localStorage.getItem('duel_skin') || 'classic';
  });
  const [ownedSkins, setOwnedSkins] = useState(() => {
    try {
      const stored = localStorage.getItem('duel_owned_skins');
      return stored ? JSON.parse(stored) : ['classic'];
    } catch {
      return ['classic'];
    }
  });
  const [soundOn, setSoundOn] = useState(() => {
    return localStorage.getItem('duel_sound') !== 'false';
  });

  // Active Gameplay HUD
  const [hud, setHud] = useState({ playerHp: 3, cpuHp: 2, level: 1, name: 'Recoil 101' });

  // DOM Refs
  const canvasRef = useRef(null);
  const arenaRef = useRef(null);
  const splashGunRef = useRef(null);
  const stateRef = useRef(null);
  const animFrameRef = useRef(null);
  const phaseRef = useRef('splash');
  const soundRef = useRef(soundOn);

  // Sync refs
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    soundRef.current = soundOn;
    localStorage.setItem('duel_sound', soundOn.toString());
  }, [soundOn]);

  const activeSkin = SKINS_CATALOG.find((s) => s.id === selectedSkinId) || SKINS_CATALOG[0];

  // ── 1. Splash Screen Loader Simulation ──────────────────────────────────────
  useEffect(() => {
    if (phase !== 'splash') return;
    let p = 0;
    const interval = setInterval(() => {
      p += Math.floor(Math.random() * 9 + 4);
      if (p >= 100) {
        p = 100;
        setSplashProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setPhase('menu');
        }, 500);
      } else {
        setSplashProgress(p);
      }
    }, 70);

    return () => clearInterval(interval);
  }, [phase]);

  // ── 2. Splash Screen Gun Animation ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'splash') return;
    const canvas = splashGunRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let angle = 0;
    let animId = null;

    const renderSplash = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      angle += 0.035;
      const gunMock = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        angle,
        length: 70,
        height: 31,
        flash: 0,
      };
      renderGun(ctx, gunMock, activeSkin, true);
      animId = requestAnimationFrame(renderSplash);
    };
    animId = requestAnimationFrame(renderSplash);
    return () => cancelAnimationFrame(animId);
  }, [phase, activeSkin]);

  // ── 3. Start Level Physics Initialization ───────────────────────────────────
  const initLevel = useCallback((lIdx) => {
    const cfg = LEVELS_CONFIG[Math.min(lIdx, LEVELS_CONFIG.length - 1)];
    const canvas = canvasRef.current;
    const W = canvas ? canvas.width : 360;
    const H = canvas ? canvas.height : 540;

    const gunWidth = Math.max(38, Math.min(56, W * 0.15));
    const gunHeight = gunWidth * 0.44;
    const radius = gunWidth * 0.48;

    const player = {
      x: W * 0.32,
      y: H * 0.72,
      vx: 0,
      vy: 0,
      angle: -0.2,
      spin: 1.8,
      length: gunWidth,
      height: gunHeight,
      radius,
      hp: 3,
      maxHp: 3,
      flash: 0,
      ghosts: [],
      lastGhostTs: 0,
    };

    const cpu = {
      x: W * 0.68,
      y: H * 0.28,
      vx: 0,
      vy: 0,
      angle: Math.PI - 0.2,
      spin: -1.7,
      length: gunWidth,
      height: gunHeight,
      radius,
      hp: cfg.cpuHp,
      maxHp: cfg.cpuHp,
      flash: 0,
      ghosts: [],
      lastGhostTs: 0,
      timer: cfg.cpuDelay,
    };

    const obstacles = cfg.obstacles.map((obs) => ({
      ...obs,
      pixelX: obs.x * W,
      pixelY: obs.y * H,
      pixelW: obs.w * W,
      pixelH: obs.h * H,
      currX: obs.x * W,
      time: 0,
    }));

    stateRef.current = {
      cfg,
      W,
      H,
      player,
      cpu,
      bullets: [],
      particles: [],
      ejectedShells: [],
      damageSkulls: [],
      obstacles,
      screenShake: 0,
    };

    setCurrentLevelIdx(lIdx);
    setHud({
      playerHp: player.hp,
      cpuHp: cpu.hp,
      level: cfg.level,
      name: cfg.name,
    });
    setPhase('playing');
  }, []);

  // ── 4. Fire Gun Recoil Physics Action ────────────────────────────────────────
  const fireGun = (s, isPlayer) => {
    const gun = isPlayer ? s.player : s.cpu;
    const skin = isPlayer ? activeSkin : { col: '#ef4444', trailCol: 'rgba(239, 68, 68, ' };

    const muzzleDist = gun.length * 0.62;
    const muzzleX = gun.x + Math.cos(gun.angle) * muzzleDist;
    const muzzleY = gun.y + Math.sin(gun.angle) * muzzleDist;

    const bulletSpeed = 16.5;
    const bVx = Math.cos(gun.angle) * bulletSpeed;
    const bVy = Math.sin(gun.angle) * bulletSpeed;

    s.bullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: bVx,
      vy: bVy,
      isPlayer,
      bounces: 0,
      maxBounces: 3,
      trail: [],
    });

    // Muzzle flash particles
    for (let i = 0; i < 10; i++) {
      const spread = gun.angle + (Math.random() - 0.5) * 0.7;
      const sp = Math.random() * 7 + 3;
      s.particles.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(spread) * sp,
        vy: Math.sin(spread) * sp,
        life: 1.0,
        decay: 0.08,
        col: Math.random() > 0.4 ? '#f59e0b' : '#fef08a',
        size: Math.random() * 3.5 + 1.5,
      });
    }

    // Barrel smoke puff
    for (let i = 0; i < 4; i++) {
      const sp = Math.random() * 2 + 0.5;
      s.particles.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(gun.angle) * sp + (Math.random() - 0.5),
        vy: Math.sin(gun.angle) * sp + (Math.random() - 0.5),
        life: 1.0,
        decay: 0.035,
        col: 'rgba(214, 211, 209, 0.45)',
        size: Math.random() * 5 + 3,
      });
    }

    // Eject shell casing
    const ejectAngle = gun.angle - Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    s.ejectedShells.push({
      x: gun.x,
      y: gun.y,
      vx: Math.cos(ejectAngle) * (Math.random() * 3 + 2),
      vy: Math.sin(ejectAngle) * (Math.random() * 3 + 2),
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 12,
      life: 1.0,
    });

    // Strong Recoil
    const recoilImpulse = 9.8;
    gun.vx -= Math.cos(gun.angle) * recoilImpulse;
    gun.vy -= Math.sin(gun.angle) * recoilImpulse;

    // Rotational Torque
    const spinDir = Math.random() > 0.5 ? 1 : -1;
    const recoilTorque = (2.8 + Math.random() * 1.4) * spinDir;
    gun.spin += recoilTorque;

    playSound(isPlayer ? 'shoot_player' : 'shoot_cpu', soundRef.current);
  };

  const handleShoot = () => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current;
    if (!s) return;
    fireGun(s, true);
  };

  // ── 5. Main Canvas Render & Physics Loop ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const arena = arenaRef.current;
    if (!canvas || !arena) return;

    const ctx = canvas.getContext('2d');

    const resize = () => {
      const rect = arena.getBoundingClientRect();
      const W = Math.max(280, Math.floor(rect.width));
      const H = Math.max(380, Math.floor(rect.height));
      canvas.width = W;
      canvas.height = H;
      if (stateRef.current) {
        stateRef.current.W = W;
        stateRef.current.H = H;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const s = stateRef.current;
      if (!s) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const { W, H, player, cpu } = s;

      // Obstacles update
      s.obstacles.forEach((obs) => {
        if (obs.type === 'moving_x') {
          obs.time += dt * (obs.speed || 1.3);
          const range = W * 0.25;
          obs.currX = obs.pixelX + Math.sin(obs.time) * range;
        } else {
          obs.currX = obs.pixelX;
        }
      });

      // CPU AI Logic
      if (phaseRef.current === 'playing') {
        cpu.timer -= dt * 1000;
        const angleToPlayer = Math.atan2(player.y - cpu.y, player.x - cpu.x);
        const angleDiff = Math.abs(normAngle(cpu.angle - angleToPlayer));

        if (cpu.timer <= 0 && angleDiff < s.cfg.cpuTol) {
          fireGun(s, false);
          cpu.timer = s.cfg.cpuDelay + (Math.random() - 0.5) * 400;
        }
      }

      // Gun rigid-body physics
      const updateGun = (gun, baseSpinRate) => {
        gun.spin += (baseSpinRate - gun.spin) * 0.035;
        gun.angle += gun.spin * dt;
        gun.vx *= 0.984;
        gun.vy *= 0.984;
        gun.x += gun.vx;
        gun.y += gun.vy;

        const pad = gun.radius + 6;
        const restitution = 0.88;

        if (gun.x < pad) {
          gun.x = pad;
          gun.vx = Math.abs(gun.vx) * restitution;
          gun.spin += (Math.random() - 0.5) * 1.5;
        } else if (gun.x > W - pad) {
          gun.x = W - pad;
          gun.vx = -Math.abs(gun.vx) * restitution;
          gun.spin += (Math.random() - 0.5) * 1.5;
        }

        if (gun.y < pad) {
          gun.y = pad;
          gun.vy = Math.abs(gun.vy) * restitution;
          gun.spin += (Math.random() - 0.5) * 1.5;
        } else if (gun.y > H - pad) {
          gun.y = H - pad;
          gun.vy = -Math.abs(gun.vy) * restitution;
          gun.spin += (Math.random() - 0.5) * 1.5;
        }

        // Obstacles collision
        s.obstacles.forEach((obs) => {
          const ox = obs.currX - obs.pixelW / 2;
          const oy = obs.pixelY - obs.pixelH / 2;
          const ow = obs.pixelW;
          const oh = obs.pixelH;

          const cx = Math.max(ox, Math.min(gun.x, ox + ow));
          const cy = Math.max(oy, Math.min(gun.y, oy + oh));
          const dist = Math.hypot(gun.x - cx, gun.y - cy);

          if (dist < gun.radius) {
            const overlap = gun.radius - dist;
            const nx = (gun.x - cx) / (dist || 1);
            const ny = (gun.y - cy) / (dist || 1);
            gun.x += nx * overlap;
            gun.y += ny * overlap;
            gun.vx = nx * Math.abs(gun.vx) * restitution;
            gun.vy = ny * Math.abs(gun.vy) * restitution;
            gun.spin += (Math.random() - 0.5) * 2;
          }
        });

        if (gun.flash > 0) gun.flash--;

        // Ghosts for motion blur arc
        if (now - gun.lastGhostTs > 45) {
          gun.lastGhostTs = now;
          gun.ghosts.push({
            x: gun.x,
            y: gun.y,
            angle: gun.angle,
            length: gun.length,
            height: gun.height,
            alpha: 1.0,
          });
          if (gun.ghosts.length > 7) gun.ghosts.shift();
        }
        gun.ghosts.forEach((g) => { g.alpha -= 0.055; });
        gun.ghosts = gun.ghosts.filter((g) => g.alpha > 0.02);
      };

      updateGun(player, 1.6);
      updateGun(cpu, -1.5);

      // Bullets & ricochets
      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        b.trail.push({ x: b.x, y: b.y, alpha: 1.0 });
        if (b.trail.length > 6) b.trail.shift();

        let bounced = false;
        if (b.x < 8 || b.x > W - 8) {
          b.vx *= -0.92;
          b.x = Math.max(9, Math.min(W - 9, b.x));
          bounced = true;
        }
        if (b.y < 8 || b.y > H - 8) {
          b.vy *= -0.92;
          b.y = Math.max(9, Math.min(H - 9, b.y));
          bounced = true;
        }

        s.obstacles.forEach((obs) => {
          const ox = obs.currX - obs.pixelW / 2;
          const oy = obs.pixelY - obs.pixelH / 2;
          const ow = obs.pixelW;
          const oh = obs.pixelH;

          if (b.x >= ox && b.x <= ox + ow && b.y >= oy && b.y <= oy + oh) {
            bounced = true;
            const leftD = Math.abs(b.x - ox);
            const rightD = Math.abs(b.x - (ox + ow));
            const topD = Math.abs(b.y - oy);
            const bottomD = Math.abs(b.y - (oy + oh));
            const minD = Math.min(leftD, rightD, topD, bottomD);
            if (minD === leftD || minD === rightD) b.vx *= -0.9;
            else b.vy *= -0.9;
          }
        });

        if (bounced) {
          b.bounces++;
          playSound('ricochet', soundRef.current);
          for (let p = 0; p < 4; p++) {
            s.particles.push({
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              life: 1.0,
              decay: 0.12,
              col: '#fef08a',
              size: 2,
            });
          }
          if (b.bounces > b.maxBounces) {
            s.bullets.splice(i, 1);
            continue;
          }
        }

        // Hit Detection
        if (phaseRef.current === 'playing') {
          const target = b.isPlayer ? cpu : player;
          const dist = Math.hypot(b.x - target.x, b.y - target.y);

          if (dist < target.radius) {
            target.hp -= 1;
            target.flash = 12;
            s.screenShake = 6;
            playSound('hit', soundRef.current);

            // Floating skull damage token
            s.damageSkulls.push({
              x: target.x,
              y: target.y - 15,
              vy: -1.8,
              alpha: 1.0,
              col: b.isPlayer ? '#ef4444' : '#22c55e',
            });

            target.vx += b.vx * 0.35;
            target.vy += b.vy * 0.35;

            const hitCol = b.isPlayer ? '#ef4444' : activeSkin.col;
            for (let k = 0; k < 22; k++) {
              const a = Math.random() * Math.PI * 2;
              const sp = Math.random() * 7 + 2;
              s.particles.push({
                x: b.x,
                y: b.y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 1.0,
                decay: 0.045,
                col: hitCol,
                size: Math.random() * 3.5 + 1.5,
              });
            }

            s.bullets.splice(i, 1);
            setHud((h) => ({ ...h, playerHp: player.hp, cpuHp: cpu.hp }));

            // Outcomes
            if (cpu.hp <= 0) {
              setPhase('victory');
              playSound('win', soundRef.current);
              setCoins((prev) => {
                const next = prev + 50;
                localStorage.setItem('duel_coins', next.toString());
                return next;
              });
              setUnlockedLevels((prev) => {
                const next = Math.max(prev, s.cfg.level + 1);
                localStorage.setItem('duel_unlocked_level', next.toString());
                return next;
              });
            } else if (player.hp <= 0) {
              setPhase('failed');
              playSound('gameover', soundRef.current);
            }
          }
        }
      }

      // Particles & Shells update
      s.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.life -= p.decay;
      });
      s.particles = s.particles.filter((p) => p.life > 0.05);

      s.ejectedShells.forEach((sh) => {
        sh.x += sh.vx;
        sh.y += sh.vy;
        sh.vy += 0.2;
        sh.rot += sh.spin * dt;
        sh.life -= 0.02;
      });
      s.ejectedShells = s.ejectedShells.filter((sh) => sh.life > 0.05);

      s.damageSkulls.forEach((sk) => {
        sk.y += sk.vy;
        sk.alpha -= 0.025;
      });
      s.damageSkulls = s.damageSkulls.filter((sk) => sk.alpha > 0.05);

      // ── RENDERING ──────────────────────────────────────────────────────────
      ctx.save();

      if (s.screenShake > 0) {
        const sx = (Math.random() - 0.5) * s.screenShake;
        const sy = (Math.random() - 0.5) * s.screenShake;
        ctx.translate(sx, sy);
        s.screenShake *= 0.85;
        if (s.screenShake < 0.3) s.screenShake = 0;
      }

      // Background
      const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, H * 0.7);
      bgGrad.addColorStop(0, '#1c1f26');
      bgGrad.addColorStop(0.7, '#13161c');
      bgGrad.addColorStop(1, '#0b0d11');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle metallic grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      const step = 36;
      for (let x = 0; x < W; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Arena border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, W - 6, H - 6);

      // Obstacles
      s.obstacles.forEach((obs) => {
        const ox = obs.currX - obs.pixelW / 2;
        const oy = obs.pixelY - obs.pixelH / 2;
        const ow = obs.pixelW;
        const oh = obs.pixelH;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;

        const obsGrad = ctx.createLinearGradient(ox, oy, ox, oy + oh);
        obsGrad.addColorStop(0, '#334155');
        obsGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = obsGrad;
        ctx.beginPath();
        ctx.roundRect(ox, oy, ow, oh, [4, 4, 4, 4]);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });

      // Ghost motion trails
      const renderGhosts = (ghosts, colPrefix) => {
        ghosts.forEach((g) => {
          ctx.save();
          ctx.translate(g.x, g.y);
          ctx.rotate(g.angle);
          ctx.globalAlpha = g.alpha * 0.35;
          ctx.fillStyle = colPrefix + g.alpha * 0.6 + ')';
          ctx.strokeStyle = colPrefix + g.alpha * 0.8 + ')';
          ctx.lineWidth = 1;
          const GL = g.length, GH = g.height;
          ctx.strokeRect(-GL * 0.36, -GH * 0.55, GL * 0.86, GH * 0.55);
          ctx.fillRect(-GL * 0.36, -GH * 0.55, GL * 0.86, GH * 0.55);
          ctx.fillRect(-GL * 0.32, GH * 0.1, GL * 0.26, GH * 0.8);
          ctx.restore();
        });
      };
      renderGhosts(player.ghosts, activeSkin.trailCol);
      renderGhosts(cpu.ghosts, 'rgba(239, 68, 68, ');

      // Ejected shells
      s.ejectedShells.forEach((sh) => {
        ctx.save();
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.rot);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-2.5, -1, 5, 2.2);
        ctx.restore();
      });

      // Bullets & trails
      s.bullets.forEach((b) => {
        b.trail.forEach((t) => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = b.isPlayer ? activeSkin.trailCol + '0.35)' : 'rgba(239, 68, 68, 0.35)';
          ctx.fill();
        });

        ctx.save();
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Guns
      renderGun(ctx, player, activeSkin, true);
      renderGun(ctx, cpu, activeSkin, false);

      // Gun badges
      const renderBadge = (txt, gun, isPlayer) => {
        ctx.save();
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        const col = isPlayer ? activeSkin.col : '#ef4444';
        const badgeY = gun.y - gun.radius - 12;

        ctx.strokeStyle = col + '66';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(gun.x - 26, badgeY - 10, 52, 15, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.fillText(txt, gun.x, badgeY + 1);
        ctx.restore();
      };
      renderBadge('PLAYER', player, true);
      renderBadge('CPU', cpu, false);

      // Damage Skulls
      s.damageSkulls.forEach((sk) => {
        ctx.save();
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.max(0, sk.alpha);
        ctx.fillStyle = sk.col;
        ctx.fillText('💀', sk.x, sk.y);
        ctx.restore();
      });

      // Particles
      s.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [activeSkin]);

  // ── Purchase / Select Skin Helper ───────────────────────────────────────────
  const handleSelectSkin = (skin) => {
    playSound('click', soundRef.current);
    if (ownedSkins.includes(skin.id)) {
      setSelectedSkinId(skin.id);
      localStorage.setItem('duel_skin', skin.id);
    } else if (coins >= skin.price) {
      const nextCoins = coins - skin.price;
      const nextOwned = [...ownedSkins, skin.id];
      setCoins(nextCoins);
      setOwnedSkins(nextOwned);
      setSelectedSkinId(skin.id);
      localStorage.setItem('duel_coins', nextCoins.toString());
      localStorage.setItem('duel_owned_skins', JSON.stringify(nextOwned));
      localStorage.setItem('duel_skin', skin.id);
    }
  };

  const currentLevelCfg = LEVELS_CONFIG[Math.min(currentLevelIdx, LEVELS_CONFIG.length - 1)];

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 p-1 md:p-3 overflow-hidden select-none touch-none">
      {/* ── Main Smartphone Metallic Chassis ──────────────────────────────── */}
      <div
        className="relative w-full max-w-[420px] h-full max-h-[740px] bg-[#181a20] rounded-[38px] p-2.5 sm:p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] border-[3px] border-[#383d47] flex flex-col overflow-hidden"
        style={{
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.85)',
        }}
      >
        {/* Top Speaker Bezel & Status Bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-3.5 py-1.5 text-slate-400 text-xs border-b border-white/5 bg-[#121418] rounded-t-[26px]">
          <span className="font-extrabold tracking-wider text-slate-300 font-mono text-[11px]">
            {phase === 'playing' ? `LEVEL ${hud.level}` : 'RECOIL DUEL'}
          </span>

          {/* Speaker earpiece slit */}
          <div className="w-12 h-1.5 bg-black/60 rounded-full border border-white/10" />

          {/* Audio & Battery */}
          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={() => {
                playSound('click', soundRef.current);
                setSoundOn((s) => !s);
              }}
              className="text-slate-400 hover:text-white transition p-0.5"
            >
              <i className={`fa-solid ${soundOn ? 'fa-volume-high' : 'fa-volume-xmark text-red-400'}`} />
            </button>
            <span className="font-mono text-[10px] text-slate-500">🔋 85%</span>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            1. SPLASH SCREEN (Top Left in Reference Flow Map)
            ═════════════════════════════════════════════════════════════════════ */}
        {phase === 'splash' && (
          <div className="flex-1 flex flex-col items-center justify-between p-6 bg-gradient-to-b from-[#16181f] via-[#101216] to-[#0a0c0f] text-center">
            {/* Title */}
            <div className="mt-4">
              <h1
                className="text-2xl sm:text-3xl font-black text-white tracking-widest uppercase drop-shadow-md"
                style={{ fontFamily: 'Fredoka, sans-serif' }}
              >
                RECOIL DUEL
              </h1>
              <p className="text-emerald-400 text-xs tracking-widest font-bold uppercase mt-1">
                ARENA MASTER
              </p>
            </div>

            {/* Rotating Showcase Gun */}
            <div className="w-36 h-36 flex items-center justify-center relative">
              <canvas ref={splashGunRef} width={140} height={140} className="w-full h-full" />
            </div>

            {/* Detailed Segmented Loading Bar */}
            <div className="w-full max-w-xs flex flex-col items-center gap-2.5 mb-6">
              <div className="w-full bg-[#121418] border-2 border-[#383d47] p-1 rounded-xl shadow-inner flex items-center gap-1">
                {[...Array(14)].map((_, idx) => {
                  const filled = splashProgress >= (idx + 1) * (100 / 14);
                  return (
                    <div
                      key={idx}
                      className={`h-4 flex-1 rounded-[3px] transition-all duration-150 ${
                        filled
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_8px_#22c55e]'
                          : 'bg-[#1e222b]'
                      }`}
                    />
                  );
                })}
              </div>

              <span className="font-mono text-[10px] tracking-wider text-slate-400 uppercase animate-pulse">
                LOADING ARENA... (Level {currentLevelCfg.level})
              </span>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            2. MAIN MENU (Center Left in Reference Flow Map)
            ═════════════════════════════════════════════════════════════════════ */}
        {phase === 'menu' && (
          <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 bg-gradient-to-b from-[#1c1f26] via-[#14171d] to-[#0c0d12]">
            {/* Header / Coins */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="text-left">
                <h2
                  className="text-lg font-black text-white tracking-wider"
                  style={{ fontFamily: 'Fredoka, sans-serif' }}
                >
                  MAIN MENU
                </h2>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                  Level {unlockedLevels} / 12 Unlocked
                </span>
              </div>
              <div className="bg-black/50 px-3 py-1 rounded-full border border-yellow-500/30 flex items-center gap-1.5 text-yellow-400 font-bold text-xs">
                <span>🪙</span>
                <span>{coins}</span>
              </div>
            </div>

            {/* Center: Bullet Shaped PLAY Button & Options */}
            <div className="flex flex-col items-center gap-5 my-auto">
              {/* Bullet Shaped PLAY Button (Authentic metallic cartridge) */}
              <button
                onClick={() => {
                  playSound('click', soundRef.current);
                  initLevel(unlockedLevels - 1);
                }}
                className="relative group cursor-pointer active:scale-95 transition-transform"
              >
                <div
                  className="relative flex items-center h-16 w-64 rounded-l-2xl rounded-r-full shadow-2xl border-2 border-slate-400/50 overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 45%, #475569 55%, #1e293b 100%)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.7)',
                  }}
                >
                  {/* Cartridge Primer Groove */}
                  <div className="w-5 h-full border-r-2 border-slate-700/60 bg-gradient-to-r from-slate-400 to-slate-500" />

                  {/* Bullet Text */}
                  <span
                    className="flex-1 text-center font-black text-2xl tracking-widest text-slate-900 group-hover:text-black transition-colors"
                    style={{
                      fontFamily: 'Fredoka, sans-serif',
                      textShadow: '0 1px 1px rgba(255,255,255,0.8)',
                    }}
                  >
                    PLAY
                  </span>

                  {/* Copper Bullet Ogive Tip */}
                  <div
                    className="w-14 h-full rounded-r-full border-l-2 border-amber-900/50"
                    style={{
                      background: 'linear-gradient(180deg, #fed7aa 0%, #f97316 45%, #c2410c 60%, #7c2d12 100%)',
                    }}
                  />
                </div>
              </button>

              {/* Sub-panels (Music Toggle + Skins Button) */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                {/* Music Toggle Panel */}
                <div className="bg-[#121418] border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-between text-center shadow-lg">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold mb-1.5">
                    <i className="fa-solid fa-music text-emerald-400 text-xs" />
                    <span>MUSIC</span>
                  </div>
                  <button
                    onClick={() => {
                      playSound('click', soundRef.current);
                      setSoundOn((s) => !s);
                    }}
                    className={`w-14 h-7 rounded-full transition-colors relative cursor-pointer border ${
                      soundOn ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-700 border-slate-500'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform absolute top-0.5 ${
                        soundOn ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">
                    {soundOn ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* Skins Customization Button */}
                <button
                  onClick={() => {
                    playSound('click', soundRef.current);
                    setPhase('skins');
                  }}
                  className="bg-[#121418] border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-between text-center shadow-lg hover:border-emerald-500/50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold mb-1.5">
                    <i className="fa-solid fa-paint-roller text-cyan-400 text-xs" />
                    <span>SKINS</span>
                  </div>
                  {/* Miniature Bullet Texture Previews */}
                  <div className="flex items-center gap-1.5 my-1">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#22c55e]" />
                    <span className="w-3.5 h-3.5 rounded-full bg-yellow-500 shadow-[0_0_6px_#f59e0b]" />
                    <span className="w-3.5 h-3.5 rounded-full bg-cyan-500 shadow-[0_0_6px_#06b6d4]" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">CUSTOMIZE</span>
                </button>
              </div>

              {/* Level Selection Button */}
              <button
                onClick={() => {
                  playSound('click', soundRef.current);
                  setPhase('level_select');
                }}
                className="w-full max-w-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                <i className="fa-solid fa-layer-group text-emerald-400" />
                <span>SELECT LEVEL (1-12)</span>
              </button>
            </div>

            {/* Footer / Close */}
            <div className="text-center pt-2 border-t border-white/5">
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
                >
                  Back to Portal
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            3. LEVEL SELECTION (Center Right in Reference Flow Map)
            ═════════════════════════════════════════════════════════════════════ */}
        {phase === 'level_select' && (
          <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 bg-gradient-to-b from-[#1c1f26] via-[#14171d] to-[#0c0d12]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h2
                className="text-base sm:text-lg font-black text-white tracking-widest uppercase"
                style={{ fontFamily: 'Fredoka, sans-serif' }}
              >
                LEVEL SELECTION
              </h2>
              <button
                onClick={() => {
                  playSound('click', soundRef.current);
                  setPhase('menu');
                }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1 rounded-xl border border-white/10 transition cursor-pointer"
              >
                HOME
              </button>
            </div>

            {/* 12 Level Vault Grid with Metal Hinges & Heavy Padlocks */}
            <div className="grid grid-cols-4 gap-2 my-auto p-1.5 bg-[#101318] rounded-2xl border border-white/10 shadow-inner">
              {LEVELS_CONFIG.map((lvl, idx) => {
                const isUnlocked = idx + 1 <= unlockedLevels;
                const isCurrent = idx + 1 === unlockedLevels;

                return (
                  <button
                    key={lvl.level}
                    disabled={!isUnlocked}
                    onClick={() => {
                      playSound('click', soundRef.current);
                      initLevel(idx);
                    }}
                    className={`relative aspect-square rounded-xl flex flex-col items-center justify-center p-1 transition-all ${
                      isCurrent
                        ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 border-2 border-emerald-400 shadow-[0_0_12px_#22c55e] cursor-pointer'
                        : isUnlocked
                        ? 'bg-[#1e232d] hover:bg-[#282f3d] border border-emerald-500/40 text-emerald-400 cursor-pointer'
                        : 'bg-[#15171d] border border-white/5 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {/* Metal Hinge Accents */}
                    <span className="absolute left-0.5 top-1.5 w-1 h-2 bg-slate-500/40 rounded-sm" />
                    <span className="absolute left-0.5 bottom-1.5 w-1 h-2 bg-slate-500/40 rounded-sm" />

                    {isUnlocked ? (
                      <>
                        <span className="text-base sm:text-lg font-black text-white font-mono leading-none">
                          {lvl.level}
                        </span>
                        {idx + 1 < unlockedLevels ? (
                          <span className="text-[10px] text-emerald-400 mt-1">✓</span>
                        ) : (
                          <span className="text-[9px] text-emerald-200 font-bold uppercase mt-1">PLAY</span>
                        )}
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-lock text-sm sm:text-base text-slate-500 mb-0.5" />
                        <span className="text-[10px] font-mono text-slate-500">{lvl.level}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Progressive Difficulty Skull Meter (Directly matches reference map) */}
            <div className="bg-[#121418] border border-white/10 rounded-2xl p-3 flex flex-col gap-1.5 shadow-lg">
              <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <span className="flex items-center gap-1 text-emerald-400">
                  <i className="fa-solid fa-skull" /> EASY
                </span>
                <span className="text-[10px] text-slate-400">PROGRESSIVE DIFFICULTY</span>
                <span className="flex items-center gap-1 text-red-500">
                  HARD <i className="fa-solid fa-skull" />
                </span>
              </div>

              {/* Multi-color difficulty gradient bar */}
              <div className="relative w-full h-3 rounded-full overflow-hidden bg-black/60 border border-white/10">
                <div
                  className="h-full w-full"
                  style={{
                    background: 'linear-gradient(90deg, #22c55e 0%, #eab308 45%, #f97316 75%, #ef4444 100%)',
                  }}
                />
                {/* Pointer marker based on current unlocked level */}
                <div
                  className="absolute top-0 bottom-0 w-2.5 bg-white border border-black shadow-md rounded-full -translate-x-1/2 transition-all duration-300"
                  style={{
                    left: `${Math.min(100, (unlockedLevels / 12) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            SKINS CUSTOMIZATION PANEL
            ═════════════════════════════════════════════════════════════════════ */}
        {phase === 'skins' && (
          <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 bg-gradient-to-b from-[#1c1f26] via-[#14171d] to-[#0c0d12]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h2
                className="text-base sm:text-lg font-black text-white tracking-widest uppercase"
                style={{ fontFamily: 'Fredoka, sans-serif' }}
              >
                GUN ARMORY
              </h2>
              <div className="bg-black/50 px-2.5 py-0.5 rounded-full border border-yellow-500/30 flex items-center gap-1 text-yellow-400 font-bold text-xs">
                <span>🪙</span>
                <span>{coins}</span>
              </div>
            </div>

            {/* Skin Cards */}
            <div className="flex flex-col gap-2.5 my-auto overflow-y-auto max-h-[420px] pr-1">
              {SKINS_CATALOG.map((skin) => {
                const isOwned = ownedSkins.includes(skin.id);
                const isEquipped = selectedSkinId === skin.id;

                return (
                  <div
                    key={skin.id}
                    onClick={() => handleSelectSkin(skin)}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isEquipped
                        ? 'bg-[#18231c] border-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                        : isOwned
                        ? 'bg-[#14171e] hover:bg-[#1a1f28] border-white/10'
                        : 'bg-[#121418] border-white/5 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-7 h-7 rounded-xl shadow-md border border-white/20"
                        style={{ backgroundColor: skin.col }}
                      />
                      <div className="text-left">
                        <div className="text-sm font-black text-white">{skin.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {isEquipped ? 'Currently Equipped' : isOwned ? 'Owned' : `${skin.price} Coins`}
                        </div>
                      </div>
                    </div>

                    <div>
                      {isEquipped ? (
                        <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-3 py-1 rounded-full uppercase">
                          EQUIPPED
                        </span>
                      ) : isOwned ? (
                        <span className="text-[10px] bg-slate-700 text-white font-bold px-3 py-1 rounded-full uppercase">
                          EQUIP
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1 ${
                            coins >= skin.price
                              ? 'bg-yellow-500 text-slate-950'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          🪙 {skin.price}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                playSound('click', soundRef.current);
                setPhase('menu');
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              BACK TO MENU
            </button>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            4. ACTIVE GAMEPLAY ARENA (Multi-Panel Sequence in Reference Map)
            ═════════════════════════════════════════════════════════════════════ */}
        {(phase === 'playing' || phase === 'victory' || phase === 'failed') && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Combat Header: P1 HP vs CPU HP */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-[#14171d] border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-extrabold text-[11px] tracking-wide">P1</span>
                <div className="flex gap-0.5">
                  {[...Array(3)].map((_, i) => (
                    <span
                      key={i}
                      className={`text-sm transition-colors ${
                        i < hud.playerHp ? 'text-emerald-400 drop-shadow-[0_0_6px_#22c55e]' : 'text-slate-700'
                      }`}
                    >
                      ♥
                    </span>
                  ))}
                </div>
              </div>

              {/* Skull Meter Mini Badge */}
              <div className="bg-black/50 px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                <span className="text-emerald-400">LVL {hud.level}</span>
                <span>·</span>
                <span className="text-yellow-400">🪙 {coins}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[...Array(hud.cpuHp)].map((_, i) => (
                    <span key={i} className="text-sm text-red-500 drop-shadow-[0_0_6px_#ef4444]">
                      ♥
                    </span>
                  ))}
                </div>
                <span className="text-red-400 font-extrabold text-[11px] tracking-wide">CPU</span>
              </div>
            </div>

            {/* Canvas Area */}
            <div
              ref={arenaRef}
              onClick={handleShoot}
              className="flex-1 relative overflow-hidden bg-black cursor-crosshair active:scale-[0.998] transition-transform"
              style={{ minHeight: 0 }}
            >
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

              {/* ═════════════════════════════════════════════════════════════
                  5. OUTCOME SCREENS (Top Right in Reference Flow Map)
                  ═════════════════════════════════════════════════════════════ */}

              {/* VICTORY Screen (Level-Up Logic, +50 Coins, Next Level) */}
              {phase === 'victory' && (
                <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-5 text-center animate-fade-in">
                  <div className="text-5xl animate-bounce mb-1.5">🏆</div>
                  <h3
                    className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-wider mb-0.5"
                    style={{ fontFamily: 'Fredoka, sans-serif' }}
                  >
                    VICTORY!
                  </h3>
                  <p className="text-slate-300 text-xs font-semibold mb-3">
                    LEVEL {currentLevelCfg.level} CLEAR
                  </p>

                  {/* Coins reward badge */}
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-5 py-2 mb-4 flex items-center gap-2 text-yellow-400 font-black text-sm shadow-lg shadow-yellow-500/10">
                    <span className="text-lg">🪙</span>
                    <span>+50 COINS</span>
                  </div>

                  {/* Action buttons matching reference map */}
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    {currentLevelCfg.level < 12 ? (
                      <button
                        onClick={() => {
                          playSound('click', soundRef.current);
                          initLevel(currentLevelIdx + 1);
                        }}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black py-3 px-5 rounded-2xl text-xs sm:text-sm shadow-xl shadow-emerald-500/30 hover:brightness-110 active:scale-95 transition cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
                      >
                        NEXT LEVEL (Level {currentLevelCfg.level + 1}) →
                      </button>
                    ) : (
                      <div className="bg-amber-500/20 text-amber-300 font-black py-2 rounded-xl text-xs uppercase border border-amber-500/40">
                        ⭐ ALL 12 LEVELS MASTERED! ⭐
                      </div>
                    )}

                    <button
                      onClick={() => {
                        playSound('click', soundRef.current);
                        initLevel(currentLevelIdx);
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                    >
                      REPLAY LEVEL {currentLevelCfg.level}
                    </button>

                    <button
                      onClick={() => {
                        playSound('click', soundRef.current);
                        setPhase('menu');
                      }}
                      className="w-full bg-transparent hover:bg-white/5 text-slate-400 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
                    >
                      HOME
                    </button>
                  </div>
                </div>
              )}

              {/* FAILED Screen (CPU Got You, Retry, Home) */}
              {phase === 'failed' && (
                <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-5 text-center animate-fade-in">
                  <div className="text-5xl mb-2">💀</div>
                  <h3
                    className="text-2xl sm:text-3xl font-black text-red-500 tracking-wider mb-0.5"
                    style={{ fontFamily: 'Fredoka, sans-serif' }}
                  >
                    FAILED!
                  </h3>
                  <div className="text-slate-400 text-xs font-semibold mb-1">
                    LEVEL {currentLevelCfg.level}
                  </div>
                  <p className="text-red-400 font-black text-xs uppercase tracking-widest mb-5">
                    CPU GOT YOU!
                  </p>

                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <button
                      onClick={() => {
                        playSound('click', soundRef.current);
                        initLevel(currentLevelIdx);
                      }}
                      className="w-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-black py-3 px-5 rounded-2xl text-xs sm:text-sm shadow-xl shadow-red-500/30 hover:brightness-110 active:scale-95 transition cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-rotate-left" /> RETRY LEVEL {currentLevelCfg.level}
                    </button>

                    <button
                      onClick={() => {
                        playSound('click', soundRef.current);
                        setPhase('menu');
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                    >
                      HOME
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Bezel with Instructional Helper (Matches Panel A & B Prompts) */}
            <div className="flex-shrink-0 py-2.5 px-3 bg-[#121418] rounded-b-[26px] border-t border-white/5 text-center flex flex-col items-center justify-center">
              <p className="text-[10px] sm:text-[11px] font-black tracking-widest text-slate-400 uppercase animate-pulse">
                TAP TO SHOOT — MASTER THE RECOIL FOR THE NEXT LEVEL!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
