'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { player, world } from '@/lib/runtime';
import { catInteractionId, catPetAt, catPositions, type CatDef } from '@/lib/cats';
import { sfx } from '@/lib/audio';
import { groundHeight } from '@/lib/ground';
import { BlobShadow } from '@/components/fx/Shadows';

/*
 * Un gatito: modelo procedural low-poly + un cerebrito de estados.
 *   paseo → sentado / lamerse → paseo ...   (de día)
 *   dormir hecho bolita                      (de noche; Luna al revés)
 *   curioso: se acerca y mira al doctor      (si pasas cerca)
 *   festejo: saltitos al acariciarlo
 *   seguir: si es tu mascota, va detrás tuyo a todas partes
 * Sin física: se mueve solo, nunca estorba.
 */

type State = 'walk' | 'sit' | 'groom' | 'sleep' | 'curious' | 'follow';

const WALK_SPEED = 1.1;
const FOLLOW_SPEED = 5.4;
const NEAR = 1.9;

const damp = (a: number, b: number, l: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-l * dt));

export default function Cat({ def }: { def: CatDef }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const tail = useRef<(THREE.Group | null)[]>([]);

  const pos = useRef(new THREE.Vector3(def.home.x, 0, def.home.z));
  const target = useRef(new THREE.Vector3(def.home.x, 0, def.home.z));
  const heading = useRef(Math.random() * Math.PI * 2);
  const state = useRef<State>('sit');
  const timer = useRef(1 + Math.random() * 3);
  const phase = useRef(Math.random() * 10);
  const nearRef = useRef(false);
  const [near, setNear] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const lastMeow = useRef(0);
  const followDir = useRef(new THREE.Vector3(0, 0, 1));

  const interact = useGameStore((s) => s.interact);
  const isPet = useGameStore((s) => s.petCat === def.id);

  const m = useMemo(() => {
    const mk = (c: string) => new THREE.MeshStandardMaterial({ color: c });
    return {
      fur: mk(def.fur),
      accent: mk(def.accent),
      white: mk('#ffffff'),
      pink: mk('#ff9fb4'),
      eye: mk(def.eyes),
      pupil: mk('#1a1a1a'),
      dark: mk('#2b2b33'),
    };
  }, [def]);

  const g = useMemo(
    () => ({
      body: new THREE.CapsuleGeometry(0.13, 0.26, 6, 12).rotateX(Math.PI / 2),
      head: new THREE.SphereGeometry(0.15, 16, 14),
      muzzle: new THREE.SphereGeometry(0.07, 10, 8),
      ear: new THREE.ConeGeometry(0.055, 0.11, 4),
      earIn: new THREE.ConeGeometry(0.032, 0.07, 4),
      eye: new THREE.SphereGeometry(0.034, 10, 8),
      pupil: new THREE.CapsuleGeometry(0.009, 0.03, 2, 6),
      nose: new THREE.SphereGeometry(0.018, 6, 6),
      whisker: new THREE.BoxGeometry(0.14, 0.004, 0.004),
      leg: new THREE.CapsuleGeometry(0.03, 0.13, 3, 6),
      paw: new THREE.SphereGeometry(0.038, 8, 6),
      tail: new THREE.CapsuleGeometry(0.025, 0.1, 3, 6),
      stripe: new THREE.BoxGeometry(0.2, 0.03, 0.05),
      patch: new THREE.SphereGeometry(0.09, 10, 8),
    }),
    [],
  );

  const pickWanderTarget = () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * def.home.r;
    target.current.set(def.home.x + Math.cos(a) * r, 0, def.home.z + Math.sin(a) * r);
  };

  useFrame((s, rawDelta) => {
    const r = root.current;
    const b = body.current;
    if (!r || !b) return;
    const dt = Math.min(rawDelta, 0.05);
    const t = s.clock.elapsedTime;
    const p = pos.current;

    // ─── Cercanía al doctor (interacción) ───
    const dx = player.position.x - p.x;
    const dz = player.position.z - p.z;
    const dist = Math.hypot(dx, dz);
    const sameFloor = Math.abs(player.position.y - p.y) < 1.5;
    const isNear = sameFloor && dist < NEAR;
    if (isNear !== nearRef.current) {
      nearRef.current = isNear;
      setNear(isNear);
      const st = useGameStore.getState();
      if (isNear) {
        interact(catInteractionId(def.id));
        if (st.started && t - lastMeow.current > 4) {
          lastMeow.current = t;
          sfx.meow(def.id.length);
        }
      } else if (st.currentInteraction === catInteractionId(def.id)) interact(null);
    }

    // ─── Decidir estado ───
    const nightOwl = def.id === 'luna';
    // Luna es trasnochadora: duerme la siesta al mediodía y está despierta de noche
    const sleepy = nightOwl ? world.time > 0.42 && world.time < 0.58 : world.night > 0.65;
    const pet = useGameStore.getState().petCat === def.id;
    // catPetAt se marca con performance.now() (desde la UI): comparar con el mismo reloj
    const nowS = performance.now() / 1000;
    const cheering = nowS - (catPetAt.get(def.id) ?? -99) < 1.4;

    if (pet) state.current = 'follow';
    else if (state.current === 'follow') state.current = 'sit';
    else if (sleepy && !isNear && state.current !== 'sleep') state.current = 'sleep';
    else if (!sleepy && state.current === 'sleep') state.current = 'sit';
    else if (!sleepy && dist < 4.5 && sameFloor && state.current !== 'curious') state.current = 'curious';
    else if (state.current === 'curious' && dist > 6) {
      state.current = 'walk';
      pickWanderTarget();
    }

    if (sleeping !== (state.current === 'sleep')) setSleeping(state.current === 'sleep');

    // ─── Moverse según el estado ───
    let speed = 0;
    let faceAngle: number | null = null;
    timer.current -= dt;

    if (state.current === 'follow') {
      // Detrás del doctor (según hacia dónde camina) y un poco al costado
      const v = player.velocity;
      const vl = Math.hypot(v.x, v.z);
      if (vl > 0.5) followDir.current.set(v.x / vl, 0, v.z / vl);
      const fdir = followDir.current;
      target.current.set(
        // al costado derecho y apenas atrás: así la cámara (detrás del doctor) siempre lo ve
        player.position.x - fdir.x * 0.4 - fdir.z * 1.1,
        player.position.y,
        player.position.z - fdir.z * 0.4 + fdir.x * 1.1,
      );
      const tx = target.current.x - p.x;
      const tz = target.current.z - p.z;
      const d = Math.hypot(tx, tz);
      if (d > 25) p.set(target.current.x, player.position.y, target.current.z); // ascensor / teletransporte
      if (d > 0.6) {
        speed = Math.min(FOLLOW_SPEED, d * 2.2);
        faceAngle = Math.atan2(tx, tz);
      } else faceAngle = Math.atan2(dx, dz);
      p.y = damp(p.y, player.position.y, 10, dt);
    } else if (state.current === 'curious') {
      // Se acerca hasta ~1.3 m y se sienta mirándote
      if (dist > 1.3) {
        speed = WALK_SPEED * 1.4;
        target.current.set(player.position.x, 0, player.position.z);
      }
      faceAngle = Math.atan2(dx, dz);
    } else if (state.current === 'walk') {
      const tx = target.current.x - p.x;
      const tz = target.current.z - p.z;
      const d = Math.hypot(tx, tz);
      if (d < 0.15 || timer.current < -8) {
        state.current = Math.random() < 0.35 ? 'groom' : 'sit';
        timer.current = 2 + Math.random() * 5;
      } else {
        speed = WALK_SPEED;
        faceAngle = Math.atan2(tx, tz);
      }
    } else if ((state.current === 'sit' || state.current === 'groom') && timer.current <= 0) {
      state.current = 'walk';
      pickWanderTarget();
      timer.current = 0;
    }

    if (faceAngle !== null) {
      let diff = faceAngle - heading.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading.current += diff * (1 - Math.exp(-6 * dt));
    }
    if (speed > 0) {
      const tx = target.current.x - p.x;
      const tz = target.current.z - p.z;
      const d = Math.hypot(tx, tz) || 1;
      const step = Math.min(speed * dt, d);
      p.x += (tx / d) * step;
      p.z += (tz / d) * step;
    }
    if (state.current !== 'follow') p.y = damp(p.y, groundHeight(p.x, p.z, p.y), 8, dt);

    r.position.copy(p);
    r.rotation.y = heading.current;
    catPositions.set(def.id, p);
    // Lejos (>45 m, ya tapado por la niebla) no se dibuja: ahorra draw calls en celular
    r.visible = dist < 45 || state.current === 'follow';

    // ─── Poses ───
    const moving = speed > 0.05;
    const sitting = !moving && (state.current === 'sit' || state.current === 'curious' || state.current === 'groom' || state.current === 'follow');
    const sleep = state.current === 'sleep';
    const cheer = cheering ? Math.abs(Math.sin((nowS - (catPetAt.get(def.id) ?? 0)) * 9)) * 0.22 : 0;
    b.position.y = damp(b.position.y, (sleep ? -0.1 : sitting ? 0.03 : 0) + cheer + (moving ? Math.abs(Math.sin(phase.current * 2)) * 0.02 : 0), 12, dt);
    b.rotation.x = damp(b.rotation.x, sitting ? -0.45 : sleep ? 0 : 0, 8, dt);
    b.rotation.z = damp(b.rotation.z, sleep ? 0.9 : 0, 5, dt);
    // Lamerse: la cabeza (todo el cuerpo) cabecea
    if (state.current === 'groom' && !moving) b.rotation.x += Math.sin(t * 7) * 0.08;
    // Respiración
    const breathe = 1 + Math.sin(t * (sleep ? 1.6 : 3)) * (sleep ? 0.04 : 0.015);
    b.scale.set(breathe, 1, 1);

    phase.current += dt * (moving ? 6 + speed * 3 : 0);
    const swing = moving ? Math.sin(phase.current * 2) * 0.7 : 0;
    legs.current.forEach((l, i) => {
      if (!l) return;
      const front = i < 2;
      const side = i % 2 === 0 ? 1 : -1;
      const target = sitting && !front ? -1.2 : sleep ? -1.3 : swing * side * (front ? 1 : -1);
      l.rotation.x = damp(l.rotation.x, target, 14, dt);
      l.visible = !sleep || front;
    });
    tail.current.forEach((seg, i) => {
      if (!seg) return;
      const wag = cheering ? 1.4 : sitting ? 0.25 : 0.5;
      seg.rotation.y = Math.sin(t * (cheering ? 10 : 2.2) - i * 0.7) * wag * (0.4 + i * 0.3);
      seg.rotation.x = (sleep ? 0.2 : -0.35) + (i === 0 ? (sitting ? 0.6 : 0) : 0);
    });
    if (eyes.current) {
      const blink = sleep ? 0.1 : (t + def.home.x) % 4 < 0.12 ? 0.15 : 1;
      eyes.current.scale.y = damp(eyes.current.scale.y, blink, 25, dt);
    }
  });

  const pattern = def.pattern;
  return (
    <group ref={root} position={[def.home.x, 0, def.home.z]} scale={1.4}>
      <BlobShadow scale={0.75} />
      <group ref={body}>
        {/* Cuerpo y cabeza (se fusionan en pocos draw calls) */}
        <group userData={{ outline: 0.01, batchLocal: true }}>
          <mesh geometry={g.body} material={m.fur} position={[0, 0.24, 0]} castShadow />
          <group position={[0, 0.36, 0.23]}>
            <mesh geometry={g.head} material={pattern === 'siamese' ? m.fur : m.fur} castShadow />
            <mesh geometry={g.muzzle} material={pattern === 'tuxedo' || pattern === 'calico' ? m.white : pattern === 'siamese' ? m.accent : m.fur} position={[0, -0.05, 0.11]} scale={[1.2, 0.8, 0.8]} />
            {([-1, 1] as const).map((s) => (
              <group key={s} position={[s * 0.085, 0.12, 0]} rotation={[0, 0, -s * 0.35]}>
                <mesh geometry={g.ear} material={pattern === 'siamese' || pattern === 'calico' ? m.accent : m.fur} />
                <mesh geometry={g.earIn} material={m.pink} position={[0, -0.005, 0.02]} />
              </group>
            ))}
            <mesh geometry={g.nose} material={m.pink} position={[0, -0.02, 0.165]} />
            {([-1, 1] as const).map((s) =>
              [0.015, -0.01].map((y, i) => (
                <mesh key={`${s}${i}`} geometry={g.whisker} material={m.dark} position={[s * 0.12, -0.04 + y, 0.13]} rotation={[0, s * 0.25, s * (i ? -0.12 : 0.12)]} userData={{ noOutline: true }} />
              )),
            )}
            {pattern === 'siamese' && <mesh geometry={g.patch} material={m.accent} position={[0, -0.02, 0.07]} scale={[1.1, 0.9, 0.7]} />}
          </group>
          {pattern === 'tabby' &&
            [-0.12, 0, 0.12].map((z) => <mesh key={z} geometry={g.stripe} material={m.accent} position={[0, 0.37, z]} scale={[1, 1, 1]} />)}
          {pattern === 'calico' && (
            <>
              <mesh geometry={g.patch} material={m.accent} position={[0.06, 0.33, -0.08]} />
              <mesh geometry={g.patch} material={m.dark} position={[-0.07, 0.32, 0.08]} scale={0.8} />
            </>
          )}
          {pattern === 'tuxedo' && <mesh geometry={g.patch} material={m.white} position={[0, 0.2, 0.2]} scale={[1, 1.2, 0.8]} />}
        </group>

        {/* Ojos (aparte: parpadean y se cierran al dormir) */}
        <group ref={eyes} position={[0, 0.38, 0.37]} userData={{ noOutline: true }}>
          {([-1, 1] as const).map((s) => (
            <group key={s} position={[s * 0.058, 0, 0]}>
              <mesh geometry={g.eye} material={m.eye} scale={[1, 1.1, 0.6]} />
              <mesh geometry={g.pupil} material={m.pupil} position={[0, 0, 0.022]} />
            </group>
          ))}
        </group>

        {/* Patas */}
        {[
          [0.07, 0.15],
          [-0.07, 0.15],
          [0.07, -0.13],
          [-0.07, -0.13],
        ].map(([x, z], i) => (
          <group key={i} ref={(el) => (legs.current[i] = el)} position={[x, 0.17, z]} userData={{ noOutline: true }}>
            <mesh geometry={g.leg} material={pattern === 'siamese' ? m.accent : m.fur} position={[0, -0.08, 0]} />
            <mesh geometry={g.paw} material={pattern === 'tuxedo' || pattern === 'siamese' ? (pattern === 'tuxedo' ? m.white : m.accent) : m.fur} position={[0, -0.16, 0.01]} scale={[1, 0.6, 1.2]} />
          </group>
        ))}

        {/* Cola en 3 segmentos */}
        <group position={[0, 0.3, -0.26]} userData={{ noOutline: true }}>
          <group ref={(el) => (tail.current[0] = el)}>
            <mesh geometry={g.tail} material={pattern === 'siamese' ? m.accent : m.fur} position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]} />
            <group ref={(el) => (tail.current[1] = el)} position={[0, 0, -0.14]}>
              <mesh geometry={g.tail} material={pattern === 'siamese' ? m.accent : m.fur} position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]} />
              <group ref={(el) => (tail.current[2] = el)} position={[0, 0, -0.14]}>
                <mesh geometry={g.tail} material={pattern === 'siamese' || pattern === 'tabby' ? m.accent : m.fur} position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]} />
              </group>
            </group>
          </group>
        </group>
      </group>

      {near && (
        <Html position={[0, 0.85, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {sleeping ? '💤 ' : '🐱 '}
            {def.name}
            {isPet ? ' · tu mascota' : ''}
          </div>
        </Html>
      )}
    </group>
  );
}
