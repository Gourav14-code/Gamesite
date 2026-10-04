import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import BikeRacer from './pages/BikeRacer.jsx';
import WebGame from './pages/WebGame.jsx';
import PistolDuel from './pages/PistolDuel.jsx';
import CyberCursor from './components/CyberCursor.jsx';

export default function App() {
  const isNative = Capacitor.isNativePlatform();

  // In native Android apps:
  // - If window.__APP_TARGET__ === 'bikeracer' -> starts 3D Bike Racer directly
  // - If window.__APP_TARGET__ === 'pistolfight' -> starts Pistol Fight directly
  // In web browser (desktop/laptop/mobile), defaults to main portal!
  const [view, setView] = useState(() => {
    if (isNative) {
      if (window.__APP_TARGET__ === 'bikeracer') return 'bikeracer';
      if (window.__APP_TARGET__ === 'pistolfight') return 'duel';
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'bikeracer' || params.get('game') === 'bikeracer') {
        return 'bikeracer';
      }
      return 'duel';
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'bikeracer' || params.get('game') === 'bikeracer') {
      return 'bikeracer';
    }
    if (
      params.get('view') === 'duel' ||
      params.get('game') === 'duel' ||
      params.get('view') === 'pistolfight' ||
      params.get('game') === 'pistolfight'
    ) {
      return 'duel';
    }
    return 'portal';
  });

  const handleSelectGame = (gameId) => {
    if (gameId === -1) {
      setView('bikeracer');
      if (!isNative) {
        window.history.pushState({}, '', '?view=bikeracer');
      }
    } else {
      setView('portal');
      if (!isNative) {
        window.history.pushState({}, '', window.location.pathname);
      }
    }
  };

  const handleCloseBike = () => {
    setView('portal');
    if (!isNative) {
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  // Sync browser back/forward buttons
  useEffect(() => {
    if (isNative) return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'bikeracer' || params.get('game') === 'bikeracer') {
        setView('bikeracer');
      } else if (params.get('view') === 'duel' || params.get('game') === 'duel') {
        setView('duel');
      } else {
        setView('portal');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isNative]);

  if (view === 'bikeracer') {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black select-none touch-none">
        <BikeRacer
          onClose={!isNative ? handleCloseBike : undefined}
          onSelectGame={!isNative ? handleSelectGame : undefined}
        />
      </div>
    );
  }

  if (view === 'duel') {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#0c0e12] select-none touch-none flex items-center justify-center p-0">
        <PistolDuel
          onHome={() => {
            setView('portal');
            if (!isNative) window.history.pushState({}, '', window.location.pathname);
          }}
          onClose={() => {
            setView('portal');
            if (!isNative) window.history.pushState({}, '', window.location.pathname);
          }}
          onSelectGame={(gameId) => handleSelectGame(gameId)}
          isFullscreen={true}
        />
      </div>
    );
  }

  return (
    <>
      <CyberCursor />
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
        <WebGame onLaunchBike={() => handleSelectGame(-1)} />
      </div>
    </>
  );
}
