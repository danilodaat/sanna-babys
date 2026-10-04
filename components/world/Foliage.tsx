'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { TOWN } from '@/lib/mapData';
import { getToonGradient } from '@/components/fx/Toonify';

/*
 * Pasto y flores instanciados que se mecen con el viento (shader).
 * Miles de matas en 2 draw calls. Se evitan pistas, hospital y edificios.
 */

// Zonas sin vegetación: [x, z, halfW, halfD]
const BLOCKED: [number, number, number, number][] = [
  [0, 0, 13.5, 10.5], // hospital
  [0, 18, 62, 5], // avenida E-O
  [20, 0, 5, 62], // avenida N-S
  [-25, 0, 5, 31], // calle oeste
  [0, -20, 41, 5], // calle sur
  [-15, 32, 5, 4.5],
  [-3, 34, 6, 5.5],
  [12, 33, 5.5, 5],
  [36, 33, 10, 7], // escuela
  [36, 26, 9, 3], // arco y patio de la escuela
  [35, -5, 5, 5],
  [35, 8, 4.5, 4],
  [-45.5, -9, 17, 3.5], // Calle Sol
  [-45, 0, 13, 5.5], // casas norte + jardines
  [-45, -18, 13, 5.5], // casas sur + jardines
  [-30.5, -9, 1.5, 4.5], // arco del sol
  [-10, -28, 5, 4.5],
  [5, -30, 6, 5],
  [-40, 38, 1.5, 11], // sendero del parque
  [-50, 37.5, 3, 2], // columpios
  [-30, 33, 2.5, 2], // tobogán
  [-47, 44, 1.8, 1.8], // arenero
];

function blocked(x: number, z: number) {
  for (const [bx, bz, hw, hd] of BLOCKED) {
    if (Math.abs(x - bx) < hw && Math.abs(z - bz) < hd) return true;
  }
  // Edificios del barrio nuevo (y cualquiera que se sume a mapData)
  for (const b of TOWN) {
    const [bx, bz, w, d] = b.rect;
    if (Math.abs(x - bx) < w / 2 + 1.5 && Math.abs(z - bz) < d / 2 + 2.5) return true;
  }
  return false;
}

function scatter(count: number, range: number, seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const out: { x: number; z: number; r: number; s: number; c: number }[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 10) {
    const x = (rnd() - 0.5) * range * 2;
    const z = (rnd() - 0.5) * range * 2;
    if (blocked(x, z)) continue;
    out.push({ x, z, r: rnd() * Math.PI * 2, s: 0.6 + rnd() * 0.8, c: rnd() });
  }
  return out;
}

function windMaterial(color: string, gradient: THREE.Texture, uniforms: { uTime: { value: number } }, strength: number) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 wp = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
          float h = max(position.y, 0.0);
          float w = sin(uTime * 1.8 + wp.x * 0.35 + wp.y * 0.25) + 0.4 * sin(uTime * 3.1 + wp.x * 0.9);
          transformed.x += w * ${strength.toFixed(3)} * h;
          transformed.z += w * ${(strength * 0.5).toFixed(3)} * h;
        #endif`,
      );
  };
  m.customProgramCacheKey = () => `wind-${color}-${strength}`;
  m.userData.wind = true;
  return m;
}

export default function Foliage() {
  const quality = useGameStore((s) => s.quality);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const flowerRef = useRef<THREE.InstancedMesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const grassCount = quality === 'alto' ? 3200 : 1400;
  const flowerCount = quality === 'alto' ? 500 : 220;

  const gradient = useMemo(() => getToonGradient(), []);

  const grass = useMemo(() => {
    // Mata de 3 hojitas (conos aplastados) fusionada en una sola geometría
    const blades: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.ConeGeometry(0.06, 0.38, 3, 1);
      g.translate(0, 0.19, 0);
      g.rotateZ((i - 1) * 0.35);
      g.rotateY(i * 2.1);
      g.translate((i - 1) * 0.05, 0, (i % 2) * 0.04);
      blades.push(g.toNonIndexed());
    }
    const merged = mergeSimple(blades);
    return {
      geometry: merged,
      material: windMaterial('#ffffff', gradient, uniforms, 0.18),
    };
  }, [gradient, uniforms]);

  const flower = useMemo(() => {
    const stem = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 4).translate(0, 0.16, 0).toNonIndexed();
    const head = new THREE.IcosahedronGeometry(0.075, 0).translate(0, 0.34, 0);
    return {
      geometry: mergeSimple([stem, head]),
      material: windMaterial('#ffffff', gradient, uniforms, 0.22),
    };
  }, [gradient, uniforms]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const greens = ['#80B66F', '#8FCB78', '#73A765', '#A0CC8B'];
    const petals = ['#DFA4BA', '#E8D8A4', '#FFF4E3', '#B89AC9', '#E4B797', '#9FC8D8'];

    const g = grassRef.current;
    if (g) {
      scatter(grassCount, 95, 11).forEach((p, i) => {
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0, p.r, 0);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        g.setMatrixAt(i, dummy.matrix);
        g.setColorAt(i, color.set(greens[Math.floor(p.c * greens.length)]));
      });
      g.instanceMatrix.needsUpdate = true;
      if (g.instanceColor) g.instanceColor.needsUpdate = true;
    }
    const f = flowerRef.current;
    if (f) {
      scatter(flowerCount, 90, 23).forEach((p, i) => {
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0, p.r, 0);
        dummy.scale.setScalar(0.8 + p.s * 0.4);
        dummy.updateMatrix();
        f.setMatrixAt(i, dummy.matrix);
        f.setColorAt(i, color.set(petals[Math.floor(p.c * petals.length)]));
      });
      f.instanceMatrix.needsUpdate = true;
      if (f.instanceColor) f.instanceColor.needsUpdate = true;
    }
  }, [grassCount, flowerCount]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      <instancedMesh
        key={`g-${grassCount}`}
        ref={grassRef}
        args={[grass.geometry, grass.material, grassCount]}
        receiveShadow
        userData={{ noToon: true }}
      />
      <instancedMesh
        key={`f-${flowerCount}`}
        ref={flowerRef}
        args={[flower.geometry, flower.material, flowerCount]}
        userData={{ noToon: true }}
      />
    </group>
  );
}

/** Une geometrías no indexadas (posición + normal). Evita traer BufferGeometryUtils. */
function mergeSimple(geos: THREE.BufferGeometry[]) {
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) {
    g.computeVertexNormals();
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
