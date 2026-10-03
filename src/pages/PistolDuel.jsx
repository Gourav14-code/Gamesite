import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════════
   PISTOL DUEL — 1:1 RECREATION OF THE RETRO-FUTURISTIC ARCADE CONSOLE (IMAGE 1)
   ═══════════════════════════════════════════════════════════════════════════════
   Strict, pixel-accurate visual implementation matching the physical reference:
   1. Multi-layered heavy gunmetal chassis with 45° chamfered corners & rivets
   2. Left side: Vertical brushed gunmetal wing with 3 milled louvers + CYAN rim glow
   3. Right side: Vertical brushed gunmetal wing with 3 milled louvers + RED rim glow
   4. Top-left: Circular beveled housing with red crosshair target reticle
   5. Top-right: Square tactical scope button [ ⌖ ] and red beveled exit button ✕
   6. Top-center: Raised heavy brass/gold plaque with 4 hex bolts, chiseled gold
      "Pistol Duel" serif lettering, and antique crossed revolvers sculpture
   7. Top lights: Recessed glowing Cyan (left) and Red (right) neon light bars
   8. CRT Arena: Compact technical grid (28px cyan-grey lines), dark vignette
   9. CPU Gun (Top-Left): Large illustrated 3D Crimson Red pistol + [CPU] badge
   10. Player Gun (Bottom-Right): Large illustrated 3D Golden-Orange pistol + [PLAYER] badge
   11. Trajectory: Permanent 24-dot glowing path (Red → Orange → Yellow) with muzzle aura
   12. In-Screen HUD: P1 cyan hearts (3 full, 1 empty), CPU red hearts (2 full),
       and status pill (LEVEL 2 | 🪙 100 | 🔊 | 🔋)
   13. Bottom instruction slot: "TAP TO SHOOT — MASTER THE RECOIL FOR THE NEXT LEVEL!"
   14. Bottom tactile buttons: Physical brushed-steel "Like (99%)" and "Report game"
   15. 2D rigid-body recoil physics, spin torque, bouncing, shell casings, hit particles
   ═══════════════════════════════════════════════════════════════════════════════ */

// ── 12 Levels Configuration ───────────────────────────────────────────────────
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

// ── Cross-Browser Rounded Rect Helper ─────────────────────────────────────────
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
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'shoot_cpu') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.16);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'ricochet') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'hit') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
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
        gain.gain.setValueAtTime(0.22, now + idx * 0.08);
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
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, now);
      gain.gain.setValueAtTime(0.09, now);
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

// ── Realistic 3D Illustrated Pistol Drawing (Strict match to Image 1) ─────────
function renderArcadeGun(ctx, gun, isPlayer) {
  const GL = gun.length;
  const GH = gun.height;

  // Exact color palettes from Image 1:
  // Player: Lustrous metallic Golden-Orange with bright brass & white accents
  // CPU: Deep metallic Crimson Red with black grip & polished steel highlights
  const baseCol = isPlayer ? '#f59e0b' : '#ef4444';
  const shadowCol = isPlayer ? '#92400e' : '#991b1b';
  const highlightCol = isPlayer ? '#fef08a' : '#fca5a5';

  ctx.save();
  ctx.translate(gun.x, gun.y);
  ctx.rotate(gun.angle);

  // Hit flash blinking
  if (gun.flash > 0 && Math.floor(gun.flash / 3) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  // Gun Drop Shadow on CRT glass
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;

  // 1. Grip / Handle (Dark heavy textured metal)
  ctx.fillStyle = '#141416';
  drawRoundRect(ctx, -GL * 0.34, GH * 0.1, GL * 0.3, GH * 0.9, 4);
  ctx.fill();

  // White base accent on Player grip (distinctive visual in Image 1!)
  if (isPlayer) {
    ctx.fillStyle = '#f8fafc';
    drawRoundRect(ctx, -GL * 0.28, GH * 0.82, GL * 0.18, GH * 0.18, 2);
    ctx.fill();
  }

  // Grip Checkering Grooves
  ctx.strokeStyle = shadowCol;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-GL * 0.32, GH * 0.36);
  ctx.lineTo(-GL * 0.08, GH * 0.36);
  ctx.moveTo(-GL * 0.32, GH * 0.6);
  ctx.lineTo(-GL * 0.08, GH * 0.6);
  ctx.stroke();

  // 2. Trigger Guard & Trigger
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-GL * 0.02, GH * 0.28, GH * 0.3, 0, Math.PI);
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-GL * 0.06, GH * 0.18, 3, GH * 0.25);

  // 3. Lower Frame / Receiver
  ctx.fillStyle = shadowCol;
  ctx.fillRect(-GL * 0.36, -GH * 0.1, GL * 0.68, GH * 0.45);

  // 4. Slide / Upper Barrel (Glossy 3D Metallic)
  ctx.shadowBlur = 0;
  const slideGrad = ctx.createLinearGradient(0, -GH * 0.58, 0, GH * 0.15);
  slideGrad.addColorStop(0, highlightCol);
  slideGrad.addColorStop(0.3, baseCol);
  slideGrad.addColorStop(0.85, shadowCol);
  slideGrad.addColorStop(1, '#1e1b18');
  ctx.fillStyle = slideGrad;
  drawRoundRect(ctx, -GL * 0.38, -GH * 0.58, GL * 0.9, GH * 0.58, 3);
  ctx.fill();

  // Slide top bevel highlight
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(-GL * 0.36, -GH * 0.56, GL * 0.86, 2);

  // Rear Slide Serrations
  ctx.fillStyle = '#090a0f';
  for (let s = -GL * 0.34; s < -GL * 0.15; s += 4) {
    ctx.fillRect(s, -GH * 0.52, 2, GH * 0.44);
  }

  // 5. Extended Steel Barrel Tip & Muzzle Crown
  ctx.fillStyle = '#1e232d';
  ctx.fillRect(GL * 0.52, -GH * 0.36, GL * 0.12, GH * 0.32);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(GL * 0.64, -GH * 0.2, GH * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Front & Rear Sights
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(GL * 0.48, -GH * 0.7, 3, 4);
  ctx.fillRect(-GL * 0.36, -GH * 0.7, 3, 4);

  // Ejection Port
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-GL * 0.05, -GH * 0.54, GL * 0.24, GH * 0.22);

  ctx.restore();
}

