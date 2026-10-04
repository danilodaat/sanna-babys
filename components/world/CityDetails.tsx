'use client';

import { useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { POND, ROADS } from '@/lib/mapData';
import { setHidden } from '@/lib/hide';

/** Conserva los meshes originales para Rapier, ocultándolos solo al render. */
export function hideColliderVisual(obj: THREE.Object3D | null) {
  if (obj) setHidden(obj, true);
}

function facadeRotation(position: [number, number, number]) {
  const [x, , z] = position;
  let best = Infinity;
  let rot = 0;
  for (const [cx, cz, w, d] of ROADS) {
    const dx = Math.max(cx - w / 2, Math.min(x, cx + w / 2)) - x;
    const dz = Math.max(cz - d / 2, Math.min(z, cz + d / 2)) - z;
    const distance = dx * dx + dz * dz;
    if (distance >= best) continue;
    best = distance;
    rot = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
  }
  return rot;
}

const hipGeometry = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4);

/** Fachadas y remates fuera del RigidBody; la huella física permanece intacta. */
export function BuildingDetails({
  position, size, roofColor, windowColor, awning,
}: {
  position: [number, number, number];
  size: [number, number, number];
  roofColor: string;
  windowColor: string;
  awning: boolean;
}) {
  const scene = useThree((s) => s.scene);
  const rot = facadeRotation(position);
  const [worldW, h, worldD] = size;
  const sideways = Math.abs(Math.sin(rot)) > 0.5;
  const [w, d] = sideways ? [worldD, worldW] : [worldW, worldD];
  return createPortal(
    <group position={position} rotation={[0, rot, 0]} userData={{ batch: true }}>
      {/* Zócalo común, con la puerta por delante. */}
      <mesh receiveShadow position={[0, 0.225, 0]}>
        <boxGeometry args={[w + 0.04, 0.45, d + 0.04]} />
        <meshStandardMaterial color="#FFF4E3" />
      </mesh>
      {/* Cubierta plana en edificios altos; cuatro aguas en los bajos. */}
      {h < 10 && (
        <mesh geometry={hipGeometry} dispose={null} castShadow position={[0, h + 1.1, 0]} scale={[(w + 0.4) / Math.SQRT2, 1.4, (d + 0.4) / Math.SQRT2]}>
          <meshStandardMaterial color={roofColor} />
        </mesh>
      )}
      {/* Ventanas opacas sobre fachadas cerradas: permiten la fusión. */}
      {Array.from({ length: Math.max(1, Math.floor(w / 3)) }).map((_, i) => {
        const xStart = -w / 2 + 1.5;
        const xStep = (w - 3) / Math.max(1, Math.floor(w / 3) - 1) || 0;
        return Array.from({ length: Math.max(1, Math.floor(h / 3)) }).map((_, j) => (
          <mesh key={`${i}-${j}`} position={[xStart + i * xStep, 2 + j * 2.5, d / 2 + 0.05]}>
            <boxGeometry args={[1, 1.2, 0.05]} />
            <meshStandardMaterial color={windowColor} emissive={windowColor} emissiveIntensity={0.1} userData={{ night: 'window' }} />
          </mesh>
        ));
      })}
      <mesh position={[0, 1, d / 2 + 0.05]}>
        <boxGeometry args={[1.2, 2, 0.05]} />
        <meshStandardMaterial color="#5D4037" />
      </mesh>
      {awning && (
        <mesh castShadow position={[0, 4.5, d / 2 + 0.3]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[10.5, 0.1, 2]} />
          <meshStandardMaterial color="#FF6F00" />
        </mesh>
      )}
    </group>,
    scene,
  );
}

const rippleGeometry = new THREE.RingGeometry(0.96, 1, 32);
const rippleMaterials = [0, 1, 2].map(
  () => new THREE.MeshBasicMaterial({ color: '#FFF4E3', transparent: true, opacity: 0, depthWrite: false }),
);

/** Tres ondas gráficas lentas, sin colisión ni escritura de profundidad. */
export function PondRipples() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const group = ref.current;
    if (!group) return;
    group.children.forEach((ring, i) => {
      const progress = (state.clock.elapsedTime / 7 + i / 3) % 1;
      ring.scale.setScalar(0.35 + progress * (POND.r - 0.5));
      rippleMaterials[i].opacity = Math.sin(progress * Math.PI) * 0.22;
    });
  });
  return (
    <group ref={ref} userData={{ noBatch: true }} dispose={null}>
      {rippleMaterials.map((material, i) => (
        <mesh
          key={i}
          geometry={rippleGeometry}
          material={material}
          position={[POND.x, 0.09 + i * 0.01, POND.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          userData={{ noToon: true }}
        />
      ))}
    </group>
  );
}
