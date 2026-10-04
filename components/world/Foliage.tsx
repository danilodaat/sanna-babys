'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { PARK, POND, ROADS, TOWN } from '@/lib/mapData';
import { getToonGradient } from '@/components/fx/Toonify';
import { NPCS } from '@/lib/npcs';
import { SIDEWALKS } from '@/lib/ground';

/*
 * Pasto y flores instanciados que se mecen con el viento (shader).
 * Nueve sectores permiten descartar vegetación fuera del encuadre.
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
  [-40, 38, 2.2, 11], // sendero del parque y margen tranquilo
  [-50, 37.5, 3, 2], // columpios
  [-30, 33, 2.5, 2], // tobogán
  [-47, 44, 1.8, 1.8], // arenero
];

// Flores concentradas en accesos y jardines: [x, z, radioX, radioZ].
const GARDENS = [
  [-6, 11.3, 1.2, 0.5], [6, 11.3, 1.2, 0.5],
  [-16, 26.3, 2, 0.8], [2, 27, 2, 1],
  [-49, 30, 2.8, 1.5], [-49, 47, 2.5, 1],
  [-44, 7.5, 4, 1], [43, 10, 2, 1.5],
];
const OUTDOOR_NPCS = NPCS.filter((n) => n.position[1] < 1);
const CLEAR_PATHS = [...ROADS, ...SIDEWALKS];
type Plant = { x: number; z: number; r: number; s: number; c: number };

function blocked(x: number, z: number) {
  if ((x - POND.x) ** 2 + (z - POND.z) ** 2 < (POND.r + 0.65) ** 2) return true;
  if (OUTDOOR_NPCS.some((n) => (x - n.position[0]) ** 2 + (z - n.position[2]) ** 2 < 2.2 ** 2)) return true;
  for (const [cx, cz, w, d] of CLEAR_PATHS) {
    if (Math.abs(x - cx) < w / 2 + 0.6 && Math.abs(z - cz) < d / 2 + 0.6) return true;
  }
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

function scatter(count: number, range: number, seed: number, flowers = false) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const out: Plant[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 10) {
    let x = (rnd() - 0.5) * range * 2;
    let z = (rnd() - 0.5) * range * 2;
    if (flowers) {
      const [cx, cz, rx, rz] = GARDENS[Math.floor(rnd() * GARDENS.length)];
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      x = cx + Math.cos(a) * r * rx;
      z = cz + Math.sin(a) * r * rz;
    }
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

/** Un lote por especie y sector, con límites que incluyen el viento. */
function Sector({ points, geometry, material, flowers = false }: {
  points: Plant[];
  geometry: THREE.BufferGeometry;
  material: THREE.MeshToonMaterial;
  flowers?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const palette = flowers ? ['#DFA4BA', '#E8D8A4', '#FFF4E3', '#B89AC9', '#E4B797', '#9FC8D8'] : ['#80B66F', '#8FCB78', '#73A765', '#A0CC8B'];
    points.forEach((p, i) => {
      const inPark = Math.abs(p.x - PARK[0]) < PARK[2] / 2 && Math.abs(p.z - PARK[1]) < PARK[3] / 2;
      dummy.position.set(p.x, inPark ? 0.05 : 0, p.z);
      dummy.rotation.set(0, p.r, 0);
      dummy.scale.setScalar(flowers ? 0.8 + p.s * 0.4 : p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(palette[Math.floor(p.c * palette.length)]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // El shader desplaza las puntas: ampliar los límites calculados en CPU.
    mesh.computeBoundingBox();
    mesh.boundingBox?.expandByScalar(0.3);
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.3;
    return () => mesh.dispose();
  }, [points, flowers]);
  return (
    <instancedMesh ref={ref} args={[geometry, material, points.length]} receiveShadow={!flowers} userData={{ noToon: true }} dispose={null} />
  );
}

export default function Foliage() {
  const quality = useGameStore((s) => s.quality);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const grassCount = quality === 'alto' ? 3200 : 1400;
  const flowerCount = quality === 'alto' ? 500 : 220;

  const sectors = useMemo(() => {
    const split = (points: Plant[]) => {
      const chunks = Array.from({ length: 9 }, () => [] as Plant[]);
      for (const p of points) {
        const x = Math.max(0, Math.min(2, Math.floor((p.x + 96) / 64)));
        const z = Math.max(0, Math.min(2, Math.floor((p.z + 96) / 64)));
        chunks[z * 3 + x].push(p);
      }
      return chunks;
    };
    return { grass: split(scatter(grassCount, 95, 11)), flowers: split(scatter(flowerCount, 90, 23, true)) };
  }, [grassCount, flowerCount]);

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

  useEffect(() => () => {
    grass.geometry.dispose();
    grass.material.dispose();
    flower.geometry.dispose();
    flower.material.dispose();
  }, [grass, flower]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      {sectors.grass.map((points, i) => points.length > 0 && (
        <Sector key={`g-${i}`} points={points} geometry={grass.geometry} material={grass.material} />
      ))}
      {sectors.flowers.map((points, i) => points.length > 0 && (
        <Sector key={`f-${i}`} points={points} geometry={flower.geometry} material={flower.material} flowers />
      ))}
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
