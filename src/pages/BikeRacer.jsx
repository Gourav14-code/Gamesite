import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

// ── Superbike Engine Audio ─────────────────────────────────────────────────
class BikeAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterCompressor = null;
    this.masterGain = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.oscFundamental = null;
    this.oscSub = null;
    this.oscHarmonic = null;
    this.windGain = null;
    this.windSource = null;
    this.windFilter = null;
    this.currentFreq = 50;
    this.currentRpm = 0.1;
    this.isMuted = false;
    this.activeSfxNodes = new Set();
    this.activeCrashNodes = new Set();
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();

      // Master bus with compression to prevent digital clipping, distortion, and harsh peaks
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.value = -12;
      this.masterCompressor.knee.value = 30;
      this.masterCompressor.ratio.value = 12;
      this.masterCompressor.attack.value = 0.003;
      this.masterCompressor.release.value = 0.25;
      this.masterCompressor.connect(this.ctx.destination);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.78;
      this.masterGain.connect(this.masterCompressor);

      // Lowpass acoustic exhaust muffler filter (gives deep, throaty exhaust rumble, eliminates piercing highs)
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 240; // warm idle exhaust cutoff
      this.engineFilter.Q.value = 0.95;        // acoustic muffler damping, no sharp shrill peaks

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.001; // start silent until update

      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      // Balanced 3-Oscillator heavy exhaust sound design:
      // 1. Primary cylinder combustion pulse (sawtooth, smoothed by lowpass)
      this.oscFundamental = this.ctx.createOscillator();
      this.oscFundamental.type = 'sawtooth';
      const gainFund = this.ctx.createGain();
      gainFund.gain.value = 0.28;
      this.oscFundamental.connect(gainFund);
      gainFund.connect(this.engineFilter);

      // 2. Sub-harmonic exhaust body rumble (triangle, 0.5x pitch) - deep bass thump
      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = 'triangle';
      const gainSub = this.ctx.createGain();
      gainSub.gain.value = 0.62;
      this.oscSub.connect(gainSub);
      gainSub.connect(this.engineFilter);

      // 3. Exhaust cylinder throbbing pulse (triangle at 1.0x pitch with subtle 1.2Hz detune for natural exhaust rumble)
      this.oscHarmonic = this.ctx.createOscillator();
      this.oscHarmonic.type = 'triangle';
      const gainHarm = this.ctx.createGain();
      gainHarm.gain.value = 0.12;
      this.oscHarmonic.connect(gainHarm);
      gainHarm.connect(this.engineFilter);

      this.oscFundamental.start();
      this.oscSub.start();
      this.oscHarmonic.start();

      // Atmospheric high-speed wind noise buffer (speeds > 80 km/h)
      const sz = this.ctx.sampleRate * 2;
      const nb = this.ctx.createBuffer(1, sz, this.ctx.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = nb;
      this.windSource.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 750;
      this.windFilter.Q.value = 1.0;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.0001;

      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      this.windSource.start();

      this.currentFreq = 38;
      this.currentRpm = 0.1;
      this.isMuted = false;
    } catch (e) {
      console.warn('Bike audio init warning:', e);
    }
  }

  update(spd, accel, brake, nitro, gear = 0, rpmRatio = 0, isLevelComplete = false) {
    if (!this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const now = this.ctx.currentTime;

      // When level is complete, drop engine sound down suddenly to calm idle purr
      if (isLevelComplete) {
        this.engineGain.gain.setTargetAtTime(0.012, now, 0.08);
        this.oscFundamental.frequency.setTargetAtTime(38, now, 0.08);
        this.oscSub.frequency.setTargetAtTime(19, now, 0.08);
        this.oscHarmonic.frequency.setTargetAtTime(39.2, now, 0.08);
        this.engineFilter.frequency.setTargetAtTime(220, now, 0.08);
        if (this.windGain) this.windGain.gain.setTargetAtTime(0.0001, now, 0.05);
        return;
      }

      const ratio = Math.min(1, Math.max(0, spd / 245));

      // Calculate target engine RPM and firing frequency smoothly
      // Idle is ~38 Hz fundamental. Redline in top gear reaches ~145 Hz (rich deep throaty growl, never shrill)
      const g = Math.min(4, Math.max(0, gear));
      const targetRpm = Math.min(1, Math.max(0, rpmRatio));

      // Continuous frequency formula tailored for heavy exhaust rumble
      const idleFreq = 38;
      const gearBase = g * 7.5;
      const revRange = 75 + (nitro ? 18 : 0);
      const targetFreq = idleFreq + gearBase + targetRpm * revRange;

      // Smooth inertia: filter frequency changes so throttle taps or gear shifts never click or glitch
      this.currentFreq += (targetFreq - this.currentFreq) * 0.18;
      const f = Math.max(36, this.currentFreq);

      // Pitch updates: fundamental, 0.5x sub-bass rumble, and natural slight-detune exhaust throb
      this.oscFundamental.frequency.setTargetAtTime(f, now, 0.04);
      this.oscSub.frequency.setTargetAtTime(f * 0.5, now, 0.04);
      this.oscHarmonic.frequency.setTargetAtTime(f + 1.2, now, 0.04);

      // Exhaust muffler acoustic lowpass: clamped at max 1150 Hz to totally avoid ear pinching
      const baseCutoff = 220 + targetRpm * 580 + (accel ? 180 : 0) + (nitro ? 220 : 0);
      this.engineFilter.frequency.setTargetAtTime(Math.min(1150, baseCutoff), now, 0.05);

      // Volume scaling: pleasant idle rumble, deep throaty roar under load, never deafening
      let targetVol = 0.045 + ratio * 0.10 + (accel ? 0.04 : 0) + (nitro ? 0.055 : 0);
      if (brake) targetVol *= 0.72;
      this.engineGain.gain.setTargetAtTime(targetVol, now, 0.05);

      // Wind noise scaling (inaudible at low speed, swooshes realistically at high speed)
      const windVol = ratio > 0.15 ? Math.pow(ratio, 2.2) * 0.12 : 0.0001;
      this.windGain.gain.setTargetAtTime(windVol, now, 0.06);
    } catch {}
  }

  stopEngine() {
    this.isMuted = true;
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.engineGain) {
        this.engineGain.gain.cancelScheduledValues(now);
        this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
        this.engineGain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
      }
      if (this.windGain) {
        this.windGain.gain.cancelScheduledValues(now);
        this.windGain.gain.setValueAtTime(this.windGain.gain.value, now);
        this.windGain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
      }
    } catch {}
  }

  stopCrashSound() {
    if (this.activeCrashNodes.size > 0) {
      this.activeCrashNodes.forEach(item => {
        try {
          if (item.node && item.node.stop) item.node.stop();
          if (item.node && item.node.disconnect) item.node.disconnect();
          if (item.gain && item.gain.disconnect) item.gain.disconnect();
        } catch {}
      });
      this.activeCrashNodes.clear();
    }
  }

  reset() {
    this.stopCrashSound();
    this.isMuted = false;
    this.currentFreq = 38;
    this.currentRpm = 0.1;
    if (this.ctx && this.engineGain) {
      try {
        const now = this.ctx.currentTime;
        this.engineGain.gain.cancelScheduledValues(now);
        this.engineGain.gain.setValueAtTime(0.001, now);
        if (this.windGain) {
          this.windGain.gain.cancelScheduledValues(now);
          this.windGain.gain.setValueAtTime(0.0001, now);
        }
      } catch {}
    }
  }

  levelCompleteDown() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.engineGain) {
        this.engineGain.gain.cancelScheduledValues(now);
        this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
        this.engineGain.gain.linearRampToValueAtTime(0.012, now + 0.25);
      }
      if (this.oscFundamental) {
        this.oscFundamental.frequency.cancelScheduledValues(now);
        this.oscFundamental.frequency.setValueAtTime(this.oscFundamental.frequency.value, now);
        this.oscFundamental.frequency.exponentialRampToValueAtTime(38, now + 0.25);
      }
      if (this.engineFilter) {
        this.engineFilter.frequency.cancelScheduledValues(now);
        this.engineFilter.frequency.setValueAtTime(this.engineFilter.frequency.value, now);
        this.engineFilter.frequency.linearRampToValueAtTime(220, now + 0.25);
      }
      if (this.windGain) {
        this.windGain.gain.cancelScheduledValues(now);
        this.windGain.gain.setValueAtTime(this.windGain.gain.value, now);
        this.windGain.gain.linearRampToValueAtTime(0.0001, now + 0.15);
      }
    } catch {}
  }

  playLevelVictory() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const now = this.ctx.currentTime;

      // ── 1. Triumphant Fanfare Arpeggio (C5 -> E5 -> G5 -> C6) ──
      const fanfareNotes = [
        { f: 523.25, t: 0.00, d: 0.22, g: 0.22 },
        { f: 659.25, t: 0.14, d: 0.22, g: 0.24 },
        { f: 783.99, t: 0.28, d: 0.25, g: 0.26 },
        { f: 1046.50, t: 0.44, d: 0.75, g: 0.32 },
        { f: 1318.51, t: 0.52, d: 0.68, g: 0.20 },
      ];

      fanfareNotes.forEach(({ f, t, d, g }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0.0001, now + t);
        gain.gain.linearRampToValueAtTime(g, now + t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
        osc.connect(gain);
        gain.connect(this.masterGain);

        const item = { node: osc, gain };
        this.activeSfxNodes.add(item);
        osc.onended = () => {
          try { osc.disconnect(); gain.disconnect(); } catch {}
          this.activeSfxNodes.delete(item);
        };
        osc.start(now + t);
        osc.stop(now + t + d);
      });

      // ── 2. Joyful Stadium Crowd Cheer ("Hurray!" Roar) ──
      const cheerDur = 2.0;
      const cheerSz = Math.floor(this.ctx.sampleRate * cheerDur);
      const cheerBuf = this.ctx.createBuffer(1, cheerSz, this.ctx.sampleRate);
      const data = cheerBuf.getChannelData(0);
      for (let i = 0; i < cheerSz; i++) {
        const env = Math.sin((i / cheerSz) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * Math.pow(env, 0.6);
      }
      const cheerSource = this.ctx.createBufferSource();
      cheerSource.buffer = cheerBuf;

      const cheerFilter = this.ctx.createBiquadFilter();
      cheerFilter.type = 'bandpass';
      cheerFilter.frequency.setValueAtTime(780, now);
      cheerFilter.frequency.linearRampToValueAtTime(1150, now + 0.6);
      cheerFilter.frequency.linearRampToValueAtTime(850, now + cheerDur);
      cheerFilter.Q.value = 1.8;

      const cheerGain = this.ctx.createGain();
      cheerGain.gain.setValueAtTime(0.0001, now + 0.1);
      cheerGain.gain.linearRampToValueAtTime(0.38, now + 0.45);
      cheerGain.gain.linearRampToValueAtTime(0.0001, now + cheerDur);

      cheerSource.connect(cheerFilter);
      cheerFilter.connect(cheerGain);
      cheerGain.connect(this.masterGain);

      const cheerItem = { node: cheerSource, gain: cheerGain };
      this.activeSfxNodes.add(cheerItem);
      cheerSource.onended = () => {
        try { cheerSource.disconnect(); cheerFilter.disconnect(); cheerGain.disconnect(); } catch {}
        this.activeSfxNodes.delete(cheerItem);
      };
      cheerSource.start(now + 0.1);
      cheerSource.stop(now + cheerDur);

      // ── 3. Celebratory Stadium Whistle ──
      const whistleOsc = this.ctx.createOscillator();
      const whistleGain = this.ctx.createGain();
      whistleOsc.type = 'sine';
      whistleOsc.frequency.setValueAtTime(1400, now + 0.35);
      whistleOsc.frequency.linearRampToValueAtTime(2350, now + 0.55);
      whistleOsc.frequency.linearRampToValueAtTime(1900, now + 0.85);

      whistleGain.gain.setValueAtTime(0.0001, now + 0.35);
      whistleGain.gain.linearRampToValueAtTime(0.14, now + 0.42);
      whistleGain.gain.linearRampToValueAtTime(0.0001, now + 0.85);

      whistleOsc.connect(whistleGain);
      whistleGain.connect(this.masterGain);

      const whistleItem = { node: whistleOsc, gain: whistleGain };
      this.activeSfxNodes.add(whistleItem);
      whistleOsc.onended = () => {
        try { whistleOsc.disconnect(); whistleGain.disconnect(); } catch {}
        this.activeSfxNodes.delete(whistleItem);
      };
      whistleOsc.start(now + 0.35);
      whistleOsc.stop(now + 0.85);

      // ── 4. Voice Callout ("Hurray! Level Complete!") ──
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance('Hurray! Level complete!');
          utter.rate = 1.08;
          utter.pitch = 1.25;
          utter.volume = 0.9;
          window.speechSynthesis.speak(utter);
        } catch {}
      }
    } catch (e) {
      console.warn('Victory cheer audio error:', e);
    }
  }

  playCountdownBeep(isFinal = false) {
    if (!this.ctx) {
      this.init();
      if (!this.ctx) return;
    }
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isFinal ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isFinal ? 880 : 440, now);
      if (isFinal) {
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.22);
      }
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(isFinal ? 0.35 : 0.22, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.45 : 0.2));
      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + (isFinal ? 0.5 : 0.25));
    } catch {}
  }

  playCrash() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      // 1. Immediately cut engine and stop any previous crash sound
      this.stopEngine();
      this.stopCrashSound();

      const now = this.ctx.currentTime;
      const dur = 0.85;

      // ── Low-End Impact Punch (Oscillator Drop) ──
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(26, now + dur * 0.7);

      oscGain.gain.setValueAtTime(0.55, now);
      oscGain.gain.linearRampToValueAtTime(0.0001, now + dur);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain);

      // ── Metal Crunch & Pavement Skid Impact Noise ──
      const noiseSz = Math.floor(this.ctx.sampleRate * dur);
      const noiseBuffer = this.ctx.createBuffer(1, noiseSz, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseSz; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.18));
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(950, now);
      noiseFilter.frequency.linearRampToValueAtTime(280, now + dur);
      noiseFilter.Q.value = 1.4;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.48, now);
      noiseGain.gain.linearRampToValueAtTime(0.0001, now + dur);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      // Track active crash sound nodes for immediate cleanup/cancellation
      const oscItem = { node: osc, gain: oscGain };
      const noiseItem = { node: noiseSource, gain: noiseGain };
      this.activeCrashNodes.add(oscItem);
      this.activeCrashNodes.add(noiseItem);

      osc.onended = () => {
        try { osc.disconnect(); oscGain.disconnect(); } catch {}
        this.activeCrashNodes.delete(oscItem);
      };
      noiseSource.onended = () => {
        try { noiseSource.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect(); } catch {}
        this.activeCrashNodes.delete(noiseItem);
      };

      osc.start(now);
      osc.stop(now + dur);
      noiseSource.start(now);
      noiseSource.stop(now + dur);
    } catch (e) {
      console.warn('Crash audio error:', e);
    }
  }

  playGlassShatter() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const now = this.ctx.currentTime;
      const dur = 0.45;

      const sz = Math.floor(this.ctx.sampleRate * dur);
      const nb = this.ctx.createBuffer(1, sz, this.ctx.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < sz; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.055));
      }

      const ns = this.ctx.createBufferSource();
      ns.buffer = nb;

      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2400;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.28, now);
      g.gain.linearRampToValueAtTime(0.0001, now + dur);

      ns.connect(f);
      f.connect(g);
      g.connect(this.masterGain);

      const glassItem = { node: ns, gain: g };
      this.activeCrashNodes.add(glassItem);

      ns.onended = () => {
        try { ns.disconnect(); f.disconnect(); g.disconnect(); } catch {}
        this.activeCrashNodes.delete(glassItem);
      };

      ns.start(now);
      ns.stop(now + dur);
    } catch {}
  }

  playCountdownBeep(isFinal = false) {
    if (!this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      if (!isFinal) {
        // High, crisp arcade countdown beep (880Hz A5)
        this._sfx(880, 'sine', 0.24, 0.16);
      } else {
        // High triumphant GO chime / double tone (1320Hz + 1760Hz)
        this._sfx(1320, 'triangle', 0.28, 0.35);
        setTimeout(() => {
          this._sfx(1760, 'sine', 0.25, 0.45);
        }, 60);
      }
    } catch {}
  }

  playBrakeSqueal() {
    this._sfx(2200 + Math.random() * 300, 'sine', 0.06, 0.28);
  }

  playNitro() {
    this._ramp(130, 480, 'sawtooth', 0.16, 0.5);
  }

  playHorn() {
    this._sfx(440, 'sine', 0.22, 0.35);
    this._sfx(554, 'sine', 0.22, 0.35);
  }

  playCoin() {
    if (!this.ctx) return;
    try {
      this._sfx(988, 'sine', 0.12, 0.1);
      setTimeout(() => {
        this._sfx(1318, 'triangle', 0.14, 0.18);
      }, 50);
    } catch {}
  }

  _sfx(freq, type, gain, dur) {
    if (!this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(gain, now);
      g.gain.linearRampToValueAtTime(0.0001, now + dur);
      o.connect(g);
      g.connect(this.masterGain || this.ctx.destination);

      const item = { node: o, gain: g };
      this.activeSfxNodes.add(item);
      o.onended = () => {
        try { o.disconnect(); g.disconnect(); } catch {}
        this.activeSfxNodes.delete(item);
      };

      o.start(now);
      o.stop(now + dur);
    } catch {}
  }

  _ramp(f0, f1, type, gain, dur) {
    if (!this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, now);
      o.frequency.linearRampToValueAtTime(f1, now + dur * 0.7);
      g.gain.setValueAtTime(gain, now);
      g.gain.linearRampToValueAtTime(0.0001, now + dur);
      o.connect(g);
      g.connect(this.masterGain || this.ctx.destination);

      const item = { node: o, gain: g };
      this.activeSfxNodes.add(item);
      o.onended = () => {
        try { o.disconnect(); g.disconnect(); } catch {}
        this.activeSfxNodes.delete(item);
      };

      o.start(now);
      o.stop(now + dur);
    } catch {}
  }

  stop() {
    this.stopCrashSound();
    if (this.activeSfxNodes.size > 0) {
      this.activeSfxNodes.forEach(item => {
        try {
          if (item.node && item.node.stop) item.node.stop();
          if (item.node && item.node.disconnect) item.node.disconnect();
          if (item.gain && item.gain.disconnect) item.gain.disconnect();
        } catch {}
      });
      this.activeSfxNodes.clear();
    }
    try {
      if (this.oscFundamental) { this.oscFundamental.stop(); this.oscFundamental.disconnect(); }
      if (this.oscSub) { this.oscSub.stop(); this.oscSub.disconnect(); }
      if (this.oscHarmonic) { this.oscHarmonic.stop(); this.oscHarmonic.disconnect(); }
      if (this.windSource) { this.windSource.stop(); this.windSource.disconnect(); }
      if (this.ctx) this.ctx.close();
    } catch {}
    this.ctx = null;
    this.oscFundamental = null;
    this.oscSub = null;
    this.oscHarmonic = null;
    this.windSource = null;
    this.masterGain = null;
    this.engineGain = null;
  }
}

