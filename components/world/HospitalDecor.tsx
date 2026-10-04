'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { useFloorVisibility } from './useFloorVisibility';

/*
 * Decoraciones del hospital que se compran en la farmacia.
 * Solo visuales (sin colisión) para no bloquear el paso entre las camas.
 * Hospital: x ±12, z ±9; recepción en z = -5; camas a los costados.
 */

function Plant({ position, color = '#66bb6a', pot = '#ff8a65' }: { position: [number, number, number]; color?: string; pot?: string }) {
  return (
    <group position={position} userData={{ outline: 0.02 }}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.32, 0.24, 0.6, 12]} />
        <meshStandardMaterial color={pot} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} castShadow position={[Math.sin(i * 1.3) * 0.18, 0.85 + (i % 2) * 0.2, Math.cos(i * 1.3) * 0.18]}>
          <sphereGeometry args={[0.28, 8, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0.1, 1.25, 0.1]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ff6b9d" />
      </mesh>
    </group>
  );
}

/** Mural: emoji dibujado en un canvas, como textura */
function Poster({ emoji, bg, position, rotation = 0 }: { emoji: string; bg: string; position: [number, number, number]; rotation?: number }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 240, 36);
    ctx.fill();
    ctx.font = '170px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 128, 140);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [emoji, bg]);
  return (
    <mesh position={position} rotation={[0, rotation, 0]} userData={{ noToon: true }}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

function Toys({ position }: { position: [number, number, number] }) {
  const colors = ['#ef5350', '#42a5f5', '#ffee58', '#66bb6a'];
  return (
    <group position={position} userData={{ outline: 0.02 }}>
      {/* Alfombra */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} userData={{ noOutline: true }}>
        <circleGeometry args={[1.6, 24]} />
        <meshStandardMaterial color="#b39ddb" />
      </mesh>
      {/* Torre de bloques */}
      {colors.map((c, i) => (
        <mesh key={c} castShadow position={[-0.6 + (i % 2) * 0.05, 0.2 + i * 0.36, -0.2]} rotation={[0, i * 0.4, 0]}>
          <boxGeometry args={[0.36, 0.36, 0.36]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      {/* Pelota */}
      <mesh castShadow position={[0.7, 0.3, 0.4]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#ff7043" />
      </mesh>
      {/* Osito */}
      <group position={[0.2, 0, -0.6]}>
        <mesh castShadow position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.3, 14, 14]} />
          <meshStandardMaterial color="#a1887f" />
        </mesh>
        <mesh castShadow position={[0, 0.8, 0]}>
          <sphereGeometry args={[0.22, 14, 14]} />
          <meshStandardMaterial color="#a1887f" />
        </mesh>
        {[-0.15, 0.15].map((x) => (
          <mesh key={x} position={[x, 0.98, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#8d6e63" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Aquarium({ position }: { position: [number, number, number] }) {
  const fish = useRef<THREE.Group>(null);
  useFrame((s) => {
    const g = fish.current;
    if (!g) return;
    g.children.forEach((f, i) => {
      const t = s.clock.elapsedTime * (0.6 + i * 0.15) + i * 2;
      f.position.set(Math.sin(t) * 0.6, 0.2 + Math.sin(t * 1.7) * 0.15, Math.cos(t * 0.8) * 0.2);
      f.rotation.y = Math.cos(t) > 0 ? 0 : Math.PI;
    });
  });
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[1.8, 0.9, 0.8]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      <mesh position={[0, 1.35, 0]} userData={{ noToon: true }}>
        <boxGeometry args={[1.7, 0.9, 0.7]} />
        <meshStandardMaterial color="#81d4fa" transparent opacity={0.45} emissive="#4fc3f7" emissiveIntensity={0.3} />
      </mesh>
      <group ref={fish} position={[0, 1.1, 0]}>
        {['#ff7043', '#ffee58', '#f06292'].map((c) => (
          <mesh key={c}>
            <coneGeometry args={[0.08, 0.22, 6]} />
            <meshBasicMaterial color={c} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function HospitalDecor() {
  const owned = useGameStore((s) => s.owned);
  const { visualRef, floorVisible } = useFloorVisibility(1);
  const has = (id: string) => owned.includes(id);
  // Todo esto vive en Pediatría (piso 2, y = 4.5)
  return (
    <group ref={visualRef} visible={floorVisible} position={[0, 4.5, 0]}>
      {has('decor-plants') && (
        <>
          <Plant position={[-10.8, 0, 7.8]} />
          <Plant position={[10.8, 0, 7.8]} color="#81c784" pot="#4fc3f7" />
          <Plant position={[-10.8, 0, -3]} color="#aed581" pot="#ba68c8" />
          <Plant position={[10.8, 0, -3.6]} pot="#ffd54f" />
        </>
      )}
      {has('decor-posters') && (
        <>
          <Poster emoji="🦒" bg="#fff59d" position={[-6, 2.6, -8.75]} />
          <Poster emoji="🐘" bg="#b3e5fc" position={[-2.6, 2.8, -8.75]} />
          <Poster emoji="🦁" bg="#ffccbc" position={[-11.75, 2.6, 4]} rotation={Math.PI / 2} />
        </>
      )}
      {has('decor-toys') && <Toys position={[-6.5, 0, 4.2]} />}
      {has('decor-aquarium') && <Aquarium position={[8.6, 0, 7.6]} />}
    </group>
  );
}
