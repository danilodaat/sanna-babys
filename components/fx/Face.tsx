'use client';

import { useRef, type Ref } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { npcCheer } from '@/lib/runtime';
import { useGameStore } from '@/store/gameStore';

const smileGeo = new THREE.TorusGeometry(0.045, 0.009, 4, 12, Math.PI).rotateZ(Math.PI);
const smileMat = new THREE.MeshBasicMaterial({ color: '#633C49' });

/** Sonrisa compartida y ligera; el grupo conserva la escala base al animarla. */
export function Smile({ meshRef, position, scale = 1 }: {
  meshRef?: Ref<THREE.Mesh>;
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale} userData={{ noOutline: true, noBatch: true }} dispose={null}>
      <mesh ref={meshRef} geometry={smileGeo} material={smileMat} />
    </group>
  );
}

/** Espera, atención y alivio; sin estado React por frame. Sin id corresponde al doctor. */
export function useFace(id?: string, near = false) {
  const eyesRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const blink = useRef({ next: 2 + ((id ?? '').length % 3) * 0.7, t: -1 });

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const now = state.clock.elapsedTime;
    const st = useGameStore.getState();
    const patient = id ?? st.currentInteraction;
    const attention = id ? near : st.currentInteraction !== null;
    const since = patient ? performance.now() / 1000 - (npcCheer.get(patient) ?? -Infinity) : Infinity;
    const relieved = since >= 0 && since < 1.6;

    // Parpadeo de 120 ms, con intervalos distintos para cada personaje.
    const b = blink.current;
    let closed = 0;
    if (b.t < 0 && now > b.next) b.t = 0;
    if (b.t >= 0) {
      b.t += delta;
      closed = b.t < 0.12 ? 1 - Math.abs(b.t - 0.06) / 0.06 : 0;
      if (b.t >= 0.12) {
        b.t = -1;
        b.next = now + 2 + Math.random() * 3;
      }
    }
    if (eyesRef.current) {
      const open = relieved ? 0.65 : attention ? 1.12 : 0.9;
      eyesRef.current.scale.y = open * (1 - closed * 0.9);
    }

    // Sonrisa discreta en espera, más abierta al atender y amplia al festejar.
    const m = mouthRef.current;
    if (m) {
      const k = 1 - Math.exp(-12 * delta);
      m.scale.x = THREE.MathUtils.lerp(m.scale.x, relieved ? 1.3 : attention ? 1 : 0.85, k);
      m.scale.y = THREE.MathUtils.lerp(m.scale.y, relieved ? 1.15 : attention ? 0.85 : 0.55, k);
    }
  });

  return { eyesRef, mouthRef };
}
