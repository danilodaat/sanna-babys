'use client';

import { RigidBody } from '@react-three/rapier';

export function Ground() {
  return (
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
  );
}
