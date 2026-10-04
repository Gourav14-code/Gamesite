import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RewardedAdService } from '../services/RewardedAdService';

/* ═══════════════════════════════════════════════════════════════════════════════
   PISTOL DUEL — RESTORED FULL-FRAME GUN ROTATION & DUAL INDEPENDENT AI
   ═══════════════════════════════════════════════════════════════════════════════
   - PLAYER:
     * Full-frame 360° continuous rotation around shooting frame.
     * Player input: tap to shoot at current angle.
     * Realistic recoil impulse: linear knockback + torque spin alteration.
     * Wall bounce & boundary containment on LEFT side.
   - CPU:
     * Step 1: CPU starts first! Fires initial single bullet toward Player.
     * Step 2: Player reacts.
     * Step 3: CPU becomes active! Full-frame continuous rotation & searching.
     * When rotated within targeting tolerance of Player -> AUTOMATIC SHOOT!
     * Recoil kickback + torque spin -> Continues rotating to find next shot.
     * Completely independent from Player rotation & input.
   - UI:
     * Player on LEFT side, CPU on RIGHT side (Desktop & Mobile).
     * Bullets exit boundaries immediately (no bounce, no trapping).
     * 100% dynamic health hearts for both combatants (4 Hearts each).
     * Battery indicator completely removed.
     * "TAP TO SHOOT" auto-hides after 3.8s.
     * Top-right navigation: Pause | Home | Fullscreen | Close.
   ═══════════════════════════════════════════════════════════════════════════════ */

// ── 50 Levels Configuration (Equal 4 Hearts for Both Player & CPU, Progressive Real Difficulty) ─
const LEVELS = [
  // ── 1. TUTORIAL / EASY (Levels 1–5: Learning Mechanics, Open -> Pillars) ──
  { level: 1,  name: 'Rookie Duel',     playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 1.8, cpuDelay: 2800, cpuTol: 0.38, cpuBulletSpeed: 520, cpuAggression: 1.0, cpuWeapons: 1, layout: 'open',                   coins: 50  },
  { level: 2,  name: 'Arcade Master',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 1.9, cpuDelay: 2600, cpuTol: 0.35, cpuBulletSpeed: 540, cpuAggression: 1.1, cpuWeapons: 1, layout: 'center_post',            coins: 60  },
  { level: 3,  name: 'Center Pillar',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.0, cpuDelay: 2400, cpuTol: 0.32, cpuBulletSpeed: 560, cpuAggression: 1.2, cpuWeapons: 1, layout: 'center_small',           coins: 70  },
  { level: 4,  name: 'Quick Draw',      playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.1, cpuDelay: 2200, cpuTol: 0.30, cpuBulletSpeed: 580, cpuAggression: 1.3, cpuWeapons: 1, layout: 'dual_small',             coins: 80  },
  { level: 5,  name: 'Sharpshooter',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.2, cpuDelay: 2000, cpuTol: 0.28, cpuBulletSpeed: 600, cpuAggression: 1.4, cpuWeapons: 1, layout: 'center_wall',            coins: 100 },

  // ── 2. BEGINNER → MEDIUM (Levels 6–10: Moving Barriers, Better AI) ───────
  { level: 6,  name: 'Dead Eye',        playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.3, cpuDelay: 1900, cpuTol: 0.26, cpuBulletSpeed: 620, cpuAggression: 1.5, cpuWeapons: 1, layout: 'split_gates',            coins: 110 },
  { level: 7,  name: 'Twin Barrels',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.4, cpuDelay: 1800, cpuTol: 0.25, cpuBulletSpeed: 630, cpuAggression: 1.6, cpuWeapons: 1, layout: 'dual_walls',             coins: 120 },
  { level: 8,  name: 'Iron Sight',      playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.5, cpuDelay: 1700, cpuTol: 0.24, cpuBulletSpeed: 640, cpuAggression: 1.7, cpuWeapons: 1, layout: 'moving_vert_single',      coins: 130 },
  { level: 9,  name: 'High Noon',       playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.6, cpuDelay: 1600, cpuTol: 0.23, cpuBulletSpeed: 650, cpuAggression: 1.8, cpuWeapons: 1, layout: 'moving_horiz_patrol',     coins: 140 },
  { level: 10, name: 'Gunslinger',      playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.7, cpuDelay: 1500, cpuTol: 0.22, cpuBulletSpeed: 660, cpuAggression: 2.0, cpuWeapons: 1, layout: 'staggered_cross',         coins: 160 },

  // ── 3. MEDIUM (Levels 11–15: Dynamic Obstacles, Fair Combat) ─────────────
  { level: 11, name: 'Bullet Storm',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.8, cpuDelay: 1450, cpuTol: 0.21, cpuBulletSpeed: 670, cpuAggression: 2.1, cpuWeapons: 1, layout: 'triple_gates',           coins: 170 },
  { level: 12, name: 'Outlaw Canyon',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.8, cpuDelay: 1400, cpuTol: 0.21, cpuBulletSpeed: 680, cpuAggression: 2.2, cpuWeapons: 1, layout: 'canyon_lanes',           coins: 180 },
  { level: 13, name: 'Neon Trigger',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.9, cpuDelay: 1350, cpuTol: 0.20, cpuBulletSpeed: 690, cpuAggression: 2.3, cpuWeapons: 1, layout: 'moving_dual_counter',     coins: 190 },
  { level: 14, name: 'Cyber Saloon',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 2.9, cpuDelay: 1300, cpuTol: 0.20, cpuBulletSpeed: 700, cpuAggression: 2.4, cpuWeapons: 1, layout: 'bunker_shelter',         coins: 200 },
  { level: 15, name: 'Desert Phantom',  playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.0, cpuDelay: 1250, cpuTol: 0.19, cpuBulletSpeed: 710, cpuAggression: 2.5, cpuWeapons: 1, layout: 'moving_bunker',          coins: 220 },

  // ── 4. HARD (Levels 16–20: Rotating Barriers, Tight Cover, Checkpoint) ───
  { level: 16, name: 'Copper Bullet',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.0, cpuDelay: 1200, cpuTol: 0.19, cpuBulletSpeed: 720, cpuAggression: 2.6, cpuWeapons: 1, layout: 'rotating_single',        coins: 230 },
  { level: 17, name: 'Silver Barrel',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.1, cpuDelay: 1180, cpuTol: 0.18, cpuBulletSpeed: 730, cpuAggression: 2.7, cpuWeapons: 1, layout: 'rotating_fast',          coins: 240 },
  { level: 18, name: 'Golden Hammer',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.1, cpuDelay: 1160, cpuTol: 0.18, cpuBulletSpeed: 740, cpuAggression: 2.8, cpuWeapons: 1, layout: 'moving_horiz_gate',      coins: 250 },
  { level: 19, name: 'Steel Recoil',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.2, cpuDelay: 1140, cpuTol: 0.17, cpuBulletSpeed: 750, cpuAggression: 2.9, cpuWeapons: 1, layout: 'rotating_plus_moving',   coins: 260 },
  { level: 20, name: 'Viper Strike',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.2, cpuDelay: 1120, cpuTol: 0.17, cpuBulletSpeed: 760, cpuAggression: 3.0, cpuWeapons: 1, layout: 'fortress_checkpoint',    coins: 280 },

  // ── 5. HARD+ (Levels 21–25: Pinwheels, Slalom, Destructible Shields) ─────
  { level: 21, name: 'Shadow Stalker',  playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.3, cpuDelay: 1100, cpuTol: 0.17, cpuBulletSpeed: 765, cpuAggression: 3.1, cpuWeapons: 1, layout: 'pinwheel_corridor',      coins: 290 },
  { level: 22, name: 'Thunder Holster', playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.3, cpuDelay: 1080, cpuTol: 0.16, cpuBulletSpeed: 770, cpuAggression: 3.2, cpuWeapons: 1, layout: 'slalom_triple',          coins: 300 },
  { level: 23, name: 'Crimson Fury',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.4, cpuDelay: 1060, cpuTol: 0.16, cpuBulletSpeed: 775, cpuAggression: 3.3, cpuWeapons: 1, layout: 'narrow_keyhole',         coins: 310 },
  { level: 24, name: 'Rapid Chamber',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.4, cpuDelay: 1040, cpuTol: 0.15, cpuBulletSpeed: 780, cpuAggression: 3.4, cpuWeapons: 1, layout: 'dual_rotators_fast',    coins: 320 },
  { level: 25, name: 'Grave Digger',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.4, cpuDelay: 1020, cpuTol: 0.15, cpuBulletSpeed: 785, cpuAggression: 3.5, cpuWeapons: 1, layout: 'destructible_shields',   coins: 340 },

  // ── 6. ADVANCED (Levels 26–30: Intro 2nd Weapon at L28, Dual Gun Challenge at L30) ──
  { level: 26, name: 'Sheriff Standoff',playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.5, cpuDelay: 1000, cpuTol: 0.15, cpuBulletSpeed: 790, cpuAggression: 3.6, cpuWeapons: 1, layout: 'rotating_cross_large',   coins: 350 },
  { level: 27, name: 'Bandit Ambush',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.5, cpuDelay: 980,  cpuTol: 0.14, cpuBulletSpeed: 795, cpuAggression: 3.7, cpuWeapons: 1, layout: 'moving_dual_vertical',  coins: 360 },
  { level: 28, name: 'Bounty Hunter',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.2, cpuDelay: 1100, cpuTol: 0.16, cpuBulletSpeed: 790, cpuAggression: 3.5, cpuWeapons: 2, cpu2DelayRatio: 1.8, layout: 'gauntlet_dual_start', coins: 380 },
  { level: 29, name: 'Revolver Soul',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.3, cpuDelay: 1050, cpuTol: 0.15, cpuBulletSpeed: 795, cpuAggression: 3.6, cpuWeapons: 2, cpu2DelayRatio: 1.5, layout: 'crossfire_alley',     coins: 400 },
  { level: 30, name: 'Blazing Horizon', playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.4, cpuDelay: 1000, cpuTol: 0.14, cpuBulletSpeed: 800, cpuAggression: 3.8, cpuWeapons: 2, cpu2DelayRatio: 1.2, layout: 'championship_arena', coins: 420 },

  // ── 7. VERY HARD (Levels 31–35: Dual Weapons + Moving & Rotating Traps) ──
  { level: 31, name: 'Rust & Powder',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.5, cpuDelay: 980,  cpuTol: 0.14, cpuBulletSpeed: 805, cpuAggression: 3.9, cpuWeapons: 2, layout: 'triple_moving',          coins: 440 },
  { level: 32, name: 'Calamity Jane',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.5, cpuDelay: 960,  cpuTol: 0.13, cpuBulletSpeed: 810, cpuAggression: 4.0, cpuWeapons: 2, layout: 'rotating_plus_pillars',  coins: 460 },
  { level: 33, name: 'Wild Card',       playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.6, cpuDelay: 940,  cpuTol: 0.13, cpuBulletSpeed: 815, cpuAggression: 4.1, cpuWeapons: 2, layout: 'dual_rotators',          coins: 480 },
  { level: 34, name: 'Iron Hide',       playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.6, cpuDelay: 920,  cpuTol: 0.13, cpuBulletSpeed: 820, cpuAggression: 4.2, cpuWeapons: 2, layout: 'destructible_bunkers',   coins: 500 },
  { level: 35, name: 'Blood Moon',      playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.7, cpuDelay: 900,  cpuTol: 0.12, cpuBulletSpeed: 825, cpuAggression: 4.3, cpuWeapons: 2, layout: 'fortress_dual',          coins: 520 },

  // ── 8. EXPERT (Levels 36–40: Precision Combinations, Rapid Combat) ────────
  { level: 36, name: 'Midnight Duel',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.7, cpuDelay: 880,  cpuTol: 0.12, cpuBulletSpeed: 830, cpuAggression: 4.4, cpuWeapons: 2, layout: 'moving_cross',           coins: 540 },
  { level: 37, name: 'Ghost Rider',     playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.8, cpuDelay: 860,  cpuTol: 0.12, cpuBulletSpeed: 830, cpuAggression: 4.5, cpuWeapons: 2, layout: 'slalom_quad',            coins: 560 },
  { level: 38, name: 'Fatal Trigger',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.8, cpuDelay: 840,  cpuTol: 0.12, cpuBulletSpeed: 835, cpuAggression: 4.6, cpuWeapons: 2, layout: 'pinwheel_moving',        coins: 580 },
  { level: 39, name: 'Smoking Gun',     playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.9, cpuDelay: 820,  cpuTol: 0.11, cpuBulletSpeed: 835, cpuAggression: 4.7, cpuWeapons: 2, layout: 'narrow_dual_windows',   coins: 600 },
  { level: 40, name: 'Apex Predator',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 3.9, cpuDelay: 800,  cpuTol: 0.11, cpuBulletSpeed: 840, cpuAggression: 4.8, cpuWeapons: 2, layout: 'predator_citadel',      coins: 650 },

  // ── 9. MASTER (Levels 41–45: Extreme AI, Narrow Windows) ──────────────────
  { level: 41, name: 'Venomous Caliber',playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.0, cpuDelay: 780,  cpuTol: 0.11, cpuBulletSpeed: 840, cpuAggression: 4.9, cpuWeapons: 2, layout: 'rotating_scissor',        coins: 680 },
  { level: 42, name: 'Rogue Marshal',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.0, cpuDelay: 760,  cpuTol: 0.11, cpuBulletSpeed: 845, cpuAggression: 5.0, cpuWeapons: 2, layout: 'dual_rotator_moving',    coins: 710 },
  { level: 43, name: 'Crossfire King',  playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.1, cpuDelay: 740,  cpuTol: 0.10, cpuBulletSpeed: 845, cpuAggression: 5.1, cpuWeapons: 2, layout: 'laser_grid_pillars',    coins: 740 },
  { level: 44, name: 'Infernal Spin',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.1, cpuDelay: 720,  cpuTol: 0.10, cpuBulletSpeed: 850, cpuAggression: 5.2, cpuWeapons: 2, layout: 'vortex_rotator',         coins: 770 },
  { level: 45, name: 'Judgment Day',    playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.2, cpuDelay: 700,  cpuTol: 0.10, cpuBulletSpeed: 850, cpuAggression: 5.3, cpuWeapons: 2, layout: 'citadel_judgment',      coins: 800 },

  // ── 10. EXTREME (Levels 46–49: Near-Final Lethal Challenge) ───────────────
  { level: 46, name: 'Titan Duelist',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.2, cpuDelay: 680,  cpuTol: 0.10, cpuBulletSpeed: 855, cpuAggression: 5.4, cpuWeapons: 2, layout: 'extreme_triple_rotor',   coins: 850 },
  { level: 47, name: 'Dragon Breath',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.3, cpuDelay: 660,  cpuTol: 0.10, cpuBulletSpeed: 855, cpuAggression: 5.5, cpuWeapons: 2, layout: 'extreme_counter_slalom', coins: 900 },
  { level: 48, name: 'Abyssal Caliber', playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.3, cpuDelay: 640,  cpuTol: 0.09, cpuBulletSpeed: 860, cpuAggression: 5.6, cpuWeapons: 2, layout: 'abyssal_gate',           coins: 950 },
  { level: 49, name: 'Doomsday Duel',   playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.4, cpuDelay: 620,  cpuTol: 0.09, cpuBulletSpeed: 860, cpuAggression: 5.7, cpuWeapons: 2, layout: 'doomsday_nexus',         coins: 1000 },

  // ── 11. FINAL BOSS DUEL (Level 50: Supreme Showdown) ─────────────────────
  { level: 50, name: 'Ultimate Beretta',playerMaxHp: 4, cpuHp: 4, cpuSpinMin: 4.5, cpuDelay: 600,  cpuTol: 0.09, cpuBulletSpeed: 860, cpuAggression: 6.0, cpuWeapons: 2, layout: 'boss_nexus_citadel',     coins: 1500 },
];

// ── Poki-Style Start Screen Carousel Slides (Matches User Reference Image 1) ──
const CAROUSEL_SLIDES = [
  {
    img: '/images/neon_duel_shot_logo.png',
    badge: 'TACTICAL COMBAT',
    title: 'NEON DUEL SHOT: JOIN THE DUEL',
    desc: 'Dual Beretta combat with realistic recoil, obstacles and tactical marksmanship',
  },
  {
    img: '/images/desktop_neon_frame.jpg',
    badge: '360° COMBAT ARENA',
    title: 'NEON COMBAT ARENA',
    desc: 'Master the high recoil and 360° spin to dominate each shootout',
  },
  {
    img: '/images/mobile_neon_frame.jpg',
    badge: '50 CHALLENGING LEVELS',
    title: '50 DEADLY STAGES',
    desc: 'Progress through lethal CPU bosses & earn 50 Coins per victory',
  },
];

// ── Cross-Browser Rounded Rect Helper ─────────────────────────────────────────
function drawRoundRect(ctx, x, y, w, h, r = 4) {
  const rad = Math.min(Math.min(w / 2, h / 2), typeof r === 'number' ? r : 4);
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

// ── Obstacle Geometry & Collision Helpers ─────────────────────────────────────
function lineIntersectsAABB(x1, y1, x2, y2, minX, maxX, minY, maxY) {
  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true;
  if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
  let u1 = 0;
  let u2 = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > u2) return false;
        if (t > u1) u1 = t;
      } else {
        if (t < u1) return false;
        if (t < u2) u2 = t;
      }
    }
  }
  return u1 <= u2;
}

function lineIntersectsOBB(x1, y1, x2, y2, cx, cy, w, h, angle = 0) {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);

  const lx1 = (x1 - cx) * cos - (y1 - cy) * sin;
  const ly1 = (x1 - cx) * sin + (y1 - cy) * cos;
  const lx2 = (x2 - cx) * cos - (y2 - cy) * sin;
  const ly2 = (x2 - cx) * sin + (y2 - cy) * cos;

  const hw = w * 0.5;
  const hh = h * 0.5;
  return lineIntersectsAABB(lx1, ly1, lx2, ly2, -hw, hw, -hh, hh);
}

