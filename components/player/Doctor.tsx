'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { player, input } from '@/lib/runtime';
import { emit } from '@/lib/fx';
import { sfx } from '@/lib/audio';
import { ITEM_BY_ID } from '@/lib/shop';
import { getToonGradient } from '@/components/fx/Toonify';
import { BlobShadow } from '@/components/fx/Shadows';
import { STAIR_STEPS, STAIRS, stairHeightAt } from '@/lib/hospital';
import { fleet } from '@/components/world/Ambulances';
import { Smile, useFace } from '@/components/fx/Face';

const MOVE_SPEED = 4.6;
const ACCEL = 14; // qué tan rápido alcanza la velocidad (1/s)
const JUMP_SPEED = 8.5;
const COYOTE_TIME = 0.12; // margen para saltar justo después de dejar el borde
const WALK_CYCLE_SPEED = 11;
const LIMB_SWING = 0.7;
const SPAWN = new THREE.Vector3(0, 1.5, 1);

// Skin, clothing, and accessory colors
const SKIN_COLOR = '#f5c6a0';
const COAT_COLOR = '#f7f7fb';
const PANTS_COLOR = '#3b5998';
const HAIR_COLOR = '#5a3825';
const EYE_COLOR = '#1a1a1a';
const STETHOSCOPE_COLOR = '#6b7b8d';
const SHOE_COLOR = '#2a2a2a';
const CHEEK_COLOR = '#f7a1a1';

const damp = (current: number, target: number, lambda: number, dt: number) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));

