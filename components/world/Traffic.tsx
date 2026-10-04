'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAR_AVOID, CAR_NODES, NODE_BY_ID, nearestNode, shortestPath } from '@/lib/roads';
import { player } from '@/lib/runtime';
import { sfx } from '@/lib/audio';
import { useGameStore } from '@/store/gameStore';

/*
 * Tráfico: 6 autos de colores que van de esquina en esquina por el lado
 * derecho de la calle. Si el doctor está parado adelante, frenan y tocan la
 * bocina (y siguen cuando se corre). Sin colisión.
 */

const COLORS = ['#C99196', '#86AEC9', '#D8C69B', '#92B58B', '#AB96BC', '#D2A18B'];
const LANE = 1.9;

interface Car {
  pos: THREE.Vector3;
  heading: number;
  path: THREE.Vector3[];
  seg: number;
  speed: number;
  wheel: number;
  honkAt: number;
}

function newTrip(from: THREE.Vector3): THREE.Vector3[] {
  const start = nearestNode(from.x, from.z, false, CAR_AVOID);
  let dest = start;
  while (dest.id === start.id) dest = CAR_NODES[Math.floor(Math.random() * CAR_NODES.length)];
  const ids = shortestPath(start.id, dest.id, CAR_AVOID);
  // Desplazar cada tramo al carril derecho
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < ids.length; i++) {
    const n = NODE_BY_ID[ids[i]];
    const next = NODE_BY_ID[ids[Math.min(i + 1, ids.length - 1)]];
    const prev = NODE_BY_ID[ids[Math.max(i - 1, 0)]];
    const dir = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z).normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    pts.push(new THREE.Vector3(n.x, 0, n.z).addScaledVector(right, LANE));
  }
  return pts;
}

function CarModel({ car, color }: { car: Car; color: string }) {
  const g = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color }),
      glass: new THREE.MeshStandardMaterial({ color: '#b3e5fc' }),
      tire: new THREE.MeshStandardMaterial({ color: '#2b2b33' }),
      light: new THREE.MeshStandardMaterial({ color: '#fff9c4', emissive: '#fff59d', emissiveIntensity: 1.2 }),
    }),
    [color],
  );
  useFrame(() => {
    if (!g.current) return;
    g.current.position.copy(car.pos);
    g.current.rotation.y = car.heading;
    g.current.visible = car.pos.distanceTo(player.position) < 65;
    if (wheels.current) wheels.current.children.forEach((w) => (w.rotation.x = car.wheel));
  });
  return (
    <group ref={g}>
      <group userData={{ outline: 0.025, batchLocal: true }}>
        <mesh material={mats.body} position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[1.7, 0.6, 3.4]} />
        </mesh>
        <mesh material={mats.body} position={[0, 1.05, -0.2]} castShadow>
          <boxGeometry args={[1.5, 0.5, 1.8]} />
        </mesh>
        <mesh material={mats.glass} position={[0, 1.05, 0.72]} rotation={[-0.35, 0, 0]}>
          <boxGeometry args={[1.35, 0.42, 0.05]} />
        </mesh>
        {[-0.55, 0.55].map((x) => (
          <mesh key={x} material={mats.light} position={[x, 0.6, 1.71]}>
            <boxGeometry args={[0.35, 0.18, 0.04]} />
          </mesh>
        ))}
      </group>
      <group ref={wheels} userData={{ noBatch: true }}>
        {[
          [-0.85, 0.32, 1.1],
          [0.85, 0.32, 1.1],
          [-0.85, 0.32, -1.1],
          [0.85, 0.32, -1.1],
        ].map((p, i) => (
          <mesh key={i} material={mats.tire} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.32, 0.32, 0.25, 12]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function Traffic() {
  const cars = useMemo<Car[]>(() => {
    const starts = ['A', 'B', 'C', 'D', 'S1', 'R0'];
    return COLORS.map((_, i) => {
      const n = NODE_BY_ID[starts[i]];
      const pos = new THREE.Vector3(n.x, 0, n.z);
      return { pos, heading: 0, path: newTrip(pos), seg: 0, speed: 6 + Math.random() * 3, wheel: 0, honkAt: 0 };
    });
  }, []);

  useFrame((st, raw) => {
    const dt = Math.min(raw, 0.05);
    const t = st.clock.elapsedTime;
    const riding = useGameStore.getState().riding !== null;
    for (const car of cars) {
      let target = car.path[car.seg + 1];
      if (!target) {
        car.path = newTrip(car.pos);
        car.seg = 0;
        target = car.path[1];
        if (!target) continue;
      }
      // ¿El doctor está adelante en el carril? Frenar y tocar bocina
      const fwd = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
      const toP = player.position.clone().sub(car.pos).setY(0);
      const ahead = toP.dot(fwd);
      const side = Math.abs(toP.x * fwd.z - toP.z * fwd.x);
      const blocked = !riding && player.position.y < 1 && ahead > 0 && ahead < 4.5 && side < 1.6;
      if (blocked) {
        if (t - car.honkAt > 3) {
          car.honkAt = t;
          if (car.pos.distanceTo(player.position) < 20) sfx.honk();
        }
        continue;
      }
      const to = target.clone().sub(car.pos);
      const d = to.length();
      const step = car.speed * dt;
      if (d <= step) {
        car.pos.copy(target);
        car.seg++;
      } else {
        car.pos.addScaledVector(to.normalize(), step);
        const want = Math.atan2(to.x, to.z);
        let diff = want - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += diff * (1 - Math.exp(-6 * dt));
      }
      car.wheel += step * 3;
    }
  });

  return (
    <group>
      {cars.map((c, i) => (
        <CarModel key={i} car={c} color={COLORS[i]} />
      ))}
    </group>
  );
}