// ── Procedural Asphalt PBR Textures ─────────────────────────────────────────
function makeAsphaltTextures() {
  // Diffuse
  const c = document.createElement('canvas'); c.width=2048; c.height=1024;
  const cx = c.getContext('2d');
  cx.fillStyle = '#1e2124'; cx.fillRect(0,0,2048,1024);
  // Stone grain
  const id = cx.getImageData(0,0,2048,1024);
  for(let i=0;i<id.data.length;i+=4){
    const g=(Math.random()-0.5)*28; id.data[i]+=g; id.data[i+1]+=g; id.data[i+2]+=g;
  }
  cx.putImageData(id,0,0);
  // Tire rubber wear tracks (4 lanes)
  [0.15,0.38,0.62,0.85].forEach(lp=>{
    const lx=lp*2048;
    [-55,55].forEach(off=>{
      const gr=cx.createLinearGradient(lx+off-40,0,lx+off+40,0);
      gr.addColorStop(0,'rgba(8,10,14,0)'); gr.addColorStop(.5,'rgba(8,10,14,.42)'); gr.addColorStop(1,'rgba(8,10,14,0)');
      cx.fillStyle=gr; cx.fillRect(lx+off-40,0,80,1024);
    });
  });
  // Shoulder lines (yellow)
  cx.fillStyle='#f59e0b';
  cx.fillRect(0.042*2048,0,20,1024); cx.fillRect(0.958*2048-20,0,20,1024);
  // Centre double yellow
  cx.fillStyle='#f59e0b';
  cx.fillRect(0.497*2048,0,10,1024); cx.fillRect(0.503*2048,0,10,1024);
  // White dashes
  [0.27,0.73].forEach(p=>{
    const lx=p*2048;
    for(let y=0;y<1024;y+=168){
      cx.fillStyle='rgba(8,10,14,.4)'; cx.fillRect(lx-8,y+2,16,96);
      cx.fillStyle='#ffffff'; cx.fillRect(lx-8,y,16,96);
      cx.fillStyle='rgba(255,255,255,.7)'; cx.fillRect(lx-4,y+4,8,88);
    }
  });

  const diffuse = new THREE.CanvasTexture(c);
  diffuse.wrapS=diffuse.wrapT=THREE.RepeatWrapping; diffuse.repeat.set(1,16);
  diffuse.generateMipmaps = true;
  diffuse.minFilter = THREE.LinearMipmapLinearFilter;
  diffuse.magFilter = THREE.LinearFilter;
  diffuse.anisotropy = 16;

  // Normal
  const nc=document.createElement('canvas'); nc.width=512; nc.height=256;
  const ncx=nc.getContext('2d');
  ncx.fillStyle='rgb(128,128,255)'; ncx.fillRect(0,0,512,256);
  const ni=ncx.getImageData(0,0,512,256);
  for(let i=0;i<ni.data.length;i+=4){ const b=(Math.random()-.5)*36; ni.data[i]+=b; ni.data[i+1]+=b; ni.data[i+2]=255; }
  ncx.putImageData(ni,0,0);
  const normal = new THREE.CanvasTexture(nc);
  normal.wrapS=normal.wrapT=THREE.RepeatWrapping; normal.repeat.set(1,16);

  // Roughness
  const rc=document.createElement('canvas'); rc.width=512; rc.height=256;
  const rcx=rc.getContext('2d'); rcx.fillStyle='#c8c8c8'; rcx.fillRect(0,0,512,256);
  const roughness = new THREE.CanvasTexture(rc);
  roughness.wrapS=roughness.wrapT=THREE.RepeatWrapping; roughness.repeat.set(1,16);

  return { diffuse, normal, roughness };
}

// ── Circular Radial Gradient Textures ────────────────────────────────────────
function makeRadialTex(w=256,stops) {
  const c=document.createElement('canvas'); c.width=w; c.height=w;
  const cx=c.getContext('2d');
  const g=cx.createRadialGradient(w/2,w/2,w*0.07,w/2,w/2,w*0.48);
  stops.forEach(([t,col])=>g.addColorStop(t,col));
  cx.fillStyle=g; cx.fillRect(0,0,w,w);
  return new THREE.CanvasTexture(c);
}

// ── Checkered Finish Line & Gantry Textures ─────────────────────────────────
function makeFinishLineTextures() {
  // Road checkered surface strip
  const cRoad = document.createElement('canvas'); cRoad.width = 1024; cRoad.height = 128;
  const cxR = cRoad.getContext('2d');
  const sq = 32;
  for(let x = 0; x < 1024; x += sq) {
    for(let y = 0; y < 128; y += sq) {
      cxR.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#ffffff' : '#111317';
      cxR.fillRect(x, y, sq, sq);
    }
  }
  const roadTex = new THREE.CanvasTexture(cRoad);
  roadTex.wrapS = THREE.RepeatWrapping; roadTex.repeat.set(4, 1);

  // Overhead gantry banner
  const cBan = document.createElement('canvas'); cBan.width = 1024; cBan.height = 256;
  const cxB = cBan.getContext('2d');
  const bg = cxB.createLinearGradient(0, 0, 1024, 0);
  bg.addColorStop(0, '#0a0d14'); bg.addColorStop(0.5, '#1e2538'); bg.addColorStop(1, '#0a0d14');
  cxB.fillStyle = bg; cxB.fillRect(0, 0, 1024, 256);
  // Checkered border top & bottom
  for(let x = 0; x < 1024; x += 32) {
    cxB.fillStyle = (x / 32) % 2 === 0 ? '#f59e0b' : '#ffffff';
    cxB.fillRect(x, 0, 32, 28);
    cxB.fillRect(x, 228, 32, 28);
  }
  // Bold Finish Line text
  cxB.fillStyle = '#ffffff';
  cxB.font = '900 80px Impact, "Arial Black", sans-serif';
  cxB.textAlign = 'center';
  cxB.textBaseline = 'middle';
  cxB.shadowColor = '#f59e0b';
  cxB.shadowBlur = 20;
  cxB.fillText('🏁  FINISH LINE  🏁', 512, 128);
  const bannerTex = new THREE.CanvasTexture(cBan);

  // Checkered flag texture
  const cFlag = document.createElement('canvas'); cFlag.width = 256; cFlag.height = 160;
  const cxF = cFlag.getContext('2d');
  const fsq = 20;
  for(let x = 0; x < 256; x += fsq) {
    for(let y = 0; y < 160; y += fsq) {
      cxF.fillStyle = ((x / fsq + y / fsq) % 2 === 0) ? '#ffffff' : '#0f172a';
      cxF.fillRect(x, y, fsq, fsq);
    }
  }
  const flagTex = new THREE.CanvasTexture(cFlag);

  return { roadTex, bannerTex, flagTex };
}


// ── Detailed Rider Model in Race Tuck ─────────────────────────────────────────
function makeRider() {
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({color:'#1a2035',roughness:.65,metalness:.15});
  const carbon  = new THREE.MeshStandardMaterial({color:'#0d1120',roughness:.3,metalness:.85});
  const visor   = new THREE.MeshPhysicalMaterial({color:'#1565c0',clearcoat:1,clearcoatRoughness:.02,metalness:.95,roughness:.06});
  const accent  = new THREE.MeshStandardMaterial({color:'#c62828',roughness:.45,metalness:.25});

  // Head / Helmet
  const head = new THREE.Mesh(new THREE.SphereGeometry(.18,18,18), new THREE.MeshPhysicalMaterial({color:'#0d0d14',clearcoat:1,clearcoatRoughness:.06,metalness:.6,roughness:.18}));
  head.scale.set(.88,1.04,1.12); head.position.set(0,1.3,-.2); head.rotation.x=.28; head.castShadow=true;
  g.add(head);
  const vis = new THREE.Mesh(new THREE.CylinderGeometry(.155,.155,.085,16,1,false,0,Math.PI), visor);
  vis.rotation.x=Math.PI/2+.3; vis.position.set(0,1.3,-.32);
  g.add(vis);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(.17,.05,.11), carbon);
  spoiler.position.set(0,1.37,-.09); spoiler.rotation.x=-.3;
  g.add(spoiler);

  // Sleek Aerodynamic Racing Torso (crouched forward over tank)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.32, .48, .22), leather);
  torso.rotation.x=1.05; torso.position.set(0,1.04,.02); torso.castShadow=true;
  g.add(torso);
  const hump = new THREE.Mesh(new THREE.BoxGeometry(.14,.10,.28), carbon);
  hump.position.set(0,1.18,-.02); hump.rotation.x=1.05;
  g.add(hump);

  // Shoulders
  [-0.23,0.23].forEach(sx=>{
    const sh = new THREE.Mesh(new THREE.SphereGeometry(.095,10,10), carbon);
    sh.position.set(sx,1.18,-.1);
    g.add(sh);
    const str = new THREE.Mesh(new THREE.BoxGeometry(.04,.07,.2), accent);
    str.position.set(sx*.95,1.14,-.04); str.rotation.x=1.05;
    g.add(str);
  });

  // Arms
  [-0.24,0.24].forEach(ax=>{
    const L = ax<0;
    const ua = new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,.32,10), leather);
    ua.position.set(ax*1.1,1.05,-.2); ua.rotation.set(.7,L?.33:-.33,L?-.43:.43);
    g.add(ua);
    const fa = new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.3,10), leather);
    fa.position.set(ax*1.04,.91,-.4); fa.rotation.set(1.2,L?.18:-.18,L?-.18:.18);
    g.add(fa);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(.1,.07,.1), carbon);
    gl.position.set(ax*.94,.83,-.55);
    g.add(gl);
  });

  // Legs
  [-0.21,0.21].forEach(lx=>{
    const L = lx<0;
    const th = new THREE.Mesh(new THREE.CylinderGeometry(.085,.105,.42,10), leather);
    th.position.set(lx*1.22,.83,.1); th.rotation.set(1.38,L?.18:-.18,0);
    g.add(th);
    const kn = new THREE.Mesh(new THREE.BoxGeometry(.05,.08,.07), carbon);
    kn.position.set(lx*1.55,.8,-.04);
    g.add(kn);
    const ca = new THREE.Mesh(new THREE.CylinderGeometry(.065,.077,.36,10), leather);
    ca.position.set(lx*1.08,.66,.26); ca.rotation.set(-1.1,0,0);
    g.add(ca);
    const bt = new THREE.Mesh(new THREE.BoxGeometry(.075,.086,.17), carbon);
    bt.position.set(lx*1.04,.5,.4);
    g.add(bt);
  });

  return g;
}

// ── Shattered Mirror / Broken Glass Screen Edge Overlay ───────────────────────
// ── Subtle Realistic Corner Mirror Break Overlay ──────────────────────────────
function ShatteredMirrorOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden select-none">
      {/* 1. Subtle, gentle corner vignette (100% transparent in center) */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 72%, rgba(2, 6, 23, 0.45) 100%)',
        }}
      />

      {/* 2. Realistic Hairline Corner Fractures & Translucent Glass Shards */}
      <svg
        className="w-full h-full absolute inset-0 filter drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]"
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cornerGlassSheen" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="50%" stopColor="rgba(224,242,254,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
          </linearGradient>

          <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Top-Right Corner Break (Realistic Mirror Fracture) ── */}
        <g filter="url(#subtleGlow)">
          {/* Corner glass shards */}
          <polygon points="945,0 1000,0 1000,55 972,42" fill="url(#cornerGlassSheen)" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2" />
          <polygon points="1000,55 1000,115 958,82 972,42" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.68)" strokeWidth="1.0" />
          <polygon points="885,0 945,0 972,42 918,34" fill="rgba(224,242,254,0.06)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.0" />

          {/* Impact origin micro-arcs */}
          <path d="M 960,34 Q 972,46 982,40" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3" />
          <path d="M 946,26 Q 966,54 990,48" fill="none" stroke="rgba(255,255,255,0.68)" strokeWidth="1.0" />

          {/* Hairline radiating crack lines staying strictly in corner */}
          <polyline points="972,42 928,24 864,10 815,0" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="1.2" strokeLinecap="round" />
          <polyline points="972,42 918,74 874,106 835,130" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth="1.1" strokeLinecap="round" />
          <polyline points="972,42 956,102 932,158 922,200" fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth="1.0" strokeLinecap="round" />
          
          {/* Delicate micro-branches */}
          <polyline points="918,74 922,118 908,150" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.8" />
          <polyline points="928,24 908,44 884,48" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.8" />
        </g>

        {/* ── Bottom-Left Corner Break (Subtle Secondary Impact) ── */}
        <g filter="url(#subtleGlow)">
          {/* Corner glass shards */}
          <polygon points="0,545 52,562 0,600" fill="url(#cornerGlassSheen)" stroke="rgba(255,255,255,0.72)" strokeWidth="1.2" />
          <polygon points="0,600 52,562 108,580 88,600" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.0" />

          {/* Impact micro-arc */}
          <path d="M 38,552 Q 52,565 62,556" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.1" />

          {/* Hairlines extending only along bottom-left corner */}
          <polyline points="48,565 86,532 138,512 185,502" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.1" strokeLinecap="round" />
          <polyline points="48,565 66,518 92,464 102,418" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.0" strokeLinecap="round" />
          <polyline points="86,532 110,546 134,554" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="0.8" />
        </g>

        {/* ── Top-Left Corner (Minimal Stress Fracture) ── */}
        <g filter="url(#subtleGlow)">
          <polygon points="0,0 42,0 24,24 0,18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.0" />
          <polyline points="0,32 42,22 86,8 115,0" fill="none" stroke="rgba(255,255,255,0.68)" strokeWidth="1.0" strokeLinecap="round" />
          <polyline points="42,22 56,52 70,80" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.8" />
        </g>

        {/* ── Bottom-Right Corner (Minimal Stress Fracture) ── */}
        <g filter="url(#subtleGlow)">
          <polygon points="975,600 1000,568 1000,600" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.0" />
          <polyline points="960,600 942,568 918,540 885,522" fill="none" stroke="rgba(255,255,255,0.62)" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

// ── 5-Gear Superbike Calibration (0→200 km/h in ~8 seconds) ───────────────────
const GEARS = [
  { shift:  42, redline:  55, torque: 46, engBrake: 50 }, // G1: 0–42 km/h in ~1.0s (strong launch)
  { shift:  82, redline:  98, torque: 34, engBrake: 40 }, // G2: 42–82 km/h in ~1.4s
  { shift: 128, redline: 145, torque: 27, engBrake: 32 }, // G3: 82–128 km/h in ~1.8s
  { shift: 172, redline: 190, torque: 22, engBrake: 25 }, // G4: 128–172 km/h in ~2.1s
  { shift: 245, redline: 260, torque: 18, engBrake: 18 }, // G5: 172–200 km/h in ~1.6s -> Total 0–200 in ~7.9s!
];

// ── Arcade 3D Curved Highway Track Dynamics ──────────────────────────────────
// Level 1 Track Curvature Profile (1000m Total):
//   0m–120m:   Launch Straightaway (0.0)
// 120m–360m:   Sweeping Right Turn (+0.75)
// 360m–520m:   High-Speed Straight (0.0)
// 520m–740m:   Thrilling Left Turn (-0.80)
// 740m–930m:   Arcade S-Curve Combo (Right -> Left flick)
// 930m–1000m:  Straight sprint to the Checkered Finish Line Gantry!
function getRoadCurveAt(dist) {
  const d = dist;
  if (d < 120) return 0;
  if (d < 360) {
    const t = (d - 120) / 240;
    return Math.sin(t * Math.PI) * 0.75;
  }
  if (d < 520) return 0;
  if (d < 740) {
    const t = (d - 520) / 220;
    return -Math.sin(t * Math.PI) * 0.80;
  }
  if (d < 930) {
    const t = (d - 740) / 190;
    return Math.sin(t * Math.PI * 2) * 0.85;
  }
  return 0;
}

// Parabolic lateral displacement at depth z relative to player
function getCurveOffset(z, playerDist) {
  if (z >= 10) return 0;
  const distAhead = Math.max(0, -z);
  const sampleDist = playerDist + distAhead * 0.65;
  const curvature = getRoadCurveAt(sampleDist);
  return curvature * (distAhead * distAhead * 0.0004);
}

// Tangent angle along curve (for car, gantry, and camera alignment)
function getCurveTangent(z, playerDist) {
  const z1 = z - 2;
  const z2 = z + 2;
  const x1 = getCurveOffset(z1, playerDist);
  const x2 = getCurveOffset(z2, playerDist);
  return Math.atan2(x1 - x2, 4);
}

