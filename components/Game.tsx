'use client';

import { Suspense, useEffect } from 'react';
import * as runtime from '@/lib/runtime';
import { Canvas, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { KeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { Hospital } from './world/Hospital';
import { City } from './world/City';
import { Ground } from './world/Ground';
import { Sky } from './world/Sky';
import DayNight from './world/DayNight';
import Foliage from './world/Foliage';
import Doctor from './player/Doctor';
import CameraFollow from './player/CameraFollow';
import TouchControls from './player/TouchControls';
import GameFlow from './GameFlow';
import Baby from './npcs/Baby';
import Parent from './npcs/Parent';
import Toonify from './fx/Toonify';
import StaticBatcher from './fx/StaticBatcher';
import { ShadowQuality } from './fx/Shadows';
import Particles from './fx/Particles';
import PostFX from './fx/PostFX';
import AdaptiveQuality, { useRenderQuality } from './fx/AdaptiveQuality';
import LevelUp from './ui/LevelUp';
import Minimap from './ui/Minimap';
import Ambulances, { fleet } from './world/Ambulances';
import RideOverlay from './ui/RideOverlay';
import Town from './world/Town';
import Traffic from './world/Traffic';
import Walker from './people/Walker';
import { WALKERS, walkerPositions } from '@/lib/walkers';
import ObjectiveArrow from './fx/ObjectiveArrow';
import { NPCS } from '@/lib/npcs';
import Zones from './world/Zones';
import Residencial from './world/Residencial';
import School from './world/School';
import Playground from './world/Playground';
import HospitalDecor from './world/HospitalDecor';
import HospitalDoor from './world/HospitalDoor';
import Shop from './ui/Shop';
import Album from './ui/Album';
import Tutorial from './ui/Tutorial';
import Elevator from './ui/Elevator';
import Cat from './cats/Cat';
import { CATS } from '@/lib/cats';
import { HudButtons, Toaster } from './ui/Hud';
import { useGameStore } from '@/store/gameStore';

/** Key‑map for KeyboardControls */
const KEY_MAP = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
];

/** ?debug: expone el renderer para medir draw calls y triángulos */
function DebugGl() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as Record<string, unknown>).__gl = { gl, scene };
    }
  }, [gl, scene]);
  return null;
}

/* ─── Loading fallback ─── */
function LoadingScreen() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#87CEEB',
        color: '#fff',
        fontSize: 32,
        fontWeight: 700,
        fontFamily: 'sans-serif',
        zIndex: 100,
      }}
    >
      Cargando mundo...
    </div>
  );
}

/* ─── Main Game component ─── */
export default function Game() {
  const started = useGameStore((s) => s.started);
  const dpr = useRenderQuality((s) => s.dpr);

  // ?debug expone el runtime en la consola (adelantar la hora, teletransportar, etc.)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as Record<string, unknown>).__sb = { ...runtime, store: useGameStore, fleet, walkerPositions };
    }
  }, []);

  return (
    <div style={{ width: '100vw', height: '100dvh', position: 'relative', overflow: 'hidden', touchAction: 'none' }}>
      {started && <TouchControls />}
      {started && <GameFlow />}
      {started && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 25, pointerEvents: 'none' }}>
          <Minimap />
          <HudButtons />
          <Toaster />
          <Shop />
          <Album />
          <Tutorial />
          <Elevator />
          <RideOverlay />
        </div>
      )}
      <LevelUp />

      <Suspense fallback={<LoadingScreen />}>
        <KeyboardControls map={KEY_MAP}>
          <Canvas
            shadows={{ type: THREE.PCFShadowMap }}
            dpr={dpr}
            style={{ width: '100%', height: '100%', touchAction: 'none' }}
            camera={{ fov: 50, near: 0.1, far: 500, position: [0, 13, 30] }}
            gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping }}
          >
            <AdaptiveQuality />

            <DebugGl />
            <ShadowQuality />
            <DayNight />

            <Physics gravity={[0, -24, 0]}>
              <Ground />
              <Hospital />
              <City />
              <School />
              <Residencial />
              <Town />
              <Playground />
              <Doctor />
              {/* NPCs (definidos en lib/npcs.ts) */}
              {NPCS.map((n) =>
                n.kind === 'baby' ? (
                  <Baby key={n.id} id={n.id} position={n.position} name={n.name} bodyColor={n.color} />
                ) : (
                  <Parent key={n.id} id={n.id} position={n.position} variant={n.kind} hasBaby={n.hasBaby} name={n.name} color={n.color} />
                ),
              )}
              <CameraFollow />
            </Physics>

            <Ambulances />
            <Zones />
            <HospitalDecor />
            <HospitalDoor />
            {CATS.map((c) => (
              <Cat key={c.id} def={c} />
            ))}
            {WALKERS.map((w) => (
              <Walker key={w.id} def={w} />
            ))}
            <Traffic />
            <ObjectiveArrow />
            <Foliage />
            <Sky />
            <Particles />
            <Toonify />
            <StaticBatcher />
            <PostFX />
          </Canvas>
        </KeyboardControls>
      </Suspense>
      {/* Viñeta común a ambas calidades, sin otra pasada de postprocesado. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.2) 100%)' }} />
    </div>
  );
}