function circleIntersectsOBB(gx, gy, radius, cx, cy, w, h, angle = 0) {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);

  const lx = (gx - cx) * cos - (gy - cy) * sin;
  const ly = (gx - cx) * sin + (gy - cy) * cos;

  const hw = w * 0.5;
  const hh = h * 0.5;

  // Handle case where gun center penetrates inside the box
  if (lx >= -hw && lx <= hw && ly >= -hh && ly <= hh) {
    const dLeft = lx - (-hw);
    const dRight = hw - lx;
    const dTop = ly - (-hh);
    const dBottom = hh - ly;
    const minD = Math.min(dLeft, dRight, dTop, dBottom);
    let lnx = 0;
    let lny = 0;
    if (minD === dLeft) lnx = -1;
    else if (minD === dRight) lnx = 1;
    else if (minD === dTop) lny = -1;
    else lny = 1;
    const overlap = radius + minD;
    const nx = lnx * Math.cos(angle) - lny * Math.sin(angle);
    const ny = lnx * Math.sin(angle) + lny * Math.cos(angle);
    return { hit: true, nx, ny, overlap };
  }

  const closestX = Math.max(-hw, Math.min(hw, lx));
  const closestY = Math.max(-hh, Math.min(hh, ly));

  const distX = lx - closestX;
  const distY = ly - closestY;
  const distSq = distX * distX + distY * distY;

  if (distSq < radius * radius) {
    const dist = Math.sqrt(distSq) || 0.001;
    const overlap = radius - dist;
    const lnx = distX / dist;
    const lny = distY / dist;
    const nx = lnx * Math.cos(angle) - lny * Math.sin(angle);
    const ny = lnx * Math.sin(angle) + lny * Math.cos(angle);
    return { hit: true, nx, ny, overlap };
  }
  return null;
}

function getObstaclesForLayout(layout, W, H, isPortrait) {
  const obstacles = [];
  const cx = W * 0.5;
  const cy = H * 0.5;
  const minDim = Math.min(W, H);

  switch (layout) {
    case 'open':
      break;

    case 'center_post':
      obstacles.push({
        id: 'cp1',
        type: 'static',
        x: cx,
        y: cy,
        w: 24,
        h: 24,
      });
      break;

    case 'center_small':
      obstacles.push({
        id: 'c1',
        type: 'static',
        x: cx,
        y: cy,
        w: 24,
        h: H * 0.30,
      });
      break;

    case 'dual_small':
      obstacles.push(
        { id: 't1', type: 'static', x: cx, y: H * 0.28, w: 22, h: H * 0.22 },
        { id: 'b1', type: 'static', x: cx, y: H * 0.72, w: 22, h: H * 0.22 }
      );
      break;

    case 'center_wall':
      obstacles.push({
        id: 'cw',
        type: 'static',
        x: cx,
        y: cy,
        w: 20,
        h: H * 0.32,
      });
      break;

    case 'split_gates':
      obstacles.push(
        { id: 'sg1', type: 'static', x: cx, y: H * 0.18, w: 20, h: H * 0.22 },
        { id: 'sg2', type: 'static', x: cx, y: H * 0.82, w: 20, h: H * 0.22 }
      );
      break;

    case 'dual_walls':
      obstacles.push(
        { id: 'w1', type: 'static', x: W * 0.44, y: H * 0.32, w: 20, h: H * 0.28 },
        { id: 'w2', type: 'static', x: W * 0.56, y: H * 0.68, w: 20, h: H * 0.28 }
      );
      break;

    case 'moving_vert_single':
      obstacles.push({
        id: 'mv1',
        type: 'moving',
        x: cx,
        y: cy,
        baseX: cx,
        baseY: cy,
        w: 22,
        h: H * 0.28,
        moveAxis: 'y',
        moveRange: H * 0.16,
        moveSpeed: 1.5,
        movePhase: 0,
      });
      break;

    case 'moving_horiz_patrol':
      obstacles.push({
        id: 'mhp1',
        type: 'moving',
        x: cx,
        y: cy,
        baseX: cx,
        baseY: cy,
        w: W * 0.22,
        h: 20,
        moveAxis: 'x',
        moveRange: W * 0.12,
        moveSpeed: 1.8,
        movePhase: 0,
      });
      break;

    case 'staggered_cross':
      obstacles.push(
        { id: 'sc1', type: 'static', x: cx, y: cy, w: W * 0.18, h: 20 },
        { id: 'sc2', type: 'static', x: W * 0.42, y: H * 0.22, w: 20, h: H * 0.18 },
        { id: 'sc3', type: 'static', x: W * 0.58, y: H * 0.78, w: 20, h: H * 0.18 }
      );
      break;

    case 'triple_gates':
      obstacles.push(
        { id: 'tg1', type: 'static', x: W * 0.44, y: H * 0.20, w: 18, h: H * 0.16 },
        { id: 'tg2', type: 'static', x: W * 0.56, y: H * 0.80, w: 18, h: H * 0.16 }
      );
      break;

    case 'canyon_lanes':
      obstacles.push(
        { id: 'cl1', type: 'static', x: cx, y: H * 0.18, w: W * 0.18, h: 18 },
        { id: 'cl2', type: 'static', x: cx, y: H * 0.82, w: W * 0.18, h: 18 }
      );
      break;

    case 'moving_dual_counter':
      obstacles.push(
        { id: 'md1', type: 'moving', x: W * 0.45, y: H * 0.35, baseX: W * 0.45, baseY: cy, w: 20, h: H * 0.26, moveAxis: 'y', moveRange: H * 0.16, moveSpeed: 1.8, movePhase: 0 },
        { id: 'md2', type: 'moving', x: W * 0.55, y: H * 0.65, baseX: W * 0.55, baseY: cy, w: 20, h: H * 0.26, moveAxis: 'y', moveRange: H * 0.16, moveSpeed: 1.8, movePhase: Math.PI }
      );
      break;

    case 'bunker_shelter':
      obstacles.push(
        { id: 'bs1', type: 'static', x: cx, y: H * 0.22, w: W * 0.20, h: 20 },
        { id: 'bs2', type: 'static', x: cx, y: H * 0.78, w: W * 0.20, h: 20 }
      );
      break;

    case 'moving_bunker':
      obstacles.push(
        { id: 'mb1', type: 'static', x: W * 0.44, y: H * 0.16, w: 22, h: H * 0.15 },
        { id: 'mb2', type: 'static', x: W * 0.44, y: H * 0.84, w: 22, h: H * 0.15 },
        { id: 'mb3', type: 'moving', x: W * 0.56, y: cy, baseX: W * 0.56, baseY: cy, w: 20, h: H * 0.20, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 1.8, movePhase: 0 }
      );
      break;

    case 'rotating_single':
      obstacles.push({
        id: 'rot1',
        type: 'rotating',
        x: cx,
        y: cy,
        w: minDim * 0.46,
        h: 20,
        angle: 0,
        rotSpeed: 1.3,
      });
      break;

    case 'rotating_fast':
      obstacles.push(
        { id: 'rf1', type: 'rotating', x: cx, y: cy, w: minDim * 0.48, h: 20, angle: 0, rotSpeed: 2.2 },
        { id: 'rf2', type: 'static', x: cx, y: H * 0.12, w: 24, h: 18 },
        { id: 'rf3', type: 'static', x: cx, y: H * 0.88, w: 24, h: 18 }
      );
      break;

    case 'moving_horiz_gate':
      obstacles.push(
        { id: 'mh1', type: 'moving', x: cx, y: H * 0.32, baseX: cx, baseY: H * 0.32, w: W * 0.26, h: 20, moveAxis: 'x', moveRange: W * 0.12, moveSpeed: 1.6, movePhase: 0 },
        { id: 'mh2', type: 'moving', x: cx, y: H * 0.68, baseX: cx, baseY: H * 0.68, w: W * 0.26, h: 20, moveAxis: 'x', moveRange: W * 0.12, moveSpeed: 1.6, movePhase: Math.PI }
      );
      break;

    case 'rotating_plus_moving':
      obstacles.push(
        { id: 'rpm1', type: 'rotating', x: W * 0.46, y: cy, w: minDim * 0.42, h: 18, angle: 0, rotSpeed: 1.6 },
        { id: 'rpm2', type: 'moving', x: W * 0.58, y: cy, baseX: W * 0.58, baseY: cy, w: 22, h: H * 0.40, moveAxis: 'y', moveRange: H * 0.22, moveSpeed: 2.0, movePhase: 0 }
      );
      break;

    case 'fortress_checkpoint':
      obstacles.push(
        { id: 'fcp1', type: 'static', x: cx, y: cy, w: 28, h: H * 0.32 },
        { id: 'fcp2', type: 'moving', x: W * 0.40, y: H * 0.30, baseX: W * 0.40, baseY: cy, w: 20, h: H * 0.32, moveAxis: 'y', moveRange: H * 0.24, moveSpeed: 2.2, movePhase: 0 },
        { id: 'fcp3', type: 'moving', x: W * 0.60, y: H * 0.70, baseX: W * 0.60, baseY: cy, w: 20, h: H * 0.32, moveAxis: 'y', moveRange: H * 0.24, moveSpeed: 2.2, movePhase: Math.PI }
      );
      break;

    case 'pinwheel_corridor':
      obstacles.push(
        { id: 'pwc1', type: 'rotating', x: cx, y: cy, w: minDim * 0.50, h: 20, angle: 0, rotSpeed: -1.7 },
        { id: 'pwc2', type: 'static', x: W * 0.38, y: H * 0.22, w: 20, h: H * 0.24 },
        { id: 'pwc3', type: 'static', x: W * 0.62, y: H * 0.78, w: 20, h: H * 0.24 }
      );
      break;

    case 'slalom_triple':
      obstacles.push(
        { id: 'st1', type: 'moving', x: W * 0.46, y: cy, baseX: W * 0.46, baseY: cy, w: 18, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.0, movePhase: 0 },
        { id: 'st2', type: 'moving', x: W * 0.54, y: cy, baseX: W * 0.54, baseY: cy, w: 18, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.0, movePhase: Math.PI }
      );
      break;

    case 'narrow_keyhole':
      obstacles.push(
        { id: 'nk1', type: 'static', x: cx, y: H * 0.16, w: 20, h: H * 0.18 },
        { id: 'nk2', type: 'static', x: cx, y: H * 0.84, w: 20, h: H * 0.18 },
        { id: 'nk3', type: 'moving', x: cx, y: cy, baseX: cx, baseY: cy, w: 20, h: 22, moveAxis: 'y', moveRange: H * 0.08, moveSpeed: 1.8, movePhase: 0 }
      );
      break;

    case 'dual_rotators_fast':
      obstacles.push(
        { id: 'drf1', type: 'rotating', x: W * 0.44, y: cy, w: minDim * 0.38, h: 18, angle: 0, rotSpeed: 2.2 },
        { id: 'drf2', type: 'rotating', x: W * 0.56, y: cy, w: minDim * 0.38, h: 18, angle: Math.PI * 0.5, rotSpeed: -2.2 }
      );
      break;

    case 'destructible_shields':
      obstacles.push(
        { id: 'ds1', type: 'static', isDestructible: true, hp: 3, maxHp: 3, x: cx, y: H * 0.30, w: 26, h: H * 0.22 },
        { id: 'ds2', type: 'static', isDestructible: true, hp: 3, maxHp: 3, x: cx, y: cy, w: 26, h: H * 0.22 },
        { id: 'ds3', type: 'static', isDestructible: true, hp: 3, maxHp: 3, x: cx, y: H * 0.70, w: 26, h: H * 0.22 }
      );
      break;

    case 'rotating_cross_large':
      obstacles.push(
        { id: 'rcl1', type: 'rotating', x: cx, y: cy, w: minDim * 0.52, h: 20, angle: 0, rotSpeed: 1.5 },
        { id: 'rcl2', type: 'rotating', x: cx, y: cy, w: 20, h: minDim * 0.52, angle: 0, rotSpeed: 1.5 }
      );
      break;

    case 'moving_dual_vertical':
      obstacles.push(
        { id: 'mdv1', type: 'moving', x: W * 0.42, y: cy, baseX: W * 0.42, baseY: cy, w: 24, h: H * 0.44, moveAxis: 'y', moveRange: H * 0.25, moveSpeed: 2.6, movePhase: 0 },
        { id: 'mdv2', type: 'moving', x: W * 0.58, y: cy, baseX: W * 0.58, baseY: cy, w: 24, h: H * 0.44, moveAxis: 'y', moveRange: H * 0.25, moveSpeed: 2.6, movePhase: Math.PI }
      );
      break;

    case 'gauntlet_dual_start':
      obstacles.push(
        { id: 'gds1', type: 'static', x: cx, y: cy, w: 28, h: H * 0.44 },
        { id: 'gds2', type: 'moving', x: cx, y: cy, baseX: cx, baseY: cy, w: W * 0.20, h: 18, moveAxis: 'x', moveRange: W * 0.08, moveSpeed: 1.5, movePhase: 0 }
      );
      break;

    case 'crossfire_alley':
      obstacles.push(
        { id: 'cfa1', type: 'static', x: W * 0.42, y: H * 0.32, w: 22, h: H * 0.35 },
        { id: 'cfa2', type: 'static', x: W * 0.58, y: H * 0.68, w: 22, h: H * 0.35 },
        { id: 'cfa3', type: 'moving', x: cx, y: cy, baseX: cx, baseY: cy, w: 22, h: H * 0.28, moveAxis: 'y', moveRange: H * 0.18, moveSpeed: 2.4, movePhase: 0 }
      );
      break;

    case 'championship_arena':
      obstacles.push(
        { id: 'ca1', type: 'rotating', x: cx, y: cy, w: minDim * 0.48, h: 20, angle: 0, rotSpeed: 1.9 },
        { id: 'ca2', type: 'moving', x: W * 0.38, y: H * 0.25, baseX: W * 0.38, baseY: cy, w: 20, h: H * 0.30, moveAxis: 'y', moveRange: H * 0.22, moveSpeed: 2.2, movePhase: 0 },
        { id: 'ca3', type: 'moving', x: W * 0.62, y: H * 0.75, baseX: W * 0.62, baseY: cy, w: 20, h: H * 0.30, moveAxis: 'y', moveRange: H * 0.22, moveSpeed: 2.2, movePhase: Math.PI }
      );
      break;

    case 'triple_moving':
      obstacles.push(
        { id: 'tm1', type: 'moving', x: W * 0.42, y: cy, baseX: W * 0.42, baseY: cy, w: 18, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.2, movePhase: 0 },
        { id: 'tm2', type: 'moving', x: W * 0.50, y: cy, baseX: W * 0.50, baseY: cy, w: 18, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.2, movePhase: Math.PI * 0.5 },
        { id: 'tm3', type: 'moving', x: W * 0.58, y: cy, baseX: W * 0.58, baseY: cy, w: 18, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.2, movePhase: Math.PI }
      );
      break;

    case 'rotating_plus_pillars':
      obstacles.push(
        { id: 'rpp1', type: 'rotating', x: cx, y: cy, w: minDim * 0.50, h: 20, angle: 0, rotSpeed: 2.2 },
        { id: 'rpp2', type: 'static', x: W * 0.38, y: H * 0.24, w: 22, h: H * 0.28 },
        { id: 'rpp3', type: 'static', x: W * 0.62, y: H * 0.76, w: 22, h: H * 0.28 }
      );
      break;

    case 'dual_rotators':
      obstacles.push(
        { id: 'dr1', type: 'rotating', x: W * 0.44, y: H * 0.35, w: minDim * 0.38, h: 18, angle: 0, rotSpeed: 2.0 },
        { id: 'dr2', type: 'rotating', x: W * 0.56, y: H * 0.65, w: minDim * 0.38, h: 18, angle: Math.PI * 0.25, rotSpeed: -2.0 }
      );
      break;

    case 'destructible_bunkers':
      obstacles.push(
        { id: 'db1', type: 'static', isDestructible: true, hp: 3, maxHp: 3, x: W * 0.44, y: H * 0.30, w: 22, h: H * 0.20 },
        { id: 'db2', type: 'static', isDestructible: true, hp: 3, maxHp: 3, x: W * 0.56, y: H * 0.70, w: 22, h: H * 0.20 },
        { id: 'db3', type: 'moving', x: cx, y: cy, baseX: cx, baseY: cy, w: 20, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.0, movePhase: 0 }
      );
      break;

    case 'fortress_dual':
      obstacles.push(
        { id: 'fd1', type: 'static', x: cx, y: H * 0.16, w: 22, h: H * 0.16 },
        { id: 'fd2', type: 'static', x: cx, y: H * 0.84, w: 22, h: H * 0.16 },
        { id: 'fd3', type: 'moving', x: W * 0.42, y: cy, baseX: W * 0.42, baseY: cy, w: 18, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.0, movePhase: 0 },
        { id: 'fd4', type: 'moving', x: W * 0.58, y: cy, baseX: W * 0.58, baseY: cy, w: 18, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.0, movePhase: Math.PI }
      );
      break;

    case 'moving_cross':
      obstacles.push(
        { id: 'mc1', type: 'moving', x: cx, y: cy, baseX: cx, baseY: cy, w: 24, h: H * 0.48, moveAxis: 'y', moveRange: H * 0.22, moveSpeed: 2.4, movePhase: 0 },
        { id: 'mc2', type: 'moving', x: cx, y: cy, baseX: cx, baseY: cy, w: W * 0.24, h: 20, moveAxis: 'x', moveRange: W * 0.10, moveSpeed: 2.0, movePhase: Math.PI * 0.5 }
      );
      break;

    case 'slalom_quad':
      obstacles.push(
        { id: 'sq1', type: 'moving', x: W * 0.40, y: cy, baseX: W * 0.40, baseY: cy, w: 16, h: H * 0.16, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.2, movePhase: 0 },
        { id: 'sq2', type: 'moving', x: W * 0.47, y: cy, baseX: W * 0.47, baseY: cy, w: 16, h: H * 0.16, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.2, movePhase: Math.PI * 0.5 },
        { id: 'sq3', type: 'moving', x: W * 0.53, y: cy, baseX: W * 0.53, baseY: cy, w: 16, h: H * 0.16, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.2, movePhase: Math.PI },
        { id: 'sq4', type: 'moving', x: W * 0.60, y: cy, baseX: W * 0.60, baseY: cy, w: 16, h: H * 0.16, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.2, movePhase: Math.PI * 1.5 }
      );
      break;

    case 'pinwheel_moving':
      obstacles.push(
        { id: 'pwm1', type: 'rotating', x: cx, y: cy, w: minDim * 0.52, h: 20, angle: 0, rotSpeed: 2.4 },
        { id: 'pwm2', type: 'moving', x: W * 0.38, y: cy, baseX: W * 0.38, baseY: cy, w: 20, h: H * 0.32, moveAxis: 'y', moveRange: H * 0.24, moveSpeed: 2.5, movePhase: 0 },
        { id: 'pwm3', type: 'moving', x: W * 0.62, y: cy, baseX: W * 0.62, baseY: cy, w: 20, h: H * 0.32, moveAxis: 'y', moveRange: H * 0.24, moveSpeed: 2.5, movePhase: Math.PI }
      );
      break;

    case 'narrow_dual_windows':
      obstacles.push(
        { id: 'ndw1', type: 'static', x: cx, y: H * 0.14, w: 20, h: H * 0.14 },
        { id: 'ndw2', type: 'static', x: cx, y: cy, w: 20, h: H * 0.15 },
        { id: 'ndw3', type: 'static', x: cx, y: H * 0.86, w: 20, h: H * 0.14 }
      );
      break;

    case 'predator_citadel':
      obstacles.push(
        { id: 'pc1', type: 'rotating', x: W * 0.44, y: cy, w: minDim * 0.42, h: 20, angle: 0, rotSpeed: 2.3 },
        { id: 'pc2', type: 'rotating', x: W * 0.56, y: cy, w: minDim * 0.42, h: 20, angle: Math.PI * 0.5, rotSpeed: -2.3 },
        { id: 'pc3', type: 'static', x: cx, y: H * 0.12, w: 24, h: 18 },
        { id: 'pc4', type: 'static', x: cx, y: H * 0.88, w: 24, h: 18 }
      );
      break;

    case 'rotating_scissor':
      obstacles.push(
        { id: 'rs1', type: 'rotating', x: cx, y: cy, w: minDim * 0.54, h: 18, angle: 0, rotSpeed: 2.4 },
        { id: 'rs2', type: 'rotating', x: cx, y: cy, w: minDim * 0.54, h: 18, angle: Math.PI * 0.5, rotSpeed: -2.4 }
      );
      break;

    case 'dual_rotator_moving':
      obstacles.push(
        { id: 'drm1', type: 'rotating', x: W * 0.44, y: H * 0.32, w: minDim * 0.38, h: 18, angle: 0, rotSpeed: 2.5 },
        { id: 'drm2', type: 'rotating', x: W * 0.56, y: H * 0.68, w: minDim * 0.38, h: 18, angle: 0, rotSpeed: -2.5 },
        { id: 'drm3', type: 'moving', x: cx, y: cy, baseX: cx, baseY: cy, w: 22, h: H * 0.34, moveAxis: 'y', moveRange: H * 0.22, moveSpeed: 2.6, movePhase: 0 }
      );
      break;

    case 'laser_grid_pillars':
      obstacles.push(
        { id: 'lgp1', type: 'static', x: W * 0.42, y: H * 0.20, w: 20, h: H * 0.16 },
        { id: 'lgp2', type: 'static', x: W * 0.42, y: H * 0.80, w: 20, h: H * 0.16 },
        { id: 'lgp3', type: 'static', x: W * 0.58, y: H * 0.20, w: 20, h: H * 0.16 },
        { id: 'lgp4', type: 'static', x: W * 0.58, y: H * 0.80, w: 20, h: H * 0.16 },
        { id: 'lgp5', type: 'moving', x: cx, y: cy, baseX: cx, baseY: cy, w: 20, h: H * 0.20, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.2, movePhase: 0 }
      );
      break;

    case 'vortex_rotator':
      obstacles.push(
        { id: 'vr1', type: 'rotating', x: cx, y: cy, w: minDim * 0.50, h: 18, angle: 0, rotSpeed: 2.5 },
        { id: 'vr2', type: 'moving', x: W * 0.38, y: cy, baseX: W * 0.38, baseY: cy, w: 18, h: H * 0.20, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.4, movePhase: 0 },
        { id: 'vr3', type: 'moving', x: W * 0.62, y: cy, baseX: W * 0.62, baseY: cy, w: 18, h: H * 0.20, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.4, movePhase: Math.PI }
      );
      break;

    case 'citadel_judgment':
      obstacles.push(
        { id: 'cj1', type: 'rotating', x: cx, y: cy, w: minDim * 0.48, h: 18, angle: 0, rotSpeed: 2.4 },
        { id: 'cj2', type: 'rotating', x: cx, y: cy, w: 18, h: minDim * 0.48, angle: 0, rotSpeed: 2.4 },
        { id: 'cj3', type: 'moving', x: W * 0.38, y: H * 0.22, baseX: W * 0.38, baseY: cy, w: 18, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.2, movePhase: 0 },
        { id: 'cj4', type: 'moving', x: W * 0.62, y: H * 0.78, baseX: W * 0.62, baseY: cy, w: 18, h: H * 0.18, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.2, movePhase: Math.PI }
      );
      break;

    case 'extreme_triple_rotor':
      obstacles.push(
        { id: 'etr1', type: 'rotating', x: W * 0.40, y: H * 0.30, w: minDim * 0.34, h: 16, angle: 0, rotSpeed: 2.5 },
        { id: 'etr2', type: 'rotating', x: cx, y: cy, w: minDim * 0.36, h: 16, angle: Math.PI * 0.3, rotSpeed: -2.8 },
        { id: 'etr3', type: 'rotating', x: W * 0.60, y: H * 0.70, w: minDim * 0.34, h: 16, angle: Math.PI * 0.6, rotSpeed: 2.5 }
      );
      break;

    case 'extreme_counter_slalom':
      obstacles.push(
        { id: 'ecs1', type: 'moving', x: W * 0.40, y: cy, baseX: W * 0.40, baseY: cy, w: 16, h: H * 0.16, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.6, movePhase: 0 },
        { id: 'ecs2', type: 'moving', x: W * 0.47, y: cy, baseX: W * 0.47, baseY: cy, w: 16, h: H * 0.16, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.6, movePhase: Math.PI * 0.5 },
        { id: 'ecs3', type: 'moving', x: W * 0.54, y: cy, baseX: W * 0.54, baseY: cy, w: 16, h: H * 0.16, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.6, movePhase: Math.PI },
        { id: 'ecs4', type: 'moving', x: W * 0.61, y: cy, baseX: W * 0.61, baseY: cy, w: 16, h: H * 0.16, moveAxis: 'y', moveRange: H * 0.12, moveSpeed: 2.6, movePhase: Math.PI * 1.5 }
      );
      break;

    case 'abyssal_gate':
      obstacles.push(
        { id: 'ag1', type: 'rotating', x: cx, y: cy, w: minDim * 0.50, h: 18, angle: 0, rotSpeed: 2.8 },
        { id: 'ag2', type: 'moving', x: W * 0.40, y: cy, baseX: W * 0.40, baseY: cy, w: 18, h: H * 0.22, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.4, movePhase: 0 },
        { id: 'ag3', type: 'moving', x: W * 0.60, y: cy, baseX: W * 0.60, baseY: cy, w: 18, h: H * 0.22, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.4, movePhase: Math.PI }
      );
      break;

    case 'doomsday_nexus':
      obstacles.push(
        { id: 'dn1', type: 'rotating', x: W * 0.44, y: cy, w: minDim * 0.42, h: 18, angle: 0, rotSpeed: 2.8 },
        { id: 'dn2', type: 'rotating', x: W * 0.56, y: cy, w: minDim * 0.42, h: 18, angle: Math.PI * 0.5, rotSpeed: -2.8 },
        { id: 'dn3', type: 'moving', x: cx, y: cy, baseX: cx, baseY: cy, w: 20, h: H * 0.22, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.6, movePhase: 0 }
      );
      break;

    case 'boss_nexus_citadel':
      obstacles.push(
        { id: 'bnc1', type: 'rotating', x: cx, y: cy, w: minDim * 0.50, h: 18, angle: 0, rotSpeed: 2.8 },
        { id: 'bnc2', type: 'rotating', x: cx, y: cy, w: 18, h: minDim * 0.50, angle: 0, rotSpeed: 2.8 },
        { id: 'bnc3', type: 'moving', x: W * 0.38, y: cy, baseX: W * 0.38, baseY: cy, w: 18, h: H * 0.22, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.4, movePhase: 0 },
        { id: 'bnc4', type: 'moving', x: W * 0.62, y: cy, baseX: W * 0.62, baseY: cy, w: 18, h: H * 0.22, moveAxis: 'y', moveRange: H * 0.14, moveSpeed: 2.4, movePhase: Math.PI }
      );
      break;

    default:
      break;
  }

  return obstacles;
}