export default function Doctor() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const groupRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null); // squash & stretch + inclinación
  const headRef = useRef<THREE.Group>(null);
  const { eyesRef, mouthRef } = useFace();
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  const targetRotation = useRef(0);
  const walkPhase = useRef(0);
  const lastStepSign = useRef(1);
  const squash = useRef({ value: 0, vel: 0 }); // resorte: >0 aplasta, <0 estira
  const airTime = useRef(0);
  const wasGrounded = useRef(true);
  const minVy = useRef(0);
  const vel = useRef(new THREE.Vector3());
  const jumpHeld = useRef(false);

  const started = useGameStore((s) => s.started);
  const equipped = useGameStore((s) => s.equipped);
  const fastShoes = useGameStore((s) => s.owned.includes('upgrade-shoes'));
  const capeRef = useRef<THREE.Group>(null);
  const frozen = useGameStore((s) => s.modal);
  const [, getKeys] = useKeyboardControls();
  const { world, rapier } = useRapier();
  const ray = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), [rapier]);
  const stepRay = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), [rapier]);
  const stepDown = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), [rapier]);
  const shadowRay = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), [rapier]);

  // Memoize materials so they don't re-create each frame
  const materials = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: SKIN_COLOR }),
      // Toon hecho a mano (no lo convierte Toonify) para poder cambiarle el color al equipar batas
      coat: new THREE.MeshToonMaterial({ color: COAT_COLOR, gradientMap: getToonGradient() }),
      gold: new THREE.MeshStandardMaterial({ color: '#ffcf33', emissive: '#ffb300', emissiveIntensity: 0.25 }),
      capBlue: new THREE.MeshStandardMaterial({ color: '#7fd6e8' }),
      glassFrame: new THREE.MeshStandardMaterial({ color: '#4a3b5c' }),
      mirror: new THREE.MeshStandardMaterial({ color: '#e8eef5', emissive: '#ffffff', emissiveIntensity: 0.35 }),
      cape: new THREE.MeshStandardMaterial({ color: '#e53950', side: THREE.DoubleSide }),
      pants: new THREE.MeshStandardMaterial({ color: PANTS_COLOR }),
      hair: new THREE.MeshStandardMaterial({ color: HAIR_COLOR }),
      eye: new THREE.MeshStandardMaterial({ color: EYE_COLOR }),
      eyeWhite: new THREE.MeshStandardMaterial({ color: '#ffffff' }),
      cheek: new THREE.MeshStandardMaterial({ color: CHEEK_COLOR }),
      stethoscope: new THREE.MeshStandardMaterial({ color: STETHOSCOPE_COLOR, metalness: 0.6, roughness: 0.3 }),
      shoe: new THREE.MeshStandardMaterial({ color: SHOE_COLOR }),
      cross: new THREE.MeshStandardMaterial({ color: '#ef4b6c' }),
    }),
    []
  );

  // Proporciones chibi: cabeza grande, cuerpo chico
  const geometries = useMemo(
    () => ({
      head: new THREE.SphereGeometry(0.27, 20, 20),
      eye: new THREE.SphereGeometry(0.05, 10, 10),
      pupil: new THREE.SphereGeometry(0.028, 8, 8),
      cheek: new THREE.SphereGeometry(0.04, 8, 8),
      hairTop: new THREE.SphereGeometry(0.285, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.48),
      hairTuft: new THREE.ConeGeometry(0.08, 0.16, 8),
      body: new THREE.CapsuleGeometry(0.19, 0.24, 6, 12),
      arm: new THREE.CapsuleGeometry(0.06, 0.24, 4, 8),
      hand: new THREE.SphereGeometry(0.065, 10, 10),
      leg: new THREE.CapsuleGeometry(0.07, 0.2, 4, 8),
      shoe: new THREE.SphereGeometry(0.085, 10, 8),
      stethTube: new THREE.TorusGeometry(0.13, 0.014, 8, 20, Math.PI),
      stethPiece: new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12),
      crossBar: new THREE.BoxGeometry(0.1, 0.03, 0.01),
      capDome: new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
      crownBand: new THREE.CylinderGeometry(0.2, 0.22, 0.1, 16, 1, true),
      crownSpike: new THREE.ConeGeometry(0.045, 0.12, 6),
      lens: new THREE.TorusGeometry(0.062, 0.012, 6, 16),
      bridge: new THREE.BoxGeometry(0.06, 0.012, 0.012),
      band: new THREE.TorusGeometry(0.275, 0.014, 6, 24),
      mirrorDisc: new THREE.CylinderGeometry(0.085, 0.085, 0.015, 18),
      cape: new THREE.PlaneGeometry(0.5, 0.62, 1, 4),
    }),
    []
  );

  useFrame((state, rawDelta) => {
    const rb = rigidBodyRef.current;
    if (!rb || !groupRef.current || !bodyRef.current) return;
    const delta = Math.min(rawDelta, 0.05);

    // ─── Viajando en ambulancia: el doctor va adentro ───
    const riding = useGameStore.getState().riding;
    groupRef.current.visible = riding === null;
    if (riding !== null) {
      if (shadowRef.current) shadowRef.current.visible = false;
      const u = fleet[riding];
      rb.setTranslation({ x: u.pos.x, y: 0.3, z: u.pos.z }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      player.position.set(u.pos.x, 0.05, u.pos.z);
      player.velocity.set(Math.sin(u.heading) * 8, 0, Math.cos(u.heading) * 8);
      player.speed01 = 0.6;
      player.grounded = true;
      return;
    }

    // ─── Input: joystick táctil + teclado ───
    let ix = input.touch.x;
    let iy = input.touch.y;
    const keys = getKeys() as Record<string, boolean>;
    if (keys.forward) iy -= 1;
    if (keys.backward) iy += 1;
    if (keys.left) ix -= 1;
    if (keys.right) ix += 1;
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    const canMove = started && !frozen;
    if (!canMove) {
      ix = 0;
      iy = 0;
    }

    if (keys.jump && !jumpHeld.current) input.jumpQueued = true;
    jumpHeld.current = !!keys.jump;

    // Rotar el input según el ángulo de cámara
    const cos = Math.cos(input.cameraAngle);
    const sin = Math.sin(input.cameraAngle);
    const worldX = ix * cos + iy * sin;
    const worldZ = -ix * sin + iy * cos;
    const magnitude = Math.hypot(worldX, worldZ);
    const moving = magnitude > 0.05;

    // ─── Suelo (raycast hacia abajo desde los pies) ───
    const pos = rb.translation();
    ray.origin = { x: pos.x, y: pos.y + 0.15, z: pos.z };
    const hit = world.castRay(ray, 0.3, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, rb);
    const lin = rb.linvel();
    const grounded = (hit !== null && lin.y < 1.5) || stairHeightAt(pos.x, pos.z, pos.y) !== null;
    if (grounded) airTime.current = 0;
    else airTime.current += delta;

    // ─── Velocidad horizontal con aceleración suave ───
    const maxSpeed = MOVE_SPEED * (fastShoes ? 1.25 : 1);
    vel.current.x = damp(vel.current.x, worldX * maxSpeed, ACCEL, delta);
    vel.current.z = damp(vel.current.z, worldZ * maxSpeed, ACCEL, delta);
    let vy = lin.y;

    // ─── Salto ───
    if (input.jumpQueued) {
      if (canMove && airTime.current < COYOTE_TIME) {
        vy = JUMP_SPEED;
        airTime.current = COYOTE_TIME; // evita doble salto
        squash.current.vel = -9; // estirón al despegar
        sfx.jump();
        emit('dust', [pos.x, pos.y, pos.z], 6);
      }
      input.jumpQueued = false;
    }

    // Escalera del hospital: el doctor se pega a la rampa (subir y bajar sin física de escalones)
    const stairY = stairHeightAt(pos.x, pos.z, pos.y);
    if (stairY !== null && vy <= 0.5) {
      rb.setTranslation({ x: pos.x, y: stairY, z: pos.z }, true);
      vy = 0;
    }

    // Escalones bajos (borde de la vereda, tapetes, bases): subirlos solo, como en cualquier juego.
    // Rayo a los tobillos choca + rayo a las rodillas libre = escalón; se mide su altura y se sube.
    const hv = Math.hypot(vel.current.x, vel.current.z);
    if (grounded && stairY === null && hv > 0.4 && vy < 1) {
      const dx = vel.current.x / hv;
      const dz = vel.current.z / hv;
      const flags = rapier.QueryFilterFlags.EXCLUDE_SENSORS;
      stepRay.dir = { x: dx, y: 0, z: dz };
      stepRay.origin = { x: pos.x, y: pos.y + 0.06, z: pos.z };
      const low = world.castRay(stepRay, 0.5, true, flags, undefined, undefined, rb);
      if (low) {
        stepRay.origin = { x: pos.x, y: pos.y + 0.45, z: pos.z };
        const high = world.castRay(stepRay, 0.7, true, flags, undefined, undefined, rb);
        if (!high) {
          const ahead = Math.min(low.timeOfImpact + 0.12, 0.6);
          stepDown.origin = { x: pos.x + dx * ahead, y: pos.y + 0.45, z: pos.z + dz * ahead };
          const top = world.castRay(stepDown, 0.45, true, flags, undefined, undefined, rb);
          const h = top ? 0.45 - top.timeOfImpact : 0;
          if (h > 0.02 && h < 0.4) rb.setTranslation({ x: pos.x, y: pos.y + h + 0.02, z: pos.z }, true);
        }
      }
    }

    rb.setLinvel({ x: vel.current.x, y: vy, z: vel.current.z }, true);

    // ─── Aterrizaje ───
    if (!grounded) minVy.current = Math.min(minVy.current, lin.y);
    if (grounded && !wasGrounded.current) {
      const impact = Math.min(Math.abs(minVy.current) / 12, 1);
      if (impact > 0.25) {
        squash.current.vel += 10 * impact;
        sfx.land();
        emit('dust', [pos.x, pos.y, pos.z], Math.round(6 + impact * 8));
      }
      minVy.current = 0;
    }
    wasGrounded.current = grounded;

    if (input.teleport) {
      rb.setTranslation(input.teleport, true);
      input.teleport = null;
    }

    // Red de seguridad si se cae del mundo
    if (pos.y < -15) {
      rb.setTranslation(SPAWN, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    // ─── Estado compartido (sin React) ───
    player.position.set(pos.x, pos.y, pos.z);
    player.velocity.set(vel.current.x, vy, vel.current.z);
    player.grounded = grounded;
    const speed01 = Math.min(Math.hypot(vel.current.x, vel.current.z) / maxSpeed, 1);
    player.speed01 = speed01;

    // ─── Rotación hacia donde camina ───
    if (moving) targetRotation.current = Math.atan2(worldX, worldZ);
    let rotDiff = targetRotation.current - groupRef.current.rotation.y;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    groupRef.current.rotation.y += rotDiff * (1 - Math.exp(-12 * delta));

    // ─── Resorte de squash & stretch ───
    const sq = squash.current;
    const airStretch = grounded ? 0 : THREE.MathUtils.clamp(-vy * 0.02, -0.15, 0.12);
    const force = -180 * (sq.value - airStretch) - 14 * sq.vel;
    sq.vel += force * delta;
    sq.value += sq.vel * delta;
    const breathe = speed01 < 0.1 ? Math.sin(state.clock.elapsedTime * 2.2) * 0.015 : 0;
    const sy = 1 - sq.value + breathe;
    const sxz = 1 + sq.value * 0.5 - breathe * 0.5;
    bodyRef.current.scale.set(sxz, sy, sxz);

    // Inclinación hacia adelante al correr
    bodyRef.current.rotation.x = damp(bodyRef.current.rotation.x, speed01 * 0.18, 10, delta);

    // ─── Ciclo de caminata ───
    if (grounded && speed01 > 0.1) {
      walkPhase.current += delta * WALK_CYCLE_SPEED * (0.5 + speed01 * 0.6);
      const s = Math.sin(walkPhase.current);
      const swing = s * LIMB_SWING * speed01;
      if (leftArmRef.current) leftArmRef.current.rotation.x = swing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -swing;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = swing;
      // Rebote al pisar
      bodyRef.current.position.y = Math.abs(Math.cos(walkPhase.current)) * 0.07 * speed01;

      // Pasos: sonido + polvito en cada pisada
      const sign = Math.sign(s);
      if (sign !== lastStepSign.current) {
        lastStepSign.current = sign;
        sfx.step();
        if (speed01 > 0.6 && Math.random() < 0.6) emit('dust', [pos.x, pos.y, pos.z], 2);
      }
    } else {
      const k = 1 - Math.exp(-10 * delta);
      const armAir = grounded ? 0 : -2.4; // brazos arriba en el aire
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x += (0 - leftArmRef.current.rotation.x) * k;
        leftArmRef.current.rotation.z += ((grounded ? 0 : -armAir * 0.25) - leftArmRef.current.rotation.z) * k;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x += (0 - rightArmRef.current.rotation.x) * k;
        rightArmRef.current.rotation.z += ((grounded ? 0 : armAir * 0.25) - rightArmRef.current.rotation.z) * k;
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x += ((grounded ? 0 : 0.4) - leftLegRef.current.rotation.x) * k;
      if (rightLegRef.current) rightLegRef.current.rotation.x += ((grounded ? 0 : -0.25) - rightLegRef.current.rotation.x) * k;
      bodyRef.current.position.y *= 1 - k;
    }

    const now = state.clock.elapsedTime;

    // Bata: color del ítem equipado; la arcoíris va cambiando de tono
    const coatItem = ITEM_BY_ID[equipped.coat];
    if (coatItem?.color === 'rainbow') materials.coat.color.setHSL((now * 0.15) % 1, 0.75, 0.72);
    else if (coatItem?.color) materials.coat.color.set(coatItem.color);

    // Capa: se levanta con la velocidad y ondea
    if (capeRef.current) capeRef.current.rotation.x = 0.12 + speed01 * 0.9 + Math.sin(now * 9) * 0.06 * (0.3 + speed01);

    // Cabeza: leve balanceo al correr
    if (headRef.current) {
      headRef.current.rotation.z = Math.sin(walkPhase.current) * 0.06 * speed01;
    }

    // La sombra queda sobre el suelo, fuera del cuerpo que salta.
    const shadow = shadowRef.current;
    if (shadow) {
      const p = rb.translation();
      shadowRay.origin = { x: p.x, y: p.y + 0.3, z: p.z };
      const floorHit = world.castRay(shadowRay, 30, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, rb);
      let groundY = floorHit ? shadowRay.origin.y - floorHit.timeOfImpact : -Infinity;
      // Las escaleras no tienen collider: usar la superficie de sus peldaños.
      for (const f of STAIRS) {
        if (p.x < f.x0 || p.x > f.x1 || p.z < f.z0 || p.z > f.z1) continue;
        const step = Math.min(STAIR_STEPS - 1, Math.floor(((p.x - f.x0) / (f.x1 - f.x0)) * STAIR_STEPS));
        const t = (step + (f.y1 > f.y0 ? 1 : 0)) / STAIR_STEPS;
        const y = THREE.MathUtils.lerp(f.y0, f.y1, t);
        if (y <= shadowRay.origin.y) groundY = Math.max(groundY, y);
      }
      shadow.visible = Number.isFinite(groundY);
      if (shadow.visible) {
        const height = Math.max(0, p.y - groundY);
        shadow.position.set(p.x, groundY + 0.03, p.z);
        shadow.scale.setScalar(Math.max(0.45, 1 - height * 0.25));
        (shadow.material as THREE.MeshBasicMaterial).opacity = 1 / (1 + height * 0.8);
      }
    }
  });

  return (
    <>
    <BlobShadow meshRef={shadowRef} />
    <RigidBody
      ref={rigidBodyRef}
      position={SPAWN.toArray()}
      enabledRotations={[false, false, false]}
      linearDamping={0}
      friction={0}
      mass={1}
      colliders={false}
      ccd
    >
      <CapsuleCollider args={[0.4, 0.22]} position={[0, 0.62, 0]} />

      {/* Bajado 0.09 m: los zapatos del modelo quedaban sobre la base de la cápsula (flotaba) */}
      <group ref={groupRef} position={[0, -0.09, 0]} userData={{ outline: 0.014 }}>
        <group ref={bodyRef}>
          {/* === HEAD === */}
          <group ref={headRef} position={[0, 1.28, 0]}>
            <mesh geometry={geometries.head} material={materials.skin} castShadow />
            <mesh geometry={geometries.hairTop} material={materials.hair} position={[0, 0.03, -0.02]} rotation={[-0.2, 0, 0]} />
            <mesh geometry={geometries.hairTuft} material={materials.hair} position={[0.05, 0.3, 0.02]} rotation={[0.3, 0, -0.4]} />

            <group ref={eyesRef} position={[0, 0.02, 0]} userData={{ noOutline: true, noBatch: true }}>
              {([-0.1, 0.1] as const).map((x) => (
                <group key={x} position={[x, 0, 0.22]}>
                  <mesh geometry={geometries.eye} material={materials.eyeWhite} />
                  <mesh geometry={geometries.pupil} material={materials.eye} position={[0, 0, 0.03]} />
                </group>
              ))}
            </group>
            <Smile meshRef={mouthRef} position={[0, -0.075, 0.259]} scale={1.35} />
            {([-0.17, 0.17] as const).map((x) => (
              <mesh key={x} geometry={geometries.cheek} material={materials.cheek} position={[x, -0.07, 0.2]} scale={[1, 0.6, 0.5]} userData={{ noOutline: true }} />
            ))}
          </group>

          {/* === ACCESORIOS DE LA TIENDA === */}
          <group position={[0, 1.28, 0]}>
            {equipped.hat === 'hat-surgery' && (
              <mesh geometry={geometries.capDome} material={materials.capBlue} position={[0, 0.05, -0.01]} rotation={[-0.15, 0, 0]} />
            )}
            {equipped.hat === 'hat-crown' && (
              <group position={[0, 0.27, 0]}>
                <mesh geometry={geometries.crownBand} material={materials.gold} />
                {Array.from({ length: 6 }).map((_, i) => (
                  <mesh
                    key={i}
                    geometry={geometries.crownSpike}
                    material={materials.gold}
                    position={[Math.sin((i / 6) * Math.PI * 2) * 0.2, 0.1, Math.cos((i / 6) * Math.PI * 2) * 0.2]}
                  />
                ))}
              </group>
            )}
            {equipped.extras.includes('extra-glasses') && (
              <group position={[0, 0.02, 0.26]} userData={{ noOutline: true }}>
                <mesh geometry={geometries.lens} material={materials.glassFrame} position={[-0.1, 0, 0]} />
                <mesh geometry={geometries.lens} material={materials.glassFrame} position={[0.1, 0, 0]} />
                <mesh geometry={geometries.bridge} material={materials.glassFrame} />
              </group>
            )}
            {equipped.extras.includes('extra-mirror') && (
              <group userData={{ noOutline: true }}>
                <mesh geometry={geometries.band} material={materials.glassFrame} position={[0, 0.12, 0]} rotation={[Math.PI / 2 - 0.2, 0, 0]} />
                <mesh geometry={geometries.mirrorDisc} material={materials.mirror} position={[0, 0.17, 0.26]} rotation={[Math.PI / 2 - 0.3, 0, 0]} />
              </group>
            )}
          </group>
          {equipped.extras.includes('extra-cape') && (
            <group ref={capeRef} position={[0, 1.05, -0.2]}>
              <mesh geometry={geometries.cape} material={materials.cape} position={[0, -0.31, 0]} />
            </group>
          )}

          {/* === STETHOSCOPE === */}
          <group position={[0, 1.02, 0.06]}>
            <mesh geometry={geometries.stethTube} material={materials.stethoscope} rotation={[0.2, 0, Math.PI]} />
            <mesh geometry={geometries.stethPiece} material={materials.stethoscope} position={[0.05, -0.14, 0.13]} rotation={[Math.PI / 2, 0, 0]} />
          </group>

          {/* === BODY (bata blanca) === */}
          <mesh geometry={geometries.body} material={materials.coat} position={[0, 0.8, 0]} castShadow />
          {/* Cruz roja en el bolsillo */}
          <group position={[-0.1, 0.9, 0.19]}>
            <mesh geometry={geometries.crossBar} material={materials.cross} />
            <mesh geometry={geometries.crossBar} material={materials.cross} rotation={[0, 0, Math.PI / 2]} />
          </group>

          {/* === ARMS === */}
          <group ref={leftArmRef} position={[-0.26, 1.0, 0]}>
            <mesh geometry={geometries.arm} material={materials.coat} position={[0, -0.16, 0]} castShadow />
            <mesh geometry={geometries.hand} material={materials.skin} position={[0, -0.34, 0]} />
          </group>
          <group ref={rightArmRef} position={[0.26, 1.0, 0]}>
            <mesh geometry={geometries.arm} material={materials.coat} position={[0, -0.16, 0]} castShadow />
            <mesh geometry={geometries.hand} material={materials.skin} position={[0, -0.34, 0]} />
          </group>

          {/* === LEGS === */}
          <group ref={leftLegRef} position={[-0.1, 0.5, 0]}>
            <mesh geometry={geometries.leg} material={materials.pants} position={[0, -0.17, 0]} castShadow />
            <mesh geometry={geometries.shoe} material={materials.shoe} position={[0, -0.36, 0.03]} scale={[1, 0.6, 1.3]} />
          </group>
          <group ref={rightLegRef} position={[0.1, 0.5, 0]}>
            <mesh geometry={geometries.leg} material={materials.pants} position={[0, -0.17, 0]} castShadow />
            <mesh geometry={geometries.shoe} material={materials.shoe} position={[0, -0.36, 0.03]} scale={[1, 0.6, 1.3]} />
          </group>
        </group>
      </group>
    </RigidBody>
    </>
  );
}