// ── Main PistolDuel Component ─────────────────────────────────────────────────
export default function PistolDuel({
  onClose,
  onToggleFullscreen,
  isFullscreen,
  isLiked: externalIsLiked,
  onToggleLike: externalOnToggleLike,
  onReport: externalOnReport,
}) {
  // Gameplay State
  const [phase, setPhase] = useState('playing'); // starts directly in playing state
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
  const toggleLike = externalOnToggleLike || (() => setLocalLiked((l) => !l));
  const triggerReport =
    externalOnReport ||
    (() => {
      setReportedMsg(true);
      setTimeout(() => setReportedMsg(false), 2500);
    });

  // ── Spawn Gun Initial State (Matches Exact Positions in Image 1) ───────────
  const initLevelState = useCallback((lIdx, W, H) => {
    const cfg = LEVELS[Math.min(lIdx, LEVELS.length - 1)];

    // Target gun size: prominent and clear, ~13-15% of width
    const gunWidth = Math.max(54, Math.min(82, W * 0.135));
    const gunHeight = gunWidth * 0.44;
    const radius = gunWidth * 0.48;

    // CPU Gun (Red) - Top Left (around x: 17%, y: 28% of arena)
    const cpu = {
      x: W * 0.17,
      y: H * 0.28,
      vx: 0,
      vy: 0,
      angle: 0.58,               // Aiming down-right toward player
      spin: -0.5,                // Smooth natural rotation
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

    // Player Gun (Yellow/Orange) - Bottom Right (around x: 82%, y: 72% of arena)
    const player = {
      x: W * 0.82,
      y: H * 0.72,
      vx: 0,
      vy: 0,
      angle: Math.PI + 0.58,     // Aiming up-left toward CPU
      spin: 0.6,                 // Smooth natural rotation
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
      player,
      cpu,
      bullets: [],
      particles: [],
      ejectedShells: [],
      damageSkulls: [],
      screenShake: 0,
      lastTs: performance.now(),
      lastFiredTime: 0,
      w: W,
      h: H,
    };
  }, []);

  // ── Start / Restart Level ─────────────────────────────────────────────────
  const startLevel = useCallback(
    (lvlIdx) => {
      const idx = Math.max(0, Math.min(lvlIdx, LEVELS.length - 1));
      setLevelIdx(idx);
      const cfg = LEVELS[idx];
      setHud({
        playerHp: 3,
        playerMaxHp: cfg.playerMaxHp || 4,
        cpuHp: cfg.cpuHp,
        cpuMaxHp: cfg.cpuHp,
        level: cfg.level,
      });
      setPhase('playing');

      if (screenAreaRef.current) {
        const rect = screenAreaRef.current.getBoundingClientRect();
        stateRef.current = initLevelState(idx, rect.width || 600, rect.height || 300);
      }
    },
    [initLevelState]
  );

  // ── Tap to Shoot Mechanic ─────────────────────────────────────────────────
  const handleShoot = useCallback(() => {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    const s = stateRef.current;
    const p = s.player;
    const now = performance.now();
    if (now - s.lastFiredTime < 240) return; // Fire rate limit
    s.lastFiredTime = now;

    playSound('shoot_player', soundRef.current);

    // Spawn Bullet at muzzle
    const muzzleDist = p.length * 0.64;
    const bx = p.x + Math.cos(p.angle) * muzzleDist;
    const by = p.y + Math.sin(p.angle) * muzzleDist;
    const bSpeed = 700;

    s.bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(p.angle) * bSpeed,
      vy: Math.sin(p.angle) * bSpeed,
      isPlayer: true,
      bounces: 0,
      maxBounces: 3,
      trail: [],
    });

    // Recoil Force (opposite to muzzle direction)
    const recoilForce = 220;
    p.vx -= Math.cos(p.angle) * recoilForce;
    p.vy -= Math.sin(p.angle) * recoilForce;

    // Rotational Kick
    const torque = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4.5 + 4.5);
    p.spin += torque;

    // Eject Brass Shell Casing
    const shellAngle = p.angle - Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    s.ejectedShells.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(shellAngle) * 95 - p.vx * 0.2,
      vy: Math.sin(shellAngle) * 95 - p.vy * 0.2,
      rot: p.angle,
      spin: (Math.random() - 0.5) * 20,
      life: 1.0,
    });

    // Muzzle Smoke & Sparks
    for (let i = 0; i < 9; i++) {
      const sp = Math.random() * 80 + 30;
      const spread = p.angle + (Math.random() - 0.5) * 0.55;
      s.particles.push({
        x: bx,
        y: by,
        vx: Math.cos(spread) * sp,
        vy: Math.sin(spread) * sp,
        life: 1.0,
        decay: 0.05 + Math.random() * 0.04,
        col: i % 2 === 0 ? '#fbbf24' : '#f97316',
        size: Math.random() * 3 + 2,
      });
    }

    s.screenShake = 5;
  }, []);

  // ── Canvas Setup & Main Game Loop ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = screenAreaRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(100, Math.floor(rect.width));
      const H = Math.max(100, Math.floor(rect.height));

      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
      }

      if (!stateRef.current) {
        stateRef.current = initLevelState(levelIdx, W, H);
      } else {
        stateRef.current.w = W;
        stateRef.current.h = H;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    // Physics parameters
    const LINEAR_DRAG = 0.982;
    const ANGULAR_DRAG = 0.985;
    const BOUNCE_RESTITUTION = 0.78;

    const loop = (ts) => {
      try {
        const s = stateRef.current;
        const ctx = canvas.getContext('2d');

        if (s && ctx) {
          const dt = Math.min((ts - s.lastTs) / 1000, 0.033);
          s.lastTs = ts;

          const W = s.w;
          const H = s.h;
          const cfg = LEVELS[Math.min(levelIdx, LEVELS.length - 1)];

          const player = s.player;
          const cpu = s.cpu;

          // ── Update Player Gun ───────────────────────────────────────────────
          player.vx *= Math.pow(LINEAR_DRAG, dt * 60);
          player.vy *= Math.pow(LINEAR_DRAG, dt * 60);
          player.x += player.vx * dt;
          player.y += player.vy * dt;

          player.spin *= Math.pow(ANGULAR_DRAG, dt * 60);
          player.angle += player.spin * dt;
          player.angle = normAngle(player.angle);

          if (player.flash > 0) player.flash--;

          // Ghost trail
          if (ts - player.lastGhostTs > 55) {
            player.ghosts.push({
              x: player.x,
              y: player.y,
              angle: player.angle,
              alpha: 0.45,
              length: player.length,
              height: player.height,
            });
            player.lastGhostTs = ts;
          }
          player.ghosts.forEach((g) => { g.alpha -= 0.03; });
          player.ghosts = player.ghosts.filter((g) => g.alpha > 0.05);

          // Player Wall Bounce
          const pad = player.radius + 4;
          if (player.x < pad) {
            player.x = pad;
            player.vx = Math.abs(player.vx) * BOUNCE_RESTITUTION;
            player.spin += (Math.random() - 0.5) * 1.5;
          } else if (player.x > W - pad) {
            player.x = W - pad;
            player.vx = -Math.abs(player.vx) * BOUNCE_RESTITUTION;
            player.spin += (Math.random() - 0.5) * 1.5;
          }
          if (player.y < pad) {
            player.y = pad;
            player.vy = Math.abs(player.vy) * BOUNCE_RESTITUTION;
            player.spin += (Math.random() - 0.5) * 1.5;
          } else if (player.y > H - pad) {
            player.y = H - pad;
            player.vy = -Math.abs(player.vy) * BOUNCE_RESTITUTION;
            player.spin += (Math.random() - 0.5) * 1.5;
          }

          // ── Update CPU Gun ─────────────────────────────────────────────────
          cpu.vx *= Math.pow(LINEAR_DRAG, dt * 60);
          cpu.vy *= Math.pow(LINEAR_DRAG, dt * 60);
          cpu.x += cpu.vx * dt;
          cpu.y += cpu.vy * dt;

          cpu.spin *= Math.pow(ANGULAR_DRAG, dt * 60);
          cpu.angle += cpu.spin * dt;
          cpu.angle = normAngle(cpu.angle);

          if (cpu.flash > 0) cpu.flash--;

          // CPU Ghost trail
          if (ts - cpu.lastGhostTs > 55) {
            cpu.ghosts.push({
              x: cpu.x,
              y: cpu.y,
              angle: cpu.angle,
              alpha: 0.45,
              length: cpu.length,
              height: cpu.height,
            });
            cpu.lastGhostTs = ts;
          }
          cpu.ghosts.forEach((g) => { g.alpha -= 0.03; });
          cpu.ghosts = cpu.ghosts.filter((g) => g.alpha > 0.05);

          // CPU Wall Bounce
          const cpuPad = cpu.radius + 4;
          if (cpu.x < cpuPad) {
            cpu.x = cpuPad;
            cpu.vx = Math.abs(cpu.vx) * BOUNCE_RESTITUTION;
          } else if (cpu.x > W - cpuPad) {
            cpu.x = W - cpuPad;
            cpu.vx = -Math.abs(cpu.vx) * BOUNCE_RESTITUTION;
          }
          if (cpu.y < cpuPad) {
            cpu.y = cpuPad;
            cpu.vy = Math.abs(cpu.vy) * BOUNCE_RESTITUTION;
          } else if (cpu.y > H - cpuPad) {
            cpu.y = H - cpuPad;
            cpu.vy = -Math.abs(cpu.vy) * BOUNCE_RESTITUTION;
          }

          // CPU AI Tracking & Shooting
          if (phaseRef.current === 'playing') {
            cpu.timer -= dt * 1000;
            const targetAngle = Math.atan2(player.y - cpu.y, player.x - cpu.x);
            const angleDiff = Math.abs(normAngle(cpu.angle - targetAngle));

            if (cpu.timer <= 0 && angleDiff < cfg.cpuTol) {
              cpu.timer = cfg.cpuDelay + (Math.random() - 0.5) * 500;
              playSound('shoot_cpu', soundRef.current);

              const cbx = cpu.x + Math.cos(cpu.angle) * cpu.length * 0.64;
              const cby = cpu.y + Math.sin(cpu.angle) * cpu.length * 0.64;
              const cbSpeed = 640;

              s.bullets.push({
                x: cbx,
                y: cby,
                vx: Math.cos(cpu.angle) * cbSpeed,
                vy: Math.sin(cpu.angle) * cbSpeed,
                isPlayer: false,
                bounces: 0,
                maxBounces: 3,
                trail: [],
              });

              // CPU Recoil
              cpu.vx -= Math.cos(cpu.angle) * 190;
              cpu.vy -= Math.sin(cpu.angle) * 190;
              cpu.spin += (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 3.5);

              // CPU Shell
              const cShellAngle = cpu.angle - Math.PI / 2 + (Math.random() - 0.5) * 0.4;
              s.ejectedShells.push({
                x: cpu.x,
                y: cpu.y,
                vx: Math.cos(cShellAngle) * 80 - cpu.vx * 0.2,
                vy: Math.sin(cShellAngle) * 80 - cpu.vy * 0.2,
                rot: cpu.angle,
                spin: (Math.random() - 0.5) * 15,
                life: 1.0,
              });
            }
          }

          // ── Update Bullets ─────────────────────────────────────────────────
          for (let i = s.bullets.length - 1; i >= 0; i--) {
            const b = s.bullets[i];
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 7) b.trail.shift();

            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // Bounces on borders
            let bounced = false;
            if (b.x < 4 || b.x > W - 4) {
              b.vx = -b.vx;
              b.x = Math.max(4, Math.min(W - 4, b.x));
              bounced = true;
            }
            if (b.y < 4 || b.y > H - 4) {
              b.vy = -b.vy;
              b.y = Math.max(4, Math.min(H - 4, b.y));
              bounced = true;
            }

            if (bounced) {
              b.bounces++;
              playSound('ricochet', soundRef.current);
              if (b.bounces > b.maxBounces) {
                s.bullets.splice(i, 1);
                continue;
              }
            }

            // Bullet vs Gun Collision
            const target = b.isPlayer ? cpu : player;
            const dist = Math.hypot(b.x - target.x, b.y - target.y);

            if (dist < target.radius * 0.88) {
              target.hp -= 1;
              target.flash = 12;
              playSound('hit', soundRef.current);
              s.screenShake = 11;

              s.damageSkulls.push({
                x: target.x,
                y: target.y - 15,
                vy: -1.2,
                alpha: 1.0,
                col: b.isPlayer ? '#f87171' : '#fbbf24',
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

          // Particles update
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

          // ── RENDERING ON CRT CANVAS ─────────────────────────────────────────
          ctx.save();

          if (s.screenShake > 0) {
            const sx = (Math.random() - 0.5) * s.screenShake;
            const sy = (Math.random() - 0.5) * s.screenShake;
            ctx.translate(sx, sy);
            s.screenShake *= 0.85;
            if (s.screenShake < 0.3) s.screenShake = 0;
          }

          // 1. Dark CRT Display Background
          ctx.fillStyle = '#080a10';
          ctx.fillRect(0, 0, W, H);

          // 2. High-Precision Technical Grid (Exact match to Image 1)
          ctx.strokeStyle = 'rgba(70, 95, 120, 0.22)';
          ctx.lineWidth = 1;
          const step = 28;
          for (let x = 0; x < W; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
          }
          for (let y = 0; y < H; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
          }

          // 3. Clear Dotted Trajectory Connection Path (Exact match to Image 1!)
          // 24 glowing dots smoothly transitioning: Crimson Red → Orange → Yellow Gold
          const numDots = 24;
          for (let d = 1; d < numDots; d++) {
            const t = d / numDots;
            const dotX = cpu.x + (player.x - cpu.x) * t;
            const dotY = cpu.y + (player.y - cpu.y) * t;

            let dotCol = '#ef4444';
            let dotGlow = 'rgba(239, 68, 68, 0.6)';
            let dotR = 2.5;

            if (t > 0.72) {
              dotCol = '#fde047';
              dotGlow = 'rgba(253, 224, 71, 0.9)';
              dotR = t > 0.92 ? 4.5 : 3.2; // Extra large glowing dot right at Player muzzle
            } else if (t > 0.48) {
              dotCol = '#f59e0b';
              dotGlow = 'rgba(245, 158, 11, 0.7)';
              dotR = 2.8;
            } else if (t > 0.25) {
              dotCol = '#f97316';
              dotGlow = 'rgba(249, 115, 22, 0.6)';
            }

            ctx.save();
            ctx.shadowColor = dotGlow;
            ctx.shadowBlur = t > 0.88 ? 12 : 6;
            ctx.fillStyle = dotCol;
            ctx.beginPath();
            ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
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

          // 6. Active Bullets
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

          // 7. Large Illustrated 3D Guns (Red CPU on Left, Gold Player on Right)
          renderArcadeGun(ctx, player, true);
          renderArcadeGun(ctx, cpu, false);

          // 8. Floating Badges ([CPU] and [PLAYER] exactly matching Image 1)
          const renderArcadeBadge = (txt, gun, isPlayer) => {
            ctx.save();
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            const col = isPlayer ? '#f59e0b' : '#ef4444';
            const badgeY = gun.y - gun.radius - 14;

            ctx.strokeStyle = col;
            ctx.lineWidth = 1.2;
            ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
            drawRoundRect(ctx, gun.x - 26, badgeY - 10, 52, 16, 4);
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
            ctx.font = '15px sans-serif';
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
    <div
      className="relative w-full h-full flex items-center justify-center p-0 overflow-hidden select-none touch-none"
      style={{
        background: 'radial-gradient(ellipse at center, #181d26 0%, #0c0f15 70%, #050608 100%)',
      }}
    >
      {/* ═════════════════════════════════════════════════════════════════════
          PHYSICAL RETRO-FUTURISTIC ARCADE CABINET CONSOLE CHASSIS (IMAGE 1)
          Exact 1.85:1 aspect ratio matching the 610 × 329 reference photograph
          ═════════════════════════════════════════════════════════════════════ */}
      <div
        className="relative w-full max-w-[1040px] aspect-[1000/540] flex items-center justify-center overflow-hidden"
        style={{
          filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.95))',
        }}
      >
        {/* ── HIGH-PRECISION METALLIC ARCADE CONSOLE SVG FRAME ─────────────── */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          viewBox="0 0 1000 540"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Outer Chassis Brushed Gunmetal Gradient */}
            <linearGradient id="chassisGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#434c5e" />
              <stop offset="15%" stopColor="#2e3440" />
              <stop offset="50%" stopColor="#1e222b" />
              <stop offset="85%" stopColor="#2e3440" />
              <stop offset="100%" stopColor="#181b22" />
            </linearGradient>

            {/* Inner Recessed Bezel Gradient */}
            <linearGradient id="innerBezelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#14171f" />
              <stop offset="100%" stopColor="#2b313e" />
            </linearGradient>

            {/* Brass / Gold Plaque Frame Gradient */}
            <linearGradient id="goldFrameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="18%" stopColor="#eab308" />
              <stop offset="55%" stopColor="#b45309" />
              <stop offset="85%" stopColor="#78350f" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>

            {/* Chiseled 3D Gold Text Gradient */}
            <linearGradient id="goldTextGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="35%" stopColor="#fde047" />
              <stop offset="70%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>

            {/* Neon Cyan Tube Gradient */}
            <linearGradient id="cyanTube" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#67e8f9" />
              <stop offset="70%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>

            {/* Neon Red Tube Gradient */}
            <linearGradient id="redTube" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#fca5a5" />
              <stop offset="70%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>

            {/* Button Metallic Gradient */}
            <linearGradient id="btnMetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3d4556" />
              <stop offset="40%" stopColor="#252b36" />
              <stop offset="100%" stopColor="#171b22" />
            </linearGradient>

            {/* Glow Filters */}
            <filter id="cyanGlow" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
            <filter id="redGlow" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
            <filter id="goldDropShadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* 1. OUTER HEAVY METAL CHASSIS (45° Chamfered Corners) */}
          <path
            d="M 50,14 
               L 360,14 
               L 370,8 L 630,8 L 640,14 
               L 950,14 
               L 986,50 
               L 986,490 
               L 950,526 
               L 50,526 
               L 14,490 
               L 14,50 Z"
            fill="url(#chassisGrad)"
            stroke="#5c667a"
            strokeWidth="2.5"
          />

          {/* 2. CHASSIS INNER BEVEL HIGHLIGHT RIM */}
          <path
            d="M 54,18 L 946,18 L 982,54 L 982,486 L 946,522 L 54,522 L 18,486 L 18,54 Z"
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1.5"
          />
          <path
            d="M 58,22 L 942,22 L 978,58 L 978,482 L 942,518 L 58,518 L 22,482 L 22,58 Z"
            fill="none"
            stroke="#0a0c10"
            strokeWidth="2"
          />

          {/* 3. SIDE AMBIENT NEON RIM GLOW (Cyan on Left, Red on Right) */}
          <path d="M 14,50 L 14,490" stroke="#00f0ff" strokeWidth="4.5" filter="url(#cyanGlow)" opacity="0.8" />
          <path d="M 986,50 L 986,490" stroke="#ff2244" strokeWidth="4.5" filter="url(#redGlow)" opacity="0.8" />

          {/* 4. SIDE FLANK VENTILATION LOUVERS (3 angled milled slots on each wing) */}
          {/* Left Wing Milled Slots */}
          <g fill="#0e1117" stroke="#3b4252" strokeWidth="1">
            <path d="M 38,180 L 52,166 L 56,168 L 42,182 Z" />
            <path d="M 38,250 L 52,236 L 56,238 L 42,252 Z" />
            <path d="M 38,320 L 52,306 L 56,308 L 42,322 Z" />
            <path d="M 64,130 L 64,390" stroke="#232733" strokeWidth="2" />
            <path d="M 65,130 L 65,390" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          </g>

          {/* Right Wing Milled Slots */}
          <g fill="#0e1117" stroke="#3b4252" strokeWidth="1">
            <path d="M 962,180 L 948,166 L 944,168 L 958,182 Z" />
            <path d="M 962,250 L 948,236 L 944,238 L 958,252 Z" />
            <path d="M 962,320 L 948,306 L 944,308 L 958,322 Z" />
            <path d="M 936,130 L 936,390" stroke="#232733" strokeWidth="2" />
            <path d="M 937,130 L 937,390" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          </g>

          {/* 5. CORNER MECHANICAL CUTS & PANEL ACCENTS */}
          {/* Top-Left Corner Cutout */}
          <path d="M 46,26 L 26,46" stroke="#10131a" strokeWidth="4" />
          <path d="M 47,27 L 27,47" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />

          {/* Top-Right Corner Cutout */}
          <path d="M 954,26 L 974,46" stroke="#10131a" strokeWidth="4" />
          <path d="M 953,27 L 973,47" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />

          {/* Bottom-Left Corner Cutout */}
          <path d="M 46,514 L 26,494" stroke="#10131a" strokeWidth="4" />
          <path d="M 47,513 L 27,493" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />

          {/* Bottom-Right Corner Cutout */}
          <path d="M 954,514 L 974,494" stroke="#10131a" strokeWidth="4" />
          <path d="M 953,513 L 973,493" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />

          {/* 6. TOP SECTION: CIRCUIT TRACE ENGRAVINGS */}
          <g stroke="#3a4252" strokeWidth="1.2" fill="none">
            {/* Left Traces */}
            <path d="M 180,42 L 230,42 L 242,54 L 320,54" />
            <circle cx="180" cy="42" r="2" fill="#525d70" />
            <circle cx="320" cy="54" r="2" fill="#525d70" />

            {/* Right Traces */}
            <path d="M 820,42 L 770,42 L 758,54 L 680,54" />
            <circle cx="820" cy="42" r="2" fill="#525d70" />
            <circle cx="680" cy="54" r="2" fill="#525d70" />
          </g>

          {/* 7. TOP-LEFT CIRCULAR TARGET CROSSHAIR DIAL */}
          <g transform="translate(114, 48)">
            <circle cx="0" cy="0" r="23" fill="#1e232d" stroke="#525d70" strokeWidth="2" />
            <circle cx="0" cy="0" r="20" fill="#0f1217" stroke="#12151c" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="16" fill="#2a0d12" stroke="#ef4444" strokeWidth="1.8" />
            <circle cx="0" cy="0" r="8" fill="none" stroke="#ef4444" strokeWidth="1.2" />
            <line x1="-15" y1="0" x2="-8" y2="0" stroke="#ef4444" strokeWidth="1.8" />
            <line x1="8" y1="0" x2="15" y2="0" stroke="#ef4444" strokeWidth="1.8" />
            <line x1="0" y1="-15" x2="0" y2="-8" stroke="#ef4444" strokeWidth="1.8" />
            <line x1="0" y1="8" x2="0" y2="15" stroke="#ef4444" strokeWidth="1.8" />
            <circle cx="0" cy="0" r="2.5" fill="#ef4444" filter="url(#redGlow)" />
          </g>

          {/* 8. TOP-RIGHT TACTICAL BUTTON HOUSINGS */}
          {/* Scope Fullscreen Button Bezel */}
          <g transform="translate(832, 33)">
            <rect
              x="0"
              y="0"
              width="32"
              height="30"
              rx="6"
              fill="#222834"
              stroke="#4f596d"
              strokeWidth="1.5"
            />
            <path
              d="M 8,11 L 8,8 L 11,8 M 21,8 L 24,8 L 24,11 M 8,19 L 8,22 L 11,22 M 21,22 L 24,22 L 24,19"
              stroke="#94a3b8"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="16" cy="15" r="2" fill="#94a3b8" />
          </g>

          {/* Red Exit 'X' Button Bezel */}
          <g transform="translate(872, 33)">
            <rect
              x="0"
              y="0"
              width="32"
              height="30"
              rx="6"
              fill="#2b1418"
              stroke="#ef4444"
              strokeWidth="1.5"
            />
            <line x1="9" y1="8" x2="23" y2="22" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="23" y1="8" x2="9" y2="22" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          {/* 9. RECESSED NEON GLOW TUBES (Cyan Left, Red Right) */}
          {/* Cyan Left Neon Glow Tube */}
          <g>
            <rect x="156" y="74" width="188" height="8" rx="4" fill="#081017" stroke="#16232e" strokeWidth="1" />
            <rect x="159" y="76" width="182" height="4" rx="2" fill="#00e5ff" filter="url(#cyanGlow)" />
            <rect x="159" y="76" width="182" height="4" rx="2" fill="url(#cyanTube)" />
          </g>

          {/* Red Right Neon Glow Tube */}
          <g>
            <rect x="656" y="74" width="188" height="8" rx="4" fill="#17080a" stroke="#2e1619" strokeWidth="1" />
            <rect x="659" y="76" width="182" height="4" rx="2" fill="#ff2244" filter="url(#redGlow)" />
            <rect x="659" y="76" width="182" height="4" rx="2" fill="url(#redTube)" />
          </g>

          {/* 10. TOP-CENTER RAISED GOLD/BRONZE PLAQUE WITH CROSSED REVOLVERS */}
          <g transform="translate(370, 6)" filter="url(#goldDropShadow)">
            {/* Crossed Revolvers Sculpture */}
            <g transform="translate(130, 2) scale(0.95)" fill="url(#goldTextGrad)" stroke="#5c2e0b" strokeWidth="0.8">
              {/* Left Revolver */}
              <g transform="rotate(-32)">
                <rect x="-18" y="-4" width="28" height="6" rx="1.5" />
                <rect x="-14" y="2" width="8" height="11" rx="2" />
                <circle cx="-5" cy="-1" r="4.5" />
                <rect x="10" y="-3" width="16" height="4" rx="1" />
              </g>
              {/* Right Revolver */}
              <g transform="rotate(32)">
                <rect x="-10" y="-4" width="28" height="6" rx="1.5" />
                <rect x="-6" y="2" width="8" height="11" rx="2" />
                <circle cx="3" cy="-1" r="4.5" />
                <rect x="18" y="-3" width="16" height="4" rx="1" />
              </g>
            </g>

            {/* Stepped Heavy Brass Plaque Border */}
            <path
              d="M 16,14 L 244,14 L 254,24 L 254,64 L 244,74 L 16,74 L 6,64 L 6,24 Z"
              fill="url(#goldFrameGrad)"
              stroke="#fde047"
              strokeWidth="1.5"
            />
            {/* Inner Dark Textured Metal Plate */}
            <path
              d="M 20,18 L 240,18 L 248,26 L 248,60 L 240,68 L 20,68 L 12,60 L 12,26 Z"
              fill="#141720"
              stroke="#78350f"
              strokeWidth="1.5"
            />

            {/* 4 Corner Brass Hex Screws */}
            <g fill="#fde047" stroke="#78350f" strokeWidth="0.8">
              <circle cx="20" cy="26" r="2.8" />
              <circle cx="240" cy="26" r="2.8" />
              <circle cx="20" cy="60" r="2.8" />
              <circle cx="240" cy="60" r="2.8" />
            </g>

            {/* Chiseled 3D Plaque Title: "Pistol Duel" */}
            <text
              x="130"
              y="50"
              textAnchor="middle"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize="24"
              fontWeight="900"
              letterSpacing="1.2"
              fill="url(#goldTextGrad)"
              stroke="#451a03"
              strokeWidth="0.8"
            >
              Pistol Duel
            </text>
          </g>

          {/* 11. INNER SCREEN BEZEL (Multi-layered 3D chamfered frame) */}
          <path
            d="M 112,106 L 888,106 L 902,120 L 902,402 L 888,416 L 112,416 L 98,402 L 98,120 Z"
            fill="url(#innerBezelGrad)"
            stroke="#454f63"
            strokeWidth="3"
          />
          {/* Deep Inset Shadow Frame */}
          <rect
            x="118"
            y="112"
            width="764"
            height="298"
            rx="6"
            fill="none"
            stroke="#07090e"
            strokeWidth="4"
          />

          {/* 12. BOTTOM RECESSED INSTRUCTION SLOT FRAME */}
          <rect
            x="245"
            y="420"
            width="510"
            height="26"
            rx="13"
            fill="#0c1017"
            stroke="#3a4254"
            strokeWidth="1.5"
          />

          {/* 13. BOTTOM TACTILE METAL PUSH BUTTON HOUSINGS */}
          {/* Like Button Frame */}
          <rect
            x="270"
            y="464"
            width="180"
            height="42"
            rx="10"
            fill="url(#btnMetalGrad)"
            stroke="#4b5568"
            strokeWidth="2"
          />
          <path d="M 276,466 L 444,466" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />

          {/* Report Button Frame */}
          <rect
            x="550"
            y="464"
            width="180"
            height="42"
            rx="10"
            fill="url(#btnMetalGrad)"
            stroke="#4b5568"
            strokeWidth="2"
          />
          <path d="M 556,466 L 724,466" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        </svg>

        {/* ═════════════════════════════════════════════════════════════════════
            CENTRAL CRT MONITOR SCREEN (Coordinates: x: 11.8%, y: 20.74%, w: 76.4%, h: 55.18%)
            ═════════════════════════════════════════════════════════════════════ */}
        <div
          className="absolute z-0 overflow-hidden cursor-crosshair"
          style={{
            left: '11.8%',
            top: '20.74%',
            width: '76.4%',
            height: '55.18%',
            borderRadius: '6px',
            boxShadow: 'inset 0 0 35px rgba(0,0,0,0.95)',
          }}
          onClick={handleShoot}
        >
          {/* Canvas for Game Rendering */}
          <div ref={screenAreaRef} className="w-full h-full relative">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

            {/* ── Screen Status Header Overlay (Image 1 Layout) ───────────── */}
            <div className="absolute top-0 left-0 right-0 px-3 sm:px-5 pt-2 pb-1 flex items-start justify-between pointer-events-none z-20">
              {/* Upper-Left: P1 with 4 hearts (3 cyan filled, 1 empty outline) */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span
                  className="font-mono font-black text-xs sm:text-sm tracking-widest text-[#00e5ff]"
                  style={{ textShadow: '0 0 8px rgba(0,229,255,0.8)' }}
                >
                  P1
                </span>
                <div className="flex items-center gap-1 text-sm sm:text-base">
                  {[...Array(hud.playerMaxHp)].map((_, i) => (
                    <span
                      key={i}
                      className={
                        i < hud.playerHp
                          ? 'text-[#00e5ff] drop-shadow-[0_0_8px_#00e5ff]'
                          : 'text-transparent border border-[#00e5ff] rounded-full inline-block w-3 h-3 -mt-0.5'
                      }
                    >
                      {i < hud.playerHp ? '♥' : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Upper-Right Area: CPU Hearts on top, Sub-Pill below */}
              <div className="flex flex-col items-end gap-1">
                {/* Upper-Right: 2 red filled hearts + CPU */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1 text-sm sm:text-base">
                    {[...Array(hud.cpuMaxHp)].map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < hud.cpuHp
                            ? 'text-[#ef4444] drop-shadow-[0_0_8px_#ef4444]'
                            : 'text-slate-800'
                        }
                      >
                        ♥
                      </span>
                    ))}
                  </div>
                  <span
                    className="font-mono font-black text-xs sm:text-sm tracking-widest text-[#ef4444]"
                    style={{ textShadow: '0 0 8px rgba(239,68,68,0.8)' }}
                  >
                    CPU
                  </span>
                </div>

                {/* Sub-Pill Capsule (LEVEL 2 | 🪙 100 | Audio | Battery) */}
                <div className="bg-[#121620]/90 px-2.5 py-0.5 rounded-full border border-white/15 flex items-center gap-2 text-[10px] sm:text-[11px] font-mono shadow-inner pointer-events-auto">
                  <span className="font-extrabold text-slate-200 tracking-wider">
                    LEVEL {hud.level}
                  </span>
                  <div className="flex items-center gap-1 text-yellow-400 font-bold">
                    <span>🪙</span>
                    <span>{coins}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSound('click', soundRef.current);
                      setSoundOn((s) => !s);
                    }}
                    className="text-slate-400 hover:text-white transition cursor-pointer"
                    title="Toggle Audio"
                  >
                    <i className={`fa-solid ${soundOn ? 'fa-volume-high' : 'fa-volume-xmark text-red-400'}`} />
                  </button>
                  <span className="text-emerald-400 text-xs">🔋</span>
                </div>
              </div>
            </div>

            {/* Victory Modal Overlay */}
            {phase === 'victory' && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 text-center">
                <div className="text-4xl sm:text-5xl animate-bounce mb-1">🏆</div>
                <h3 className="text-xl sm:text-2xl font-black text-amber-400 uppercase tracking-widest font-serif">
                  VICTORY!
                </h3>
                <p className="text-slate-300 text-xs mb-3">
                  LEVEL {hud.level} CLEARED · REWARD +50 COINS
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSound('click', soundRef.current);
                      startLevel(levelIdx + 1);
                    }}
                    className="bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black px-4 sm:px-5 py-2 rounded-xl text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition shadow-lg shadow-amber-500/30 cursor-pointer"
                  >
                    NEXT LEVEL →
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSound('click', soundRef.current);
                      startLevel(levelIdx);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 sm:px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                  >
                    REPLAY
                  </button>
                </div>
              </div>
            )}

            {/* Failed Modal Overlay */}
            {phase === 'failed' && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 text-center">
                <div className="text-4xl sm:text-5xl mb-1">💀</div>
                <h3 className="text-xl sm:text-2xl font-black text-red-500 uppercase tracking-widest font-serif">
                  FAILED!
                </h3>
                <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
                  CPU GOT YOU!
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound('click', soundRef.current);
                    startLevel(levelIdx);
                  }}
                  className="bg-gradient-to-r from-red-500 to-rose-600 text-white font-black px-5 sm:px-6 py-2 rounded-xl text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition shadow-lg shadow-red-500/30 cursor-pointer"
                >
                  RETRY LEVEL {hud.level}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM RECESSED INSTRUCTION TEXT (Centered in the bottom slot) ── */}
        <div
          className="absolute z-20 text-center pointer-events-none"
          style={{
            left: '24.5%',
            top: '77.77%',
            width: '51%',
            height: '4.81%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className="text-[9px] sm:text-[11px] md:text-[12px] font-black tracking-widest text-slate-300 uppercase font-mono animate-pulse"
            style={{
              textShadow: '0 0 8px rgba(56,189,248,0.5)',
            }}
          >
            TAP TO SHOOT — MASTER THE RECOIL FOR THE NEXT LEVEL!
          </span>
        </div>

        {/* ── TOP-RIGHT INTERACTIVE BUTTON OVERLAYS ───────────────────────── */}
        {/* Fullscreen Button */}
        {onToggleFullscreen && (
          <button
            onClick={() => {
              playSound('click', soundRef.current);
              onToggleFullscreen();
            }}
            className="absolute z-20 cursor-pointer active:scale-95"
            style={{
              left: '83.2%',
              top: '6.1%',
              width: '3.2%',
              height: '5.55%',
              opacity: 0,
            }}
            title="Fullscreen Toggle"
          />
        )}

        {/* Exit Button */}
        {onClose && (
          <button
            onClick={() => {
              playSound('click', soundRef.current);
              onClose();
            }}
            className="absolute z-20 cursor-pointer active:scale-95"
            style={{
              left: '87.2%',
              top: '6.1%',
              width: '3.2%',
              height: '5.55%',
              opacity: 0,
            }}
            title="Close Game"
          />
        )}

        {/* ── LOWER DECK TACTILE BUTTONS (Like & Report Game) ──────────────── */}
        {/* Like (99%) Button */}
        <button
          onClick={() => {
            playSound('click', soundRef.current);
            toggleLike();
          }}
          className={`absolute z-20 flex items-center justify-center gap-2 text-xs font-black transition cursor-pointer active:scale-95 ${
            isLiked ? 'text-emerald-300' : 'text-slate-300 hover:text-white'
          }`}
          style={{
            left: '27%',
            top: '85.92%',
            width: '18%',
            height: '7.77%',
            background: 'transparent',
          }}
        >
          <i className={`fa-solid fa-thumbs-up text-sm ${isLiked ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span>Like (99%)</span>
        </button>

        {/* Report Game Button */}
        <button
          onClick={() => {
            playSound('click', soundRef.current);
            triggerReport();
          }}
          className="absolute z-20 flex items-center justify-center gap-2 text-xs font-black text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
          style={{
            left: '55%',
            top: '85.92%',
            width: '18%',
            height: '7.77%',
            background: 'transparent',
          }}
        >
          <i className="fa-solid fa-flag text-sm text-slate-400" />
          <span>{reportedMsg ? 'Reported!' : 'Report game'}</span>
        </button>
      </div>
    </div>
  );
}
