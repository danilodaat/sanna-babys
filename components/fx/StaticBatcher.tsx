'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getToonGradient } from './Toonify';
import { reapplyHidden, setHiddenSelf } from '@/lib/hide';

/*
 * Fusión de geometría: de ~1.300 meshes visibles a unas decenas de draw calls.
 *
 * Dos modos:
 *  - userData.batch      → mundo estático: se fusiona en coordenadas de mundo,
 *                          por sectores de 24 m (así se sigue descartando lo
 *                          que queda fuera de cámara).
 *  - userData.batchLocal → un personaje: se fusiona en el espacio del grupo,
 *                          y el resultado queda colgado de ese grupo, así el
 *                          NPC sigue meciéndose, girando y festejando.
 *
 * Los materiales toon "lisos" (sin emisión ni textura) se unifican en uno solo
 * con color por vértice: cien colores distintos = un draw call. Los que
 * brillan (faroles, ventanas de noche) y los contornos se agrupan aparte.
 * Los originales se ocultan, no se borran: React y los colliders de Rapier
 * siguen apuntando a ellos.
 */

const CHUNK = 24;
const RUN_AT_FRAME = 4;

const plainMaterials = new Map<number, THREE.MeshToonMaterial>();
function plainMaterial(side: THREE.Side) {
  let m = plainMaterials.get(side);
  if (!m) {
    m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getToonGradient(), side });
    plainMaterials.set(side, m);
  }
  return m;
}

function isPlain(m: THREE.Material) {
  const t = m as THREE.MeshToonMaterial;
  if (!t.isMeshToonMaterial || t.map || m.userData?.night || m.transparent || !m.toneMapped) return false;
  return t.emissiveIntensity === 0 || t.emissive.getHex() === 0;
}

function materialKey(m: THREE.Material): string {
  if (isPlain(m)) return `plain|${m.side}`;
  // Contornos (MeshBasic con shader propio): por instancia. Emisivos: por propiedades.
  const t = m as THREE.MeshToonMaterial;
  if (!t.isMeshToonMaterial) return `${m.type}|${m.uuid}`;
  return `toon|${t.color.getHexString()}|${t.emissive.getHexString()}|${t.emissiveIntensity}|${m.side}|${m.toneMapped}|${m.userData?.night ?? ''}`;
}

interface Entry {
  material: THREE.Material;
  geos: THREE.BufferGeometry[];
  cast: boolean;
  receive: boolean;
  sources: THREE.Mesh[];
}

function prepGeometry(mesh: THREE.Mesh, matrix: THREE.Matrix4, plain: boolean) {
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(matrix);
  if (g.index) g = g.toNonIndexed();
  if (plain) {
    const c = (mesh.material as THREE.MeshToonMaterial).color;
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return g;
}

/** Recorre los meshes fusionables bajo `root`, sin entrar en otros lotes ni en lo excluido */
function collect(root: THREE.Object3D, visit: (m: THREE.Mesh) => void) {
  const walk = (o: THREE.Object3D) => {
    if (!o.visible || o.userData?.noBatch) return;
    if (o !== root && (o.userData?.batch || o.userData?.batchLocal)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material) && !mesh.userData.batched) {
      const material = mesh.material as THREE.Material & { map?: THREE.Texture | null };
      if (!material.transparent && !material.map) visit(mesh);
    }
    o.children.forEach(walk);
  };
  walk(root);
}

function build(groups: Map<string, Entry>, parent: THREE.Object3D) {
  let merged = 0;
  let hidden = 0;
  for (const entry of groups.values()) {
    const geo = mergeGeometries(entry.geos, false);
    entry.geos.forEach((g) => g.dispose());
    if (!geo) continue;
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, entry.material);
    m.castShadow = entry.cast;
    m.receiveShadow = entry.receive;
    m.userData.toonDone = true;
    m.userData.batched = true;
    parent.add(m);
    merged++;
    for (const src of entry.sources) {
      // Oculta por capa (no con visible=false: la física necesita verla para su colisión)
      setHiddenSelf(src, true);
      src.userData.batched = true;
      src.userData.batchedSource = true;
      hidden++;
    }
  }
  return { merged, hidden };
}

function addTo(groups: Map<string, Entry>, gkey: string, mesh: THREE.Mesh, matKey: string, g: THREE.BufferGeometry) {
  let e = groups.get(gkey);
  if (!e) {
    const mat = mesh.material as THREE.Material;
    e = { material: matKey.startsWith('plain') ? plainMaterial(mat.side) : mat, geos: [], cast: mesh.castShadow, receive: mesh.receiveShadow, sources: [] };
    groups.set(gkey, e);
  }
  e.geos.push(g);
  e.sources.push(mesh);
}

export default function StaticBatcher() {
  const scene = useThree((s) => s.scene);
  const frame = useRef(0);
  const done = useRef(false);

  useFrame(() => {
    if (done.current || frame.current++ < RUN_AT_FRAME) return;
    done.current = true;
    scene.updateMatrixWorld(true);

    const roots: THREE.Object3D[] = [];
    const locals: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData?.batch) roots.push(o);
      if (o.userData?.batchLocal) locals.push(o);
    });

    // ─── Mundo estático ───
    const world = new Map<string, Entry>();
    const p = new THREE.Vector3();
    for (const r of roots) {
      collect(r, (mesh) => {
        const mat = mesh.material as THREE.Material;
        const key = materialKey(mat);
        p.setFromMatrixPosition(mesh.matrixWorld);
        const gkey = `${key}|${Math.floor(p.x / CHUNK)}:${Math.floor(p.z / CHUNK)}|${mesh.castShadow}|${mesh.receiveShadow}`;
        addTo(world, gkey, mesh, key, prepGeometry(mesh, mesh.matrixWorld, key.startsWith('plain')));
      });
    }
    const worldRoot = new THREE.Group();
    worldRoot.name = 'static-batches';
    worldRoot.userData.noToon = true;
    const w = build(world, worldRoot);
    scene.add(worldRoot);

    // ─── Personajes: cada uno en su propio espacio ───
    let lm = 0;
    let lh = 0;
    const inv = new THREE.Matrix4();
    const rel = new THREE.Matrix4();
    for (const r of locals) {
      const groups = new Map<string, Entry>();
      inv.copy(r.matrixWorld).invert();
      collect(r, (mesh) => {
        const key = materialKey(mesh.material as THREE.Material);
        rel.multiplyMatrices(inv, mesh.matrixWorld);
        addTo(groups, `${key}|${mesh.castShadow}|${mesh.receiveShadow}`, mesh, key, prepGeometry(mesh, rel, key.startsWith('plain')));
      });
      const res = build(groups, r);
      lm += res.merged;
      lh += res.hidden;
    }

    // Los lotes nuevos deben respetar el cutaway aplicado antes de fusionar.
    reapplyHidden(scene);

    if (new URLSearchParams(window.location.search).has('debug')) {
      console.info(`[StaticBatcher] mundo: ${w.hidden} meshes → ${w.merged} lotes · personajes: ${lh} → ${lm}`);
    }
  });

  return null;
}
