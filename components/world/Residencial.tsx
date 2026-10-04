'use client';

import { useMemo } from 'react';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { RESIDENCIAL_HOUSES, RESIDENCIAL_LANE } from '@/lib/mapData';

/*
 * Residencial Sol: barrio de casitas de colores con techo a dos aguas,
 * cerca, jardín y buzón, a ambos lados de la Calle Sol. En la entrada,
 * un arco con un sol sonriente.
 */

function roofGeometry(w: number, d: number, h: number) {
  // Prisma triangular (techo a dos aguas) con el caballete a lo largo de X
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.35, 0);
  shape.lineTo(0, h);
  shape.lineTo(d / 2 + 0.35, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: w + 0.5, bevelEnabled: false });
  g.translate(0, 0, -(w + 0.5) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function House({ x, z, facing, color, roof }: { x: number; z: number; facing: 1 | -1; color: string; roof: string }) {
  const W = 6;
  const D = 5.5;
  const H = 3.6;
  const roofGeo = useMemo(() => roofGeometry(W, D, 2.2), []);
  // facing = 1 → puerta hacia +z (mira a la calle desde el lado norte)
  return (
    <group position={[x, 0, z]} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
      <mesh castShadow receiveShadow position={[0, H / 2, 0]}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow geometry={roofGeo} position={[0, H, 0]}>
        <meshStandardMaterial color={roof} />
      </mesh>
      {/* Chimenea */}
      <mesh castShadow position={[1.6, H + 1.6, -0.8]}>
        <boxGeometry args={[0.6, 1.4, 0.6]} />
        <meshStandardMaterial color="#b0674b" />
      </mesh>
      {/* Puerta y ventanas */}
      <mesh position={[0, 1.05, D / 2 + 0.03]}>
        <boxGeometry args={[1.1, 2.1, 0.06]} />
        <meshStandardMaterial color="#8d5a3b" />
      </mesh>
      <mesh position={[0.35, 1.05, D / 2 + 0.08]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#ffd54f" />
      </mesh>
      {[-1.9, 1.9].map((wx) => (
        <group key={wx} position={[wx, 2, D / 2 + 0.04]}>
          <mesh>
            <boxGeometry args={[1.1, 1, 0.06]} />
            <meshStandardMaterial color="#b3e5fc" emissive="#b3e5fc" emissiveIntensity={0.1} userData={{ night: 'window' }} />
          </mesh>
          <mesh position={[0, -0.6, 0.12]}>
            <boxGeometry args={[1.3, 0.25, 0.3]} />
            <meshStandardMaterial color="#6d4c41" />
          </mesh>
          {[-0.4, 0, 0.4].map((fx, i) => (
            <mesh key={fx} position={[fx, -0.42, 0.14]}>
              <sphereGeometry args={[0.13, 8, 8]} />
              <meshStandardMaterial color={['#ff6b9d', '#ffd54f', '#ba68c8'][i]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Cerca del jardín */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} castShadow position={[-3.6 + i * 0.9, 0.4, D / 2 + 2.2]}>
          <boxGeometry args={[0.14, 0.8, 0.14]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
      <mesh position={[-1.35, 0.55, D / 2 + 2.2]}>
        <boxGeometry args={[4.6, 0.1, 0.08]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[2.9, 0.55, D / 2 + 2.2]}>
        <boxGeometry args={[1.4, 0.1, 0.08]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Buzón */}
      <group position={[2.6, 0, D / 2 + 2.7]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1, 6]} />
          <meshStandardMaterial color="#6d4c41" />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.35, 0.28, 0.5]} />
          <meshStandardMaterial color="#e53950" />
        </mesh>
      </group>
      {/* Caminito */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, D / 2 + 1.3]}>
        <planeGeometry args={[1.2, 2.6]} />
        <meshStandardMaterial color="#FFF4E3" />
      </mesh>
    </group>
  );
}

function SunArch({ x, z }: { x: number; z: number }) {
  const ray = useMemo(() => new THREE.ConeGeometry(0.28, 0.7, 6), []);
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI / 2, 0]} userData={{ outline: 0.03 }}>
      {[-3.4, 3.4].map((px) => (
        <mesh key={px} castShadow position={[px, 2.3, 0]}>
          <cylinderGeometry args={[0.2, 0.25, 4.6, 10]} />
          <meshStandardMaterial color="#ffb74d" />
        </mesh>
      ))}
      <mesh position={[0, 4.6, 0]}>
        <torusGeometry args={[3.4, 0.22, 8, 32, Math.PI]} />
        <meshStandardMaterial color="#ffb74d" />
      </mesh>
      {/* Sol sonriente */}
      <group position={[0, 6.2, 0]}>
        <mesh>
          <sphereGeometry args={[1, 20, 20]} />
          <meshStandardMaterial color="#ffd54f" emissive="#ffc107" emissiveIntensity={0.35} />
        </mesh>
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return <mesh key={i} geometry={ray} position={[Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0]} rotation={[0, 0, a - Math.PI / 2]}>
            <meshStandardMaterial color="#ffb300" />
          </mesh>;
        })}
        {[-0.32, 0.32].map((ex) => (
          <mesh key={ex} position={[ex, 0.2, 0.92]}>
            <sphereGeometry args={[0.11, 8, 8]} />
            <meshStandardMaterial color="#4a2c1a" />
          </mesh>
        ))}
        <mesh position={[0, -0.22, 0.9]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.3, 0.05, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#4a2c1a" />
        </mesh>
      </group>
    </group>
  );
}

export default function Residencial() {
  const [lx, lz, lw, ld] = RESIDENCIAL_LANE;
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <group userData={{ batch: true }}>
        {/* Calle Sol */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[lx, 0.021, lz]}>
          <planeGeometry args={[lw, ld]} />
          <meshStandardMaterial color="#747184" />
        </mesh>
        {Array.from({ length: Math.floor(lw / 4) }).map((_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[lx - lw / 2 + 2 + i * 4, 0.03, lz]}>
            <planeGeometry args={[1.5, 0.15]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        ))}
        {RESIDENCIAL_HOUSES.map((h) => (
          <House key={`${h.x}-${h.z}`} {...h} />
        ))}
      </group>
      <group userData={{ batch: true }}>
        <SunArch x={-30.5} z={lz} />
      </group>
    </RigidBody>
  );
}
