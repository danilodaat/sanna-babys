'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { ZONES, zoneAt, type Zone } from '@/lib/zones';
import { player, input } from '@/lib/runtime';
import { toast } from '@/lib/toast';
import { emit } from '@/lib/fx';
import { sfx } from '@/lib/audio';
import { getToonGradient } from '@/components/fx/Toonify';

/*
 * Zonas por nivel:
 *  - cerradas: fila de conos de obra alrededor + cartel "🔒 Nivel N";
 *    si el doctor intenta entrar, vuelve al último punto válido
 *  - al entrar a una zona abierta: aviso con su nombre
 *  - al desbloquearse: confeti en la zona y aviso grande
 */

const CONE_SPACING = 2.4;

function perimeter(z: Zone) {
  const [cx, cz, w, d] = z.rect;
  const pts: [number, number][] = [];
  const edge = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / CONE_SPACING));
    for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
  };
  const [x0, x1, z0, z1] = [cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2];
  edge(x0, z0, x1, z0);
  edge(x1, z0, x1, z1);
  edge(x1, z1, x0, z1);
  edge(x0, z1, x0, z0);
  return pts;
}

function ConeRing({ zone }: { zone: Zone }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const stripes = useRef<THREE.InstancedMesh>(null);
  const pts = useMemo(() => perimeter(zone), [zone]);
  const geo = useMemo(() => new THREE.ConeGeometry(0.3, 0.8, 10).translate(0, 0.4, 0), []);
  const stripeGeo = useMemo(() => new THREE.CylinderGeometry(0.19, 0.24, 0.14, 10).translate(0, 0.42, 0), []);
  const mat = useMemo(() => new THREE.MeshToonMaterial({ color: '#D9A17C', gradientMap: getToonGradient() }), []);
  const stripeMat = useMemo(() => new THREE.MeshToonMaterial({ color: '#FFF4E3', gradientMap: getToonGradient() }), []);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    pts.forEach(([x, z], i) => {
      d.position.set(x, 0, z);
      d.updateMatrix();
      ref.current?.setMatrixAt(i, d.matrix);
      stripes.current?.setMatrixAt(i, d.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    if (stripes.current) stripes.current.instanceMatrix.needsUpdate = true;
  }, [pts]);

  const [cx, cz] = zone.rect;
  return (
    <group>
      <instancedMesh ref={ref} args={[geo, mat, pts.length]} castShadow userData={{ noToon: true }} />
      <instancedMesh ref={stripes} args={[stripeGeo, stripeMat, pts.length]} userData={{ noToon: true }} />
      <Html position={[cx, 6, cz]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            whiteSpace: 'nowrap',
            padding: '6px 12px',
            borderRadius: 14,
            background: 'rgba(30,20,50,0.7)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {zone.emoji} {zone.name}
          <div style={{ fontSize: 12, color: '#ffd54f' }}>🔒 Se abre en el nivel {zone.minLevel}</div>
        </div>
      </Html>
    </group>
  );
}

export default function Zones() {
  const level = useGameStore((s) => s.level);
  const started = useGameStore((s) => s.started);
  const locked = ZONES.filter((z) => level < z.minLevel);
  const lastSafe = useRef(new THREE.Vector3(0, 1, 1));
  const currentZone = useRef<string | null>(null);
  const prevLevel = useRef(level);

  // Desbloqueo: festejo en cada zona nueva
  useEffect(() => {
    if (level > prevLevel.current) {
      ZONES.filter((z) => z.minLevel > prevLevel.current && z.minLevel <= level).forEach((z, i) => {
        setTimeout(() => {
          const [cx, cz] = z.rect;
          emit('confetti', [cx, 0, cz], 120);
          sfx.found();
          toast(`¡Nueva zona abierta: ${z.name}!`, z.emoji, { big: true, ms: 3800 });
        }, 3000 + i * 1500); // después de la celebración de nivel
      });
    }
    prevLevel.current = level;
  }, [level]);

  useFrame(() => {
    if (!started) return;
    const p = player.position;
    const zone = zoneAt(p.x, p.z);
    const lvl = useGameStore.getState().level;

    if (zone && lvl < zone.minLevel) {
      // Zona cerrada: devolver al último punto válido
      input.teleport = lastSafe.current.clone();
      toast(`${zone.name} se abre en el nivel ${zone.minLevel}`, '🔒');
      return;
    }
    // Solo guardar como "seguro" un punto claramente fuera de zonas cerradas
    const nearLocked = zoneAt(p.x, p.z, 1.2);
    if (!nearLocked || lvl >= nearLocked.minLevel) lastSafe.current.set(p.x, Math.max(p.y, 0.3), p.z);

    const id = zone?.id ?? null;
    if (id !== currentZone.current) {
      currentZone.current = id;
      if (zone) toast(zone.name, zone.emoji);
    }
  });

  return (
    <group>
      {locked.map((z) => (
        <ConeRing key={z.id} zone={z} />
      ))}
    </group>
  );
}
