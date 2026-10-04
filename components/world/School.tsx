'use client';

import { RigidBody } from '@react-three/rapier';
import { SCHOOL } from '@/lib/mapData';

/*
 * Escuela Arcoíris: edificio de dos pisos con franjas de colores bajo el
 * techo, ventanas de colores, reloj, y un gran arco arcoíris en la entrada.
 */

const RAINBOW = ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#42a5f5', '#ab47bc'];
const SOFT_RAINBOW = ['#D99D9A', '#E4B797', '#E8D8A4', '#91BE89', '#9FC8D8', '#B89AC9'];

export default function School() {
  const [x, z, w, d] = SCHOOL;
  const h = 7;
  const front = d / 2;
  return (
    <RigidBody type="fixed" colliders="trimesh">
      {/* Rotada 180°: la fachada (+z local) mira a la avenida (-z) */}
      <group position={[x, 0, z]} rotation={[0, Math.PI, 0]} userData={{ batch: true }}>
        {/* Cuerpo */}
        <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#FFF4E3" />
        </mesh>
        {/* Franjas arcoíris bajo el techo */}
        {SOFT_RAINBOW.map((c, i) => (
          <mesh key={c} position={[0, h - 0.15 - i * 0.22, 0]}>
            <boxGeometry args={[w + 0.12, 0.22, d + 0.12]} />
            <meshStandardMaterial color={c} />
          </mesh>
        ))}
        <mesh castShadow position={[0, h + 0.2, 0]}>
          <boxGeometry args={[w + 0.8, 0.4, d + 0.8]} />
          <meshStandardMaterial color="#9E8EBC" />
        </mesh>
        {/* Ventanas de colores, 2 pisos */}
        {[1.7, 4.1].map((wy) =>
          [-6, -3.6, 3.6, 6].map((wx, i) => (
            <mesh key={`${wx}-${wy}`} position={[wx, wy, front + 0.04]}>
              <boxGeometry args={[1.5, 1.3, 0.06]} />
              <meshStandardMaterial color={SOFT_RAINBOW[(i + (wy > 2 ? 3 : 0)) % 6]} emissive="#fff8e1" emissiveIntensity={0.1} userData={{ night: 'window' }} />
            </mesh>
          )),
        )}
        {/* Reloj */}
        <group position={[0, 5.3, front + 0.06]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.8, 0.8, 0.1, 24]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0.25, 0.07]}>
            <boxGeometry args={[0.07, 0.5, 0.03]} />
            <meshStandardMaterial color="#37474f" />
          </mesh>
          <mesh position={[0.18, 0, 0.07]} rotation={[0, 0, -Math.PI / 2]}>
            <boxGeometry args={[0.06, 0.38, 0.03]} />
            <meshStandardMaterial color="#37474f" />
          </mesh>
        </group>
        {/* Puerta doble */}
        <mesh position={[0, 1.2, front + 0.04]}>
          <boxGeometry args={[2.4, 2.4, 0.06]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
        {/* Arco arcoíris de la entrada */}
        <group position={[0, 0, front + 1.2]} userData={{ outline: 0.03 }}>
          {RAINBOW.map((c, i) => (
            <mesh key={c} position={[0, 0, 0]}>
              <torusGeometry args={[3.2 - i * 0.26, 0.13, 8, 36, Math.PI]} />
              <meshStandardMaterial color={c} />
            </mesh>
          ))}
          {/* Nubecitas en las bases del arco */}
          {[-3, 3].map((cx) => (
            <group key={cx} position={[cx * 0.83, 0.35, 0]}>
              {[-0.35, 0, 0.35].map((o, i) => (
                <mesh key={o} position={[o, i === 1 ? 0.2 : 0, 0]}>
                  <sphereGeometry args={[0.45, 12, 12]} />
                  <meshStandardMaterial color="#ffffff" />
                </mesh>
              ))}
            </group>
          ))}
        </group>
        {/* Patio: cerca de colores */}
        {Array.from({ length: 12 }).map((_, i) => (i >= 4 && i <= 7 ? null : (
          <mesh key={i} castShadow position={[-w / 2 + 0.5 + i * ((w - 1) / 11), 0.5, front + 4.2]}>
            <boxGeometry args={[0.2, 1, 0.2]} />
            <meshStandardMaterial color={SOFT_RAINBOW[i % 6]} />
          </mesh>
        )))}
      </group>
    </RigidBody>
  );
}
