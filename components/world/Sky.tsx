'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getToonGradient } from '@/components/fx/Toonify';

// Cinco esferas fusionadas sin grupos de material; un mesh por nube.
const cloudGeometry = (() => {
  const parts = [
    [2.5, 0, 0, 0],
    [2, 2.2, 0.3, 0],
    [2.2, -2, 0.2, 0.5],
    [1.8, 0.8, 1, 0],
    [1.5, -0.5, -0.5, 1],
  ].map(([radius, x, y, z], i) => {
    const g = new THREE.SphereGeometry(radius, 12, 12).translate(x, y, z);
    const c = new THREE.Color(i === 3 ? '#F8F8FF' : '#FFFFFF');
    const colors = new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3);
    for (let v = 0; v < colors.count; v++) colors.setXYZ(v, c.r, c.g, c.b);
    g.setAttribute('color', colors);
    return g;
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
})();
const cloudMaterial = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getToonGradient() });

/* ─── Nube compartida que se mueve como una unidad ─── */
function Cloud({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    // Gentle floating motion
    groupRef.current.position.x =
      position[0] + Math.sin(state.clock.elapsedTime * 0.15 + position[2]) * 1.5;
    groupRef.current.position.y =
      position[1] + Math.sin(state.clock.elapsedTime * 0.2 + position[0]) * 0.4;
  });

  return (
    <group ref={groupRef} position={position} scale={scale} dispose={null}>
      <mesh geometry={cloudGeometry} material={cloudMaterial} userData={{ noToon: true, noBatch: true }} />
    </group>
  );
}

/* ─── Nubes (el domo del cielo, sol y luna ahora viven en DayNight) ─── */
export function Sky() {
  return (
    <group>

      {/* Clouds scattered around */}
      <Cloud position={[-30, 40, -50]} scale={1.2} />
      <Cloud position={[25, 45, -65]} scale={1} />
      <Cloud position={[60, 38, -40]} scale={0.9} />
      <Cloud position={[-55, 42, -30]} scale={1.1} />
      <Cloud position={[0, 50, -80]} scale={1.4} />
      <Cloud position={[-40, 35, 20]} scale={0.8} />
      <Cloud position={[45, 48, 10]} scale={1} />
      <Cloud position={[10, 44, 40]} scale={0.7} />
    </group>
  );
}
