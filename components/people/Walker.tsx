'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { player } from '@/lib/runtime';
import { groundHeight } from '@/lib/ground';
import { walkerInteractionId, walkerPositions, walkerWaveAt, type WalkerDef } from '@/lib/walkers';

/*
 * Un vecino que pasea: sigue su circuito, a ratos se detiene a mirar
 * alrededor, se para si el doctor está cerca (y lo mira), y saluda con la
 * mano al hablarle. Sin física: nunca estorba.
 */

const NEAR = 2.2;

export default function Walker({ def }: { def: WalkerDef }) {
  const root = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const [near, setNear] = useState(false);
  const nearRef = useRef(false);
  const interact = useGameStore((s) => s.interact);

  // Circuito como polilínea con distancias acumuladas
  const track = useMemo(() => {
    const pts = def.loop.map(([x, z]) => new THREE.Vector3(x, 0, z));
    if (def.closed) pts.push(pts[0].clone());
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, cum, len: cum[cum.length - 1] };
  }, [def]);

  const s = useRef(def.start * track.len * (def.closed ? 1 : 2));
  const pauseUntil = useRef(0);
  const heading = useRef(0);
  const phase = useRef(Math.random() * 10);
  const pos = useRef(new THREE.Vector3());

  const pointAt = (dist: number, out: THREE.Vector3) => {
    // Ida y vuelta si el circuito no es cerrado
    let d = dist;
    if (def.closed) d = ((d % track.len) + track.len) % track.len;
    else {
      const period = track.len * 2;
      d = ((d % period) + period) % period;
      if (d > track.len) d = period - d;
    }
    let i = 1;
    while (i < track.cum.length - 1 && track.cum[i] < d) i++;
    const t = (d - track.cum[i - 1]) / Math.max(track.cum[i] - track.cum[i - 1], 1e-6);
    return out.copy(track.pts[i - 1]).lerp(track.pts[i], t);
  };

  const m = useMemo(() => {
    const mk = (c: string) => new THREE.MeshStandardMaterial({ color: c });
    return { skin: mk(def.skin), shirt: mk(def.shirt), pants: mk(def.pants), hair: mk(def.hair), dark: mk('#1a1a1a'), white: mk('#ffffff'), red: mk('#ef5350'), brown: mk('#795548') };
  }, [def]);
  const g = useMemo(
    () => ({
      head: new THREE.SphereGeometry(0.21, 16, 14),
      hair: new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      eye: new THREE.SphereGeometry(0.028, 8, 6),
      body: new THREE.CapsuleGeometry(0.17, 0.3, 4, 10),
      limb: new THREE.CapsuleGeometry(0.055, 0.28, 3, 8),
      hand: new THREE.SphereGeometry(0.055, 8, 6),
      shoe: new THREE.SphereGeometry(0.07, 8, 6),
      hat: new THREE.CylinderGeometry(0.2, 0.3, 0.12, 14),
      hatTop: new THREE.CylinderGeometry(0.17, 0.2, 0.18, 14),
      bag: new THREE.BoxGeometry(0.22, 0.26, 0.1),
      lens: new THREE.TorusGeometry(0.05, 0.01, 6, 14),
      balloon: new THREE.SphereGeometry(0.2, 12, 12),
      string: new THREE.CylinderGeometry(0.004, 0.004, 0.9, 3),
      cane: new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6),
    }),
    [],
  );

  useFrame((st, raw) => {
    const r = root.current;
    if (!r) return;
    const dt = Math.min(raw, 0.05);
    const t = st.clock.elapsedTime;
    const p = pos.current;

    const dx = player.position.x - p.x;
    const dz = player.position.z - p.z;
    const dist = Math.hypot(dx, dz);
    const sameFloor = Math.abs(player.position.y - p.y) < 1.5;
    const isNear = sameFloor && dist < NEAR;
    if (isNear !== nearRef.current) {
      nearRef.current = isNear;
      setNear(isNear);
      const s0 = useGameStore.getState();
      if (isNear) interact(walkerInteractionId(def.id));
      else if (s0.currentInteraction === walkerInteractionId(def.id)) interact(null);
    }

    // Caminar, salvo pausas o si el doctor está al lado
    const stop = isNear || t < pauseUntil.current;
    if (!stop && Math.random() < dt * 0.04) pauseUntil.current = t + 1.5 + Math.random() * 3;
    const prev = p.clone();
    if (!stop) s.current += def.speed * dt;
    pointAt(s.current, p);
    const moved = p.distanceTo(prev);
    let face: number | null = null;
    if (isNear) face = Math.atan2(dx, dz);
    else if (moved > 1e-4) face = Math.atan2(p.x - prev.x, p.z - prev.z);
    if (face !== null) {
      let diff = face - heading.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading.current += diff * (1 - Math.exp(-7 * dt));
    }
    r.position.copy(p);
    r.rotation.y = heading.current;
    walkerPositions.set(def.id, p);
    r.visible = dist < 50; // lejos no se dibuja (ahorra draw calls)

    // Animación
    const walking = !stop;
    phase.current += dt * (walking ? 7 * def.speed : 0);
    const sw = walking ? Math.sin(phase.current) * 0.6 : 0;
    const wave = performance.now() / 1000 - (walkerWaveAt.get(def.id) ?? -99) < 1.6;
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, i ? -sw : sw, 0.3);
    });
    arms.current.forEach((a, i) => {
      if (!a) return;
      if (wave && i === 1) {
        a.rotation.x = -2.6;
        a.rotation.z = Math.sin(t * 14) * 0.4;
      } else {
        a.rotation.x = THREE.MathUtils.lerp(a.rotation.x, def.extra === 'balloon' && i === 0 ? -0.5 : i ? sw : -sw, 0.3);
        a.rotation.z = 0;
      }
    });
    // Pisar el suelo real (pasto, calle o vereda) + un rebote chiquito al caminar
    r.position.y = groundHeight(p.x, p.z) + (walking ? Math.abs(Math.cos(phase.current)) * 0.03 : 0);
  });

  const k = def.kid ? 0.72 : 1;
  return (
    <group ref={root} scale={k}>
      {/* Los zapatos quedan 0.088 m sobre la base del modelo */}
      <group position={[0, -0.088, 0]}>
      <group userData={{ outline: 0.012, batchLocal: true }}>
        <mesh geometry={g.body} material={m.shirt} position={[0, 0.82, 0]} castShadow />
        <group position={[0, 1.3, 0]}>
          <mesh geometry={g.head} material={m.skin} castShadow />
          {def.extra !== 'hat' && <mesh geometry={g.hair} material={m.hair} position={[0, 0.03, -0.02]} rotation={[-0.2, 0, 0]} />}
          {def.extra === 'hat' && (
            <>
              <mesh geometry={g.hat} material={m.hair} position={[0, 0.16, 0]} />
              <mesh geometry={g.hatTop} material={m.hair} position={[0, 0.3, 0]} />
            </>
          )}
          {([-0.075, 0.075] as const).map((x) => (
            <mesh key={x} geometry={g.eye} material={m.dark} position={[x, 0.02, 0.19]} />
          ))}
          {def.extra === 'glasses' &&
            ([-0.075, 0.075] as const).map((x) => <mesh key={x} geometry={g.lens} material={m.dark} position={[x, 0.02, 0.21]} userData={{ noOutline: true }} />)}
        </group>
        {def.extra === 'bag' && <mesh geometry={g.bag} material={m.brown} position={[0.26, 0.72, 0]} />}
      </group>
      {/* Piernas y brazos (animados) */}
      {([-0.09, 0.09] as const).map((x, i) => (
        <group key={x} ref={(el) => (legs.current[i] = el)} position={[x, 0.55, 0]} userData={{ noOutline: true }}>
          <mesh geometry={g.limb} material={m.pants} position={[0, -0.2, 0]} />
          <mesh geometry={g.shoe} material={m.dark} position={[0, -0.42, 0.03]} scale={[1, 0.6, 1.3]} />
        </group>
      ))}
      {([-0.25, 0.25] as const).map((x, i) => (
        <group key={x} ref={(el) => (arms.current[i] = el)} position={[x, 1.02, 0]} userData={{ noOutline: true }}>
          <mesh geometry={g.limb} material={m.shirt} position={[0, -0.18, 0]} />
          <mesh geometry={g.hand} material={m.skin} position={[0, -0.38, 0]} />
          {def.extra === 'cane' && i === 1 && <mesh geometry={g.cane} material={m.brown} position={[0, -0.75, 0.05]} />}
        </group>
      ))}
      {/* Globo flotando sobre la mano izquierda */}
      {def.extra === 'balloon' && (
        <group position={[-0.32, 0, 0.18]}>
          <mesh geometry={g.string} material={m.white} position={[0, 1.55, 0]} />
          <mesh geometry={g.balloon} material={m.red} position={[0, 2.12, 0]} />
        </group>
      )}
      </group>
      {near && (
        <Html position={[0, 1.85, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{def.name}</div>
        </Html>
      )}
    </group>
  );
}
