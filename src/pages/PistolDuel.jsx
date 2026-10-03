import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════════
   PISTOL DUEL — Hyper-Casual Portrait Mobile Physics Duel
   Inspired by recoil-based timing mechanics & premium dark mobile aesthetics:
   - Green Player Gun vs Red CPU Gun inside closed portrait phone arena
   - Guns rotate continuously through physics; tap anywhere fires in muzzle direction
   - Strong recoil force + rotational torque on every shot
   - Small gun footprint (~14% frame width) with rigid-body boundaries & obstacles
   - 10 Levels with moving obstacles, ricocheting bullets, coins, and sound FX
   ═══════════════════════════════════════════════════════════════════════════════ */

// ── Level Configurations (10 Levels) ──────────────────────────────────────────
const LEVELS_CONFIG = [
  { level: 1,  name: 'Recoil 101',      cpuHp: 2, cpuDelay: 2200, cpuTol: 0.55, obstacles: [] },
  { level: 2,  name: 'Gunner Duel',     cpuHp: 2, cpuDelay: 1900, cpuTol: 0.48, obstacles: [] },
  { level: 3,  name: 'Center Pillar',   cpuHp: 3, cpuDelay: 1700, cpuTol: 0.42, obstacles: [{ x: 0.5, y: 0.5, w: 0.22, h: 0.04, type: 'rect' }] },
  { level: 4,  name: 'Quickdraw',       cpuHp: 3, cpuDelay: 1500, cpuTol: 0.38, obstacles: [] },
  { level: 5,  name: 'Ledge Divide',    cpuHp: 3, cpuDelay: 1400, cpuTol: 0.34, obstacles: [{ x: 0.65, y: 0.48, w: 0.38, h: 0.035, type: 'rect' }] },
  { level: 6,  name: 'Ricochet Zone',   cpuHp: 3, cpuDelay: 1300, cpuTol: 0.30, obstacles: [{ x: 0.5, y: 0.38, w: 0.18, h: 0.04, type: 'rect' }, { x: 0.5, y: 0.62, w: 0.18, h: 0.04, type: 'rect' }] },
  { level: 7,  name: 'Twin Ledges',     cpuHp: 4, cpuDelay: 1200, cpuTol: 0.26, obstacles: [{ x: 0.3, y: 0.42, w: 0.32, h: 0.035, type: 'rect' }, { x: 0.7, y: 0.58, w: 0.32, h: 0.035, type: 'rect' }] },
  { level: 8,  name: 'Sharpshooter',    cpuHp: 4, cpuDelay: 1100, cpuTol: 0.22, obstacles: [{ x: 0.5, y: 0.5, w: 0.24, h: 0.24, type: 'diamond' }] },
  { level: 9,  name: 'Sliding Hazard',  cpuHp: 4, cpuDelay: 1000, cpuTol: 0.20, obstacles: [{ x: 0.5, y: 0.5, w: 0.30, h: 0.04, type: 'moving_x', speed: 1.2 }] },
  { level: 10, name: 'Cyber Legend',    cpuHp: 5, cpuDelay: 850,  cpuTol: 0.16, obstacles: [{ x: 0.5, y: 0.5, w: 0.32, h: 0.04, type: 'moving_x', speed: 1.6 }, { x: 0.5, y: 0.32, w: 0.20, h: 0.03, type: 'rect' }, { x: 0.5, y: 0.68, w: 0.20, h: 0.03, type: 'rect' }] },
];

// ── Synthesized Web Audio System ──────────────────────────────────────────────
let globalAudioCtx = null;
function getAudioCtx() {
  try {
    if (!globalAudioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) globalAudioCtx = new AudioContextClass();
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
      // Punchy metallic gunshot with quick frequency drop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.14);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === 'shoot_cpu') {
      // Deeper CPU firing tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.16);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'ricochet') {
      // High metallic ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'hit') {
      // Impact explosion / crunch
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'win') {
      // Ascending victory chord
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
      // Descending defeat note
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.5);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'coin') {
      // Sparkly coin pickup
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {}
}

