import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════════
   PISTOL DUEL — Retro-Futuristic Heavy Metal Arcade Console Interface
   Authentic recreation of the industrial arcade console photograph:
   - Weathered heavy metal chassis with beveled edges & industrial rivets
   - Raised gold plaque with crossed revolvers & engraved "Pistol Duel"
   - Red crosshair target icon (top-left) & target scope + red exit 'X' (top-right)
   - Cyan & Red glowing neon light bars
   - Illuminated fine grid CRT screen
   - Status bar: P1 cyan hearts (3 full, 1 empty), CPU red hearts (2 full)
   - Secondary status: LEVEL 2, 100 gold coins stack, volume & battery
   - Red CPU gun (top-left) & Yellow/Orange Player gun (bottom-right)
   - Clear red/orange dotted trajectory connection path
   - Recessed display panel: "TAP TO SHOOT — MASTER THE RECOIL FOR THE NEXT LEVEL!"
   - Lower footer panel: Tactile "Like (99%)" and "Report game" buttons
   ═══════════════════════════════════════════════════════════════════════════════ */

// ── 12 Levels Configuration with Progressive Recoil Difficulty ────────────────
const LEVELS = [
  { level: 1,  name: 'Rookie Duel',    playerMaxHp: 4, cpuHp: 2, cpuDelay: 2200, cpuTol: 0.58, coins: 50  },
  { level: 2,  name: 'Arcade Master',  playerMaxHp: 4, cpuHp: 2, cpuDelay: 1950, cpuTol: 0.50, coins: 100 },
  { level: 3,  name: 'Center Pillar',  playerMaxHp: 4, cpuHp: 3, cpuDelay: 1750, cpuTol: 0.44, coins: 150 },
  { level: 4,  name: 'Quick Spin',     playerMaxHp: 4, cpuHp: 3, cpuDelay: 1550, cpuTol: 0.38, coins: 200 },
  { level: 5,  name: 'Ledge Divide',   playerMaxHp: 4, cpuHp: 3, cpuDelay: 1400, cpuTol: 0.34, coins: 250 },
  { level: 6,  name: 'Ricochet Zone',  playerMaxHp: 4, cpuHp: 3, cpuDelay: 1300, cpuTol: 0.30, coins: 300 },
  { level: 7,  name: 'Twin Barriers',  playerMaxHp: 4, cpuHp: 4, cpuDelay: 1200, cpuTol: 0.26, coins: 350 },
  { level: 8,  name: 'Sharpshooter',   playerMaxHp: 4, cpuHp: 4, cpuDelay: 1100, cpuTol: 0.22, coins: 400 },
  { level: 9,  name: 'Sliding Hazard', playerMaxHp: 4, cpuHp: 4, cpuDelay: 1000, cpuTol: 0.20, coins: 450 },
  { level: 10, name: 'Twin Sliders',   playerMaxHp: 4, cpuHp: 4, cpuDelay: 900,  cpuTol: 0.18, coins: 500 },
  { level: 11, name: 'Bullet Storm',   playerMaxHp: 4, cpuHp: 5, cpuDelay: 800,  cpuTol: 0.16, coins: 600 },
  { level: 12, name: 'Legendary Boss', playerMaxHp: 4, cpuHp: 5, cpuDelay: 700,  cpuTol: 0.13, coins: 750 },
];

