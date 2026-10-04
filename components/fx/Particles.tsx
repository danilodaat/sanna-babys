'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fxQueue, type FxKind } from '@/lib/fx';

/*
 * Sistema de partículas con InstancedMesh: un draw call por tipo, sin
 * importar cuántas partículas haya vivas. Pools fijos, cero allocs por frame.
 */

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
}

interface PoolConfig {
  max: number;
  gravity: number;
  drag: number;
  spawn: (p: Particle, origin: THREE.Vector3, i: number, n: number) => void;
  /** escala en función de t (0 = nace, 1 = muere) */
  scale: (t: number) => number;
}

const CONFETTI_COLORS = ['#FF6B9D', '#FFD54F', '#4FC3F7', '#81C784', '#BA68C8', '#FF8A65'];

const CONFIGS: Record<FxKind, PoolConfig> = {
  hearts: {
    max: 60,
    gravity: -1.2, // flotan hacia arriba
    drag: 1.5,
    spawn: (p, o) => {
      p.pos.set(o.x + (Math.random() - 0.5) * 0.6, o.y + Math.random() * 0.4, o.z + (Math.random() - 0.5) * 0.6);
      p.vel.set((Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2);
      p.spin.set(0, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 1.5);
      p.maxLife = 1.6 + Math.random() * 0.8;
      p.size = 0.7 + Math.random() * 0.6;
    },
    scale: (t) => (t < 0.15 ? t / 0.15 : 1 - Math.pow((t - 0.15) / 0.85, 3)),
  },
  confetti: {
    max: 240,
    gravity: 6,
    drag: 2.2,
    spawn: (p, o) => {
      p.pos.set(o.x, o.y + 1, o.z);
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 5;
      p.vel.set(Math.cos(a) * s * 0.6, 5 + Math.random() * 6, Math.sin(a) * s * 0.6);
      p.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      p.maxLife = 2 + Math.random() * 1.2;
      p.size = 0.8 + Math.random() * 0.5;
    },
    scale: (t) => (t > 0.8 ? (1 - t) / 0.2 : 1),
  },
  dust: {
    max: 80,
    gravity: -0.4,
    drag: 4,
    spawn: (p, o) => {
      p.pos.set(o.x + (Math.random() - 0.5) * 0.3, o.y + 0.05, o.z + (Math.random() - 0.5) * 0.3);
      const a = Math.random() * Math.PI * 2;
      p.vel.set(Math.cos(a) * 1.2, 0.4 + Math.random() * 0.6, Math.sin(a) * 1.2);
      p.spin.set(0, 0, 0);
      p.maxLife = 0.5 + Math.random() * 0.3;
      p.size = 0.6 + Math.random() * 0.6;
    },
    scale: (t) => Math.sin(Math.min(t * 1.2, 1) * Math.PI) * (1 + t),
  },
  sparkle: {
    max: 80,
    gravity: -0.5,
    drag: 2,
    spawn: (p, o) => {
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 0.5;
      p.pos.set(o.x + Math.cos(a) * r, o.y + Math.random() * 1.2, o.z + Math.sin(a) * r);
      p.vel.set(0, 0.5 + Math.random(), 0);
      p.spin.set(0, 6, 0);
      p.maxLife = 0.8 + Math.random() * 0.6;
      p.size = 0.5 + Math.random() * 0.7;
    },
    scale: (t) => Math.sin(t * Math.PI),
  },
};

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.06);
  s.bezierCurveTo(0.05, 0.2, 0.25, 0.18, 0.22, 0.02);
  s.bezierCurveTo(0.2, -0.08, 0.05, -0.15, 0, -0.25);
  s.bezierCurveTo(-0.05, -0.15, -0.2, -0.08, -0.22, 0.02);
  s.bezierCurveTo(-0.25, 0.18, -0.05, 0.2, 0, 0.06);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  g.center();
  return g;
}

function Pool({ kind }: { kind: FxKind }) {
  const cfg = CONFIGS[kind];
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const active = useRef(0);

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: cfg.max }, () => ({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        spin: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
      })),
    [cfg.max],
  );

  const { geometry, material } = useMemo(() => {
    switch (kind) {
      case 'hearts':
        return {
          geometry: heartGeometry(),
          material: new THREE.MeshBasicMaterial({ color: new THREE.Color('#FF4F8B').multiplyScalar(1.6), toneMapped: false }),
        };
      case 'confetti':
        return {
          geometry: new THREE.PlaneGeometry(0.16, 0.08),
          material: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
        };
      case 'dust':
        return {
          geometry: new THREE.IcosahedronGeometry(0.12, 0),
          material: new THREE.MeshBasicMaterial({ color: '#F3EDE2', transparent: true, opacity: 0.75, depthWrite: false }),
        };
      case 'sparkle':
        return {
          geometry: new THREE.OctahedronGeometry(0.07, 0),
          material: new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE57F').multiplyScalar(2.5), toneMapped: false }),
        };
    }
  }, [kind]);

  // Colores por instancia para el confeti
  const colored = kind === 'confetti';
  const initColors = useRef(false);

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const delta = Math.min(rawDelta, 0.05);

    if (colored && !initColors.current) {
      const c = new THREE.Color();
      for (let i = 0; i < cfg.max; i++) mesh.setColorAt(i, c.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      (mesh.material as THREE.Material).needsUpdate = true;
      initColors.current = true;
    }

    // Consumir pedidos de este tipo
    for (let q = fxQueue.length - 1; q >= 0; q--) {
      const req = fxQueue[q];
      if (req.kind !== kind) continue;
      fxQueue.splice(q, 1);
      let spawned = 0;
      for (const p of particles) {
        if (spawned >= req.count) break;
        if (p.alive) continue;
        cfg.spawn(p, req.position, spawned, req.count);
        p.alive = true;
        active.current++;
        p.life = 0;
        p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        if (kind === 'hearts') p.rot.set(0, Math.random() * 6, 0);
        spawned++;
      }
    }

    if (active.current === 0) {
      mesh.visible = false;
      return;
    }

    let visible = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.alive) {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.alive = false;
          active.current--;
        }
      }
      if (!p.alive) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      visible++;
      p.vel.y -= cfg.gravity * delta;
      p.vel.multiplyScalar(Math.max(0, 1 - cfg.drag * delta * 0.5));
      p.pos.addScaledVector(p.vel, delta);
      if (kind === 'confetti' && p.pos.y < 0.05) {
        p.pos.y = 0.05;
        p.vel.set(0, 0, 0);
        p.spin.multiplyScalar(0.9);
      }
      p.rot.x += p.spin.x * delta;
      p.rot.y += p.spin.y * delta;
      p.rot.z += p.spin.z * delta;
      const t = p.life / p.maxLife;
      dummy.position.copy(p.pos);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(Math.max(0.0001, cfg.scale(t) * p.size));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = visible > 0;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, cfg.max]}
      visible={false}
      frustumCulled={false}
      userData={{ noToon: true }}
    />
  );
}

export default function Particles() {
  return (
    <group>
      <Pool kind="hearts" />
      <Pool kind="confetti" />
      <Pool kind="dust" />
      <Pool kind="sparkle" />
    </group>
  );
}