function renderObstacle(ctx, obs) {
  ctx.save();
  ctx.translate(obs.x, obs.y);
  ctx.rotate(obs.angle || 0);

  const hw = obs.w * 0.5;
  const hh = obs.h * 0.5;

  // Outer Neon Cyber Glow
  ctx.shadowColor = obs.isDestructible ? '#f59e0b' : '#00e5ff';
  ctx.shadowBlur = 10;

  // Metallic Brushed Plate
  const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
  grad.addColorStop(0, '#1e293b');
  grad.addColorStop(0.5, '#0f172a');
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  drawRoundRect(ctx, -hw, -hh, obs.w, obs.h, 5);
  ctx.fill();

  // Neon Tech Border
  ctx.strokeStyle = obs.isDestructible
    ? (obs.hp <= 1 ? '#ef4444' : '#f59e0b')
    : '#00e5ff';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, -hw, -hh, obs.w, obs.h, 5);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Diagonal Hazard Stripes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  const stripeStep = 10;
  for (let s = -hw; s < hw; s += stripeStep) {
    ctx.beginPath();
    ctx.moveTo(s, -hh + 2);
    ctx.lineTo(s + 6, hh - 2);
    ctx.stroke();
  }

  // Corner Rivets / Bolts
  ctx.fillStyle = '#94a3b8';
  const boltInset = 4;
  [
    [-hw + boltInset, -hh + boltInset],
    [hw - boltInset, -hh + boltInset],
    [-hw + boltInset, hh - boltInset],
    [hw - boltInset, hh - boltInset],
  ].forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Central Rotating Pivot Cap if rotating
  if (obs.type === 'rotating') {
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Destructible Health Bar
  if (obs.isDestructible) {
    const hpFrac = Math.max(0, obs.hp / obs.maxHp);
    const barW = obs.w * 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-barW * 0.5, -2, barW, 4);
    ctx.fillStyle = obs.hp <= 1 ? '#ef4444' : '#f59e0b';
    ctx.fillRect(-barW * 0.5, -2, barW * hpFrac, 4);
  }

  ctx.restore();
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

let globalSfxVolume = 0.85;
export function setGlobalSfxVolume(val) {
  globalSfxVolume = Math.max(0, Math.min(1, val / 100));
}

function playSound(type, soundOn = true, volScale = 1) {
  if (!soundOn || globalSfxVolume <= 0) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = globalSfxVolume * volScale;

    if (type === 'shoot_player') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.13);
      gain.gain.setValueAtTime(0.32 * master, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'shoot_cpu') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.15);
      gain.gain.setValueAtTime(0.28 * master, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'hit') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
      gain.gain.setValueAtTime(0.35 * master, now);
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
        gain.gain.setValueAtTime(0.2 * master, now + idx * 0.08);
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
      gain.gain.setValueAtTime(0.3 * master, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'gun_clash') {
      // Metallic crack & reverberation when guns collide
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1450, now);
      osc1.frequency.exponentialRampToValueAtTime(320, now + 0.12);
      osc2.frequency.setValueAtTime(2400, now);
      osc2.frequency.exponentialRampToValueAtTime(160, now + 0.08);
      gain.gain.setValueAtTime(0.42 * master, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, now);
      gain.gain.setValueAtTime(0.09 * master, now);
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

// ── Pre-cached Beretta 92FS Pistol Sprites ───────────────────────────────────
const playerGunSprite = typeof window !== 'undefined' ? new Image() : null;
if (playerGunSprite) playerGunSprite.src = '/images/player_gun.png';

const cpuGunSprite = typeof window !== 'undefined' ? new Image() : null;
if (cpuGunSprite) cpuGunSprite.src = '/images/cpu_gun.png';

// ── Gun Renderer (Smooth 360° Pivot) ──────────────────────────────────────────
function renderArcadeGun(ctx, gun, isPlayer) {
  const GL = gun.length;

  ctx.save();
  ctx.translate(gun.x, gun.y);
  ctx.rotate(gun.angle);

  // Hit flash blinking
  if (gun.flash > 0 && Math.floor(gun.flash / 3) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  // Gun Drop Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;

  // Render authentic Beretta 92FS Sprite if loaded
  const sprite = isPlayer ? playerGunSprite : cpuGunSprite;
  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    const w = GL * 1.08;
    const h = w * (sprite.naturalHeight / sprite.naturalWidth);
    // Pivot at trigger guard center
    const ox = -w * 0.42;
    const oy = -h * 0.42;
    ctx.drawImage(sprite, ox, oy, w, h);
    ctx.restore();
    return;
  }

  // Fallback Vector Rendering
  const GH = gun.height;
  const baseCol = isPlayer ? '#f59e0b' : '#ef4444';
  const shadowCol = isPlayer ? '#92400e' : '#991b1b';
  const highlightCol = isPlayer ? '#fef08a' : '#fca5a5';

  ctx.fillStyle = '#141416';
  drawRoundRect(ctx, -GL * 0.34, GH * 0.1, GL * 0.3, GH * 0.9, 4);
  ctx.fill();

  ctx.shadowBlur = 0;
  const slideGrad = ctx.createLinearGradient(0, -GH * 0.58, 0, GH * 0.15);
  slideGrad.addColorStop(0, highlightCol);
  slideGrad.addColorStop(0.3, baseCol);
  slideGrad.addColorStop(0.85, shadowCol);
  slideGrad.addColorStop(1, '#1e1b18');
  ctx.fillStyle = slideGrad;
  drawRoundRect(ctx, -GL * 0.38, -GH * 0.58, GL * 0.9, GH * 0.58, 3);
  ctx.fill();

  ctx.restore();
}