// ── Cross-Browser Safe Rounded Rect Helper ────────────────────────────────────
function drawRoundRect(ctx, x, y, w, h, r = 4) {
  const rad = Math.min(Math.min(w / 2, h / 2), typeof r === 'number' ? r : (Array.isArray(r) ? r[0] : 4));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

// ── Web Audio Synthesizer ─────────────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  try {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch {}
  return audioCtx;
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
      osc.frequency.setValueAtTime(560, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.14);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === 'shoot_cpu') {
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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, now);
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.05);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'hit') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(290, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
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

// ── Realistic 2D Gun Drawing (Red CPU / Golden-Orange Player) ─────────────────
function renderArcadeGun(ctx, gun, isPlayer) {
  const GL = gun.length;
  const GH = gun.height;

  // Colors matching reference image:
  // Player: Polished Golden/Orange metallic with amber accents
  // CPU: Deep metallic Crimson Red with dark red accents
  const col = isPlayer ? '#f59e0b' : '#ef4444';
  const accent = isPlayer ? '#b45309' : '#991b1b';
  const highlight = isPlayer ? '#fde68a' : '#fca5a5';

  ctx.save();
  ctx.translate(gun.x, gun.y);
  ctx.rotate(gun.angle);

  // Hit flash blinking
  if (gun.flash > 0 && Math.floor(gun.flash / 3) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  // Gun Drop Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // 1. Grip / Handle (Dark textured metal)
  ctx.fillStyle = '#1c1917';
  drawRoundRect(ctx, -GL * 0.32, GH * 0.1, GL * 0.28, GH * 0.85, 4);
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

  // 2. Trigger Guard
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(-GL * 0.02, GH * 0.28, GH * 0.28, 0, Math.PI);
  ctx.stroke();

  // 3. Lower Receiver
  ctx.fillStyle = accent;
  ctx.fillRect(-GL * 0.35, -GH * 0.1, GL * 0.65, GH * 0.45);

  // 4. Slide / Upper Barrel (Glossy Golden / Red Metallic)
  ctx.shadowBlur = 0;
  const slideGrad = ctx.createLinearGradient(0, -GH * 0.55, 0, GH * 0.15);
  slideGrad.addColorStop(0, highlight);
  slideGrad.addColorStop(0.35, col);
  slideGrad.addColorStop(1, accent);
  ctx.fillStyle = slideGrad;
  drawRoundRect(ctx, -GL * 0.36, -GH * 0.55, GL * 0.86, GH * 0.55, 3);
  ctx.fill();

  // Rear slide serrations
  ctx.fillStyle = '#0f172a';
  for (let s = -GL * 0.32; s < -GL * 0.16; s += 3.5) {
    ctx.fillRect(s, -GH * 0.5, 1.8, GH * 0.4);
  }

  // 5. Extended Steel Barrel Tip & Muzzle Crown
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

  // Laser Guide Line (Subtle)
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(GL * 0.62, -GH * 0.2);
  ctx.lineTo(GL * 0.62 + 95, -GH * 0.2);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// ── Main Retro-Futuristic PistolDuel Component ────────────────────────────────
export default function PistolDuel({
  onClose,
  onToggleFullscreen,
  isFullscreen,
  isLiked: externalIsLiked,
  onToggleLike: externalOnToggleLike,
  onReport: externalOnReport,
}) {
  // Gameplay State
  const [phase, setPhase] = useState('playing'); // 'playing' | 'victory' | 'failed'
  const [levelIdx, setLevelIdx] = useState(1);   // Default Level 2 (matches image 'LEVEL 2')
  const [coins, setCoins] = useState(100);       // Matches image '100' coins
  const [soundOn, setSoundOn] = useState(true);
  const [localLiked, setLocalLiked] = useState(false);
  const [reportedMsg, setReportedMsg] = useState(false);

  // Status HUD: Player (4 hearts total: 3 full, 1 empty), CPU (2 full hearts)
  const [hud, setHud] = useState({
    playerHp: 3,
    playerMaxHp: 4,
    cpuHp: 2,
    cpuMaxHp: 2,
    level: 2,
  });

  // DOM Refs
  const canvasRef = useRef(null);
  const screenAreaRef = useRef(null);
  const stateRef = useRef(null);
  const animFrameRef = useRef(null);
  const phaseRef = useRef('playing');
  const soundRef = useRef(soundOn);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const isLiked = externalIsLiked !== undefined ? externalIsLiked : localLiked;
  const toggleLike = externalOnToggleLike || (() => setLocalLiked(l => !l));
  const triggerReport = externalOnReport || (() => {
    setReportedMsg(true);
    setTimeout(() => setReportedMsg(false), 2500);
  });

  // ── Spawn Gun Initial State ───────────────────────────────────────────────
  const initLevelState = useCallback((lIdx, W, H) => {
    const cfg = LEVELS[Math.min(lIdx, LEVELS.length - 1)];

    // Target gun size matching arcade monitor proportion
    const gunWidth = Math.max(40, Math.min(60, W * 0.11));
    const gunHeight = gunWidth * 0.44;
    const radius = gunWidth * 0.48;

    // CPU Gun (Red) - Top Left (matches reference image layout)
    const cpu = {
      x: W * 0.20,
      y: H * 0.28,
      vx: 0,
      vy: 0,
      angle: 0.58,               // Aiming down-right toward player
      spin: -1.4,                // Natural rotation
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

    // Player Gun (Yellow/Orange) - Bottom Right (matches reference image layout)
    const player = {
      x: W * 0.80,
      y: H * 0.72,
      vx: 0,
      vy: 0,
      angle: Math.PI + 0.58,     // Aiming up-left toward CPU
      spin: 1.5,                 // Natural rotation
      length: gunWidth,
      height: gunHeight,
      radius,
      hp: 3,                     // 3 full hearts out of 4 max (matches reference image)
      maxHp: cfg.playerMaxHp || 4,
      flash: 0,
      ghosts: [],
      lastGhostTs: 0,
    };

    return {
      cfg,
      W,
      H,
      player,
      cpu,
      bullets: [],
      particles: [],
      ejectedShells: [],
      damageSkulls: [],
      screenShake: 0,
    };
  }, []);

  // ── Fire Gun Physics Action ───────────────────────────────────────────────
  const fireGun = (s, isPlayer) => {
    const gun = isPlayer ? s.player : s.cpu;

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

  const startLevel = (lIdx) => {
    const canvas = canvasRef.current;
    const screenArea = screenAreaRef.current;
    const W = (canvas && canvas.width) || (screenArea && screenArea.clientWidth) || 680;
    const H = (canvas && canvas.height) || (screenArea && screenArea.clientHeight) || 360;

    const s = initLevelState(lIdx, W, H);
    stateRef.current = s;
    setLevelIdx(lIdx);
    setCoins(s.cfg.coins);
    setHud({
      playerHp: s.player.hp,
      playerMaxHp: s.player.maxHp,
      cpuHp: s.cpu.hp,
      cpuMaxHp: s.cpu.maxHp,
      level: s.cfg.level,
    });
    setPhase('playing');
  };

  // ── Main Canvas Render & Physics Loop ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const screenArea = screenAreaRef.current;
    if (!canvas || !screenArea) return;

    const ctx = canvas.getContext('2d');

    const resize = () => {
      const rect = screenArea.getBoundingClientRect();
      const W = Math.max(300, Math.floor(rect.width || screenArea.clientWidth || 680));
      const H = Math.max(220, Math.floor(rect.height || screenArea.clientHeight || 360));
      canvas.width = W;
      canvas.height = H;

      if (!stateRef.current) {
        stateRef.current = initLevelState(levelIdx, W, H);
      } else {
        stateRef.current.W = W;
        stateRef.current.H = H;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    if (!stateRef.current) {
      stateRef.current = initLevelState(levelIdx, canvas.width, canvas.height);
    }

    let lastTime = performance.now();

    const loop = (now) => {
      try {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        const s = stateRef.current;
        if (s) {
          const { W, H, player, cpu } = s;

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

            if (gun.flash > 0) gun.flash--;

            // Ghost trails for motion blur
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

          updateGun(player, 1.5);
          updateGun(cpu, -1.4);

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

                s.damageSkulls.push({
                  x: target.x,
                  y: target.y - 15,
                  vy: -1.8,
                  alpha: 1.0,
                  col: b.isPlayer ? '#ef4444' : '#f59e0b',
                });

                target.vx += b.vx * 0.35;
                target.vy += b.vy * 0.35;

                const hitCol = b.isPlayer ? '#ef4444' : '#f59e0b';
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

                if (cpu.hp <= 0) {
                  setPhase('victory');
                  playSound('win', soundRef.current);
                  setCoins((prev) => prev + 50);
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

          // 1. Dark CRT Monitor Background
          ctx.fillStyle = '#0a0d14';
          ctx.fillRect(0, 0, W, H);

          // 2. Fine Black/Cyan Grid Lines (Matches reference image grid)
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
          ctx.lineWidth = 1;
          const step = 28;
          for (let x = 0; x < W; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
          }
          for (let y = 0; y < H; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          }

          // Inner screen border glow
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(2, 2, W - 4, H - 4);

          // 3. Clear Dotted Trajectory Connection Path (Exact match to reference image!)
          // Dotted red-to-orange-to-gold trajectory path connecting CPU and Player
          const numDots = 24;
          for (let d = 1; d < numDots; d++) {
            const t = d / numDots;
            const dotX = cpu.x + (player.x - cpu.x) * t;
            const dotY = cpu.y + (player.y - cpu.y) * t;

            // Interpolate color from red (near CPU) to orange/gold (near Player)
            const dotCol = t < 0.5 ? '#ef4444' : '#f59e0b';
            const dotGlow = t < 0.5 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 158, 11, 0.6)';

            ctx.save();
            ctx.shadowColor = dotGlow;
            ctx.shadowBlur = 6;
            ctx.fillStyle = dotCol;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // 4. Ghost Motion Trails
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
          renderGhosts(player.ghosts, 'rgba(245, 158, 11, ');
          renderGhosts(cpu.ghosts, 'rgba(239, 68, 68, ');

          // 5. Ejected Shells
          s.ejectedShells.forEach((sh) => {
            ctx.save();
            ctx.translate(sh.x, sh.y);
            ctx.rotate(sh.rot);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-2.5, -1, 5, 2.2);
            ctx.restore();
          });

          // 6. Bullets & Trails
          s.bullets.forEach((b) => {
            b.trail.forEach((t) => {
              ctx.beginPath();
              ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = b.isPlayer ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)';
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

          // 7. Guns (Yellow/Orange Player & Red CPU)
          renderArcadeGun(ctx, player, true);
          renderArcadeGun(ctx, cpu, false);

          // 8. Labels matching reference image badges
          const renderArcadeBadge = (txt, gun, isPlayer) => {
            ctx.save();
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            const col = isPlayer ? '#f59e0b' : '#ef4444';
            const badgeY = gun.y - gun.radius - 12;

            ctx.strokeStyle = col;
            ctx.lineWidth = 1;
            ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
            drawRoundRect(ctx, gun.x - 24, badgeY - 9, 48, 14, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = col;
            ctx.fillText(txt, gun.x, badgeY + 2);
            ctx.restore();
          };
          renderArcadeBadge('PLAYER', player, true);
          renderArcadeBadge('CPU', cpu, false);

          // 9. Floating Damage Skulls
          s.damageSkulls.forEach((sk) => {
            ctx.save();
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.globalAlpha = Math.max(0, sk.alpha);
            ctx.fillStyle = sk.col;
            ctx.fillText('💀', sk.x, sk.y);
            ctx.restore();
          });

          // 10. Particles
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
        }
      } catch (err) {
        console.error('Arcade loop error:', err);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [initLevelState, levelIdx]);

  return (
    <div className="relative w-full h-full flex items-center justify-center p-1 sm:p-3 overflow-hidden select-none touch-none">
      {/* ═════════════════════════════════════════════════════════════════════
          OUTER RETRO-FUTURISTIC HEAVY METAL ARCADE CONSOLE CHASSIS
          ═════════════════════════════════════════════════════════════════════ */}
      <div
        className="relative w-full max-w-[940px] h-full max-h-[660px] rounded-3xl p-3 sm:p-5 flex flex-col justify-between overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.95)] border-4 border-[#3b4252]"
        style={{
          background: 'linear-gradient(145deg, #2b303c 0%, #1c2029 45%, #131720 100%)',
          boxShadow: 'inset 0 3px 6px rgba(255,255,255,0.25), inset 0 -4px 8px rgba(0,0,0,0.8), 0 25px 70px rgba(0,0,0,0.9)',
        }}
      >
        {/* Corner Rivet / Hex Bolt Accents */}
        <span className="absolute top-2.5 left-3 w-2 h-2 rounded-full bg-slate-500/70 border border-slate-700 shadow-inner" />
        <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-slate-500/70 border border-slate-700 shadow-inner" />
        <span className="absolute bottom-2.5 left-3 w-2 h-2 rounded-full bg-slate-500/70 border border-slate-700 shadow-inner" />
        <span className="absolute bottom-2.5 right-3 w-2 h-2 rounded-full bg-slate-500/70 border border-slate-700 shadow-inner" />

        {/* ── CONSOLE TOP FRAME BAR ────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-2 sm:px-4 pt-1 pb-2 relative">
          {/* Upper-Left: Red Crosshair Target Icon Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => playSound('click', soundRef.current)}
              className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.45)] cursor-pointer active:scale-95 transition-transform"
              style={{
                background: 'radial-gradient(circle, #3b1117 0%, #1e090c 100%)',
              }}
              title="Target Lock"
            >
              <i className="fa-solid fa-crosshairs text-red-500 text-lg animate-pulse" />
            </button>
          </div>

          {/* Top-Center: Raised Gold-Colored Plaque with Crossed Revolvers & 'Pistol Duel' */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 flex flex-col items-center px-6 sm:px-9 py-1 rounded-b-2xl border-x-2 border-b-2 border-amber-600/80 shadow-[0_10px_25px_rgba(0,0,0,0.85)]"
            style={{
              background: 'linear-gradient(180deg, #d97706 0%, #b45309 35%, #78350f 75%, #451a03 100%)',
              boxShadow: 'inset 0 1px 2px rgba(254,240,138,0.7), 0 8px 20px rgba(0,0,0,0.8)',
            }}
          >
            {/* Engraved Crossed Revolvers Emblem */}
            <div className="flex items-center justify-center text-amber-200 text-sm mb-0.5 filter drop-shadow">
              <span>⚔️</span>
            </div>
            {/* Bold Stylized Serif Plaque Title */}
            <h1
              className="font-serif font-black text-lg sm:text-2xl tracking-wider text-amber-100 uppercase"
              style={{
                textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 10px rgba(251,191,36,0.6)',
                letterSpacing: '0.08em',
              }}
            >
              Pistol Duel
            </h1>
          </div>

          {/* Upper-Right: Target Scope (Fullscreen) & Red Exit Button */}
          <div className="flex items-center gap-2">
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-600/70 bg-[#1e232d] hover:bg-[#282f3d] text-slate-300 hover:text-white transition cursor-pointer shadow-md"
                title="Fullscreen"
              >
                <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-sm`} />
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center border-2 border-red-500/70 bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white transition cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                title="Exit Game"
              >
                <i className="fa-solid fa-xmark text-base font-bold" />
              </button>
            )}
          </div>
        </div>

        {/* ── NEON LIGHT ACCENT STRIPS (Cyan Left, Red Right) ──────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-6 pt-1 pb-1">
          {/* Cyan Neon Glow Strip */}
          <div className="w-[38%] h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#06b6d4,0_0_20px_#06b6d4]" />
          {/* Red Neon Glow Strip */}
          <div className="w-[38%] h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444,0_0_20px_#ef4444]" />
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            CENTRAL ILLUMINATED SCREEN AREA (CRT Frame & Fine Grid)
            ═════════════════════════════════════════════════════════════════════ */}
        <div
          className="flex-1 flex flex-col mx-1 sm:mx-3 my-1 rounded-2xl border-4 border-[#232733] bg-[#0c0f17] overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.95)]"
          style={{ minHeight: 0 }}
        >
          {/* ── Screen Status Header (P1 cyan hearts, CPU red hearts, Level 2) ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#0a0d14]/90 text-xs">
            {/* Upper-Left: P1 with 4 hearts (3 full cyan, 1 empty outline) */}
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-extrabold text-sm tracking-wider font-mono">P1</span>
              <div className="flex items-center gap-1 text-base">
                {[...Array(hud.playerMaxHp)].map((_, i) => (
                  <span
                    key={i}
                    className={`transition-colors ${
                      i < hud.playerHp
                        ? 'text-cyan-400 drop-shadow-[0_0_8px_#06b6d4]'
                        : 'text-slate-700'
                    }`}
                  >
                    ♥
                  </span>
                ))}
              </div>
            </div>

            {/* Upper-Right Status Pill (LEVEL 2, 100 Coins, Sound, Battery) */}
            <div className="flex items-center gap-3">
              <div className="bg-[#121620] px-3 py-1 rounded-full border border-white/10 flex items-center gap-2.5 text-[11px] font-mono shadow-inner">
                <span className="font-extrabold text-slate-200 tracking-wider">
                  LEVEL {hud.level}
                </span>
                <span className="text-slate-600">|</span>
                <div className="flex items-center gap-1 text-yellow-400 font-bold">
                  <span>🪙</span>
                  <span>{coins}</span>
                </div>
                <span className="text-slate-600">|</span>
                <button
                  onClick={() => {
                    playSound('click', soundRef.current);
                    setSoundOn(s => !s);
                  }}
                  className="text-slate-400 hover:text-white transition"
                  title="Toggle Sound"
                >
                  <i className={`fa-solid ${soundOn ? 'fa-volume-high' : 'fa-volume-xmark text-red-400'}`} />
                </button>
                <span className="text-slate-400">🔋</span>
              </div>

              {/* Upper-Right: CPU with 2 full red hearts */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-base">
                  {[...Array(hud.cpuMaxHp)].map((_, i) => (
                    <span
                      key={i}
                      className={`transition-colors ${
                        i < hud.cpuHp
                          ? 'text-red-500 drop-shadow-[0_0_8px_#ef4444]'
                          : 'text-slate-700'
                      }`}
                    >
                      ♥
                    </span>
                  ))}
                </div>
                <span className="text-red-400 font-extrabold text-sm tracking-wider font-mono">CPU</span>
              </div>
            </div>
          </div>

          {/* ── Screen Grid Arena with Canvas ────────────────────────────── */}
          <div
            ref={screenAreaRef}
            onClick={handleShoot}
            className="flex-1 relative overflow-hidden bg-[#0a0d14] cursor-crosshair active:scale-[0.999] transition-transform"
            style={{ minHeight: 0 }}
          >
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

            {/* Victory Overlay Modal */}
            {phase === 'victory' && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 text-center">
                <div className="text-5xl animate-bounce mb-1">🏆</div>
                <h3 className="text-2xl font-black text-amber-400 uppercase tracking-widest font-serif">
                  VICTORY!
                </h3>
                <p className="text-slate-300 text-xs mb-3">
                  LEVEL {hud.level} CLEARED · REWARD +50 COINS
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      playSound('click', soundRef.current);
                      startLevel(levelIdx + 1);
                    }}
                    className="bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition shadow-lg shadow-amber-500/30 cursor-pointer"
                  >
                    NEXT LEVEL →
                  </button>
                  <button
                    onClick={() => {
                      playSound('click', soundRef.current);
                      startLevel(levelIdx);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    REPLAY
                  </button>
                </div>
              </div>
            )}

            {/* Failed Overlay Modal */}
            {phase === 'failed' && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 text-center">
                <div className="text-5xl mb-1">💀</div>
                <h3 className="text-2xl font-black text-red-500 uppercase tracking-widest font-serif">
                  FAILED!
                </h3>
                <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
                  CPU GOT YOU!
                </p>
                <button
                  onClick={() => {
                    playSound('click', soundRef.current);
                    startLevel(levelIdx);
                  }}
                  className="bg-gradient-to-r from-red-500 to-rose-600 text-white font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition shadow-lg shadow-red-500/30 cursor-pointer"
                >
                  RETRY LEVEL {hud.level}
                </button>
              </div>
            )}
          </div>

          {/* ── Recessed Display Sub-Panel: "TAP TO SHOOT — MASTER THE RECOIL..." ── */}
          <div
            className="flex-shrink-0 py-2 px-3 text-center border-t border-white/5"
            style={{
              background: 'linear-gradient(180deg, #0e121a 0%, #07090f 100%)',
            }}
          >
            <p
              className="text-[10px] sm:text-[12px] font-black tracking-widest text-slate-300 uppercase animate-pulse font-mono"
              style={{
                textShadow: '0 0 10px rgba(56,189,248,0.5)',
              }}
            >
              TAP TO SHOOT — MASTER THE RECOIL FOR THE NEXT LEVEL!
            </p>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            LOWER FOOTER PANEL: TACTILE 'Like (99%)' AND 'Report game' BUTTONS
            ═════════════════════════════════════════════════════════════════════ */}
        <div className="flex-shrink-0 flex items-center justify-center gap-4 sm:gap-6 pt-1 pb-1">
          {/* Like Button */}
          <button
            onClick={() => {
              playSound('click', soundRef.current);
              toggleLike();
            }}
            className={`flex items-center gap-2 px-5 sm:px-7 py-2 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 border-2 ${
              isLiked
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-[#1e232d] hover:bg-[#282f3d] border-slate-600/70 text-slate-300 hover:text-white shadow-md'
            }`}
            style={{
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.15), 0 4px 10px rgba(0,0,0,0.6)',
            }}
          >
            <i className={`fa-solid fa-thumbs-up text-sm ${isLiked ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>Like  (99%)</span>
          </button>

          {/* Report Button */}
          <button
            onClick={() => {
              playSound('click', soundRef.current);
              triggerReport();
            }}
            className="flex items-center gap-2 px-5 sm:px-7 py-2 rounded-xl text-xs font-black bg-[#1e232d] hover:bg-[#282f3d] border-2 border-slate-600/70 text-slate-300 hover:text-white transition cursor-pointer active:scale-95 shadow-md"
            style={{
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.15), 0 4px 10px rgba(0,0,0,0.6)',
            }}
          >
            <i className="fa-solid fa-flag text-sm text-slate-400" />
            <span>{reportedMsg ? 'Reported!' : 'Report game'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