// ── Helper Math Functions ─────────────────────────────────────────────────────
function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ── Draw Realistic 2D Gun (Small footprint ~14% frame width) ─────────────────
function renderGunModel(ctx, gun, isPlayer) {
  const GL = gun.length;
  const GH = gun.height;
  const col = isPlayer ? '#22c55e' : '#ef4444'; // Green Player, Red CPU
  const accent = isPlayer ? '#15803d' : '#991b1b';
  const highlight = isPlayer ? '#86efac' : '#fca5a5';

  ctx.save();
  ctx.translate(gun.x, gun.y);
  ctx.rotate(gun.angle);

  // Hit flash blinking
  if (gun.flash > 0 && Math.floor(gun.flash / 3) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  // Gun Drop Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;

  // 1. Grip / Handle (Dark textured metal)
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.roundRect(-GL * 0.32, GH * 0.1, GL * 0.28, GH * 0.85, [2, 2, 5, 5]);
  ctx.fill();

  // Grip checkering lines
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-GL * 0.3, GH * 0.35);
  ctx.lineTo(-GL * 0.08, GH * 0.35);
  ctx.moveTo(-GL * 0.3, GH * 0.6);
  ctx.lineTo(-GL * 0.08, GH * 0.6);
  ctx.stroke();

  // 2. Trigger Guard & Trigger
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(-GL * 0.02, GH * 0.28, GH * 0.28, 0, Math.PI);
  ctx.stroke();

  // Trigger
  ctx.strokeStyle = '#e7e5e4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-GL * 0.04, GH * 0.12);
  ctx.lineTo(-GL * 0.01, GH * 0.32);
  ctx.stroke();

  // 3. Lower Receiver (Colored metallic finish)
  ctx.fillStyle = accent;
  ctx.fillRect(-GL * 0.35, -GH * 0.1, GL * 0.65, GH * 0.45);

  // 4. Slide / Upper Barrel (Glossy Colored Metal)
  ctx.shadowBlur = 0;
  const slideGrad = ctx.createLinearGradient(0, -GH * 0.55, 0, GH * 0.15);
  slideGrad.addColorStop(0, highlight);
  slideGrad.addColorStop(0.35, col);
  slideGrad.addColorStop(1, accent);
  ctx.fillStyle = slideGrad;
  ctx.beginPath();
  ctx.roundRect(-GL * 0.36, -GH * 0.55, GL * 0.86, GH * 0.55, [3, 2, 2, 3]);
  ctx.fill();

  // Slide serrations (rear grooves)
  ctx.fillStyle = '#0f172a';
  for (let s = -GL * 0.32; s < -GL * 0.16; s += 3.5) {
    ctx.fillRect(s, -GH * 0.5, 1.8, GH * 0.4);
  }

  // 5. Extended Steel Barrel Tip
  ctx.fillStyle = '#262626';
  ctx.fillRect(GL * 0.5, -GH * 0.35, GL * 0.12, GH * 0.3);

  // Muzzle Crown Ring
  ctx.fillStyle = '#e5e5e5';
  ctx.beginPath();
  ctx.arc(GL * 0.62, -GH * 0.2, GH * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Front Sight & Rear Sight
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(GL * 0.46, -GH * 0.66, 2.5, 3.5); // Front sight
  ctx.fillRect(-GL * 0.34, -GH * 0.66, 2.5, 3.5); // Rear sight

  // Ejection Port
  ctx.fillStyle = '#171717';
  ctx.fillRect(-GL * 0.05, -GH * 0.52, GL * 0.22, GH * 0.22);

  // 6. Laser Guide Line (subtle faint laser for aiming read)
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

// ── Draw Motion Ghost / Trail (Matches Reference Image) ───────────────────────
function renderGhostTrails(ctx, ghosts, isPlayer) {
  const col = isPlayer ? 'rgba(34, 197, 94, ' : 'rgba(239, 68, 68, ';
  ghosts.forEach((g) => {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    ctx.globalAlpha = g.alpha * 0.35;
    ctx.fillStyle = col + g.alpha * 0.6 + ')';
    ctx.strokeStyle = col + g.alpha * 0.8 + ')';
    ctx.lineWidth = 1;

    // Simplified wireframe/ghost shape
    const GL = g.length;
    const GH = g.height;
    ctx.strokeRect(-GL * 0.36, -GH * 0.55, GL * 0.86, GH * 0.55);
    ctx.fillRect(-GL * 0.36, -GH * 0.55, GL * 0.86, GH * 0.55);
    ctx.fillRect(-GL * 0.32, GH * 0.1, GL * 0.26, GH * 0.8);
    ctx.restore();
  });
}

export default function PistolDuel({ onClose }) {
  // References
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const animFrameRef = useRef(null);
  const stateRef     = useRef(null);
  const phaseRef     = useRef('start'); // 'start' | 'playing' | 'win' | 'gameover'
  const soundRef     = useRef(true);

  // Component State for UI Overlays
  const [phase, setPhase]     = useState('start');
  const [levelIdx, setLevelIdx] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [coins, setCoins]     = useState(() => {
    return parseInt(localStorage.getItem('duel_coins') || '150', 10);
  });
  const [hud, setHud]         = useState({ playerHp: 3, cpuHp: 2, level: 1, name: 'Recoil 101' });

  // Update phase helper
  const setGamePhase = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const toggleSound = () => {
    soundRef.current = !soundRef.current;
    setSoundOn(soundRef.current);
  };

  // ── Spawn Gun Initial State ───────────────────────────────────────────────
  const initLevelState = useCallback((lIdx, W, H) => {
    const cfg = LEVELS_CONFIG[Math.min(lIdx, LEVELS_CONFIG.length - 1)];

    // Target gun size: approximately 14-16% of gameplay frame width
    const gunWidth = Math.max(38, Math.min(56, W * 0.15));
    const gunHeight = gunWidth * 0.44;
    const collisionRadius = gunWidth * 0.48;

    // Player Gun (Green) - Spawns in bottom half, pointing slightly right/up
    const player = {
      x: W * 0.32,
      y: H * 0.72,
      vx: 0,
      vy: 0,
      angle: -0.2,               // Facing right-up
      spin: 1.8,                 // Natural continuous rotation
      length: gunWidth,
      height: gunHeight,
      radius: collisionRadius,
      hp: 3,
      maxHp: 3,
      flash: 0,
      ghosts: [],
      lastGhostTs: 0,
    };

    // CPU Gun (Red) - Spawns in top half, pointing left/down
    const cpu = {
      x: W * 0.68,
      y: H * 0.28,
      vx: 0,
      vy: 0,
      angle: Math.PI - 0.2,
      spin: -1.7,                // Natural continuous rotation in opposite direction
      length: gunWidth,
      height: gunHeight,
      radius: collisionRadius,
      hp: cfg.cpuHp,
      maxHp: cfg.cpuHp,
      flash: 0,
      ghosts: [],
      lastGhostTs: 0,
      timer: cfg.cpuDelay,
    };

    // Convert obstacle definitions to current screen dimensions
    const obstacles = cfg.obstacles.map((obs) => ({
      ...obs,
      pixelX: obs.x * W,
      pixelY: obs.y * H,
      pixelW: obs.w * W,
      pixelH: obs.h * H,
      currX: obs.x * W,
      time: 0,
    }));

    return {
      cfg,
      W,
      H,
      player,
      cpu,
      bullets: [],
      particles: [],
      ejectedShells: [],
      obstacles,
      screenShake: 0,
    };
  }, []);

  // ── Fire Gun Physics Action ───────────────────────────────────────────────
  const fireGun = (s, isPlayer) => {
    const gun = isPlayer ? s.player : s.cpu;

    // 1. Muzzle position calculation
    const muzzleDist = gun.length * 0.62;
    const muzzleX = gun.x + Math.cos(gun.angle) * muzzleDist;
    const muzzleY = gun.y + Math.sin(gun.angle) * muzzleDist;

    // 2. Spawn bullet traveling in CURRENT muzzle direction
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

    // 3. Muzzle Flash & Sparks
    for (let i = 0; i < 9; i++) {
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

    // 4. Barrel Smoke Puff
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

    // 5. Eject Brass Shell Casing
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

    // 6. Strong Recoil Force opposite to bullet direction
    const recoilImpulse = 9.8;
    gun.vx -= Math.cos(gun.angle) * recoilImpulse;
    gun.vy -= Math.sin(gun.angle) * recoilImpulse;

    // 7. Rotational Torque kick (gun spins dynamically with recoil)
    const spinDir = Math.random() > 0.5 ? 1 : -1;
    const recoilTorque = (2.8 + Math.random() * 1.4) * spinDir;
    gun.spin += recoilTorque;

    // Audio trigger
    playSound(isPlayer ? 'shoot_player' : 'shoot_cpu', soundRef.current);
  };

  // ── Start / Retry Level ───────────────────────────────────────────────────
  const startLevel = useCallback((lIdx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;

    const s = initLevelState(lIdx, W, H);
    stateRef.current = s;
    setLevelIdx(lIdx);
    setHud({
      playerHp: s.player.hp,
      cpuHp: s.cpu.hp,
      level: s.cfg.level,
      name: s.cfg.name,
    });
    setGamePhase('playing');
  }, [initLevelState]);

  // ── Handle Tap / Click to Shoot ───────────────────────────────────────────
  const handlePlayerShoot = () => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current;
    if (!s) return;
    fireGun(s, true);
  };

  // ── Next Level Progression ────────────────────────────────────────────────
  const nextLevel = () => {
    const nextIdx = (levelIdx + 1) % LEVELS_CONFIG.length;
    startLevel(nextIdx);
  };

  // ── Game Canvas & Physics Loop ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');

    // Sizing: Fixed portrait mobile frame (e.g. 9:16 aspect ratio or container bounds)
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const W = Math.max(280, Math.floor(rect.width));
      const H = Math.max(380, Math.floor(rect.height));
      canvas.width = W;
      canvas.height = H;

      if (!stateRef.current) {
        stateRef.current = initLevelState(0, W, H);
      } else {
        stateRef.current.W = W;
        stateRef.current.H = H;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let lastTime = performance.now();

    // ── MAIN TICK & RENDER ─────────────────────────────────────────────────
    const tick = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const s = stateRef.current;
      if (!s) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const { W, H, player, cpu } = s;

      // 1. UPDATE MOVING OBSTACLES
      s.obstacles.forEach((obs) => {
        if (obs.type === 'moving_x') {
          obs.time += dt * (obs.speed || 1.2);
          const range = W * 0.25;
          obs.currX = obs.pixelX + Math.sin(obs.time) * range;
        } else {
          obs.currX = obs.pixelX;
        }
      });

      // 2. CPU AI LOGIC
      if (phaseRef.current === 'playing') {
        cpu.timer -= dt * 1000;

        // Angle from CPU to Player
        const angleToPlayer = Math.atan2(player.y - cpu.y, player.x - cpu.x);
        const angleDiff = Math.abs(normAngle(cpu.angle - angleToPlayer));

        // CPU shoots when muzzle points roughly toward player and timer is ready
        if (cpu.timer <= 0 && angleDiff < s.cfg.cpuTol) {
          fireGun(s, false);
          cpu.timer = s.cfg.cpuDelay + (Math.random() - 0.5) * 400;
        }
      }

      // 3. GUN RIGID-BODY PHYSICS & ROTATION
      const updateGunPhysics = (gun, baseSpinRate) => {
        // Natural continuous baseline rotation + drag decay toward baseline
        gun.spin += (baseSpinRate - gun.spin) * 0.035;
        gun.angle += gun.spin * dt;

        // Air Drag damping
        gun.vx *= 0.984;
        gun.vy *= 0.984;

        // Position integration
        gun.x += gun.vx;
        gun.y += gun.vy;

        // Closed Rectangular Arena Boundaries (Invisible Bouncy Walls)
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

        // Obstacle Collisions for Gun
        s.obstacles.forEach((obs) => {
          const ox = obs.currX - obs.pixelW / 2;
          const oy = obs.pixelY - obs.pixelH / 2;
          const ow = obs.pixelW;
          const oh = obs.pixelH;

          // Closest point on obstacle
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

        // Flash timer
        if (gun.flash > 0) gun.flash--;

        // Motion blur ghost recording (every ~50ms while spinning)
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

        // Decay ghosts
        gun.ghosts.forEach((g) => {
          g.alpha -= 0.055;
        });
        gun.ghosts = gun.ghosts.filter((g) => g.alpha > 0.02);
      };

      updateGunPhysics(player, 1.6); // Green gun base clockwise spin
      updateGunPhysics(cpu, -1.5);   // Red gun base counter-clockwise spin

      // 4. BULLETS MOVEMENT, RICOCHET & HIT DETECTION
      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // Trail recording
        b.trail.push({ x: b.x, y: b.y, alpha: 1.0 });
        if (b.trail.length > 6) b.trail.shift();

        // Boundary Ricochet
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

        // Obstacle Ricochet
        s.obstacles.forEach((obs) => {
          const ox = obs.currX - obs.pixelW / 2;
          const oy = obs.pixelY - obs.pixelH / 2;
          const ow = obs.pixelW;
          const oh = obs.pixelH;

          if (b.x >= ox && b.x <= ox + ow && b.y >= oy && b.y <= oy + oh) {
            bounced = true;
            // Reflect based on closest face
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

          // Ricochet sparks
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

        // Bullet Hit Gun Target Detection
        if (phaseRef.current === 'playing') {
          const target = b.isPlayer ? cpu : player;
          const dist = Math.hypot(b.x - target.x, b.y - target.y);

          if (dist < target.radius) {
            // Hit!
            target.hp -= 1;
            target.flash = 12;
            s.screenShake = 6;
            playSound('hit', soundRef.current);

            // Impact impulse
            target.vx += b.vx * 0.35;
            target.vy += b.vy * 0.35;

            // Explosion sparks
            const hitColor = b.isPlayer ? '#ef4444' : '#22c55e';
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
                col: hitColor,
                size: Math.random() * 3.5 + 1.5,
              });
            }

            s.bullets.splice(i, 1);

            // Update HUD
            setHud((h) => ({ ...h, playerHp: player.hp, cpuHp: cpu.hp }));

            // Check Win / Lose
            if (cpu.hp <= 0) {
              setGamePhase('win');
              playSound('win', soundRef.current);
              setCoins((c) => {
                const updated = c + 50;
                localStorage.setItem('duel_coins', updated.toString());
                return updated;
              });
            } else if (player.hp <= 0) {
              setGamePhase('gameover');
              playSound('gameover', soundRef.current);
            }
          }
        }
      }

      // 5. UPDATE PARTICLES & SHELLS
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
        sh.vy += 0.2; // gravity
        sh.rot += sh.spin * dt;
        sh.life -= 0.02;
      });
      s.ejectedShells = s.ejectedShells.filter((sh) => sh.life > 0.05);

      // ── DRAWING SCENE ──────────────────────────────────────────────────────
      ctx.save();

      // Screen Shake
      if (s.screenShake > 0) {
        const sx = (Math.random() - 0.5) * s.screenShake;
        const sy = (Math.random() - 0.5) * s.screenShake;
        ctx.translate(sx, sy);
        s.screenShake *= 0.85;
        if (s.screenShake < 0.3) s.screenShake = 0;
      }

      // 1. Dark Metallic Textured Arena Floor
      const arenaGrad = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, H * 0.7);
      arenaGrad.addColorStop(0, '#1c1f26');
      arenaGrad.addColorStop(0.7, '#13161c');
      arenaGrad.addColorStop(1, '#0b0d11');
      ctx.fillStyle = arenaGrad;
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

      // Outer Arena Border Inner Shadow
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, W - 6, H - 6);

      // 2. Arena Obstacles (Dark brushed metal with neon edges)
      s.obstacles.forEach((obs) => {
        const ox = obs.currX - obs.pixelW / 2;
        const oy = obs.pixelY - obs.pixelH / 2;
        const ow = obs.pixelW;
        const oh = obs.pixelH;

        ctx.save();
        // Obstacle shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;

        // Obstacle body
        const obsGrad = ctx.createLinearGradient(ox, oy, ox, oy + oh);
        obsGrad.addColorStop(0, '#334155');
        obsGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = obsGrad;
        ctx.beginPath();
        ctx.roundRect(ox, oy, ow, oh, [4, 4, 4, 4]);
        ctx.fill();

        // Neon outline
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
      });

      // 3. Render Motion Blur Ghosts
      renderGhostTrails(ctx, player.ghosts, true);
      renderGhostTrails(ctx, cpu.ghosts, false);

      // 4. Render Ejected Shell Casings
      s.ejectedShells.forEach((sh) => {
        ctx.save();
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.rot);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-2.5, -1, 5, 2.2);
        ctx.restore();
      });

      // 5. Render Bullets & Glowing Trails
      s.bullets.forEach((b) => {
        // Trail
        b.trail.forEach((t) => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = b.isPlayer ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)';
          ctx.fill();
        });

        // Golden metallic bullet head
        ctx.save();
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 6. Render Guns
      renderGunModel(ctx, player, true);
      renderGunModel(ctx, cpu, false);

      // Labels over guns (Inspired by reference screenshot)
      const renderLabel = (text, gun, isPlayer) => {
        ctx.save();
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = isPlayer ? '#4ade80' : '#f87171';
        ctx.shadowColor = isPlayer ? 'rgba(74, 222, 128, 0.6)' : 'rgba(248, 113, 113, 0.6)';
        ctx.shadowBlur = 8;

        // Pill badge
        const badgeY = gun.y - gun.radius - 12;
        ctx.strokeStyle = isPlayer ? 'rgba(74, 222, 128, 0.4)' : 'rgba(248, 113, 113, 0.4)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(gun.x - 26, badgeY - 10, 52, 15, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isPlayer ? '#4ade80' : '#f87171';
        ctx.fillText(text, gun.x, badgeY + 1);
        ctx.restore();
      };

      renderLabel('PLAYER', player, true);
      renderLabel('CPU', cpu, false);

      // 7. Render Particles
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

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [initLevelState]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 p-1 md:p-3 overflow-hidden select-none touch-none">
      {/* ── Outer Mobile Smartphone Chassis (Matches reference visual style) ── */}
      <div
        className="relative w-full max-w-[420px] h-full max-h-[740px] bg-[#181a20] rounded-[36px] p-2.5 sm:p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] border-[3px] border-[#383d47] flex flex-col overflow-hidden"
        style={{
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.85)',
        }}
      >
        {/* Phone Top Bezel with Speaker Slit & Sensors */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 text-slate-400 text-xs border-b border-white/5 bg-[#121418] rounded-t-[24px]">
          <span className="font-extrabold tracking-wider text-slate-300 font-mono text-[11px]">
            LEVEL {hud.level}
          </span>

          {/* Speaker earpiece slit */}
          <div className="w-12 h-1.5 bg-black/60 rounded-full border border-white/10" />

          {/* Sound & Battery indicators */}
          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={toggleSound}
              className="text-slate-400 hover:text-white transition p-0.5"
            >
              <i className={`fa-solid ${soundOn ? 'fa-volume-high' : 'fa-volume-xmark text-red-400'}`} />
            </button>
            <span className="font-mono text-[10px] text-slate-500">🔋 85%</span>
          </div>
        </div>

        {/* ── Combat Header (Player HP vs CPU HP + Coins) ────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-[#14171d] border-b border-white/5">
          {/* Player HP (Green) */}
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

          {/* Coins Display */}
          <div className="bg-black/40 px-2.5 py-0.5 rounded-full border border-yellow-500/20 flex items-center gap-1.5 text-yellow-400 font-bold text-xs">
            <span className="text-sm">🪙</span>
            <span>{coins}</span>
          </div>

          {/* CPU HP (Red) */}
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[...Array(hud.cpuHp)].map((_, i) => (
                <span
                  key={i}
                  className="text-sm text-red-500 drop-shadow-[0_0_6px_#ef4444]"
                >
                  ♥
                </span>
              ))}
            </div>
            <span className="text-red-400 font-extrabold text-[11px] tracking-wide">CPU</span>
          </div>
        </div>

        {/* ── Central Physics Gameplay Arena Frame ───────────────────────── */}
        <div
          ref={containerRef}
          onClick={handlePlayerShoot}
          className="flex-1 relative overflow-hidden bg-black cursor-crosshair active:scale-[0.998] transition-transform"
          style={{ minHeight: 0 }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

          {/* ── START SCREEN OVERLAY ──────────────────────────────────────── */}
          {phase === 'start' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-3xl shadow-xl shadow-emerald-500/25 mb-3 border border-emerald-400/40">
                🔫
              </div>
              <h2
                className="text-2xl md:text-3xl font-black text-white tracking-wider mb-1"
                style={{ fontFamily: 'Fredoka, sans-serif' }}
              >
                PISTOL DUEL
              </h2>
              <p className="text-slate-300 text-xs max-w-xs mb-5 font-medium leading-relaxed">
                Watch the rotating green gun. Time your shot when the muzzle aligns with the red CPU!
                <br />
                <span className="text-emerald-400 font-bold">Every shot recoils & spins your gun.</span>
              </p>

              <button
                onClick={() => startLevel(0)}
                className="w-full max-w-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 text-white font-black py-3.5 px-6 rounded-2xl text-base shadow-xl shadow-emerald-500/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                <i className="fa-solid fa-play" /> Tap to Start
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="mt-4 text-slate-500 hover:text-slate-300 text-xs underline cursor-pointer"
                >
                  Exit to Portal
                </button>
              )}
            </div>
          )}

          {/* ── WIN OVERLAY ──────────────────────────────────────────────── */}
          {phase === 'win' && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <div className="text-6xl animate-bounce mb-2">🏆</div>
              <h2
                className="text-3xl font-black text-yellow-400 tracking-wider mb-1"
                style={{ fontFamily: 'Fredoka, sans-serif' }}
              >
                YOU WIN!
              </h2>
              <p className="text-slate-300 text-xs mb-3 font-medium">
                CPU Eliminated! Level {hud.level} Cleared.
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-5 py-2.5 mb-5 flex items-center gap-2 text-yellow-400 font-black text-sm">
                <span>🪙 +50 Coins</span>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  onClick={nextLevel}
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-black py-3 px-6 rounded-2xl text-sm shadow-xl shadow-yellow-500/30 hover:brightness-110 active:scale-95 transition cursor-pointer uppercase tracking-wider"
                >
                  Next Level →
                </button>
                <button
                  onClick={() => startLevel(levelIdx)}
                  className="w-full bg-slate-800 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-slate-700 transition cursor-pointer"
                >
                  Replay Level
                </button>
              </div>
            </div>
          )}

          {/* ── GAME OVER OVERLAY ────────────────────────────────────────── */}
          {phase === 'gameover' && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <div className="text-6xl mb-2">💀</div>
              <h2
                className="text-3xl font-black text-red-500 tracking-wider mb-1"
                style={{ fontFamily: 'Fredoka, sans-serif' }}
              >
                GAME OVER
              </h2>
              <p className="text-slate-400 text-xs mb-6 font-medium">
                You were eliminated on Level {hud.level}. Watch the timing!
              </p>

              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  onClick={() => startLevel(levelIdx)}
                  className="w-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-black py-3.5 px-6 rounded-2xl text-sm shadow-xl shadow-red-500/30 hover:brightness-110 active:scale-95 transition cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-rotate-left" /> Retry Level
                </button>
                <button
                  onClick={() => setGamePhase('start')}
                  className="w-full bg-slate-800 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-slate-700 transition cursor-pointer"
                >
                  Main Menu
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Phone Bottom Bezel with Instructional Footer ───────────────── */}
        <div className="flex-shrink-0 py-2.5 px-3 bg-[#121418] rounded-b-[24px] border-t border-white/5 text-center flex flex-col items-center justify-center">
          <p className="text-[10px] sm:text-[11px] font-black tracking-widest text-slate-400 uppercase animate-pulse">
            TAP ANYWHERE TO SHOOT — RECOIL IS POWER!
          </p>
        </div>
      </div>
    </div>
  );
}