// ── Main PistolDuel Component ─────────────────────────────────────────────────
export default function PistolDuel({
  onHome,
  onClose,
  onToggleFullscreen,
  isFullscreen,
  isLiked: externalIsLiked,
  onToggleLike: externalOnToggleLike,
  onReport: externalOnReport,
  onSelectGame,
}) {
  // Gameplay State: 'splash' -> 'level_select' -> 'playing'
  const [phase, setPhase] = useState('splash');
  const [levelIdx, setLevelIdx] = useState(0);   // Default Level 1 (idx 0)
  const [unlockedLevel, setUnlockedLevel] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem('pistol_duel_unlocked_level') || '50', 10);
      return Math.max(saved, 50); // All 50 levels unlocked as requested
    } catch {
      return 50;
    }
  });
  const [levelPage, setLevelPage] = useState(0); // 0, 1, 2, 3 (15 levels per page)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrophyOpen, setIsTrophyOpen] = useState(false);
  const [isArmorOpen, setIsArmorOpen] = useState(false);

  // Tactical Armor Perks State (Saved to localStorage)
  const [vestLevel, setVestLevel] = useState(() => {
    try {
      return parseInt(localStorage.getItem('pistol_duel_vest_level') || '1', 10);
    } catch {
      return 1;
    }
  });
  const [hasLaserSight, setHasLaserSight] = useState(() => {
    try {
      return localStorage.getItem('pistol_duel_laser_sight') === 'true';
    } catch {
      return false;
    }
  });
  const [reviveLevel, setReviveLevel] = useState(() => {
    try {
      return parseInt(localStorage.getItem('pistol_duel_revive_level') || '1', 10);
    } catch {
      return 1;
    }
  });

  // Claimed Trophies State (Saved to localStorage)
  const [claimedTrophies, setClaimedTrophies] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pistol_duel_claimed_trophies') || '[]');
    } catch {
      return [];
    }
  });
  const [sfxVolume, setSfxVolume] = useState(() => {
    try {
      return parseInt(localStorage.getItem('pistol_duel_sfx_vol') || '85', 10);
    } catch {
      return 85;
    }
  });
  const [musicVolume, setMusicVolume] = useState(() => {
    try {
      return parseInt(localStorage.getItem('pistol_duel_music_vol') || '75', 10);
    } catch {
      return 75;
    }
  });
  const [loadingProgress, setLoadingProgress] = useState(25);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [coins, setCoins] = useState(() => {
    try {
      return parseInt(localStorage.getItem('pistol_duel_coins') || '100', 10);
    } catch {
      return 100;
    }
  });
  const [soundOn, setSoundOn] = useState(true);
  const [localLiked, setLocalLiked] = useState(false);
  const [reportedMsg, setReportedMsg] = useState(false);
  const [showInstruction, setShowInstruction] = useState(true);

  // Pause System State
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  // Rewarded Ad Continue State
  const [adPlaying, setAdPlaying] = useState(false);
  const [adCountdown, setAdCountdown] = useState(3);
  const adTimerRef = useRef(null);

  // Asset Loading State
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Orientation state: Portrait vs Landscape
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 || window.innerHeight > window.innerWidth * 1.05;
    }
    return false;
  });

  // Status HUD: Player & CPU dynamic health hearts (Equal 4 Hearts each)
  const [hud, setHud] = useState({
    playerHp: 4,
    playerMaxHp: 4,
    cpuHp: 4,
    cpuMaxHp: 4,
    level: 1,
  });

  // DOM & State Refs
  const canvasRef = useRef(null);
  const screenAreaRef = useRef(null);
  const stateRef = useRef(null);
  const animFrameRef = useRef(null);
  const phaseRef = useRef('playing');
  const soundRef = useRef(soundOn);
  const instructionTimerRef = useRef(null);
  const readyCountdownRef = useRef('');
  const [readyCountdownDisplay, setReadyCountdownDisplay] = useState('');
  const touchStartXRef = useRef(null);

  useEffect(() => {
    setGlobalSfxVolume(sfxVolume);
  }, [sfxVolume]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  // Loading Progress Bar Fill (Starts at 25%, ramps up to 100% when assets are buffered)
  useEffect(() => {
    const timer = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(100, prev + (assetsLoaded ? 25 : 8));
      });
    }, 100);
    return () => clearInterval(timer);
  }, [assetsLoaded]);

  // Auto-cycle Start Screen carousel slides every 3.8s
  useEffect(() => {
    if (phase !== 'splash') return;
    const interval = setInterval(() => {
      setCarouselIdx((i) => (i + 1) % CAROUSEL_SLIDES.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [phase]);

  // Asset Preloading: Ensure Beretta sprites and neon frame backgrounds are buffered
  useEffect(() => {
    let loaded = 0;
    const required = 4;
    const onAssetReady = () => {
      loaded++;
      if (loaded >= required) {
        setAssetsLoaded(true);
      }
    };

    const img1 = new Image();
    img1.onload = onAssetReady;
    img1.onerror = onAssetReady;
    img1.src = '/images/player_gun.png';

    const img2 = new Image();
    img2.onload = onAssetReady;
    img2.onerror = onAssetReady;
    img2.src = '/images/cpu_gun.png';

    const img3 = new Image();
    img3.onload = onAssetReady;
    img3.onerror = onAssetReady;
    img3.src = '/images/mobile_neon_frame.jpg';

    const img4 = new Image();
    img4.onload = onAssetReady;
    img4.onerror = onAssetReady;
    img4.src = '/images/desktop_neon_frame.jpg';

    // Safety timeout: Never hang on asset load
    const safetyTimer = setTimeout(() => {
      setAssetsLoaded(true);
    }, 1200);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Rewarded Ad Event Listener
  useEffect(() => {
    const handleShowRewardedAd = (e) => {
      setAdPlaying(true);
      setAdCountdown(3);
      const onReward = e.detail?.onReward;

      let count = 3;
      if (adTimerRef.current) clearInterval(adTimerRef.current);
      adTimerRef.current = setInterval(() => {
        count--;
        setAdCountdown(count);
        if (count <= 0) {
          clearInterval(adTimerRef.current);
          setAdPlaying(false);
          if (onReward) onReward();
        }
      }, 1000);
    };

    window.addEventListener('pistol-duel-show-rewarded-ad', handleShowRewardedAd);
    return () => {
      window.removeEventListener('pistol-duel-show-rewarded-ad', handleShowRewardedAd);
      if (adTimerRef.current) clearInterval(adTimerRef.current);
    };
  }, []);

  // Hide "TAP TO SHOOT" instruction automatically after 3.8 seconds
  useEffect(() => {
    setShowInstruction(true);
    if (instructionTimerRef.current) clearTimeout(instructionTimerRef.current);
    instructionTimerRef.current = setTimeout(() => {
      setShowInstruction(false);
    }, 3800);
    return () => {
      if (instructionTimerRef.current) clearTimeout(instructionTimerRef.current);
    };
  }, [levelIdx]);

  const isLiked = externalIsLiked !== undefined ? externalIsLiked : localLiked;
  const toggleLike = externalOnToggleLike || (() => setLocalLiked((l) => !l));
  const triggerReport =
    externalOnReport ||
    (() => {
      setReportedMsg(true);
      setTimeout(() => setReportedMsg(false), 2500);
    });

  // Home Button: Returns directly to Level Select screen and resets active game session
  const handleHomeClick = () => {
    playSound('click', soundRef.current);
    setIsPaused(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    stateRef.current = null;
    readyCountdownRef.current = '';
    setReadyCountdownDisplay('');
    setPhase('level_select');
  };

  // Check if running inside native Android App (Capacitor or target APK)
  const isNativeApp = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.__APP_TARGET__ ||
      (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
    );
  }, []);

  // Relatable Game: Launch 3D Bike Racer (Web) or Redirect to Play Store (Mobile App)
  const handleLaunchBike = () => {
    playSound('click', soundRef.current);
    if (isNativeApp()) {
      // In standalone Android Mobile App:
      // Redirects user to Google Play Store to install/download 3D Bike Racer app!
      try {
        window.location.href = 'market://details?id=com.gamesite.bikeracer';
      } catch {}
      setTimeout(() => {
        window.open('https://play.google.com/store/apps/details?id=com.gamesite.bikeracer', '_blank');
      }, 300);
      return;
    }

    // On Web Portal: switch game smoothly
    if (onSelectGame) {
      onSelectGame(-1);
    } else {
      window.location.search = '?view=bikeracer';
    }
  };

  // Rewarded Ad Bonus for Free Coins
  const handleBonusAd = () => {
    playSound('click', soundRef.current);
    setAdCountdown(3);
    setAdPlaying(true);
    RewardedAdService.show({
      onReward: () => {
        setCoins((c) => {
          const next = c + 100;
          try {
            localStorage.setItem('pistol_duel_coins', String(next));
          } catch {}
          return next;
        });
      },
      onClose: () => {
        setAdPlaying(false);
      },
      onError: () => {
        setAdPlaying(false);
      },
    });
  };

  // Claim Career Milestone Reward
  const handleClaimTrophy = (milestoneId, reward) => {
    playSound('win', soundRef.current);
    setCoins((c) => {
      const next = c + reward;
      try {
        localStorage.setItem('pistol_duel_coins', String(next));
      } catch {}
      return next;
    });
    setClaimedTrophies((prev) => {
      const next = [...prev, milestoneId];
      try {
        localStorage.setItem('pistol_duel_claimed_trophies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Upgrade Tactical Kevlar Vest (4 Hearts -> 5 Hearts)
  const handleUpgradeVest = () => {
    if (coins < 250 || vestLevel >= 2) return;
    playSound('win', soundRef.current);
    setCoins((c) => {
      const next = c - 250;
      try {
        localStorage.setItem('pistol_duel_coins', String(next));
      } catch {}
      return next;
    });
    setVestLevel(2);
    try {
      localStorage.setItem('pistol_duel_vest_level', '2');
    } catch {}
  };

  // Toggle or Unlock Laser Aim Sight
  const handleToggleLaserSight = () => {
    if (!hasLaserSight) {
      if (coins < 150) return;
      playSound('win', soundRef.current);
      setCoins((c) => {
        const next = c - 150;
        try {
          localStorage.setItem('pistol_duel_coins', String(next));
        } catch {}
        return next;
      });
      setHasLaserSight(true);
      try {
        localStorage.setItem('pistol_duel_laser_sight', 'true');
      } catch {}
    } else {
      playSound('click', soundRef.current);
      setHasLaserSight((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('pistol_duel_laser_sight', String(next));
        } catch {}
        return next;
      });
    }
  };

  // Upgrade Tactical Revive Shield (2.5s -> 4.5s)
  const handleUpgradeRevive = () => {
    if (coins < 200 || reviveLevel >= 2) return;
    playSound('win', soundRef.current);
    setCoins((c) => {
      const next = c - 200;
      try {
        localStorage.setItem('pistol_duel_coins', String(next));
      } catch {}
      return next;
    });
    setReviveLevel(2);
    try {
      localStorage.setItem('pistol_duel_revive_level', '2');
    } catch {}
  };

  // Revive Player via Rewarded Ad: restores 2 Hearts, clears bullets, gives 2.5s or 4.5s shield
  const revivePlayer = useCallback(() => {
    if (!stateRef.current) return;
    const s = stateRef.current;
    const reviveHp = 2; // Configured revive health
    s.player.hp = reviveHp;
    s.bullets = s.bullets.filter((b) => b.isPlayer); // Clear dangerous CPU bullets
    s.player.invulnerable = reviveLevel >= 2 ? 4.5 : 2.5; // Upgraded Tactical Revive Shield
    s.cpu.timer = 1200; // Reset CPU timer so it doesn't instantly fire
    if (s.cpu2) s.cpu2.timer = 1500;
    setHud((h) => ({ ...h, playerHp: reviveHp }));
    setPhase('playing');
    setIsPaused(false);
    playSound('win', soundRef.current);
  }, [reviveLevel]);

  // Trigger Rewarded Ad Continue
  const handleWatchAdContinue = useCallback(() => {
    playSound('click', soundRef.current);
    RewardedAdService.show({
      onReward: () => {
        revivePlayer();
      },
    });
  }, [revivePlayer]);

  // Window resize & orientation detection
  useEffect(() => {
    const handleWinResize = () => {
      const port = window.innerWidth < 768 || window.innerHeight > window.innerWidth * 1.05;
      setIsPortrait(port);
    };
    window.addEventListener('resize', handleWinResize);
    window.addEventListener('orientationchange', handleWinResize);
    return () => {
      window.removeEventListener('resize', handleWinResize);
      window.removeEventListener('orientationchange', handleWinResize);
    };
  }, []);

  // ── Spawn Gun Initial State ───────────────────────────────────────────────
  // RULE: PLAYER ALWAYS ON LEFT, CPU ALWAYS ON RIGHT (Both Desktop & Mobile)
  const initLevelState = useCallback((lIdx, W, H, port) => {
    const cfg = LEVELS[Math.min(lIdx, LEVELS.length - 1)];

    // Sleeker, agile gun size
    const gunWidth = port
      ? Math.max(38, Math.min(54, W * 0.13))
      : Math.max(48, Math.min(68, W * 0.095));
    const gunHeight = gunWidth * 0.44;
    const radius = gunWidth * 0.46;

    // 1. PLAYER GUN (Gold Beretta) — LEFT SIDE START
    const playerX = port ? W * 0.24 : W * 0.22;
    const playerY = port ? H * 0.54 : H * 0.52;
    const maxPlayerHp = vestLevel >= 2 ? 5 : (cfg.playerMaxHp || 4);
    const player = {
      x: playerX,
      y: playerY,
      vx: 0,
      vy: 0,
      angle: 0,   // Facing towards CPU in duel ready stance
      spin: 0,    // Frozen at start!
      length: gunWidth,
      height: gunHeight,
      radius,
      hp: maxPlayerHp,
      maxHp: maxPlayerHp,
      invulnerable: 0,
      flash: 0,
      ghosts: [],
      lastGhostTs: 0,
    };

    // Check dual weapons
    const hasTwoGuns = cfg.cpuWeapons === 2;

    // 2. CPU GUN 1 (Crimson Beretta) — RIGHT SIDE START
    const cpuX = port ? W * 0.76 : W * 0.78;
    const cpuY = hasTwoGuns ? (port ? H * 0.35 : H * 0.34) : (port ? H * 0.46 : H * 0.48);
    const cpu = {
      x: cpuX,
      y: cpuY,
      vx: 0,
      vy: 0,
      wanderAngle: Math.PI,
      angle: Math.PI, // Facing towards Player in duel ready stance
      spin: 0,        // Frozen at start!
      length: gunWidth,
      height: gunHeight,
      radius,
      hp: cfg.cpuHp || 4,
      maxHp: cfg.cpuHp || 4,
      flash: 0,
      ghosts: [],
      lastGhostTs: 0,
      timer: 0,
      hasFiredInitialShot: false,
      gunId: 1,
    };

    // 3. CPU GUN 2 (Crimson Beretta) — IF 2 WEAPONS SPECIFIED
    let cpu2 = null;
    if (hasTwoGuns) {
      const cpu2Y = port ? H * 0.65 : H * 0.66;
      cpu2 = {
        x: cpuX,
        y: cpu2Y,
        vx: 0,
        vy: 0,
        wanderAngle: Math.PI,
        angle: Math.PI,
        spin: 0,
        length: gunWidth,
        height: gunHeight,
        radius,
        hp: cfg.cpuHp || 4,
        maxHp: cfg.cpuHp || 4,
        flash: 0,
        ghosts: [],
        lastGhostTs: 0,
        timer: cfg.cpuDelay * (cfg.cpu2DelayRatio || 1.1),
        hasFiredInitialShot: false,
        gunId: 2,
      };
    }

    const obstacles = getObstaclesForLayout(cfg.layout, W, H, port);

    return {
      levelIdx: lIdx,
      player,
      cpu,
      cpu2,
      cpuSharedHp: cfg.cpuHp || 4,
      obstacles,
      bullets: [],
      particles: [],
      confetti: [],
      ejectedShells: [],
      damageSkulls: [],
      screenShake: 0,
      lastTs: performance.now(),
      lastFiredTime: 0,
      readyTimer: 3.5, // 3.5 seconds duel stance stop before combat begins
      w: W,
      h: H,
    };
  }, [vestLevel]);

  // ── Start / Restart Level ─────────────────────────────────────────────────
  const startLevel = useCallback(
    (lvlIdx) => {
      const idx = Math.max(0, Math.min(lvlIdx, LEVELS.length - 1));
      setLevelIdx(idx);
      const cfg = LEVELS[idx];
      const maxPlayerHp = vestLevel >= 2 ? 5 : (cfg.playerMaxHp || 4);
      setHud({
        playerHp: maxPlayerHp,
        playerMaxHp: maxPlayerHp,
        cpuHp: cfg.cpuHp || 4,
        cpuMaxHp: cfg.cpuHp || 4,
        level: cfg.level,
      });
      setReadyCountdownDisplay('3');
      readyCountdownRef.current = '3';
      setIsPaused(false);

      // Cleanly terminate any running loop & nullify old session
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      stateRef.current = null;
      setPhase('playing');

      try {
        const currMax = parseInt(localStorage.getItem('pistol_duel_unlocked_level') || '50', 10);
        if (idx + 1 > currMax) {
          localStorage.setItem('pistol_duel_unlocked_level', String(idx + 1));
        }
      } catch {}

      if (screenAreaRef.current) {
        const rect = screenAreaRef.current.getBoundingClientRect();
        stateRef.current = initLevelState(idx, rect.width || 600, rect.height || 300, isPortrait);
      }
    },
    [initLevelState, isPortrait, vestLevel]
  );

  // ── Tap to Shoot Mechanic (Player) ────────────────────────────────────────
  const handleShoot = useCallback(() => {
    if (phaseRef.current !== 'playing' || !stateRef.current) return;
    const s = stateRef.current;
    if (s.readyTimer > 0) return; // Player cannot shoot during initial ready stop!
    const p = s.player;
    const now = performance.now();

    // STRICT SINGLE BULLET RULE: Cannot fire if player already has a bullet in flight
    const hasPlayerBullet = s.bullets.some((b) => b.isPlayer);
    if (hasPlayerBullet || now - s.lastFiredTime < 380) return;
    s.lastFiredTime = now;

    playSound('shoot_player', soundRef.current);

    // Bullet flies in direction of current player angle (Single bullet)
    const muzzleDist = p.length * 0.70;
    const bx = p.x + Math.cos(p.angle) * muzzleDist;
    const by = p.y + Math.sin(p.angle) * muzzleDist;
    const bSpeed = 860;

    s.bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(p.angle) * bSpeed,
      vy: Math.sin(p.angle) * bSpeed,
      isPlayer: true,
      trail: [],
    });

    // Balanced Recoil Push: 720 recoil force kickback across arena
    const recoilForce = 720;
    p.vx -= Math.cos(p.angle) * recoilForce;
    p.vy -= Math.sin(p.angle) * recoilForce;

    // Controlled rotational torque impulse
    const torque = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 3.8 + 3.0);
    p.spin += torque;

    // Eject Brass Shell Casing
    const shellAngle = p.angle - Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    s.ejectedShells.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(shellAngle) * 90 - p.vx * 0.15,
      vy: Math.sin(shellAngle) * 90 - p.vy * 0.15,
      rot: p.angle,
      spin: (Math.random() - 0.5) * 14,
      life: 1.0,
    });

    // Muzzle Flash Effect (Local burst at gun tip, stays at muzzle)
    for (let i = 0; i < 5; i++) {
      const sp = Math.random() * 18 + 6;
      const spread = p.angle + (Math.random() - 0.5) * 1.0;
      s.particles.push({
        x: bx,
        y: by,
        vx: Math.cos(spread) * sp,
        vy: Math.sin(spread) * sp,
        life: 0.6,
        decay: 0.14,
        col: i % 2 === 0 ? '#fbbf24' : '#f97316',
        size: Math.random() * 2.2 + 1.2,
      });
    }

    s.screenShake = 6;
  }, []);

  // ── Canvas Setup & Main Game Loop ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

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

      if (!stateRef.current || stateRef.current.levelIdx !== levelIdx) {
        stateRef.current = initLevelState(levelIdx, W, H, isPortrait);
      } else {
        stateRef.current.w = W;
        stateRef.current.h = H;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    // Physics parameters: smooth high-speed glide & gentle, controlled rebound
    const LINEAR_DRAG = 0.965;
    const ANGULAR_DRAG = 0.985;
    const BOUNCE_RESTITUTION = 0.48;

    const loop = (ts) => {
      try {
        const s = stateRef.current;
        const ctx = canvas.getContext('2d');

        if (s && ctx) {
          // If paused, maintain animation frame without advancing game state
          if (isPausedRef.current) {
            s.lastTs = ts;
            animFrameRef.current = requestAnimationFrame(loop);
            return;
          }

          const dt = Math.min((ts - s.lastTs) / 1000, 0.033);
          s.lastTs = ts;

          const W = s.w;
          const H = s.h;
          const cfg = LEVELS[Math.min(levelIdx, LEVELS.length - 1)];

          const player = s.player;
          const cpu = s.cpu;
          const cpu2 = s.cpu2;

          // ── 1. READY TIMER & DUEL STANCE FREEZE (3.5s Stop Before Combat) ────
          if (s.readyTimer > 0) {
            s.readyTimer -= dt;
            player.vx = 0;
            player.vy = 0;
            player.spin = 0;
            cpu.vx = 0;
            cpu.vy = 0;
            cpu.spin = 0;
            if (cpu2) {
              cpu2.vx = 0;
              cpu2.vy = 0;
              cpu2.spin = 0;
            }

            let countVal = '1';
            if (s.readyTimer > 2.5) countVal = '3';
            else if (s.readyTimer > 1.5) countVal = '2';
            else if (s.readyTimer > 0.5) countVal = '1';
            else countVal = 'DUEL!';

            if (countVal !== readyCountdownRef.current) {
              readyCountdownRef.current = countVal;
              setReadyCountdownDisplay(countVal);
            }

            if (s.readyTimer <= 0) {
              s.readyTimer = 0;
              readyCountdownRef.current = '';
              setReadyCountdownDisplay('');
              player.spin = 3.0; // Smooth, manageable aiming spin
              cpu.spin = -(cfg.cpuSpinMin || 2.2); // Gentle natural spin for CPU
              if (cpu2) cpu2.spin = (cfg.cpuSpinMin || 2.2);

              // 2.2s opening duel window so player gets ample time to react and shoot first!
              cpu.hasFiredInitialShot = false;
              cpu.timer = Math.max(2200, (cfg.cpuDelay || 2000) * 1.25);
              if (cpu2) {
                cpu2.hasFiredInitialShot = false;
                cpu2.timer = cpu.timer + 900;
              }
            }
          } else {
            // ── UPDATE OBSTACLES (Moving & Rotating) ───────────────────────────
            if (s.obstacles && s.obstacles.length > 0) {
              for (let oi = 0; oi < s.obstacles.length; oi++) {
                const obs = s.obstacles[oi];
                if (obs.type === 'moving' || obs.moveAxis) {
                  obs.timer = (obs.timer || 0) + (obs.moveSpeed || 1.8) * dt;
                  const offset = Math.sin(obs.timer + (obs.movePhase || 0)) * (obs.moveRange || 40);
                  if (obs.moveAxis === 'x') {
                    obs.x = obs.baseX + offset;
                  } else {
                    obs.y = obs.baseY + offset;
                  }
                }
                if (obs.type === 'rotating' || obs.rotSpeed) {
                  obs.angle = (obs.angle || 0) + (obs.rotSpeed || 1.5) * dt;
                }
              }
            }

            // Arena boundary limits
            const pad = player.radius + 6;
            const minX = pad;
            const maxX = W - pad;
            const minY = pad + 26;
            const maxY = H - pad - 16;

            // Gun vs Solid Obstacle Collision & Gentle Controlled Bounce
            const checkGunObstacle = (g) => {
              if (!g || !s.obstacles || s.obstacles.length === 0) return;
              for (let i = 0; i < s.obstacles.length; i++) {
                const obs = s.obstacles[i];
                const col = circleIntersectsOBB(
                  g.x,
                  g.y,
                  g.radius + 2,
                  obs.x,
                  obs.y,
                  obs.w,
                  obs.h,
                  obs.angle || 0
                );
                if (col && col.hit) {
                  // Separate gun outside the obstacle boundary gently
                  g.x += col.nx * (col.overlap + 0.5);
                  g.y += col.ny * (col.overlap + 0.5);

                  // Velocity reflection / gentle bounce
                  const vDotN = g.vx * col.nx + g.vy * col.ny;
                  if (vDotN < 0) {
                    const restitution = 0.38; // Soft, absorbing bounce (replaces aggressive 1.35)
                    g.vx = g.vx - (1 + restitution) * vDotN * col.nx;
                    g.vy = g.vy - (1 + restitution) * vDotN * col.ny;

                    // Cap maximum bounce speed so gun never flings wildly across the screen
                    const currentSpd = Math.hypot(g.vx, g.vy);
                    const maxBounceSpd = 160;
                    if (currentSpd > maxBounceSpd) {
                      g.vx = (g.vx / currentSpd) * maxBounceSpd;
                      g.vy = (g.vy / currentSpd) * maxBounceSpd;
                    }

                    // Gentle minimum nudge to prevent sticking
                    const minBounce = 35;
                    if (currentSpd < minBounce) {
                      g.vx += col.nx * minBounce;
                      g.vy += col.ny * minBounce;
                    }

                    g.spin += (Math.random() - 0.5) * 0.4;
                  } else {
                    g.vx *= 0.85;
                    g.vy *= 0.85;
                  }
                }
              }
            };

            // ── 1. UPDATE PLAYER GUN (Continuous 360° Rotation + Physics) ───────
            player.vx *= Math.pow(LINEAR_DRAG, dt * 60);
            player.vy *= Math.pow(LINEAR_DRAG, dt * 60);
            player.x += player.vx * dt;
            player.y += player.vy * dt;

            player.spin *= Math.pow(ANGULAR_DRAG, dt * 60);
            if (Math.abs(player.spin) < 3.0) {
              player.spin = (player.spin >= 0 ? 1 : -1) * 3.0;
            }
            player.angle += player.spin * dt;
            player.angle = normAngle(player.angle);

            if (player.flash > 0) player.flash--;
            if (player.invulnerable > 0) {
              player.invulnerable = Math.max(0, player.invulnerable - dt);
            }

            if (ts - player.lastGhostTs > 45) {
              player.ghosts.push({
                x: player.x,
                y: player.y,
                angle: player.angle,
                alpha: 0.35,
                length: player.length,
                height: player.height,
              });
              player.lastGhostTs = ts;
            }
            player.ghosts.forEach((g) => { g.alpha -= 0.03; });
            player.ghosts = player.ghosts.filter((g) => g.alpha > 0.05);

            if (player.x < minX) {
              player.x = minX;
              player.vx = Math.abs(player.vx) * BOUNCE_RESTITUTION + 30;
              player.spin += (Math.random() - 0.5) * 0.5;
            } else if (player.x > maxX) {
              player.x = maxX;
              player.vx = -Math.abs(player.vx) * BOUNCE_RESTITUTION - 30;
              player.spin += (Math.random() - 0.5) * 0.5;
            }

            if (player.y < minY) {
              player.y = minY;
              player.vy = Math.abs(player.vy) * BOUNCE_RESTITUTION + 30;
              player.spin += (Math.random() - 0.5) * 0.5;
            } else if (player.y > maxY) {
              player.y = maxY;
              player.vy = -Math.abs(player.vy) * BOUNCE_RESTITUTION - 30;
              player.spin += (Math.random() - 0.5) * 0.5;
            }

            checkGunObstacle(player);

            // ── 2. UPDATE CPU GUNS (Dynamic Autonomous Movement & Rotation) ─────
            const updateCpuPhysics = (g) => {
              g.vx *= Math.pow(LINEAR_DRAG, dt * 60);
              g.vy *= Math.pow(LINEAR_DRAG, dt * 60);

              const speed = Math.hypot(g.vx, g.vy);
              if (speed < 160) {
                if (g.wanderAngle === undefined || Math.random() < 0.06) {
                  const toCenter = Math.atan2(H * 0.5 - g.y, W * 0.5 - g.x);
                  g.wanderAngle = toCenter + (Math.random() - 0.5) * 1.2;
                }
                g.vx += Math.cos(g.wanderAngle) * 220 * dt;
                g.vy += Math.sin(g.wanderAngle) * 220 * dt;
              }

              g.x += g.vx * dt;
              g.y += g.vy * dt;

              g.spin *= Math.pow(ANGULAR_DRAG, dt * 60);
              const minSpin = cfg.cpuSpinMin || 2.2;
              if (Math.abs(g.spin) < minSpin) {
                g.spin = (g.spin >= 0 ? 1 : -1) * minSpin;
              }
              g.angle += g.spin * dt;
              g.angle = normAngle(g.angle);

              if (g.flash > 0) g.flash--;

              if (ts - g.lastGhostTs > 45) {
                g.ghosts.push({
                  x: g.x,
                  y: g.y,
                  angle: g.angle,
                  alpha: 0.35,
                  length: g.length,
                  height: g.height,
                });
                g.lastGhostTs = ts;
              }
              g.ghosts.forEach((gh) => { gh.alpha -= 0.03; });
              g.ghosts = g.ghosts.filter((gh) => gh.alpha > 0.05);

              if (g.x < minX) {
                g.x = minX;
                g.vx = Math.abs(g.vx) * BOUNCE_RESTITUTION + 30;
                g.wanderAngle = (Math.random() - 0.5) * Math.PI * 0.7;
                g.spin += (Math.random() - 0.5) * 0.5;
              } else if (g.x > maxX) {
                g.x = maxX;
                g.vx = -Math.abs(g.vx) * BOUNCE_RESTITUTION - 30;
                g.wanderAngle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.7;
                g.spin += (Math.random() - 0.5) * 0.5;
              }

              if (g.y < minY) {
                g.y = minY;
                g.vy = Math.abs(g.vy) * BOUNCE_RESTITUTION + 30;
                g.wanderAngle = Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.7;
                g.spin += (Math.random() - 0.5) * 0.5;
              } else if (g.y > maxY) {
                g.y = maxY;
                g.vy = -Math.abs(g.vy) * BOUNCE_RESTITUTION - 30;
                g.wanderAngle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.7;
                g.spin += (Math.random() - 0.5) * 0.5;
              }

              checkGunObstacle(g);
            };

            updateCpuPhysics(cpu);
            if (cpu2) updateCpuPhysics(cpu2);

            // ── GUN VS GUN PHYSICAL CLASH & BOUNCE ────────────────────────────
            const checkGunClash = (g1, g2) => {
              if (!g1 || !g2) return;
              const cdx = g2.x - g1.x;
              const cdy = g2.y - g1.y;
              const cdist = Math.hypot(cdx, cdy);
              const minGDist = g1.radius + g2.radius + 6;

              if (cdist < minGDist && cdist > 0.0001) {
                const nx = cdx / cdist;
                const ny = cdy / cdist;

                const overlap = minGDist - cdist;
                const push = (overlap * 0.5) + 2.5;
                g1.x -= nx * push;
                g1.y -= ny * push;
                g2.x += nx * push;
                g2.y += ny * push;

                const rvx = g1.vx - g2.vx;
                const rvy = g1.vy - g2.vy;
                const velAlongNormal = rvx * nx + rvy * ny;

                const repulseSpeed = Math.max(280, Math.abs(velAlongNormal) * 0.85 + 100);
                g1.vx = -nx * repulseSpeed;
                g1.vy = -ny * repulseSpeed;
                g2.vx = nx * repulseSpeed;
                g2.vy = ny * repulseSpeed;

                const clashTorque = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 6.0 + 4.5);
                g1.spin += clashTorque;
                g2.spin -= clashTorque;

                playSound('gun_clash', soundRef.current);
                g1.flash = 8;
                g2.flash = 8;
                s.screenShake = 7;

                const midX = (g1.x + g2.x) / 2;
                const midY = (g1.y + g2.y) / 2;
                for (let k = 0; k < 14; k++) {
                  const ang = Math.random() * Math.PI * 2;
                  const spd = Math.random() * 85 + 30;
                  s.particles.push({
                    x: midX,
                    y: midY,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd,
                    life: 1.0,
                    decay: 0.07,
                    col: k % 2 === 0 ? '#38bdf8' : '#fef08a',
                    size: Math.random() * 2.5 + 1.5,
                  });
                }
              }
            };

            checkGunClash(player, cpu);
            if (cpu2) {
              checkGunClash(player, cpu2);
              checkGunClash(cpu, cpu2);
            }
          }

          // ── 3. CPU AI SHOOTING FLOW (Single Bullet Per Gun Rule) ───────────
          if (phaseRef.current === 'playing' && s.readyTimer <= 0) {
            const fireCpuBullet = (g, gId) => {
              playSound('shoot_cpu', soundRef.current);
              const cbx = g.x + Math.cos(g.angle) * g.length * 0.70;
              const cby = g.y + Math.sin(g.angle) * g.length * 0.70;
              const cbSpeed = cfg.cpuBulletSpeed || 760;

              s.bullets.push({
                x: cbx,
                y: cby,
                vx: Math.cos(g.angle) * cbSpeed,
                vy: Math.sin(g.angle) * cbSpeed,
                isPlayer: false,
                gunId: gId,
                trail: [],
              });

              const cpuRecoilForce = 460;
              g.vx -= Math.cos(g.angle) * cpuRecoilForce;
              g.vy -= Math.sin(g.angle) * cpuRecoilForce;
              const cpuTorque = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 3.0 + 3.0);
              g.spin += cpuTorque;

              const cShellAngle = g.angle - Math.PI / 2 + (Math.random() - 0.5) * 0.3;
              s.ejectedShells.push({
                x: g.x,
                y: g.y,
                vx: Math.cos(cShellAngle) * 80 - g.vx * 0.15,
                vy: Math.sin(cShellAngle) * 80 - g.vy * 0.15,
                rot: g.angle,
                spin: (Math.random() - 0.5) * 14,
                life: 1.0,
              });
            };

            const runCpuAI = (g, gId, baseDelay) => {
              g.timer -= dt * 1000;
              const targetAngle = Math.atan2(player.y - g.y, player.x - g.x);
              const angleDiff = Math.abs(normAngle(g.angle - targetAngle));
              const hasThisBullet = s.bullets.some(
                (b) => !b.isPlayer && (b.gunId === gId || (!b.gunId && gId === 1))
              );

              if (!g.hasFiredInitialShot) {
                // Natural alignment for opening shot: waits for natural barrel rotation, NO TELEPORTING!
                if (!hasThisBullet && g.timer <= 0 && angleDiff < (cfg.cpuTol || 0.30) * 1.3) {
                  g.hasFiredInitialShot = true;
                  g.timer = baseDelay + Math.random() * 350;
                  fireCpuBullet(g, gId);
                }
              } else {
                // Subsequent shots: fires only when rotating barrel aligns within tolerance
                if (!hasThisBullet && g.timer <= 0 && angleDiff < (cfg.cpuTol || 0.24)) {
                  g.timer = baseDelay + (Math.random() - 0.5) * 300;
                  fireCpuBullet(g, gId);
                }
              }
            };

            runCpuAI(cpu, 1, cfg.cpuDelay);
            if (cpu2) {
              runCpuAI(cpu2, 2, cfg.cpuDelay * (cfg.cpu2DelayRatio || 1.1));
            }
          }

          // ── 4. UPDATE BULLETS (Continuous Collision Detection & Obstacle Blocking) ─
          for (let i = s.bullets.length - 1; i >= 0; i--) {
            const b = s.bullets[i];
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 5) b.trail.shift();

            const oldX = b.x;
            const oldY = b.y;

            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // Immediately exit visible screen boundary
            if (b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) {
              s.bullets.splice(i, 1);
              continue;
            }

            // Bullet vs Obstacle Collision (Continuous ray-cast against OBB)
            let blockedByObstacle = false;
            if (s.obstacles && s.obstacles.length > 0) {
              for (let oi = s.obstacles.length - 1; oi >= 0; oi--) {
                const obs = s.obstacles[oi];
                if (lineIntersectsOBB(oldX, oldY, b.x, b.y, obs.x, obs.y, obs.w, obs.h, obs.angle || 0)) {
                  blockedByObstacle = true;
                  playSound('hit', soundRef.current);

                  // Impact spark burst
                  for (let k = 0; k < 12; k++) {
                    const a = Math.random() * Math.PI * 2;
                    const sp = Math.random() * 80 + 25;
                    s.particles.push({
                      x: b.x,
                      y: b.y,
                      vx: Math.cos(a) * sp,
                      vy: Math.sin(a) * sp,
                      life: 0.8,
                      decay: 0.08,
                      col: obs.isDestructible ? '#f59e0b' : '#38bdf8',
                      size: Math.random() * 2.5 + 1.2,
                    });
                  }

                  if (obs.isDestructible) {
                    obs.hp = (obs.hp || 3) - 1;
                    if (obs.hp <= 0) {
                      // Destructible obstacle destroyed! Big debris burst
                      for (let k = 0; k < 25; k++) {
                        const a = Math.random() * Math.PI * 2;
                        const sp = Math.random() * 130 + 40;
                        s.particles.push({
                          x: obs.x,
                          y: obs.y,
                          vx: Math.cos(a) * sp,
                          vy: Math.sin(a) * sp,
                          life: 1.2,
                          decay: 0.04,
                          col: k % 2 === 0 ? '#ef4444' : '#f59e0b',
                          size: Math.random() * 4 + 2,
                        });
                      }
                      s.obstacles.splice(oi, 1);
                    }
                  }

                  s.bullets.splice(i, 1);
                  break;
                }
              }
            }
            if (blockedByObstacle) continue;

            // Bullet vs Opponent Collision
            if (b.isPlayer) {
              // Player bullet checks against cpu and cpu2 (if present)
              const cpuTargets = cpu2 ? [cpu, cpu2] : [cpu];
              let hitAny = false;

              for (const target of cpuTargets) {
                const segDx = b.x - oldX;
                const segDy = b.y - oldY;
                const segLenSq = segDx * segDx + segDy * segDy;
                let t = 0;
                if (segLenSq > 0.0001) {
                  t = ((target.x - oldX) * segDx + (target.y - oldY) * segDy) / segLenSq;
                  t = Math.max(0, Math.min(1, t));
                }
                const closestX = oldX + t * segDx;
                const closestY = oldY + t * segDy;
                const dist = Math.hypot(target.x - closestX, target.y - closestY);
                const hitRadius = Math.max(target.length * 0.58, target.radius * 1.35) + 6;

                if (dist < hitRadius) {
                  hitAny = true;
                  s.cpuSharedHp = Math.max(0, (s.cpuSharedHp !== undefined ? s.cpuSharedHp : cpu.hp) - 1);
                  cpu.hp = s.cpuSharedHp;
                  if (cpu2) cpu2.hp = s.cpuSharedHp;
                  target.flash = 14;
                  playSound('hit', soundRef.current);
                  s.screenShake = 8;

                  s.damageSkulls.push({
                    x: target.x,
                    y: target.y - 18,
                    vy: -1.2,
                    alpha: 1.0,
                    col: '#f87171',
                  });

                  for (let k = 0; k < 18; k++) {
                    const a = Math.random() * Math.PI * 2;
                    const sp = Math.random() * 6 + 2;
                    s.particles.push({
                      x: closestX,
                      y: closestY,
                      vx: Math.cos(a) * sp,
                      vy: Math.sin(a) * sp,
                      life: 1.0,
                      decay: 0.05,
                      col: '#ef4444',
                      size: Math.random() * 3 + 1.5,
                    });
                  }

                  s.bullets.splice(i, 1);
                  setHud((h) => ({ ...h, playerHp: player.hp, cpuHp: s.cpuSharedHp }));

                  if (s.cpuSharedHp <= 0) {
                    setPhase('victory');
                    playSound('win', soundRef.current);
                    setCoins((prev) => {
                      const next = prev + 50;
                      try {
                        localStorage.setItem('pistol_duel_coins', String(next));
                      } catch {}
                      return next;
                    });
                    try {
                      const currMax = parseInt(localStorage.getItem('pistol_duel_unlocked_level') || '1', 10);
                      const nextLevelToUnlock = Math.max(currMax, levelIdx + 2);
                      if (nextLevelToUnlock > currMax) {
                        localStorage.setItem('pistol_duel_unlocked_level', String(nextLevelToUnlock));
                        setUnlockedLevel(nextLevelToUnlock);
                      }
                    } catch {}
                  }
                  break;
                }
              }
              if (hitAny) continue;
            } else {
              // CPU bullet checks against Player
              if (player.invulnerable > 0) continue;

              const segDx = b.x - oldX;
              const segDy = b.y - oldY;
              const segLenSq = segDx * segDx + segDy * segDy;
              let t = 0;
              if (segLenSq > 0.0001) {
                t = ((player.x - oldX) * segDx + (player.y - oldY) * segDy) / segLenSq;
                t = Math.max(0, Math.min(1, t));
              }
              const closestX = oldX + t * segDx;
              const closestY = oldY + t * segDy;
              const dist = Math.hypot(player.x - closestX, player.y - closestY);
              const hitRadius = Math.max(player.length * 0.58, player.radius * 1.35) + 6;

              if (dist < hitRadius) {
                player.hp = Math.max(0, player.hp - 1);
                player.flash = 14;
                playSound('hit', soundRef.current);
                s.screenShake = 8;

                s.damageSkulls.push({
                  x: player.x,
                  y: player.y - 18,
                  vy: -1.2,
                  alpha: 1.0,
                  col: '#fbbf24',
                });

                for (let k = 0; k < 18; k++) {
                  const a = Math.random() * Math.PI * 2;
                  const sp = Math.random() * 6 + 2;
                  s.particles.push({
                    x: closestX,
                    y: closestY,
                    vx: Math.cos(a) * sp,
                    vy: Math.sin(a) * sp,
                    life: 1.0,
                    decay: 0.05,
                    col: '#00e5ff',
                    size: Math.random() * 3 + 1.5,
                  });
                }

                s.bullets.splice(i, 1);
                setHud((h) => ({
                  ...h,
                  playerHp: player.hp,
                  cpuHp: s.cpuSharedHp !== undefined ? s.cpuSharedHp : cpu.hp,
                }));

                if (player.hp <= 0) {
                  setPhase('failed');
                  playSound('gameover', soundRef.current);
                }
              }
            }
          }

          // Confetti particles update for Victory
          if (phaseRef.current === 'victory') {
            if (s.confetti.length < 80) {
              for (let k = 0; k < 6; k++) {
                s.confetti.push({
                  x: Math.random() * W,
                  y: -10,
                  vx: (Math.random() - 0.5) * 120,
                  vy: Math.random() * 160 + 90,
                  rot: Math.random() * Math.PI * 2,
                  vRot: (Math.random() - 0.5) * 8,
                  color: ['#00e5ff', '#fbbf24', '#f43f5e', '#a855f7', '#22c55e', '#ffffff'][Math.floor(Math.random() * 6)],
                  w: Math.random() * 8 + 4,
                  h: Math.random() * 5 + 3,
                });
              }
            }
            s.confetti.forEach((c) => {
              c.x += c.vx * dt;
              c.y += c.vy * dt;
              c.rot += c.vRot * dt;
            });
            s.confetti = s.confetti.filter((c) => c.y < H + 25);
          }

          // Particles update
          s.particles.forEach((p) => {
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.life -= p.decay;
          });
          s.particles = s.particles.filter((p) => p.life > 0.05);

          // Ejected shells update
          s.ejectedShells.forEach((sh) => {
            sh.x += sh.vx * dt;
            sh.y += sh.vy * dt;
            sh.vy += 8;
            sh.rot += sh.spin * dt;
            sh.life -= 0.02;
          });
          s.ejectedShells = s.ejectedShells.filter((sh) => sh.life > 0.05);

          // Damage skulls update
          s.damageSkulls.forEach((sk) => {
            sk.y += sk.vy;
            sk.alpha -= 0.025;
          });
          s.damageSkulls = s.damageSkulls.filter((sk) => sk.alpha > 0.05);

          // ── 5. RENDERING ON CRT CANVAS ──────────────────────────────────────
          ctx.save();

          if (s.screenShake > 0) {
            const sx = (Math.random() - 0.5) * s.screenShake;
            const sy = (Math.random() - 0.5) * s.screenShake;
            ctx.translate(sx, sy);
            s.screenShake *= 0.85;
            if (s.screenShake < 0.3) s.screenShake = 0;
          }

          // Arena background
          ctx.fillStyle = 'rgba(6, 8, 14, 0.72)';
          ctx.fillRect(0, 0, W, H);

          // Technical Grid
          ctx.strokeStyle = 'rgba(70, 95, 120, 0.18)';
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

          // Render Obstacles (Walls, Rotators, Moving Barriers)
          if (s.obstacles && s.obstacles.length > 0) {
            s.obstacles.forEach((obs) => {
              renderObstacle(ctx, obs);
            });
          }

          // Ghost motion trails
          const renderGhosts = (ghosts, colPrefix) => {
            ghosts.forEach((g) => {
              ctx.save();
              ctx.translate(g.x, g.y);
              ctx.rotate(g.angle);
              ctx.globalAlpha = g.alpha * 0.3;
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
          renderGhosts(player.ghosts, 'rgba(0, 229, 255, ');
          renderGhosts(cpu.ghosts, 'rgba(239, 68, 68, ');
          if (cpu2) renderGhosts(cpu2.ghosts, 'rgba(239, 68, 68, ');

          // Ejected Shells
          s.ejectedShells.forEach((sh) => {
            ctx.save();
            ctx.translate(sh.x, sh.y);
            ctx.rotate(sh.rot);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-2.5, -1, 5, 2.2);
            ctx.restore();
          });

          // Active Bullets — Crisp Single Bullet with Sleek Linear Tracer
          s.bullets.forEach((b) => {
            // Sleek single tracer line (not multiple circles)
            if (b.trail.length > 1) {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(b.trail[0].x, b.trail[0].y);
              for (let t = 1; t < b.trail.length; t++) {
                ctx.lineTo(b.trail[t].x, b.trail[t].y);
              }
              ctx.strokeStyle = b.isPlayer ? 'rgba(0, 229, 255, 0.45)' : 'rgba(239, 68, 68, 0.45)';
              ctx.lineWidth = 2.5;
              ctx.lineCap = 'round';
              ctx.stroke();
              ctx.restore();
            }

            // High-visibility Single Glowing Bullet Head
            ctx.save();
            ctx.shadowColor = b.isPlayer ? '#00e5ff' : '#ef4444';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Inner glowing core
            ctx.fillStyle = b.isPlayer ? '#00e5ff' : '#ef4444';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });

          // Tactical Laser Aim Sight (If enabled)
          if (hasLaserSight && player.hp > 0 && s.readyTimer <= 0) {
            ctx.save();
            const muzzleDist = player.length * 0.70;
            const mx = player.x + Math.cos(player.angle) * muzzleDist;
            const my = player.y + Math.sin(player.angle) * muzzleDist;
            const aimDist = Math.max(W, H) * 0.75;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(mx + Math.cos(player.angle) * aimDist, my + Math.sin(player.angle) * aimDist);
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 6]);
            ctx.stroke();
            // Muzzle laser emitter dot
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath();
            ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Authentic Beretta 92FS Guns: Player on LEFT, CPU on RIGHT
          renderArcadeGun(ctx, player, true);
          renderArcadeGun(ctx, cpu, false);
          if (cpu2) renderArcadeGun(ctx, cpu2, false);

          // Player Ad-Revive Protective Shield Aura
          if (player.invulnerable > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius + 14, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 14;
            ctx.stroke();
            ctx.restore();
          }

          // Damage Skulls
          s.damageSkulls.forEach((sk) => {
            ctx.save();
            ctx.font = '15px sans-serif';
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

          // Victory Confetti Streamers
          if (s.confetti && s.confetti.length > 0) {
            s.confetti.forEach((c) => {
              ctx.save();
              ctx.translate(c.x, c.y);
              ctx.rotate(c.rot);
              ctx.fillStyle = c.color;
              ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
              ctx.restore();
            });
          }

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
  }, [initLevelState, levelIdx, isPortrait, phase]);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center p-0 sm:p-2 overflow-hidden select-none"
      style={{
        background: 'radial-gradient(ellipse at center, #0f172a 0%, #090e17 70%, #030712 100%)',
      }}
    >
      {/* ═════════════════════════════════════════════════════════════════════
      {/* ═════════════════════════════════════════════════════════════════════
          1. 3D GAME START SCREEN INTERFACE (Clean 3D Hero Screen)
          ═════════════════════════════════════════════════════════════════════ */}
      {phase === 'splash' && (
        <div
          className="w-full h-full max-w-5xl flex flex-col justify-between items-center px-2.5 pb-2 sm:px-4 sm:pb-4 select-none relative overflow-hidden animate-[fadeIn_0.3s_ease-out]"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px), 20px)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
          }}
        >
          {/* Subtle Ambient Glowing Green Particles / Sparks */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            {[...Array(16)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-emerald-400 blur-[0.5px] opacity-70 animate-pulse"
                style={{
                  width: `${(i % 3) * 2 + 2.5}px`,
                  height: `${(i % 3) * 2 + 2.5}px`,
                  left: `${(i * 17 + 5) % 96}%`,
                  top: `${(i * 23 + 7) % 92}%`,
                  boxShadow: '0 0 6px #10b981',
                  animationDuration: `${1.8 + (i % 5) * 0.6}s`,
                  animationDelay: `${(i % 4) * 0.3}s`,
                }}
              />
            ))}
          </div>

          {/* Top Header Utilities: App brand + Audio + Fullscreen + Close (Clean, no overcrowding) */}
          <div className="w-full flex items-center justify-between z-20 px-2.5 sm:px-4 py-1.5 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
            <div className="flex items-center gap-2">
              <img
                src="/images/neon_duel_shot_icon.png"
                alt="Neon Duel Shot"
                className="w-8 h-8 rounded-xl object-contain border border-amber-400/40 shadow-sm bg-slate-900"
              />
              <div className="flex flex-col">
                <span className="text-amber-300 font-black text-xs sm:text-sm font-serif tracking-wider">
                  NEON DUEL SHOT
                </span>
                <span className="text-slate-400 text-[9px] font-mono">
                  360° Tactical Combat
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Audio Mute/Unmute */}
              <button
                onClick={() => setSoundOn((s) => !s)}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer active:scale-95"
                title={soundOn ? 'Mute' : 'Unmute'}
              >
                <i className={`fa-solid ${soundOn ? 'fa-volume-high text-amber-400' : 'fa-volume-xmark text-slate-500'} text-xs sm:text-sm`} />
              </button>

              {/* Fullscreen */}
              {onToggleFullscreen && (
                <button
                  onClick={onToggleFullscreen}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer active:scale-95"
                  title="Fullscreen"
                >
                  <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-xs sm:text-sm`} />
                </button>
              )}

              {/* Close Game */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-red-500/30 text-slate-300 hover:text-red-300 border border-white/10 transition cursor-pointer active:scale-95"
                  title="Close Game"
                >
                  <i className="fa-solid fa-xmark text-xs sm:text-sm" />
                </button>
              )}
            </div>
          </div>

          {/* Shifted Down Coins Badge Pill (Clean spacing as requested in feedback) */}
          <div className="flex items-center justify-center my-1.5 sm:my-2 z-20">
            <div
              onClick={handleBonusAd}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-amber-400/50 text-amber-300 font-mono text-xs font-bold cursor-pointer transition shadow-[0_0_15px_rgba(245,158,11,0.25)] active:scale-95"
              title="Watch Ad for +100 Free Coins"
            >
              <i className="fa-solid fa-coins text-amber-400 text-sm" />
              <span className="font-black tracking-wide">{coins} COINS</span>
              <span className="text-[10px] bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black px-2 py-0.5 rounded-lg shadow-sm">
                + BONUS
              </span>
            </div>
          </div>

          {/* Main 3D Start Screen Hero Presentation (Updated Neon Duel Shot Design) */}
          <div
            onClick={() => {
              playSound('click', soundOn);
              setPhase('level_select');
            }}
            className="relative my-auto w-full max-w-4xl aspect-[1024/661] max-h-[58vh] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.85)] border-2 border-[#334155]/60 cursor-pointer group select-none flex items-center justify-center bg-[#090d14] hover:border-amber-400/50 transition-all duration-300"
          >
            {/* 3D Render Image: Clean floor with scattered bullet casings */}
            <img
              src="/images/start_screen_splash.png"
              alt="Neon Duel Shot - Join the Duel"
              className="w-full h-full object-contain sm:object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />

            {/* Glowing Interactive "TAP TO START" Button with Animated Pointer & Pulsing Rings */}
            <div className="absolute top-[67%] -translate-y-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 sm:gap-1.5 z-10 pointer-events-none">
              {/* Outer pulsing neon ring + button */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-cyan-500/25 blur-sm sm:blur-md animate-ping" />
                <div className="relative flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-1 sm:py-2 rounded-full bg-slate-950/85 border border-cyan-400/90 sm:border-2 shadow-[0_0_15px_rgba(6,182,212,0.6),inset_0_0_10px_rgba(6,182,212,0.3)] sm:shadow-[0_0_30px_rgba(6,182,212,0.8),inset_0_0_15px_rgba(6,182,212,0.4)] backdrop-blur-md group-hover:scale-105 group-hover:border-cyan-300 transition-all duration-300 animate-[pulse_2s_ease-in-out_infinite]">
                  <span className="text-xs sm:text-base animate-bounce select-none">👆</span>
                  <span className="text-white text-[11px] sm:text-base md:text-xl font-black font-sans tracking-wider sm:tracking-widest uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.9)] whitespace-nowrap">
                    TAP TO START
                  </span>
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse" />
                </div>
              </div>
              <span className="text-[7px] sm:text-[9px] font-mono tracking-wider sm:tracking-widest text-cyan-300 uppercase font-black drop-shadow animate-pulse whitespace-nowrap">
                CLICK OR TAP TO ENTER DUEL
              </span>
            </div>
          </div>

          {/* Downshifted Row of 3 Tactile Embossed Buttons: [ Gear ⚙️ ] [ Trophy 🏆 ] [ Armor Vest 🦺 ] */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 my-2 sm:my-3 z-20">
            {/* Button 1: Gear (Settings) */}
            <button
              onClick={() => {
                playSound('click', soundOn);
                setIsSettingsOpen(true);
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#3d516c] via-[#243447] to-[#141f2c] border-2 border-[#5a7698] shadow-[0_5px_0_#0d1520,0_10px_20px_rgba(0,0,0,0.6)] hover:brightness-115 active:translate-y-1 active:shadow-[0_1px_0_#0d1520] transition-all cursor-pointer flex items-center justify-center group"
              title="Settings"
            >
              <i className="fa-solid fa-gear text-slate-200 group-hover:text-white text-lg sm:text-xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
            </button>

            {/* Button 2: Trophy (Achievements & Career) */}
            <button
              onClick={() => {
                playSound('click', soundOn);
                setIsTrophyOpen(true);
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#3d516c] via-[#243447] to-[#141f2c] border-2 border-[#5a7698] shadow-[0_5px_0_#0d1520,0_10px_20px_rgba(0,0,0,0.6)] hover:brightness-115 active:translate-y-1 active:shadow-[0_1px_0_#0d1520] transition-all cursor-pointer flex items-center justify-center group"
              title="Achievements & Progress"
            >
              <i className="fa-solid fa-trophy text-slate-200 group-hover:text-amber-300 text-lg sm:text-xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
            </button>

            {/* Button 3: Bulletproof Vest (Tactical Perks) */}
            <button
              onClick={() => {
                playSound('click', soundOn);
                setIsArmorOpen(true);
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#3d516c] via-[#243447] to-[#141f2c] border-2 border-[#5a7698] shadow-[0_5px_0_#0d1520,0_10px_20px_rgba(0,0,0,0.6)] hover:brightness-115 active:translate-y-1 active:shadow-[0_1px_0_#0d1520] transition-all cursor-pointer flex items-center justify-center group"
              title="Tactical Armor & Perks"
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-slate-200 group-hover:text-cyan-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 2a2 2 0 0 0-2 2v2.5a2 2 0 0 0 .58 1.41L7 9.33V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9.33l1.42-1.42A2 2 0 0 0 19 6.5V4a2 2 0 0 0-2-2h-3a2 2 0 0 1-4 0H7zm2 4a3.99 3.99 0 0 0 6 0v2.17l-1 1V10a1 1 0 0 0-2 0v-.5h-2V10a1 1 0 0 0-2 0V9.17l-1-1V6zm0 5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.5zm0 4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.5z" />
              </svg>
            </button>
          </div>

          {/* Bottom subtle footer */}
          <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 px-2 py-0.5 z-20">
            <span>TAP ANYWHERE TO DUEL</span>
            <span>v2.4.0 · 50 LEVELS</span>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          2. LEVEL SELECT SCREEN (Matches User Reference Image 2)
          ═════════════════════════════════════════════════════════════════════ */}
      {phase === 'level_select' && (() => {
        const ITEMS_PER_PAGE = 15;
        const totalPages = Math.ceil(LEVELS.length / ITEMS_PER_PAGE);
        const pageLevels = LEVELS.slice(levelPage * ITEMS_PER_PAGE, (levelPage + 1) * ITEMS_PER_PAGE);

        return (
          <div
            className="w-full h-full max-w-2xl flex flex-col justify-between items-center px-2 pb-2 sm:px-5 sm:pb-5 select-none relative overflow-y-auto animate-[fadeIn_0.25s_ease-out]"
            style={{
              paddingTop: 'max(env(safe-area-inset-top, 0px), 20px)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
            }}
            onTouchStart={(e) => {
              touchStartXRef.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStartXRef.current === null) return;
              const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
              if (deltaX > 45) {
                // Swiped right -> Previous page
                playSound('click', soundOn);
                setLevelPage((p) => (p > 0 ? p - 1 : totalPages - 1));
              } else if (deltaX < -45) {
                // Swiped left -> Next page
                playSound('click', soundOn);
                setLevelPage((p) => (p < totalPages - 1 ? p + 1 : 0));
              }
              touchStartXRef.current = null;
            }}
          >
            {/* Header (Matches reference style with Pistol Fight badge: "PISTOL FIGHT ARENA") */}
            <div className="flex items-center justify-between w-full px-2 pt-1.5 sm:pt-3 flex-shrink-0 gap-2">
              <button
                onClick={() => {
                  playSound('click', soundOn);
                  setPhase('splash');
                }}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-b from-rose-500 to-red-700 text-white font-black flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-95 hover:scale-105 transition border border-white/30 cursor-pointer flex-shrink-0"
                title="Back to Preview"
              >
                <i className="fa-solid fa-arrow-left text-xs sm:text-sm" />
              </button>
              <div className="flex items-center justify-center gap-2 min-w-0 px-1">
                <img
                  src="/images/neon_duel_shot_icon.png"
                  alt="Neon Duel Shot"
                  className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl object-contain border border-amber-400/40 shadow shadow-amber-500/20 flex-shrink-0 bg-slate-900 hidden xs:block"
                />
                <div className="text-center min-w-0">
                  <h2
                    className="text-base sm:text-2xl md:text-3xl font-black text-amber-300 font-serif tracking-wider truncate"
                    style={{ textShadow: '0 2px 10px rgba(251,191,36,0.6), 0 0 20px rgba(239,68,68,0.4)' }}
                  >
                    NEON DUEL SHOT ARENA
                  </h2>
                  <p className="text-[8px] sm:text-[10px] font-mono tracking-widest text-slate-300 uppercase truncate">
                    SELECT LEVEL · 50 STAGES (PAGE {levelPage + 1} / {totalPages})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-slate-900/80 border border-amber-400/40 px-2.5 py-1 rounded-full text-amber-300 font-mono text-[11px] sm:text-xs font-bold shadow-md flex-shrink-0">
                <span>🪙</span>
                <span>{coins}</span>
              </div>
            </div>

            {/* Top Promo Banner (Web: Play Now / Mobile App: Google Play Download) */}
            <div className="w-full max-w-lg mt-1 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-red-500/20 border border-amber-400/40 flex items-center justify-between text-xs shadow-md flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base animate-pulse">🔥</span>
                <div className="min-w-0">
                  <div className="font-extrabold text-amber-300 text-[11px] sm:text-xs truncate">
                    FEATURED: 3D BIKE RACER
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {isNativeApp() ? 'Install our 3D racing game from Google Play' : 'High-speed 3D motorcycle racing challenge'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLaunchBike}
                className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black text-[10px] tracking-wider uppercase shadow cursor-pointer transition active:scale-95 flex-shrink-0 ml-2 flex items-center gap-1"
              >
                {isNativeApp() ? (
                  <>
                    <i className="fa-brands fa-google-play text-slate-950 text-[10px]" />
                    <span>GET APP ➔</span>
                  </>
                ) : (
                  <span>PLAY NOW ➔</span>
                )}
              </button>
            </div>

            {/* Grid of 15 Circular Glossy Buttons (3 rows x 5 columns = 15 buttons) */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-3.5 md:gap-4 my-auto p-1 sm:p-4 w-full max-w-lg justify-items-center transition-all duration-300">
              {pageLevels.map((lvl) => {
                const isUnlocked = lvl.level <= unlockedLevel;
                const isCurrent = lvl.level === levelIdx + 1;

                return (
                  <button
                    key={lvl.level}
                    disabled={!isUnlocked}
                    onClick={() => {
                      if (isUnlocked) {
                        playSound('click', soundOn);
                        startLevel(lvl.level - 1);
                      }
                    }}
                    className={`relative w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex flex-col items-center justify-center font-black select-none transition-all duration-200 ${
                      isUnlocked
                        ? 'cursor-pointer active:scale-90 hover:scale-105 shadow-xl'
                        : 'cursor-not-allowed opacity-40 bg-slate-800 border-2 border-slate-700 text-slate-500'
                    }`}
                    style={
                      isUnlocked
                        ? {
                            background: 'radial-gradient(circle at 35% 28%, #ff6b6b 0%, #dc2626 55%, #7f1d1d 100%)',
                            boxShadow: isCurrent
                              ? '0 0 0 3px #fbbf24, 0 10px 22px rgba(220,38,38,0.7)'
                              : '0 6px 18px rgba(220,38,38,0.5)',
                            border: '2px solid rgba(255,255,255,0.65)',
                          }
                        : {}
                    }
                  >
                    {/* Glossy Specular Highlight Arc */}
                    {isUnlocked && (
                      <div className="absolute top-0.5 left-1.5 sm:top-1.5 sm:left-2.5 w-3 sm:w-4.5 h-1.5 sm:h-2 rounded-full bg-white/45 blur-[0.3px] pointer-events-none" />
                    )}

                    {isUnlocked ? (
                      <>
                        <span className="text-sm sm:text-lg md:text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] font-sans leading-none">
                          {lvl.level}
                        </span>
                        <div className="flex gap-0.5 text-[6px] sm:text-[8px] text-amber-300 drop-shadow mt-0.5 leading-none">
                          <span>★</span><span>★</span><span>★</span>
                        </div>
                      </>
                    ) : (
                      <i className="fa-solid fa-lock text-[10px] sm:text-xs text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom Navigation with Slide Chevrons & 4 Pagination Dots */}
            <div className="flex items-center justify-between w-full max-w-lg px-3 sm:px-4 pb-2 sm:pb-4 flex-shrink-0">
              {/* Left Chevron Slide Button */}
              <button
                onClick={() => {
                  playSound('click', soundOn);
                  setLevelPage((p) => (p > 0 ? p - 1 : totalPages - 1));
                }}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-b from-rose-500 to-red-700 text-white font-black flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-90 hover:scale-105 transition cursor-pointer border border-white/40"
                title="Previous Levels (Slide Left)"
              >
                <i className="fa-solid fa-chevron-left text-xs sm:text-base" />
              </button>

              {/* Pagination Dots (4 Dots for 50 Levels) */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      playSound('click', soundOn);
                      setLevelPage(idx);
                    }}
                    className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                      levelPage === idx
                        ? 'w-6 sm:w-8 bg-gradient-to-r from-red-500 to-amber-500 shadow-[0_0_10px_#ef4444]'
                        : 'w-2 sm:w-2.5 bg-white/30 hover:bg-white/60'
                    }`}
                    title={`Page ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Right Chevron Slide Button */}
              <button
                onClick={() => {
                  playSound('click', soundOn);
                  setLevelPage((p) => (p < totalPages - 1 ? p + 1 : 0));
                }}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-b from-rose-500 to-red-700 text-white font-black flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-90 hover:scale-105 transition cursor-pointer border border-white/40"
                title="Next Levels (Slide Right)"
              >
                <i className="fa-solid fa-chevron-right text-xs sm:text-base" />
              </button>
            </div>

            {/* Footer Relatable Games & Rewards (Fills Available Mobile Space) */}
            <div className="w-full max-w-lg px-2 pt-1 pb-2 flex flex-col gap-1.5 flex-shrink-0">
              <div className="flex items-center justify-between px-1 text-[9px] sm:text-[10px] font-mono uppercase text-slate-400">
                <span className="flex items-center gap-1">
                  <i className="fa-solid fa-gamepad text-cyan-400" />
                  <span>RECOMMENDED GAMES & REWARDS</span>
                </span>
                <span className="text-amber-400">INSTANT PLAY</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* 1. 3D Bike Racer */}
                <div
                  onClick={handleLaunchBike}
                  className="bg-slate-900/85 hover:bg-slate-800/90 p-2 sm:p-2.5 rounded-2xl border border-cyan-500/30 flex items-center justify-between gap-1.5 cursor-pointer shadow-lg hover:border-cyan-400 transition active:scale-95"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-base sm:text-lg flex-shrink-0 shadow">
                      🏍️
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-white text-[11px] sm:text-xs truncate flex items-center gap-1">
                        <span>3D Bike Racer</span>
                        {isNativeApp() && (
                          <i className="fa-brands fa-google-play text-emerald-400 text-[9px]" />
                        )}
                      </div>
                      <div className="text-[8px] sm:text-[9px] text-cyan-300 font-mono truncate">
                        {isNativeApp() ? 'Google Play Store' : '97% Likes · Racing'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex-shrink-0">
                    {isNativeApp() ? 'GET ➔' : 'PLAY ➔'}
                  </span>
                </div>

                {/* 2. Free Bonus Coins Ad */}
                <div
                  onClick={handleBonusAd}
                  className="bg-slate-900/85 hover:bg-slate-800/90 p-2 sm:p-2.5 rounded-2xl border border-amber-500/30 flex items-center gap-2 cursor-pointer shadow-lg hover:border-amber-400 transition active:scale-95"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-base sm:text-lg flex-shrink-0 shadow animate-pulse">
                    📺
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-amber-300 text-[11px] sm:text-xs truncate">
                      Free +100 Coins
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-amber-400/90 font-mono">
                      Watch Short Ad
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═════════════════════════════════════════════════════════════════════
          3. ACTIVE GAMEPLAY ARCADE CONSOLE
          - Desktop / Landscape: 4:3 Aspect Neon Frame (1920x1440)
          - Mobile / Portrait: 9:16 Aspect Neon Frame (1080x1920)
          ═════════════════════════════════════════════════════════════════════ */}
      {(phase === 'playing' || phase === 'victory' || phase === 'failed') && (
        <div
          className="w-full h-full max-w-lg md:max-w-4xl flex flex-col items-center justify-between px-1.5 pb-1 sm:px-2 sm:pb-2 select-none relative overflow-hidden animate-[fadeIn_0.2s_ease-out]"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px), 20px)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)',
          }}
        >
          {/* ── 1. UNIFIED TOP HEADER BAR (HEADER SIDE) ───────────────────── */}
          <div className="w-full flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/15 shadow-xl z-30 flex-shrink-0 mb-1">
            {/* Left: Neon Duel Shot Logo & Level Badge */}
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/images/neon_duel_shot_icon.png"
                alt="Neon Duel Shot"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-contain border border-amber-400/40 shadow shadow-amber-500/20 flex-shrink-0 bg-slate-900"
              />
              <div className="min-w-0">
                <span className="font-serif font-black text-xs sm:text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 truncate block leading-tight">
                  NEON DUEL SHOT
                </span>
                <span className="text-[9px] font-mono text-slate-400 block leading-tight">
                  STAGE {hud.level} · 50 ROUNDS
                </span>
              </div>
            </div>

            {/* Right: 4 Perfectly Symmetrical & Uniform Action Buttons: PAUSE | HOME | FULLSCREEN | CLOSE */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Pause */}
              <button
                onClick={() => {
                  playSound('click', soundRef.current);
                  setIsPaused((p) => !p);
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 hover:border-amber-400/60 text-slate-300 hover:text-amber-400 flex items-center justify-center transition active:scale-95 shadow-md shadow-black/50 cursor-pointer"
                title={isPaused ? "Resume Game" : "Pause Game"}
              >
                <i className={`fa-solid ${isPaused ? 'fa-play text-amber-400' : 'fa-pause'} text-xs sm:text-sm`} />
              </button>

              {/* Home */}
              <button
                onClick={handleHomeClick}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-400 flex items-center justify-center transition active:scale-95 shadow-md shadow-black/50 cursor-pointer"
                title="Return to Home / Level Select"
              >
                <i className="fa-solid fa-house text-xs sm:text-sm" />
              </button>

              {/* Fullscreen */}
              {onToggleFullscreen && (
                <button
                  onClick={() => {
                    playSound('click', soundRef.current);
                    onToggleFullscreen();
                  }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 hover:border-white/60 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95 shadow-md shadow-black/50 cursor-pointer"
                  title="Fullscreen"
                >
                  <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-xs sm:text-sm`} />
                </button>
              )}

              {/* Close */}
              {onClose && (
                <button
                  onClick={() => {
                    playSound('click', soundRef.current);
                    onClose();
                  }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-red-500/30 border border-white/20 hover:border-red-400/60 text-slate-300 hover:text-red-400 flex items-center justify-center transition active:scale-95 shadow-md shadow-black/50 cursor-pointer"
                  title="Exit Game"
                >
                  <i className="fa-solid fa-xmark text-xs sm:text-sm" />
                </button>
              )}
            </div>
          </div>

          {/* ── 2. ACTIVE CRT ARCADE CONSOLE CABINET (CENTER) ───────────────── */}
          <div
            className="relative flex items-center justify-center overflow-hidden transition-all duration-300 select-none my-auto"
            style={{
              width: isPortrait
                ? 'min(calc(100vw - 12px), 430px, calc((100dvh - 138px) * 9 / 16))'
                : 'min(94vw, 960px, calc((100dvh - 105px) * 4 / 3))',
              maxWidth: isPortrait ? '430px' : '960px',
              height: isPortrait
                ? 'min(calc(100dvh - 138px), 710px, calc((100vw - 12px) * 16 / 9))'
                : 'min(calc(100dvh - 105px), 660px, calc(94vw * 3 / 4))',
              aspectRatio: isPortrait ? '9 / 16' : '4 / 3',
              filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.95))',
            }}
          >
            {/* ── 1. NEON LIGHTS FRAME BACKGROUND ─────── */}
            <img
              src={isPortrait ? '/images/mobile_neon_frame.jpg' : '/images/desktop_neon_frame.jpg'}
              alt="Neon Duel Shot Arena Frame"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-10"
            />

            {/* ── 2. ACTIVE CRT MONITOR SCREEN ── */}
            <div
              ref={screenAreaRef}
              className="absolute overflow-hidden cursor-crosshair z-20"
              style={
                isPortrait
                  ? {
                    left: '8.5%',
                    top: '5.2%',
                    width: '83.0%',
                    height: '89.6%',
                    borderRadius: '28px',
                    boxShadow: 'inset 0 0 25px rgba(0,0,0,0.85)',
                  }
                : {
                    left: '10.2%',
                    top: '14.2%',
                    width: '79.6%',
                    height: '71.7%',
                    borderRadius: '24px',
                    boxShadow: 'inset 0 0 35px rgba(0,0,0,0.85)',
                  }
            }
            onClick={handleShoot}
          >
            {/* Active 2D Physics Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

            {/* In-Screen HUD Overlay */}
            <div className="absolute top-0 left-0 right-0 px-2 sm:px-4 pt-2 sm:pt-3 pointer-events-none z-30 flex flex-col gap-1.5">
              {/* Top Row: P1 (Left), Title Plaque (Center), CPU (Right) */}
              <div className="flex items-center justify-between w-full">
                {/* Upper-Left: P1 + DYNAMIC HEARTS */}
                <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-950/80 backdrop-blur-md px-2 sm:px-2.5 py-1 rounded-full border border-cyan-500/30">
                  <span
                    className="font-mono font-black text-xs sm:text-sm tracking-wider text-[#00e5ff]"
                    style={{ textShadow: '0 0 8px rgba(0,229,255,0.8)' }}
                  >
                    P1
                  </span>
                  <div className="flex items-center gap-0.5 text-xs sm:text-sm">
                    {Array.from({ length: hud.playerMaxHp }).map((_, i) => {
                      const isFilled = i < hud.playerHp;
                      return (
                        <span
                          key={i}
                          className={`transition-all duration-300 ${
                            isFilled
                              ? 'text-[#00e5ff] drop-shadow-[0_0_8px_#00e5ff] scale-100'
                              : 'text-slate-600/40 scale-90'
                          }`}
                        >
                          {isFilled ? '♥' : '♡'}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Center: Glowing Cyber Plaque */}
                <div className="hidden xs:flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-slate-950/85 border border-amber-400/40 backdrop-blur-md shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                  <span className="font-serif font-black tracking-widest text-[9px] sm:text-xs uppercase bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
                    Neon Duel Shot
                  </span>
                </div>

              {/* Upper-Right: CPU + DYNAMIC HEARTS */}
              <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-950/80 backdrop-blur-md px-2 sm:px-2.5 py-1 rounded-full border border-red-500/30">
                <div className="flex items-center gap-0.5 text-xs sm:text-sm">
                  {Array.from({ length: hud.cpuMaxHp }).map((_, i) => {
                    const isFilled = i < hud.cpuHp;
                    return (
                      <span
                        key={i}
                        className={`transition-all duration-300 ${
                          isFilled
                            ? 'text-[#ef4444] drop-shadow-[0_0_8px_#ef4444] scale-100'
                            : 'text-slate-600/40 scale-90'
                        }`}
                      >
                        {isFilled ? '♥' : '♡'}
                      </span>
                    );
                  })}
                </div>
                <span
                  className="font-mono font-black text-xs sm:text-sm tracking-wider text-[#ef4444]"
                  style={{ textShadow: '0 0 8px rgba(239,68,68,0.8)' }}
                >
                  CPU
                </span>
              </div>
            </div>

            {/* Sub-Header: Level / Coins / Audio Status Capsule (NO BATTERY INDICATOR) */}
            <div className="flex items-center justify-center w-full pointer-events-auto">
              <div className="bg-[#10141f]/90 px-2.5 sm:px-3 py-0.5 rounded-full border border-white/15 flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[10px] font-mono shadow-inner">
                <span className="font-extrabold text-slate-200 tracking-wider">
                  LEVEL {hud.level}
                </span>
                <span className="text-slate-500">|</span>
                <div className="flex items-center gap-0.5 text-yellow-400 font-bold">
                  <span>🪙</span>
                  <span>{coins}</span>
                </div>
                <span className="text-slate-500">|</span>
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
              </div>
            </div>
          </div>

          {/* ── Asset Preloading Overlay ── */}
          {!assetsLoaded && (
            <div className="absolute inset-0 z-50 bg-[#070a12]/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center select-none">
              <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mb-3 shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
              <span className="font-mono text-xs font-black tracking-widest text-amber-300 uppercase animate-pulse">
                INITIALIZING WEAPONS...
              </span>
              <span className="font-mono text-[9px] text-slate-500 mt-1">
                BERETTA 92FS CALIBRATION
              </span>
            </div>
          )}

          {/* ── Ready Countdown Overlay (3-4s Stance Stop Before Combat) ── */}
          {Boolean(readyCountdownDisplay) && phase === 'playing' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-40 select-none">
              <div className="flex flex-col items-center justify-center animate-[pulse_0.45s_ease-in-out_infinite]">
                <span
                  className="text-6xl sm:text-7xl md:text-8xl font-black font-mono tracking-wider"
                  style={{
                    color: readyCountdownDisplay === 'DUEL!' ? '#fbbf24' : '#ef4444',
                    textShadow:
                      readyCountdownDisplay === 'DUEL!'
                        ? '0 0 25px rgba(251,191,36,0.9), 0 0 50px rgba(245,158,11,0.6)'
                        : '0 0 25px rgba(239,68,68,0.9), 0 0 50px rgba(220,38,38,0.6)',
                  }}
                >
                  {readyCountdownDisplay}
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-black tracking-widest text-amber-300 uppercase mt-2 px-3 py-1 rounded-full bg-black/75 border border-amber-400/40 backdrop-blur-sm shadow-lg">
                  {readyCountdownDisplay === 'DUEL!' ? 'FIRE!' : 'READY... GET SET!'}
                </span>
              </div>
            </div>
          )}

          {/* ── Pause Modal Overlay ── */}
          {isPaused && phase === 'playing' && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-40 flex flex-col items-center justify-center p-3 text-center animate-[fadeIn_0.15s_ease-out]">
              <div className="text-3xl mb-1">⏸️</div>
              <h3 className="text-base sm:text-xl font-black text-cyan-300 uppercase tracking-widest font-mono drop-shadow-[0_0_12px_rgba(6,182,212,0.6)] mb-3">
                GAME PAUSED
              </h3>
              <div className="flex flex-col gap-2 w-full max-w-[220px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound('click', soundRef.current);
                    setIsPaused(false);
                  }}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/30 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-play text-xs" />
                  <span>RESUME</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound('click', soundRef.current);
                    setIsPaused(false);
                    startLevel(levelIdx);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-rotate-left text-xs" />
                  <span>RESTART</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused(false);
                    handleHomeClick();
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-house text-xs" />
                  <span>HOME</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Rewarded Ad Playing Modal Overlay ── */}
          {adPlaying && (
            <div className="absolute inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center select-none animate-[fadeIn_0.2s_ease-out]">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-2xl mb-3 shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-pulse">
                📺
              </div>
              <div className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-black mb-1">
                REWARDED AD · DUEL REVIVE
              </div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider mb-2">
                Watching Ad to Continue...
              </h3>
              <p className="text-xs text-slate-300 max-w-xs mb-4">
                Your Gold Beretta will revive with 2 Hearts and a temporary protective recovery shield!
              </p>
              <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/10 mb-2">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-700 ease-linear"
                  style={{ width: `${((3 - adCountdown) / 3) * 100}%` }}
                />
              </div>
              <div className="text-xs font-mono font-bold text-slate-400 mb-4">
                Resuming in {adCountdown}s...
              </div>
              <button
                onClick={() => {
                  if (adTimerRef.current) clearInterval(adTimerRef.current);
                  setAdPlaying(false);
                  revivePlayer();
                }}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Skip Ad & Revive Now ➔
              </button>
            </div>
          )}

          {/* ── Victory Modal Overlay (Level Complete / Congratulations) ── */}
          {phase === 'victory' && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-40 flex flex-col items-center justify-center p-3 text-center animate-[fadeIn_0.2s_ease-out]">
              <div className="text-3xl sm:text-4xl animate-bounce mb-1">🎉</div>
              <div className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-black mb-1">
                LEVEL {hud.level} COMPLETE
              </div>
              <h3 className="text-base sm:text-xl font-black text-amber-300 uppercase tracking-widest font-serif drop-shadow-[0_0_12px_rgba(251,191,36,0.6)] mb-1">
                CONGRATULATIONS!
              </h3>
              <p className="text-slate-300 text-[10px] sm:text-xs mb-3 font-mono">
                OUTSTANDING MARKSMANSHIP · REWARD +50 COINS 🪙
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs px-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound('click', soundRef.current);
                    startLevel(levelIdx + 1);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:brightness-110 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/30 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>NEXT LEVEL</span>
                  <i className="fa-solid fa-arrow-right text-xs" />
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSound('click', soundRef.current);
                      startLevel(levelIdx);
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-rotate-left text-xs" />
                    <span>RETRY</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHomeClick();
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-house text-xs" />
                    <span>HOME</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Defeat Modal Overlay (Defeat / Game Over) ── */}
          {phase === 'failed' && (
            <div className="absolute inset-0 bg-black/88 backdrop-blur-sm z-40 flex flex-col items-center justify-center p-3 text-center animate-[fadeIn_0.2s_ease-out]">
              <div className="text-3xl sm:text-4xl mb-1">💀</div>
              <div className="text-[10px] font-mono tracking-widest text-red-400 uppercase font-black mb-1">
                DUEL FAILED
              </div>
              <h3 className="text-base sm:text-xl font-black text-red-500 uppercase tracking-widest font-serif drop-shadow-[0_0_12px_rgba(239,68,68,0.6)] mb-1">
                DEFEAT!
              </h3>
              <p className="text-slate-300 text-xs font-mono mb-4">
                CPU OUT-DUELED YOU IN LEVEL {hud.level}!
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs px-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWatchAdContinue();
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-110 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/35 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-film text-xs" />
                  <span>CONTINUE / WATCH AD</span>
                  <span className="text-[9px] bg-black/30 text-amber-200 px-1.5 py-0.5 rounded font-mono">
                    REVIVE
                  </span>
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSound('click', soundRef.current);
                      startLevel(levelIdx);
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-rotate-left text-xs" />
                    <span>REPLAY</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHomeClick();
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-house text-xs" />
                    <span>HOME</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. "TAP TO SHOOT" TEMPORARY INSTRUCTION (Auto-hides after 3.8s) ── */}
        <div
          className={`absolute left-0 right-0 flex items-center justify-center pointer-events-none px-4 transition-all duration-700 z-30 ${
            showInstruction ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
          style={isPortrait ? { bottom: '4%' } : { bottom: '7%' }}
        >
          <div className="bg-slate-950/85 backdrop-blur-md px-3 sm:px-4 py-1 rounded-full border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <span className="text-[8px] sm:text-[10px] font-black tracking-widest text-cyan-200 uppercase font-mono animate-pulse">
              TAP TO SHOOT — MASTER THE RECOIL FOR THE NEXT LEVEL!
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. BOTTOM FOOTER BAR (FOOTER SIDE: RELATABLE GAME & LIKE/REPORT) ── */}
      <div className="w-full flex items-center justify-between px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg z-30 flex-shrink-0 mt-1 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => {
              playSound('click', soundRef.current);
              toggleLike();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold text-[10px] sm:text-xs backdrop-blur-md border transition cursor-pointer active:scale-95 ${
              isLiked
                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300'
                : 'bg-slate-950/75 hover:bg-slate-900/90 border-white/20 text-slate-300 hover:text-white'
            }`}
          >
            <i className={`fa-solid fa-thumbs-up ${isLiked ? 'text-emerald-400' : 'text-slate-400'} text-xs`} />
            <span>Like (99%)</span>
          </button>

          <button
            onClick={() => {
              playSound('click', soundRef.current);
              triggerReport();
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-xl font-bold text-[10px] sm:text-xs backdrop-blur-md bg-slate-950/75 hover:bg-slate-900/90 border border-white/20 text-slate-300 hover:text-rose-300 transition cursor-pointer active:scale-95"
          >
            <i className="fa-solid fa-flag text-slate-400 text-xs" />
            <span>{reportedMsg ? 'Reported!' : 'Report'}</span>
          </button>
        </div>

        {/* Relatable Game / Play Store Cross-Promo Pill */}
        <div
          onClick={handleLaunchBike}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-amber-400/40 hover:border-amber-400 text-amber-300 cursor-pointer transition active:scale-95 shadow"
          title={isNativeApp() ? "Download 3D Bike Racer from Google Play" : "Play 3D Bike Racer"}
        >
          {isNativeApp() ? (
            <i className="fa-brands fa-google-play text-emerald-400 text-xs" />
          ) : (
            <span className="text-xs">🏍️</span>
          )}
          <span className="text-[10px] sm:text-xs font-black tracking-wide">3D Bike Racer</span>
          <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded font-mono font-bold uppercase hidden xs:inline">
            {isNativeApp() ? 'Install ➔' : 'Play ➔'}
          </span>
        </div>
      </div>
    </div>
  )}

    {/* ═════════════════════════════════════════════════════════════════════
        4. AUDIO & GAMEPLAY SETTINGS MODAL
        ═════════════════════════════════════════════════════════════════════ */}
    {isSettingsOpen && (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-[fadeIn_0.2s_ease-out]">
        <div className="w-full max-w-sm max-h-[92dvh] overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-4 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.3)] flex flex-col gap-3.5 sm:gap-4 text-white relative">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow">
                <i className="fa-solid fa-gear text-sm" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black font-serif tracking-wider text-amber-300">
                  SETTINGS
                </h3>
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  AUDIO & PREFERENCES
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                playSound('click', soundOn);
                setIsSettingsOpen(false);
              }}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-500/30 text-slate-400 hover:text-red-400 flex items-center justify-center transition cursor-pointer"
              title="Close Settings"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>

          {/* Music Volume Control */}
          <div className="flex flex-col gap-1.5 bg-slate-950/60 p-3 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-2 text-slate-300 font-bold">
                <i className="fa-solid fa-music text-amber-400" />
                <span>Music Volume</span>
              </span>
              <span className="font-extrabold text-amber-300">{musicVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setMusicVolume(val);
                try {
                  localStorage.setItem('pistol_duel_music_vol', String(val));
                } catch {}
              }}
              className="w-full accent-amber-400 bg-slate-800 rounded-lg h-2 cursor-pointer mt-1"
            />
          </div>

          {/* SFX Volume Control */}
          <div className="flex flex-col gap-1.5 bg-slate-950/60 p-3 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-2 text-slate-300 font-bold">
                <i className="fa-solid fa-volume-high text-cyan-400" />
                <span>SFX Volume</span>
              </span>
              <span className="font-extrabold text-cyan-300">{sfxVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVolume}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setSfxVolume(val);
                try {
                  localStorage.setItem('pistol_duel_sfx_vol', String(val));
                } catch {}
              }}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2 cursor-pointer mt-1"
            />
          </div>

          {/* Master Sound Mute / Unmute Toggle */}
          <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-2xl border border-white/10">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <i className={`fa-solid ${soundOn ? 'fa-bell text-emerald-400' : 'fa-bell-slash text-red-400'}`} />
              <span>Master Sound</span>
            </span>
            <button
              onClick={() => {
                playSound('click', !soundOn);
                setSoundOn((s) => !s);
              }}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black transition cursor-pointer active:scale-95 ${
                soundOn
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'bg-red-500/20 text-red-300 border border-red-400/40'
              }`}
            >
              {soundOn ? 'ENABLED' : 'MUTED'}
            </button>
          </div>

          {/* Save & Close Button */}
          <button
            onClick={() => {
              playSound('click', soundOn);
              setIsSettingsOpen(false);
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer mt-1"
          >
            SAVE & CLOSE
          </button>
        </div>
      </div>
    )}

    {/* ═════════════════════════════════════════════════════════════════════
        5. ACHIEVEMENTS & TROPHIES MODAL (Interactive Rewards Flow)
        ═════════════════════════════════════════════════════════════════════ */}
    {isTrophyOpen && (() => {
      const MILESTONES = [
        {
          id: 'first_blood',
          title: 'First Blood',
          desc: 'Complete Level 1 Duel',
          icon: '🎯',
          reward: 100,
          isUnlocked: unlockedLevel >= 2,
        },
        {
          id: 'obstacle_master',
          title: 'Obstacle Master',
          desc: 'Bypass moving shields & barriers (Reach Level 5)',
          icon: '🛡️',
          reward: 200,
          isUnlocked: unlockedLevel >= 5,
        },
        {
          id: 'gunslinger_ace',
          title: 'Gunslinger Ace',
          desc: 'Defeat Twin CPU Enemies (Reach Level 15)',
          icon: '⭐',
          reward: 300,
          isUnlocked: unlockedLevel >= 15,
        },
        {
          id: 'duel_legend',
          title: 'Duel Legend',
          desc: 'Conquer the Grand Championship (Reach Level 50)',
          icon: '👑',
          reward: 500,
          isUnlocked: unlockedLevel >= 50,
        },
      ];

      return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-sm max-h-[92dvh] overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-400/60 rounded-3xl p-4 sm:p-6 shadow-[0_0_50px_rgba(251,191,36,0.3)] flex flex-col gap-3.5 sm:gap-4 text-white relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow">
                  <i className="fa-solid fa-trophy text-sm" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black font-serif tracking-wider text-amber-300">
                    CAREER & TROPHIES
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                    PLAYER MILESTONES & REWARDS
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  playSound('click', soundOn);
                  setIsTrophyOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-500/30 text-slate-400 hover:text-red-400 flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Unlocked</span>
                <span className="text-base sm:text-lg font-black text-amber-400 font-mono mt-0.5">
                  Stage {localStorage.getItem('pistol_duel_unlocked_level') || '50'} / 50
                </span>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Total Coins</span>
                <span className="text-base sm:text-lg font-black text-yellow-400 font-mono mt-0.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-coins text-amber-400 text-sm" /> {coins}
                </span>
              </div>
            </div>

            {/* Milestones List with Functional Claim Rewards */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                Milestones & Coin Rewards
              </span>
              {MILESTONES.map((m) => {
                const isClaimed = claimedTrophies.includes(m.id);
                const canClaim = m.isUnlocked && !isClaimed;

                return (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between transition-all ${
                      isClaimed
                        ? 'bg-slate-900/60 border-white/10 opacity-75'
                        : canClaim
                        ? 'bg-amber-500/15 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : 'bg-slate-950/40 border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-xl flex-shrink-0">{m.icon}</span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold truncate ${canClaim ? 'text-amber-300' : 'text-slate-200'}`}>
                            {m.title}
                          </span>
                          <span className="text-[10px] font-mono text-amber-400 font-bold flex-shrink-0">
                            +{m.reward} <i className="fa-solid fa-coins text-[9px]" />
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 truncate">{m.desc}</span>
                      </div>
                    </div>

                    {/* Functional Action Button */}
                    {isClaimed ? (
                      <span className="text-[10px] font-mono font-black px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 border border-white/10 flex-shrink-0">
                        CLAIMED ✓
                      </span>
                    ) : canClaim ? (
                      <button
                        onClick={() => handleClaimTrophy(m.id, m.reward)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-[10px] uppercase font-mono tracking-wider shadow-lg shadow-amber-500/30 active:scale-95 cursor-pointer flex-shrink-0 animate-pulse"
                      >
                        CLAIM
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-xl bg-slate-900 text-slate-500 border border-white/5 flex-shrink-0">
                        LOCKED
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                playSound('click', soundOn);
                setIsTrophyOpen(false);
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer mt-1"
            >
              CLOSE
            </button>
          </div>
        </div>
      );
    })()}

    {/* ═════════════════════════════════════════════════════════════════════
        6. TACTICAL ARMOR & PERKS MODAL (Functional Upgrade & Gear Shop)
        ═════════════════════════════════════════════════════════════════════ */}
    {isArmorOpen && (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-[fadeIn_0.2s_ease-out]">
        <div className="w-full max-w-sm max-h-[92dvh] overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-cyan-400/60 rounded-3xl p-4 sm:p-6 shadow-[0_0_50px_rgba(6,182,212,0.3)] flex flex-col gap-3.5 sm:gap-4 text-white relative">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow">
                <svg className="w-5 h-5 text-cyan-300" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 2a2 2 0 0 0-2 2v2.5a2 2 0 0 0 .58 1.41L7 9.33V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9.33l1.42-1.42A2 2 0 0 0 19 6.5V4a2 2 0 0 0-2-2h-3a2 2 0 0 1-4 0H7zm2 4a3.99 3.99 0 0 0 6 0v2.17l-1 1V10a1 1 0 0 0-2 0v-.5h-2V10a1 1 0 0 0-2 0V9.17l-1-1V6zm0 5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.5zm0 4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black font-serif tracking-wider text-cyan-300">
                  TACTICAL ARMOR
                </h3>
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  DEFENSIVE GEAR & UPGRADES
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                playSound('click', soundOn);
                setIsArmorOpen(false);
              }}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-500/30 text-slate-400 hover:text-red-400 flex items-center justify-center transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>

          {/* Tactical Gear & Upgrades List */}
          <div className="flex flex-col gap-2.5">
            {/* Perk 1: Kevlar Vest */}
            <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="text-2xl flex-shrink-0">🦺</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-cyan-200">
                      {vestLevel >= 2 ? 'Kevlar Vest MK-II' : 'Kevlar Vest MK-I'}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 font-extrabold">
                      {vestLevel >= 2 ? '5 HEARTS' : '4 HEARTS'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {vestLevel >= 2 ? 'Reinforced ballistic plating (5 HP)' : 'Upgrade to 5 Hearts capacity'}
                  </div>
                </div>
              </div>

              {vestLevel >= 2 ? (
                <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-xl border border-cyan-400/40 flex-shrink-0">
                  EQUIPPED ✓
                </span>
              ) : (
                <button
                  onClick={handleUpgradeVest}
                  disabled={coins < 250}
                  className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase font-mono tracking-wider transition active:scale-95 cursor-pointer flex-shrink-0 ${
                    coins >= 250
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  250 <i className="fa-solid fa-coins text-[9px]" /> UPGRADE
                </button>
              )}
            </div>

            {/* Perk 2: Tactical Laser Aim Sight */}
            <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="text-2xl flex-shrink-0">🎯</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-cyan-200">Laser Aim Sight</span>
                    {hasLaserSight && (
                      <span className="text-[9px] font-mono text-emerald-400 font-extrabold">ACTIVE</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Precision dashed laser guide from barrel
                  </div>
                </div>
              </div>

              {hasLaserSight ? (
                <button
                  onClick={handleToggleLaserSight}
                  className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-black transition cursor-pointer flex-shrink-0"
                >
                  ACTIVE ✓
                </button>
              ) : (
                <button
                  onClick={handleToggleLaserSight}
                  disabled={coins < 150}
                  className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase font-mono tracking-wider transition active:scale-95 cursor-pointer flex-shrink-0 ${
                    coins >= 150
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  150 <i className="fa-solid fa-coins text-[9px]" /> UNLOCK
                </button>
              )}
            </div>

            {/* Perk 3: Tactical Revive Shield */}
            <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="text-2xl flex-shrink-0">🛡️</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-cyan-200">
                      {reviveLevel >= 2 ? 'Titanium Revive Shield' : 'Tactical Revive Shield'}
                    </span>
                    <span className="text-[10px] font-mono text-amber-400 font-extrabold">
                      {reviveLevel >= 2 ? '4.5s SHIELD' : '2.5s SHIELD'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {reviveLevel >= 2 ? 'Extended recovery invulnerability' : 'Standard 2.5s emergency shield'}
                  </div>
                </div>
              </div>

              {reviveLevel >= 2 ? (
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-xl border border-amber-400/40 flex-shrink-0">
                  ACTIVE (4.5s) ✓
                </span>
              ) : (
                <button
                  onClick={handleUpgradeRevive}
                  disabled={coins < 200}
                  className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase font-mono tracking-wider transition active:scale-95 cursor-pointer flex-shrink-0 ${
                    coins >= 200
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  200 <i className="fa-solid fa-coins text-[9px]" /> UPGRADE
                </button>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={() => {
              playSound('click', soundOn);
              setIsArmorOpen(false);
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-600 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/25 active:scale-95 cursor-pointer mt-1"
          >
            EQUIP & CLOSE
          </button>
        </div>
      </div>
    )}
  </div>
);
}
