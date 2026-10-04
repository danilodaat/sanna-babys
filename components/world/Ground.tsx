'use client';

import { RigidBody } from '@react-three/rapier';

export function Ground() {
  return (
    <>
    <RigidBody type="fixed" friction={1}>
      {/* Main ground plane — grass */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[250, 250]} />
        <meshStandardMaterial color="#8FCB78" />
      </mesh>

      {/* Slight border ring for visual depth */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#73A765" />
      </mesh>
    </RigidBody>
      {/* Manchas amplias, separadas 3.5 cm del césped y fuera de las calles. */}
      <group userData={{ batch: true }}>
        {[[-75, 12, 10, 7], [64, -38, 12, 8], [-20, 65, 14, 9], [40, 70, 16, 9]].map(([x, z, rx, rz], i) => (
          <mesh key={i} receiveShadow position={[x, -0.015, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[rx, rz, 1]}>
            <circleGeometry args={[1, 24]} />
            <meshStandardMaterial color={i % 2 ? '#83B976' : '#A0CC8B'} />
          </mesh>
        ))}
      </group>
    </>
  );
}
