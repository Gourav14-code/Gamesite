import React, { useState, useEffect, useRef } from 'react';

/**
 * CyberCircuitCursor Component
 * Official Cyber Circuit Animated Cursor system (/cursor/cyber-circuit-animated-cursor/)
 * Features:
 * - Real-time animated cyber circuit cursor & cyber pointer (replacing the default click sign)
 * - Trailing holographic PCB reticle ring with microchip nodes
 * - Target lock bracket HUD on hover
 * - High-voltage electric spark particles on click
 * - Native zero-latency cursor fallback in CSS
 */
export default function CyberCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [trailingPos, setTrailingPos] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isText, setIsText] = useState(false);
  const [sparks, setSparks] = useState([]);
  const [enabled, setEnabled] = useState(true);

  const trailingPosRef = useRef({ x: -100, y: -100 });
  const mousePosRef = useRef({ x: -100, y: -100 });
  const animFrameRef = useRef(null);

  const isVisibleRef = useRef(false);

  useEffect(() => {
    // Check if device supports fine pointer (mouse / trackpad), not touch-only
    const hasPointer = window.matchMedia('(pointer: fine)').matches;
    if (!hasPointer) {
      setEnabled(false);
      return;
    }

    // Add custom cursor class to document element
    document.documentElement.classList.add('custom-cyber-cursor');

    const handleMouseMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      setPos({ x: e.clientX, y: e.clientY });
      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
      }

      // Check if hovering interactive element or text input
      const target = e.target;
      if (target && typeof target.closest === 'function') {
        const interactive = target.closest(
          'a, button, input, select, textarea, [role="button"], [data-testid], .cursor-pointer, label, summary, [tabindex="0"]'
        );
        const textInput = target.closest(
          'input[type="text"], input[type="search"], input[type="password"], input[type="email"], textarea'
        );
        setIsHovered(!!interactive);
        setIsText(!!textInput);
      }
    };

    const handleMouseDown = (e) => {
      setIsClicked(true);
      // Spawn 8 high-energy cyber electric spark particles
      const newSparks = Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const speed = 25 + Math.random() * 25;
        return {
          id: Date.now() + i,
          x: e.clientX,
          y: e.clientY,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          size: 2.5 + Math.random() * 2.5,
          color: i % 2 === 0 ? '#00f3ff' : '#ec4899',
          opacity: 1
        };
      });
      setSparks(prev => [...prev.slice(-16), ...newSparks]);
    };

    const handleMouseUp = () => {
      setIsClicked(false);
    };

    const handleMouseLeave = () => {
      isVisibleRef.current = false;
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      isVisibleRef.current = true;
      setIsVisible(true);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // Smooth trailing animation loop for holographic HUD elements
    const animateTrail = () => {
      const ease = 0.24;
      trailingPosRef.current.x += (mousePosRef.current.x - trailingPosRef.current.x) * ease;
      trailingPosRef.current.y += (mousePosRef.current.y - trailingPosRef.current.y) * ease;
      setTrailingPos({ ...trailingPosRef.current });

      // Decay spark particles
      setSparks(prev =>
        prev
          .map(s => ({
            ...s,
            x: s.x + s.dx * 0.16,
            y: s.y + s.dy * 0.16,
            opacity: s.opacity - 0.045
          }))
          .filter(s => s.opacity > 0)
      );

      animFrameRef.current = requestAnimationFrame(animateTrail);
    };

    animFrameRef.current = requestAnimationFrame(animateTrail);

    return () => {
      document.documentElement.classList.remove('custom-cyber-cursor');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  if (!enabled || !isVisible || pos.x < 0 || pos.y < 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden select-none"
      data-testid="cyber-circuit-cursor-container"
      aria-hidden="true"
    >
      {/* 1. Trailing Holographic Rotating Circuit Reticle */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 will-change-transform"
        style={{
          left: `${trailingPos.x}px`,
          top: `${trailingPos.y}px`,
          transform: `translate(-50%, -50%) scale(${isClicked ? 0.8 : isHovered ? 1.3 : 1})`,
          transition: 'transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <svg
          width={isHovered ? '54' : '40'}
          height={isHovered ? '54' : '40'}
          viewBox="0 0 50 50"
          className={isHovered ? 'animate-[spin_3s_linear_infinite]' : 'animate-[spin_8s_linear_infinite]'}
        >
          {/* Outer PCB Ring */}
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke={isHovered ? '#ec4899' : '#00f3ff'}
            strokeWidth="1.2"
            strokeDasharray={isHovered ? '6 3' : '10 5'}
            className="opacity-80 filter drop-shadow-[0_0_6px_#00f3ff]"
          />

          {/* 4 Microchip Nodes */}
          <circle cx="25" cy="5" r="2.2" fill={isHovered ? '#00f3ff' : '#ec4899'} className="animate-pulse" />
          <circle cx="45" cy="25" r="2.2" fill={isHovered ? '#ec4899' : '#00f3ff'} className="animate-pulse" />
          <circle cx="25" cy="45" r="2.2" fill={isHovered ? '#00f3ff' : '#ec4899'} className="animate-pulse" />
          <circle cx="5" cy="25" r="2.2" fill={isHovered ? '#ec4899' : '#00f3ff'} className="animate-pulse" />

          {/* Circuit PCB Traces */}
          <path
            d="M25 8 L25 14 M42 25 L36 25 M25 42 L25 36 M8 25 L14 25"
            stroke={isHovered ? '#ec4899' : '#00f3ff'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Hover Target Lock Reticle Brackets */}
        {isHovered && (
          <div className="absolute inset-0 flex items-center justify-center animate-ping opacity-25">
            <div className="w-12 h-12 border border-cyan-400 rounded-full" />
          </div>
        )}
      </div>

      {/* 2. Click Concentric Sonar Shockwaves */}
      {isClicked && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-cyan-400 animate-ping opacity-75"
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`
          }}
        />
      )}

      {/* 4. High-Voltage Electric Spark Particles */}
      {sparks.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${s.x}px`,
            top: `${s.y}px`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: s.color,
            opacity: s.opacity,
            boxShadow: `0 0 8px ${s.color}`
          }}
        />
      ))}
    </div>
  );
}