// Procedural dynamic guardrail ribbon along highway edges
function makeGuardrailGeometry(side, segs, roadW, roadL) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((segs + 1) * 2 * 3);
  const uvs = new Float32Array((segs + 1) * 2 * 2);
  const idx = [];

  const xBase = side * (roadW / 2 + 0.25);
  for(let j = 0; j <= segs; j++) {
    const zWorld = (j / segs - 1) * roadL + 10;
    // Top vertex
    pos[(j * 2 + 0) * 3 + 0] = xBase;
    pos[(j * 2 + 0) * 3 + 1] = 0.68;
    pos[(j * 2 + 0) * 3 + 2] = zWorld;
    // Bottom vertex
    pos[(j * 2 + 1) * 3 + 0] = xBase;
    pos[(j * 2 + 1) * 3 + 1] = 0.24;
    pos[(j * 2 + 1) * 3 + 2] = zWorld;

    uvs[(j * 2 + 0) * 2 + 0] = (j / segs) * 20;
    uvs[(j * 2 + 0) * 2 + 1] = 1;
    uvs[(j * 2 + 1) * 2 + 0] = (j / segs) * 20;
    uvs[(j * 2 + 1) * 2 + 1] = 0;

    if(j < segs) {
      const a = j * 2 + 0;
      const b = j * 2 + 1;
      const c = (j + 1) * 2 + 0;
      const d = (j + 1) * 2 + 1;
      // When side < 0 (left guardrail), reverse winding so the front face points inward (+X) toward the road
      if (side < 0) {
        idx.push(a, c, b, b, c, d);
      } else {
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ── Related Games Catalog ───────────────────────────────────────────────────
const RELATED_GAMES = [
  { id: 0, title: 'Neon Duel Shot', category: 'Action', icon: 'fa-crosshairs', color: 'from-slate-700 to-indigo-900', rating: '99%' },
  { id: 3, title: 'Speed Racer 3D', category: 'Racing', icon: 'fa-car-side', color: 'from-blue-600 to-indigo-700', rating: '92%' },
  { id: 10, title: 'Super Bike Stunts', category: 'Racing', icon: 'fa-motorcycle', color: 'from-orange-500 to-red-600', rating: '90%' },
  { id: 12, title: 'Highway Moto', category: 'Racing', icon: 'fa-gauge-high', color: 'from-sky-500 to-blue-600', rating: '87%' },
  { id: 2, title: 'Subway Surfers', category: 'Arcade', icon: 'fa-person-running', color: 'from-emerald-500 to-teal-700', rating: '95%' },
  { id: 8, title: 'Zombie Survival', category: 'Action', icon: 'fa-biohazard', color: 'from-stone-700 to-slate-900', rating: '94%' },
  { id: 5, title: 'Slither Snake', category: 'Arcade', icon: 'fa-staff-snake', color: 'from-purple-600 to-pink-600', rating: '89%' },
  { id: 9, title: 'Fruit Ninja Slash', category: 'Arcade', icon: 'fa-apple-whole', color: 'from-lime-500 to-emerald-600', rating: '93%' },
];

// ── Confetti & Birthday Popper Celebration Effect ─────────────────────────────
function ConfettiPopper({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#a855f7', '#fbbf24', '#38bdf8', '#ec4899'];
    const particleCount = Math.min(130, Math.max(60, Math.floor(width / 8)));
    const particles = [];

    // Popper cannons: burst from bottom-left, bottom-right, and top-center
    for (let i = 0; i < particleCount; i++) {
      const mode = i % 3;
      let x, y, angle;
      if (mode === 0) {
        x = Math.random() * (width * 0.2);
        y = height - 20;
        angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.7;
      } else if (mode === 1) {
        x = width - Math.random() * (width * 0.2);
        y = height - 20;
        angle = (-3 * Math.PI) / 4 + (Math.random() - 0.5) * 0.7;
      } else {
        x = width * 0.5 + (Math.random() - 0.5) * (width * 0.4);
        y = Math.random() * 40;
        angle = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      }

      const speed = 11 + Math.random() * 18;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 8,
        h: 4 + Math.random() * 11,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 16,
        scaleX: 1,
        gravity: 0.32 + Math.random() * 0.16,
        drag: 0.982,
        opacity: 1,
        type: Math.random() > 0.4 ? 'ribbon' : Math.random() > 0.5 ? 'star' : 'circle',
      });
    }

    let animId;
    let startTime = Date.now();

    const render = () => {
      const elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, width, height);

      let alive = false;
      for (let p of particles) {
        p.vx *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.scaleX = Math.sin((p.rotation * Math.PI) / 180);

        if (elapsed > 2600) {
          p.opacity -= 0.014;
        }

        if (p.opacity > 0 && p.y < height + 60) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.scale(p.scaleX, 1);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;

          if (p.type === 'ribbon') {
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          } else if (p.type === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.w / 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.font = `${Math.round(p.w * 1.6)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);
          }
          ctx.restore();
        }
      }

      if (alive && elapsed < 6500) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-45 w-full h-full select-none"
    />
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function BikeRacer({ onClose, onSelectGame }) {

  const containerRef = useRef(null);
  const audioRef = useRef(new BikeAudioEngine());
  const audio = audioRef.current;
  const rafRef = useRef(null);

  const LEVEL_DISTANCES = [1000, 1500, 2000, 2500, 3000]; // Level 1: 1.0km, Level 2: 1.5km, +0.5km step per level
  const formatDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m}m`);

  const stateRef = useRef({
    speed: 0, maxSpeed: 290,
    dist: 0, playerX: 2.4, playerLean: 0,
    accel: false, brake: false, steer: 0, steerVel: 0,
    nitroAvailable: 100, nitroActive: false, nitroTime: 0,
    score: 0, overtakes: 0, cameraMode: 'chase',
    gear: 0, // 5-gear system: 0=G1 … 4=G5
    invulnTime: 2.5, // 2.5s collision immunity grace period on start
    crashed: false, crashTime: 0,
    crashPos: {x:2.4,y:0,z:0}, crashVel:{x:0,y:0,z:0}, crashRotVel:{x:0,y:0,z:0},
    riderPos: {x:2.4,y:0.9,z:0}, riderVel:{x:0,y:0,z:0}, riderRotVel:{x:0,y:0,z:0},
    isPaused: false,
    level: 1,                 // current level 1–5
    levelTargetDist: 1000,    // distance required for current level (1.0km)
    levelTime: 0,             // elapsed race time for current level
    levelComplete: false,     // level completion trigger lock
    maxSpeedReached: 0,       // peak highest speed reached during level
    loading: true,
    countdownActive: false,
  });

  const [phase, setPhase] = useState('playing'); // 'playing' | 'gameover' | 'levelcomplete'
  const [shattered, setShattered] = useState(false);
  const [hud,   setHud]   = useState({
    speed: 0, topSpeed: 0, dist: 0, nitro: 100, nitroActive: false, score: 0, overtakes: 0,
    curveAhead: 0, gear: 1, rpm: 0, level: 1, targetDist: 1000, time: 0
  });
  const [levelTimes, setLevelTimes] = useState({}); // { 1: time, 2: time, ... }
  const [currentLevelTime, setCurrentLevelTime] = useState(0);
  const [levelTopSpeed, setLevelTopSpeed] = useState(0);
  const [cameraMode, setCameraMode] = useState('chase');
  const [isPaused, setIsPaused] = useState(false);
  const [adPlaying, setAdPlaying] = useState(false);
  const [adCountdown, setAdCountdown] = useState(3);
  const [scorePopups, setScorePopups] = useState([]);
  const [touch, setTouch] = useState({gas:false,brake:false,left:false,right:false});
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(15);
  const [loadStatus, setLoadStatus] = useState('Downloading Resources...');
  const [countdown, setCountdown] = useState(null); // null | 3 | 2 | 1 | 'GO!'
  const [showRelatedMobile, setShowRelatedMobile] = useState(false);

  const handleLaunchRelatedGame = useCallback((gameId) => {
    const isNative = typeof window !== 'undefined' && Boolean(
      window.__APP_TARGET__ ||
      (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
    );
    if (isNative && gameId === 0) {
      // In standalone Android App: Redirect to Neon Duel Shot on Google Play Store
      try {
        window.location.href = 'market://details?id=com.gamesite.pistolfight';
      } catch {}
      setTimeout(() => {
        window.open('https://play.google.com/store/apps/details?id=com.gamesite.pistolfight', '_blank');
      }, 300);
      return;
    }
    if (onSelectGame) onSelectGame(gameId);
    else if (onClose) onClose();
  }, [onSelectGame, onClose]);

  const triggerScorePopupRef = useRef(null);
  const emitFireBurstRef = useRef(null);
  const startCountdownRef = useRef(null);

  const startCountdown = useCallback(() => {
    const s = stateRef.current;
    s.countdownActive = true;
    s.speed = 0;
    s.accel = false;
    s.brake = false;
    s.steer = 0;

    audio.init();
    setCountdown(3);
    audio.playCountdownBeep(false);

    setTimeout(() => {
      setCountdown(2);
      audio.playCountdownBeep(false);

      setTimeout(() => {
        setCountdown(1);
        audio.playCountdownBeep(false);

        setTimeout(() => {
          setCountdown('GO!');
          audio.playCountdownBeep(true);

          setTimeout(() => {
            setCountdown(null);
            s.countdownActive = false;
          }, 650);
        }, 750);
      }, 750);
    }, 750);
  }, [audio]);

  useEffect(() => {
    startCountdownRef.current = startCountdown;
  }, [startCountdown]);

  useEffect(() => {
    triggerScorePopupRef.current = (x, y) => {
      const id = Date.now() + Math.random();
      setScorePopups(prev => [...prev.slice(-6), { id, x, y }]);
      setTimeout(() => {
        setScorePopups(prev => prev.filter(p => p.id !== id));
      }, 850);
    };
  }, []);

  // Refs to Three.js objects so restartRace can reset transforms and vehicles without re-mounting
  const sceneRef = useRef(null);
  const playerGroupRef = useRef(null);
  const riderRef = useRef(null);
  const frontWheelPivotRef = useRef(null);
  const rearWheelPivotRef = useRef(null);
  const cameraRef = useRef(null);
  const resetVehiclesRef = useRef(null);

  const toggleCamera = useCallback(() => {
    setCameraMode(prev => {
      const next = prev === 'chase' ? 'cockpit' : 'chase';
      stateRef.current.cameraMode = next;
      return next;
    });
  }, []);

  const restartRace = useCallback((resetLevel = false) => {
    const s = stateRef.current;
    if(resetLevel) {
      s.level = 1;
      s.levelTargetDist = LEVEL_DISTANCES[0];
      setLevelTimes({});
    }
    Object.assign(s, {
      speed:0, dist:0, playerX:2.4, playerLean:0,
      accel:false, brake:false, steer:0, steerVel:0,
      nitroAvailable:100, nitroActive:false, nitroTime:0,
      score:0, overtakes:0, crashed:false, crashTime:0, isPaused:false,
      invulnTime: 2.5, // 2.5s collision immunity grace period on restart
      gear:0, // Reset to G1 on replay
      levelTime: 0,
      levelComplete: false,
      maxSpeedReached: 0,
      crashPos:{x:2.4,y:0,z:0},
      crashVel:{x:0,y:0,z:0},
      crashRotVel:{x:0,y:0,z:0},
    });

    // Reset all traffic vehicles far ahead down the road so none are sitting at player spawn
    if(resetVehiclesRef.current) {
      resetVehiclesRef.current();
    }

    // Reset Three.js playerGroup transforms
    if(playerGroupRef.current) {
      playerGroupRef.current.position.set(2.4, 0, 0);
      playerGroupRef.current.rotation.set(0, 0, 0);
      playerGroupRef.current.scale.set(1, 1, 1);
    }
    if(frontWheelPivotRef.current) frontWheelPivotRef.current.rotation.set(0, 0, 0);
    if(rearWheelPivotRef.current) rearWheelPivotRef.current.rotation.set(0, 0, 0);
    // Re-attach rider to playerGroup if detached during crash
    if(riderRef.current && playerGroupRef.current) {
      playerGroupRef.current.add(riderRef.current);
      riderRef.current.position.set(0, 0.02, 0.08);
      riderRef.current.rotation.set(0, 0, 0);
    }
    setShattered(false);
    setScorePopups([]);
    setAdPlaying(false);
    setLevelTopSpeed(0);
    audio.reset();
    // Snap camera to start position so lerp doesn't drag from crash location
    if(cameraRef.current) {
      cameraRef.current.position.set(2.4, 1.9, 4.8);
      cameraRef.current.rotation.set(0, 0, 0);
    }
    setPhase('playing'); setIsPaused(false);
    startCountdown();
  }, [audio, startCountdown]);

  // Revive player at current distance without resetting race progress
  const revivePlayer = useCallback(() => {
    const s = stateRef.current;
    
    // Revive physics state (keep current dist and overtakes count!)
    Object.assign(s, {
      speed: 65,      // Launch speed in G2
      gear: 1,       // G2
      playerLean: 0,
      steer: 0,
      steerVel: 0,
      crashed: false,
      crashTime: 0,
      isPaused: false,
      invulnTime: 4.0, // 4-second invulnerability shield so player safely stabilizes
    });

    // Push away any vehicles right in front of player
    if(resetVehiclesRef.current) {
      resetVehiclesRef.current();
    }

    // Upright player bike
    if(playerGroupRef.current) {
      playerGroupRef.current.position.set(s.playerX, 0, 0);
      playerGroupRef.current.rotation.set(0, 0, 0);
      playerGroupRef.current.scale.set(1, 1, 1);
    }

    // Re-attach rider to bike
    if(riderRef.current && playerGroupRef.current) {
      playerGroupRef.current.add(riderRef.current);
      riderRef.current.position.set(0, 0.02, 0.08);
      riderRef.current.rotation.set(0, 0, 0);
    }

    // Snap camera smoothly behind bike
    if(cameraRef.current) {
      cameraRef.current.position.set(s.playerX * 0.88, 1.85, 4.3);
      cameraRef.current.rotation.set(0, 0, 0);
    }

    setShattered(false);
    setScorePopups([]);
    setAdPlaying(false);
    audio.reset();
    setPhase('playing');
    setIsPaused(false);
  }, [audio]);

  // Watch Ad to Continue (Future Google Ads integration hook)
  const continueWithAd = useCallback(() => {
    // =========================================================================
    // FUTURE GOOGLE ADS / ADMOB REWARDED VIDEO AD HOOK:
    // When real Ads are enabled, call your Ad SDK here:
    // window.admob?.rewarded?.show().then(() => revivePlayer());
    // =========================================================================
    setAdPlaying(true);
    setAdCountdown(3);

    let count = 3;
    const timer = setInterval(() => {
      count -= 1;
      setAdCountdown(count);
      if(count <= 0) {
        clearInterval(timer);
        setAdPlaying(false);
        revivePlayer();
      }
    }, 850);
  }, [revivePlayer]);

  const nextLevel = useCallback(() => {
    const s = stateRef.current;
    if(s.level < 5) {
      const nxt = s.level + 1;
      s.level = nxt;
      s.levelTargetDist = LEVEL_DISTANCES[nxt - 1];
      restartRace(false);
    } else {
      // Completed all 5 levels - restart from level 1
      restartRace(true);
    }
  }, [restartRace]);

  const replayLevel = useCallback(() => {
    restartRace(false);
  }, [restartRace]);

  // Keyboard controls
  useEffect(() => {
    const dn = (e) => {
      audio.init();
      const s = stateRef.current;
      if(s.crashed || phase === 'gameover') {
        if(['Space','Enter','KeyR'].includes(e.code)||e.key===' '||e.key==='r'||e.key==='R'||e.key==='Enter') {
          restartRace(false);
        }
        return;
      }
      if(phase === 'levelcomplete') {
        if(['Space','Enter'].includes(e.code)||e.key===' '||e.key==='Enter') {
          nextLevel();
        } else if(['KeyR'].includes(e.code)||e.key==='r'||e.key==='R') {
          replayLevel();
        }
        return;
      }
      if(s.countdownActive || s.loading) return;

      if(['ArrowUp','KeyW'].includes(e.code)||e.key==='w'||e.key==='W'||e.key==='ArrowUp') s.accel=true;
      if(['ArrowDown','KeyS'].includes(e.code)||e.key==='s'||e.key==='S'||e.key==='ArrowDown'){ s.brake=true; audio.playBrakeSqueal(); }
      if(['ArrowLeft','KeyA'].includes(e.code)||e.key==='a'||e.key==='A'||e.key==='ArrowLeft') s.steer=-1;
      if(['ArrowRight','KeyD'].includes(e.code)||e.key==='d'||e.key==='D'||e.key==='ArrowRight') s.steer=1;
      if(['Space','KeyN'].includes(e.code)||e.key===' '||e.key==='n'||e.key==='N') triggerNitro();
      if(['KeyC','KeyV'].includes(e.code)||e.key==='c'||e.key==='C') toggleCamera();
      if(e.code==='KeyH'||e.key==='h'||e.key==='H') audio.playHorn();
      if(['KeyP','Escape'].includes(e.code)) togglePause();
    };
    const up = (e) => {
      const s = stateRef.current;
      if(['ArrowUp','KeyW'].includes(e.code)||e.key==='w'||e.key==='W'||e.key==='ArrowUp') s.accel=false;
      if(['ArrowDown','KeyS'].includes(e.code)||e.key==='s'||e.key==='S'||e.key==='ArrowDown') s.brake=false;
      if(['ArrowLeft','KeyA'].includes(e.code)||e.key==='a'||e.key==='A'||e.key==='ArrowLeft') { if(s.steer===-1) s.steer=0; }
      if(['ArrowRight','KeyD'].includes(e.code)||e.key==='d'||e.key==='D'||e.key==='ArrowRight') { if(s.steer===1) s.steer=0; }
    };
    window.addEventListener('keydown',dn);
    window.addEventListener('keyup',up);
    return ()=>{ window.removeEventListener('keydown',dn); window.removeEventListener('keyup',up); };
  }, [toggleCamera, phase, restartRace, nextLevel, replayLevel]);

  const triggerNitro = () => {
    audio.init();
    const s = stateRef.current;
    if(s.crashed || s.levelComplete || s.countdownActive || s.loading || s.nitroAvailable < 100 || s.nitroActive) return;
    s.nitroActive = true;
    s.nitroTime = 4.0;
    s.nitroAvailable = 0;
    // Explosive instant speed surge
    s.speed = Math.min(s.maxSpeed || 290, s.speed + 32);
    audio.playNitro();
    if(emitFireBurstRef.current) {
      emitFireBurstRef.current();
    }
  };

  const togglePause = () => {
    const nextPaused = !stateRef.current.isPaused;
    stateRef.current.isPaused = nextPaused;
    setIsPaused(nextPaused);
    if(nextPaused) {
      audio.stopEngine();
    } else {
      audio.reset();
    }
  };

  // ── Three.js Scene & Game Loop ─────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if(!container) return;
    const W = container.clientWidth||800, H = container.clientHeight||500;

    // Scene & Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#5ba4d0');
    scene.fog = new THREE.FogExp2('#e89a5c', 0.0033);

    const camera = new THREE.PerspectiveCamera(65, W/H, 0.06, 650);
    camera.position.set(2.4, 1.9, 4.8);
    camera.lookAt(2.4, 1.1, -24);
    cameraRef.current = camera; // expose to restartRace for snap-reset on replay

    const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance', stencil:false});
    renderer.setSize(W,H);
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setClearColor('#5ba4d0', 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight('#d6eaff', 0.88));
    scene.add(new THREE.HemisphereLight('#fde9c8','#2d3a50', 0.68));
    const sun = new THREE.DirectionalLight('#fff7e0', 2.85);
    sun.position.set(-45,62,-72); sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.near=0.5; sun.shadow.camera.far=180;
    sun.shadow.camera.left=-30; sun.shadow.camera.right=30;
    sun.shadow.camera.top=30; sun.shadow.camera.bottom=-30;
    sun.shadow.bias=0.0005; sun.shadow.normalBias=0.005; // Positive bias eliminates shadow acne flickering
    scene.add(sun);

    // ── Asset Loading Manager ────────────────────────────────────────────────
    const loadingManager = new THREE.LoadingManager();

    // HDRI Environment
    new HDRLoader(loadingManager).load('/textures/env.hdr',
      tx=>{ tx.mapping=THREE.EquirectangularReflectionMapping; scene.environment=scene.background=tx; },
      undefined,
      ()=>{ scene.background=new THREE.Color('#5ba4d0'); }
    );

    // ── 3D Curved Road, Terrain & Guardrails ──────────────────────────────────
    const ROAD_W = 16.5, ROAD_L = 420;
    const ROAD_SEGS = 70;
    const {diffuse:rdiff, normal:rnorm, roughness:rrough} = makeAsphaltTextures();

    const roadGeo = new THREE.PlaneGeometry(ROAD_W, ROAD_L, 1, ROAD_SEGS);
    const road = new THREE.Mesh(
      roadGeo,
      new THREE.MeshStandardMaterial({
        map:rdiff, normalMap:rnorm, normalScale:new THREE.Vector2(.8,.8),
        roughnessMap:rrough, roughness:.82, metalness:.12,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
      })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -ROAD_L / 2 + 10);
    road.receiveShadow = true;
    scene.add(road);

    // Terrain/grass shoulders — separated cleanly below road to guarantee zero Z-fighting
    const terrainMat = new THREE.MeshStandardMaterial({color:'#3d4a3e', roughness:.95, metalness:.04});
    const terrainGeo = new THREE.PlaneGeometry(320, ROAD_L, 1, ROAD_SEGS);
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(0, -0.06, -ROAD_L / 2 + 10);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Dynamic Guardrail Ribbons along highway edges (Left & Right Highway Steel Barricades)
    const railMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.94,
      roughness: 0.22,
      side: THREE.DoubleSide
    });
    const railLeftGeo = makeGuardrailGeometry(-1, ROAD_SEGS, ROAD_W, ROAD_L);
    const railLeft = new THREE.Mesh(railLeftGeo, railMat);
    railLeft.castShadow = true;
    railLeft.receiveShadow = true;
    scene.add(railLeft);

    const railRightGeo = makeGuardrailGeometry(1, ROAD_SEGS, ROAD_W, ROAD_L);
    const railRight = new THREE.Mesh(railRightGeo, railMat);
    railRight.castShadow = true;
    railRight.receiveShadow = true;
    scene.add(railRight);

    // Guardrail Support Posts along highway edges with highway reflectors
    const railPosts = [];
    const reflMatLeft = new THREE.MeshBasicMaterial({ color: '#f59e0b' }); // Amber warning reflector on oncoming left
    const reflMatRight = new THREE.MeshBasicMaterial({ color: '#ef4444' }); // Red reflector on right
    for(let z = -ROAD_L + 10; z < 20; z += 12) {
      [-1, 1].forEach(side => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.12), railMat);
        post.position.set(side * (ROAD_W / 2 + 0.25), 0.33, z);
        post.userData = { side, origZ: z };
        post.castShadow = true;

        // Highway reflector stud facing traffic
        const refl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.04), side < 0 ? reflMatLeft : reflMatRight);
        refl.position.set(0, 0.16, 0);
        post.add(refl);

        scene.add(post);
        railPosts.push(post);
      });
    }

    // ── Roadside Trees (GLTF with procedural fallback) ───────────────────────
    const trees = [];
    const dracoLoader = new DRACOLoader(loadingManager);
    dracoLoader.setDecoderPath('/draco/gltf/');
    const gltfLoader = new GLTFLoader(loadingManager);
    gltfLoader.setDRACOLoader(dracoLoader);

    function makeFallbackTree() {
      const tg = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.09,.14,.9,8), new THREE.MeshStandardMaterial({color:'#3d2b1f',roughness:.95}));
      trunk.position.y=.45; trunk.castShadow=true; tg.add(trunk);
      const foliageMat = new THREE.MeshStandardMaterial({color:'#1a3a1c',roughness:.88,metalness:.02});
      [0,1,2].forEach(i=>{
        const r=.85-.18*i, h=.7+.2*i;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r,h,10), foliageMat);
        cone.position.y=.9+i*.45; cone.castShadow=true; tg.add(cone);
      });
      return tg;
    }

    function plantTrees(template=null) {
      for(let i=0;i<65;i++){
        const side = i%2===0 ? -1:1;
        const xd = side*(ROAD_W/2+4+Math.random()*22);
        const sc = .8+Math.random()*.85;
        const tree = template ? template.clone(true) : makeFallbackTree();
        tree.scale.set(sc,sc,sc);
        tree.userData = { origX: xd };
        tree.position.set(xd, 0, -Math.random()*ROAD_L);
        tree.rotation.y = Math.random()*Math.PI*2;
        scene.add(tree); trees.push(tree);
      }
    }

    gltfLoader.load('/models/pine.glb', gltf=>{
      const t=gltf.scene; t.traverse(c=>{ if(c.isMesh){c.castShadow=c.receiveShadow=true;} });
      plantTrees(t);
    }, undefined, ()=>plantTrees(null));

    // ── Finish Line Gantry & Checkered Strip ──────────────────────────────────
    const finishLineGroup = new THREE.Group();
    const { roadTex, bannerTex, flagTex } = makeFinishLineTextures();

    // Checkered strip on road
    const finishStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W, 3.5),
      new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.6, metalness: 0.1 })
    );
    finishStrip.rotation.x = -Math.PI / 2;
    finishStrip.position.set(0, 0.024, 0);
    finishStrip.receiveShadow = true;
    finishLineGroup.add(finishStrip);

    // Gantry structure: 2 vertical pillars + top cross beam
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.9, roughness: 0.25 });
    const cautionMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.7, roughness: 0.3 });

    // Left & Right Pillars
    [-1, 1].forEach(side => {
      const px = side * (ROAD_W / 2 + 0.35);
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.5), pillarMat);
      pillar.position.set(px, 3.1, 0);
      pillar.castShadow = true;
      finishLineGroup.add(pillar);

      // Yellow caution rings on pillar
      for(let y = 0.8; y < 5.8; y += 1.2) {
        const ring = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.25, 0.54), cautionMat);
        ring.position.set(px, y, 0);
        finishLineGroup.add(ring);
      }

      // Checkered flag atop pillar
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), pillarMat);
      flagPole.position.set(px, 7.0, 0);
      finishLineGroup.add(flagPole);

      const flagMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 1.0),
        new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide })
      );
      flagMesh.position.set(px + side * 0.8, 7.2, 0);
      finishLineGroup.add(flagMesh);
    });

    // Cross beam spanning highway
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 1.2, 0.45, 0.6), pillarMat);
    beam.position.set(0, 5.9, 0);
    finishLineGroup.add(beam);

    // Overhead Banner hanging down
    const bannerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W * 0.78, 1.9),
      new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide })
    );
    bannerMesh.position.set(0, 4.8, 0);
    finishLineGroup.add(bannerMesh);

    finishLineGroup.position.set(0, 0, -500);
    finishLineGroup.visible = false;
    scene.add(finishLineGroup);

    // ── Player Bike ──────────────────────────────────────────────────────────
    const playerGroup = new THREE.Group();
    playerGroup.position.set(2.4, 0, 0);
    scene.add(playerGroup);
    playerGroupRef.current = playerGroup; // expose to restartRace for transform reset

    // Contact shadow
    const shadowTex = makeRadialTex(256,[
      [0,'rgba(4,5,8,.97)'],[.45,'rgba(4,5,8,.65)'],[.82,'rgba(4,5,8,.2)'],[1,'rgba(4,5,8,0)']
    ]);
    const shadowMat = new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,opacity:.88,depthWrite:false});
    const bikeShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7,3.3), shadowMat);
    bikeShadow.rotation.x=-Math.PI/2; bikeShadow.position.y=.022;
    playerGroup.add(bikeShadow);

    // Rider model (always visible immediately)
    const rider = makeRider();
    riderRef.current = rider;
    playerGroup.add(rider);

    // Wheel pivots & dynamic rolling angle
    let frontWheelPivot = null;
    let rearWheelPivot = null;
    let wheelRollAngle = 0;

    gltfLoader.load('/models/motorcycle.glb', gltf=>{
      const bikeModel = gltf.scene;

      // Auto-scale to ~2.15m length and accurately center
      const bb = new THREE.Box3().setFromObject(bikeModel);
      const sz = new THREE.Vector3(); bb.getSize(sz);
      const center = new THREE.Vector3(); bb.getCenter(center);
      const sc = 2.15 / Math.max(sz.x, sz.z);
      bikeModel.scale.set(sc, sc, sc);
      bikeModel.position.set(-center.x * sc, -bb.min.y * sc, -center.z * sc);

      // Wrapper group to orient motorcycle straight down the highway (-X rotates to -Z)
      const bikeWrapper = new THREE.Group();
      bikeWrapper.rotation.y = -Math.PI / 2;
      bikeWrapper.add(bikeModel);

      // Collect front and rear rotating wheel components
      const frontParts = [];
      const rearParts = [];

      // High-detail realistic materials for moving wheel parts
      const tireMat = new THREE.MeshStandardMaterial({
        color: '#15171a',     // Vulcanized rubber black
        roughness: 0.88,
        metalness: 0.08,
      });
      const rimMat = new THREE.MeshStandardMaterial({
        color: '#d4af37',     // Metallic gold alloy rims (high contrast against black tire)
        roughness: 0.22,
        metalness: 0.92,
        envMapIntensity: 2.5,
      });
      const rimDecalMat = new THREE.MeshStandardMaterial({
        color: '#ef4444',     // Racing red rim lip decals for high-speed dynamic strobing
        roughness: 0.28,
        metalness: 0.65,
        emissive: '#dc2626',
        emissiveIntensity: 0.35,
      });
      const brakeDiscMat = new THREE.MeshStandardMaterial({
        color: '#cbd5e1',     // Drilled steel brake rotor disc
        roughness: 0.25,
        metalness: 0.95,
        envMapIntensity: 2.0,
      });
      const brakeCaliperMat = new THREE.MeshStandardMaterial({
        color: '#b91c1c',     // Brembo racing red static caliper
        roughness: 0.35,
        metalness: 0.5,
      });

      bikeModel.traverse(child=>{
        if(!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;

        const name = child.name || '';
        const matName = child.material?.name || '';
        const isCaliper = /caliper|calipper|cylinder_brake/i.test(name) || /caliper|calipper/i.test(matName);

        // Group wheel meshes for spinning (strictly excluding static brake calipers)
        if(!isCaliper) {
          if(/front/i.test(name) && /tire|rim|disk|wheel|brake_disk|decal_rim|bolt_brake/i.test(name)) {
            frontParts.push(child);
          } else if(/rear/i.test(name) && /tire|rim|disk|wheel|brake_disk|decal_rim|bolt_rear/i.test(name)) {
            rearParts.push(child);
          }
        }

        // Apply realistic materials
        if(/tire/i.test(name) || /tire/i.test(matName)) {
          child.material = tireMat;
        } else if(/decal_rim/i.test(name)) {
          child.material = rimDecalMat;
        } else if(/rim/i.test(name) || /rim/i.test(matName)) {
          child.material = rimMat;
        } else if(/brake_disk|brakedisk|disk_ABS/i.test(name) || /brakedisk/i.test(matName)) {
          child.material = brakeDiscMat;
        } else if(isCaliper) {
          child.material = brakeCaliperMat;
        } else if(/carpaint|body|fairing/i.test(matName) || /body|fender/i.test(name)){
          child.material = new THREE.MeshPhysicalMaterial({
            color: '#b91c1c', // Deep racing red
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            metalness: 0.85,
            roughness: 0.15,
            envMapIntensity: 2.2,
          });
        } else if(/chrome|bolt|lever|pipe|exhaust/i.test(matName)){
          child.material = new THREE.MeshStandardMaterial({
            color: '#e2e8f0',
            metalness: 0.98,
            roughness: 0.06,
            envMapIntensity: 2.0,
          });
        } else if(/glass|windshield|mirror/i.test(matName)){
          child.material = new THREE.MeshStandardMaterial({
            color: '#a5f3fc',
            transparent: true,
            opacity: 0.45,
            roughness: 0.03,
          });
        } else if(child.material) {
          child.material.envMapIntensity = 1.8;
        }
      });

      playerGroup.add(bikeWrapper);
      playerGroup.updateMatrixWorld(true);

      // Create axle pivots for Front and Rear wheels inside playerGroup space
      if(frontParts.length > 0) {
        const frontBox = new THREE.Box3();
        frontParts.forEach(m => frontBox.expandByObject(m));
        const frontCenterWorld = new THREE.Vector3();
        frontBox.getCenter(frontCenterWorld);
        const frontCenterLocal = frontCenterWorld.clone();
        playerGroup.worldToLocal(frontCenterLocal);

        frontWheelPivot = new THREE.Group();
        frontWheelPivot.name = 'frontWheelPivot';
        frontWheelPivot.position.copy(frontCenterLocal);
        playerGroup.add(frontWheelPivot);
        frontWheelPivotRef.current = frontWheelPivot;
        playerGroup.updateMatrixWorld(true);

        frontParts.forEach(m => {
          frontWheelPivot.attach(m);
        });
      }

      if(rearParts.length > 0) {
        const rearBox = new THREE.Box3();
        rearParts.forEach(m => rearBox.expandByObject(m));
        const rearCenterWorld = new THREE.Vector3();
        rearBox.getCenter(rearCenterWorld);
        const rearCenterLocal = rearCenterWorld.clone();
        playerGroup.worldToLocal(rearCenterLocal);

        rearWheelPivot = new THREE.Group();
        rearWheelPivot.name = 'rearWheelPivot';
        rearWheelPivot.position.copy(rearCenterLocal);
        playerGroup.add(rearWheelPivot);
        rearWheelPivotRef.current = rearWheelPivot;
        playerGroup.updateMatrixWorld(true);

        rearParts.forEach(m => {
          rearWheelPivot.attach(m);
        });
      }

      // Position rider naturally on the superbike seat
      rider.position.set(0, 0.02, 0.08);
    }, undefined, (err)=>{
      console.error('Error loading HD motorcycle.glb:', err);
    });


    // ── Tire Smoke & Smoking Fire Nitro Exhaust Particle System ────────────────
    const N_PARTS = 240;
    const pPos = new Float32Array(N_PARTS*3);
    const pCol = new Float32Array(N_PARTS*3);
    const pSiz = new Float32Array(N_PARTS);
    for(let i=0;i<N_PARTS;i++){ pPos[i*3+1]=-100; pSiz[i]=.01; }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3));
    pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol,3));
    pGeo.setAttribute('size',     new THREE.BufferAttribute(pSiz,1));

    const smokeTex = makeRadialTex(64,[
      [0,'rgba(255,255,255,.96)'],[.38,'rgba(230,235,245,.52)'],[.72,'rgba(200,210,228,.16)'],[1,'rgba(180,190,215,0)']
    ]);
    const pMat = new THREE.PointsMaterial({size:.95,vertexColors:true,transparent:true,opacity:.68,map:smokeTex,depthWrite:false});
    const pSys = new THREE.Points(pGeo, pMat);
    scene.add(pSys);

    const pool = Array.from({length:N_PARTS},()=>({active:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,maxLife:1,sz:0,tSz:1,r:1,g:1,b:1,a:1}));
    let pNext = 0;

    function emitSmoke(isNitro, spd, isFire = false) {
      const p = pool[pNext]; pNext = (pNext + 1) % N_PARTS;
      const s = stateRef.current;
      p.active = true;

      if(isNitro && isFire) {
        // ── Blazing Exhaust Flame Jet ─────────────────────────────────────────
        p.life = 0;
        p.maxLife = 0.16 + Math.random() * 0.22;
        // Dual exhaust muffler positions
        const side = Math.random() > 0.5 ? 0.16 : -0.16;
        p.x = s.playerX + side + (Math.random() - 0.5) * 0.04;
        p.y = 0.27 + (Math.random() - 0.5) * 0.05;
        p.z = 0.94;

        p.vx = (Math.random() - 0.5) * 0.35;
        p.vy = 0.12 + Math.random() * 0.24;
        p.vz = 9.8 + spd * 0.075;
        p.sz = 0.45;
        p.tSz = 1.15;

        // Vivid fiery palette: electric blue nitro core, blazing orange/red fire, golden white sparks
        const roll = Math.random();
        if(roll < 0.38) {
          // Electric Nitro Blue flame
          p.r = 0.05; p.g = 0.88; p.b = 1.0;
        } else if(roll < 0.78) {
          // Blazing Fire Orange/Red
          p.r = 1.0; p.g = 0.42; p.b = 0.03;
        } else {
          // Hot Golden Yellow spark
          p.r = 1.0; p.g = 0.88; p.b = 0.15;
        }
        p.a = 1.0;
      } else if(isNitro && !isFire) {
        // ── Billowing Smoky Fire Trail Plume ──────────────────────────────────
        p.life = 0;
        p.maxLife = 0.48 + Math.random() * 0.38;
        p.x = s.playerX + (Math.random() - 0.5) * 0.24;
        p.y = 0.32 + Math.random() * 0.14;
        p.z = 1.12 + Math.random() * 0.16;

        p.vx = (Math.random() - 0.5) * 0.75;
        p.vy = 0.35 + Math.random() * 0.5;
        p.vz = 4.2 + spd * 0.04;
        p.sz = 0.4;
        p.tSz = 2.2;

        // Smoky charcoal grey with burning warm tint
        p.r = 0.34; p.g = 0.30; p.b = 0.28;
        p.a = 0.65;
      } else {
        // ── Normal Tire/Road Friction Smoke ──────────────────────────────────
        p.life = 0;
        p.maxLife = 0.38 + Math.random() * 0.35;
        p.x = s.playerX + (Math.random() - 0.5) * 0.18;
        p.y = 0.1 + Math.random() * 0.07;
        p.z = 1.05;

        p.vx = (Math.random() - 0.5) * 0.65;
        p.vy = 0.22 + Math.random() * 0.42;
        p.vz = 1.8 + spd * 0.025;
        p.sz = 0.32;
        p.tSz = 1.55;
        p.r = 0.88; p.g = 0.90; p.b = 0.92;
        p.a = 0.48;
      }
    }

    // Expose instant combustion burst for nitro ignition
    emitFireBurstRef.current = () => {
      for(let i = 0; i < 20; i++) {
        emitSmoke(true, stateRef.current.speed, true);
        if(i % 2 === 0) emitSmoke(true, stateRef.current.speed, false);
      }
    };

    // ── Traffic System ────────────────────────────────────────────────────────
    // 4 lanes: left 2 = oncoming (travel toward +Z), right 2 = same-direction (travel toward -Z)
    // Road is 16.5m wide. Center double yellow line is at X = 0.
    // Inner oncoming lane is at x = -2.8 (clear 1.6m gap from center line, never crosses into player's lane).
    // Inner player lane is at x = 2.4 (centered, safe margin from center line).
    const LANE_CONFIGS = [
      { x: -5.8, oncoming: true,  minSpd: 72, maxSpd: 108, len: 7.5 },  // Oncoming fast (outer left)
      { x: -2.8, oncoming: true,  minSpd: 58, maxSpd: 85,  len: 4.6 }, // Oncoming slow (inner left, stays strictly within lane)
      { x:  2.4, oncoming: false, minSpd: 68, maxSpd: 95,  len: 4.6 }, // Same-dir cruising (inner right / player lane)
      { x:  5.8, oncoming: false, minSpd: 78, maxSpd: 112, len: 7.5 },  // Same-dir fast (outer right)
    ];

    const VEHICLE_COLORS = ['#d0d5dc','#0d1117','#1a2f70','#8b1a1a','#f0f4f8','#6b3d0f'];

    const vehicles = [];

    // Load traffic templates — real 3D models with centered wrappers and strict lane-width limits
    const trafficTemplates = {};
    const TRAFFIC_MODELS = [
      {key:'car',   url:'/models/ferrari.glb',   len:4.5, maxW:1.95},
      {key:'suv',   url:'/models/suv.gltf',      len:4.7, maxW:2.00},
      {key:'truck', url:'/models/truck.gltf',    len:5.6, maxW:2.08},
      {key:'semi',  url:'/models/semi-truck.glb',len:7.5, maxW:2.12},
      {key:'sedan', url:'/models/sedan.gltf',    len:4.5, maxW:1.95},
    ];
    let tmplLoadCount = 0;

    TRAFFIC_MODELS.forEach(v=>{
      gltfLoader.load(v.url, gltf=>{
        const m = gltf.scene;
        const bb = new THREE.Box3().setFromObject(m);
        const sz = new THREE.Vector3(); bb.getSize(sz);
        const center = new THREE.Vector3(); bb.getCenter(center);
        
        // Strict lane-fitting scale: length scaled to v.len, but width STRICTLY capped to v.maxW
        // This ensures trucks and semis never spill outside their lane or overlap into other lanes
        let sc = v.len / Math.max(sz.z, sz.x);
        if(sz.x * sc > v.maxW) {
          sc = v.maxW / sz.x;
        }

        // Center the model inside a wrapper so rotation pivots around its true center
        const wrapper = new THREE.Group();
        m.scale.set(sc, sc, sc);
        m.position.set(-center.x * sc, -bb.min.y * sc, -center.z * sc);
        // Ferrari has front at -Z, rotate by Math.PI so ALL templates have front at +Z
        if(v.key === 'car') {
          m.rotation.y = Math.PI;
        }
        wrapper.add(m);

        wrapper.traverse(c=>{
          if(c.isMesh){
            c.castShadow=c.receiveShadow=true;
            if(c.material) c.material.envMapIntensity=1.75;
          }
        });
        trafficTemplates[v.key] = wrapper;
      }, undefined, (err)=>{
        console.warn('Traffic model load error:', v.url, err);
      });
    });

    // Shared contact shadow material for all vehicles
    const vShadowMat = new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,opacity:.7,depthWrite:false});

    function spawnVehicle(zOff=-80, forcedLane=null) {
      const li = forcedLane!==null ? forcedLane : Math.floor(Math.random()*LANE_CONFIGS.length);
      const lc = LANE_CONFIGS[li];
      const keys = Object.keys(trafficTemplates).filter(k => trafficTemplates[k]);
      if(keys.length === 0) return null;
      const chosenKey = keys[Math.floor(Math.random()*keys.length)];
      const template = trafficTemplates[chosenKey];
      if(!template) return null;

      const vg = new THREE.Group();
      const visual = template.clone(true);
      visual.rotation.y = 0; // Visual template stays neutral at 0
      vg.add(visual);

      // Contact shadow under vehicle accurately sized to vehicle footprint
      const vSh = new THREE.Mesh(new THREE.PlaneGeometry(2.1, lc.len * 0.9 + 0.3), vShadowMat);
      vSh.rotation.x = -Math.PI / 2;
      vSh.position.y = 0.018;
      vg.add(vSh);

      // Set vehicle orientation strictly on the parent group:
      // Oncoming traffic (left lanes): travels toward +Z -> front points at player (+Z) -> rotation.y = 0
      // Same-direction traffic (right lanes): travels forward toward -Z -> rear points at player (+Z) -> rotation.y = Math.PI
      vg.rotation.y = lc.oncoming ? 0 : Math.PI;
      vg.position.set(lc.x, 0, zOff);
      scene.add(vg);

      const vehicleData = {
        mesh: vg, lane: li, x: lc.x,
        isOncoming: lc.oncoming,
        speed: lc.minSpd + Math.random()*(lc.maxSpd-lc.minSpd),
        len: lc.len, width: 2.05,
        passed: false, active: true,
      };
      vehicles.push(vehicleData);
      return vehicleData;
    }

    // Expose vehicle reset function so restartRace can reset all traffic far down highway
    resetVehiclesRef.current = () => {
      const initialZ = [-65, -175, -120, -240, -95, -190];
      const initialLanes = [0, 0, 1, 1, 2, 3];
      vehicles.forEach((v, idx) => {
        const li = initialLanes[idx % initialLanes.length];
        const z = initialZ[idx % initialZ.length];
        const lc = LANE_CONFIGS[li];
        v.lane = li;
        v.x = lc.x;
        v.isOncoming = lc.oncoming;
        v.mesh.position.set(lc.x, 0, z);
        // Strictly set parent rotation so same-dir vehicles always show rear and oncoming show front
        v.mesh.rotation.y = lc.oncoming ? 0 : Math.PI;
        v.speed = lc.minSpd + Math.random() * (lc.maxSpd - lc.minSpd);
        v.passed = false;
        v.active = true;
      });
    };

    // ── Multi-Phase Asset Loading Lifecycle (Downloading -> Loading -> Preparing -> Ready) ──
    let hasLoadedAll = false;

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      if (hasLoadedAll) return;
      // Phase 1: 0% - 75% download progress
      const ratio = itemsTotal > 0 ? itemsLoaded / itemsTotal : 0;
      const pct = Math.min(75, Math.max(12, Math.round(ratio * 75)));
      setLoadProgress(pct);
      setLoadStatus(`Downloading Resources (${itemsLoaded}/${itemsTotal})...`);
    };

    const finalizeGameReady = () => {
      if (hasLoadedAll) return;
      hasLoadedAll = true;

      // Phase 2: Loading & Initializing Assets (88%)
      setLoadProgress(88);
      setLoadStatus('Loading Assets...');

      // Seed initial traffic across highway with generous passing runway
      spawnVehicle(-65, 0);
      spawnVehicle(-175, 0);
      spawnVehicle(-120, 1);
      spawnVehicle(-240, 1);
      spawnVehicle(-95, 2);
      spawnVehicle(-190, 3);

      setTimeout(() => {
        // Phase 3: Preparing Game & Pre-compiling Shaders (98%)
        setLoadProgress(98);
        setLoadStatus('Preparing Game...');

        try {
          renderer.compile(scene, camera);
          renderer.render(scene, camera);
        } catch (e) {
          console.warn('WebGL warmup compile error:', e);
        }

        setTimeout(() => {
          // Phase 4: Ready! (100%)
          setLoadProgress(100);
          setLoadStatus('Ready!');

          setTimeout(() => {
            stateRef.current.loading = false;
            setLoading(false);
            if (startCountdownRef.current) {
              startCountdownRef.current();
            }
          }, 350);
        }, 250);
      }, 250);
    };

    loadingManager.onLoad = () => {
      finalizeGameReady();
    };

    loadingManager.onError = (url) => {
      console.warn('Asset loader error on:', url);
    };

    // Safety timeout in case a network resource is throttled or blocked
    const safetyTimer = setTimeout(() => {
      if (!hasLoadedAll) {
        console.warn('Safety fallback triggered for game ready');
        finalizeGameReady();
      }
    }, 9000);

    // ── Main Animation Loop ───────────────────────────────────────────────────
    // Reusable scratch vectors to avoid garbage collection allocations during 60-120 FPS render loop
    const _vPos = new THREE.Vector3();
    const _localEye = new THREE.Vector3();
    const _worldEye = new THREE.Vector3();
    const _targetUp = new THREE.Vector3();
    const _lookTarget = new THREE.Vector3();
    const _upAxis = new THREE.Vector3(0, 1, 0);
    let lastHudT = 0;
    let lastT = performance.now();

    const animate = () => {
      try {
        const now = performance.now();
        const dt  = Math.min((now-lastT)/1000, .08);
        lastT = now;

      const s = stateRef.current;
      if(s.isPaused || s.loading){ 
        if (renderer && scene && camera) renderer.render(scene, camera);
        rafRef.current=requestAnimationFrame(animate); 
        return; 
      }

      if(s.countdownActive){
        s.speed = 0;
        s.accel = false;
        s.brake = false;
        s.steer = 0;
        audio.update(0, false, false);
        if (renderer && scene && camera) renderer.render(scene, camera);
        rafRef.current=requestAnimationFrame(animate);
        return;
      }

      // ── 5-Gear Physics System ────────────────────────────────────────────────
      if(!s.crashed) {
        if(s.invulnTime > 0) s.invulnTime -= dt;
        if(s.nitroActive){ s.nitroTime-=dt; if(s.nitroTime<=0) s.nitroActive=false; }
        else if(s.nitroAvailable<100) s.nitroAvailable=Math.min(100,s.nitroAvailable+dt*4.5);


        // 5-Gear auto-selection with hysteresis (prevents gear hunting)
        let g = s.gear ?? 0;
        if(s.speed >= GEARS[g].shift && g < 4) {
          g++;
        } else if(g > 0 && s.speed < GEARS[g - 1].shift - 8) {
          g--;
        }
        s.gear = g;
        const curGear = GEARS[g];

        // Smooth power curve: stays strong across powerband, slight natural taper at redline
        const prevShift = g === 0 ? 0 : GEARS[g - 1].shift * 0.7;
        const rpmRatio = Math.min(1, Math.max(0, (s.speed - prevShift) / (curGear.redline - prevShift)));
        const torqueCurve = 1.0 - 0.22 * (rpmRatio * rpmRatio);
        const effectiveTorque = (s.nitroActive ? curGear.torque * 2.2 + 80 : curGear.torque) * torqueCurve;
        const topSpd = s.nitroActive ? 290 : curGear.shift;

        if(s.accel || s.nitroActive) {
          const nitroThrust = s.nitroActive ? 85 : 0;
          s.speed = Math.min(topSpd, s.speed + (effectiveTorque + nitroThrust) * dt);
        } else if(s.brake) {
          // Strong responsive brakes: mechanical disc (65 km/h/s) + gear-dependent engine braking
          // G1: 65 + 50 = 115 km/h/s (stops fast at low speed)
          // G5: 65 + 18 = 83 km/h/s (stops from 200 to 0 in ~2.4s, no brake failure feeling)
          const discBrake = 65;
          const engineBrake = curGear.engBrake;
          s.speed = Math.max(0, s.speed - (discBrake + engineBrake) * dt);
        } else {
          // Passive coasting: gradual deceleration
          const coastFriction = 10 + g * 2.0;
          s.speed = Math.max(0, s.speed - coastFriction * dt);
        }

        // Smooth, responsive lane steering (controlled lateral movement across lanes)
        const steerSpd = 3.8 + Math.min(s.speed, 220) * 0.024;
        const targetSteerVel = s.steer * steerSpd;
        s.steerVel = s.steerVel || 0;
        s.steerVel += (targetSteerVel - s.steerVel) * 20 * dt;
        s.playerX += s.steerVel * dt;

        // Subtle road curve drift without harsh position jerking
        const currentCurvature = getRoadCurveAt(s.dist);
        if(Math.abs(currentCurvature) > 0.05 && s.speed > 35 && s.steer === 0) {
          const subtleDrift = currentCurvature * (s.speed / 260) * 0.5 * dt;
          s.playerX -= subtleDrift;
        }

        s.playerX = Math.max(-ROAD_W/2 + 1.2, Math.min(ROAD_W/2 - 1.2, s.playerX));

        // Controlled, realistic banking lean: smooth lean into turns
        const leanTarget = -s.steer * 0.22 * Math.min(1, s.speed / 30 + 0.2) + currentCurvature * 0.05;
        const clampedLean = Math.max(-0.24, Math.min(0.24, leanTarget));
        s.playerLean += (clampedLean - s.playerLean) * 16 * dt;

        // Track highest peak speed achieved in this level
        if (s.speed > (s.maxSpeedReached || 0)) {
          s.maxSpeedReached = Math.round(s.speed);
        }

        s.dist  += (s.speed*1000/3600)*dt;
        // Score is awarded strictly +10 pts per obstacle passed
        if(!s.levelComplete) {
          s.levelTime += dt;
        }

        audio.update(s.speed, s.accel, s.brake, s.nitroActive, g, rpmRatio, s.levelComplete);

        // Emit tire smoke & smoking fiery nitro exhaust
        if(s.nitroActive) {
          emitSmoke(true, s.speed, true);
          emitSmoke(true, s.speed, true);
          emitSmoke(true, s.speed, true);
          emitSmoke(true, s.speed, false);
          emitSmoke(true, s.speed, false);
        } else if((s.accel || (s.brake && s.speed > 75)) && s.speed > 8) {
          emitSmoke(false, s.speed, false);
          if(s.speed > 155) emitSmoke(false, s.speed, false);
        }
      }

      // ── Finish Line Position & Level Complete Detection ──────────────────────
      const remDist = s.levelTargetDist - s.dist;
      if(remDist <= 120 && remDist >= -20) {
        finishLineGroup.visible = true;
        const flZ = -remDist;
        const flCurve = getCurveOffset(flZ, s.dist);
        const flAngle = getCurveTangent(flZ, s.dist);
        finishLineGroup.position.set(flCurve, 0, flZ);
        finishLineGroup.rotation.y = -flAngle;
      } else {
        finishLineGroup.visible = false;
      }

      // Check for level complete
      if(!s.crashed && !s.levelComplete && s.dist >= s.levelTargetDist) {
        s.levelComplete = true;
        s.accel = false;
        s.steer = 0;
        s.steerVel = 0;
        const peakSpeed = Math.round(Math.max(s.maxSpeedReached || 0, s.speed));
        s.maxSpeedReached = peakSpeed;
        setLevelTopSpeed(peakSpeed);
        s.speed = Math.max(0, s.speed * 0.4); // controlled deceleration upon crossing finish line
        const finalTime = Math.max(0.1, s.levelTime);
        setCurrentLevelTime(finalTime);
        setLevelTimes(prev => ({ ...prev, [s.level]: finalTime }));
        setPhase('levelcomplete');
        // Instantly drop engine RPM down to idle & play cheerful "Hurray!" victory fanfare and crowd celebration
        audio.levelCompleteDown();
        audio.playLevelVictory();
      }

      // ── Update Player Group ──────────────────────────────────────────────────
      if(!s.crashed) {
        playerGroup.position.x = s.playerX;
        // Smooth quadratic elevation when leaning ensures tires, exhaust, and pegs NEVER clip into road
        playerGroup.position.y = (s.playerLean * s.playerLean) * 0.12;
        // Use explicit Euler order to guarantee clean matrixWorld (prevents cockpit camera jitter from dirty flags)
        playerGroup.setRotationFromEuler(new THREE.Euler(0, 0, s.playerLean, 'YZX'));
        rider.rotation.z = s.playerLean * 0.2;
        // ── CRITICAL: Force matrixWorld recompute NOW ──
        // Three.js only updates matrixWorld during renderer.render(). The cockpit camera reads
        // playerGroup.matrixWorld to compute the eye position — if we don't force an update here,
        // it reads LAST frame's matrix (wrong lean angle), causing 1-frame-offset flicker/bubbling on every turn.
        playerGroup.updateWorldMatrix(true, false);
      }

      // ── Road Texture Scrolling (forward motion rushing towards player) ────
      const moveDist = (s.speed*1000/3600)*dt;
      const texDelta = moveDist/25; // 400m / 16 repeats ≈ 25m per tile
      rdiff.offset.y = (rdiff.offset.y + texDelta) % 1;
      rnorm.offset.y  = rdiff.offset.y;
      rrough.offset.y = rdiff.offset.y;

      // ── Dynamic Wheel & Tire Spinning (Synchronized with Ground Speed) ────────
      // Outer tire radius is ~0.315m. Angular delta in radians = moveDist / radius.
      // Negative rotation around local X rolls the wheels forward down the road.
      if(s.speed > 0.1 || !s.crashed) {
        wheelRollAngle += (moveDist / 0.315);
      } else if(s.crashed && Math.abs(s.crashVel?.z || 0) > 0.1) {
        wheelRollAngle += (Math.abs(s.crashVel.z) * dt / 0.315);
      }
      if(frontWheelPivot) {
        frontWheelPivot.rotation.x = -wheelRollAngle;
      }
      if(rearWheelPivot) {
        rearWheelPivot.rotation.x = -wheelRollAngle;
      }

      // ── 3D Dynamic Curve Highway Deformation ────────────────────────────────
      const roadPos = roadGeo.attributes.position;
      const terrPos = terrainGeo.attributes.position;
      const railLPos = railLeftGeo.attributes.position;
      const railRPos = railRightGeo.attributes.position;

      for (let j = 0; j <= ROAD_SEGS; j++) {
        const zWorld = (j / ROAD_SEGS - 1) * ROAD_L + 10;
        const offX = getCurveOffset(zWorld, s.dist);

        // Road plane vertices
        roadPos.setX(j * 2 + 0, -ROAD_W / 2 + offX);
        roadPos.setX(j * 2 + 1, ROAD_W / 2 + offX);

        // Terrain plane vertices
        terrPos.setX(j * 2 + 0, -160 + offX);
        terrPos.setX(j * 2 + 1, 160 + offX);

        // Left & right guardrails
        railLPos.setX(j * 2 + 0, -ROAD_W / 2 - 0.25 + offX);
        railLPos.setX(j * 2 + 1, -ROAD_W / 2 - 0.25 + offX);

        railRPos.setX(j * 2 + 0, ROAD_W / 2 + 0.25 + offX);
        railRPos.setX(j * 2 + 1, ROAD_W / 2 + 0.25 + offX);
      }
      roadPos.needsUpdate = true;
      terrPos.needsUpdate = true;
      railLPos.needsUpdate = true;
      railRPos.needsUpdate = true;

      // ── Guardrail Posts Looping along Curve ──────────────────────────────────
      railPosts.forEach(post => {
        post.position.z += moveDist;
        if(post.position.z > 20) post.position.z -= ROAD_L;
        const offX = getCurveOffset(post.position.z, s.dist);
        post.position.x = post.userData.side * (ROAD_W / 2 + 0.25) + offX;
      });

      // ── Tree Looping along Curve ─────────────────────────────────────────────
      trees.forEach(tree => {
        tree.position.z += moveDist;
        if(tree.position.z > 30) tree.position.z -= ROAD_L;
        const offX = getCurveOffset(tree.position.z, s.dist);
        tree.position.x = (tree.userData.origX || 0) + offX;
      });

      // ── Particle System Update ───────────────────────────────────────────────
      const spdMps = s.speed*1000/3600;
      pool.forEach((p,idx)=>{
        if(!p.active) return;
        p.life+=dt;
        if(p.life>=p.maxLife){ p.active=false; pGeo.attributes.position.setY(idx,-200); return; }
        const lr=p.life/p.maxLife;
        p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=(p.vz+spdMps)*dt;
        const csz=p.sz+(p.tSz-p.sz)*lr, ca=p.a*(1-lr);
        pGeo.attributes.position.setXYZ(idx, p.x, p.y, p.z);
        pGeo.attributes.color.setXYZ(idx, p.r*ca, p.g*ca, p.b*ca);
        pGeo.attributes.size.setX(idx, csz);
      });
      pGeo.attributes.position.needsUpdate=true;
      pGeo.attributes.color.needsUpdate=true;
      pGeo.attributes.size.needsUpdate=true;

      // ── Traffic Vehicle Update ───────────────────────────────────────────────
      for(let i=vehicles.length-1; i>=0; i--) {
        const v = vehicles[i];
        if(!v.active) continue;

        // BUG 1 FIX — Correct relative motion direction:
        // Oncoming (left lanes): approaching the player head-on → positive z drift (coming at us)
        // Same-dir (right lanes): player overtakes them → positive z drift only when player is faster.
        //   Clamp to ≥0: if traffic is faster than player it simply stays ahead, doesn't approach from behind.
        let relKmh;
        if(v.isOncoming) {
          relKmh = s.speed + v.speed; // always positive — they close on each other
        } else {
          relKmh = Math.max(0, s.speed - v.speed); // only positive when player overtakes; 0 = car stays in front
        }
        v.mesh.position.z += (relKmh * 1000/3600) * dt;

        // ── Curve Follow: Lock car to its curved lane X and rotate along tangent ──
        const curveOff = getCurveOffset(v.mesh.position.z, s.dist);
        const curveAngle = getCurveTangent(v.mesh.position.z, s.dist);
        v.mesh.position.x = v.x + curveOff;
        v.mesh.rotation.y = (v.isOncoming ? 0 : Math.PI) - curveAngle;

        // ── Bounding Box Collision ─────────────────────────────────────────────
        const dx = Math.abs(s.playerX - v.x);
        const dz = Math.abs(v.mesh.position.z);
        const hitW = (v.width+.9)/2;
        const hitL = (v.len+1.6)/2;

        if(dx < hitW && dz < hitL && !s.crashed && !s.levelComplete && (s.invulnTime || 0) <= 0) {
          if(s.speed < 30 || v.isOncoming || dx < hitW * 0.75) {
            triggerCrash(s, v);
          } else {
            // Sideswipe: speed penalty instead of full crash
            s.speed = Math.max(0, s.speed * 0.55);
            s.score = Math.max(0, s.score - 10);
          }
        }

        // ── Obstacle Pass Detection (+10 Golden Score at Obstacle Location) ────
        // ONLY triggers when:
        // 1. Direct Overtake: Player overtakes car ahead in same lane / close adjacent lane (dx <= hitW + 1.6 && s.speed > v.speed)
        // 2. Close Edge Pass: Player skims right along the edge of the vehicle (dx <= hitW + 1.25)
        // Otherwise does NOT trigger if player is far away in another lane.
        if(!v.passed && !s.crashed && !s.levelComplete && v.mesh.position.z > 0.5) {
          v.passed = true;

          const isDirectOvertake = (!v.isOncoming && dx <= hitW + 1.6 && s.speed > v.speed);
          const isCloseEdgePass  = (dx <= hitW + 1.25 && s.speed >= 35);

          if(isDirectOvertake || isCloseEdgePass) {
            s.score += 10;
            s.overtakes = (s.overtakes || 0) + 1;
            s.nitroAvailable = Math.min(100, s.nitroAvailable + 15);
            audio.playCoin();

            // Determine which side of the bike the car was crossed:
            // v.mesh.position.x < s.playerX -> Car is on the LEFT of bike
            // v.mesh.position.x > s.playerX -> Car is on the RIGHT of bike
            const isLeftSide = v.mesh.position.x <= s.playerX;

            _vPos.set(v.mesh.position.x, 1.2, v.mesh.position.z);
            _vPos.project(camera);

            let scrX;
            if(_vPos.z < 1.0) {
              const rawX = (_vPos.x * 0.5 + 0.5) * 100;
              scrX = isLeftSide ? Math.max(14, Math.min(42, rawX)) : Math.max(58, Math.min(86, rawX));
            } else {
              scrX = isLeftSide ? 25 : 75;
            }
            const scrY = Math.max(30, Math.min(68, (-_vPos.y * 0.5 + 0.5) * 100));

            if(triggerScorePopupRef.current) {
              triggerScorePopupRef.current(scrX, scrY);
            }
          }
        }

        // Recycle: lock to same direction type (visual rotation stays correct)
        if(v.mesh.position.z > 40) {
          const matchingLanes = LANE_CONFIGS
            .map((lc,li)=>({lc,li}))
            .filter(({lc})=> lc.oncoming === v.isOncoming);
          const pick = matchingLanes[Math.floor(Math.random()*matchingLanes.length)];
          const lc2 = pick.lc;

          // Same-direction cars get wider recycle spacing so player has passing gaps
          // Oncoming cars recycle closer (exciting near-miss opportunities)
          const baseZ = v.isOncoming
            ? -(ROAD_L * 0.5 + Math.random() * 70)   // oncoming: 210–280m ahead
            : -(120 + Math.random() * 80);             // same-dir: 120–200m ahead (sparse)

          v.mesh.position.z = baseZ;
          v.mesh.position.x = lc2.x;
          v.mesh.rotation.y = lc2.oncoming ? 0 : Math.PI; // Strictly preserve rear view for right lanes
          v.x = lc2.x;
          v.speed = lc2.minSpd + Math.random()*(lc2.maxSpd-lc2.minSpd);
          v.len = lc2.len;
          v.passed = false;
        }

      }

      // ── Camera & Crash Dynamics ─────────────────────────────────────────────
      // ratio = 0→1 mapping of current speed over G5 ceiling (245 km/h)
      const ratio = Math.min(1, s.speed / 245);

      // ── 3D Crash Simulation: Bike Tumble & Rider Ragdoll Physics ───────────────
      if(s.crashed) {
        s.crashTime += dt;
        s.speed = Math.max(0, s.speed - 120 * dt);

        // Bike 3D Tumbling & Ground Bounce
        const gravity = 22;
        s.crashVel.y -= gravity * dt;
        s.crashPos.x += s.crashVel.x * dt;
        s.crashPos.y += s.crashVel.y * dt;
        s.crashPos.z += s.crashVel.z * dt;

        if(s.crashPos.y <= 0.16) {
          s.crashPos.y = 0.16;
          if(s.crashVel.y < -1.5) {
            s.crashVel.y = -s.crashVel.y * 0.32; // bounce
          } else {
            s.crashVel.y = 0;
          }
          // Asphalt sliding friction
          s.crashVel.x *= Math.max(0, 1 - 4.5 * dt);
          s.crashVel.z *= Math.max(0, 1 - 4.5 * dt);
          s.crashRotVel.x *= Math.max(0, 1 - 3.8 * dt);
          s.crashRotVel.y *= Math.max(0, 1 - 3.8 * dt);
          s.crashRotVel.z *= Math.max(0, 1 - 3.8 * dt);
        }

        playerGroup.position.set(s.crashPos.x, s.crashPos.y, s.crashPos.z);
        playerGroup.rotation.x += s.crashRotVel.x * dt;
        playerGroup.rotation.y += s.crashRotVel.y * dt;
        playerGroup.rotation.z += s.crashRotVel.z * dt;

        // Rider Ragdoll 3D Physics (thrown off bike, slides and rolls on asphalt)
        if(riderRef.current) {
          s.riderVel.y -= 24 * dt; // gravity
          s.riderPos.x += s.riderVel.x * dt;
          s.riderPos.y += s.riderVel.y * dt;
          s.riderPos.z += s.riderVel.z * dt;

          if(s.riderPos.y <= 0.22) {
            s.riderPos.y = 0.22;
            if(s.riderVel.y < -1.8) {
              s.riderVel.y = -s.riderVel.y * 0.24; // soft bounce
            } else {
              s.riderVel.y = 0;
            }
            // Asphalt ground roll friction
            s.riderVel.x *= Math.max(0, 1 - 4.8 * dt);
            s.riderVel.z *= Math.max(0, 1 - 4.8 * dt);
            s.riderRotVel.x *= Math.max(0, 1 - 4.2 * dt);
            s.riderRotVel.y *= Math.max(0, 1 - 4.2 * dt);
            s.riderRotVel.z *= Math.max(0, 1 - 4.2 * dt);
          }

          riderRef.current.position.set(s.riderPos.x, s.riderPos.y, s.riderPos.z);
          riderRef.current.rotation.x += s.riderRotVel.x * dt;
          riderRef.current.rotation.y += s.riderRotVel.y * dt;
          riderRef.current.rotation.z += s.riderRotVel.z * dt;
        }

        camera.up.set(0, 1, 0);
        // Camera dramatic tracking during crash
        const focusX = (s.crashPos.x + (s.riderPos?.x ?? s.crashPos.x)) * 0.5;
        const focusZ = (s.crashPos.z + (s.riderPos?.z ?? s.crashPos.z)) * 0.5;
        const targetCamX = focusX * 0.6;
        const targetCamY = 2.4;
        const targetCamZ = focusZ + 5.5;

        camera.position.x += (targetCamX - camera.position.x) * 8 * dt;
        camera.position.y += (targetCamY - camera.position.y) * 8 * dt;
        camera.position.z += (targetCamZ - camera.position.z) * 8 * dt;

        // Controlled collision shockwave decaying smoothly
        const shakeMag = Math.max(0, (1.2 - s.crashTime)) * 0.08;
        if(shakeMag > 0.001) {
          camera.position.x += Math.sin(s.crashTime * 35) * shakeMag;
          camera.position.y += Math.cos(s.crashTime * 28) * shakeMag;
        }
        camera.lookAt(focusX, 0.45, focusZ);

        // After 1.7 seconds of realistic 3D tumbling, open the Game Over popup
        if(s.crashTime >= 1.7 && phase !== 'gameover') {
          setPhase('gameover');
        }
      } else {
        // ── Normal Camera Tracking (when not crashed) ─────────────────────────
        if(riderRef.current) {
          // Hide rider model only during cockpit view to avoid near-frustum clipping & flickering; show in chase view
          riderRef.current.visible = (s.cameraMode !== 'cockpit');
        }

        const currentCurvature = getRoadCurveAt(s.dist);
        if(s.cameraMode==='chase') {
          // Camera follows smoothly directly behind the player's bike
          const targetCamX = s.playerX;
          const targetCamY = 1.82 + ratio * 0.1;
          const targetCamZ = 4.3 - ratio * 0.22;
          camera.position.x += (targetCamX - camera.position.x) * Math.min(1, 16 * dt);
          camera.position.y += (targetCamY - camera.position.y) * Math.min(1, 12 * dt);
          camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, 12 * dt);

          // Smoothly adjust camera FOV only when speed change warrants it
          const targetFov = 64 + ratio * 4;
          if (Math.abs(camera.fov - targetFov) > 0.15) {
            camera.fov += (targetFov - camera.fov) * Math.min(1, 4 * dt);
            camera.updateProjectionMatrix();
          }

          // Camera looks straight ahead down the player's current lane + curve
          const lookAheadCurve = getCurveOffset(-34, s.dist);
          const targetLookX = s.playerX + lookAheadCurve * 0.4;
          if (s._chaseLookX === undefined) s._chaseLookX = targetLookX;
          s._chaseLookX += (targetLookX - s._chaseLookX) * Math.min(1, 16 * dt);

          // Strictly upright horizon: eliminates all camera tilt/roll flicker on turns!
          camera.up.set(0, 1, 0);
          camera.lookAt(s._chaseLookX, 1.12, -26);
        } else {
          // First-person cockpit view — dynamically adapted for screen aspect ratio
          // On portrait phones (360x800, aspect≈0.45) the horizontal FOV shrinks to ~34° which
          // clips the wide handlebars/mirrors. We pull the camera back + up proportionally.
          const aspect = camera.aspect;
          const pFactor = aspect < 1.0 ? Math.max(0, Math.min(1, (1.0 - aspect) * 2.0)) : 0;

          // Eye position: anchored to rider head position
          const eyeZ = -0.05 + pFactor * 0.35;   // desktop: -0.05 | 360x800: ~+0.30
          const eyeY =  1.15 + pFactor * 0.13;   // desktop:  1.15 | 360x800: ~1.28

          _worldEye.set(s.playerX, eyeY + (s.playerLean * s.playerLean) * 0.04, eyeZ);

          // Subtle harmonic engine rev vibration
          if(s.speed > 55) {
            _worldEye.y += Math.sin(performance.now() * 0.045) * ratio * 0.002;
          }

          camera.position.copy(_worldEye);

          // FOV: update projection matrix only if FOV actually changed to avoid pipeline uniform thrashing
          const targetFov = 68 + pFactor * 10 + ratio * 5;
          if (Math.abs(camera.fov - targetFov) > 0.15) {
            camera.fov += (targetFov - camera.fov) * Math.min(1, 4 * dt);
            camera.updateProjectionMatrix();
          }

          // Camera looks down the highway along the curved road ahead (strictly collinear with eye position)
          const lookAheadCurve = getCurveOffset(-36, s.dist);
          const targetLookX = s.playerX + lookAheadCurve * 0.4;
          if (s._cockpitLookX === undefined) s._cockpitLookX = targetLookX;
          s._cockpitLookX += (targetLookX - s._cockpitLookX) * Math.min(1, 16 * dt);
          _lookTarget.set(
            s._cockpitLookX,
            eyeY - 0.06,
            eyeZ - 36
          );

          // Stable forward view vector locked to world-up, completely immune to gimbal lock
          camera.up.set(0, 1, 0);
          camera.lookAt(_lookTarget);
        }
      }

      // HUD: gear comes directly from physics state (1-indexed for display: 1 to 5)
      // RPM = position within current gear band (0 = just shifted in, 1 = redline / ready to upshift)
      const gIdx = Math.min(4, s.gear ?? 0);
      const curG = GEARS[gIdx];
      const prevShift = gIdx === 0 ? 0 : GEARS[gIdx - 1].shift * 0.7;
      const rpm = Math.min(1, Math.max(0, (s.speed - prevShift) / (curG.shift - prevShift)));
      const gear = gIdx + 1; // display as 1–5

      // Throttle HUD React state update to ~30Hz (every 33ms) to avoid re-rendering entire component every animation frame
      if (now - lastHudT > 33) {
        lastHudT = now;
        setHud({
          speed: Math.round(s.speed),
          topSpeed: Math.round(s.maxSpeedReached || s.speed),
          dist: Math.min(s.levelTargetDist, Math.round(s.dist)),
          nitro: Math.round(s.nitroAvailable),
          nitroActive: !!s.nitroActive,
          score: s.score,
          overtakes: s.overtakes || 0,
          curveAhead: getRoadCurveAt(s.dist + 65),
          gear,
          rpm,
          level: s.level,
          targetDist: s.levelTargetDist,
          time: s.levelTime,
        });
      }

      renderer.render(scene, camera);
    } catch (err) {
      console.error('BikeRacer animation error:', err);
    }
    rafRef.current = requestAnimationFrame(animate);
  };

    function triggerCrash(s, hitVehicle = null) {
      if(s.crashed) return;
      s.crashed = true;
      s.crashTime = 0;
      setShattered(true);

      const fwd = Math.max(s.speed * 0.08, 3.5);
      const sideDir = hitVehicle ? (s.playerX >= hitVehicle.x ? 1 : -1) : (s.steer !== 0 ? Math.sign(s.steer) : (Math.random() > 0.5 ? 1 : -1));

      // Bike initial crash tumble physics
      s.crashPos = { x: s.playerX, y: 0.12, z: 0 };
      s.crashVel = {
        x: sideDir * (3.5 + Math.random() * 2.5),
        y: 4.8 + Math.random() * 2.2, // bike pops up into air
        z: hitVehicle?.isOncoming ? 4.5 : -fwd * 0.7
      };
      s.crashRotVel = {
        x: 6.5 + Math.random() * 4,
        y: (Math.random() - 0.5) * 6,
        z: -sideDir * (7.5 + Math.random() * 4) // flips sideways
      };

      // Rider ejection physics: detaches from bike and thrown onto pavement
      if(riderRef.current && sceneRef.current) {
        riderRef.current.visible = true; // Ensure rider is ALWAYS visible on crash!
        const wPos = new THREE.Vector3();
        const wQuat = new THREE.Quaternion();
        riderRef.current.getWorldPosition(wPos);
        riderRef.current.getWorldQuaternion(wQuat);
        sceneRef.current.add(riderRef.current);
        riderRef.current.position.copy(wPos);
        riderRef.current.quaternion.copy(wQuat);

        s.riderPos = { x: wPos.x, y: Math.max(0.8, wPos.y), z: wPos.z };
        s.riderVel = {
          x: sideDir * (2.2 + Math.random() * 2) + (s.steerVel * 0.3),
          y: 5.8 + Math.random() * 2.5, // thrown forward over handlebars
          z: hitVehicle?.isOncoming ? 1.5 : -Math.max(7, fwd * 1.2) // thrown forward
        };
        s.riderRotVel = {
          x: 9 + Math.random() * 5, // front flips
          y: (Math.random() - 0.5) * 6,
          z: (Math.random() - 0.5) * 6
        };
      }

      // If crash occurred in cockpit view, immediately snap camera back so player sees the crash in full dramatic view
      if(cameraRef.current) {
        cameraRef.current.up.set(0, 1, 0);
        if(s.cameraMode === 'cockpit') {
          cameraRef.current.position.set(s.playerX, 2.3, 4.2);
          cameraRef.current.lookAt(s.playerX, 0.6, 0);
        }
      }

      audio.playCrash();
      audio.playGlassShatter();

      // Crash smoke & spark bursts
      for(let p = 0; p < 25; p++) {
        emitSmoke(true, 120);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    // Resize handling
    const onResize = () => {
      const w=container.clientWidth||800, h=container.clientHeight||500;
      const aspect = w/h;
      camera.aspect = aspect;
      if(aspect < 1.0) {
        // Portrait: widen FOV so highway lanes stay visible, don't just squash the scene
        camera.fov = Math.min(92, 65 / aspect * 0.82);
      } else {
        camera.fov = 65;
      }
      camera.updateProjectionMatrix();
      renderer.setSize(w,h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      clearTimeout(safetyTimer);
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect(); audio.stop();
      if(renderer.domElement&&container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Touch handlers
  const gasDown   = useCallback(()=>{ audio.init(); const s=stateRef.current; if(!s.crashed && !s.countdownActive && !s.loading){s.accel=true;} setTouch(t=>({...t,gas:true}));  },[audio]);
  const gasUp     = useCallback(()=>{ stateRef.current.accel=false; setTouch(t=>({...t,gas:false})); },[]);
  const brakeDown = useCallback(()=>{ audio.init(); const s=stateRef.current; if(!s.crashed && !s.countdownActive && !s.loading){s.brake=true; audio.playBrakeSqueal();} setTouch(t=>({...t,brake:true})); },[audio]);
  const brakeUp   = useCallback(()=>{ stateRef.current.brake=false; setTouch(t=>({...t,brake:false})); },[]);

  const steerLDown = useCallback(()=>{ audio.init(); const s=stateRef.current; if(!s.countdownActive && !s.loading){s.steer = -1;} setTouch(t=>({...t, left:true})); },[audio]);
  const steerLUp   = useCallback(()=>{ if(stateRef.current.steer === -1) stateRef.current.steer = 0; setTouch(t=>({...t, left:false})); },[]);
  const steerRDown = useCallback(()=>{ audio.init(); const s=stateRef.current; if(!s.countdownActive && !s.loading){s.steer = 1;} setTouch(t=>({...t, right:true})); },[audio]);
  const steerRUp   = useCallback(()=>{ if(stateRef.current.steer === 1) stateRef.current.steer = 0; setTouch(t=>({...t, right:false})); },[]);

  // Device tilt (gyroscope) steering for Android & Mobile
  useEffect(() => {
    const handleTilt = (e) => {
      const s = stateRef.current;
      if (!s || s.crashed || s.levelComplete || s.countdownActive || s.loading || isPaused) return;
      if (touch.left || touch.right) return;
      const isLandscape = window.innerWidth > window.innerHeight;
      const rawTilt = isLandscape ? e.beta : e.gamma;
      if (rawTilt == null) return;
      const deadzone = 3.5;
      if (Math.abs(rawTilt) < deadzone) {
        if (!touch.left && !touch.right) s.steer = 0;
      } else {
        const sign = rawTilt > 0 ? 1 : -1;
        const normalized = Math.min(1, (Math.abs(rawTilt) - deadzone) / 16);
        s.steer = sign * normalized;
      }
    };
    window.addEventListener('deviceorientation', handleTilt, true);
    return () => window.removeEventListener('deviceorientation', handleTilt, true);
  }, [touch.left, touch.right, isPaused]);

  return (
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',background:'#01050e',overflow:'hidden',touchAction:'none'}}>
      {/* ── Canvas Container ── */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden select-none touch-none">

        {/* ── Game Loading Screen ── */}
        {loading && (
          <div className="absolute inset-0 z-50 bg-[#020617]/98 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none">
            {/* Ambient Background Glow */}
            <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
            <div className="absolute w-60 h-60 rounded-full bg-rose-500/10 blur-3xl pointer-events-none -translate-y-12" />

            {/* Official 3D BIKE RACER Game Logo Badge */}
            <div className="relative flex flex-col items-center mb-6 sm:mb-8">
              <div className="relative flex items-center justify-center px-6 py-3 rounded-2xl bg-gradient-to-b from-slate-800/90 via-slate-900/90 to-black/95 border-2 border-cyan-400/40 shadow-[0_0_35px_rgba(6,182,212,0.35)] backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.6)]">
                    <i className="fa-solid fa-motorcycle text-xl sm:text-2xl text-white drop-shadow" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] sm:text-xs font-black tracking-widest font-mono text-cyan-400 uppercase">HIGHWAY CHASE</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-amber-300 font-sans leading-none drop-shadow-md">
                      3D BIKE RACER
                    </h1>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Stage Title */}
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-widest font-mono uppercase mb-3 drop-shadow-md flex items-center gap-2">
              <span>{loadProgress >= 100 ? 'Ready!' : (loadProgress >= 88 ? 'Preparing Game...' : (loadProgress >= 75 ? 'Loading Assets...' : 'Downloading Resources...'))}</span>
              {loadProgress < 100 && <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
            </h2>

            {/* Progress Bar Container */}
            <div className="w-full max-w-xs sm:max-w-md bg-slate-900/90 rounded-full h-3 sm:h-3.5 border border-white/15 p-0.5 shadow-inner mb-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-rose-500 to-amber-400 transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.7)]"
                style={{ width: `${Math.min(100, Math.max(8, loadProgress))}%` }}
              />
            </div>

            {/* Progress Status and % */}
            <div className="flex items-center justify-between w-full max-w-xs sm:max-w-md text-[11px] sm:text-xs font-mono text-slate-400 px-1 mb-4">
              <span className="truncate text-cyan-300 font-medium">{loadStatus}</span>
              <span className="font-bold text-white ml-2">{Math.round(loadProgress)}%</span>
            </div>

            {/* Steering Tip */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] sm:text-xs font-mono">
              <span className="text-amber-400">💡 Tip:</span>
              <span>Tilt phone or use Left/Right arrows to steer!</span>
            </div>
          </div>
        )}

        {/* ── Arcade Starting Countdown (3 → 2 → 1 → GO!) ── */}
        {countdown !== null && (
          <div className="absolute inset-0 z-45 pointer-events-none select-none flex flex-col items-center justify-center">
            {/* Subtle radial backdrop accent */}
            <div className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-black/40 blur-2xl pointer-events-none" />

            <div
              key={countdown}
              className="relative flex flex-col items-center justify-center animate-[countdownPop_0.5s_cubic-bezier(0.18,0.89,0.32,1.28)_forwards]"
            >
              {countdown === 'GO!' ? (
                <div className="flex flex-col items-center">
                  <div className="px-8 py-3 sm:px-12 sm:py-5 rounded-3xl bg-gradient-to-b from-emerald-500/25 via-slate-900/90 to-black/90 border-3 border-emerald-400 shadow-[0_0_60px_rgba(52,211,153,0.7)] backdrop-blur-md">
                    <span
                      className="text-5xl sm:text-7xl md:text-8xl font-black italic tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-white drop-shadow-[0_0_35px_rgba(52,211,153,0.9)]"
                      style={{ fontFamily: 'Fredoka, sans-serif' }}
                    >
                      GO!
                    </span>
                  </div>
                  <span className="mt-2 text-xs sm:text-sm font-mono font-bold tracking-widest text-emerald-400 uppercase drop-shadow">
                    FULL THROTTLE!
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div
                    className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center border-4 backdrop-blur-md shadow-2xl ${
                      countdown === 3
                        ? 'border-rose-500/80 bg-rose-950/70 shadow-[0_0_50px_rgba(244,63,94,0.6)] text-rose-400'
                        : countdown === 2
                        ? 'border-amber-500/80 bg-amber-950/70 shadow-[0_0_50px_rgba(245,158,11,0.6)] text-amber-400'
                        : 'border-yellow-400/80 bg-yellow-950/70 shadow-[0_0_50px_rgba(250,204,21,0.6)] text-yellow-300'
                    }`}
                  >
                    <span
                      className="text-5xl sm:text-7xl font-black font-mono leading-none drop-shadow-lg"
                      style={{ fontFamily: 'Fredoka, sans-serif' }}
                    >
                      {countdown}
                    </span>
                  </div>
                  <span className="mt-3 text-xs sm:text-sm font-mono font-bold tracking-widest text-slate-200 uppercase px-3 py-1 rounded-full bg-black/60 border border-white/20 backdrop-blur-sm shadow">
                    {countdown === 3 ? 'GET READY' : countdown === 2 ? 'REV ENGINES' : 'HOLD LINE'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Celebratory Birthday Popper / Confetti Effect ── */}
        <ConfettiPopper active={phase === 'levelcomplete'} />

        {/* ── Golden +10 Score Popups (Sleek, reduced font size at obstacle pass location) ── */}
        {scorePopups.map(p => (
          <div
            key={p.id}
            className="absolute pointer-events-none select-none z-35 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/60 border border-amber-400/40 backdrop-blur-[2px] shadow-[0_0_8px_rgba(245,158,11,0.35)] animate-[goldPopFloat_0.8s_cubic-bezier(0.16,1,0.3,1)_forwards]"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
            }}
          >
            <span className="text-amber-300 text-[10px] leading-none">✦</span>
            <span
              className="text-xs md:text-sm font-mono font-black tracking-tight leading-none"
              style={{
                background: 'linear-gradient(180deg, #ffffff 0%, #fde047 30%, #f59e0b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.9))',
              }}
            >
              +10
            </span>
          </div>
        ))}

        {/* ── HUD (Playing) ── */}
        {/* ── HUD (Playing) ── */}
        {phase==='playing' && (
          <div className="absolute inset-0 pointer-events-none z-30 p-3 md:p-5 flex flex-col justify-between">

            {/* Top Row */}
            <div className="flex items-start justify-between w-full gap-2">
              {/* Left Controls: Home, Pause, Horn, Camera, Mobile Games */}
              <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
                {/* 1. Home Button (Shown on Web) */}
                {onClose && (
                  <button
                    onClick={onClose}
                    title="Home / Landing Page"
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-white/25 text-white flex items-center justify-center text-xs sm:text-sm backdrop-blur-md shadow-lg active:scale-90 cursor-pointer transition-all"
                  >
                    <i className="fa-solid fa-house" />
                  </button>
                )}
                {/* Pause Button */}
                <button onClick={togglePause}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/60 border border-white/20 text-white/90 flex items-center justify-center text-xs sm:text-sm backdrop-blur-md shadow-lg active:scale-90 cursor-pointer">
                  <i className={`fa-solid ${isPaused?'fa-play pl-0.5':'fa-pause'}`}/>
                </button>
                {/* Horn Button */}
                <button onClick={()=>audio.playHorn()}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/60 border border-white/20 text-white/90 flex items-center justify-center text-xs sm:text-sm backdrop-blur-md shadow-lg active:scale-90 cursor-pointer">
                  <i className="fa-solid fa-bullhorn text-xs"/>
                </button>
                {/* Camera Toggle Button */}
                <button onClick={toggleCamera}
                  className={`h-8 px-2.5 sm:h-9 sm:px-3 rounded-full border backdrop-blur-md shadow-lg active:scale-90 cursor-pointer flex items-center gap-1.5 text-xs font-bold ${cameraMode==='chase'?'bg-rose-600/35 border-rose-400 text-rose-300':'bg-black/60 border-white/20 text-white/90'}`}>
                  <i className="fa-solid fa-camera text-[11px]"/>
                  <span className="hidden sm:inline">{cameraMode==='chase'?'CHASE':'COCKPIT'}</span>
                </button>
                {/* Mobile Related Games Toggle */}
                <button
                  onClick={() => setShowRelatedMobile(true)}
                  title="Related Games"
                  className="lg:hidden h-8 px-2 sm:h-9 sm:px-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-cyan-400/40 text-cyan-300 flex items-center gap-1 text-[11px] font-bold backdrop-blur-md shadow-lg active:scale-90 cursor-pointer transition-all"
                >
                  <i className="fa-solid fa-gamepad" />
                  <span className="hidden sm:inline">Games</span>
                </button>
              </div>

              {/* Center Scoreboard: Level & Distance Target */}
              <div className="flex flex-col items-center pointer-events-auto">
                <div className="flex items-center gap-2 bg-black/70 border border-amber-500/40 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full backdrop-blur-md shadow-2xl">
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-[10px] sm:text-xs px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                    LVL {hud.level}/5
                  </span>
                  <div className="flex items-center gap-1 font-mono text-[11px] sm:text-xs">
                    <span className="text-white/60">DIST:</span>
                    <span className="text-emerald-400 font-bold">{formatDist(hud.dist)}</span>
                    <span className="text-white/40">/</span>
                    <span className="text-slate-300 font-bold">{formatDist(hud.targetDist)}</span>
                  </div>
                </div>

                {/* Race Progress Bar */}
                <div className="w-36 sm:w-52 h-1.5 bg-slate-900/80 rounded-full mt-1.5 overflow-hidden border border-white/10 backdrop-blur-sm">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-amber-400 to-emerald-400 transition-all duration-75"
                    style={{ width: `${Math.min(100, (hud.dist / (hud.targetDist || 100)) * 100)}%` }}
                  />
                </div>

                {/* Upcoming Curve Warning Badge */}
                {Math.abs(hud.curveAhead || 0) > 0.35 && (
                  <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/60 text-amber-300 font-mono text-[10px] font-black tracking-wider animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)] mt-1 select-none">
                    <span className="text-xs">{(hud.curveAhead || 0) > 0 ? '⮞' : '⮜'}</span>
                    <span>{(hud.curveAhead || 0) > 0 ? 'RIGHT CURVE AHEAD' : 'LEFT CURVE AHEAD'}</span>
                  </div>
                )}
              </div>

              {/* Right: Unified Speed, RPM & Nitro cluster */}
              <div className="flex flex-col items-end gap-1 pointer-events-auto shrink-0">
                {/* Speed & Gear pill */}
                <div className="flex items-center gap-1.5 sm:gap-2 bg-black/70 border border-white/20 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full backdrop-blur-md shadow-xl">
                  <span className="text-rose-400 font-black text-sm sm:text-base font-mono">{hud.speed}</span>
                  <span className="text-white/50 text-[9px] sm:text-[10px] font-bold">KM/H</span>
                  <span className="text-white/25 text-xs">|</span>
                  <span className="text-slate-300 text-[10px] sm:text-[11px] font-mono font-bold">G{hud.gear}</span>
                  <span className="text-white/25 text-xs">|</span>
                  <span className="text-amber-400 text-[10px] sm:text-[11px] font-mono font-bold" title="Overtakes">🚗 {hud.overtakes}</span>
                </div>

                {/* RPM bar */}
                <div className="w-28 sm:w-44 h-1 sm:h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-white/10 backdrop-blur-md">
                  <div className="h-full rounded-full transition-all duration-75"
                    style={{width:`${Math.round(hud.rpm*100)}%`, background:`linear-gradient(90deg, #22c55e ${hud.rpm<.6?'':','} ${hud.rpm>=.6?'#f59e0b':''} ${hud.rpm>=.85?', #ef4444':''})`}}/>
                </div>
              </div>
            </div>

            {/* ── Desktop Cockpit View Side Panel: Ad Space & Related Games ── */}
            {cameraMode === 'cockpit' && (
              <div className="hidden lg:flex absolute top-20 right-4 flex-col gap-3 pointer-events-auto z-20 w-64 select-none">
                {/* Side Ad Space Container */}
                <div className="rounded-2xl border border-white/15 bg-slate-900/80 backdrop-blur-md p-3 shadow-2xl flex flex-col items-center text-center">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-amber-400 font-bold mb-1">
                    ✦ SPONSORED AD SPACE
                  </span>
                  <div className="w-full h-16 rounded-xl border border-dashed border-white/20 bg-black/40 flex flex-col items-center justify-center text-slate-400">
                    <i className="fa-solid fa-rectangle-ad text-lg text-slate-500 mb-0.5" />
                    <span className="text-[10px] text-slate-400 font-mono">300 x 100 Ad Banner</span>
                  </div>
                </div>

                {/* Scrollable Related Games Section */}
                <div className="rounded-2xl border border-white/15 bg-slate-900/85 backdrop-blur-md p-3 shadow-2xl flex flex-col">
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <i className="fa-solid fa-gamepad text-cyan-400" />
                      <span>Related Games</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/70 px-1.5 py-0.5 rounded-full border border-cyan-700/50">
                      {RELATED_GAMES.length}
                    </span>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {RELATED_GAMES.map(g => (
                      <div
                        key={g.id}
                        onClick={() => handleLaunchRelatedGame(g.id)}
                        className="flex items-center justify-between p-1.5 rounded-xl bg-black/40 hover:bg-white/10 border border-white/5 hover:border-cyan-500/40 cursor-pointer transition-all active:scale-95 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${g.color} flex items-center justify-center text-white text-xs shrink-0 shadow-sm`}>
                            <i className={`fa-solid ${g.icon}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                              {g.title}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <span>{g.category}</span>
                              <span className="text-amber-400">★ {g.rating}</span>
                            </div>
                          </div>
                        </div>
                        <button className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:bg-cyan-500 group-hover:text-black transition-colors shrink-0">
                          Play
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Mobile Related Games & Ad Sheet Modal ── */}
            {showRelatedMobile && (
              <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-3 sm:p-4 pointer-events-auto">
                <div className="bg-slate-900 border border-white/15 rounded-3xl p-4 max-h-[82vh] flex flex-col shadow-2xl animate-[slideUp_0.25s_ease-out]">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-gamepad text-cyan-400 text-lg" />
                      <h3 className="font-bold text-white text-base">Featured & Related Games</h3>
                    </div>
                    <button
                      onClick={() => setShowRelatedMobile(false)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
                    >
                      <i className="fa-solid fa-xmark text-sm" />
                    </button>
                  </div>

                  {/* Mobile Ad Space Banner */}
                  <div className="my-3 p-2.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">✦ AD SPACE</span>
                    <span className="text-[10px] text-slate-400 font-mono">Mobile Banner (320x50)</span>
                  </div>

                  {/* Scrollable List */}
                  <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                    {RELATED_GAMES.map(g => (
                      <div
                        key={g.id}
                        onClick={() => {
                          setShowRelatedMobile(false);
                          handleLaunchRelatedGame(g.id);
                        }}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 active:bg-white/10 border border-white/5 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${g.color} flex items-center justify-center text-white text-sm shrink-0`}>
                            <i className={`fa-solid ${g.icon}`} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{g.title}</div>
                            <div className="text-xs text-slate-400">{g.category} • <span className="text-amber-400">★ {g.rating}</span></div>
                          </div>
                        </div>
                        <button className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md">
                          Play
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Bottom Touch Controls: Steer (Left) & Brake + Nitro + Gas (Right) ── */}
            <div
              className="flex items-end justify-between w-full px-2 sm:px-3 pb-2 sm:pb-3 pointer-events-auto select-none touch-none"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
            >
              {/* Steer buttons (Left thumb) */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onPointerDown={steerLDown} onPointerUp={steerLUp} onPointerCancel={steerLUp}
                  className={`w-13 h-15 sm:w-16 sm:h-18 rounded-2xl border-2 flex flex-col items-center justify-center select-none touch-none shadow-xl cursor-pointer active:scale-90 transition-transform ${touch.left ? 'bg-cyan-500/60 border-cyan-300 scale-95 shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-black/55 border-white/25 backdrop-blur-md'}`}>
                  <i className="fa-solid fa-caret-left text-xl sm:text-2xl text-white/90" />
                  <span className="text-[8px] font-bold text-white/70 tracking-wider">LEFT</span>
                </button>
                <button
                  onPointerDown={steerRDown} onPointerUp={steerRUp} onPointerCancel={steerRUp}
                  className={`w-13 h-15 sm:w-16 sm:h-18 rounded-2xl border-2 flex flex-col items-center justify-center select-none touch-none shadow-xl cursor-pointer active:scale-90 transition-transform ${touch.right ? 'bg-cyan-500/60 border-cyan-300 scale-95 shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-black/55 border-white/25 backdrop-blur-md'}`}>
                  <i className="fa-solid fa-caret-right text-xl sm:text-2xl text-white/90" />
                  <span className="text-[8px] font-bold text-white/70 tracking-wider">RIGHT</span>
                </button>
              </div>

              {/* Right group: Brake + (Nitro stacked directly above Accelerate/Gas) */}
              <div className="flex items-end gap-2 sm:gap-3">
                {/* Brake Pedal */}
                <button
                  onPointerDown={brakeDown} onPointerUp={brakeUp} onPointerCancel={brakeUp}
                  className={`w-13 h-16 sm:w-16 sm:h-20 rounded-2xl border-2 flex flex-col items-center justify-center select-none touch-none shadow-xl cursor-pointer active:scale-90 transition-transform ${touch.brake ? 'bg-red-500/60 border-red-400 scale-95 shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'bg-black/55 border-white/25 backdrop-blur-md'}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {[0,1,2].map(i=><div key={i} className="w-5 sm:w-6 h-1.5 rounded-full bg-white/80"/>)}
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-bold text-white/70 mt-1 tracking-wider">BRAKE</span>
                </button>

                {/* Vertical Column for Nitro (Top) and Accelerate/Gas (Bottom) - NEVER overlaps */}
                <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                  {/* Nitro Boost Button (Positioned right above Accelerate) */}
                  <button
                    type="button"
                    onClick={triggerNitro}
                    disabled={hud.nitro < 100 || hud.nitroActive}
                    className={`w-15 h-11 sm:w-20 sm:h-13 rounded-2xl border-2 flex items-center justify-center gap-1 select-none touch-none shadow-xl cursor-pointer active:scale-90 transition-all ${
                      hud.nitroActive
                        ? 'bg-cyan-500/90 border-cyan-300 text-white shadow-[0_0_25px_rgba(6,182,212,0.9)] scale-95'
                        : hud.nitro >= 100
                        ? 'bg-gradient-to-r from-cyan-500/85 to-blue-600/85 border-cyan-300 text-white shadow-[0_0_18px_rgba(6,182,212,0.8)] animate-pulse hover:scale-105'
                        : 'bg-black/55 border-white/20 text-white/35 cursor-not-allowed opacity-70'
                    }`}
                  >
                    <i className={`fa-solid fa-fire-flame-curved text-sm sm:text-base ${hud.nitroActive ? 'animate-bounce text-yellow-300' : hud.nitro >= 100 ? 'text-cyan-200' : 'text-white/40'}`} />
                    <span className="text-[10px] sm:text-xs font-black tracking-wider font-mono">
                      {hud.nitroActive ? 'BOOST' : hud.nitro >= 100 ? 'NITRO' : `${hud.nitro}%`}
                    </span>
                  </button>

                  {/* Accelerate / Gas Pedal */}
                  <button
                    onPointerDown={gasDown} onPointerUp={gasUp} onPointerCancel={gasUp}
                    className={`w-15 h-18 sm:w-20 sm:h-22 rounded-2xl border-2 flex flex-col items-center justify-center select-none touch-none shadow-xl cursor-pointer active:scale-90 transition-transform ${touch.gas ? 'bg-emerald-500/60 border-emerald-400 scale-95 shadow-[0_0_18px_rgba(16,185,129,0.7)]' : 'bg-black/55 border-white/25 backdrop-blur-md'}`}
                  >
                    <div className="flex items-center justify-center gap-1 h-7 sm:h-8">
                      {[7,10,7].map((h,i)=><div key={i} style={{height:`${h*3}px`}} className="w-1.5 rounded-full bg-white/80"/>)}
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-white/80 mt-0.5 tracking-wider">GAS</span>
                  </button>
                </div>
              </div>
            </div>


          </div>
        )}

        {/* ── Pause Overlay ── */}
        {isPaused && phase==='playing' && (
          <div className="absolute inset-0 z-40 bg-black/72 backdrop-blur-md flex flex-col items-center justify-center gap-4">
            <i className="fa-solid fa-pause text-5xl text-white/80 mb-2"/>
            <h2 className="text-3xl font-black text-white">PAUSED</h2>
            <button onClick={togglePause} className="bg-gradient-to-r from-rose-500 to-rose-700 text-white font-bold px-8 py-2.5 rounded-xl shadow-lg cursor-pointer text-sm active:scale-95">
              ▶ RESUME
            </button>
          </div>
        )}

        {/* ── Level Completed Popup (Levels 1 to 4) ── */}
        {phase === 'levelcomplete' && stateRef.current.level < 5 && (
          <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-3xl mb-3 shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-bounce">
              🏁
            </div>
            <div className="inline-block bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-mono font-bold px-3 py-1 rounded-full mb-1">
              FINISH LINE CROSSED
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-wide mb-1" style={{fontFamily:'Fredoka,sans-serif'}}>
              LEVEL {stateRef.current.level} COMPLETED!
            </h2>
            <p className="text-slate-300 text-xs md:text-sm max-w-sm mb-5">
              Outstanding racing! You reached the required distance and crossed the finish line.
            </p>

            <div className="flex flex-wrap gap-3 md:gap-8 justify-center bg-slate-900/90 p-4 md:px-7 md:py-5 rounded-2xl border border-slate-700 shadow-2xl mb-6 backdrop-blur-md">
              <div className="text-center">
                <div className="text-slate-400 text-[11px] font-semibold tracking-wider">LEVEL</div>
                <div className="text-xl md:text-2xl font-black font-mono text-cyan-400">{stateRef.current.level} / 5</div>
              </div>
              <div className="w-[1px] bg-slate-700 my-1"/>
              <div className="text-center">
                <div className="text-slate-400 text-[11px] font-semibold tracking-wider">DISTANCE</div>
                <div className="text-xl md:text-2xl font-black font-mono text-amber-400">{formatDist(LEVEL_DISTANCES[stateRef.current.level - 1])}</div>
              </div>
              <div className="w-[1px] bg-slate-700 my-1"/>
              <div className="text-center">
                <div className="text-slate-400 text-[11px] font-semibold tracking-wider">TIME TAKEN</div>
                <div className="text-xl md:text-2xl font-black font-mono text-emerald-400">{currentLevelTime.toFixed(2)}s</div>
              </div>
              <div className="w-[1px] bg-slate-700 my-1"/>
              <div className="text-center">
                <div className="text-slate-400 text-[11px] font-semibold tracking-wider">TOP SPEED</div>
                <div className="text-xl md:text-2xl font-black font-mono text-rose-400">
                  {levelTopSpeed || hud.topSpeed || Math.round(stateRef.current.maxSpeedReached || hud.speed)} KM/H
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={nextLevel}
                className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:brightness-110 text-white font-black px-8 py-3 rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95 cursor-pointer text-sm md:text-base flex items-center justify-center gap-2">
                <span>Next Level ({stateRef.current.level + 1}/5)</span>
                <i className="fa-solid fa-arrow-right text-xs"/>
              </button>
              <button
                onClick={replayLevel}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold px-6 py-3 rounded-xl active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2">
                <i className="fa-solid fa-rotate-left text-xs"/>
                <span>Replay</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Level 5 Final Completion Screen (Grand Champion) ── */}
        {phase === 'levelcomplete' && stateRef.current.level >= 5 && (
          <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-4xl mb-3 shadow-[0_0_35px_rgba(245,158,11,0.5)] animate-bounce">
              🏆
            </div>
            <div className="inline-block bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-mono font-bold px-4 py-1 rounded-full mb-1">
              GRAND CHAMPION
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-wide mb-1" style={{fontFamily:'Fredoka,sans-serif'}}>
              ALL 5 LEVELS COMPLETED!
            </h2>
            <p className="text-slate-300 text-xs md:text-sm max-w-md mb-4">
              Legendary ride! You completed every highway race distance and set record times across all 5 levels.
            </p>

            {/* Level times breakdown table */}
            <div className="w-full max-w-md bg-slate-900/90 rounded-2xl border border-slate-700 shadow-2xl p-4 mb-5 text-left backdrop-blur-md">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-800 flex justify-between">
                <span>Stage / Level</span>
                <span>Distance</span>
                <span>Completion Time</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                {LEVEL_DISTANCES.map((d, idx) => {
                  const lvl = idx + 1;
                  const t = (lvl === 5 ? currentLevelTime : levelTimes[lvl]) || 0;
                  return (
                    <div key={lvl} className="flex justify-between items-center py-1 px-2 rounded bg-slate-800/40">
                      <span className="font-bold text-white">Level {lvl}</span>
                      <span className="text-slate-400">{formatDist(d)}</span>
                      <span className="font-bold text-emerald-400">{t > 0 ? `${t.toFixed(2)}s` : '-'}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-700/80 font-bold text-sm">
                  <span className="text-amber-400">TOTAL RACE TIME</span>
                  <span className="text-amber-300 font-mono">
                    {Object.values({ ...levelTimes, 5: currentLevelTime }).reduce((a, b) => a + b, 0).toFixed(2)}s
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => restartRace(true)}
                className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-110 text-black font-black px-8 py-3 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.5)] active:scale-95 cursor-pointer text-sm md:text-base flex items-center justify-center gap-2">
                <span>🏆 Play Again (Level 1)</span>
              </button>
              <button
                onClick={replayLevel}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold px-6 py-3 rounded-xl active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2">
                <i className="fa-solid fa-rotate-left text-xs"/>
                <span>Replay Level 5</span>
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold px-5 py-3 rounded-xl cursor-pointer text-sm flex items-center justify-center gap-2">
                  <i className="fa-solid fa-house text-xs"/>
                  <span>Home</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Shattered Mirror / Broken Glass Overlay (Active on crash and frames Game Over) ── */}
        {shattered && (
          <ShatteredMirrorOverlay isGameOver={phase === 'gameover'} />
        )}

        {/* ── Rewarded Ad Playing Modal Overlay (Google Ads ready) ── */}
        {adPlaying && (
          <div className="absolute inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-[fadeIn_0.2s_ease-out]">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-3xl mb-3 shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-pulse">
              📺
            </div>
            <div className="inline-block bg-amber-400/20 border border-amber-400/60 text-amber-300 text-xs font-mono font-bold px-3 py-1 rounded-full mb-2">
              REWARDED AD [TEST MODE]
            </div>
            <h3 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              Watching Ad to Continue...
            </h3>
            <p className="text-slate-300 text-xs max-w-xs mb-5">
              Google Ads integration ready. Your bike will revive at current distance with a 4s shield!
            </p>

            {/* Countdown Progress Bar */}
            <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/20 mb-2">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-700 ease-linear"
                style={{ width: `${((3 - adCountdown) / 3) * 100}%` }}
              />
            </div>
            <div className="text-amber-300 font-mono text-xs font-bold mb-4">
              Resuming in {adCountdown}s...
            </div>

            {/* Quick Skip for testing */}
            <button
              onClick={() => {
                setAdPlaying(false);
                revivePlayer();
              }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Skip Ad & Revive Now ⏩
            </button>
          </div>
        )}

        {/* ── Game Over Screen ── */}
        {phase==='gameover' && (
          <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-[fadeIn_0.3s_ease-out]">
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/55 flex items-center justify-center text-3xl mb-3 animate-bounce">💥</div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-1" style={{fontFamily:'Fredoka,sans-serif'}}>CRASHED!</h2>
              <p className="text-slate-300 text-xs max-w-xs mb-5">You hit highway traffic at high speed. Keep your line and overtake cleanly.</p>
              <div className="flex justify-center gap-8 bg-slate-900/85 px-7 py-4 rounded-2xl border border-slate-700/80 mb-5 backdrop-blur-md shadow-2xl">
                {[['DISTANCE',`${hud.dist}m`,'text-amber-400'],['OVERTAKES',hud.overtakes,'text-emerald-400']].map(([l,v,cls])=>(
                  <div key={l} className="text-center min-w-[90px]">
                    <div className="text-slate-400 text-[11px] font-semibold tracking-wider">{l}</div>
                    <div className={`text-2xl md:text-3xl font-black font-mono ${cls}`}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={continueWithAd}
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-110 text-black font-black px-6 py-2.5 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.5)] active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-play text-xs"/>
                  <span>Watch Ad to Continue</span>
                  <span className="text-[10px] bg-black/35 text-amber-200 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">AD</span>
                </button>
                <button 
                  onClick={() => restartRace(false)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-rotate-left text-xs"/>
                  <span>Restart Game</span>
                </button>
                {onClose && (
                  <button 
                    onClick={onClose}
                    className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer text-sm flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-house text-xs"/>
                    <span>Home</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
